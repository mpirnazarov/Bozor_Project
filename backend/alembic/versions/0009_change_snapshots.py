"""change_snapshots jadvali — amallarni ortga qaytarish (rollback) uchun.

Har bir o'zgartiruvchi amal (billing import, va h.k.) oldidan, ta'sir
qiladigan yozuvlarning OLDINGI holati JSON sifatida saqlanadi. Revert
qilinganda shu holatga qaytariladi. Faqat o'zgargan yozuvlar qaytariladi.

Revision ID: 0009
Revises: 0008
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0009"
down_revision: str | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "change_snapshots",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("audit_id", sa.BigInteger(), nullable=True),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("market_id", sa.Integer(), nullable=True),
        sa.Column("action", sa.String(length=50), nullable=False),
        sa.Column("table_name", sa.String(length=50), nullable=False),
        # before_rows: [{"key": {...}, "before": {...}|null}, ...]
        sa.Column("before_rows", sa.JSON(), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("reverted", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("reverted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_change_snapshots_created", "change_snapshots", ["created_at"])
    op.create_index("ix_change_snapshots_audit", "change_snapshots", ["audit_id"])


def downgrade() -> None:
    op.drop_index("ix_change_snapshots_audit", table_name="change_snapshots")
    op.drop_index("ix_change_snapshots_created", table_name="change_snapshots")
    op.drop_table("change_snapshots")
