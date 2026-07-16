"""shops.is_vacant — bo'sh do'kon flagi.

Revision ID: 0024
Revises: 0019
"""
from collections.abc import Sequence
import sqlalchemy as sa
from alembic import op

revision: str = "0024"
down_revision: str | None = "0023"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "shops",
        sa.Column("is_vacant", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade() -> None:
    op.drop_column("shops", "is_vacant")
