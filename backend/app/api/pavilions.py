"""Pavilions endpoint — /api/pavilions."""
from typing import Annotated
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import CurrentMarket, CurrentUser
from app.models import Pavilion, Shop
from app.schemas.billing import ShopOut
from app.schemas.pavilion import PavilionDetailOut, PavilionOut
from app.services.billing_service import compute_batch_status

router = APIRouter()


@router.get("", response_model=list[PavilionOut])
async def list_pavilions(
    _user: CurrentUser,
    market: CurrentMarket,
    db: Annotated[AsyncSession, Depends(get_db)],
    include_inactive: bool = Query(False),
    map_layer_id: int | None = Query(None, description="Faqat shu xaritaning regionlari"),
) -> list[Pavilion]:
    """Tanlangan bozorning pavilionlari (xarita uchun).

    map_layer_id berilsa — faqat o'sha xaritaning regionlari.
    Berilmasa — barcha (orqaga moslik; eski xaritasiz regionlar ham).
    """
    stmt = (
        select(Pavilion)
        .where(Pavilion.market_id == market.id)
        .order_by(Pavilion.display_order)
    )
    if map_layer_id is not None:
        stmt = stmt.where(Pavilion.map_layer_id == map_layer_id)
    if not include_inactive:
        stmt = stmt.where(Pavilion.is_active.is_(True))
    result = await db.execute(stmt)
    return list(result.scalars())


@router.get("/{pavilion_id}", response_model=PavilionDetailOut)
async def get_pavilion(
    pavilion_id: int,
    _user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PavilionDetailOut:
    """Bitta pavilion + magazinlar soni."""
    pav = await db.get(Pavilion, pavilion_id)
    if pav is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Pavilion topilmadi")

    prefix = None
    if isinstance(pav.meta, dict):
        prefix = (pav.meta.get("shop_prefix") or "").strip() or None

    if prefix:
        count = await db.scalar(
            select(func.count()).select_from(Shop).where(
                Shop.market_id == pav.market_id,
                Shop.shop_id.like(f"{prefix}-%"),
            )
        )
    else:
        count = await db.scalar(
            select(func.count()).select_from(Shop).where(Shop.pavilion_id == pavilion_id)
        )
    detail = PavilionDetailOut.model_validate(pav)
    detail.shop_count = count or 0
    return detail



@router.get("/{pavilion_id}/shops")
async def get_pavilion_shops(
    pavilion_id: int,
    _user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    year: int | None = Query(None),
    month: int | None = Query(None, ge=1, le=12),
) -> dict:
    """Pavilion magazinlari + billing statusi (xarita tile ranglari uchun)."""
    # Davr berilmasa — joriy oy (yangi oyga o'tilganda avtomatik ishlaydi)
    today = date.today()
    year = year or today.year
    month = month or today.month
    pav = await db.get(Pavilion, pavilion_id)
    if pav is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Pavilion topilmadi")

    # Magazinlarni tanlash: agar region meta.shop_prefix bo'lsa, shop_id
    # prefiks bo'yicha (masalan "04-1-1" -> "04-1-1-001", "04-1-1-002" ...).
    # Aks holda eski usul — pavilion_id (FK) bo'yicha.
    prefix = None
    if isinstance(pav.meta, dict):
        prefix = (pav.meta.get("shop_prefix") or "").strip() or None

    if prefix:
        result = await db.execute(
            select(Shop)
            .where(
                Shop.market_id == pav.market_id,
                Shop.shop_id.like(f"{prefix}-%"),
                Shop.is_active.is_(True),
            )
            .order_by(Shop.shop_id)
        )
    else:
        result = await db.execute(
            select(Shop).where(Shop.pavilion_id == pavilion_id, Shop.is_active.is_(True))
        )
    shops = list(result.scalars())
    shop_ids = [s.shop_id for s in shops]
    billing = await compute_batch_status(db, shop_ids, year, month)

    return {
        "pavilion_id": pavilion_id,
        "year": year,
        "month": month,
        "shops": [ShopOut.model_validate(s) for s in shops],
        "billing": billing,
    }
