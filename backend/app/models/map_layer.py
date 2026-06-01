"""MapLayer — bozorning bir nechta xaritasi (qavat/podval).

Har bozorda bir nechta xarita bo'lishi mumkin (1-etaj, 2-etaj, podval...).
Har xaritaning o'z rasmi (DB'da base64 saqlanadi — Railway FS ephemeral)
va o'z regionlari (pavilion.map_layer_id orqali) bor.
"""
from datetime import datetime

from sqlalchemy import (
    Boolean, DateTime, ForeignKey, Integer, String, Text, func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class MapLayer(Base):
    __tablename__ = "map_layers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    market_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("markets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)  # "1-etaj", "Podval"
    # Rasm base64 (data URI yoki sof base64). Katta bo'lishi mumkin — Text.
    image_data: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_mime: Mapped[str | None] = mapped_column(String(50), nullable=True)
    view_w: Mapped[int] = mapped_column(Integer, default=1568, nullable=False)
    view_h: Mapped[int] = mapped_column(Integer, default=1109, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
