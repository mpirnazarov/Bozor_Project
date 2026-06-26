"""Shops endpoint — /api/shops."""
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import CurrentMarket, CurrentUser
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
    market: CurrentMarket,
    db: Annotated[AsyncSession, Depends(get_db)],
    inn: str | None = Query(None),
    pavilion: str | None = Query(None, description="pavilion_code bo'yicha"),
    q: str | None = Query(None, description="shop_id ichidan qidirish"),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
) -> PaginatedShops:
    """Magazinlar ro'yxati — filtrlash va sahifalash bilan (joriy bozor)."""
    stmt = select(Shop).where(Shop.market_id == market.id)
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


async def _build_shop_detail(
    shop_id: str, market, db: AsyncSession, year: int | None, month: int | None
) -> ShopDetailOut:
    """Magazin detali — kontragent + billing (umumiy yordamchi)."""
    today = date.today()
    year = year or today.year
    month = month or today.month
    result = await db.execute(
        select(Shop).where(Shop.shop_id == shop_id, Shop.market_id == market.id)
    )
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


@router.get("/by-id", response_model=ShopDetailOut)
async def get_shop_by_query(
    _user: CurrentUser,
    market: CurrentMarket,
    db: Annotated[AsyncSession, Depends(get_db)],
    shop_id: str = Query(..., description="Magazin ID (slash/maxsus belgilar uchun)"),
    year: int | None = Query(None),
    month: int | None = Query(None, ge=1, le=12),
) -> ShopDetailOut:
    """Magazin detali — shop_id query parametr orqali.

    shop_id ichida `/` yoki maxsus belgilar bo'lganda path emas, query
    ishlatiladi (masalan "01-1-1-026А/012").
    """
    return await _build_shop_detail(shop_id, market, db, year, month)


@router.get("/history/{shop_id}", response_model=list[dict])
async def get_shop_history(
    shop_id: str,
    _user: CurrentUser,
    market: CurrentMarket,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[dict]:
    """Do'kon egalik tarixi — qachon kim egalik qilgani."""
    from sqlalchemy import select as _sel
    shop = (await db.execute(
        _sel(Shop).where(Shop.shop_id == shop_id, Shop.market_id == market.id)
    )).scalar_one_or_none()
    if shop is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Do'kon topilmadi")

    rows = (await db.execute(
        _sel(ShopHistory)
        .where(ShopHistory.shop_id == shop.id)
        .order_by(ShopHistory.changed_at.desc())
        .limit(50)
    )).scalars().all()

    return [
        {
            "id": r.id,
            "old_inn": r.old_inn,
            "old_name": r.old_name,
            "new_inn": r.new_inn,
            "new_name": r.new_name,
            "changed_by": r.changed_by,
            "reason": r.reason,
            "changed_at": r.changed_at.isoformat() if r.changed_at else None,
        }
        for r in rows
    ]


@router.get("/history-by-id", response_model=list[dict])
async def get_shop_history_by_id(
    shop_id: str = Query(...),
    _user: CurrentUser = Depends(),
    market: CurrentMarket = Depends(),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """Do'kon tarixi — query param orqali (maxsus belgilar uchun)."""
    return await get_shop_history(shop_id, _user, market, db)


@router.get("/{shop_id}", response_model=ShopDetailOut)
async def get_shop(
    shop_id: str,
    _user: CurrentUser,
    market: CurrentMarket,
    db: Annotated[AsyncSession, Depends(get_db)],
    year: int | None = Query(None),
    month: int | None = Query(None, ge=1, le=12),
) -> ShopDetailOut:
    """Magazin detali — kontragent + joriy oy billing."""
    return await _build_shop_detail(shop_id, market, db, year, month)
