"""Dashboard endpoint — /api/dashboard."""
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import CurrentUser
from app.schemas.dashboard import DashboardOut
from app.services.dashboard_service import (
    get_dashboard_from_settings,
    get_dashboard_live,
)

router = APIRouter()


@router.get("", response_model=DashboardOut)
async def get_dashboard(
    _user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    live: bool = Query(False, description="True bo'lsa monthly_balances'dan hisoblaydi"),
    year: int = Query(2026),
    month: int = Query(5, ge=1, le=12),
) -> DashboardOut:
    """
    Dashboard summalari.

    - default: settings.dashboard_stats'dan (admin tahrirlagan qiymatlar)
    - ?live=true: monthly_balances'dan jonli hisoblanadi
    """
    if live:
        return await get_dashboard_live(db, year, month)
    return await get_dashboard_from_settings(db)
