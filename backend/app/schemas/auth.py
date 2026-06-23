"""Auth bilan bog'liq Pydantic schemas (v2)."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class LoginRequest(BaseModel):
    """Login so'rovi tanasi."""

    username: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=1, max_length=255)


class UserOut(BaseModel):
    """Foydalanuvchi haqida xavfsiz ma'lumot — password_hash hech qachon chiqmaydi."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    role: str
    market_id: int | None = None
    market_slug: str | None = None  # login javobida to'ldiriladi (auto-routing uchun)
    market_name: str | None = None  # bozor nomi — frontend sarlavha uchun
    full_name: str | None = None
    email: str | None = None
    is_active: bool
    last_login_at: datetime | None = None


class TokenResponse(BaseModel):
    """Login muvaffaqiyatli bo'lganda qaytariladigan javob."""

    access_token: str
    token_type: str = "bearer"
    user: UserOut
