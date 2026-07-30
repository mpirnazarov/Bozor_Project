"""Pavilions endpoint — /api/pavilions."""
from typing import Annotated
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import CurrentMarket, CurrentUser
from app.models import Pavilion, Shop
from app.schemas.billing import ShopOut
from app.schemas.pavilion import PavilionDetailOut, PavilionOut
from app.services.billing_service import compute_batch_status

router = APIRouter()


def _single_prefix_filter(prefix: str):
    """Bitta prefiks uchun shart (Q li / Q siz ajratish bilan)."""
    p = prefix.strip().rstrip("-")
    if not p:
        return None
    # Oxiri Q/q bilan tugasa -> Q li turkum
    if p[-1:].upper() == "Q":
        base = p[:-1].rstrip("-")  # masalan "01-3-1"
        return Shop.shop_id.like(f"{base}-Q%")
    # Q siz: prefiks ostidagilar, lekin Q lilar bundan mustasno
    return and_(
        Shop.shop_id.like(f"{p}-%"),
        ~Shop.shop_id.like(f"{p}-Q%"),
    )


def _prefix_shop_filter(prefix: str):
    """Prefiks bo'yicha magazin tanlash sharti.

    Bir nechta prefiks slash (/) yoki vergul (,) bilan berilishi mumkin —
    masalan "05-5-2/05-6-2" yoki "05-5-2, 05-6-2". Bunda har bir prefiksga
    mos magazinlar (OR bilan) tanlanadi. Bu bitta blokga bir nechta region
    magazinlarini biriktirish imkonini beradi.

    - Prefiks "Q" bilan tugasa (masalan "01-3-1-Q") -> FAQAT Q li magazinlar.
    - Aks holda (masalan "01-3-1") -> FAQAT Q SIZ magazinlar.
    """
    # Slash yoki vergul bilan ajratamiz
    parts = [x for chunk in prefix.split("/") for x in chunk.split(",")]
    conds = [c for c in (_single_prefix_filter(p) for p in parts) if c is not None]
    if not conds:
        # Bo'sh — hech narsa topmaydigan shart
        return Shop.shop_id.like("\x00")
    if len(conds) == 1:
        return conds[0]
    return or_(*conds)


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
    if _user.role == "manager":
        from app.models import ManagerPavilion
        assigned = (await db.execute(
            select(ManagerPavilion.pavilion_id).where(ManagerPavilion.manager_id == _user.id)
        )).scalars().all()
        stmt = stmt.where(Pavilion.id.in_(assigned))
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
                _prefix_shop_filter(prefix),
            )
        )
    else:
        count = await db.scalar(
            select(func.count()).select_from(Shop).where(Shop.pavilion_id == pavilion_id)
        )
    detail = PavilionDetailOut.model_validate(pav)
    detail.shop_count = count or 0
    return detail



@router.get("/debug/rent-by-prefix")
async def debug_rent_by_prefix(
    db: Annotated[AsyncSession, Depends(get_db)],
    prefix: str = Query(..., description="Masalan: 01-4-1"),
    key: str = Query(""),
) -> dict:
    """DIAGNOSTIKA: prefiks bo'yicha magazinlar + monthly_rent yig'indisi.

    Google Sheets bilan solishtirish uchun. ?prefix=01-4-1&key=orik-debug-2026
    """
    from decimal import Decimal
    from app.models import Shop
    if key != "orik-debug-2026":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "key noto'g'ri")

    # Barcha (active va inactive) — solishtirish uchun
    all_rows = list((await db.execute(
        select(Shop).where(Shop.shop_id.like(f"{prefix}-%")).order_by(Shop.shop_id)
    )).scalars())

    active = [s for s in all_rows if s.is_active]
    inactive = [s for s in all_rows if not s.is_active]
    null_rent = [s for s in all_rows if not s.monthly_rent or float(s.monthly_rent) == 0]

    total_all = float(sum((Decimal(str(s.monthly_rent or 0)) for s in all_rows), Decimal(0)))
    total_active = float(sum((Decimal(str(s.monthly_rent or 0)) for s in active), Decimal(0)))

    return {
        "prefix": prefix,
        "count_all": len(all_rows),
        "count_active": len(active),
        "count_inactive": len(inactive),
        "count_zero_rent": len(null_rent),
        "TOTAL_rent_all": total_all,
        "TOTAL_rent_active_only": total_active,
        "inactive_shops": [{"shop_id": s.shop_id, "rent": float(s.monthly_rent or 0)} for s in inactive],
        "zero_rent_shops": [s.shop_id for s in null_rent],
        "all_shops": [
            {"shop_id": s.shop_id, "rent": float(s.monthly_rent or 0), "active": s.is_active, "inn": s.inn}
            for s in all_rows
        ],
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
                _prefix_shop_filter(prefix),
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



async def _sync_infra_shop(db, pavilion_id: int, market_id: int, name: str, pavilion_type: str | None, meta: dict | None = None) -> None:
    """Infra pavilion saqlanganda InfraShop avtomatik yaratadi/yangilaydi."""
    from app.models.infra_shop import InfraShop as InfraShopModel
    from sqlalchemy import select as _sel
    from decimal import Decimal

    if pavilion_type != "infra":
        return

    meta = meta or {}
    water_enabled = meta.get("water_enabled", True)

    existing = await db.scalar(
        _sel(InfraShopModel).where(
            InfraShopModel.market_id == market_id,
            InfraShopModel.name == name,
        )
    )
    if existing is None:
        shop = InfraShopModel(
            market_id=market_id, name=name,
            monthly_rent=Decimal("0"),
            water_enabled=water_enabled,
        )
        db.add(shop)
    else:
        existing.is_active = True
        existing.water_enabled = water_enabled
