"""Admin endpointlari — /api/admin/* (hammasi require_admin)."""
import base64
from datetime import date, datetime, timedelta, timezone
from typing import Annotated

from pydantic import BaseModel

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import AdminUser, CurrentMarket
from app.models import (
    DASHBOARD_SETTINGS_KEY,
    THEME_SETTINGS_KEY,
    HIDE_UNMATCHED_KEY,
    AuditLog,
    MapLayer,
    MonthlyBalance,
    Pavilion,
    Setting,
    Shop,
    User,
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
from app.services.audit_describe import action_label, build_summary, resource_label
from app.services.audit_service import write_audit
from app.services.billing_import_service import import_billing_xlsx
from app.services.rollback_service import (
    REVERT_WINDOW_HOURS,
    revert_snapshot,
    save_snapshot,
)
from app.models.change_snapshot import ChangeSnapshot
from app.models.import_log import ImportLog
from app.utils.safe_fetch import UnsafeUrlError, fetch_url_safely
from app.services.dashboard_service import get_dashboard_from_settings
from app.services.import_service import import_balances_xlsx
from app.services.shop_import_service import import_shops_csv

router = APIRouter()

# Yuklanadigan fayl maksimal hajmi (10 MB)
MAX_UPLOAD_BYTES = 10 * 1024 * 1024


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
    # Infra do'kon sync
    if pav.pavilion_type == "infra":
        from app.api.pavilions import _sync_infra_shop
        await _sync_infra_shop(db, pav.id, pav.market_id, pav.display_name, pav.pavilion_type, pav.meta)
    # Xojatxona sync
    if pav.pavilion_type == "toilet":
        from app.api.pavilions import _sync_toilet
        await _sync_toilet(db, pav.id, pav.market_id, pav.display_name, pav.pavilion_type)
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
    # Infra do'kon sync
    if pav.pavilion_type == "infra":
        from app.api.pavilions import _sync_infra_shop
        await _sync_infra_shop(db, pav.id, pav.market_id, pav.display_name, pav.pavilion_type, meta)
    # Xojatxona sync
    if pav.pavilion_type == "toilet":
        from app.api.pavilions import _sync_toilet
        await _sync_toilet(db, pav.id, pav.market_id, pav.display_name, pav.pavilion_type)
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
    year: int | None = Query(None),
    month: int | None = Query(None, ge=1, le=12),
) -> ImportResult:
    """Excel'dan monthly_balances import (admin)."""
    _today = date.today()
    year = year or _today.year
    month = month or _today.month
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xlsm")):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Faqat .xlsx fayl")
    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Fayl juda katta (10 MB chegarasi)")
    result = await import_balances_xlsx(db, content, year, month)
    await write_audit(
        db, admin.id, "import_excel", "monthly_balances", file.filename,
        {"rows": result.rows_read, "inserted": result.inserted},
    )
    await db.commit()
    return result


class BillingImportOut(BaseModel):
    ok: bool = True
    rows_read: int = 0
    counterparties: int = 0
    records: int = 0
    skipped: int = 0
    errors: list[str] = []
    snapshot_id: int | None = None
    log_id: int | None = None


