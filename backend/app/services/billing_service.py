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
    # Qarz jamidan oshmasin (statik summa cheklovi)
    if jami > 0 and qarz > jami:
        qarz = jami

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
    # DIQQAT: INN'ning BARCHA aktiv magazinlari bo'yicha taqsimlaymiz (faqat shu
    # pavilion emas) — qarz adolatli bo'lishi uchun.
    inn_shop_count: dict[str, int] = {}
    if inns:
        cnt_rows = await db.execute(
            select(Shop.inn, func.count(Shop.shop_id))
            .where(Shop.inn.in_(list(set(inns))), Shop.is_active.is_(True))
            .group_by(Shop.inn)
        )
        inn_shop_count = {inn: int(c) for inn, c in cnt_rows.all()}

    out: dict[str, BillingStatusOut] = {}
    for sid in shop_ids:
        inn = shop_inn.get(sid)
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
    db: AsyncSession, shop_id: str, inn: str | None, year: int, month: int
) -> BillingStatusOut:
    """Bitta magazin uchun billing statusi."""
    balances: list[MonthlyBalance] = []
    debt_share = Decimal(0)
    if inn:
        by_inn = await _balances_by_inn(db, [inn], year, month)
        balances = by_inn.get(inn, [])
        inn_debt = sum(
            (b.due_amount for b in balances if b.due_amount and b.due_amount > 0),
            Decimal(0),
        )
        # INN ning aktiv magazinlari soni bo'yicha taqsimlash
        cnt = await db.scalar(
            select(func.count(Shop.shop_id)).where(Shop.inn == inn, Shop.is_active.is_(True))
        )
        debt_share = inn_debt / max(int(cnt or 1), 1)

    # Magazinning belgilangan summasi
    rent = await db.scalar(select(Shop.monthly_rent).where(Shop.shop_id == shop_id))
    monthly_rent = Decimal(str(rent or 0))
    return _build_status(shop_id, inn, balances, monthly_rent=monthly_rent, debt_share=debt_share)
