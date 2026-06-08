"""invoices jadvali — owner bozorga qo'yadigan qo'shimcha to'lovlar (schyot).

Revision ID: 0014
Revises: 0013
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0014"
down_revision: str | None = "0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "invoices",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("market_id", sa.Integer(), sa.ForeignKey("markets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("amount", sa.Numeric(15, 2), nullable=False),
        sa.Column("currency", sa.String(length=8), nullable=False, server_default="UZS"),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("is_paid", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("paid_note", sa.String(length=300), nullable=True),
        sa.Column("doc_data", sa.Text(), nullable=True),
        sa.Column("doc_name", sa.String(length=255), nullable=True),
        sa.Column("doc_mime", sa.String(length=100), nullable=True),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_invoices_market", "invoices", ["market_id"])
    op.create_index("ix_invoices_due", "invoices", ["due_date"])


def downgrade() -> None:
    op.drop_index("ix_invoices_due", table_name="invoices")
    op.drop_index("ix_invoices_market", table_name="invoices")
    op.drop_table("invoices")