@router.post("/import/billing", response_model=BillingImportOut)
async def import_billing(
    admin: AdminUser,
    market: CurrentMarket,
    db: Annotated[AsyncSession, Depends(get_db)],
    file: UploadFile = File(...),
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
) -> BillingImportOut:
    """Billing Excel import (1C buxgalteriya formati).

    Дебет=qarz (due_amount), Кредит=ortiqcha to'lov (paid_amount).
    Avval to'liq validatsiya — biror xato bo'lsa HECH NARSA import qilinmaydi,
    xatolar va yuklangan fayl logga yoziladi (logdan yuklab olish mumkin).
    Muvaffaqiyatli importda snapshot olinadi (24 soat ichida qaytarish mumkin).
    """
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xlsm")):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Faqat .xlsx fayl")
    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Fayl juda katta (10 MB chegarasi)")

    result = await import_billing_xlsx(db, content, year, month, market.id)

    # === XATO: import qilinmaydi, fayl + xatolar logga yoziladi ===
    if not result.ok:
        audit = await write_audit(
            db, admin.id, "import_billing_failed", "import_log",
            f"{file.filename} ({year}-{month:02d})",
            {"year": year, "month": month, "market": market.slug,
             "error_count": len(result.errors)},
        )
        log = ImportLog(
            user_id=admin.id,
            market_id=market.id,
            filename=file.filename,
            year=year,
            month=month,
            status="failed",
            rows_read=result.rows_read,
            records=0,
            counterparties=0,
            errors=result.errors,
            file_data=base64.b64encode(content).decode("ascii"),
            file_mime=file.content_type or "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            audit_id=audit.id,
        )
        db.add(log)
        await db.commit()
        await db.refresh(log)
        return BillingImportOut(
            ok=False,
            rows_read=result.rows_read,
            counterparties=0,
            records=0,
            skipped=result.skipped,
            errors=result.errors,
            snapshot_id=None,
            log_id=log.id,
        )

    # === OK: import + snapshot + muvaffaqiyat logi ===
    audit = await write_audit(
        db, admin.id, "import_billing", "monthly_balances",
        f"{file.filename} ({year}-{month:02d})",
        {"year": year, "month": month, "market": market.slug,
         "counterparties": result.counterparties, "records": result.records},
    )
    snap = await save_snapshot(
        db,
        action="import_billing",
        table_name="monthly_balances",
        before_rows=result.snapshot_rows,
        user_id=admin.id,
        market_id=market.id,
        summary=f"Billing import: {file.filename} — {year}-{month:02d}, "
                f"{result.counterparties} kontragent, {result.records} yozuv",
        audit_id=audit.id,
    )
    log = ImportLog(
        user_id=admin.id,
        market_id=market.id,
        filename=file.filename,
        year=year,
        month=month,
        status="success",
        rows_read=result.rows_read,
        records=result.records,
        counterparties=result.counterparties,
        errors=None,
        file_data=None,  # muvaffaqiyatli faylni saqlamaymiz (joy tejash)
        audit_id=audit.id,
    )
    db.add(log)
    await db.commit()
    return BillingImportOut(
        ok=True,
        rows_read=result.rows_read,
        counterparties=result.counterparties,
        records=result.records,
        skipped=result.skipped,
        errors=result.errors,
        snapshot_id=snap.id,
        log_id=log.id,
    )


