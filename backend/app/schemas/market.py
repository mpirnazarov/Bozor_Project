"""Market (bozor) schemalari."""
from pydantic import BaseModel, ConfigDict


class MarketOut(BaseModel):
    """Bozor ma'lumoti."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    name: str
    map_image: str | None = None
    map_view_w: int
    map_view_h: int
    dashboard_stats: dict = {}
    is_active: bool
    display_order: int


class MarketCreate(BaseModel):
    """Yangi bozor yaratish (admin)."""

    slug: str
    name: str
    map_image: str | None = None
    map_view_w: int = 1568
    map_view_h: int = 1109
    dashboard_stats: dict = {}
    display_order: int = 0


class MarketUpdate(BaseModel):
    """Bozor tahrirlash (admin)."""

    name: str | None = None
    map_image: str | None = None
    map_view_w: int | None = None
    map_view_h: int | None = None
    dashboard_stats: dict | None = None
    is_active: bool | None = None
    display_order: int | None = None


class MarketSummary(BaseModel):
    """Super dashboard uchun bitta bozor yig'masi."""

    id: int
    slug: str
    name: str
    total: float
    paid: float
    debt: float
    is_demo: bool = False
    # Bozorning O'rikzorga to'lovi (support/SaaS) holati
    attention: str = "ok"  # ok | yellow | red | blocked | free
    support_paid: bool = False
    free_period: bool = False
    monthly_fee: float = 0
    due_day: int = 6


class SuperDashboardOut(BaseModel):
    """Barcha bozorlar yig'ma dashboardi."""

    total: float
    paid: float
    debt: float
    markets: list[MarketSummary]
    # E'tibor talab qiladigan bozorlar (to'lov kechikkan/yaqin)
    attention_count: int = 0
