"""Umumiy sozlamalar endpointi (mavzu va h.k.).

GET /api/settings/theme — joriy mavzu (auth shart emas, login sahifa ham o'qiydi).
"""
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import CurrentMarket
from app.models.settings import HIDE_UNMATCHED_KEY, THEME_SETTINGS_KEY, Setting
from app.services.support_service import get_support_status

router = APIRouter()


@router.get("/support-status")
async def support_status(
    market: CurrentMarket,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Joriy bozorning tex-podderjka holati (banner uchun)."""
    return await get_support_status(db, market)


@router.get("/my-support-payments")
async def my_support_payments(
    market: CurrentMarket,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[dict]:
    """Joriy bozorning to'lov tarixi (bozor admini ko'radi)."""
    from app.services.support_service import list_payments

    payments = await list_payments(db, market.id)
    return [
        {
            "year": p.year, "month": p.month, "amount": float(p.amount),
            "is_paid": p.is_paid, "paid_at": p.paid_at.isoformat() if p.paid_at else None,
        }
        for p in payments
    ]


@router.get("/theme")
async def get_theme(db: Annotated[AsyncSession, Depends(get_db)]) -> dict:
    """Joriy ilova mavzusi (light/dark). Default: light."""
    s = await db.get(Setting, THEME_SETTINGS_KEY)
    theme = "light"
    if s and isinstance(s.value, dict):
        theme = s.value.get("theme", "light")
    elif s and isinstance(s.value, str):
        theme = s.value
    return {"theme": theme if theme in ("light", "dark") else "light"}


@router.get("/hide-unmatched")
async def get_hide_unmatched(db: Annotated[AsyncSession, Depends(get_db)]) -> dict:
    """Topilmagan magazinlar berkitilganmi (default: false)."""
    s = await db.get(Setting, HIDE_UNMATCHED_KEY)
    hidden = bool(s.value.get("hidden")) if s and isinstance(s.value, dict) else False
    return {"hidden": hidden}
