"""shops jadvali — contract_no ustuni qo'shildi (dogovor raqami).

Revision ID: 0020
Revises: 0019
"""
from collections.abc import Sequence
from alembic import op
from sqlalchemy import text

revision: str = "0020"
down_revision: str | None = "0019"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(text(
        "ALTER TABLE shops ADD COLUMN IF NOT EXISTS "
        "contract_no VARCHAR(150)"
    ))


def downgrade() -> None:
    op.drop_column("shops", "contract_no")
