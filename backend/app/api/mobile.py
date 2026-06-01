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
    # DIQQAT: due_amount = QOLGAN QARZ, paid_amount = to'langan.
    #   => paid = paid_amount, debt = due_amount, due = paid + debt
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
