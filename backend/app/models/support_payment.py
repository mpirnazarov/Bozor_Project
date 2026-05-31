"""Tex-podderjka (texnik qo'llab-quvvatlash) oylik to'lovlari.

Har bozor uchun: yaratilgandan keyin 3 oy tekin, keyin oyiga 2.4 mln so'm.
Owner qo'lda har oy uchun "to'landi" deb belgilaydi.
"""
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean, DateTime, ForeignKey, Integer, Numeric, SmallInteger, String,
    UniqueConstraint, func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base

# Oylik tex-podderjka narxi (so'm)
SUPPORT_MONTHLY_FEE = Decimal("2400000")
# Tekin davr (oy)
SUPPORT_FREE_MONTHS = 3
# Oyning shu sanasigacha to'lanmasa — ogohlantirish
SUPPORT_DUE_DAY = 6


class SupportPayment(Base):
    __tablename__ = "support_payments"
    __table_args__ = (
        UniqueConstraint("market_id", "year", "month", name="uq_support_market_period"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    market_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("markets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    year: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    month: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=SUPPORT_MONTHLY_FEE, nullable=False)
    is_paid: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(300), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
