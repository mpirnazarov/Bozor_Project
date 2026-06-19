"""Mobil ilova uchun ochiq endpoint — /api/mobile.

Eski PHP `counterparty.php` bilan BIR XIL JSON formatda javob qaytaradi,
shunda Android ilova kodiga tegmasdan yangi backendga ulanadi.

GET /api/mobile/counterparty?inn=XXX&year=2026&month=5[&market=orikzor]

DIQQAT: bu endpoint autentifikatsiyasiz (eski PHP ham public edi). Faqat
o'qish (read-only) — INN bo'yicha kontragent, magazinlar va to'lovlar.
"""
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.counterparty import Counterparty
from app.models.market import Market
from app.models.monthly_balance import BillingCategory, MonthlyBalance
from app.models.shop import Shop

router = APIRouter()


def _f(v) -> float:
    return float(v or 0)


@router.get("/markets")
async def mobile_markets(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[dict]:
    """Mobil ilova uchun bozorlar ro'yxati (faol, bloklanmagan).

    O'rikzor doim birinchi, qolganlar display_order bo'yicha.
    """
    rows = await db.execute(
        select(Market)
        .where(Market.is_active.is_(True), Market.support_blocked.is_(False))
        .order_by(Market.display_order, Market.id)
    )
    markets = list(rows.scalars())
    # O'rikzorni ro'yxat boshiga olamiz
    markets.sort(key=lambda m: (m.slug != "orikzor", m.display_order, m.id))
    return [
        {"id": m.id, "slug": m.slug, "name": m.name}
        for m in markets
    ]


@router.get("/counterparty")
async def mobile_counterparty(
    db: Annotated[AsyncSession, Depends(get_db)],
    inn: str = Query(..., description="Kontragent INN"),
    year_q: int | None = Query(None, alias="year"),
    month_q: int | None = Query(None, alias="month"),
    market: str = Query(..., description="Bozor slug (majburiy)"),
) -> dict:
    """Eski PHP counterparty.php bilan bir xil format.

    DIQQAT: faqat tanlangan bozor (market) ichidan qidiradi. INN o'sha
    bozorga tegishli bo'lmasa — topilmadi deb qaytaradi.
    """
    inn = inn.strip()
    if not inn:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "INN parametri kerak")

    today = date.today()
    year = year_q or today.year
    month = month_q or today.month

    # Bozorni aniqlaymiz (majburiy)
    m = await db.scalar(select(Market).where(Market.slug == market.strip()))
    if m is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bozor topilmadi")
    market_id = m.id

    # 1. Kontragent
    cp = await db.get(Counterparty, inn)
    if cp is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "INN bo'yicha kontragent topilmadi")

    # INN shu bozorda magazinga ega ekanini tekshiramiz —
    # boshqa bozorning INN'i bilan kirishga yo'l qo'ymaймiz.
    has_in_market = await db.scalar(
        select(Shop.id).where(Shop.inn == inn, Shop.market_id == market_id).limit(1)
    )
    if has_in_market is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "Bu INN tanlangan bozorda topilmadi",
        )

    # 2. Magazinlar (faqat shu bozor)
    shop_stmt = (
        select(Shop)
        .where(Shop.inn == inn, Shop.is_active.is_(True), Shop.market_id == market_id)
        .order_by(Shop.shop_id)
    )
    shops_db = list((await db.execute(shop_stmt)).scalars())

    # Davrni aniqlaymiz: agar so'ralgan (yoki joriy) oyda balans bo'lmasa,
    # shu INN uchun ENG SO'NGGI mavjud oyni avtomatik olamiz — shunda
    # to'lovlar 0 ko'rinib qolmaydi.
    explicit_period = year_q is not None and month_q is not None
    # Davrni aniqlash uchun shu INN bo'yicha balanslar qaysi market_id'da borligini
    # tekshiramiz. Eski import'da balanslar market_id'siz/boshqa bo'lishi mumkin,
    # shuning uchun avval shu bozor, bo'lmasa umuman INN bo'yicha olamiz.
    bal_market_filter = MonthlyBalance.market_id == market_id
    has_market_bal = await db.scalar(
        select(MonthlyBalance.id).where(MonthlyBalance.inn == inn, bal_market_filter).limit(1)
    )
    use_market_filter = has_market_bal is not None

    if not explicit_period:
        period_q = (
            select(MonthlyBalance.year, MonthlyBalance.month)
            .where(MonthlyBalance.inn == inn)
            .order_by(MonthlyBalance.year.desc(), MonthlyBalance.month.desc())
            .limit(1)
        )
        if use_market_filter:
            period_q = period_q.where(bal_market_filter)
        latest = (await db.execute(period_q)).first()
        if latest is not None:
            year, month = int(latest[0]), int(latest[1])

    # 3. Billing (monthly_balances) — kategoriya bo'yicha
    # DIQQAT: due_amount (Дебет) = QARZ, paid_amount (Кредит) = TO'LANGAN.
    #   => due (jami) = to'langan + qarz, paid = paid_amount, debt = due_amount
    bal_stmt = (
        select(
            MonthlyBalance.category,
            func.coalesce(func.sum(MonthlyBalance.due_amount), 0),
            func.coalesce(func.sum(MonthlyBalance.paid_amount), 0),
        )
        .where(
            MonthlyBalance.inn == inn,
            MonthlyBalance.year == year,
            MonthlyBalance.month == month,
        )
        .group_by(MonthlyBalance.category)
    )
    if use_market_filter:
        bal_stmt = bal_stmt.where(bal_market_filter)

    def _zero() -> dict:
        return {"due": 0.0, "paid": 0.0, "debt": 0.0}

    rent, electricity, water = _zero(), _zero(), _zero()
    for category, debt_sum, paid_sum in (await db.execute(bal_stmt)).all():
        debt = _f(debt_sum)
        paid = _f(paid_sum)
        info = {"due": paid + debt, "paid": paid, "debt": debt}
        if category == BillingCategory.RENT.value:
            rent = info
        elif category == BillingCategory.ELECTRICITY.value:
            electricity = info
        elif category == BillingCategory.WATER.value:
            water = info

    # 3b. Arenda — agar rent_billing'da (sana bo'yicha import) ma'lumot bo'lsa,
    # arendani SHUNDAN olamiz (web modal bilan bir xil). Elektr/suv monthly_balances'dan.
    # rent_billing magazin ID bo'yicha — shu INN magazinlarining eng oxirgi sanadagi
    # yozuvlarini yig'amiz.
    from app.models import RentBilling
    from datetime import date as _date_cls
    import calendar as _cal
    shop_ids_for_rb = [s.shop_id for s in shops_db]
    if shop_ids_for_rb:
        # Tanlangan oy oralig'i (rent_billing sana bo'yicha — shu oy ichidagilar)
        _mstart = _date_cls(year, month, 1)
        _mend = _date_cls(year, month, _cal.monthrange(year, month)[1])
        rb_q = (
            select(RentBilling)
            .where(
                RentBilling.shop_id.in_(shop_ids_for_rb),
                RentBilling.bill_date >= _mstart,
                RentBilling.bill_date <= _mend,
            )
            .order_by(RentBilling.bill_date.asc())
        )
        if use_market_filter:
            rb_q = rb_q.where(RentBilling.market_id == market_id)
        rb_latest: dict[str, RentBilling] = {}
        for rb in (await db.execute(rb_q)).scalars():
            rb_latest[rb.shop_id] = rb  # shu oy ichidagi oxirgi sana qoladi
        if rb_latest:
            rb_due = sum((_f(r.monthly_amount) for r in rb_latest.values()), 0.0)
            rb_debt = sum((max(0.0, _f(r.debt)) for r in rb_latest.values()), 0.0)
            rb_paid = sum((_f(r.paid) for r in rb_latest.values()), 0.0)
            # To'langan berilmagan bo'lsa: jami − qarz
            if rb_paid <= 0 and rb_due > 0:
                rb_paid = max(0.0, rb_due - rb_debt)
            rent = {"due": rb_due, "paid": rb_paid, "debt": rb_debt}

    # 4. Har magazin uchun arenda holati (rent kategoriyasidagi balansdan).
    # Eski API shop_rent_payments dan olardi; bizda alohida jadval yo'q,
    # shuning uchun magazin darajasida monthly_rent va umumiy rent holatini beramiz.
    # Magazin statusi: agar kontragentda rent qarzi bo'lsa "partial/unpaid", aks holda "paid".
    rent_debt = rent["debt"]
    rent_paid = rent["paid"]
    if rent["due"] <= 0:
        rent_status = "no_data"
    elif rent_debt <= 1:
        rent_status = "paid"
    elif rent_paid > 1:
        rent_status = "partial"
    else:
        rent_status = "unpaid"

    shops_out = []
    for s in shops_db:
        # shop_type ustunida import paytida ba'zan firma nomi saqlangan
        # (masalan "(рекл)2"). Foydalanuvchiga faoliyat turini (purpose)
        # ko'rsatamiz; u bo'sh bo'lsa — bo'sh qoldiramiz.
        display_type = (s.purpose or "").strip() or None
        shops_out.append({
            "shop_id": s.shop_id,
            "pavilion_code": s.pavilion_code,
            "region_id": s.pavilion_id,
            "monthly_rent": _f(s.monthly_rent),
            "shop_type": display_type,
            "rent_due": _f(s.monthly_rent),
            "rent_paid": 0.0,
            "rent_status": rent_status,
        })

    # 5. Umumiy statistika
    total_due = rent["due"] + electricity["due"] + water["due"]
    total_paid = rent["paid"] + electricity["paid"] + water["paid"]
    total_debt = max(0.0, rent["debt"]) + max(0.0, electricity["debt"]) + max(0.0, water["debt"])

    return {
        "counterparty": {
            "inn": cp.inn,
            "name": cp.name,
            "contract_no": cp.contract_no,
            "contract_date": cp.contract_date.isoformat() if cp.contract_date else None,
            "phone": cp.phone,
        },
        "shops": shops_out,
        "shops_count": len(shops_out),
        "period": {"year": year, "month": month},
        "payments": {
            "rent": rent,
            "electricity": electricity,
            "water": water,
        },
        "totals": {
            "due": total_due,
            "paid": total_paid,
            "debt": total_debt,
        },
    }


