"""Ishga tushganda ma'lumotlarni avtomatik yuklash (demo uchun).

- Pavilion seed va settings doim yuklanadi (idempotent upsert).
- Agar DB'da magazin yo'q bo'lsa va bazar.db mavjud bo'lsa — to'liq SQLite
  migratsiyasini ishga tushiradi.
Bu skript xato bo'lsa ham serverni to'xtatmaydi (demo qulayligi uchun).
"""
import asyncio
from pathlib import Path

from sqlalchemy import func, select

from app.database import AsyncSessionLocal
from app.models import Shop


async def _shop_count() -> int:
    async with AsyncSessionLocal() as db:
        return await db.scalar(select(func.count()).select_from(Shop)) or 0


def _find_sqlite() -> Path | None:
    for cand in (
        Path("/app/bazar.db"),
        Path("/data/bazar.db"),
        Path(__file__).resolve().parents[3] / "data" / "bazar.db",
        Path("data/bazar.db"),
    ):
        if cand.exists():
            return cand
    return None


async def _run() -> None:
    try:
        count = await _shop_count()
    except Exception as e:  # noqa: BLE001
        print(f"⚠ startup_seed: DB tekshirib bo'lmadi ({e}) — o'tkazildi")
        return

    if count > 0:
        print(f"ℹ startup_seed: {count} ta magazin allaqachon bor — import o'tkazildi")
        # Pavilion/settings baribir yangilab qo'yamiz (idempotent)
        await _seed_only()
        return

    sqlite_path = _find_sqlite()
    if sqlite_path is None:
        print("ℹ startup_seed: bazar.db topilmadi — faqat pavilion/settings seed")
        await _seed_only()
        return

    print(f"→ startup_seed: to'liq migratsiya ({sqlite_path})")
    from app.scripts.migrate_from_sqlite import _run as migrate_run

    try:
        await migrate_run(sqlite_path)
    except Exception as e:  # noqa: BLE001
        print(f"⚠ startup_seed: migratsiya xatosi ({e})")


async def _seed_only() -> None:
    """Faqat pavilion va settings seed (magazinlarsiz)."""
    from app.scripts.migrate_from_sqlite import (
        _migrate_pavilions,
        _migrate_settings,
    )

    try:
        async with AsyncSessionLocal() as db:
            await _migrate_pavilions(db)
            await _migrate_settings(db)
        print("✅ startup_seed: pavilion + settings yangilandi")
    except Exception as e:  # noqa: BLE001
        print(f"⚠ startup_seed: seed xatosi ({e})")


def main() -> None:
    asyncio.run(_run())


if __name__ == "__main__":
    main()
