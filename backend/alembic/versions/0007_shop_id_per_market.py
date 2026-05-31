"""shop_id endi har bozor ichida noyob (global emas)

Eski: ix_shops_shop_id UNIQUE (butun db bo'yicha).
Yangi: oddiy (unique bo'lmagan) index + (market_id, shop_id) composite UNIQUE.

Revision ID: 0007
Revises: 0006
"""
from collections.abc import Sequence

from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Eski global-unique indexni o'chiramiz
    op.drop_index("ix_shops_shop_id", table_name="shops")
    # Oddiy (unique bo'lmagan) index — qidiruv tezligi uchun
    op.create_index("ix_shops_shop_id", "shops", ["shop_id"], unique=False)
    # Har bozor ichida shop_id noyob
    op.create_unique_constraint("uq_shop_market_shopid", "shops", ["market_id", "shop_id"])


def downgrade() -> None:
    op.drop_constraint("uq_shop_market_shopid", "shops", type_="unique")
    op.drop_index("ix_shops_shop_id", table_name="shops")
    op.create_index("ix_shops_shop_id", "shops", ["shop_id"], unique=True)
