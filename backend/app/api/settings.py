"""Umumiy sozlamalar endpointi (mavzu va h.k.).

GET /api/settings/theme — joriy mavzu (auth shart emas, login sahifa ham o'qiydi).
"""
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.settings import HIDE_UNMATCHED_KEY, THEME_SETTINGS_KEY, Setting

router = APIRouter()


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
