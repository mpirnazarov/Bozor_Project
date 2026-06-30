"""ManagerPavilion — manager va pavilion orasidagi biriktirish (M2M)."""
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ManagerPavilion(Base):
    __tablename__ = "manager_pavilions"
    __table_args__ = (
        UniqueConstraint("manager_id", "pavilion_id", name="uq_manager_pavilion"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    manager_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    pavilion_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("pavilions.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )

    def __repr__(self) -> str:
        return f"<ManagerPavilion manager={self.manager_id} pavilion={self.pavilion_id}>"
