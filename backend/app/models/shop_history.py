"""ShopHistory — do'kon egalik tarixi.

Har safar shop.inn o'zgarganda (yangi egasi, yoki bo'sh qilinganda)
bir yozuv qo'shiladi.
"""
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ShopHistory(Base):
    __tablename__ = "shop_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    shop_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("shops.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    # Eski egasi (kim edi)
    old_inn: Mapped[str | None] = mapped_column(String(20), nullable=True)
    old_name: Mapped[str | None] = mapped_column(String(300), nullable=True)

    # Yangi egasi (kim bo'ldi); NULL = bo'sh qilindi
    new_inn: Mapped[str | None] = mapped_column(String(20), nullable=True)
    new_name: Mapped[str | None] = mapped_column(String(300), nullable=True)

    # O'zgarish sababi/manbai
    changed_by: Mapped[str | None] = mapped_column(String(100), nullable=True)  # username yoki "import"
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)             # "import", "manual", ...

    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True,
    )

    shop: Mapped["Shop"] = relationship(back_populates="history")  # noqa: F821

    def __repr__(self) -> str:
        return f"<ShopHistory shop_id={self.shop_id} {self.old_inn}->{self.new_inn}>"
