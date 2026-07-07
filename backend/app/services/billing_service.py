"""Billing biznes logikasi — magazin/INN statusini hisoblash.

Status INN darajasida hisoblanadi: magazinning INN'i bo'yicha joriy oy
monthly_balances yig'indisidan kelib chiqadi (bitta INN'da bir nechta magazin
bo'lishi mumkin — barchasi shu INN balansini ulashadi).
"""
from collections import defaultdict
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import MonthlyBalance, Shop
from app.models.rent_billing import RentBilling

# rent_billing (sana bo'yicha import) qarzini ko'rsatish bayroqlari:
# - SHOP: bitta magazin modali (ShopDetailModal) — YOQILGAN
# - BATCH: blok/pavilion modali — hozircha o'chiq (dashboard proporsiyasi ustun)
USE_RENT_BILLING_SHOP = True
USE_RENT_BILLING_BATCH = True
from app.schemas.billing import (
    BillingStatusOut,
    CategoryBalance,
    ShopStatus,
)

# Qisman to'lov chegarasi — kichik qoldiqlarni "qarzsiz" deb hisoblash uchun
_EPS = Decimal("1")


def _status_from_amounts(debt: Decimal, paid: Decimal, has_data: bool) -> ShopStatus:
    # DIQQAT: bu tizimda due_amount = QOLGAN QARZ. Shuning uchun bu yerga
    # to'g'ridan-to'g'ri qarz (debt) keladi, "to'liq hisob" emas.
    if not has_data:
        return ShopStatus.NO_DATA
    if debt <= _EPS:
        return ShopStatus.PAID
    if paid > _EPS:
        return ShopStatus.PARTIAL
    return ShopStatus.UNPAID


async def _balances_by_inn(
    db: AsyncSession, inns: list[str], year: int, month: int
) -> dict[str, list[MonthlyBalance]]:
    """Berilgan INN'lar uchun joriy oy balanslarini INN bo'yicha guruhlaydi."""
    if not inns:
        return {}
    result = await db.execute(
        select(MonthlyBalance).where(
            MonthlyBalance.inn.in_(inns),
            MonthlyBalance.year == year,
            MonthlyBalance.month == month,
        )
    )
    grouped: dict[str, list[MonthlyBalance]] = defaultdict(list)
    for bal in result.scalars():
        grouped[bal.inn].append(bal)
    return grouped


async def _latest_rent_billing(
    db: AsyncSession, shop_ids: list[str], market_ids: list[int] | None = None,
    year: int | None = None, month: int | None = None,
) -> dict[str, RentBilling]:
    """Har magazin uchun ENG OXIRGI sanadagi rent_billing yozuvi.

    Magazin/blok modalida qarz endi shu jadvaldan (eng so'nggi import sanasi)
    olinadi. year/month berilsa — faqat shu oy ichidagi sanalar olinadi
    (May/Iyun aralashmasligi uchun). Yozuvi bo'lmagan magazinlar bo'sh qaytadi.
    """
    if not shop_ids:
        return {}
    q = select(RentBilling).where(RentBilling.shop_id.in_(shop_ids))
    if market_ids:
        q = q.where(RentBilling.market_id.in_(market_ids))
    if year is not None and month is not None:
        import calendar as _cal
        from datetime import date as _d
        month_start = _d(year, month, 1)
        month_end   = _d(year, month, _cal.monthrange(year, month)[1])
        q = q.where(
            RentBilling.bill_date >= month_start,
            RentBilling.bill_date <= month_end,
        )
    # Har magazin uchun ENG KAM QARZLI yozuvni tanlaymiz.
    # Bir oyda yoki oldingi 45 kunda bir necha marta import bo'lsa,
    # debt=0 bo'lgan yozuv ustunlik qiladi.
    q = q.order_by(RentBilling.bill_date.asc())
    all_rows: dict[str, list[RentBilling]] = {}
    for rb in (await db.execute(q)).scalars():
        all_rows.setdefault(rb.shop_id, []).append(rb)

    latest: dict[str, RentBilling] = {}
    for shop_id, rows in all_rows.items():
        best = min(rows, key=lambda r: (float(r.debt or 0), -float(r.paid or 0)))
        latest[shop_id] = best
    return latest


