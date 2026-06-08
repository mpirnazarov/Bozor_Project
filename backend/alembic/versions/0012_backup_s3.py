"""backup_logs ga S3/R2 yuklash ustunlari qo'shildi.

Revision ID: 0012
Revises: 0011
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0012"
down_revision: str | None = "0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("backup_logs", sa.Column("s3_uploaded", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("backup_logs", sa.Column("s3_key", sa.String(length=500), nullable=True))
    op.add_column("backup_logs", sa.Column("s3_error", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("backup_logs", "s3_error")
    op.drop_column("backup_logs", "s3_key")
    op.drop_column("backup_logs", "s3_uploaded")
