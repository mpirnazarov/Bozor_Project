"""Xojatxonalar — kunlik tushum boshqaruvi."""
from datetime import date as _date
from decimal import Decimal
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func as sqlfunc, extract
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.deps import CurrentUser, CurrentMarket
from app.models.toilet import Toilet, ToiletRevenue

router = APIRouter()


class ToiletOut(BaseModel):
    id: int
    name: str
    is_active: bool
    notes: str | None = None


class ToiletRevenueOut(BaseModel):
    id: int
    toilet_id: int
    revenue_date: str
    amount: float
    notes: str | None = None


class ToiletMonthSummary(BaseModel):
    toilet: ToiletOut
    year: int
    month: int
    total: float
    revenues: list[ToiletRevenueOut]


class ToiletRevenueUpsertIn(BaseModel):
    revenue_date: str  # YYYY-MM-DD
    amount: float
    notes: str | None = None


@router.get("", response_model=list[ToiletOut])
async def list_toilets(
    _user: CurrentUser,
    market: CurrentMarket,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[ToiletOut]:
    rows = (await db.execute(
        select(Toilet)
        .where(Toilet.market_id == market.id, Toilet.is_active.is_(True))
        .order_by(Toilet.id)
    )).scalars().all()
    return [ToiletOut(id=t.id, name=t.name, is_active=t.is_active, notes=t.notes) for t in rows]


@router.get("/{toilet_id}/month", response_model=ToiletMonthSummary)
async def get_toilet_month(
    toilet_id: int,
    year: int,
    month: int,
    _user: CurrentUser,
    market: CurrentMarket,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ToiletMonthSummary:
    toilet = await db.scalar(
        select(Toilet).where(Toilet.id == toilet_id, Toilet.market_id == market.id)
    )
    if not toilet:
        raise HTTPException(404, "Topilmadi")

    revenues = (await db.execute(
        select(ToiletRevenue)
        .where(
            ToiletRevenue.toilet_id == toilet_id,
            extract("year", ToiletRevenue.revenue_date) == year,
            extract("month", ToiletRevenue.revenue_date) == month,
        )
        .order_by(ToiletRevenue.revenue_date)
    )).scalars().all()

    total = sum(float(r.amount) for r in revenues)

    return ToiletMonthSummary(
        toilet=ToiletOut(id=toilet.id, name=toilet.name, is_active=toilet.is_active, notes=toilet.notes),
        year=year, month=month, total=total,
        revenues=[ToiletRevenueOut(
            id=r.id, toilet_id=r.toilet_id,
            revenue_date=r.revenue_date.isoformat(),
            amount=float(r.amount), notes=r.notes,
        ) for r in revenues],
    )


@router.put("/{toilet_id}/revenue", response_model=ToiletRevenueOut)
async def upsert_toilet_revenue(
    toilet_id: int,
    body: ToiletRevenueUpsertIn,
    _user: CurrentUser,
    market: CurrentMarket,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ToiletRevenueOut:
    toilet = await db.scalar(
        select(Toilet).where(Toilet.id == toilet_id, Toilet.market_id == market.id)
    )
    if not toilet:
        raise HTTPException(404, "Topilmadi")

    rev_date = _date.fromisoformat(body.revenue_date)
    existing = await db.scalar(
        select(ToiletRevenue).where(
            ToiletRevenue.toilet_id == toilet_id,
            ToiletRevenue.revenue_date == rev_date,
        )
    )
    if existing:
        existing.amount = Decimal(str(body.amount))
        existing.notes = body.notes
    else:
        existing = ToiletRevenue(
            toilet_id=toilet_id, revenue_date=rev_date,
            amount=Decimal(str(body.amount)), notes=body.notes,
        )
        db.add(existing)
    await db.commit()
    await db.refresh(existing)
    return ToiletRevenueOut(
        id=existing.id, toilet_id=existing.toilet_id,
        revenue_date=existing.revenue_date.isoformat(),
        amount=float(existing.amount), notes=existing.notes,
    )


@router.delete("/{toilet_id}/revenue/{revenue_id}")
async def delete_toilet_revenue(
    toilet_id: int, revenue_id: int,
    _user: CurrentUser, market: CurrentMarket,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    r = await db.scalar(
        select(ToiletRevenue).where(
            ToiletRevenue.id == revenue_id,
            ToiletRevenue.toilet_id == toilet_id,
        )
    )
    if not r:
        raise HTTPException(404, "Topilmadi")
    await db.delete(r)
    await db.commit()
    return {"ok": True}