def _status_from_rent(
    rb: RentBilling, shop_id: str, inn: str | None,
    other_balances: list[MonthlyBalance] | None = None,
    shop_rent: Decimal | None = None,
) -> BillingStatusOut:
    """rent_billing yozuvidan status (arenda) + eski elektr/suv kategoriyalari.

    JAMI = Shop.monthly_rent (belgilangan summa, barqaror). rent_billing faylida
    ba'zan bitta magazinga butun INN yig'indisi yozilgan bo'ladi, shuning uchun
    Jami ishonchli manbadan (monthly_rent) olinadi.
    QARZ va TO'LANGAN — rent_billing'dan (eng oxirgi sana).
    Elektr/suv esa eski monthly_balances'dan.
    """
    # JAMI — rent_billing.monthly_amount (fayl bilan har oy yangilanadi, to'g'ri manba).
    # Shop.monthly_rent eski/static qiymat bo'lib, faylga mos kelmasligi mumkin.
    # Fallback: shop_rent (agar rent_billing.monthly_amount 0 bo'lsa).
    rb_amount = Decimal(str(rb.monthly_amount or 0))
    if rb_amount > 0:
        jami = rb_amount
    elif shop_rent is not None and shop_rent > 0:
        jami = shop_rent
    else:
        jami = Decimal(0)

    # TO'LANGAN — rent_billing.paid (haqiqiy to'lov, to'g'ri manba).
    tolangan = Decimal(str(rb.paid or 0))
    if tolangan < 0:
        tolangan = Decimal(0)

    # QARZ = JAMI − TO'LANGAN (hisoblanadi).
    qarz = jami - tolangan
    if qarz < 0:
        qarz = Decimal(0)
        tolangan = jami  # to'langan jamidan ko'p bo'lishi mumkin emas

    cats = [CategoryBalance(category="rent", due=jami, paid=tolangan, debt=qarz)]

    # Eski elektr/suv kategoriyalarini qo'shamiz (rent'dan tashqari)
    for b in (other_balances or []):
        if b.category == "rent":
            continue  # arenda rent_billing'dan olindi
        cat_debt = b.due_amount if b.due_amount > 0 else Decimal(0)
        cats.append(CategoryBalance(
            category=b.category,
            due=b.paid_amount + cat_debt,
            paid=b.paid_amount,
            debt=cat_debt,
        ))

    # Umumiy status FAQAT arenda bo'yicha (modal banneri arenda qarzini ko'rsatadi)
    status = _status_from_amounts(qarz, tolangan, jami > 0 or qarz > 0 or tolangan > 0)
    return BillingStatusOut(
        shop_id=shop_id,
        inn=inn,
        status=status,
        total_due=jami,
        total_paid=tolangan,
        total_debt=qarz,
        categories=cats,
    )


