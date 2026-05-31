"""Owner (dastur egasi) endpointlari — /api/owner.

- Bozorlar CRUD
- Yangi bozor yaratilganda admin username + parol generatsiya qilinadi
- Tex-podderjka to'lovlarini belgilash va ko'rish
- Bozor parolini o'zgartirish
- To'lov qilinmagani uchun bozorni bloklash/blokdan chiqarish
"""
import secrets
import string
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import OwnerUser
from app.models.market import Market
from app.models.shop import Shop
from app.models.user import User, UserRole
from app.services.support_service import (
    get_support_status, list_payments, mark_payment,
)
from app.utils.security import hash_password

router = APIRouter()


def _gen_password(n: int = 10) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(n))


def _slugify(name: str) -> str:
    base = "".join(c if c.isalnum() else "-" for c in name.lower()).strip("-")
    base = "-".join(filter(None, base.split("-")))
    return base or "bozor"


# ===== Schemas =====
class MarketCreateBody(BaseModel):
    name: str
    slug: str | None = None
    admin_username: str | None = None


class MarketEditBody(BaseModel):
    name: str | None = None
    is_active: bool | None = None
    display_order: int | None = None


class PaymentBody(BaseModel):
    year: int
    month: int
    is_paid: bool
    notes: str | None = None


class PasswordBody(BaseModel):
    new_password: str


class BlockBody(BaseModel):
    blocked: bool


# ===== Bozorlar ro'yxati (support holati bilan) =====
@router.get("/markets")
async def owner_list_markets(
    _owner: OwnerUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[dict]:
    rows = await db.execute(select(Market).order_by(Market.display_order, Market.id))
    markets = list(rows.scalars())
    out: list[dict] = []
    for m in markets:
        status_info = await get_support_status(db, m)
        shop_count = await db.scalar(
            select(func.count()).select_from(Shop).where(Shop.market_id == m.id)
        )
        admin = await db.scalar(
            select(User).where(User.market_id == m.id, User.role == UserRole.MARKET_ADMIN.value)
        )
        out.append({
            "id": m.id,
            "slug": m.slug,
            "name": m.name,
            "is_active": m.is_active,
            "support_blocked": m.support_blocked,
            "created_at": m.created_at.isoformat(),
            "shop_count": shop_count or 0,
            "admin_username": admin.username if admin else None,
            "support": status_info,
        })
    return out


# ===== Yangi bozor yaratish (username + parol qaytaradi) =====
@router.post("/markets", status_code=status.HTTP_201_CREATED)
async def owner_create_market(
    body: MarketCreateBody,
    _owner: OwnerUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    slug = (body.slug or _slugify(body.name)).strip()
    exists = await db.scalar(select(Market).where(Market.slug == slug))
    if exists:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"'{slug}' slug allaqachon mavjud")

    market = Market(slug=slug, name=body.name.strip(), is_active=True)
    db.add(market)
    await db.flush()  # market.id olish uchun

    # Admin foydalanuvchi yaratish
    username = (body.admin_username or slug).strip()
    u_exists = await db.scalar(select(User).where(User.username == username))
    if u_exists:
        username = f"{username}-{market.id}"
    password = _gen_password()
    admin_user = User(
        username=username,
        password_hash=hash_password(password),
        role=UserRole.MARKET_ADMIN.value,
        market_id=market.id,
        full_name=f"{body.name} admin",
        is_active=True,
    )
    db.add(admin_user)
    await db.commit()
    await db.refresh(market)

    return {
        "id": market.id,
        "slug": market.slug,
        "name": market.name,
        # Parol FAQAT shu javobda ko'rsatiladi — keyin saqlanmaydi (hash bo'ladi)
        "credentials": {"username": username, "password": password},
    }


# ===== Bozor tahrirlash =====
@router.put("/markets/{market_id}")
async def owner_update_market(
    market_id: int,
    body: MarketEditBody,
    _owner: OwnerUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    market = await db.get(Market, market_id)
    if market is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bozor topilmadi")
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(market, k, v)
    await db.commit()
    return {"ok": True}


# ===== Bozor o'chirish =====
@router.delete("/markets/{market_id}")
async def owner_delete_market(
    market_id: int,
    _owner: OwnerUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    market = await db.get(Market, market_id)
    if market is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bozor topilmadi")
    if market.slug == "orikzor":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Asosiy bozorni o'chirib bo'lmaydi")
    await db.delete(market)
    await db.commit()
    return {"ok": True}


# ===== Bozor parolini o'zgartirish =====
@router.put("/markets/{market_id}/password")
async def owner_change_password(
    market_id: int,
    body: PasswordBody,
    _owner: OwnerUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    admin = await db.scalar(
        select(User).where(User.market_id == market_id, User.role == UserRole.MARKET_ADMIN.value)
    )
    if admin is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bozor admini topilmadi")
    if len(body.new_password) < 6:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Parol kamida 6 belgi bo'lishi kerak")
    admin.password_hash = hash_password(body.new_password)
    await db.commit()
    return {"ok": True, "username": admin.username}


# ===== Tex-podderjka: to'lovni belgilash =====
@router.post("/markets/{market_id}/support/payment")
async def owner_mark_payment(
    market_id: int,
    body: PaymentBody,
    _owner: OwnerUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    market = await db.get(Market, market_id)
    if market is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bozor topilmadi")
    await mark_payment(db, market_id, body.year, body.month, body.is_paid, body.notes)
    await db.commit()
    return {"ok": True}


# ===== Tex-podderjka: to'lovlar tarixi =====
@router.get("/markets/{market_id}/support/payments")
async def owner_list_payments(
    market_id: int,
    _owner: OwnerUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[dict]:
    payments = await list_payments(db, market_id)
    return [
        {
            "year": p.year, "month": p.month,
            "amount": float(p.amount), "is_paid": p.is_paid,
            "paid_at": p.paid_at.isoformat() if p.paid_at else None,
            "notes": p.notes,
        }
        for p in payments
    ]


# ===== To'lov qilinmagani uchun bloklash / blokdan chiqarish =====
@router.post("/markets/{market_id}/support/block")
async def owner_block_market(
    market_id: int,
    body: BlockBody,
    _owner: OwnerUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    market = await db.get(Market, market_id)
    if market is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bozor topilmadi")
    market.support_blocked = body.blocked
    await db.commit()
    return {"ok": True, "support_blocked": market.support_blocked}
