"""Pavilion model — xaritadagi polygonlar."""
from sqlalchemy import Boolean, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Pavilion(Base):
    __tablename__ = "pavilions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    market_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("markets.id", ondelete="CASCADE"),
        default=1, nullable=False, index=True,
    )
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    display_text: Mapped[str | None] = mapped_column(String(10), nullable=True)
    pavilion_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    polygon_points: Mapped[str | None] = mapped_column(Text, nullable=True)
    fill_color: Mapped[str] = mapped_column(String(20), default="#d4a373")
    fill_opacity: Mapped[float] = mapped_column(Float, default=0.45)
    stroke_color: Mapped[str] = mapped_column(String(20), default="#b45309")
    stroke_width: Mapped[float] = mapped_column(Float, default=3)
    label_x: Mapped[float | None] = mapped_column(Float, nullable=True)
    label_y: Mapped[float | None] = mapped_column(Float, nullable=True)
    label_rotation: Mapped[float] = mapped_column(Float, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    meta: Mapped[dict] = mapped_column("metadata", JSONB, default=dict, nullable=False)

    shops: Mapped[list["Shop"]] = relationship(  # noqa: F821
        back_populates="pavilion",
    )

    def __repr__(self) -> str:
        return f"<Pavilion {self.id} {self.display_name!r}>"