def _build_status(
    shop_id: str,
    inn: str | None,
    balances: list[MonthlyBalance],
    monthly_rent: Decimal = Decimal(0),
    debt_share: Decimal | None = None,
) -> BillingStatusOut:
    """Magazin billing statusi.

    Mantiq (foydalanuvchi tasdiqlagan):
      - JAMI (total_due)  = magazinning belgilangan summasi (shops.monthly_rent),
        Google Sheets'dan kelgan statik qiymat. Billing debet/kreditga BOG'LIQ EMAS.
      - QARZDORLIK (debt) = magazin INN'ining billingdagi qarzi (Дебет),
        shu INN magazinlariga teng taqsimlangan ulush (debt_share).
      - TO'LANGAN (paid)  = JAMI − QARZDORLIK.

    Kategoriyalar (rent/electricity/water) status ranglari uchun billingdan
    olinadi, lekin umumiy summalar yuqoridagi mantiq bo'yicha.
    """
    jami = monthly_rent if monthly_rent and monthly_rent > 0 else Decimal(0)

    # Qarzdorlik: INN qarzining shu magazinga to'g'ri keladigan ulushi.
    # debt_share berilmasa — balanslardan hisoblaymiz (eski yo'l).
    if debt_share is None:
        debt_share = sum(
            (b.due_amount for b in balances if b.due_amount and b.due_amount > 0),
            Decimal(0),
        )
    qarz = debt_share if debt_share and debt_share > 0 else Decimal(0)

    # TO'LANGAN = JAMI − QARZDORLIK. Qarz jamidan katta bo'lsa to'langan 0.
    # (Qarz monthly_rent bilan cheklanMAYDI — bu billingdagi haqiqiy qarz ulushi.)
    tolangan = jami - qarz
    if tolangan < 0:
        tolangan = Decimal(0)

    # Kategoriya breakdown (status ranglari uchun) — billingdan
    cats: list[CategoryBalance] = []
    for b in balances:
        debt = b.due_amount if b.due_amount > 0 else Decimal(0)
        cats.append(
            CategoryBalance(
                category=b.category,
                due=b.paid_amount + debt,   # kategoriya bo'yicha hisoblangan
                paid=b.paid_amount,
                debt=debt,
            )
        )

    has_data = jami > 0 or len(balances) > 0
    status = _status_from_amounts(qarz, tolangan, has_data)
    return BillingStatusOut(
        shop_id=shop_id,
        inn=inn,
        status=status,
        total_due=jami,        # JAMI = belgilangan summa
        total_paid=tolangan,   # TO'LANGAN = jami − qarz
        total_debt=qarz,       # QARZDORLIK = INN qarzidan ulush
        categories=cats,
    )


async def compute_batch_status(
    db: AsyncSession, shop_ids: list[str], year: int, month: int
) -> dict[str, BillingStatusOut]:
    """Bir nechta magazin uchun billing statusini hisoblaydi (N+1 siz).

    JAMI = magazin monthly_rent; QARZDORLIK = INN qarzi magazinlarga teng
    taqsimlangan; TO'LANGAN = JAMI − QARZDORLIK.
    """
    if not shop_ids:
        return {}

    # shop_id -> (inn, monthly_rent)
    rows = await db.execute(
        select(Shop.shop_id, Shop.inn, Shop.monthly_rent).where(Shop.shop_id.in_(shop_ids))
    )
    shop_inn: dict[str, str | None] = {}
    shop_rent: dict[str, Decimal] = {}
    for sid, inn, rent in rows.all():
        shop_inn[sid] = inn
        shop_rent[sid] = Decimal(str(rent or 0))

    inns = [inn for inn in shop_inn.values() if inn]
    by_inn = await _balances_by_inn(db, list(set(inns)), year, month)

    # Har INN uchun jami qarz (Дебет yig'indisi)
    inn_debt: dict[str, Decimal] = {}
    for inn, bals in by_inn.items():
        inn_debt[inn] = sum(
            (b.due_amount for b in bals if b.due_amount and b.due_amount > 0),
            Decimal(0),
        )

    # Har INN bu so'rovdagi nechta magazinga tegishli — qarzni teng taqsimlash uchun.
    # DIQQAT: INN'ning shu BOZORDAGI (market) BARCHA aktiv magazinlari bo'yicha
    # taqsimlaymiz. Boshqa bozor/demo magazinlari hisobga olinmaydi, aks holda
    # qarz keraksiz ko'p bo'lakka bo'linib, ulush juda kichrayib ketadi.
    inn_shop_count: dict[str, int] = {}
    # Shu so'rovdagi magazinlar qaysi market(lar)ga tegishli? (har doim hisoblanadi —
    # rent_billing filtri uchun ham kerak, boshqa bozordagi bir xil shop_id
    # aralashib ketmasligi uchun)
    market_ids = list({
        mid for (mid,) in (await db.execute(
            select(Shop.market_id).where(Shop.shop_id.in_(shop_ids)).distinct()
        )).all() if mid is not None
    })
    if inns:
        cnt_q = (
            select(Shop.inn, func.count(Shop.shop_id))
            .where(Shop.inn.in_(list(set(inns))), Shop.is_active.is_(True))
            .group_by(Shop.inn)
        )
        if market_ids:
            cnt_q = cnt_q.where(Shop.market_id.in_(market_ids))
        cnt_rows = await db.execute(cnt_q)
        inn_shop_count = {inn: int(c) for inn, c in cnt_rows.all()}

    out: dict[str, BillingStatusOut] = {}
    # rent_billing (eng oxirgi sana) bo'lsa — qarz shundan olinadi (blok uchun bayroq)
    rent_latest = (
        await _latest_rent_billing(db, shop_ids, market_ids=market_ids or None, year=year, month=month)
        if USE_RENT_BILLING_BATCH else {}
    )
    for sid in shop_ids:
        inn = shop_inn.get(sid)
        rb = rent_latest.get(sid)
        if rb is not None:
            other = by_inn.get(inn, []) if inn else []
            out[sid] = _status_from_rent(
                rb, sid, inn, other_balances=other,
                shop_rent=shop_rent.get(sid, Decimal(0)),
            )
            continue
        balances = by_inn.get(inn, []) if inn else []
        rent = shop_rent.get(sid, Decimal(0))
        # Qarz ulushi: INN qarzini shu INN magazinlari soniga bo'lamiz
        debt_share = Decimal(0)
        if inn and inn in inn_debt:
            n = max(inn_shop_count.get(inn, 1), 1)
            debt_share = inn_debt[inn] / n
        out[sid] = _build_status(sid, inn, balances, monthly_rent=rent, debt_share=debt_share)
    return out


