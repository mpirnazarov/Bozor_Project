"""RentBilling — sana bo'yicha magazin arenda billing.

Har yozuv: muayyan sanada (bill_date) bir magazin uchun oylik summa,
qarz va to'langan. monthly_balances (INN+oy+kategoriya) dan farqli ravishda
bu jadval MAGAZIN ID va aniq SANA bo'yicha arenda holatini saqlaydi.
"""
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Date,
    DateTime,
    Index,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class RentBilling(Base):
    __tablename__ = "rent_billing"
    __table_args__ = (
        UniqueConstraint("market_id", "shop_id", "bill_date", name="uq_rent_billing_key"),
        Index("ix_rent_billing_date", "market_id", "bill_date"),
        Index("ix_rent_billing_shop", "shop_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    market_id: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    shop_id: Mapped[str] = mapped_column(String(64), nullable=False)
    bill_date: Mapped[date] = mapped_column(Date, nullable=False)

    inn: Mapped[str | None] = mapped_column(String(20), nullable=True)
    counterparty_name: Mapped[str | None] = mapped_column(String(512), nullable=True)
    contract_no: Mapped[str | None] = mapped_column(String(128), nullable=True)

    monthly_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    debt: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    paid: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    def __repr__(self) -> str:
        return f"<RentBilling {self.shop_id} {self.bill_date} debt={self.debt}>"
