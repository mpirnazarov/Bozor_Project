"""BackupLog — DB backup urinishlari jurnali."""
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class BackupLog(Base):
    __tablename__ = "backup_logs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    # filename: backup faylining nomi (Volume'dagi)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    # trigger: "auto" (kunlik) | "manual" (tugma)
    trigger: Mapped[str] = mapped_column(String(20), nullable=False, default="manual")
    # status: "success" | "failed" | "running"
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="running")
    size_bytes: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
