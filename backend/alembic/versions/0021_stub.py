"""Stub migration 21.
Revision ID: 0021
Revises: 0020
"""
from collections.abc import Sequence
from alembic import op

revision: str = "0021"
down_revision: str | None = "0020"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

def upgrade() -> None:
    pass

def downgrade() -> None:
    pass
