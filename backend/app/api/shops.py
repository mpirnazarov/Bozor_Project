"""Shops endpoint — /api/shops."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import CurrentUser
from app.models import Counterparty, Shop
from app.schemas.billing import (
    CounterpartyOut,
    PaginatedShops,
    ShopDetailOut,
    ShopOut,
)
from app.services.billing_service import compute_shop_status

router = APIRouter()


@router.get("", response_model=PaginatedShops)
async def list_shops(
    _user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    inn: str | None = Query(None),
    pavilion: str | None = Query(None, description="pavilion_code bo'yicha"),
    q: str | None = Query(None, description="shop_id ichidan qidirish"),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
) -> PaginatedShops:
    """Magazinlar ro'yxati — filtrlash va sahifalash bilan."""
    stmt = select(Shop)
    if inn:
        stmt = stmt.where(Shop.inn == inn)
    if pavilion:
        stmt = stmt.where(Shop.pavilion_code == pavilion)
    if q:
        stmt = stmt.where(Shop.shop_id.ilike(f"%{q}%"))

    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    stmt = stmt.order_by(Shop.shop_id).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(stmt)
    items = [ShopOut.model_validate(s) for s in result.scalars()]

    return PaginatedShops(items=items, page=page, per_page=per_page, total=total or 0)


@router.get("/{shop_id}", response_model=ShopDetailOut)
async def get_shop(
    shop_id: str,
    _user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    year: int = Query(2026),
    month: int = Query(5, ge=1, le=12),
) -> ShopDetailOut:
    """Magazin detali — kontragent + joriy oy billing."""
    result = await db.execute(select(Shop).where(Shop.shop_id == shop_id))
    shop = result.scalar_one_or_none()
    if shop is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Magazin topilmadi")

    cp = None
    if shop.inn:
        cp_obj = await db.get(Counterparty, shop.inn)
        if cp_obj is not None:
            cp = CounterpartyOut(
                inn=cp_obj.inn,
                name=cp_obj.name,
                contract_no=cp_obj.contract_no,
                contract_date=cp_obj.contract_date.isoformat() if cp_obj.contract_date else None,
                phone=cp_obj.phone,
            )

    billing = await compute_shop_status(db, shop_id, shop.inn, year, month)

    return ShopDetailOut(
        shop=ShopOut.model_validate(shop),
        counterparty=cp,
        billing=billing,
    )
