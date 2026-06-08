"""InvoicePayment — invoice bo'yicha har bir (qisman) to'lov yozuvi.

Har safar to'lov kiritilganda yangi yozuv qo'shiladi. Invoice.paid_amount —
shu yozuvlar yig'indisi. Tarix ko'rsatish uchun ishlatiladi.
"""
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    DateTime, ForeignKey, Integer, Numeric, String, func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class InvoicePayment(Base):
    __tablename__ = "invoice_payments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    invoice_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)  # shu to'lov summasi
    note: Mapped[str | None] = mapped_column(String(300), nullable=True)
    created_by: Mapped[int | None] = mapped_column(Integer, nullable=True)  # owner user id
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
