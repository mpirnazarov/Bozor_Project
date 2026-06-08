"""Invoice (schyot) xizmati — yaratish, ro'yxat, holat hisoblash.

Holat ranglari:
- paid (yashil): to'langan
- pending (sariq): to'lanmagan, deadline kelmagan yoki yaqin
- overdue (qizil): to'lanmagan, deadline o'tib ketgan
"""
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.invoice import Invoice
from app.models.market import Market


def compute_status(inv: Invoice, today: date | None = None) -> str:
    """Schyot holatini rang sifatida qaytaradi: paid | pending | overdue."""
    if inv.is_paid:
        return "paid"
    today = today or datetime.now(timezone.utc).date()
    if inv.due_date is not None and inv.due_date < today:
        return "overdue"
    return "pending"


def days_left(inv: Invoice, today: date | None = None) -> int | None:
    """Deadline'gacha qolgan kunlar (manfiy bo'lsa — o'tib ketgan)."""
    if inv.due_date is None:
        return None
    today = today or datetime.now(timezone.utc).date()
    return (inv.due_date - today).days


async def create_invoice(
    db: AsyncSession,
    *,
    market_id: int,
    title: str,
    amount: Decimal,
    description: str | None = None,
    currency: str = "UZS",
    due_date: date | None = None,
    doc_data: str | None = None,
    doc_name: str | None = None,
    doc_mime: str | None = None,
    created_by: int | None = None,
) -> Invoice:
    inv = Invoice(
        market_id=market_id,
        title=title,
        description=description,
        amount=amount,
        currency=currency or "UZS",
        due_date=due_date,
        doc_data=doc_data,
        doc_name=doc_name,
        doc_mime=doc_mime,
        created_by=created_by,
    )
    db.add(inv)
    await db.commit()
    await db.refresh(inv)
    return inv


async def set_paid(db: AsyncSession, inv: Invoice, is_paid: bool, note: str | None = None) -> Invoice:
    inv.is_paid = is_paid
    inv.paid_at = datetime.now(timezone.utc) if is_paid else None
    if note is not None:
        inv.paid_note = note
    await db.commit()
    await db.refresh(inv)
    return inv


async def list_invoices(
    db: AsyncSession,
    *,
    market_id: int | None = None,
    status: str | None = None,       # paid | pending | overdue
    search: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> tuple[list[Invoice], int]:
    """Filtrlangan schyotlar ro'yxati + umumiy son. status filtri Python tomonda."""
    stmt = select(Invoice)
    if market_id is not None:
        stmt = stmt.where(Invoice.market_id == market_id)
    if search:
        like = f"%{search.strip()}%"
        stmt = stmt.where(or_(Invoice.title.ilike(like), Invoice.description.ilike(like)))

    stmt = stmt.order_by(Invoice.created_at.desc())
    rows = await db.execute(stmt)
    items = list(rows.scalars())

    # Holat bo'yicha filtr (hisoblanadigan maydon — Python tomonda)
    if status in ("paid", "pending", "overdue"):
        items = [i for i in items if compute_status(i) == status]

    total = len(items)
    return items[offset:offset + limit], total


async def stats_by_market(db: AsyncSession, market_id: int | None = None) -> dict:
    """Umumiy statistika: jami, to'langan, kutilayotgan, muddati o'tgan summalar."""
    stmt = select(Invoice)
    if market_id is not None:
        stmt = stmt.where(Invoice.market_id == market_id)
    rows = await db.execute(stmt)
    items = list(rows.scalars())
    today = datetime.now(timezone.utc).date()

    total_amount = Decimal("0")
    paid_amount = Decimal("0")
    overdue_amount = Decimal("0")
    pending_amount = Decimal("0")
    counts = {"paid": 0, "pending": 0, "overdue": 0}
    for i in items:
        total_amount += i.amount
        st = compute_status(i, today)
        counts[st] += 1
        if st == "paid":
            paid_amount += i.amount
        elif st == "overdue":
            overdue_amount += i.amount
        else:
            pending_amount += i.amount

    return {
        "count": len(items),
        "counts": counts,
        "total_amount": float(total_amount),
        "paid_amount": float(paid_amount),
        "pending_amount": float(pending_amount),
        "overdue_amount": float(overdue_amount),
    }
