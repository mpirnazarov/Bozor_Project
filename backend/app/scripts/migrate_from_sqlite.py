"""Eski `bazar.db` (SQLite) -> PostgreSQL migratsiya skripti.

Idempotent: qayta ishga tushirilsa dublikat yaratmaydi (upsert ishlatadi).

Ishlatish:
    # avval jadvallar yaratilgan bo'lsin:
    alembic upgrade head

    # so'ng migratsiya:
    python -m app.scripts.migrate_from_sqlite --sqlite /data/bazar.db

    # default yo'l: /data/bazar.db (docker), yoki ../data/bazar.db (local)
"""
import argparse
import asyncio
import sqlite3
from datetime import date
from pathlib import Path

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models import (
    DASHBOARD_SETTINGS_KEY,
    RU_TYPE_TO_CATEGORY,
    Counterparty,
    MonthlyBalance,
    Pavilion,
    Setting,
    Shop,
)
from app.scripts.pavilion_seed import SEED_PAVILIONS

# Dashboard summalari — admin keyin tahrirlaydi, main page shu yerdan o'qiydi.
# Breakdown yig'indisi "to'langan"ga teng (har bir qiymat alohida saqlanadi).
DEFAULT_DASHBOARD = {
    "total": 11689498000,
    "paid": 10820572206,
    # debt = total - paid (avtomatik hisoblanadi, saqlanmaydi)
    "services": {
        "rent": 9002499206,
        "arava": 164488000,
        "xojatxona": 247440000,
        "parking": 239792000,
        "boshqa": 1166353000,
    },
    "period": {"year": 2026, "month": 5},
}

BATCH = 500


def _parse_contract_date(raw: str | None) -> date | None:
    """'DD.MM.YYYY' -> date. Xato yoki bo'sh bo'lsa None."""
    if not raw:
        return None
    raw = raw.strip()
    for sep_fmt in ("%d.%m.%Y", "%Y-%m-%d", "%d/%m/%Y"):
        try:
            from datetime import datetime

            return datetime.strptime(raw, sep_fmt).date()
        except ValueError:
            continue
    return None


def _open_sqlite(path: Path) -> sqlite3.Connection:
    if not path.exists():
        raise FileNotFoundError(f"SQLite fayl topilmadi: {path}")
    con = sqlite3.connect(str(path))
    con.row_factory = sqlite3.Row
    return con


async def _migrate_counterparties(db: AsyncSession, src: sqlite3.Connection) -> int:
    rows = src.execute("SELECT * FROM counterparties").fetchall()
    n = 0
    batch: list[dict] = []
    for r in rows:
        inn = (r["inn"] or "").strip()
        if not inn:
            continue
        batch.append(
            {
                "inn": inn,
                "name": (r["name"] or "").strip() or "(noma'lum)",
                "contract_no": r["contract_no"],
                "contract_date": _parse_contract_date(r["contract_date"]),
                "phone": r["phone"],
                "notes": r["notes"],
            }
        )
        if len(batch) >= BATCH:
            await _upsert(db, Counterparty, batch, ["inn"])
            n += len(batch)
            batch = []
    if batch:
        await _upsert(db, Counterparty, batch, ["inn"])
        n += len(batch)
    await db.commit()
    return n


async def _migrate_pavilions(db: AsyncSession) -> int:
    await _upsert(db, Pavilion, SEED_PAVILIONS, ["id"])
    await db.commit()
    return len(SEED_PAVILIONS)


async def _migrate_shops(db: AsyncSession, src: sqlite3.Connection) -> int:
    # pavilion_code -> pavilion_id (faqat seed pavilionlar uchun mos kelishi mumkin)
    # Eski shops.pavilion_code formati pavilions seed bilan to'g'ridan-to'g'ri
    # mos kelmaydi, shuning uchun pavilion_id NULL qoldiriladi (keyin admin bog'laydi).
    rows = src.execute("SELECT * FROM shops").fetchall()
    n = 0
    batch: list[dict] = []
    for r in rows:
        sid = (r["shop_id"] or "").strip()
        if not sid:
            continue
        batch.append(
            {
                "shop_id": sid,
                "pavilion_code": r["pavilion_code"],
                "pavilion_id": None,
                "inn": (r["inn"] or "").strip() or None,
                "shop_type": r["shop_type"],
                "purpose": r["purpose"],
                "monthly_rent": r["monthly_rent"] or 0,
                "source_sheet": r["source_sheet"],
                "notes": r["notes"],
                "is_active": bool(r["active"]) if r["active"] is not None else True,
            }
        )
        if len(batch) >= BATCH:
            await _upsert(db, Shop, batch, ["shop_id"])
            n += len(batch)
            batch = []
    if batch:
        await _upsert(db, Shop, batch, ["shop_id"])
        n += len(batch)
    await db.commit()
    return n


