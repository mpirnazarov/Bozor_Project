"""users.market_id + multi-bozor rollari

Revision ID: 0004
Revises: 0003
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # users.market_id (super_admin uchun NULL)
    op.add_column("users", sa.Column("market_id", sa.Integer(), nullable=True))
    op.create_index("ix_users_market_id", "users", ["market_id"])
    op.create_foreign_key(
        "fk_users_market", "users", "markets",
        ["market_id"], ["id"], ondelete="SET NULL",
    )

    # Mavjud rollarni multi-bozor rollariga ko'chiramiz:
    # - 'admin' -> 'super_admin' (hamma bozorni ko'radi)
    op.execute("UPDATE users SET role = 'super_admin' WHERE role = 'admin'")
    # - 'user' -> 'market_admin', market 1 (Orikzor) ga biriktiramiz
    op.execute(
        "UPDATE users SET role = 'market_admin', market_id = 1 WHERE role = 'user'"
    )


def downgrade() -> None:
    op.execute("UPDATE users SET role = 'admin' WHERE role = 'super_admin'")
    op.execute("UPDATE users SET role = 'user' WHERE role IN ('market_admin', 'market_viewer')")
    op.drop_constraint("fk_users_market", "users", type_="foreignkey")
    op.drop_index("ix_users_market_id", table_name="users")
    op.drop_column("users", "market_id")
