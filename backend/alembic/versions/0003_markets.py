"""markets jadvali + market_id ustunlari (multi-bozor arxitekturasi)

Revision ID: 0003
Revises: 0002
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. markets jadvali
    op.create_table(
        "markets",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("slug", sa.String(50), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("map_image", sa.String(300), nullable=True),
        sa.Column("map_view_w", sa.Integer(), nullable=False, server_default="1568"),
        sa.Column("map_view_h", sa.Integer(), nullable=False, server_default="1109"),
        sa.Column("dashboard_stats", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_markets_slug", "markets", ["slug"], unique=True)

    # 2. Standart bozor (Orikzor) — id=1, mavjud ma'lumotlar shunga tegishli
    op.execute(
        """
        INSERT INTO markets (id, slug, name, map_image, map_view_w, map_view_h, display_order)
        VALUES (1, 'orikzor', 'O''rikzor Savdo Kompleksi', '/map.jpg', 1568, 1109, 1)
        ON CONFLICT (id) DO NOTHING
        """
    )

    # 3. market_id ustunlarini qo'shamiz (default 1 — mavjud yozuvlar Orikzor'ga)
    for table in ("pavilions", "shops", "monthly_balances"):
        op.add_column(
            table,
            sa.Column("market_id", sa.Integer(), nullable=False, server_default="1"),
        )
        op.create_index(f"ix_{table}_market_id", table, ["market_id"])
        op.create_foreign_key(
            f"fk_{table}_market", table, "markets",
            ["market_id"], ["id"], ondelete="CASCADE",
        )

    # 4. dashboard_stats'ni eski settings'dan markets'ga ko'chiramiz (agar bor bo'lsa)
    op.execute(
        """
        UPDATE markets SET dashboard_stats = COALESCE(
            (SELECT value FROM settings WHERE key = 'dashboard_stats'), '{}'::jsonb
        ) WHERE id = 1
        """
    )


def downgrade() -> None:
    for table in ("pavilions", "shops", "monthly_balances"):
        op.drop_constraint(f"fk_{table}_market", table, type_="foreignkey")
        op.drop_index(f"ix_{table}_market_id", table_name=table)
        op.drop_column(table, "market_id")
    op.drop_index("ix_markets_slug", table_name="markets")
    op.drop_table("markets")
