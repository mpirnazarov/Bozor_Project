"""Counterparty (kontragent) model."""
from datetime import date, datetime

from sqlalchemy import Date, DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Counterparty(Base):
    __tablename__ = "counterparties"

    inn: Mapped[str] = mapped_column(String(20), primary_key=True)
    name: Mapped[str] = mapped_column(String(500), nullable=False)
    contract_no: Mapped[str | None] = mapped_column(String(100), nullable=True)
    contract_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    bank_account: Mapped[str | None] = mapped_column(String(50), nullable=True)
    place_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    purpose: Mapped[str | None] = mapped_column(String(200), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    shops: Mapped[list["Shop"]] = relationship(  # noqa: F821
        back_populates="counterparty",
        cascade="save-update",
    )

    def __repr__(self) -> str:
        return f"<Counterparty {self.inn} {self.name[:30]!r}>"
