"""Auth endpointlari — /api/auth/login, /logout, /me."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.deps import ACCESS_COOKIE_NAME, CurrentUser
from app.schemas.auth import LoginRequest, TokenResponse, UserOut
from app.services.auth_service import authenticate_user
from app.utils.security import create_access_token

router = APIRouter()


def _set_auth_cookie(response: Response, token: str) -> None:
    """JWT'ni httpOnly cookie sifatida o'rnatadi."""
    samesite = settings.COOKIE_SAMESITE
    # SameSite=None bo'lsa brauzer Secure talab qiladi
    secure = settings.is_production or samesite == "none"
    response.set_cookie(
        key=ACCESS_COOKIE_NAME,
        value=token,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        httponly=True,
        samesite=samesite,
        secure=secure,
        path="/",
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    payload: LoginRequest,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    """Login — to'g'ri bo'lsa httpOnly cookie o'rnatadi va token qaytaradi."""
    user = await authenticate_user(db, payload.username, payload.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Login yoki parol noto'g'ri",
        )

    # Tex-podderjka uchun to'lov qilinmagani sababli bloklangan bozor
    if user.market_id is not None:
        from app.models.market import Market

        m = await db.get(Market, user.market_id)
        if m is not None and m.support_blocked and not user.is_owner:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="To'lov qilinmagani sababli vaqtincha o'chirildi, tizim administratoriga aloqaga chiqing",
            )

    token = create_access_token(subject=user.id, extra_claims={"role": user.role})
    _set_auth_cookie(response, token)

    user_out = await _user_out_with_market(db, user)
    return TokenResponse(access_token=token, user=user_out)


async def _user_out_with_market(db: AsyncSession, user) -> UserOut:
    """UserOut yaratadi va market_slug ni to'ldiradi (auto-routing uchun)."""
    out = UserOut.model_validate(user)
    if user.market_id is not None:
        from app.models.market import Market

        m = await db.get(Market, user.market_id)
        if m is not None:
            out.market_slug = m.slug
    return out


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response) -> None:
    """Logout — auth cookie'ni o'chiradi."""
    response.delete_cookie(key=ACCESS_COOKIE_NAME, path="/")


@router.get("/me", response_model=UserOut)
async def me(
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserOut:
    """Joriy foydalanuvchi ma'lumotlari."""
    return await _user_out_with_market(db, user)