async def _migrate_balances(db: AsyncSession, src: sqlite3.Connection) -> int:
    rows = src.execute("SELECT * FROM monthly_balances").fetchall()
    n = 0
    skipped = 0
    batch: list[dict] = []
    for r in rows:
        category = RU_TYPE_TO_CATEGORY.get(r["type"])
        if category is None:
            skipped += 1
            continue
        inn = (r["inn"] or "").strip()
        if not inn:
            skipped += 1
            continue
        batch.append(
            {
                "inn": inn,
                "year": r["year"],
                "month": r["month"],
                "category": category,
                "due_amount": r["debet"] or 0,
                "paid_amount": r["kredit"] or 0,
                "account_code": r["account_code"],
            }
        )
        if len(batch) >= BATCH:
            await _upsert(db, MonthlyBalance, batch, ["inn", "year", "month", "category"])
            n += len(batch)
            batch = []
    if batch:
        await _upsert(db, MonthlyBalance, batch, ["inn", "year", "month", "category"])
        n += len(batch)
    await db.commit()
    if skipped:
        print(f"   ⚠ {skipped} ta balans qatori o'tkazib yuborildi (noma'lum type/inn)")
    return n


async def _migrate_settings(db: AsyncSession) -> int:
    settings_rows = [
        {
            "key": DASHBOARD_SETTINGS_KEY,
            "value": DEFAULT_DASHBOARD,
            "description": "Dashboard summalari — admin tahrirlaydi, main page o'qiydi",
        },
        {
            "key": "site_title",
            "value": "O'rikzor Savdo Kompleksi",
            "description": "Sayt sarlavhasi",
        },
        {
            "key": "current_period",
            "value": {"year": 2026, "month": 5},
            "description": "Joriy hisobot davri",
        },
    ]
    await _upsert(db, Setting, settings_rows, ["key"])
    await db.commit()
    return len(settings_rows)


async def _upsert(
    db: AsyncSession, model, rows: list[dict], conflict_cols: list[str]
) -> None:
    """PostgreSQL ON CONFLICT DO UPDATE (idempotent)."""
    if not rows:
        return
    stmt = pg_insert(model.__table__).values(rows)
    update_cols = {
        c.name: stmt.excluded[c.name]
        for c in model.__table__.columns
        if c.name not in conflict_cols and c.name not in ("id", "created_at")
    }
    stmt = stmt.on_conflict_do_update(index_elements=conflict_cols, set_=update_cols)
    await db.execute(stmt)


async def _run(sqlite_path: Path) -> None:
    src = _open_sqlite(sqlite_path)
    print(f"📂 SQLite manba: {sqlite_path}")
    async with AsyncSessionLocal() as db:
        print("→ counterparties...")
        c = await _migrate_counterparties(db, src)
        print(f"   ✅ {c} ta kontragent")

        print("→ pavilions (seed)...")
        p = await _migrate_pavilions(db)
        print(f"   ✅ {p} ta pavilion")

        print("→ shops...")
        s = await _migrate_shops(db, src)
        print(f"   ✅ {s} ta magazin")

        print("→ monthly_balances...")
        b = await _migrate_balances(db, src)
        print(f"   ✅ {b} ta balans")

        print("→ settings...")
        st = await _migrate_settings(db)
        print(f"   ✅ {st} ta sozlama")

    src.close()
    print("🎉 Migratsiya tugadi.")


def _default_sqlite_path() -> Path:
    """Docker'da /data/bazar.db, local'da ../data/bazar.db."""
    for cand in (Path("/data/bazar.db"), Path(__file__).resolve().parents[3] / "data" / "bazar.db"):
        if cand.exists():
            return cand
    return Path("/data/bazar.db")


def main() -> None:
    parser = argparse.ArgumentParser(description="SQLite -> PostgreSQL migratsiya")
    parser.add_argument(
        "--sqlite",
        type=Path,
        default=_default_sqlite_path(),
        help="bazar.db yo'li",
    )
    args = parser.parse_args()
    asyncio.run(_run(args.sqlite))


if __name__ == "__main__":
    main()
