"""ImportLog — billing import urinishlari (fayl + xatolar)."""
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Integer, SmallInteger, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ImportLog(Base):
    __tablename__ = "import_logs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    market_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    year: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    month: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False)  # success | failed
    rows_read: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    records: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    counterparties: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    errors: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    # Yuklangan faylning o'zi (base64) — xatoli bo'lsa yuklab olish uchun
    file_data: Mapped[str | None] = mapped_column(Text, nullable=True)
    file_mime: Mapped[str | None] = mapped_column(String(100), nullable=True)
    audit_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
