"""backup_logs jadvali — DB backup urinishlari jurnali.

Revision ID: 0011
Revises: 0010
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0011"
down_revision: str | None = "0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "backup_logs",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("trigger", sa.String(length=20), nullable=False, server_default="manual"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="running"),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("duration_ms", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_backup_logs_created", "backup_logs", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_backup_logs_created", table_name="backup_logs")
    op.drop_table("backup_logs")
