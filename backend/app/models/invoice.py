"""Invoice (schyot) — owner bozorga qo'yadigan qo'shimcha to'lov.

Owner yaratadi: summa, sabab, deadline, ixtiyoriy hujjat (base64, DB'da).
Faqat owner to'lov holatini boshqaradi. Market admin faqat ko'radi.
Holat ranglari hisoblanadi: paid(yashil) / pending(sariq) / overdue(qizil).
"""
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Invoice(Base):
    __tablename__ = "invoices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    market_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("markets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # kind: "support" (avtomatik tex-podderjka) | "extra" (qo'shimcha, bir martalik)
    kind: Mapped[str] = mapped_column(String(20), default="extra", nullable=False)
    # payment_method: "cash" (naqd) | "contract" (dogovor) — extra invoicelar uchun
    payment_method: Mapped[str | None] = mapped_column(String(20), nullable=True)
    # Dogovor raqami (support: bozor shartnomasi; extra: agar dogovor tanlansa)
    contract_no: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # To'lov ma'lumotlari
    title: Mapped[str] = mapped_column(String(200), nullable=False)        # nima uchun (qisqa)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)   # batafsil izoh
    amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(8), default="UZS", nullable=False)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)     # deadline

    # To'lov holati (faqat owner boshqaradi)
    is_paid: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    paid_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0, nullable=False)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    paid_note: Mapped[str | None] = mapped_column(String(300), nullable=True)

    # Ixtiyoriy hujjat (base64, DB'da — Railway FS ephemeral)
    doc_data: Mapped[str | None] = mapped_column(Text, nullable=True)
    doc_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    doc_mime: Mapped[str | None] = mapped_column(String(100), nullable=True)

    created_by: Mapped[int | None] = mapped_column(Integer, nullable=True)  # owner user id
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
