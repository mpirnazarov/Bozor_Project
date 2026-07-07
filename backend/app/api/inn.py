"""INN endpoint — /api/inn (qidirish va detal)."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import CurrentMarket, CurrentUser
from app.models import Counterparty, Shop
from app.schemas.billing import (
    CounterpartyOut,
    InnDetailOut,
    InnSearchResult,
    ShopOut,
)

router = APIRouter()


@router.get("/search", response_model=list[InnSearchResult])
async def search_inn(
    _user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    q: str = Query(..., min_length=1, description="INN yoki nom"),
    limit: int = Query(20, ge=1, le=100),
) -> list[InnSearchResult]:
    """INN yoki nom bo'yicha qidirish (nom uchun fuzzy ILIKE)."""
    pattern = f"%{q.strip()}%"
    stmt = (
        select(
            Counterparty.inn,
            Counterparty.name,
            func.count(Shop.id).label("shop_count"),
        )
        .outerjoin(Shop, Shop.inn == Counterparty.inn)
        .where(
            or_(
                Counterparty.inn.ilike(pattern),
                Counterparty.name.ilike(pattern),
            )
        )
        .group_by(Counterparty.inn, Counterparty.name)
        .order_by(Counterparty.name)
        .limit(limit)
    )
    result = await db.execute(stmt)
    return [
        InnSearchResult(inn=inn, name=name, shop_count=cnt)
        for inn, name, cnt in result.all()
    ]


@router.get("/debug/inn-debt")
async def debug_inn_debt(
    db: Annotated[AsyncSession, Depends(get_db)],
    inn: str = Query(...),
    key: str = Query(""),
) -> dict:
    """DIAGNOSTIKA: INN ning har oy/kategoriya qarzi. ?inn=...&key=orik-debug-2026"""
    from app.models import MonthlyBalance
    if key != "orik-debug-2026":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "key noto'g'ri")
    rows = list((await db.execute(
        select(MonthlyBalance).where(MonthlyBalance.inn == inn)
        .order_by(MonthlyBalance.year, MonthlyBalance.month, MonthlyBalance.category)
    )).scalars())
    out = []
    for b in rows:
        out.append({
            "year": b.year, "month": b.month, "category": b.category,
            "due_amount": float(b.due_amount or 0), "paid_amount": float(b.paid_amount or 0),
        })
    return {"inn": inn, "rows": len(out), "balances": out}


@router.get("/{inn}", response_model=InnDetailOut)
async def get_inn(
    inn: str,
    _user: CurrentUser,
    market: CurrentMarket,
    db: Annotated[AsyncSession, Depends(get_db)],
    year: int | None = Query(None),
    month: int | None = Query(None, ge=1, le=12),
) -> InnDetailOut:
    """INN bo'yicha kontragent + magazinlar + har biriga billing."""
    from datetime import date as _d
    from app.models import RentBilling
    from decimal import Decimal

    today = _d.today()
    yr = year or today.year
    mo = month or today.month

    cp = await db.get(Counterparty, inn)
    if cp is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Kontragent topilmadi")

    result = await db.execute(
        select(Shop).where(Shop.inn == inn, Shop.market_id == market.id)
        .order_by(Shop.shop_id)
    )
    shops_db = list(result.scalars())

    # Har magazin uchun rent_billing dan to'lov ma'lumoti
    shop_ids = [s.shop_id for s in shops_db]
    import calendar as _cal
    mstart = _d(yr, mo, 1)
    mend   = _d(yr, mo, _cal.monthrange(yr, mo)[1])
    rb_rows = (await db.execute(
        select(RentBilling).where(
            RentBilling.shop_id.in_(shop_ids),
            RentBilling.market_id == market.id,
            RentBilling.bill_date >= mstart,
            RentBilling.bill_date <= mend,
        ).order_by(RentBilling.bill_date.asc())
    )).scalars().all()

    # Eng kam qarzli yozuv
    rb_map: dict[str, RentBilling] = {}
    for rb in rb_rows:
        prev = rb_map.get(rb.shop_id)
        if prev is None or float(rb.debt or 0) < float(prev.debt or 0):
            rb_map[rb.shop_id] = rb

    # ShopOut + billing
    shops_out = []
    total_due  = Decimal(0)
    total_paid = Decimal(0)
    total_debt = Decimal(0)

    for s in shops_db:
        so = ShopOut.model_validate(s)
        rb = rb_map.get(s.shop_id)
        if rb:
            due  = Decimal(str(rb.monthly_amount or 0))
            paid = Decimal(str(rb.paid or 0))
            if paid < 0: paid = Decimal(0)
            debt = max(Decimal(0), due - paid)
        else:
            due = paid = debt = Decimal(0)
        # ShopOut ga billing fieldlar qo'shamiz (schema da yo'q, dict sifatida)
        so.__dict__["billing_due"]  = float(due)
        so.__dict__["billing_paid"] = float(paid)
        so.__dict__["billing_debt"] = float(debt)
        shops_out.append(so)
        total_due  += due
        total_paid += paid
        total_debt += debt

    return InnDetailOut(
        counterparty=CounterpartyOut(
            inn=cp.inn,
            name=cp.name,
            contract_no=cp.contract_no,
            contract_date=cp.contract_date.isoformat() if cp.contract_date else None,
            phone=cp.phone,
        ),
        shops=shops_out,
        total_due=float(total_due),
        total_paid=float(total_paid),
        total_debt=float(total_debt),
        year=yr,
        month=mo,
    )
