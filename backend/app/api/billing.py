"""Billing endpoint — /api/billing."""
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import CurrentMarket, CurrentUser
from app.schemas.billing import BatchBillingRequest, BatchBillingResponse
from app.services.billing_service import compute_batch_status

router = APIRouter()


@router.post("/batch", response_model=BatchBillingResponse)
async def billing_batch(
    payload: BatchBillingRequest,
    _user: CurrentUser,
    market: CurrentMarket,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> BatchBillingResponse:
    """Bir nechta magazin uchun billing statusini bir so'rovda hisoblaydi — faqat shu bozor."""
    results = await compute_batch_status(
        db, payload.shop_ids, payload.year, payload.month,
        market_ids=[market.id],
    )
    return BatchBillingResponse(
        year=payload.year, month=payload.month, results=results
    )
