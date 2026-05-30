"""Dashboard javob schemalari."""
from pydantic import BaseModel


class ServicesBreakdown(BaseModel):
    rent: int = 0
    arava: int = 0
    xojatxona: int = 0
    parking: int = 0
    boshqa: int = 0


class Period(BaseModel):
    year: int
    month: int


class DashboardOut(BaseModel):
    total: int
    paid: int
    debt: int
    services: ServicesBreakdown
    period: Period
    source: str  # "settings" yoki "live"
