"""Xojatxonalar — kunlik tushum."""
from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Toilet(Base):
    __tablename__ = "toilets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    market_id: Mapped[int] = mapped_column(Integer, ForeignKey("markets.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    revenues: Mapped[list["ToiletRevenue"]] = relationship("ToiletRevenue", back_populates="toilet", cascade="all, delete-orphan")


class ToiletRevenue(Base):
    __tablename__ = "toilet_revenues"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    toilet_id: Mapped[int] = mapped_column(Integer, ForeignKey("toilets.id", ondelete="CASCADE"), nullable=False, index=True)
    revenue_date: Mapped[date] = mapped_column(Date, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    toilet: Mapped["Toilet"] = relationship("Toilet", back_populates="revenues")

    __table_args__ = (
        __import__('sqlalchemy').UniqueConstraint("toilet_id", "revenue_date", name="uq_toilet_revenue_date"),
    )
