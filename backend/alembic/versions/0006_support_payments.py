"""support_payments jadvali + markets.support_blocked

Revision ID: 0006
Revises: 0005
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # markets.support_blocked
    op.add_column(
        "markets",
        sa.Column("support_blocked", sa.Boolean(), nullable=False, server_default=sa.false()),
    )

    # support_payments jadvali
    op.create_table(
        "support_payments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("market_id", sa.Integer(), nullable=False),
        sa.Column("year", sa.SmallInteger(), nullable=False),
        sa.Column("month", sa.SmallInteger(), nullable=False),
        sa.Column("amount", sa.Numeric(15, 2), nullable=False, server_default="2400000"),
        sa.Column("is_paid", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.String(length=300), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["market_id"], ["markets.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("market_id", "year", "month", name="uq_support_market_period"),
    )
    op.create_index("ix_support_payments_market_id", "support_payments", ["market_id"])


def downgrade() -> None:
    op.drop_index("ix_support_payments_market_id", table_name="support_payments")
    op.drop_table("support_payments")
    op.drop_column("markets", "support_blocked")
