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
from app.schemas.market import MarketOut, MarketUpdate, SuperDashboardOut

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

    # Orikzor (real bozor) summalarini settings.dashboard_stats'dan olamiz —
    # bu admin tahrirlagan, asosiy dashboard ko'rsatadigan real qiymatlar.
    from app.models.settings import DASHBOARD_SETTINGS_KEY, Setting

    real_setting = await db.get(Setting, DASHBOARD_SETTINGS_KEY)
    real_stats = (
        real_setting.value if real_setting and isinstance(real_setting.value, dict) else {}
    )

    per_market = []
    total = 0.0
    total_paid = 0.0
    for m in markets:
        stats = m.dashboard_stats or {}
        is_demo = bool(stats.get("is_demo"))
        # Demo bo'lmagan real bozor (Orikzor) — settings'dan, aks holda market stats
        if not is_demo and m.slug == "orikzor":
            t = float(real_stats.get("total", stats.get("total", 0)) or 0)
            p = float(real_stats.get("paid", stats.get("paid", 0)) or 0)
        else:
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
                "is_demo": is_demo,
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


@router.put("/{market_id:int}", response_model=MarketOut)
async def update_market(
    market_id: int,
    payload: MarketUpdate,
    _admin: SuperAdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Market:
    """Bozor ma'lumotini tahrirlash (faqat super admin)."""
    market = await db.get(Market, market_id)
    if market is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bozor topilmadi")
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(market, field, value)
    await db.commit()
    await db.refresh(market)
    return market


@router.post("/{market_id:int}/toggle", response_model=MarketOut)
async def toggle_market(
    market_id: int,
    _admin: SuperAdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Market:
    """Bozorni vaqtincha o'chirish / yoqish (is_active)."""
    market = await db.get(Market, market_id)
    if market is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bozor topilmadi")
    market.is_active = not market.is_active
    await db.commit()
    await db.refresh(market)
    return market
