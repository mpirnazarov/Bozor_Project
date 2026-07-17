"""manager_pavilions jadvali — manager va pavilion biriktirish (M2M).

Revision ID: 0023
Revises: 0022
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0023"
down_revision: str | None = "0022"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "manager_pavilions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("manager_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("pavilion_id", sa.Integer(), sa.ForeignKey("pavilions.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("assigned_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("manager_id", "pavilion_id", name="uq_manager_pavilion"),
    )


def downgrade() -> None:
    op.drop_table("manager_pavilions")
