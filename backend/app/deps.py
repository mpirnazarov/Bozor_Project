"""FastAPI dependency'lar — autentifikatsiya va avtorizatsiya."""
from typing import Annotated

from fastapi import Cookie, Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User, UserRole
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
    """Faqat admin rolidagi foydalanuvchilarga ruxsat beradi."""
    if user.role != UserRole.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu amal uchun admin huquqi kerak",
        )
    return user


AdminUser = Annotated[User, Depends(require_admin)]


# === Multi-bozor: market resolver ===
async def get_current_market(
    db: Annotated[AsyncSession, Depends(get_db)],
    market: str = "orikzor",
) -> "Market":
    """So'rovdagi ?market=<slug> bo'yicha bozorni aniqlaydi.

    Default 'orikzor' — shu sababli mavjud (bitta bozorli) so'rovlar
    o'zgarishsiz ishlaydi. Kelajakda har bozor o'z slug'i bilan chaqiriladi.
    """
    from sqlalchemy import select

    from app.models.market import Market as MarketModel

    result = await db.execute(
        select(MarketModel).where(MarketModel.slug == market)
    )
    m = result.scalar_one_or_none()
    if m is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Bozor topilmadi: {market}",
        )
    return m


# Type alias (import oxirida — sirkular importdan qochish uchun)
from app.models.market import Market  # noqa: E402

CurrentMarket = Annotated[Market, Depends(get_current_market)]
