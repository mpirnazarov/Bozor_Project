"""MonthlyBalance model — oylik balanslar (asosiy billing manbai)."""
from datetime import datetime
from decimal import Decimal
from enum import Enum

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class BillingCategory(str, Enum):
    RENT = "rent"
    ELECTRICITY = "electricity"
    WATER = "water"


# Eski SQLite'dagi ruscha 'type' qiymatlarini yangi kategoriyaga map qiladi.
RU_TYPE_TO_CATEGORY: dict[str, str] = {
    "Аренда": BillingCategory.RENT.value,
    "Электроэнергия": BillingCategory.ELECTRICITY.value,
    "Вода": BillingCategory.WATER.value,
}


class MonthlyBalance(Base):
    __tablename__ = "monthly_balances"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    inn: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    market_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("markets.id", ondelete="CASCADE"),
        default=1, nullable=False, index=True,
    )
    year: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    month: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    category: Mapped[str] = mapped_column(String(20), nullable=False)
    due_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0, nullable=False)
    paid_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0, nullable=False)
    account_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("inn", "year", "month", "category", name="uq_balance_period"),
        CheckConstraint("month BETWEEN 1 AND 12", name="ck_balance_month"),
        Index("ix_balances_period", "year", "month"),
        Index("ix_balances_inn_period", "inn", "year", "month"),
    )

    def __repr__(self) -> str:
        return f"<MonthlyBalance {self.inn} {self.year}-{self.month} {self.category}>"