async def compute_shop_status(
    db: AsyncSession, shop_id: str, inn: str | None, year: int, month: int,
    market_id: int | None = None,
) -> BillingStatusOut:
    """Bitta magazin uchun billing statusi."""
    # Eski balanslar (elektr/suv uchun ham kerak)
    balances: list[MonthlyBalance] = []
    debt_share = Decimal(0)
    if inn:
        by_inn = await _balances_by_inn(db, [inn], year, month)
        balances = by_inn.get(inn, [])
        inn_debt = sum(
            (b.due_amount for b in balances if b.due_amount and b.due_amount > 0),
            Decimal(0),
        )
        # INN ning aktiv magazinlari soni bo'yicha taqsimlash (shu bozorda)
        cnt_q = select(func.count(Shop.shop_id)).where(Shop.inn == inn, Shop.is_active.is_(True))
        if market_id is not None:
            cnt_q = cnt_q.where(Shop.market_id == market_id)
        cnt = await db.scalar(cnt_q)
        debt_share = inn_debt / max(int(cnt or 1), 1)

    # Magazinning belgilangan summasi (JAMI uchun — barqaror manba)
    rent = await db.scalar(select(Shop.monthly_rent).where(Shop.shop_id == shop_id))
    monthly_rent = Decimal(str(rent or 0))

    # rent_billing (eng oxirgi sana) bo'lsa — qarz/to'langan shundan,
    # JAMI esa monthly_rent'dan (fayldagi xato summalardan himoya). Elektr/suv eskidan.
    if USE_RENT_BILLING_SHOP:
        m_ids = [market_id] if market_id is not None else None
        rent_latest = await _latest_rent_billing(db, [shop_id], market_ids=m_ids, year=year, month=month)
        rb = rent_latest.get(shop_id)
        if rb is not None:
            return _status_from_rent(
                rb, shop_id, inn, other_balances=balances, shop_rent=monthly_rent,
            )

    return _build_status(shop_id, inn, balances, monthly_rent=monthly_rent, debt_share=debt_share)
