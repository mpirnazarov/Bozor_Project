"""counterparties.id_type (INN/JSHSHIR) va infra_shops.inn (ega)

Tizim shu paytgacha faqat INN bilan ishlardi. Ba'zi bozorlarda ijarachi
jismoniy shaxs bo'lib, uning JSHSHIR (14 xonali) raqami beriladi.

Yechim: raqamning O'ZI avvalgidek `counterparties.inn` ustunida kalit
bo'lib qoladi (shuning uchun `shops.inn` FK va barcha mavjud kod
o'zgarishsiz ishlaydi), turi esa yangi `id_type` ustunida saqlanadi:
  'inn'     — 9 xonali (yuridik shaxs)
  'jshshir' — 14 xonali (jismoniy shaxs)

Mavjud barcha yozuvlar 'inn' bo'lib qoladi (foydalanuvchi talabi).

Shuningdek `infra_shops` ga `inn` ustuni qo'shiladi — infra do'konlarning
ham egasi bo'ladi, avval buning uchun joy yo'q edi.

Revision ID: 0021
Revises: 0020
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0021"
down_revision: str | None = "0020"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "counterparties",
        sa.Column("id_type", sa.String(length=10), nullable=False, server_default="inn"),
    )
    # Mavjud yozuvlar — hammasi INN
    op.execute("UPDATE counterparties SET id_type = 'inn' WHERE id_type IS NULL")

    op.add_column("infra_shops", sa.Column("inn", sa.String(length=20), nullable=True))
    op.create_index("ix_infra_shops_inn", "infra_shops", ["inn"])
    op.create_foreign_key(
        "infra_shops_inn_fkey", "infra_shops", "counterparties",
        ["inn"], ["inn"], ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("infra_shops_inn_fkey", "infra_shops", type_="foreignkey")
    op.drop_index("ix_infra_shops_inn", table_name="infra_shops")
    op.drop_column("infra_shops", "inn")
    op.drop_column("counterparties", "id_type")
