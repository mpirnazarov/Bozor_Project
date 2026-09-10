"""INN endpoint — /api/inn (qidirish va detal)."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.database import get_db
from app.deps import CurrentUser
from app.models import Counterparty, Shop
from app.schemas.billing import (
    CounterpartyOut,
    InnDetailOut,
    InnSearchResult,
    ShopOut,
)

router = APIRouter()


@router.get("/search", response_model=list[InnSearchResult])
async def search_inn(
    _user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    q: str = Query(..., min_length=1, description="INN, nom yoki magazin ID"),
    limit: int = Query(20, ge=1, le=100),
) -> list[InnSearchResult]:
    """INN, kontragent nomi YOKI magazin ID bo'yicha qidirish (fuzzy ILIKE).

    Magazin ID bo'yicha qidiruv EXISTS orqali qilinadi — outerjoin'ga shart
    qo'yilsa `shop_count` faqat mos kelgan magazinlarni sanab qolardi.
    """
    pattern = f"%{q.strip()}%"
    # ALIAS majburiy: Shop tashqi so'rovda outerjoin bilan allaqachon bor.
    # Aliassiz SQLAlchemy subquery'dagi shops'ni ham korrelatsiya qilib,
    # uni FROM'siz qoldiradi va so'rov 500 bilan yiqiladi.
    shop_alias = aliased(Shop)
    shop_match = (
        select(shop_alias.id)
        .where(shop_alias.inn == Counterparty.inn, shop_alias.shop_id.ilike(pattern))
        .correlate(Counterparty)
        .exists()
    )
    stmt = (
        select(
            Counterparty.inn,
            Counterparty.name,
            func.count(Shop.id).label("shop_count"),
        )
        .outerjoin(Shop, Shop.inn == Counterparty.inn)
        .where(
            or_(
                Counterparty.inn.ilike(pattern),
                Counterparty.name.ilike(pattern),
                shop_match,
            )
        )
        .group_by(Counterparty.inn, Counterparty.name)
        .order_by(Counterparty.name)
        .limit(limit)
    )
    result = await db.execute(stmt)
    return [
        InnSearchResult(inn=inn, name=name, shop_count=cnt)
        for inn, name, cnt in result.all()
    ]


@router.get("/debug/inn-debt")
async def debug_inn_debt(
    db: Annotated[AsyncSession, Depends(get_db)],
    inn: str = Query(...),
    key: str = Query(""),
) -> dict:
    """DIAGNOSTIKA: INN ning har oy/kategoriya qarzi. ?inn=...&key=orik-debug-2026"""
    from app.models import MonthlyBalance
    if key != "orik-debug-2026":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "key noto'g'ri")
    rows = list((await db.execute(
        select(MonthlyBalance).where(MonthlyBalance.inn == inn)
        .order_by(MonthlyBalance.year, MonthlyBalance.month, MonthlyBalance.category)
    )).scalars())
    out = []
    for b in rows:
        out.append({
            "year": b.year, "month": b.month, "category": b.category,
            "due_amount": float(b.due_amount or 0), "paid_amount": float(b.paid_amount or 0),
        })
    return {"inn": inn, "rows": len(out), "balances": out}


@router.get("/{inn}", response_model=InnDetailOut)
async def get_inn(
    inn: str,
    _user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    year: int | None = Query(None),
    month: int | None = Query(None, ge=1, le=12),
) -> InnDetailOut:
    """INN bo'yicha kontragent + magazinlari + tanlangan oy billing holati.

    Davr berilmasa — joriy oy. Billing xarita modallari bilan bir xil
    manbadan (compute_batch_status) olinadi, shuning uchun bir magazin
    turli ekranlarda bir xil raqamni ko'rsatadi.
    """
    from datetime import date as _date
    from app.services.billing_service import compute_batch_status

    cp = await db.get(Counterparty, inn)
    if cp is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Kontragent topilmadi")

    today = _date.today()
    year = year or today.year
    month = month or today.month

    result = await db.execute(
        select(Shop).where(Shop.inn == inn).order_by(Shop.shop_id)
    )
    shops = [ShopOut.model_validate(s) for s in result.scalars()]
    billing = await compute_batch_status(db, [s.shop_id for s in shops], year, month)

    return InnDetailOut(
        counterparty=CounterpartyOut(
            inn=cp.inn,
            name=cp.name,
            contract_no=cp.contract_no,
            contract_date=cp.contract_date.isoformat() if cp.contract_date else None,
            phone=cp.phone,
        ),
        shops=shops,
        year=year,
        month=month,
        billing=billing,
    )
