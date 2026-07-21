"""shops.is_vacant

Revision ID: 0024
Revises: 0019
"""
from alembic import op
from sqlalchemy import text

revision = "0024"
down_revision = "0019"
branch_labels = None
depends_on = None

def upgrade():
    op.execute(text("ALTER TABLE shops ADD COLUMN IF NOT EXISTS is_vacant BOOLEAN NOT NULL DEFAULT FALSE"))

def downgrade():
    pass
