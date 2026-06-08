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
from app.models.invoice_payment import InvoicePayment
from app.models.market import Market


def compute_status(inv: Invoice, today: date | None = None) -> str:
    """Schyot holatini rang sifatida qaytaradi: paid | pending | overdue."""
    paid_amt = inv.paid_amount or 0
    if inv.is_paid or (paid_amt >= inv.amount and inv.amount > 0):
        return "paid"
    today = today or datetime.now(timezone.utc).date()
    if inv.due_date is not None and inv.due_date < today:
        return "overdue"
    if paid_amt and paid_amt > 0:
        return "partial"
    return "pending"


def remaining(inv: Invoice) -> float:
    """Qolgan to'lov summasi."""
    rem = float(inv.amount) - float(inv.paid_amount or 0)
    return rem if rem > 0 else 0.0


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
    kind: str = "extra",
    payment_method: str | None = None,
    contract_no: str | None = None,
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
        kind=kind or "extra",
        payment_method=payment_method,
        contract_no=contract_no,
        doc_data=doc_data,
        doc_name=doc_name,
        doc_mime=doc_mime,
        created_by=created_by,
    )
    db.add(inv)
    await db.commit()
    await db.refresh(inv)
    return inv


async def _recompute_paid(db: AsyncSession, inv: Invoice) -> None:
    """invoice_payments yig'indisidan paid_amount va is_paid ni qayta hisoblaydi."""
    total = await db.scalar(
        select(func.coalesce(func.sum(InvoicePayment.amount), 0)).where(
            InvoicePayment.invoice_id == inv.id
        )
    )
    paid = Decimal(str(total or 0))
    inv.paid_amount = paid
    fully = inv.amount > 0 and paid >= inv.amount
    inv.is_paid = bool(fully)
    if fully and inv.paid_at is None:
        inv.paid_at = datetime.now(timezone.utc)
    if not fully:
        inv.paid_at = None


async def add_payment(
    db: AsyncSession, inv: Invoice, amount: Decimal, note: str | None = None,
    created_by: int | None = None,
) -> Invoice:
    """Yangi (qisman) to'lov qo'shadi — yig'ib boradi. Tarixga yoziladi."""
    if amount <= 0:
        return inv
    pay = InvoicePayment(invoice_id=inv.id, amount=amount, note=note, created_by=created_by)
    db.add(pay)
    await db.flush()
    await _recompute_paid(db, inv)
    if note:
        inv.paid_note = note
    await db.commit()
    await db.refresh(inv)
    return inv


async def set_paid(db: AsyncSession, inv: Invoice, is_paid: bool, note: str | None = None,
                   created_by: int | None = None) -> Invoice:
    """To'liq to'landi/to'lanmadi (tugma).

    - is_paid=True: qolgan summani bitta to'lov sifatida qo'shadi (to'liq bo'ladi).
    - is_paid=False: barcha to'lov yozuvlarini o'chiradi (boshiga qaytadi).
    """
    if is_paid:
        remaining_amt = inv.amount - (inv.paid_amount or Decimal("0"))
        if remaining_amt > 0:
            pay = InvoicePayment(
                invoice_id=inv.id, amount=remaining_amt,
                note=note or "To'liq to'landi", created_by=created_by,
            )
            db.add(pay)
            await db.flush()
    else:
        # Hamma to'lov yozuvlarini o'chiramiz
        from sqlalchemy import delete
        await db.execute(delete(InvoicePayment).where(InvoicePayment.invoice_id == inv.id))
        await db.flush()
        inv.paid_note = None
    await _recompute_paid(db, inv)
    if note is not None:
        inv.paid_note = note
    await db.commit()
    await db.refresh(inv)
    return inv


async def set_paid_amount(db: AsyncSession, inv: Invoice, target_total: Decimal,
                          note: str | None = None, created_by: int | None = None) -> Invoice:
    """Jami to'langan summani BERILGAN qiymatga keltiradi (delta qo'shadi/o'chiradi).

    Hozirgi yig'indidan farqni yangi to'lov sifatida qo'shadi. Agar kamaytirilsa —
    oxirgi yozuvlarni teskari yozuv bilan to'g'irlaydi.
    """
    if target_total < 0:
        target_total = Decimal("0")
    if target_total > inv.amount:
        target_total = inv.amount
    current = inv.paid_amount or Decimal("0")
    delta = target_total - current
    if delta != 0:
        pay = InvoicePayment(
            invoice_id=inv.id, amount=delta,
            note=note or ("To'lov" if delta > 0 else "To'lov tuzatildi"),
            created_by=created_by,
        )
        db.add(pay)
        await db.flush()
    await _recompute_paid(db, inv)
    if note is not None:
        inv.paid_note = note
    await db.commit()
    await db.refresh(inv)
    return inv


async def list_payments(db: AsyncSession, invoice_id: int) -> list[InvoicePayment]:
    """Invoice bo'yicha to'lovlar tarixi (eng yangi birinchi)."""
    rows = await db.execute(
        select(InvoicePayment).where(InvoicePayment.invoice_id == invoice_id)
        .order_by(InvoicePayment.created_at.desc())
    )
    return list(rows.scalars())


