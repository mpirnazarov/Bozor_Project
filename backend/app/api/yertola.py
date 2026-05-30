"""Yerto'la endpointlari — /api/yertola (Google Sheets + DB)."""
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import AdminUser, CurrentUser
from app.models import Shop
from app.services.sheets_service import cache_info, fetch_sheets_rows

router = APIRouter()


@router.get("")
async def yertola_overview(
    _user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Yerto'la pavilion guruhlari (DB'dagi pavilion_code bo'yicha)."""
    result = await db.execute(
        select(Shop.pavilion_code).where(Shop.pavilion_code.ilike("%Yerto%"))
    )
    codes: dict[str, int] = {}
    for (code,) in result.all():
        if code:
            codes[code] = codes.get(code, 0) + 1

    return {
        "pavilions": [
            {"pavilion_code": k, "shop_count": v}
            for k, v in sorted(codes.items())
        ],
        "total_shops": sum(codes.values()),
        "sheets_cache": cache_info(),
    }


@router.get("/{pavilion_code}")
async def yertola_pavilion(
    pavilion_code: str,
    _user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Yerto'la pavilion magazinlari — DB + Sheets birlashtirilgan."""
    result = await db.execute(
        select(Shop).where(Shop.pavilion_code == pavilion_code).order_by(Shop.shop_id)
    )
    db_shops = list(result.scalars())

    # Sheets ma'lumotlari (shop_id yoki inn bo'yicha moslashtirish)
    sheets_rows = await fetch_sheets_rows()
    sheets_by_key: dict[str, dict] = {}
    for r in sheets_rows:
        key = str(r.get("shop_id") or r.get("inn") or "").strip()
        if key:
            sheets_by_key[key] = r

    shops_out = []
    for s in db_shops:
        extra = sheets_by_key.get(s.shop_id) or (sheets_by_key.get(s.inn) if s.inn else None)
        shops_out.append(
            {
                "shop_id": s.shop_id,
                "inn": s.inn,
                "shop_type": s.shop_type,
                "monthly_rent": str(s.monthly_rent),
                "sheets_data": extra,
            }
        )

    return {
        "pavilion_code": pavilion_code,
        "shop_count": len(shops_out),
        "shops": shops_out,
    }


@router.post("/refresh")
async def yertola_refresh(_admin: AdminUser) -> dict:
    """Sheets cache'ni majburiy yangilash (admin)."""
    rows = await fetch_sheets_rows(force=True)
    return {"ok": True, "rows": len(rows), "cache": cache_info()}
