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
    # IF NOT EXISTS — xavfsiz, ustun allaqachon bo'lsa xato bermaydi
    op.execute(text(
        "ALTER TABLE shops "
        "ADD COLUMN IF NOT EXISTS is_vacant BOOLEAN NOT NULL DEFAULT FALSE"
    ))
    # alembic_version jadvaliga 0020-0023 ni ham qo'shamiz
    # (agar DB da yo'q bo'lsa — multiple head muammosini hal qiladi)
    op.execute(text("""
        INSERT INTO alembic_version (version_num)
        SELECT v FROM (VALUES ('0020'),('0021'),('0022'),('0023')) t(v)
        WHERE NOT EXISTS (
            SELECT 1 FROM alembic_version WHERE version_num = v
        )
    """))


def downgrade() -> None:
    pass
