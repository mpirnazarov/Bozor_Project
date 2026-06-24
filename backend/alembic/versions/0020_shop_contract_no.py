"""shops jadvali — contract_no ustuni qo'shildi (dogovor raqami).

Revision ID: 0020
Revises: 0019
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0020"
down_revision: str | None = "0019"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "shops",
        sa.Column("contract_no", sa.String(length=150), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("shops", "contract_no")