@router.get("/periods")
async def mobile_periods(
    db: Annotated[AsyncSession, Depends(get_db)],
    inn: str = Query(..., description="Kontragent INN"),
    market: str = Query(..., description="Bozor slug"),
) -> list[dict]:
    """Shu INN uchun DB'da mavjud oylar (eng so'nggi 12 ta).

    Android oy tanlashda faqat shu ro'yxatni ko'rsatadi — ma'lumoti yo'q
    oylar ko'rsatilmaydi.
    """
    inn = inn.strip()
    m = await db.scalar(select(Market).where(Market.slug == market.strip()))
    if m is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bozor topilmadi")

    # Shu bozorda balanslar bormi — bo'lmasa market filtrisiz INN bo'yicha
    has_market_bal = await db.scalar(
        select(MonthlyBalance.id).where(
            MonthlyBalance.inn == inn, MonthlyBalance.market_id == m.id
        ).limit(1)
    )
    q = (
        select(MonthlyBalance.year, MonthlyBalance.month)
        .where(MonthlyBalance.inn == inn)
        .group_by(MonthlyBalance.year, MonthlyBalance.month)
        .order_by(MonthlyBalance.year.desc(), MonthlyBalance.month.desc())
        .limit(12)
    )
    if has_market_bal is not None:
        q = q.where(MonthlyBalance.market_id == m.id)

    rows = (await db.execute(q)).all()
    return [{"year": int(y), "month": int(mo)} for y, mo in rows]


