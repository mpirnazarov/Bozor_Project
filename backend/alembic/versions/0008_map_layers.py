"""map_layers jadvali + pavilions.map_layer_id

Har bozorda bir nechta xarita (qavat/podval). Pavilion qaysi xaritaga
tegishli ekani map_layer_id bilan bog'lanadi.

Revision ID: 0008
Revises: 0007
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "map_layers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("market_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("image_data", sa.Text(), nullable=True),
        sa.Column("image_mime", sa.String(length=50), nullable=True),
        sa.Column("view_w", sa.Integer(), nullable=False, server_default="1568"),
        sa.Column("view_h", sa.Integer(), nullable=False, server_default="1109"),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["market_id"], ["markets.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_map_layers_market_id", "map_layers", ["market_id"])

    op.add_column("pavilions", sa.Column("map_layer_id", sa.Integer(), nullable=True))
    op.create_index("ix_pavilions_map_layer_id", "pavilions", ["map_layer_id"])
    op.create_foreign_key(
        "fk_pavilions_map_layer", "pavilions", "map_layers",
        ["map_layer_id"], ["id"], ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint("fk_pavilions_map_layer", "pavilions", type_="foreignkey")
    op.drop_index("ix_pavilions_map_layer_id", table_name="pavilions")
    op.drop_column("pavilions", "map_layer_id")
    op.drop_index("ix_map_layers_market_id", table_name="map_layers")
    op.drop_table("map_layers")
