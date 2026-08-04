"""Dashboard endpoint — /api/dashboard."""
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import CurrentUser, get_current_market
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
    market=Depends(get_current_market),
    live: bool = Query(False, description="True bo'lsa monthly_balances'dan hisoblaydi"),
    year: int | None = Query(None),
    month: int | None = Query(None, ge=1, le=12),
) -> DashboardOut:
    """
    Dashboard summalari.

    - default: settings.dashboard_stats'dan (admin tahrirlagan qiymatlar)
    - ?live=true: monthly_balances'dan jonli hisoblanadi
    """
    today = date.today()
    year = year or today.year
    month = month or today.month
    if live:
        result = await get_dashboard_live(db, year, month)
    else:
        result = await get_dashboard_from_settings(db)
    # market_name ni qo'shamiz
    result.market_name = getattr(market, "name", None)
    return result


@router.get("/invoices")
async def market_invoices(
    _user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    market=Depends(get_current_market),
) -> dict:
    """Bozorning o'z schyotlari (faqat ko'rish). market_admin/viewer uchun."""
    from app.services.invoice_service import (
        list_invoices, stats_by_market, compute_status, days_left, remaining,
    )
    items, total = await list_invoices(db, market_id=market.id, limit=200)
    stats = await stats_by_market(db, market_id=market.id)

    def out(inv):
        return {
            "id": inv.id,
            "title": inv.title,
            "description": inv.description,
            "amount": float(inv.amount),
            "paid_amount": float(inv.paid_amount or 0),
            "remaining": remaining(inv),
            "currency": inv.currency,
            "kind": inv.kind,
            "payment_method": inv.payment_method,
            "contract_no": inv.contract_no,
            "due_date": inv.due_date.isoformat() if inv.due_date else None,
            "is_paid": inv.is_paid,
            "paid_at": inv.paid_at.isoformat() if inv.paid_at else None,
            "status": compute_status(inv),
            "days_left": days_left(inv),
            "has_doc": bool(inv.doc_data),
            "doc_name": inv.doc_name,
            "created_at": inv.created_at.isoformat(),
        }

    return {
        "market_name": market.name,
        "invoices": [out(i) for i in items],
        "total": total,
        "stats": stats,
    }


@router.get("/discipline")
async def market_discipline_summary(
    _user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    market=Depends(get_current_market),
) -> dict:
    """Bozorning o'z to'lov intizomi (ijobiy ko'rinish — kechikish ta'kidlanmaydi)."""
    from app.services.invoice_service import payment_discipline
    d = await payment_discipline(db, market.id)
    # Bozorga faqat ijobiy/neytral ma'lumot: nechta o'z vaqtida to'langan
    return {
        "total_judged": d["total_judged"],
        "on_time": d["on_time"],
        "on_time_rate": d["on_time_rate"],
        "rating": d["rating"],
    }


@router.get("/invoices/{invoice_id}/payments")
async def market_invoice_payments(
    _user: CurrentUser,
    invoice_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    market=Depends(get_current_market),
) -> dict:
    """Bozor o'z schyotining to'lov tarixini ko'radi (read-only, faqat o'z bozori)."""
    from fastapi import HTTPException, status
    from app.models.invoice import Invoice
    from app.services.invoice_service import list_payments
    inv = await db.get(Invoice, invoice_id)
    if inv is None or inv.market_id != market.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Schyot topilmadi")
    payments = await list_payments(db, invoice_id)
    return {
        "invoice_id": invoice_id,
        "payments": [
            {
                "id": p.id,
                "amount": float(p.amount),
                "note": p.note,
                "created_at": p.created_at.isoformat(),
                "edited_at": p.edited_at.isoformat() if p.edited_at else None,
            }
            for p in payments
        ],
    }


@router.get("/invoices/{invoice_id}/doc")
async def market_invoice_doc(
    _user: CurrentUser,
    invoice_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    market=Depends(get_current_market),
):
    """Bozor o'z schyotidagi hujjatni ko'radi (faqat o'z bozori)."""
    from fastapi import HTTPException, status
    from fastapi.responses import Response
    import base64
    from app.models.invoice import Invoice
    inv = await db.get(Invoice, invoice_id)
    if inv is None or inv.market_id != market.id or not inv.doc_data:
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
