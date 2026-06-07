"""Admin endpointlari uchun schemas."""
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from app.schemas.dashboard import Period, ServicesBreakdown


class DashboardUpdate(BaseModel):
    """Admin dashboard summalarini yangilaydi (har biri alohida)."""

    total: int
    paid: int
    services: ServicesBreakdown
    period: Period | None = None


class ShopUpdate(BaseModel):
    """Magazin maydonlarini tahrirlash (faqat berilganlari yangilanadi)."""

    pavilion_code: str | None = None
    pavilion_id: int | None = None
    inn: str | None = None
    shop_type: str | None = None
    purpose: str | None = None
    monthly_rent: Decimal | None = None
    is_active: bool | None = None


class PavilionCreate(BaseModel):
    """Yangi pavilion (region) yaratish — admin xarita muharriridan."""

    display_name: str
    display_text: str | None = None
    pavilion_type: str | None = "block"
    polygon_points: str  # "x1,y1 x2,y2 ..." (ko'p qirrali)
    fill_color: str = "#d4a373"
    fill_opacity: float = 0.5
    stroke_color: str = "#b45309"
    stroke_width: float = 3
    label_x: float | None = None
    label_y: float | None = None
    label_rotation: float = 0
    is_active: bool = True
    display_order: int = 0
    map_layer_id: int | None = None
    meta: dict = {}


class PavilionUpdate(BaseModel):
    """Pavilion (xarita) maydonlarini tahrirlash."""

    display_name: str | None = None
    display_text: str | None = None
    pavilion_type: str | None = None
    polygon_points: str | None = None
    fill_color: str | None = None
    fill_opacity: float | None = None
    stroke_color: str | None = None
    stroke_width: float | None = None
    label_x: float | None = None
    label_y: float | None = None
    label_rotation: float | None = None
    is_active: bool | None = None
    display_order: int | None = None
    map_layer_id: int | None = None
    meta: dict | None = None


class ImportResult(BaseModel):
    """Excel import natijasi."""

    rows_read: int
    inserted: int
    updated: int
    skipped: int
    errors: list[str] = []


class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int | None
    action: str
    resource_type: str | None
    resource_id: str | None
    changes: dict | None
    created_at: datetime
    # Odam o'qiy oladigan qo'shimcha maydonlar
    action_label: str = ""
    resource_label: str = ""
    user_label: str = ""
    user_role: str | None = None
    summary: str = ""
    # Rollback (ortga qaytarish) — agar shu amal uchun snapshot bo'lsa
    snapshot_id: int | None = None
    revertable: bool = False
    reverted: bool = False
    # Xatoli import fayli (logdan yuklab olish uchun)
    import_log_id: int | None = None
    import_failed: bool = False
    error_count: int = 0
