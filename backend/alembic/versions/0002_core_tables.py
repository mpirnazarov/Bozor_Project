"""core jadvallar: counterparties, pavilions, shops, monthly_balances, settings, audit_log

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-30

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Kengaytma har holatda mavjudligiga ishonch hosil qilamiz (idempotent)
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    # --- counterparties ---
    op.create_table(
        "counterparties",
        sa.Column("inn", sa.String(20), primary_key=True),
        sa.Column("name", sa.String(500), nullable=False),
        sa.Column("contract_no", sa.String(100), nullable=True),
        sa.Column("contract_date", sa.Date(), nullable=True),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    # pg_trgm GIN index — INN/nom bo'yicha fuzzy qidirish uchun
    op.create_index(
        "ix_counterparties_name_trgm",
        "counterparties",
        ["name"],
        postgresql_using="gin",
        postgresql_ops={"name": "gin_trgm_ops"},
    )

    # --- pavilions ---
    op.create_table(
        "pavilions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=False),
        sa.Column("display_name", sa.String(100), nullable=False),
        sa.Column("display_text", sa.String(10), nullable=True),
        sa.Column("pavilion_type", sa.String(50), nullable=True),
        sa.Column("polygon_points", sa.Text(), nullable=True),
        sa.Column("fill_color", sa.String(20), server_default="#d4a373", nullable=False),
        sa.Column("fill_opacity", sa.Float(), server_default="0.45", nullable=False),
        sa.Column("stroke_color", sa.String(20), server_default="#b45309", nullable=False),
        sa.Column("stroke_width", sa.Float(), server_default="3", nullable=False),
        sa.Column("label_x", sa.Float(), nullable=True),
        sa.Column("label_y", sa.Float(), nullable=True),
        sa.Column("label_rotation", sa.Float(), server_default="0", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("display_order", sa.Integer(), server_default="0", nullable=False),
        sa.Column("metadata", postgresql.JSONB(), server_default="{}", nullable=False),
    )

    # --- shops ---
    op.create_table(
        "shops",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("shop_id", sa.String(50), nullable=False),
        sa.Column("pavilion_code", sa.String(100), nullable=True),
        sa.Column(
            "pavilion_id",
            sa.Integer(),
            sa.ForeignKey("pavilions.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "inn",
            sa.String(20),
            sa.ForeignKey("counterparties.inn", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("shop_type", sa.String(200), nullable=True),
        sa.Column("purpose", sa.Text(), nullable=True),
        sa.Column("monthly_rent", sa.Numeric(15, 2), server_default="0", nullable=False),
        sa.Column("source_sheet", sa.String(100), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_shops_shop_id", "shops", ["shop_id"], unique=True)
    op.create_index("ix_shops_pavilion_code", "shops", ["pavilion_code"])
    op.create_index("ix_shops_inn", "shops", ["inn"])
    op.create_index("ix_shops_is_active", "shops", ["is_active"])

    # --- monthly_balances ---
    op.create_table(
        "monthly_balances",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("inn", sa.String(20), nullable=False),
        sa.Column("year", sa.SmallInteger(), nullable=False),
        sa.Column("month", sa.SmallInteger(), nullable=False),
        sa.Column("category", sa.String(20), nullable=False),
        sa.Column("due_amount", sa.Numeric(15, 2), server_default="0", nullable=False),
        sa.Column("paid_amount", sa.Numeric(15, 2), server_default="0", nullable=False),
        sa.Column("account_code", sa.Integer(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("inn", "year", "month", "category", name="uq_balance_period"),
        sa.CheckConstraint("month BETWEEN 1 AND 12", name="ck_balance_month"),
    )
    op.create_index("ix_monthly_balances_inn", "monthly_balances", ["inn"])
    op.create_index("ix_balances_period", "monthly_balances", ["year", "month"])
    op.create_index("ix_balances_inn_period", "monthly_balances", ["inn", "year", "month"])

    # --- settings ---
    op.create_table(
        "settings",
        sa.Column("key", sa.String(100), primary_key=True),
        sa.Column("value", postgresql.JSONB(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "updated_by",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # --- audit_log ---
    op.create_table(
        "audit_log",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("resource_type", sa.String(50), nullable=True),
        sa.Column("resource_id", sa.String(100), nullable=True),
        sa.Column("changes", postgresql.JSONB(), nullable=True),
        sa.Column("ip_address", postgresql.INET(), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_audit_user", "audit_log", ["user_id"])
    op.create_index("ix_audit_created", "audit_log", ["created_at"])


def downgrade() -> None:
    op.drop_table("audit_log")
    op.drop_table("settings")
    op.drop_table("monthly_balances")
    op.drop_table("shops")
    op.drop_table("pavilions")
    op.drop_index("ix_counterparties_name_trgm", table_name="counterparties")
    op.drop_table("counterparties")
