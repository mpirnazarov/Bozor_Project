"""Owner (dastur egasi) endpointlari — /api/owner.

- Bozorlar CRUD
- Yangi bozor yaratilganda admin username + parol generatsiya qilinadi
- Tex-podderjka to'lovlarini belgilash va ko'rish
- Bozor parolini o'zgartirish
- To'lov qilinmagani uchun bozorni bloklash/blokdan chiqarish
"""
import secrets
import string
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import OwnerUser
from app.models.market import Market
from app.models.shop import Shop
from app.models.user import User, UserRole
from app.services.support_service import (
    get_support_status, list_payments, mark_payment,
)
from app.services.railway_service import get_railway_overview
from app.services.backup_service import (
    create_backup, list_backups, restore_backup, backup_path, is_available,
)
from app.utils.security import hash_password, verify_password

router = APIRouter()


@router.get("/railway")
async def owner_railway(_owner: OwnerUser) -> dict:
    """Railway server holati (CPU/RAM + deploymentlar) — owner dashboard uchun.

    Token sozlanmagan bo'lsa {configured: false} qaytaradi.
    """
    return await get_railway_overview()


# ===== Backup =====

class RestoreRequest(BaseModel):
    password: str


def _backup_out(log) -> dict:
    return {
        "id": log.id,
        "filename": log.filename,
        "trigger": log.trigger,
        "category": log.category,
        "status": log.status,
        "size_bytes": log.size_bytes,
        "size_mb": round(log.size_bytes / 1_048_576, 2) if log.size_bytes else 0,
        "duration_ms": log.duration_ms,
        "error": log.error,
        "s3_uploaded": log.s3_uploaded,
        "s3_error": log.s3_error,
        "created_at": log.created_at.isoformat(),
    }


@router.get("/backups")
async def owner_list_backups(
    _owner: OwnerUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Backup jurnalini qaytaradi."""
    from app.services import s3_service
    logs = await list_backups(db)
    return {
        "available": is_available(),
        "s3_enabled": s3_service.is_enabled(),
        "backups": [_backup_out(b) for b in logs],
    }


@router.post("/backups")
async def owner_create_backup(
    owner: OwnerUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Qo'lda (manual) backup yaratadi."""
    if not is_available():
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Backup imkoni yo'q — serverda pg_dump (postgresql-client) o'rnatilmagan",
        )
    log = await create_backup(db, trigger="manual", user_id=owner.id)
    if log.status != "success":
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, log.error or "Backup xatosi")
    return _backup_out(log)


