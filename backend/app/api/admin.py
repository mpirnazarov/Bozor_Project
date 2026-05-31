"""Admin endpointlari — /api/admin/* (hammasi require_admin)."""
from typing import Annotated

import httpx
from pydantic import BaseModel

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import AdminUser, CurrentMarket
from app.models import (
    DASHBOARD_SETTINGS_KEY,
    THEME_SETTINGS_KEY,
    HIDE_UNMATCHED_KEY,
    AuditLog,
    Pavilion,
    Setting,
    Shop,
)
from app.schemas.admin import (
    AuditLogOut,
    DashboardUpdate,
    ImportResult,
    PavilionCreate,
    PavilionUpdate,
    ShopUpdate,
)
from app.schemas.dashboard import DashboardOut
from app.schemas.pavilion import PavilionOut
from app.services.audit_service import write_audit
from app.services.dashboard_service import get_dashboard_from_settings
from app.services.import_service import import_balances_xlsx
from app.services.shop_import_service import import_shops_csv

router = APIRouter()


class _HideBody(BaseModel):
    hidden: bool


@router.put("/hide-unmatched")
async def update_hide_unmatched(
    body: _HideBody,
    admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Topilmagan magazinlarni berkitish/ko'rsatish (DB'da saqlanadi)."""
    setting = await db.get(Setting, HIDE_UNMATCHED_KEY)
    if setting is None:
        setting = Setting(key=HIDE_UNMATCHED_KEY, value={"hidden": body.hidden}, updated_by=admin.id)
        db.add(setting)
    else:
        setting.value = {"hidden": body.hidden}
        setting.updated_by = admin.id
    await write_audit(db, admin.id, "update_hide_unmatched", "settings", HIDE_UNMATCHED_KEY, {"hidden": body.hidden})
    await db.commit()
    return {"hidden": body.hidden}


class _ThemeBody(BaseModel):
    theme: str


@router.put("/theme")
async def update_theme(
    body: _ThemeBody,
    admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Ilova mavzusini (light/dark) o'zgartiradi — barcha userlarda ko'rinadi."""
    theme = body.theme if body.theme in ("light", "dark") else "light"
    setting = await db.get(Setting, THEME_SETTINGS_KEY)
    if setting is None:
        setting = Setting(key=THEME_SETTINGS_KEY, value={"theme": theme}, updated_by=admin.id)
        db.add(setting)
    else:
        setting.value = {"theme": theme}
        setting.updated_by = admin.id
    await write_audit(db, admin.id, "update_theme", "settings", THEME_SETTINGS_KEY, {"theme": theme})
    await db.commit()
    return {"theme": theme}