@router.get("/import/logs/{log_id}/file")
async def download_import_file(
    _admin: AdminUser,
    log_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    """Logdagi (xatoli) yuklangan billing faylni qaytaradi."""
    log = await db.get(ImportLog, log_id)
    if log is None or not log.file_data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Fayl topilmadi")
    try:
        raw = base64.b64decode(log.file_data)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Fayl buzilgan") from e
    fname = log.filename or "billing.xlsx"
    return Response(
        content=raw,
        media_type=log.file_mime or "application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


@router.post("/revert/{snapshot_id}")
async def revert_action(
    admin: AdminUser,
    snapshot_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Amalni ortga qaytaradi (oxirgi 24 soat ichida)."""
    ok, msg = await revert_snapshot(db, snapshot_id)
    if not ok:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, msg)
    await write_audit(
        db, admin.id, "revert", "change_snapshot", str(snapshot_id), {"result": msg}
    )
    await db.commit()
    return {"ok": True, "message": msg}


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
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Fayl juda katta (10 MB chegarasi)")
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
    try:
        content = await fetch_url_safely(url)
    except UnsafeUrlError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e
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
) -> list[AuditLogOut]:
    """Oxirgi audit yozuvlari — odam o'qiy oladigan ko'rinishda."""
    result = await db.execute(
        select(AuditLog, User)
        .join(User, AuditLog.user_id == User.id, isouter=True)
        .order_by(desc(AuditLog.created_at))
        .limit(limit)
    )
    rows = result.all()

    # Shu auditlarga bog'liq snapshotlar (rollback uchun)
    audit_ids = [log.id for log, _ in rows]
    snap_map: dict[int, ChangeSnapshot] = {}
    log_map: dict[int, ImportLog] = {}
    if audit_ids:
        snaps = await db.execute(
            select(ChangeSnapshot).where(ChangeSnapshot.audit_id.in_(audit_ids))
        )
        for s in snaps.scalars():
            if s.audit_id is not None:
                snap_map[s.audit_id] = s
        imp_logs = await db.execute(
            select(ImportLog).where(ImportLog.audit_id.in_(audit_ids))
        )
        for il in imp_logs.scalars():
            if il.audit_id is not None:
                log_map[il.audit_id] = il

    now = datetime.now(timezone.utc)

    out: list[AuditLogOut] = []
    for log, user in rows:
        if user is not None:
            name = user.full_name or user.username
            role_uz = {
                "super_admin": "Super admin",
                "admin": "Administrator",
                "market_admin": "Bozor admini",
                "market_viewer": "Kuzatuvchi",
            }.get(user.role, user.role)
            user_label = f"{name} (@{user.username})"
        else:
            role_uz = None
            user_label = "Noma'lum foydalanuvchi"

        snap = snap_map.get(log.id)
        snapshot_id = snap.id if snap else None
        reverted = snap.reverted if snap else False
        revertable = False
        if snap and not snap.reverted:
            created = snap.created_at
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
            revertable = (now - created) <= timedelta(hours=REVERT_WINDOW_HOURS)

        imp = log_map.get(log.id)
        import_log_id = None
        import_failed = False
        error_count = 0
        if imp is not None:
            import_failed = imp.status == "failed"
            error_count = len(imp.errors or [])
            # Faqat fayl saqlangan bo'lsa yuklab olish mumkin (xatoli importlar)
            if imp.file_data:
                import_log_id = imp.id

        out.append(
            AuditLogOut(
                id=log.id,
                user_id=log.user_id,
                action=log.action,
                resource_type=log.resource_type,
                resource_id=log.resource_id,
                changes=log.changes,
                created_at=log.created_at,
                action_label=action_label(log.action),
                resource_label=resource_label(log.resource_type, log.resource_id),
                user_label=user_label,
                user_role=role_uz,
                summary=build_summary(log.action, log.resource_id, log.changes),
                snapshot_id=snapshot_id,
                revertable=revertable,
                reverted=reverted,
                import_log_id=import_log_id,
                import_failed=import_failed,
                error_count=error_count,
            )
        )
    return out


# ===== BILLING SUMMARY (oy/yil bo'yicha bloklar/layoutlar hisoboti) =====

@router.get("/billing-summary")
async def billing_summary(
    admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    market: CurrentMarket,
    year: int | None = Query(None),
    month: int | None = Query(None, ge=1, le=12),
) -> dict:
    """Tanlangan oy/yil uchun butun bozor, har layout (qavat) va har blok
    bo'yicha Jami / To'langan / Qarzdorlik summalarini qaytaradi.

    - JAMI = magazinlar monthly_rent yig'indisi
    - QARZDORLIK = INN qarzi (billing) magazinlarga taqsimlangan
    - TO'LANGAN = JAMI − QARZDORLIK
    """
    from decimal import Decimal
    from app.api.pavilions import _prefix_shop_filter
    from app.services.billing_service import compute_batch_status
    from app.models import MonthlyBalance

    today = date.today()
    year = year or today.year
    month = month or today.month

    # Tanlangan oy/yil uchun billing ma'lumoti bormi? Bo'lmasa — "ma'lumot yo'q".
    has_data = await db.scalar(
        select(func.count()).select_from(MonthlyBalance).where(
            MonthlyBalance.year == year, MonthlyBalance.month == month
        )
    )
    if not has_data:
        return {
            "year": year,
            "month": month,
            "has_data": False,
            "total": {
                "total_due": 0.0, "total_paid": 0.0, "total_debt": 0.0,
                "shop_count": 0, "block_count": 0,
            },
            "layers": [],
            "blocks": [],
        }

    # Layoutlar (qavatlar)
    layers = list((await db.execute(
        select(MapLayer).where(MapLayer.market_id == market.id).order_by(MapLayer.id)
    )).scalars())
    layer_name = {l.id: l.name for l in layers}

    # Bloklar (pavilionlar)
    pavilions = list((await db.execute(
        select(Pavilion).where(Pavilion.market_id == market.id, Pavilion.is_active.is_(True))
        .order_by(Pavilion.display_order, Pavilion.id)
    )).scalars())

    blocks_out: list[dict] = []
    layer_agg: dict[int | None, dict] = {}
    grand = {"due": Decimal(0), "paid": Decimal(0), "debt": Decimal(0), "shop_count": 0}
    seen_shops: set[str] = set()  # bir magazin bir nechta blokda takror sanalmasin

    for pav in pavilions:
        prefix = None
        if isinstance(pav.meta, dict):
            prefix = (pav.meta.get("shop_prefix") or "").strip() or None
        if not prefix:
            continue  # prefiksi yo'q blok — magazinlari aniqlanmaydi

        shops_all = list((await db.execute(
            select(Shop.shop_id).where(
                Shop.market_id == market.id,
                _prefix_shop_filter(prefix),
                Shop.is_active.is_(True),
            )
        )).scalars())
        # Boshqa blokda allaqachon sanalganlarni chiqarib tashlaymiz (dublikatsiz Jami)
        shops = [s for s in shops_all if s not in seen_shops]
        if not shops:
            continue
        seen_shops.update(shops)

        billing = await compute_batch_status(db, shops, year, month)
        due = sum((b.total_due for b in billing.values()), Decimal(0))
        paid = sum((b.total_paid for b in billing.values()), Decimal(0))
        debt = sum((b.total_debt for b in billing.values()), Decimal(0))

        blocks_out.append({
            "pavilion_id": pav.id,
            "name": pav.display_name,
            "layer_id": pav.map_layer_id,
            "layer_name": layer_name.get(pav.map_layer_id),
            "prefix": prefix,
            "shop_count": len(shops),
            "total_due": float(due),
            "total_paid": float(paid),
            "total_debt": float(debt),
        })

        lk = pav.map_layer_id
        if lk not in layer_agg:
            layer_agg[lk] = {"due": Decimal(0), "paid": Decimal(0), "debt": Decimal(0),
                             "shop_count": 0, "block_count": 0}
        layer_agg[lk]["due"] += due
        layer_agg[lk]["paid"] += paid
        # debt ni yig'maymiz — oxirida due-paid dan hisoblaymiz
        layer_agg[lk]["shop_count"] += len(shops)
        layer_agg[lk]["block_count"] += 1

        grand["due"] += due
        grand["paid"] += paid
        # grand debt ham oxirida hisoblanadi
        grand["shop_count"] += len(shops)

    layers_out = []
    for lk, a in layer_agg.items():
        layer_debt = max(Decimal(0), a["due"] - a["paid"])
        layers_out.append({
            "layer_id": lk,
            "name": layer_name.get(lk) or "Asosiy xarita",
            "block_count": a["block_count"],
            "shop_count": a["shop_count"],
            "total_due": float(a["due"]),
            "total_paid": float(a["paid"]),
            "total_debt": float(layer_debt),
        })
    layers_out.sort(key=lambda x: (x["layer_id"] is None, x["layer_id"] or 0))

    return {
        "year": year,
        "month": month,
        "has_data": True,
        "total": {
            "total_due": float(grand["due"]),
            "total_paid": float(grand["paid"]),
            "total_debt": float(max(Decimal(0), grand["due"] - grand["paid"])),
            "shop_count": grand["shop_count"],
            "block_count": len(blocks_out),
        },
        "layers": layers_out,
        "blocks": blocks_out,
    }


# ===== MAGAZIN EGALARI/RO'YXATINI EXCEL'DAN YANGILASH (rollback bilan) =====

class ShopOwnerImportOut(BaseModel):
    ok: bool = True
    rows_read: int = 0
    updated: int = 0
    inserted: int = 0
    counterparties_updated: int = 0
    counterparties_created: int = 0
    errors: list[str] = []
    skipped: list[dict] = []
    skipped_count: int = 0
    detected_columns: dict = {}
    snapshot_id: int | None = None


@router.post("/import/shop-owners", response_model=ShopOwnerImportOut)
async def import_shop_owners(
    admin: AdminUser,
    market: CurrentMarket,
    db: Annotated[AsyncSession, Depends(get_db)],
    file: UploadFile = File(...),
) -> ShopOwnerImportOut:
    """Magazin egalari/ro'yxatini Excel'dan yangilaydi.

    Ustunlar: Magazin ID, QR #, Kontragent, Summa.
    Import oldidan snapshot olinadi — 24 soat ichida ortga qaytarish mumkin.
    """
    from app.services.shop_owner_import_service import import_shop_owners_excel

    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xlsm")):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Faqat .xlsx fayl")
    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Fayl juda katta (10 MB chegarasi)")

    try:
        result = await import_shop_owners_excel(db, content, market.id)
    except Exception as exc:  # noqa: BLE001
        await db.rollback()
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Faylni o'qishda xatolik: {type(exc).__name__}: {exc}. "
            f"Ustunlar to'g'ri ekanini tekshiring: Magazin ID, QR, Kontragent, Summa.",
        ) from exc

    if result.rows_read == 0:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Hech qanday magazin topilmadi. Birinchi qatorda ustun nomlari bo'lishi kerak: "
            "Magazin ID (yoki «Магазин №»), QR, Kontragent (yoki «Ижарачи»), Summa (yoki «Сумма»).",
        )

    audit = await write_audit(
        db, admin.id, "import_shop_owners", "shops", file.filename,
        {"updated": result.updated, "inserted": result.inserted,
         "cp_updated": result.counterparties_updated,
         "cp_created": result.counterparties_created},
    )
    snap = await save_snapshot(
        db,
        action="import_shop_owners",
        table_name="shops",
        before_rows=result.snapshot_rows,
        user_id=admin.id,
        market_id=market.id,
        summary=f"Egalar import: {file.filename} — "
                f"{result.updated} yangilandi, {result.inserted} qo'shildi",
        audit_id=audit.id,
    )
    await db.commit()

    return ShopOwnerImportOut(
        ok=True,
        rows_read=result.rows_read,
        updated=result.updated,
        inserted=result.inserted,
        counterparties_updated=result.counterparties_updated,
        counterparties_created=result.counterparties_created,
        errors=result.errors[:100],
        skipped=result.skipped[:200],
        skipped_count=len(result.skipped),
        detected_columns=result.detected_columns,
        snapshot_id=snap.id,
    )


# ===== SANA BO'YICHA ARENDA BILLING IMPORT (kunlik, rollback bilan) =====

class RentBillingImportOut(BaseModel):
    ok: bool = True
    rows_read: int = 0
    upserted: int = 0
    with_debt: int = 0
    no_debt: int = 0
    bill_date: str = ""
    errors: list[str] = []
    skipped: list[dict] = []
    skipped_count: int = 0
    detected_columns: dict = {}
    snapshot_id: int | None = None


@router.post("/import/rent-billing", response_model=RentBillingImportOut)
async def import_rent_billing(
    admin: AdminUser,
    market: CurrentMarket,
    db: Annotated[AsyncSession, Depends(get_db)],
    file: UploadFile = File(...),
    bill_date: str = Query(..., description="Sana (YYYY-MM-DD)"),
) -> RentBillingImportOut:
    """Sana bo'yicha arenda billing import (Excel).

    Ustunlar: Контрагент, Договор, Основное арендное место (magazin ID),
    Арендная площадь, ИНН, Ойлик сумма, Карз, тўланган.
    Tanlangan sanaga saqlanadi — boshqa sanalarga ta'sir qilmaydi.
    """
    from datetime import date as _date
    from app.services.rent_billing_import_service import (
        import_rent_billing_excel, StructureError,
    )
    from app.models import RentBilling
    from sqlalchemy import select as _select

    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xlsm")):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Faqat .xlsx fayl")
    try:
        bd = _date.fromisoformat(bill_date)
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Sana formati noto'g'ri (YYYY-MM-DD)")

    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Fayl juda katta (10 MB)")

    # Snapshot: shu sanadagi mavjud yozuvlar (rollback uchun)
    existing = list((await db.execute(
        _select(RentBilling).where(
            RentBilling.market_id == market.id, RentBilling.bill_date == bd
        )
    )).scalars())
    snapshot_rows = [{
        "key": {"shop_id": r.shop_id, "market_id": r.market_id, "bill_date": bd.isoformat()},
        "before": {
            "shop_id": r.shop_id, "market_id": r.market_id, "bill_date": bd.isoformat(),
            "inn": r.inn, "counterparty_name": r.counterparty_name, "contract_no": r.contract_no,
            "monthly_amount": str(r.monthly_amount), "debt": str(r.debt), "paid": str(r.paid),
        },
    } for r in existing]

    try:
        result = await import_rent_billing_excel(db, content, bd, market.id)
    except StructureError as exc:
        await db.rollback()
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        await db.rollback()
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Import xatosi: {type(exc).__name__}: {exc}",
        ) from exc

    audit = await write_audit(
        db, admin.id, "import_rent_billing", "rent_billing", f"{file.filename} ({bill_date})",
        {"upserted": result.upserted, "with_debt": result.with_debt, "date": bill_date},
    )
    snap = await save_snapshot(
        db,
        action="import_rent_billing",
        table_name="rent_billing",
        before_rows=snapshot_rows,
        user_id=admin.id,
        market_id=market.id,
        summary=f"Arenda billing import: {bill_date} — {result.upserted} magazin "
                f"({result.with_debt} qarzli)",
        audit_id=audit.id,
    )
    await db.commit()

    return RentBillingImportOut(
        ok=True,
        rows_read=result.rows_read,
        upserted=result.upserted,
        with_debt=result.with_debt,
        no_debt=result.no_debt,
        bill_date=result.bill_date,
        errors=result.errors[:100],
        skipped=result.skipped[:200],
        skipped_count=len(result.skipped),
        detected_columns=result.detected_columns,
        snapshot_id=snap.id,
    )


# ===== USUL 2: INN BO'YICHA TO'LOV IMPORT (oy davomida, rollback bilan) =====

class InnPaymentImportOut(BaseModel):
    ok: bool = True
    rows_read: int = 0
    payments_total: float = 0
    inns_matched: int = 0
    inns_unmatched: int = 0
    shops_updated: int = 0
    bill_date: str = ""
    errors: list[str] = []
    skipped: list[dict] = []
    skipped_count: int = 0
    detected_columns: dict = {}
    snapshot_id: int | None = None


@router.post("/import/inn-payments", response_model=InnPaymentImportOut)
async def import_inn_payments(
    admin: AdminUser,
    market: CurrentMarket,
    db: Annotated[AsyncSession, Depends(get_db)],
    file: UploadFile = File(...),
    bill_date: str = Query(..., description="Sana (YYYY-MM-DD)"),
) -> InnPaymentImportOut:
    """INN bo'yicha to'lovlarni import qiladi (Usul 2).

    To'lovlar INN bo'yicha yig'iladi va o'sha INN magazinlariga taqsimlanadi —
    har magazin qarzidan ayiriladi. Natija tanlangan sanaga rent_billing ga yoziladi.
    """
    from datetime import date as _date
    from app.services.inn_payment_import_service import (
        import_inn_payments_excel, StructureError,
    )
    from app.models import RentBilling
    from sqlalchemy import select as _select

    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xlsm")):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Faqat .xlsx fayl")
    try:
        bd = _date.fromisoformat(bill_date)
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Sana formati noto'g'ri (YYYY-MM-DD)")

    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Fayl juda katta (10 MB)")

    # Snapshot: shu sanadagi mavjud yozuvlar (rollback uchun)
    existing = list((await db.execute(
        _select(RentBilling).where(
            RentBilling.market_id == market.id, RentBilling.bill_date == bd
        )
    )).scalars())
    snapshot_rows = [{
        "key": {"shop_id": r.shop_id, "market_id": r.market_id, "bill_date": bd.isoformat()},
        "before": {
            "shop_id": r.shop_id, "market_id": r.market_id, "bill_date": bd.isoformat(),
            "inn": r.inn, "counterparty_name": r.counterparty_name, "contract_no": r.contract_no,
            "monthly_amount": str(r.monthly_amount), "debt": str(r.debt), "paid": str(r.paid),
        },
    } for r in existing]

    try:
        result = await import_inn_payments_excel(db, content, bd, market.id)
    except StructureError as exc:
        await db.rollback()
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        await db.rollback()
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Import xatosi: {type(exc).__name__}: {exc}",
        ) from exc

    audit = await write_audit(
        db, admin.id, "import_inn_payments", "rent_billing", f"{file.filename} ({bill_date})",
        {"shops": result.shops_updated, "inns": result.inns_matched, "date": bill_date},
    )
    snap = await save_snapshot(
        db,
        action="import_inn_payments",
        table_name="rent_billing",
        before_rows=snapshot_rows,
        user_id=admin.id,
        market_id=market.id,
        summary=f"INN to'lov import: {bill_date} — {result.shops_updated} magazin, "
                f"{result.inns_matched} INN",
        audit_id=audit.id,
    )
    await db.commit()

    return InnPaymentImportOut(
        ok=True,
        rows_read=result.rows_read,
        payments_total=float(result.payments_total),
        inns_matched=result.inns_matched,
        inns_unmatched=result.inns_unmatched,
        shops_updated=result.shops_updated,
        bill_date=result.bill_date,
        errors=result.errors[:100],
        skipped=result.skipped[:200],
        skipped_count=len(result.skipped),
        detected_columns=result.detected_columns,
        snapshot_id=snap.id,
    )


# ===== ELEKTR TO'LOVLARI IMPORT (monthly_balances, electricity) =====

class ElectricityImportOut(BaseModel):
    ok: bool = True
    rows_read: int = 0
    inns: int = 0
    with_debt: int = 0
    with_prepaid: int = 0
    total_debt: float = 0
    total_prepaid: float = 0
    year: int = 0
    month: int = 0
    errors: list[str] = []
    skipped: list[dict] = []
    skipped_count: int = 0
    detected_columns: dict = {}
    snapshot_id: int | None = None


@router.post("/import/electricity", response_model=ElectricityImportOut)
async def import_electricity(
    admin: AdminUser,
    market: CurrentMarket,
    db: Annotated[AsyncSession, Depends(get_db)],
    file: UploadFile = File(...),
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
) -> ElectricityImportOut:
    """Elektr to'lovlarini import qiladi (К оплате=qarz, Предоплата=oldindan).

    INN bo'yicha yig'ib monthly_balances ga (electricity) yoziladi. Tanlangan
    yil/oy uchun. Snapshot olinadi — 24 soat ichida ortga qaytarish mumkin.
    """
    from app.services.electricity_import_service import (
        import_electricity_excel, StructureError,
    )
    from sqlalchemy import select as _select

    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xlsm")):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Faqat .xlsx fayl")
    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Fayl juda katta (10 MB)")

    # Avval strukturani tekshiramiz (DB'ga tegmasdan) — agg ni olamiz
    try:
        result = await import_electricity_excel(db, content, year, month, market.id)
    except StructureError as exc:
        await db.rollback()
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        await db.rollback()
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Import xatosi: {type(exc).__name__}: {exc}",
        ) from exc

    # Snapshot: shu (year, month, electricity) dagi tegiladigan INN larning eski holati
    touched_inns = list(result.agg.keys())
    snapshot_rows: list[dict] = []
    if touched_inns:
        existing = list((await db.execute(
            _select(MonthlyBalance).where(
                MonthlyBalance.year == year,
                MonthlyBalance.month == month,
                MonthlyBalance.category == "electricity",
                MonthlyBalance.inn.in_(touched_inns),
            )
        )).scalars())
        existing_map = {b.inn: b for b in existing}
        for inn in touched_inns:
            prev = existing_map.get(inn)
            key = {"inn": inn, "year": year, "month": month, "category": "electricity"}
            snapshot_rows.append({
                "key": key,
                "before": None if prev is None else {
                    "inn": inn, "year": year, "month": month, "category": "electricity",
                    "market_id": prev.market_id,
                    "due_amount": str(prev.due_amount),
                    "paid_amount": str(prev.paid_amount),
                },
            })

    try:
        audit = await write_audit(
            db, admin.id, "import_electricity", "monthly_balances", f"{file.filename} ({year}-{month})",
            {"inns": result.inns, "with_debt": result.with_debt, "year": year, "month": month},
        )
        snap = await save_snapshot(
            db,
            action="import_electricity",
            table_name="monthly_balances",
            before_rows=snapshot_rows,
            user_id=admin.id,
            market_id=market.id,
            summary=f"Elektr import: {year}-{month:02d} — {result.inns} INN, "
                    f"{result.with_debt} qarzli",
            audit_id=audit.id,
        )

        # Snapshot olingach — monthly_balances ga upsert (electricity)
        from sqlalchemy.dialects.postgresql import insert as _pg_insert
        records = [{
            "inn": inn, "market_id": market.id, "year": year, "month": month,
            "category": "electricity", "due_amount": v["due"], "paid_amount": v["paid"],
        } for inn, v in result.agg.items()]
        for i in range(0, len(records), 1000):
            chunk = records[i:i + 1000]
            stmt = _pg_insert(MonthlyBalance.__table__).values(chunk)
            stmt = stmt.on_conflict_do_update(
                index_elements=["inn", "year", "month", "category"],
                set_={
                    "due_amount": stmt.excluded.due_amount,
                    "paid_amount": stmt.excluded.paid_amount,
                    "market_id": stmt.excluded.market_id,
                },
            )
            await db.execute(stmt)

        await db.commit()
    except Exception as exc:  # noqa: BLE001
        await db.rollback()
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Bazaga saqlashda xatolik: {type(exc).__name__}: {exc}",
        ) from exc

    return ElectricityImportOut(
        ok=True,
        rows_read=result.rows_read,
        inns=result.inns,
        with_debt=result.with_debt,
        with_prepaid=result.with_prepaid,
        total_debt=float(result.total_debt),
        total_prepaid=float(result.total_prepaid),
        year=result.year,
        month=result.month,
        errors=result.errors[:100],
        skipped=result.skipped[:200],
        skipped_count=len(result.skipped),
        detected_columns=result.detected_columns,
        snapshot_id=snap.id,
    )


# ===== SUV TO'LOVLARI IMPORT =====
class WaterImportOut(BaseModel):
    ok: bool = True
    rows_read: int = 0
    inns: int = 0
    with_debt: int = 0
    with_prepaid: int = 0
    total_debt: float = 0
    total_prepaid: float = 0
    year: int = 0
    month: int = 0
    errors: list[str] = []
    skipped: list[dict] = []
    skipped_count: int = 0
    detected_columns: dict = {}
    snapshot_id: int | None = None


@router.post("/import/water", response_model=WaterImportOut)
async def import_water(
    admin: AdminUser,
    market: CurrentMarket,
    db: Annotated[AsyncSession, Depends(get_db)],
    file: UploadFile = File(...),
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
) -> WaterImportOut:
    """Suv to'lovlarini import qiladi (К оплате=qarz, Предоплата=oldindan)."""
    from app.services.water_import_service import import_water_excel, StructureError
    from sqlalchemy import select as _select
    from sqlalchemy.dialects.postgresql import insert as _pg_insert

    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xlsm")):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Faqat .xlsx fayl qabul qilinadi")
    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Fayl juda katta (10 MB)")

    try:
        result = await import_water_excel(db, content, year, month, market.id)
    except StructureError as exc:
        await db.rollback()
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
    except Exception as exc:
        await db.rollback()
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Import xatosi: {type(exc).__name__}: {exc}",
        ) from exc

    touched_inns = list(result.agg.keys())
    snapshot_rows: list[dict] = []
    if touched_inns:
        existing = list((await db.execute(
            _select(MonthlyBalance).where(
                MonthlyBalance.year == year,
                MonthlyBalance.month == month,
                MonthlyBalance.category == "water",
                MonthlyBalance.inn.in_(touched_inns),
            )
        )).scalars())
        existing_map = {b.inn: b for b in existing}
        for inn in touched_inns:
            prev = existing_map.get(inn)
            snapshot_rows.append({
                "key": {"inn": inn, "year": year, "month": month, "category": "water"},
                "before": None if prev is None else {
                    "inn": inn, "year": year, "month": month, "category": "water",
                    "market_id": prev.market_id,
                    "due_amount": str(prev.due_amount),
                    "paid_amount": str(prev.paid_amount),
                },
            })

    try:
        audit = await write_audit(
            db, admin.id, "import_water", "monthly_balances",
            f"{file.filename} ({year}-{month})",
            {"inns": result.inns, "with_debt": result.with_debt, "year": year, "month": month},
        )
        snap = await save_snapshot(
            db,
            action="import_water",
            table_name="monthly_balances",
            before_rows=snapshot_rows,
            user_id=admin.id,
            market_id=market.id,
            summary=f"Suv import: {year}-{month:02d} — {result.inns} INN",
            audit_id=audit.id,
        )

        records = [{
            "inn": inn, "market_id": market.id, "year": year, "month": month,
            "category": "water", "due_amount": v["due"], "paid_amount": v["paid"],
        } for inn, v in result.agg.items()]
        for i in range(0, len(records), 1000):
            chunk = records[i:i + 1000]
            stmt = _pg_insert(MonthlyBalance.__table__).values(chunk)
            stmt = stmt.on_conflict_do_update(
                index_elements=["inn", "year", "month", "category"],
                set_={
                    "due_amount": stmt.excluded.due_amount,
                    "paid_amount": stmt.excluded.paid_amount,
                    "market_id": stmt.excluded.market_id,
                },
            )
            await db.execute(stmt)

        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Bazaga saqlashda xatolik: {type(exc).__name__}: {exc}",
        ) from exc

    return WaterImportOut(
        ok=True,
        rows_read=result.rows_read,
        inns=result.inns,
        with_debt=result.with_debt,
        with_prepaid=result.with_prepaid,
        total_debt=float(result.total_debt),
        total_prepaid=float(result.total_prepaid),
        year=result.year,
        month=result.month,
        errors=result.errors[:100],
        skipped=result.skipped[:200],
        skipped_count=len(result.skipped),
        detected_columns=result.detected_columns,
        snapshot_id=snap.id,
    )
