"""FastAPI dependency'lar — autentifikatsiya va avtorizatsiya."""
from typing import Annotated

from fastapi import Cookie, Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.services.auth_service import get_user_by_id
from app.utils.security import decode_token

# Cookie nomi — login endpointda ham shu ishlatiladi.
ACCESS_COOKIE_NAME = "access_token"

_CREDENTIALS_EXC = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Autentifikatsiya talab qilinadi",
    headers={"WWW-Authenticate": "Bearer"},
)


def _extract_token(
    cookie_token: str | None,
    authorization: str | None,
) -> str | None:
    """Tokenni avval cookie'dan, bo'lmasa Authorization header'dan oladi."""
    if cookie_token:
        return cookie_token
    if authorization and authorization.lower().startswith("bearer "):
        return authorization[7:].strip()
    return None


async def get_current_user(
    db: Annotated[AsyncSession, Depends(get_db)],
    access_token: Annotated[str | None, Cookie(alias=ACCESS_COOKIE_NAME)] = None,
    authorization: Annotated[str | None, Header()] = None,
) -> User:
    """Joriy foydalanuvchini token (cookie yoki Bearer) orqali aniqlaydi."""
    token = _extract_token(access_token, authorization)
    if not token:
        raise _CREDENTIALS_EXC

    payload = decode_token(token)
    if payload is None:
        raise _CREDENTIALS_EXC

    sub = payload.get("sub")
    if sub is None:
        raise _CREDENTIALS_EXC

    try:
        user_id = int(sub)
    except (TypeError, ValueError):
        raise _CREDENTIALS_EXC from None

    user = await get_user_by_id(db, user_id)
    if user is None or not user.is_active:
        raise _CREDENTIALS_EXC

    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


async def require_admin(user: CurrentUser) -> User:
    """Boshqaruv huquqi (super_admin, market_admin yoki eski admin)."""
    if not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu amal uchun admin huquqi kerak",
        )
    return user


AdminUser = Annotated[User, Depends(require_admin)]


async def require_super_admin(user: CurrentUser) -> User:
    """Faqat super_admin (hamma bozor / super dashboard)."""
    if not user.is_super_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu amal uchun super admin huquqi kerak",
        )
    return user


SuperAdminUser = Annotated[User, Depends(require_super_admin)]


async def require_owner(user: CurrentUser) -> User:
    """Faqat dastur egasi (owner) — bozorlar CRUD va tex-podderjka."""
    if not user.is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu amal uchun dastur egasi (owner) huquqi kerak",
        )
    return user


OwnerUser = Annotated[User, Depends(require_owner)]


# === Multi-bozor: market resolver ===
async def get_current_market(
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    market: str | None = None,
) -> "Market":
    """So'rovdagi bozorni aniqlaydi va kirish huquqini tekshiradi.

    - super_admin: istalgan ?market=<slug> ni ko'radi (default orikzor)
    - market_admin/viewer: faqat o'ziga biriktirilgan bozor (?market e'tiborsiz)
    """
    from sqlalchemy import select

    from app.models.market import Market as MarketModel

    # Super bo'lmagan foydalanuvchi — faqat o'z bozori
    if not user.is_super_admin and user.market_id is not None:
        m = await db.get(MarketModel, user.market_id)
        if m is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Sizning bozoringiz topilmadi",
            )
        return m

    # Super admin yoki market_id biriktirilmagan — slug bo'yicha (default orikzor)
    slug = market or "orikzor"
    result = await db.execute(select(MarketModel).where(MarketModel.slug == slug))
    m = result.scalar_one_or_none()
    if m is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Bozor topilmadi: {slug}",
        )
    return m


# Type alias (import oxirida — sirkular importdan qochish uchun)
from app.models.market import Market  # noqa: E402

CurrentMarket = Annotated[Market, Depends(get_current_market)]
