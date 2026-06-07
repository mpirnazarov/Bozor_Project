"""ChangeSnapshot — amalni ortga qaytarish uchun yozuvlarning oldingi holati."""
from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ChangeSnapshot(Base):
    __tablename__ = "change_snapshots"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    audit_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True, index=True)
    user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    market_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    table_name: Mapped[str] = mapped_column(String(50), nullable=False)
    # before_rows: [{"key": {...}, "before": {...} | None}, ...]
    #   before=None => yozuv amal paytida YANGI yaratilgan (revert => o'chiriladi)
    before_rows: Mapped[list] = mapped_column(JSONB, nullable=False)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    reverted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    reverted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
