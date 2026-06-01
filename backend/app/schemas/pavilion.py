"""Pavilion javob schemalari."""
from pydantic import BaseModel, ConfigDict, Field


class PavilionOut(BaseModel):
    """Xarita uchun pavilion (koordinatalar bilan)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    display_name: str
    display_text: str | None = None
    pavilion_type: str | None = None
    polygon_points: str | None = None
    fill_color: str
    fill_opacity: float
    stroke_color: str
    stroke_width: float
    label_x: float | None = None
    label_y: float | None = None
    label_rotation: float
    is_active: bool
    display_order: int
    map_layer_id: int | None = None
    meta: dict = Field(default_factory=dict)


class PavilionDetailOut(PavilionOut):
    shop_count: int = 0
