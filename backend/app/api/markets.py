"""Markets endpoint — /api/markets.

- GET /api/markets         — barcha bozorlar ro'yxati (super dashboard uchun)
- GET /api/markets/{slug}  — bitta bozor ma'lumoti
- GET /api/markets/super/dashboard — barcha bozorlar yig'masi (super dashboard)
"""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import CurrentUser, SuperAdminUser
from app.models.market import Market
from app.schemas.market import MarketOut, SuperDashboardOut

router = APIRouter()


@router.get("", response_model=list[MarketOut])
async def list_markets(
    _user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[Market]:
    """Barcha faol bozorlar (tanlash uchun)."""
    result = await db.execute(
        select(Market).where(Market.is_active.is_(True)).order_by(Market.display_order)
    )
    return list(result.scalars())


@router.get("/super/dashboard", response_model=SuperDashboardOut)
async def super_dashboard(
    _admin: SuperAdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SuperDashboardOut:
    """Barcha bozorlar yig'ma dashboardi (super dashboard).

    Har bozorning dashboard_stats'ini yig'ib, umumiy va bozor-bo'yicha
    ko'rsatkichlarni qaytaradi.
    """
    result = await db.execute(
        select(Market).where(Market.is_active.is_(True)).order_by(Market.display_order)
    )
    markets = list(result.scalars())

    per_market = []
    total = 0.0
    total_paid = 0.0
    for m in markets:
        stats = m.dashboard_stats or {}
        t = float(stats.get("total", 0) or 0)
        p = float(stats.get("paid", 0) or 0)
        total += t
        total_paid += p
        per_market.append(
            {
                "id": m.id,
                "slug": m.slug,
                "name": m.name,
                "total": t,
                "paid": p,
                "debt": t - p,
            }
        )

    return SuperDashboardOut(
        total=total,
        paid=total_paid,
        debt=total - total_paid,
        markets=per_market,
    )


@router.get("/{slug}", response_model=MarketOut)
async def get_market(
    slug: str,
    _user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Market:
    """Bitta bozor ma'lumoti (slug bo'yicha)."""
    result = await db.execute(select(Market).where(Market.slug == slug))
    m = result.scalar_one_or_none()
    if m is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bozor topilmadi")
    return m
