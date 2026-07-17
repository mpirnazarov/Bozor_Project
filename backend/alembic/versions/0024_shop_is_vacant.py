"""shops.is_vacant — bo'sh do'kon flagi.

Revision ID: 0024
Revises: 0019
"""
from collections.abc import Sequence
from alembic import op
from sqlalchemy import text

revision: str = "0024"
down_revision: str | None = "0019"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(text(
        "ALTER TABLE shops "
        "ADD COLUMN IF NOT EXISTS is_vacant BOOLEAN NOT NULL DEFAULT FALSE"
    ))


def downgrade() -> None:
    pass
