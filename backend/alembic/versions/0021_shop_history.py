"""shop_history jadvali — do'kon egalik tarixi.

Revision ID: 0021
Revises: 0020
"""
from collections.abc import Sequence
from alembic import op
from sqlalchemy import text

revision: str = "0021"
down_revision: str | None = "0020"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(text("""
        CREATE TABLE IF NOT EXISTS shop_history (
            id SERIAL NOT NULL,
            shop_id INTEGER NOT NULL,
            old_inn VARCHAR(20),
            old_name VARCHAR(300),
            new_inn VARCHAR(20),
            new_name VARCHAR(300),
            changed_by VARCHAR(100),
            reason TEXT,
            changed_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
            PRIMARY KEY (id),
            FOREIGN KEY(shop_id) REFERENCES shops (id) ON DELETE CASCADE
        )
    """))


def downgrade() -> None:
    op.drop_table("shop_history")
