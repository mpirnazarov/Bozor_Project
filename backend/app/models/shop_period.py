"""ShopPeriod — magazinning DAVR bo'yicha holati (ega va ijara narxi).

`shops` jadvali BUGUNGI holatni saqlaydi. Egasi yoki narxi o'zgarsa, eski
qiymat yo'qoladi va o'tgan oylar hisoboti ham o'zgarib ketardi.

Bu jadval har bir o'zgarishni alohida DAVR sifatida saqlaydi:

    shop_id | inn       | monthly_rent | valid_from | valid_to
    --------+-----------+--------------+------------+-----------
    01-1-1-003 | 306284022 | 5 000 567 | 2000-01-01 | 2026-09-11
    01-1-1-003 | 313043635 | 5 400 000 | 2026-09-12 | NULL      <- amaldagi

Muayyan sanadagi holat = `valid_from <= sana AND (valid_to IS NULL OR
sana <= valid_to)` shartiga mos yozuv. Shu sababli o'tgan oy hisoboti
keyingi o'zgarishlardan himoyalanadi.

Migratsiya paytida hozirgi holat bitta "boshlang'ich" davr sifatida
ko'chiriladi (valid_from = 2000-01-01), shuning uchun mavjud hisobotlar
aynan avvalgidek qoladi.
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
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ShopPeriod(Base):
    __tablename__ = "shop_periods"
    __table_args__ = (
        # Sana bo'yicha qidiruv uchun asosiy indeks
        Index("ix_shop_periods_lookup", "market_id", "shop_id", "valid_from"),
        Index("ix_shop_periods_open", "market_id", "valid_to"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    market_id: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    shop_id: Mapped[str] = mapped_column(String(64), nullable=False)

    inn: Mapped[str | None] = mapped_column(String(20), nullable=True)
    counterparty_name: Mapped[str | None] = mapped_column(String(512), nullable=True)
    monthly_rent: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)

    valid_from: Mapped[date] = mapped_column(Date, nullable=False)
    # NULL = hozir amal qilmoqda (ochiq davr)
    valid_to: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Nima sababdan o'zgardi: "import: egalar 07.07.xlsx", "qo'lda" va h.k.
    source: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    def __repr__(self) -> str:
        return (
            f"<ShopPeriod {self.shop_id} {self.valid_from}..{self.valid_to or '...'} "
            f"inn={self.inn} rent={self.monthly_rent}>"
        )
