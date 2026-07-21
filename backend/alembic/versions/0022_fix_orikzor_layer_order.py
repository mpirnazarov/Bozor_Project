"""O'rikzor 1-etaj (image_data=NULL) display_order ni 0 ga tuzatish.

Revision ID: 0022
Revises: 0021
"""
from collections.abc import Sequence
from alembic import op
import sqlalchemy as sa

revision: str = "0022"
down_revision: str | None = "0021"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # O'rikzor bozori (slug='orikzor') uchun
    # image_data=NULL layer (1-etaj, map.jpg) ni display_order=0 qilamiz
    # image_data bor layerlarni display_order=1,2,... qilamiz
    conn = op.get_bind()

    # Orikzor market id ni topamiz
    market = conn.execute(
        sa.text("SELECT id FROM markets WHERE slug = 'orikzor' LIMIT 1")
    ).fetchone()
    if market is None:
        return

    market_id = market[0]

    # image_data=NULL layer ni 0 ga
    conn.execute(sa.text("""
        UPDATE map_layers
        SET display_order = 0
        WHERE market_id = :mid AND image_data IS NULL
    """), {"mid": market_id})

    # image_data bor layerlarni 1 dan boshlab
    conn.execute(sa.text("""
        UPDATE map_layers
        SET display_order = display_order + 10
        WHERE market_id = :mid AND image_data IS NOT NULL AND display_order = 0
    """), {"mid": market_id})


def downgrade() -> None:
    pass