@router.get("/backups/{backup_id}/download")
async def owner_download_backup(
    _owner: OwnerUser,
    backup_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> FileResponse:
    """Backup faylini yuklab olish (.sql.gz)."""
    from app.models.backup_log import BackupLog
    log = await db.get(BackupLog, backup_id)
    if log is None or log.status != "success":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Backup topilmadi")
    fp = backup_path(log.filename)
    if fp is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Backup fayli diskda topilmadi")
    return FileResponse(path=str(fp), filename=log.filename, media_type="application/gzip")


@router.post("/backups/{backup_id}/restore")
async def owner_restore_backup(
    owner: OwnerUser,
    backup_id: int,
    body: RestoreRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Backupни qaytaradi — XAVFLI. Owner parolini tasdiqlash majburiy."""
    # Parol tekshiruvi
    if not body.password or not verify_password(body.password, owner.password_hash):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Parol noto'g'ri")
    ok, msg = await restore_backup(db, backup_id)
    if not ok:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, msg)
    return {"ok": True, "message": msg}


def _gen_password(n: int = 10) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(n))


def _slugify(name: str) -> str:
    base = "".join(c if c.isalnum() else "-" for c in name.lower()).strip("-")
    base = "-".join(filter(None, base.split("-")))
    return base or "bozor"


# ===== Schemas =====
class MarketCreateBody(BaseModel):
    name: str
    slug: str | None = None
    admin_username: str | None = None


class MarketEditBody(BaseModel):
    name: str | None = None
    is_active: bool | None = None
    display_order: int | None = None


class PaymentBody(BaseModel):
    year: int
    month: int
    is_paid: bool
    notes: str | None = None


class PasswordBody(BaseModel):
    new_password: str


class BlockBody(BaseModel):
    blocked: bool


# ===== Bozorlar ro'yxati (support holati bilan) =====
@router.get("/markets")
async def owner_list_markets(
    _owner: OwnerUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[dict]:
    rows = await db.execute(select(Market).order_by(Market.display_order, Market.id))
    markets = list(rows.scalars())
    out: list[dict] = []
    for m in markets:
        status_info = await get_support_status(db, m)
        shop_count = await db.scalar(
            select(func.count()).select_from(Shop).where(Shop.market_id == m.id)
        )
        admin = await db.scalar(
            select(User).where(User.market_id == m.id, User.role == UserRole.MARKET_ADMIN.value)
        )
        out.append({
            "id": m.id,
            "slug": m.slug,
            "name": m.name,
            "is_active": m.is_active,
            "support_blocked": m.support_blocked,
            "created_at": m.created_at.isoformat(),
            "shop_count": shop_count or 0,
            "admin_username": admin.username if admin else None,
            "support": status_info,
        })
    return out


# ===== Yangi bozor yaratish (username + parol qaytaradi) =====
@router.post("/markets", status_code=status.HTTP_201_CREATED)
async def owner_create_market(
    body: MarketCreateBody,
    _owner: OwnerUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    slug = (body.slug or _slugify(body.name)).strip()
    exists = await db.scalar(select(Market).where(Market.slug == slug))
    if exists:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"'{slug}' slug allaqachon mavjud")

    market = Market(slug=slug, name=body.name.strip(), is_active=True)
    db.add(market)
    await db.flush()  # market.id olish uchun

    # Admin foydalanuvchi yaratish
    username = (body.admin_username or slug).strip()
    u_exists = await db.scalar(select(User).where(User.username == username))
    if u_exists:
        username = f"{username}-{market.id}"
    password = _gen_password()
    admin_user = User(
        username=username,
        password_hash=hash_password(password),
        role=UserRole.MARKET_ADMIN.value,
        market_id=market.id,
        full_name=f"{body.name} admin",
        is_active=True,
    )
    db.add(admin_user)
    await db.commit()
    await db.refresh(market)

    return {
        "id": market.id,
        "slug": market.slug,
        "name": market.name,
        # Parol FAQAT shu javobda ko'rsatiladi — keyin saqlanmaydi (hash bo'ladi)
        "credentials": {"username": username, "password": password},
    }


# ===== Bozor tahrirlash =====
@router.put("/markets/{market_id}")
async def owner_update_market(
    market_id: int,
    body: MarketEditBody,
    _owner: OwnerUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    market = await db.get(Market, market_id)
    if market is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bozor topilmadi")
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(market, k, v)
    await db.commit()
    return {"ok": True}


# ===== Bozor o'chirish =====
@router.delete("/markets/{market_id}")
async def owner_delete_market(
    market_id: int,
    _owner: OwnerUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    market = await db.get(Market, market_id)
    if market is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bozor topilmadi")
    if market.slug == "orikzor":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Asosiy bozorni o'chirib bo'lmaydi")
    await db.delete(market)
    await db.commit()
    return {"ok": True}


# ===== Bozor parolini o'zgartirish =====
@router.put("/markets/{market_id}/password")
async def owner_change_password(
    market_id: int,
    body: PasswordBody,
    _owner: OwnerUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    admin = await db.scalar(
        select(User).where(User.market_id == market_id, User.role == UserRole.MARKET_ADMIN.value)
    )
    if admin is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bozor admini topilmadi")
    if len(body.new_password) < 6:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Parol kamida 6 belgi bo'lishi kerak")
    admin.password_hash = hash_password(body.new_password)
    await db.commit()
    return {"ok": True, "username": admin.username}


# ===== Tex-podderjka: to'lovni belgilash =====
@router.post("/markets/{market_id}/support/payment")
async def owner_mark_payment(
    market_id: int,
    body: PaymentBody,
    _owner: OwnerUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    market = await db.get(Market, market_id)
    if market is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bozor topilmadi")
    await mark_payment(db, market_id, body.year, body.month, body.is_paid, body.notes)
    await db.commit()
    return {"ok": True}


# ===== Tex-podderjka: to'lovlar tarixi =====
@router.get("/markets/{market_id}/support/payments")
async def owner_list_payments(
    market_id: int,
    _owner: OwnerUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[dict]:
    payments = await list_payments(db, market_id)
    return [
        {
            "year": p.year, "month": p.month,
            "amount": float(p.amount), "is_paid": p.is_paid,
            "paid_at": p.paid_at.isoformat() if p.paid_at else None,
            "notes": p.notes,
        }
        for p in payments
    ]


# ===== To'lov qilinmagani uchun bloklash / blokdan chiqarish =====
@router.post("/markets/{market_id}/support/block")
async def owner_block_market(
    market_id: int,
    body: BlockBody,
    _owner: OwnerUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    market = await db.get(Market, market_id)
    if market is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bozor topilmadi")
    market.support_blocked = body.blocked
    await db.commit()
    return {"ok": True, "support_blocked": market.support_blocked}


# ===== Invoices (qo'shimcha to'lovlar / schyot) =====

class InvoiceCreate(BaseModel):
    market_id: int
    title: str
    amount: float
    description: str | None = None
    currency: str = "UZS"
    due_date: date | None = None
    doc_data: str | None = None   # base64 (ixtiyoriy)
    doc_name: str | None = None
    doc_mime: str | None = None


class InvoicePaidBody(BaseModel):
    is_paid: bool
    note: str | None = None


class InvoicePaidAmountBody(BaseModel):
    paid_amount: float
    note: str | None = None


class InvoiceUpdateBody(BaseModel):
    title: str | None = None
    amount: float | None = None
    description: str | None = None
    currency: str | None = None
    due_date: date | None = None
    doc_data: str | None = None
    doc_name: str | None = None
    doc_mime: str | None = None


def _invoice_out(inv, market_name: str | None = None) -> dict:
    from app.services.invoice_service import compute_status, days_left, remaining
    return {
        "id": inv.id,
        "market_id": inv.market_id,
        "market_name": market_name,
        "title": inv.title,
        "description": inv.description,
        "amount": float(inv.amount),
        "paid_amount": float(inv.paid_amount or 0),
        "remaining": remaining(inv),
        "currency": inv.currency,
        "due_date": inv.due_date.isoformat() if inv.due_date else None,
        "is_paid": inv.is_paid,
        "paid_at": inv.paid_at.isoformat() if inv.paid_at else None,
        "paid_note": inv.paid_note,
        "status": compute_status(inv),
        "days_left": days_left(inv),
        "has_doc": bool(inv.doc_data),
        "doc_name": inv.doc_name,
        "created_at": inv.created_at.isoformat(),
    }


@router.get("/invoices")
async def owner_list_invoices(
    _owner: OwnerUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    market_id: int | None = None,
    invoice_status: str | None = None,
    search: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> dict:
    """Barcha schyotlar (owner) — filtr: market_id, status, search."""
    from app.services.invoice_service import list_invoices, stats_by_market
    items, total = await list_invoices(
        db, market_id=market_id, status=invoice_status, search=search,
        limit=limit, offset=offset,
    )
    # Market nomlarini bir martada olamiz
    mrows = await db.execute(select(Market.id, Market.name))
    names = {mid: name for mid, name in mrows.all()}
    stats = await stats_by_market(db, market_id=market_id)
    return {
        "invoices": [_invoice_out(i, names.get(i.market_id)) for i in items],
        "total": total,
        "stats": stats,
    }


@router.post("/invoices")
async def owner_create_invoice(
    owner: OwnerUser,
    body: InvoiceCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    from decimal import Decimal
    from app.services.invoice_service import create_invoice
    market = await db.get(Market, body.market_id)
    if market is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bozor topilmadi")
    if not body.title.strip():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Sarlavha (nima uchun) kerak")
    if body.amount <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Summa 0 dan katta bo'lishi kerak")
    inv = await create_invoice(
        db,
        market_id=body.market_id,
        title=body.title.strip(),
        amount=Decimal(str(body.amount)),
        description=body.description,
        currency=body.currency or "UZS",
        due_date=body.due_date,
        doc_data=body.doc_data,
        doc_name=body.doc_name,
        doc_mime=body.doc_mime,
        created_by=owner.id,
    )
    return _invoice_out(inv, market.name)


@router.post("/invoices/{invoice_id}/paid")
async def owner_set_invoice_paid(
    _owner: OwnerUser,
    invoice_id: int,
    body: InvoicePaidBody,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    from app.services.invoice_service import set_paid
    from app.models.invoice import Invoice
    inv = await db.get(Invoice, invoice_id)
    if inv is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Schyot topilmadi")
    await set_paid(db, inv, body.is_paid, body.note)
    market = await db.get(Market, inv.market_id)
    return _invoice_out(inv, market.name if market else None)


@router.post("/invoices/{invoice_id}/pay-amount")
async def owner_set_invoice_paid_amount(
    _owner: OwnerUser,
    invoice_id: int,
    body: InvoicePaidAmountBody,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Qisman (yoki to'liq) to'lov summasini belgilash."""
    from decimal import Decimal
    from app.services.invoice_service import set_paid_amount
    from app.models.invoice import Invoice
    inv = await db.get(Invoice, invoice_id)
    if inv is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Schyot topilmadi")
    if body.paid_amount < 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Summa manfiy bo'lmasligi kerak")
    await set_paid_amount(db, inv, Decimal(str(body.paid_amount)), body.note)
    market = await db.get(Market, inv.market_id)
    return _invoice_out(inv, market.name if market else None)


@router.patch("/invoices/{invoice_id}")
async def owner_update_invoice(
    _owner: OwnerUser,
    invoice_id: int,
    body: InvoiceUpdateBody,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Schyotni tahrirlash."""
    from decimal import Decimal
    from app.services.invoice_service import update_invoice
    from app.models.invoice import Invoice
    inv = await db.get(Invoice, invoice_id)
    if inv is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Schyot topilmadi")
    fields: dict = {}
    if body.title is not None:
        if not body.title.strip():
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Sarlavha bo'sh bo'lmasin")
        fields["title"] = body.title.strip()
    if body.amount is not None:
        if body.amount <= 0:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Summa 0 dan katta bo'lsin")
        fields["amount"] = Decimal(str(body.amount))
    if body.description is not None:
        fields["description"] = body.description
    if body.currency is not None:
        fields["currency"] = body.currency
    if body.due_date is not None:
        fields["due_date"] = body.due_date
    if body.doc_data is not None:
        fields["doc_data"] = body.doc_data
        fields["doc_name"] = body.doc_name
        fields["doc_mime"] = body.doc_mime
    await update_invoice(db, inv, **fields)
    market = await db.get(Market, inv.market_id)
    return _invoice_out(inv, market.name if market else None)


@router.delete("/invoices/{invoice_id}")
async def owner_delete_invoice(
    _owner: OwnerUser,
    invoice_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    from app.models.invoice import Invoice
    inv = await db.get(Invoice, invoice_id)
    if inv is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Schyot topilmadi")
    await db.delete(inv)
    await db.commit()
    return {"ok": True}


@router.get("/invoices/{invoice_id}/doc")
async def owner_invoice_doc(
    _owner: OwnerUser,
    invoice_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from fastapi.responses import Response
    import base64
    from app.models.invoice import Invoice
    inv = await db.get(Invoice, invoice_id)
    if inv is None or not inv.doc_data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Hujjat topilmadi")
    raw = inv.doc_data
    if "," in raw and raw.strip().startswith("data:"):
        raw = raw.split(",", 1)[1]
    try:
        content = base64.b64decode(raw)
    except Exception:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Hujjatni o'qib bo'lmadi")
    return Response(
        content=content,
        media_type=inv.doc_mime or "application/octet-stream",
        headers={"Content-Disposition": f'inline; filename="{inv.doc_name or "document"}"'},
    )
