"""rent_billing jadvali — sana bo'yicha magazin arenda billing.

Revision ID: 0019
Revises: 0018
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0019"
down_revision: str | None = "0018"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "rent_billing",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("market_id", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("shop_id", sa.String(length=64), nullable=False),
        sa.Column("bill_date", sa.Date(), nullable=False),
        sa.Column("inn", sa.String(length=20), nullable=True),
        sa.Column("counterparty_name", sa.String(length=512), nullable=True),
        sa.Column("contract_no", sa.String(length=128), nullable=True),
        sa.Column("monthly_amount", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("debt", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("paid", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("market_id", "shop_id", "bill_date", name="uq_rent_billing_key"),
    )
    op.create_index("ix_rent_billing_date", "rent_billing", ["market_id", "bill_date"])
    op.create_index("ix_rent_billing_shop", "rent_billing", ["shop_id"])


def downgrade() -> None:
    op.drop_index("ix_rent_billing_shop", table_name="rent_billing")
    op.drop_index("ix_rent_billing_date", table_name="rent_billing")
    op.drop_table("rent_billing")
