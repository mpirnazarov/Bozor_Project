"""Setting model — umumiy sozlamalar (JSONB value)."""
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Setting(Base):
    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[dict | list | str | int | float | bool | None] = mapped_column(
        JSONB, nullable=False
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    def __repr__(self) -> str:
        return f"<Setting {self.key!r}>"


# Dashboard sozlamasi shu kalit ostida bitta JSON sifatida saqlanadi.
# Admin shu qiymatlarni alohida tahrirlaydi, main page shu yerdan o'qiydi.
DASHBOARD_SETTINGS_KEY = "dashboard_stats"

# Ilova mavzusi (light/dark) shu kalit ostida saqlanadi. Admin o'zgartiradi,
# barcha foydalanuvchilar shu mavzuni ko'radi.
THEME_SETTINGS_KEY = "app_theme"

# Topilmagan (bazada balansi yo'q) magazinlarni berkitish. Admin yoqsa,
# region modalida no_data magazinlar va "Topilmadi" filtri ko'rinmaydi.
HIDE_UNMATCHED_KEY = "hide_unmatched"
