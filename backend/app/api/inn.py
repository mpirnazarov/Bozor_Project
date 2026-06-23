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
    market: CurrentMarket,
    db: Annotated[AsyncSession, Depends(get_db)],
    q: str = Query(..., min_length=1, description="INN yoki nom"),
    limit: int = Query(20, ge=1, le=100),
) -> list[InnSearchResult]:
    """INN yoki nom bo'yicha qidirish — faqat shu bozor magazinlari."""
    pattern = f"%{q.strip()}%"
    stmt = (
        select(
            Counterparty.inn,
            Counterparty.name,
            func.count(Shop.id).label("shop_count"),
        )
        .outerjoin(Shop, (Shop.inn == Counterparty.inn) & (Shop.market_id == market.id))
        .where(
            or_(
                Counterparty.inn.ilike(pattern),
                Counterparty.name.ilike(pattern),
            )
        )
        .where(Shop.market_id == market.id)
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
) -> InnDetailOut:
    """INN bo'yicha kontragent + faqat shu bozordagi magazinlari."""
    cp = await db.get(Counterparty, inn)
    if cp is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Kontragent topilmadi")

    result = await db.execute(
        select(Shop).where(Shop.inn == inn, Shop.market_id == market.id).order_by(Shop.shop_id)
    )
    shops = [ShopOut.model_validate(s) for s in result.scalars()]

    return InnDetailOut(
        counterparty=CounterpartyOut(
            inn=cp.inn,
            name=cp.name,
            contract_no=cp.contract_no,
            contract_date=cp.contract_date.isoformat() if cp.contract_date else None,
            phone=cp.phone,
        ),
        shops=shops,
    )
