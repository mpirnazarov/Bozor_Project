"""invoice_payments jadvali — qisman to'lovlar tarixi.

Revision ID: 0016
Revises: 0015
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0016"
down_revision: str | None = "0015"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "invoice_payments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("invoice_id", sa.Integer(), sa.ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False),
        sa.Column("amount", sa.Numeric(15, 2), nullable=False),
        sa.Column("note", sa.String(length=300), nullable=True),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_invoice_payments_invoice", "invoice_payments", ["invoice_id"])

    # Mavjud paid_amount > 0 bo'lgan invoicelar uchun bitta boshlang'ich yozuv yaratamiz
    # (eski qisman to'lovlar tarixsiz qolib ketmasligi uchun)
    op.execute("""
        INSERT INTO invoice_payments (invoice_id, amount, note, created_at)
        SELECT id, paid_amount, 'Boshlang''ich yozuv (migratsiya)', COALESCE(paid_at, created_at)
        FROM invoices
        WHERE paid_amount > 0
    """)


def downgrade() -> None:
    op.drop_index("ix_invoice_payments_invoice", table_name="invoice_payments")
    op.drop_table("invoice_payments")
