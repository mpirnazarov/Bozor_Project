"""Shop (magazin) model."""
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Shop(Base):
    __tablename__ = "shops"
    __table_args__ = (
        # shop_id endi BUTUN db bo'yicha emas, har BOZOR ichida noyob.
        # Shunda turli bozorlar bir xil shop_id (04-1-1-001) ishlatishi mumkin.
        UniqueConstraint("market_id", "shop_id", name="uq_shop_market_shopid"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    shop_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    market_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("markets.id", ondelete="CASCADE"),
        default=1, nullable=False, index=True,
    )
    pavilion_code: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    pavilion_id: Mapped[int | None] = mapped_column(
        ForeignKey("pavilions.id", ondelete="SET NULL"), nullable=True
    )
    inn: Mapped[str | None] = mapped_column(
        ForeignKey("counterparties.inn", ondelete="SET NULL"), nullable=True, index=True
    )
    shop_type: Mapped[str | None] = mapped_column(String(200), nullable=True)
    purpose: Mapped[str | None] = mapped_column(Text, nullable=True)
    monthly_rent: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0, nullable=False)
    source_sheet: Mapped[str | None] = mapped_column(String(100), nullable=True)
    area: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
    is_vacant: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    counterparty: Mapped["Counterparty | None"] = relationship(  # noqa: F821
        back_populates="shops"
    )
    pavilion: Mapped["Pavilion | None"] = relationship(back_populates="shops")  # noqa: F821

    def __repr__(self) -> str:
        return f"<Shop {self.shop_id}>"
