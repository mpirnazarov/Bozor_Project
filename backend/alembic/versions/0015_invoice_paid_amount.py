"""invoices ga paid_amount (qisman to'lov) ustuni.

Revision ID: 0015
Revises: 0014
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0015"
down_revision: str | None = "0014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "invoices",
        sa.Column("paid_amount", sa.Numeric(15, 2), nullable=False, server_default="0"),
    )
    # Mavjud to'langan schyotlar uchun paid_amount = amount qilamiz
    op.execute("UPDATE invoices SET paid_amount = amount WHERE is_paid = true")


def downgrade() -> None:
    op.drop_column("invoices", "paid_amount")
