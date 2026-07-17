"""manager_pavilions jadvali — manager va pavilion biriktirish (M2M).

Revision ID: 0023
Revises: 0022
"""
from collections.abc import Sequence
from alembic import op
from sqlalchemy import text

revision: str = "0023"
down_revision: str | None = "0022"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(text("""
        CREATE TABLE IF NOT EXISTS manager_pavilions (
            id SERIAL PRIMARY KEY,
            manager_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            pavilion_id INTEGER NOT NULL REFERENCES pavilions(id) ON DELETE CASCADE,
            assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
            CONSTRAINT uq_manager_pavilion UNIQUE (manager_id, pavilion_id)
        )
    """))
    op.execute(text(
        "CREATE INDEX IF NOT EXISTS ix_manager_pavilions_manager_id "
        "ON manager_pavilions (manager_id)"
    ))
    op.execute(text(
        "CREATE INDEX IF NOT EXISTS ix_manager_pavilions_pavilion_id "
        "ON manager_pavilions (pavilion_id)"
    ))


def downgrade() -> None:
    op.drop_table("manager_pavilions")
