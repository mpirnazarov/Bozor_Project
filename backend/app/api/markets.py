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
from app.services.audit_service import write_audit
from app.services.support_service import get_support_status
from app.services.railway_service import get_railway_overview

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
    attention_count = 0
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

        # Bozorning O'rikzorga to'lovi (support) holati
        if is_demo:
            support = {"attention": "free", "paid_this_month": False,
                       "free_period": True, "monthly_fee": 0, "due_day": 6}
        else:
            support = await get_support_status(db, m)
        if support["attention"] in ("yellow", "red", "blocked"):
            attention_count += 1

        per_market.append(
            {
                "id": m.id,
                "slug": m.slug,
                "name": m.name,
                "total": t,
                "paid": p,
                "debt": t - p,
                "is_demo": is_demo,
                "attention": support["attention"],
                "support_paid": bool(support.get("paid_this_month")),
                "free_period": bool(support.get("free_period")),
                "monthly_fee": float(support.get("monthly_fee", 0) or 0),
                "due_day": int(support.get("due_day", 6)),
            }
        )

    return SuperDashboardOut(
        total=total,
        paid=total_paid,
        debt=total - total_paid,
        markets=per_market,
        attention_count=attention_count,
    )


@router.get("/super/railway")
async def super_railway(
    _admin: SuperAdminUser,
) -> dict:
    """Railway holati (CPU/RAM + deployment ro'yxati) — super dashboard uchun.

    Token sozlanmagan bo'lsa {configured: false} qaytaradi.
    """
    return await get_railway_overview()


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
    await write_audit(db, _admin.id, "update_market", "market", market.slug, data)
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
    await write_audit(db, _admin.id, "toggle_market", "market", market.slug, {"is_active": market.is_active})
    await db.commit()
    await db.refresh(market)
    return market
