"""invoice kind/payment_method/contract_no + market contract ustunlari.

Revision ID: 0017
Revises: 0016
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0017"
down_revision: str | None = "0016"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Invoice turlari
    op.add_column("invoices", sa.Column("kind", sa.String(length=20), nullable=False, server_default="extra"))
    op.add_column("invoices", sa.Column("payment_method", sa.String(length=20), nullable=True))
    op.add_column("invoices", sa.Column("contract_no", sa.String(length=100), nullable=True))

    # Market shartnomasi (tex-podderjka uchun)
    op.add_column("markets", sa.Column("contract_no", sa.String(length=100), nullable=True))
    op.add_column("markets", sa.Column("contract_data", sa.Text(), nullable=True))
    op.add_column("markets", sa.Column("contract_name", sa.String(length=255), nullable=True))
    op.add_column("markets", sa.Column("contract_mime", sa.String(length=100), nullable=True))


def downgrade() -> None:
    op.drop_column("markets", "contract_mime")
    op.drop_column("markets", "contract_name")
    op.drop_column("markets", "contract_data")
    op.drop_column("markets", "contract_no")
    op.drop_column("invoices", "contract_no")
    op.drop_column("invoices", "payment_method")
    op.drop_column("invoices", "kind")
