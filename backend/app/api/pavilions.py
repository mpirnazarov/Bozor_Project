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


@router.get("/debug-list")
async def pavilions_debug_list(
    db: Annotated[AsyncSession, Depends(get_db)],
    key: str = Query(""),
) -> list[dict]:
    """DIAGNOSTIKA: barcha pavilionlar ro'yxati (id + nom). ?key=orik-debug-2026"""
    if key != "orik-debug-2026":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "key noto'g'ri")
    rows = (await db.execute(select(Pavilion).order_by(Pavilion.display_order))).scalars()
    out = []
    for p in rows:
        prefix = p.meta.get("shop_prefix") if isinstance(p.meta, dict) else None
        out.append({"id": p.id, "name": p.display_name, "market_id": p.market_id, "shop_prefix": prefix})
    return out


@router.get("/{pavilion_id}/debt-debug")
async def pavilion_debt_debug(
    pavilion_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    key: str = Query("", description="Diagnostika kaliti"),
    year: int | None = Query(None),
    month: int | None = Query(None, ge=1, le=12),
) -> dict:
    """DIAGNOSTIKA: pavilion qarzdorligini bosqichma-bosqich ko'rsatadi.

    Brauzerda to'g'ridan-to'g'ri ochish uchun ?key=orik-debug-2026 bilan ishlaydi.
    Programma va skript farqini topish uchun.
    """
    if key != "orik-debug-2026":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "key noto'g'ri (?key=orik-debug-2026)")
    from decimal import Decimal
    from app.models import MonthlyBalance, Shop
    today = date.today()
    year = year or today.year
    month = month or today.month
    pav = await db.get(Pavilion, pavilion_id)
    if pav is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Pavilion topilmadi")

    prefix = None
    if isinstance(pav.meta, dict):
        prefix = (pav.meta.get("shop_prefix") or "").strip() or None
    if prefix:
        shops = list((await db.execute(
            select(Shop).where(
                Shop.market_id == pav.market_id,
                Shop.shop_id.like(f"{prefix}-%"),
                Shop.is_active.is_(True),
            ).order_by(Shop.shop_id)
        )).scalars())
    else:
        shops = list((await db.execute(
            select(Shop).where(Shop.pavilion_id == pavilion_id, Shop.is_active.is_(True))
        )).scalars())

    shop_ids = [s.shop_id for s in shops]
    inns = list({s.inn for s in shops if s.inn})

    # INN qarzi (Дебет)
    inn_debt: dict[str, Decimal] = {}
    if inns:
        drows = (await db.execute(
            select(MonthlyBalance.inn, func.coalesce(func.sum(MonthlyBalance.due_amount), 0))
            .where(MonthlyBalance.inn.in_(inns), MonthlyBalance.year == year,
                   MonthlyBalance.month == month, MonthlyBalance.due_amount > 0)
            .group_by(MonthlyBalance.inn)
        )).all()
        inn_debt = {inn: Decimal(str(d)) for inn, d in drows}

    # market_ids — compute_batch_status'dagi aynan o'sha mantiq
    market_ids = list({
        mid for (mid,) in (await db.execute(
            select(Shop.market_id).where(Shop.shop_id.in_(shop_ids)).distinct()
        )).all() if mid is not None
    })
    cnt_q = (
        select(Shop.inn, func.count(Shop.shop_id))
        .where(Shop.inn.in_(inns), Shop.is_active.is_(True))
        .group_by(Shop.inn)
    )
    cnt_all = {inn: int(c) for inn, c in (await db.execute(cnt_q)).all()}
    cnt_market = {}
    if market_ids:
        cnt_market = {inn: int(c) for inn, c in (await db.execute(
            cnt_q.where(Shop.market_id.in_(market_ids))
        )).all()}

    rows = []
    total_share_market = Decimal(0)
    total_share_all = Decimal(0)
    for s in shops:
        debt = inn_debt.get(s.inn, Decimal(0)) if s.inn else Decimal(0)
        n_m = max(cnt_market.get(s.inn, 1), 1) if s.inn else 1
        n_a = max(cnt_all.get(s.inn, 1), 1) if s.inn else 1
        sh_m = debt / n_m
        sh_a = debt / n_a
        total_share_market += sh_m
        total_share_all += sh_a
        rows.append({
            "shop_id": s.shop_id, "inn": s.inn, "market_id": s.market_id,
            "monthly_rent": float(s.monthly_rent or 0),
            "inn_debt": float(debt),
            "cnt_market": cnt_market.get(s.inn), "cnt_all_markets": cnt_all.get(s.inn),
            "share_market": float(sh_m), "share_all": float(sh_a),
        })

    # MUHIM: /shops endpoint AYNAN shu funksiyani chaqiradi. Solishtiramiz.
    from app.services.billing_service import compute_batch_status
    live = await compute_batch_status(db, shop_ids, year, month)
    live_total_debt = float(sum((b.total_debt for b in live.values()), Decimal(0)))
    live_total_due = float(sum((b.total_due for b in live.values()), Decimal(0)))
    live_total_paid = float(sum((b.total_paid for b in live.values()), Decimal(0)))

    return {
        "pavilion": pav.display_name, "market_id": pav.market_id,
        "market_ids_from_shops": market_ids,
        "year": year, "month": month, "shop_count": len(shops),
        "TOTAL_share_market_filter": float(total_share_market),
        "TOTAL_share_all_markets": float(total_share_all),
        "LIVE_compute_batch_debt": live_total_debt,
        "LIVE_compute_batch_due": live_total_due,
        "LIVE_compute_batch_paid": live_total_paid,
        "shops": rows,
    }


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
