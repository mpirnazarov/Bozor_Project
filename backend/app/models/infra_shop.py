"""Infra do'konlar — INN siz, to'g'ridan billing."""
from datetime import datetime
from decimal import Decimal
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class InfraShop(Base):
    __tablename__ = "infra_shops"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    market_id: Mapped[int] = mapped_column(Integer, ForeignKey("markets.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    contract_no: Mapped[str | None] = mapped_column(String(150), nullable=True)
    contract_date: Mapped[str | None] = mapped_column(String(20), nullable=True)
    monthly_rent: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    water_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    billings: Mapped[list["InfraBilling"]] = relationship("InfraBilling", back_populates="shop", cascade="all, delete-orphan")


class InfraBilling(Base):
    __tablename__ = "infra_billing"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    shop_id: Mapped[int] = mapped_column(Integer, ForeignKey("infra_shops.id", ondelete="CASCADE"), nullable=False, index=True)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    category: Mapped[str] = mapped_column(String(20), nullable=False)  # rent, electricity, water
    due_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    paid_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    water_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    shop: Mapped["InfraShop"] = relationship("InfraShop", back_populates="billings")

    __table_args__ = (
        __import__('sqlalchemy').UniqueConstraint("shop_id", "year", "month", "category", name="uq_infra_billing"),
    )
