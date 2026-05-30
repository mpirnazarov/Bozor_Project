"""INN endpoint — /api/inn (qidirish va detal)."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import CurrentUser
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


@router.get("/{inn}", response_model=InnDetailOut)
async def get_inn(
    inn: str,
    _user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> InnDetailOut:
    """INN bo'yicha kontragent + uning barcha magazinlari."""
    cp = await db.get(Counterparty, inn)
    if cp is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Kontragent topilmadi")

    result = await db.execute(
        select(Shop).where(Shop.inn == inn).order_by(Shop.shop_id)
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