@router.put("/dashboard", response_model=DashboardOut)
async def update_dashboard(
    payload: DashboardUpdate,
    admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> DashboardOut:
    """Dashboard summalarini yangilaydi — barcha userlarda ko'rinadi (DB'da)."""
    value = {
        "total": payload.total,
        "paid": payload.paid,
        "services": payload.services.model_dump(),
        "period": payload.period.model_dump() if payload.period else {"year": 2026, "month": 5},
    }
    setting = await db.get(Setting, DASHBOARD_SETTINGS_KEY)
    if setting is None:
        setting = Setting(key=DASHBOARD_SETTINGS_KEY, value=value, updated_by=admin.id)
        db.add(setting)
    else:
        setting.value = value
        setting.updated_by = admin.id

    await write_audit(
        db, admin.id, "update_dashboard", "settings", DASHBOARD_SETTINGS_KEY, value
    )
    await db.commit()
    return await get_dashboard_from_settings(db)


@router.put("/shops/{shop_id}")
async def update_shop(
    shop_id: str,
    payload: ShopUpdate,
    admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Magazinni tahrirlash (pavilion bog'lash shu yerda — pavilion_id)."""
    result = await db.execute(select(Shop).where(Shop.shop_id == shop_id))
    shop = result.scalar_one_or_none()
    if shop is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Magazin topilmadi")

    changes = payload.model_dump(exclude_unset=True)
    for field, val in changes.items():
        setattr(shop, field, val)

    await write_audit(db, admin.id, "update_shop", "shop", shop_id, changes)
    await db.commit()
    return {"ok": True, "shop_id": shop_id, "updated": list(changes.keys())}


@router.put("/pavilions/{pavilion_id}", response_model=PavilionOut)
async def update_pavilion(
    pavilion_id: int,
    payload: PavilionUpdate,
    admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Pavilion:
    """Pavilion (xarita polygoni, rang, label) tahrirlash."""
    pav = await db.get(Pavilion, pavilion_id)
    if pav is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Pavilion topilmadi")

    changes = payload.model_dump(exclude_unset=True)
    for field, val in changes.items():
        # model atributi 'meta', DB ustuni 'metadata'
        setattr(pav, field, val)

    await write_audit(
        db, admin.id, "update_pavilion", "pavilion", str(pavilion_id), changes
    )
    await db.commit()
    await db.refresh(pav)
    return pav


@router.post("/pavilions", response_model=PavilionOut, status_code=status.HTTP_201_CREATED)
async def create_pavilion(
    payload: PavilionCreate,
    admin: AdminUser,
    market: CurrentMarket,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Pavilion:
    """Yangi pavilion (region) yaratish — admin xarita muharriridan.

    ?market=<slug> bilan qaysi bozorga tegishliligi aniqlanadi (default orikzor).
    """
    # Keyingi bo'sh ID ni topamiz (max + 1, kamida 100 dan boshlanadi
    # yangi qo'lda chizilganlar uchun, seed ID'lar bilan chalkashmasin)
    max_id = await db.scalar(select(func.max(Pavilion.id)))
    new_id = max(int(max_id or 0) + 1, 100)

    data = payload.model_dump()
    meta = data.pop("meta", {})
    pav = Pavilion(id=new_id, market_id=market.id, meta=meta, **data)
    db.add(pav)

    await write_audit(
        db, admin.id, "create_pavilion", "pavilion", str(new_id), data
    )
    await db.commit()
    await db.refresh(pav)
    return pav


@router.delete("/pavilions/{pavilion_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pavilion(
    pavilion_id: int,
    admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Pavilionni o'chirish (faqat qo'lda qo'shilganlar, ID >= 100)."""
    pav = await db.get(Pavilion, pavilion_id)
    if pav is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Pavilion topilmadi")
    await write_audit(
        db, admin.id, "delete_pavilion", "pavilion", str(pavilion_id), None
    )
    await db.delete(pav)
    await db.commit()


@router.post("/import/excel", response_model=ImportResult)
async def import_excel(
    admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    file: UploadFile = File(...),
    year: int = Query(2026),
    month: int = Query(5, ge=1, le=12),
) -> ImportResult:
    """Excel'dan monthly_balances import (admin)."""
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xlsm")):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Faqat .xlsx fayl")
    content = await file.read()
    result = await import_balances_xlsx(db, content, year, month)
    await write_audit(
        db, admin.id, "import_excel", "monthly_balances", file.filename,
        {"rows": result.rows_read, "inserted": result.inserted},
    )
    await db.commit()
    return result


@router.post("/import/shops/csv")
async def import_shops_file(
    admin: AdminUser,
    market: CurrentMarket,
    db: Annotated[AsyncSession, Depends(get_db)],
    file: UploadFile = File(...),
) -> dict:
    """CSV fayl'dan magazinlarni import qiladi (shop_id + INN + nom)."""
    if not file.filename or not file.filename.lower().endswith((".csv", ".tsv", ".txt")):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Faqat .csv fayl")
    content = await file.read()
    result = await import_shops_csv(db, content, market_id=market.id, source=file.filename)
    await write_audit(
        db, admin.id, "import_shops_csv", "shops", file.filename,
        {"rows": result["rows_read"], "inserted": result["inserted"], "updated": result["updated"]},
    )
    await db.commit()
    return result


class _SheetImportBody(BaseModel):
    url: str


@router.post("/import/shops/gsheet")
async def import_shops_gsheet(
    admin: AdminUser,
    market: CurrentMarket,
    body: _SheetImportBody,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Google Sheets (yoki istalgan CSV URL) havolasidan magazinlarni import qiladi.

    Havola CSV ko'rinishida bo'lishi kerak (masalan .../pub?output=csv).
    """
    url = body.url.strip()
    if not url.startswith("http"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "To'g'ri URL kiriting")
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=30) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            content = resp.content
    except Exception as e:  # noqa: BLE001
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, f"Havoladan yuklab bo'lmadi: {e}"
        ) from e

    result = await import_shops_csv(db, content, market_id=market.id, source="gsheet")
    await write_audit(
        db, admin.id, "import_shops_gsheet", "shops", url[:200],
        {"rows": result["rows_read"], "inserted": result["inserted"], "updated": result["updated"]},
    )
    await db.commit()
    return result


@router.get("/audit-log", response_model=list[AuditLogOut])
async def get_audit_log(
    _admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(50, ge=1, le=200),
) -> list[AuditLog]:
    """Oxirgi audit yozuvlari."""
    result = await db.execute(
        select(AuditLog).order_by(desc(AuditLog.created_at)).limit(limit)
    )
    return list(result.scalars())