@router.get("/debug/inn-summary")
async def debug_inn_summary(
    db: Annotated[AsyncSession, Depends(get_db)],
    inn: str = Query(...),
    year: int = Query(...),
    month: int = Query(...),
    key: str = Query(...),
):
    """INN bo'yicha jami summa diagnostikasi. ?inn=...&year=2026&month=6&key=orik-debug-2026"""
    if key != "orik-debug-2026":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "key")
    from app.models import RentBilling
    from datetime import date as _d
    import calendar as _cal

    # Magazinlar
    shops = list((await db.execute(
        select(Shop).where(Shop.inn == inn)
    )).scalars())
    shop_info = [{
        "shop_id": s.shop_id, "market_id": s.market_id,
        "monthly_rent": float(s.monthly_rent or 0), "active": s.is_active,
    } for s in shops]

    # monthly_balances (elektr/suv/rent)
    mb = list((await db.execute(
        select(MonthlyBalance).where(
            MonthlyBalance.inn == inn, MonthlyBalance.year == year, MonthlyBalance.month == month,
        )
    )).scalars())
    mb_info = [{
        "category": b.category, "due_amount": float(b.due_amount),
        "paid_amount": float(b.paid_amount), "market_id": b.market_id,
    } for b in mb]

    # rent_billing (shu oy)
    shop_ids = [s.shop_id for s in shops]
    rb_info = []
    if shop_ids:
        mstart = _d(year, month, 1)
        mend = _d(year, month, _cal.monthrange(year, month)[1])
        rb = list((await db.execute(
            select(RentBilling).where(
                RentBilling.shop_id.in_(shop_ids),
                RentBilling.bill_date >= mstart, RentBilling.bill_date <= mend,
            ).order_by(RentBilling.bill_date.asc())
        )).scalars())
        # eng oxirgi sana har shop_id uchun
        latest = {}
        for r in rb:
            latest[r.shop_id] = r
        rb_info = [{
            "shop_id": r.shop_id, "bill_date": r.bill_date.isoformat(),
            "monthly_amount": float(r.monthly_amount), "debt": float(r.debt), "paid": float(r.paid),
            "market_id": r.market_id,
        } for r in latest.values()]

    rb_due = sum(x["monthly_amount"] for x in rb_info)
    mb_rent_due = sum(x["due_amount"] + x["paid_amount"] for x in mb_info if x["category"] == "rent")
    shop_rent_sum = sum(x["monthly_rent"] for x in shop_info if x["active"])

    return {
        "inn": inn, "year": year, "month": month,
        "shops": shop_info,
        "shop_count": len(shops),
        "monthly_balances": mb_info,
        "rent_billing_this_month": rb_info,
        "SUMMARY": {
            "shop_monthly_rent_sum": shop_rent_sum,
            "rent_billing_monthly_amount_sum": rb_due,
            "monthly_balances_rent_due+paid": mb_rent_due,
            "note": "mobile rent.due = rent_billing_sum (agar rent_billing bo'lsa), aks holda monthly_balances rent",
        },
    }
