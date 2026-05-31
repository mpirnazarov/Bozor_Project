"""Market (bozor) modeli — multi-bozor arxitekturasi uchun.

Har bir bozor alohida xarita (jpg), regionlar, magazinlar va dashboard
summalariga ega. Barcha pavilion/shop/balance yozuvlari market_id orqali
o'z bozoriga bog'lanadi. Super dashboard barcha bozorlarni yig'adi.
"""
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Market(Base):
    __tablename__ = "markets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # URL-friendly identifikator (masalan "orikzor")
    slug: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    # Xarita foni rasmi (frontend public yo'li yoki to'liq URL)
    map_image: Mapped[str | None] = mapped_column(String(300), nullable=True)
    # SVG viewBox o'lchami (har bozor rasmiga mos)
    map_view_w: Mapped[int] = mapped_column(Integer, default=1568, nullable=False)
    map_view_h: Mapped[int] = mapped_column(Integer, default=1109, nullable=False)
    # Shu bozorning dashboard summalari (admin tahrirlaydi)
    dashboard_stats: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # Owner tomonidan to'lov qilinmagani uchun vaqtincha bloklangan
    support_blocked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
