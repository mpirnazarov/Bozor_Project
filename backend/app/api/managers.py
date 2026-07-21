from __future__ import annotations
import secrets, string
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, delete as sa_delete
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.deps import AdminUser, CurrentMarket
from app.models import ManagerPavilion, Pavilion, User
from app.models.user import UserRole
from app.utils.security import hash_password

router = APIRouter()

def _gen_password(length: int = 8) -> str:
    return "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(length))

class ManagerOut(BaseModel):
    id: int; username: str; full_name: str | None; is_active: bool; pavilion_count: int; created_at: str | None = None

class ManagerCreateIn(BaseModel):
    full_name: str

class ManagerCreateOut(BaseModel):
    id: int; username: str; password: str

class PasswordIn(BaseModel):
    new_password: str

class PavilionAssignIn(BaseModel):
    pavilion_ids: list[int]

class PavilionMiniOut(BaseModel):
    id: int; display_name: str; pavilion_type: str | None; map_layer_id: int | None; assigned: bool

@router.get("", response_model=list[ManagerOut])
async def list_managers(_admin: AdminUser, market: CurrentMarket, db: Annotated[AsyncSession, Depends(get_db)]) -> list[ManagerOut]:
    from sqlalchemy import func as _func
    rows = (await db.execute(select(User).where(User.market_id == market.id, User.role == UserRole.MANAGER.value).order_by(User.created_at.desc()))).scalars().all()
    out = []
    for u in rows:
        pcount = await db.scalar(select(_func.count(ManagerPavilion.id)).where(ManagerPavilion.manager_id == u.id))
        out.append(ManagerOut(id=u.id, username=u.username, full_name=u.full_name, is_active=u.is_active, pavilion_count=int(pcount or 0), created_at=u.created_at.isoformat() if u.created_at else None))
    return out

@router.post("", response_model=ManagerCreateOut, status_code=status.HTTP_201_CREATED)
async def create_manager(body: ManagerCreateIn, _admin: AdminUser, market: CurrentMarket, db: Annotated[AsyncSession, Depends(get_db)]) -> ManagerCreateOut:
    base = "".join(ch for ch in body.full_name.lower() if ch.isalnum())[:12] or "manager"
    username = f"{market.slug}-{base}"
    suffix = 1
    while await db.scalar(select(User).where(User.username == username)):
        suffix += 1; username = f"{market.slug}-{base}{suffix}"
    password = _gen_password()
    user = User(username=username, password_hash=hash_password(password), role=UserRole.MANAGER.value, market_id=market.id, full_name=body.full_name, is_active=True)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return ManagerCreateOut(id=user.id, username=username, password=password)

@router.put("/{manager_id}/password")
async def change_manager_password(manager_id: int, body: PasswordIn, _admin: AdminUser, market: CurrentMarket, db: Annotated[AsyncSession, Depends(get_db)]) -> dict:
    user = await db.scalar(select(User).where(User.id == manager_id, User.market_id == market.id, User.role == UserRole.MANAGER.value))
    if user is None: raise HTTPException(status.HTTP_404_NOT_FOUND, "Manager topilmadi")
    if len(body.new_password) < 6: raise HTTPException(status.HTTP_400_BAD_REQUEST, "Parol kamida 6 belgi")
    user.password_hash = hash_password(body.new_password)
    await db.commit()
    return {"ok": True}

@router.put("/{manager_id}/block")
async def toggle_manager_block(manager_id: int, _admin: AdminUser, market: CurrentMarket, db: Annotated[AsyncSession, Depends(get_db)]) -> dict:
    user = await db.scalar(select(User).where(User.id == manager_id, User.market_id == market.id, User.role == UserRole.MANAGER.value))
    if user is None: raise HTTPException(status.HTTP_404_NOT_FOUND, "Manager topilmadi")
    user.is_active = not user.is_active
    await db.commit()
    return {"ok": True, "is_active": user.is_active}

@router.delete("/{manager_id}")
async def delete_manager(manager_id: int, _admin: AdminUser, market: CurrentMarket, db: Annotated[AsyncSession, Depends(get_db)]) -> dict:
    user = await db.scalar(select(User).where(User.id == manager_id, User.market_id == market.id, User.role == UserRole.MANAGER.value))
    if user is None: raise HTTPException(status.HTTP_404_NOT_FOUND, "Manager topilmadi")
    await db.delete(user)
    await db.commit()
    return {"ok": True}

@router.get("/{manager_id}/pavilions", response_model=list[PavilionMiniOut])
async def get_manager_pavilions(manager_id: int, _admin: AdminUser, market: CurrentMarket, db: Annotated[AsyncSession, Depends(get_db)]) -> list[PavilionMiniOut]:
    user = await db.scalar(select(User).where(User.id == manager_id, User.market_id == market.id, User.role == UserRole.MANAGER.value))
    if user is None: raise HTTPException(status.HTTP_404_NOT_FOUND, "Manager topilmadi")
    assigned_ids = set((await db.execute(select(ManagerPavilion.pavilion_id).where(ManagerPavilion.manager_id == manager_id))).scalars().all())
    pavilions = (await db.execute(select(Pavilion).where(Pavilion.market_id == market.id, Pavilion.is_active.is_(True)).order_by(Pavilion.display_order, Pavilion.display_name))).scalars().all()
    return [PavilionMiniOut(id=p.id, display_name=p.display_name, pavilion_type=p.pavilion_type, map_layer_id=p.map_layer_id, assigned=p.id in assigned_ids) for p in pavilions]

@router.put("/{manager_id}/pavilions")
async def assign_manager_pavilions(manager_id: int, body: PavilionAssignIn, _admin: AdminUser, market: CurrentMarket, db: Annotated[AsyncSession, Depends(get_db)]) -> dict:
    user = await db.scalar(select(User).where(User.id == manager_id, User.market_id == market.id, User.role == UserRole.MANAGER.value))
    if user is None: raise HTTPException(status.HTTP_404_NOT_FOUND, "Manager topilmadi")
    valid_ids = set((await db.execute(select(Pavilion.id).where(Pavilion.market_id == market.id, Pavilion.id.in_(body.pavilion_ids)))).scalars().all())
    await db.execute(sa_delete(ManagerPavilion).where(ManagerPavilion.manager_id == manager_id))
    for pid in valid_ids: db.add(ManagerPavilion(manager_id=manager_id, pavilion_id=pid))
    await db.commit()
    return {"ok": True, "assigned_count": len(valid_ids)}
