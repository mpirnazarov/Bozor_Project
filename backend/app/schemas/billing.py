"""Billing va shop javob schemalari."""
from decimal import Decimal
from enum import Enum

from pydantic import BaseModel, ConfigDict


class ShopStatus(str, Enum):
    PAID = "paid"  # qarzsiz
    PARTIAL = "partial"  # qisman to'lagan
    UNPAID = "unpaid"  # to'lamagan
    NO_DATA = "no_data"  # ma'lumot yo'q


class CategoryBalance(BaseModel):
    """Bitta kategoriya (rent/water/electricity) bo'yicha balans."""

    category: str
    due: Decimal
    paid: Decimal
    debt: Decimal  # due - paid (manfiy bo'lsa 0)


class BillingStatusOut(BaseModel):
    """Bitta magazin uchun billing xulosasi (status ranglari uchun)."""

    shop_id: str
    inn: str | None = None
    status: ShopStatus
    total_due: Decimal
    total_paid: Decimal
    total_debt: Decimal
    categories: list[CategoryBalance] = []


class BatchBillingRequest(BaseModel):
    shop_ids: list[str]
    year: int
    month: int


class BatchBillingResponse(BaseModel):
    year: int
    month: int
    results: dict[str, BillingStatusOut]  # shop_id -> status


class ShopOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    shop_id: str
    pavilion_code: str | None = None
    pavilion_id: int | None = None
    inn: str | None = None
    shop_type: str | None = None
    purpose: str | None = None
    monthly_rent: Decimal
    is_active: bool
    is_vacant: bool = False
    area: float | None = None


class CounterpartyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    inn: str
    name: str
    contract_no: str | None = None
    contract_date: str | None = None
    phone: str | None = None


class ShopDetailOut(BaseModel):
    """Magazin detali — kontragent + joriy oy billing."""

    shop: ShopOut
    counterparty: CounterpartyOut | None = None
    billing: BillingStatusOut | None = None


class PaginatedShops(BaseModel):
    items: list[ShopOut]
    page: int
    per_page: int
    total: int


class InnSearchResult(BaseModel):
    inn: str
    name: str
    shop_count: int


class InnDetailOut(BaseModel):
    counterparty: CounterpartyOut
    shops: list[ShopOut]
