"""backup_logs ga category ustuni (GFS retention).

Revision ID: 0013
Revises: 0012
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0013"
down_revision: str | None = "0012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "backup_logs",
        sa.Column("category", sa.String(length=20), nullable=False, server_default="daily"),
    )


def downgrade() -> None:
    op.drop_column("backup_logs", "category")
