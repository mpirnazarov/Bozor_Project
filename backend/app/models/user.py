"""User model — server-side auth."""
from datetime import datetime
from enum import Enum

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class UserRole(str, Enum):
    # Eski rollar (orqaga moslik uchun saqlanadi)
    USER = "user"
    ADMIN = "admin"
    # Multi-bozor rollari
    OWNER = "owner"                  # dastur egasi — bozorlar CRUD + tex-podderjka to'lovlari
    SUPER_ADMIN = "super_admin"      # hamma bozor + super dashboard
    MARKET_ADMIN = "market_admin"    # faqat o'z bozori, to'liq boshqaruv
    MARKET_VIEWER = "market_viewer"  # faqat o'z bozori, ko'rish


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default=UserRole.USER.value)
    # Qaysi bozorga biriktirilgan (super_admin uchun NULL — hammaga ruxsat)
    market_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("markets.id", ondelete="SET NULL"), nullable=True, index=True
    )
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    def __repr__(self) -> str:
        return f"<User {self.username} ({self.role})>"

    @property
    def is_super_admin(self) -> bool:
        return self.role == UserRole.SUPER_ADMIN.value

    @property
    def is_owner(self) -> bool:
        """Dastur egasi — eng yuqori huquq (bozorlar CRUD, tex-podderjka)."""
        return self.role == UserRole.OWNER.value

    @property
    def is_admin(self) -> bool:
        """Bozor ma'lumotlarini tahrirlash huquqi (bozor admini yoki eski admin).

        DIQQAT: super_admin bu yerda YO'Q — u barcha bozorlarni faqat KO'RADI,
        tahrir qila olmaydi. Super dashboard uchun alohida require_super_admin bor.
        """
        return self.role in (
            UserRole.ADMIN.value,
            UserRole.MARKET_ADMIN.value,
        )
