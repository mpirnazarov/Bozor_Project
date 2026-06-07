"""import_logs jadvali — yuklangan billing fayllar va validatsiya xatolari.

Har bir billing import urinishi (muvaffaqiyatli yoki xatoli) shu yerga
yoziladi: fayl nomi, fayl mazmuni (base64), holati va xatolar ro'yxati.
Xatoli fayllar logdan yuklab olinishi mumkin.

Revision ID: 0010
Revises: 0009
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0010"
down_revision: str | None = "0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "import_logs",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("market_id", sa.Integer(), nullable=True),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("year", sa.SmallInteger(), nullable=True),
        sa.Column("month", sa.SmallInteger(), nullable=True),
        # status: 'success' | 'failed'
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("rows_read", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("records", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("counterparties", sa.Integer(), nullable=False, server_default="0"),
        # errors: ["...", ...]
        sa.Column("errors", sa.JSON(), nullable=True),
        # Yuklangan faylning o'zi (base64) — xatoli bo'lsa yuklab olish uchun
        sa.Column("file_data", sa.Text(), nullable=True),
        sa.Column("file_mime", sa.String(length=100), nullable=True),
        sa.Column("audit_id", sa.BigInteger(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_import_logs_created", "import_logs", ["created_at"])
    op.create_index("ix_import_logs_audit", "import_logs", ["audit_id"])


def downgrade() -> None:
    op.drop_index("ix_import_logs_audit", table_name="import_logs")
    op.drop_index("ix_import_logs_created", table_name="import_logs")
    op.drop_table("import_logs")
