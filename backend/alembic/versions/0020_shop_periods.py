"""shop_periods — magazin egasi/narxi bo'yicha davrlar

Hisobotlar bugungi `shops.monthly_rent` va `shops.inn` ga tayanadi, shuning
uchun egasi yoki narxi o'zgarsa O'TGAN oylar hisoboti ham o'zgarib ketardi.
Bu jadval har holatni davr sifatida saqlaydi.

Migratsiya hozirgi holatni bitta boshlang'ich davr qilib ko'chiradi
(valid_from = 2000-01-01, valid_to = NULL), shuning uchun mavjud
hisobotlardagi raqamlar AYNAN avvalgidek qoladi.

Revision ID: 0020
Revises: 0019
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0020"
down_revision: str | None = "0019"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "shop_periods",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("market_id", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("shop_id", sa.String(length=64), nullable=False),
        sa.Column("inn", sa.String(length=20), nullable=True),
        sa.Column("counterparty_name", sa.String(length=512), nullable=True),
        sa.Column("monthly_rent", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("valid_from", sa.Date(), nullable=False),
        sa.Column("valid_to", sa.Date(), nullable=True),
        sa.Column("source", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=True,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_shop_periods_lookup", "shop_periods", ["market_id", "shop_id", "valid_from"]
    )
    op.create_index("ix_shop_periods_open", "shop_periods", ["market_id", "valid_to"])

    # Hozirgi holatni boshlang'ich davr sifatida ko'chiramiz.
    # valid_from juda erta sana — shunda HAR QANDAY o'tgan davr so'rovi shu
    # yozuvga tushadi va hisobotlar avvalgidek qoladi.
    op.execute(
        """
        INSERT INTO shop_periods
            (market_id, shop_id, inn, counterparty_name, monthly_rent,
             valid_from, valid_to, source)
        SELECT s.market_id,
               s.shop_id,
               s.inn,
               c.name,
               COALESCE(s.monthly_rent, 0),
               DATE '2000-01-01',
               NULL,
               'migration 0020: boshlang''ich holat'
        FROM shops s
        LEFT JOIN counterparties c ON c.inn = s.inn
        WHERE s.is_active IS TRUE
        """
    )


def downgrade() -> None:
    op.drop_index("ix_shop_periods_open", table_name="shop_periods")
    op.drop_index("ix_shop_periods_lookup", table_name="shop_periods")
    op.drop_table("shop_periods")
