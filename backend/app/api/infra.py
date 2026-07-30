"""Infra do'konlar — INN siz to'g'ridan billing."""
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from decimal import Decimal
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.deps import AdminUser, CurrentMarket
from app.models.infra_shop import InfraShop, InfraBilling

router = APIRouter()

MONTHS = ["Yanvar","Fevral","Mart","Aprel","May","Iyun",
          "Iyul","Avgust","Sentyabr","Oktyabr","Noyabr","Dekabr"]


class InfraShopOut(BaseModel):
    id: int
    name: str
    contract_no: str | None
    contract_date: str | None
    monthly_rent: float
    is_active: bool
    notes: str | None = None
    water_enabled: bool = True


class InfraBillingOut(BaseModel):
    id: int
    shop_id: int
    year: int
    month: int
    category: str
    due_amount: float
    paid_amount: float
    debt: float
    notes: str | None = None


class InfraShopCreateIn(BaseModel):
    name: str
    contract_no: str | None = None
    contract_date: str | None = None
    monthly_rent: float = 0
    notes: str | None = None


class InfraBillingUpsertIn(BaseModel):
    year: int
    month: int
    rent_due: float = 0
    rent_paid: float = 0
    electricity_due: float = 0
    electricity_paid: float = 0
    water_due: float = 0
    water_paid: float = 0


class InfraShopDetail(BaseModel):
    shop: InfraShopOut
    billings: list[InfraBillingOut]


@router.get("", response_model=list[InfraShopOut])
async def list_infra_shops(
    _admin: AdminUser,
    market: CurrentMarket,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[InfraShopOut]:
    rows = (await db.execute(
        select(InfraShop)
        .where(InfraShop.market_id == market.id, InfraShop.is_active.is_(True))
        .order_by(InfraShop.id)
    )).scalars().all()
    return [InfraShopOut(
        id=s.id, name=s.name, contract_no=s.contract_no,
        contract_date=s.contract_date, monthly_rent=float(s.monthly_rent),
        is_active=s.is_active, notes=s.notes,
    ) for s in rows]


@router.post("", response_model=InfraShopOut, status_code=201)
async def create_infra_shop(
    body: InfraShopCreateIn,
    _admin: AdminUser,
    market: CurrentMarket,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> InfraShopOut:
    shop = InfraShop(
        market_id=market.id, name=body.name, contract_no=body.contract_no,
        contract_date=body.contract_date, monthly_rent=Decimal(str(body.monthly_rent)),
        notes=body.notes,
    )
    db.add(shop)
    await db.commit()
    await db.refresh(shop)
    return InfraShopOut(
        id=shop.id, name=shop.name, contract_no=shop.contract_no,
        contract_date=shop.contract_date, monthly_rent=float(shop.monthly_rent),
        is_active=shop.is_active, notes=shop.notes,
    )


@router.get("/{shop_id}", response_model=InfraShopDetail)
async def get_infra_shop(
    shop_id: int,
    _admin: AdminUser,
    market: CurrentMarket,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> InfraShopDetail:
    shop = await db.scalar(select(InfraShop).where(InfraShop.id == shop_id, InfraShop.market_id == market.id))
    if not shop:
        raise HTTPException(404, "Topilmadi")
    billings = (await db.execute(
        select(InfraBilling).where(InfraBilling.shop_id == shop_id)
        .order_by(InfraBilling.year.desc(), InfraBilling.month.desc(), InfraBilling.category)
    )).scalars().all()
    return InfraShopDetail(
        shop=InfraShopOut(id=shop.id, name=shop.name, contract_no=shop.contract_no,
                          contract_date=shop.contract_date, monthly_rent=float(shop.monthly_rent),
                          is_active=shop.is_active, notes=shop.notes),
        billings=[InfraBillingOut(
            id=b.id, shop_id=b.shop_id, year=b.year, month=b.month,
            category=b.category, due_amount=float(b.due_amount),
            paid_amount=float(b.paid_amount),
            debt=max(0, float(b.due_amount) - float(b.paid_amount)),
            notes=b.notes,
        ) for b in billings],
    )


@router.put("/{shop_id}/billing", response_model=list[InfraBillingOut])
async def upsert_infra_billing(
    shop_id: int,
    body: InfraBillingUpsertIn,
    _admin: AdminUser,
    market: CurrentMarket,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[InfraBillingOut]:
    shop = await db.scalar(select(InfraShop).where(InfraShop.id == shop_id, InfraShop.market_id == market.id))
    if not shop:
        raise HTTPException(404, "Topilmadi")

    cats = {
        "rent": (body.rent_due, body.rent_paid),
        "electricity": (body.electricity_due, body.electricity_paid),
        "water": (body.water_due, body.water_paid),
    }
    result = []
    for cat, (due, paid) in cats.items():
        existing = await db.scalar(select(InfraBilling).where(
            InfraBilling.shop_id == shop_id,
            InfraBilling.year == body.year,
            InfraBilling.month == body.month,
            InfraBilling.category == cat,
        ))
        if existing:
            existing.due_amount = Decimal(str(due))
            existing.paid_amount = Decimal(str(paid))
            result.append(existing)
        else:
            b = InfraBilling(
                shop_id=shop_id, year=body.year, month=body.month,
                category=cat, due_amount=Decimal(str(due)), paid_amount=Decimal(str(paid)),
            )
            db.add(b)
            result.append(b)
    await db.commit()
    for b in result:
        await db.refresh(b)
    return [InfraBillingOut(
        id=b.id, shop_id=b.shop_id, year=b.year, month=b.month,
        category=b.category, due_amount=float(b.due_amount),
        paid_amount=float(b.paid_amount),
        debt=max(0, float(b.due_amount) - float(b.paid_amount)),
    ) for b in result]


@router.delete("/{shop_id}")
async def delete_infra_shop(
    shop_id: int,
    _admin: AdminUser,
    market: CurrentMarket,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    shop = await db.scalar(select(InfraShop).where(InfraShop.id == shop_id, InfraShop.market_id == market.id))
    if not shop:
        raise HTTPException(404, "Topilmadi")
    shop.is_active = False
    await db.commit()
    return {"ok": True}