# ===== Avtomatik tex-podderjka invoice (kind="support") =====

async def ensure_support_invoice(
    db: AsyncSession, market: Market, year: int, month: int,
    amount: Decimal, due_day: int = 5,
) -> Invoice | None:
    """Bozor uchun shu oyga tex-podderjka invoice yaratadi (agar yo'q bo'lsa).

    Bozorning dogovori va dogovor raqami biriktiriladi. Takror yaratmaydi.
    """
    from calendar import month_name
    # Shu oy uchun support invoice bormi?
    period_title = f"Tex-podderjka — {month:02d}.{year}"
    existing = await db.scalar(
        select(Invoice).where(
            Invoice.market_id == market.id,
            Invoice.kind == "support",
            Invoice.title == period_title,
        )
    )
    if existing is not None:
        return None  # allaqachon bor

    due = date(year, month, min(due_day, 28))
    inv = Invoice(
        market_id=market.id,
        kind="support",
        payment_method="contract",
        contract_no=market.contract_no,
        title=period_title,
        description=f"{month:02d}.{year} oyi uchun texnik qo'llab-quvvatlash to'lovi",
        amount=amount,
        currency="UZS",
        due_date=due,
        # Bozor dogovori faylini biriktiramiz (agar bor bo'lsa)
        doc_data=market.contract_data,
        doc_name=market.contract_name,
        doc_mime=market.contract_mime,
    )
    db.add(inv)
    await db.commit()
    await db.refresh(inv)
    return inv


async def generate_support_invoices(db: AsyncSession, today: date | None = None) -> int:
    """Tekin davri tugagan barcha bozorlar uchun joriy oyga tex-podderjka invoice yaratadi.

    Takrorlamaydi. Yaratilgan invoicelar sonini qaytaradi.
    """
    from app.services.support_service import is_in_free_period
    from app.models.support_payment import SUPPORT_MONTHLY_FEE, SUPPORT_DUE_DAY

    today = today or datetime.now(timezone.utc).date()
    rows = await db.execute(select(Market).where(Market.is_active == True))  # noqa: E712
    markets = list(rows.scalars())
    created = 0
    for m in markets:
        if is_in_free_period(m, today):
            continue  # hali tekin davrda
        inv = await ensure_support_invoice(
            db, m, today.year, today.month, SUPPORT_MONTHLY_FEE, SUPPORT_DUE_DAY,
        )
        if inv is not None:
            created += 1
    return created


async def update_invoice(db: AsyncSession, inv: Invoice, **fields) -> Invoice:
    """Schyotni tahrirlash (title, amount, description, due_date, currency, doc_*)."""
    allowed = {
        "title", "amount", "description", "currency", "due_date",
        "doc_data", "doc_name", "doc_mime",
    }
    for key, val in fields.items():
        if key in allowed and val is not None:
            setattr(inv, key, val)
    await db.flush()
    # Summa o'zgargan bo'lishi mumkin — to'lov yozuvlaridan qayta hisoblaymiz
    await _recompute_paid(db, inv)
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
    if status in ("paid", "partial", "pending", "overdue"):
        items = [i for i in items if compute_status(i) == status]

    total = len(items)
    return items[offset:offset + limit], total


async def stats_by_market(db: AsyncSession, market_id: int | None = None) -> dict:
    """Umumiy statistika: jami, to'langan, kutilayotgan, muddati o'tgan summalar.

    paid_amount — haqiqatda to'langan summa (qisman to'lovlar ham qo'shiladi).
    """
    stmt = select(Invoice)
    if market_id is not None:
        stmt = stmt.where(Invoice.market_id == market_id)
    rows = await db.execute(stmt)
    items = list(rows.scalars())
    today = datetime.now(timezone.utc).date()

    total_amount = Decimal("0")
    paid_amount = Decimal("0")       # haqiqatda yig'ilgan (qisman ham)
    outstanding_amount = Decimal("0")  # qolgan (to'lanmagan) jami
    overdue_amount = Decimal("0")
    pending_amount = Decimal("0")
    counts = {"paid": 0, "partial": 0, "pending": 0, "overdue": 0}
    for i in items:
        total_amount += i.amount
        pa = i.paid_amount or Decimal("0")
        paid_amount += pa
        rem = i.amount - pa
        if rem < 0:
            rem = Decimal("0")
        st = compute_status(i, today)
        counts[st] += 1
        if st == "overdue":
            overdue_amount += rem
        elif st in ("pending", "partial"):
            pending_amount += rem
        outstanding_amount += rem

    return {
        "count": len(items),
        "counts": counts,
        "total_amount": float(total_amount),
        "paid_amount": float(paid_amount),
        "pending_amount": float(pending_amount),
        "overdue_amount": float(overdue_amount),
        "outstanding_amount": float(outstanding_amount),
    }
