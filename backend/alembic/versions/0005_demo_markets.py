"""4 ta demo bozor qo'shish (super dashboard ko'rsatish uchun)

Orikzor (id=1) — real ma'lumot, tegilmaydi.
Qolgan 4 ta — vaqtinchalik demo summalar bilan.

Revision ID: 0005
Revises: 0004
"""
from collections.abc import Sequence

from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Demo bozorlar — (slug, nom, jami summa, to'langan summa, tartib)
# Summalar so'mda (taxminiy realistik raqamlar)
_DEMO_MARKETS = [
    ("bek-topi", "Bek To'pi Bozori", 1_850_000_000, 1_420_000_000, 2),
    ("abu-saxiy", "Abu-Saxiy Bozori", 3_240_000_000, 2_180_000_000, 3),
    ("sergili-moshina", "Sergili Moshina Bozori", 2_460_000_000, 2_050_000_000, 4),
    ("chorsu", "Chorsu Bozori", 4_120_000_000, 2_760_000_000, 5),
]


def upgrade() -> None:
    for slug, name, total, paid, order in _DEMO_MARKETS:
        # dashboard_stats JSONB — super dashboard total/paid ni shundan oladi
        op.execute(
            f"""
            INSERT INTO markets (slug, name, map_image, map_view_w, map_view_h,
                                 dashboard_stats, is_active, display_order, notes)
            VALUES (
                '{slug}', '{name.replace("'", "''")}', NULL, 1568, 1109,
                '{{"total": {total}, "paid": {paid}, "is_demo": true}}'::jsonb,
                true, {order}, 'Demo bozor — vaqtinchalik ko''rsatish uchun'
            )
            ON CONFLICT (slug) DO NOTHING
            """
        )


def downgrade() -> None:
    slugs = ", ".join(f"'{m[0]}'" for m in _DEMO_MARKETS)
    op.execute(f"DELETE FROM markets WHERE slug IN ({slugs})")
