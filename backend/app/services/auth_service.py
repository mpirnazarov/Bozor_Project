"""Auth biznes logikasi — foydalanuvchini topish, tekshirish, yaratish."""
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserRole
from app.utils.security import hash_password, verify_password


async def get_user_by_username(db: AsyncSession, username: str) -> User | None:
    """Username bo'yicha foydalanuvchini topadi."""
    result = await db.execute(select(User).where(User.username == username))
    return result.scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: int) -> User | None:
    """ID bo'yicha foydalanuvchini topadi."""
    return await db.get(User, user_id)


async def authenticate_user(
    db: AsyncSession, username: str, password: str
) -> User | None:
    """
    Login uchun: username + password tekshiradi.

    Muvaffaqiyatli bo'lsa User qaytaradi va last_login_at yangilanadi.
    Aks holda None (noto'g'ri parol, foydalanuvchi yo'q yoki nofaol).
    """
    user = await get_user_by_username(db, username)
    if user is None:
        # Timing attack'ni biroz kamaytirish uchun baribir hash tekshiramiz.
        verify_password(password, _DUMMY_HASH)
        return None
    if not user.is_active:
        return None
    if not verify_password(password, user.password_hash):
        return None

    user.last_login_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(user)
    return user


async def create_user(
    db: AsyncSession,
    username: str,
    password: str,
    role: str = UserRole.USER.value,
    full_name: str | None = None,
    email: str | None = None,
) -> User:
    """
    Yangi foydalanuvchi yaratadi.

    Agar username band bo'lsa ValueError ko'taradi.
    """
    existing = await get_user_by_username(db, username)
    if existing is not None:
        raise ValueError(f"Username '{username}' allaqachon mavjud")

    user = User(
        username=username,
        password_hash=hash_password(password),
        role=role,
        full_name=full_name,
        email=email,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


# Foydalanuvchi topilmaganda ham bcrypt verify chaqirib, javob vaqtini
# tenglashtirish uchun oldindan hisoblangan dummy hash.
_DUMMY_HASH = hash_password("dummy-password-for-timing-equalization")
