"""Ishga tushganda ma'lumotlarni avtomatik yuklash (demo uchun).

MUHIM: seed FAQAT birinchi marta (jadval bo'sh bo'lganda) ishlaydi.
Mavjud pavilion/magazinlar QAYTA YOZILMAYDI — shu sababli admin panelda
qilingan o'zgarishlar (region joylashuvi va h.k.) har deploy'da saqlanib qoladi.

Bu skript xato bo'lsa ham serverni to'xtatmaydi (demo qulayligi uchun).
"""
import asyncio
from pathlib import Path

from sqlalchemy import func, select

from app.database import AsyncSessionLocal
from app.models import Pavilion, Shop


async def _count(model) -> int:
    async with AsyncSessionLocal() as db:
        return await db.scalar(select(func.count()).select_from(model)) or 0


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
        shop_count = await _count(Shop)
        pav_count = await _count(Pavilion)
    except Exception as e:  # noqa: BLE001
        print(f"⚠ startup_seed: DB tekshirib bo'lmadi ({e}) — o'tkazildi")
        return

    # Magazinlar allaqachon bor — HECH NARSANI qayta yozmaymiz.
    # (pavilionlar ham mavjud, admin o'zgarishlari saqlanadi)
    if shop_count > 0:
        print(
            f"ℹ startup_seed: {shop_count} magazin, {pav_count} pavilion mavjud — "
            "seed o'tkazildi (admin o'zgarishlari saqlanadi)"
        )
        # Faqat pavilion umuman bo'lmasa (g'alati holat) — bir marta seed
        if pav_count == 0:
            await _seed_pavilions_only()
        return

    # Bu yerga faqat BIRINCHI deploy'da (DB butunlay bo'sh) yetib kelamiz
    sqlite_path = _find_sqlite()
    if sqlite_path is None:
        print("ℹ startup_seed: bazar.db topilmadi — faqat pavilion seed (birinchi marta)")
        await _seed_pavilions_only()
        return

    print(f"→ startup_seed: BIRINCHI to'liq migratsiya ({sqlite_path})")
    from app.scripts.migrate_from_sqlite import _run as migrate_run

    try:
        await migrate_run(sqlite_path)
    except Exception as e:  # noqa: BLE001
        print(f"⚠ startup_seed: migratsiya xatosi ({e})")


async def _seed_pavilions_only() -> None:
    """Faqat pavilion va settings seed — FAQAT bo'sh bo'lganda chaqiriladi."""
    from app.scripts.migrate_from_sqlite import _migrate_pavilions, _migrate_settings

    try:
        async with AsyncSessionLocal() as db:
            await _migrate_pavilions(db)
            await _migrate_settings(db)
        print("✅ startup_seed: pavilion + settings birinchi marta yuklandi")
    except Exception as e:  # noqa: BLE001
        print(f"⚠ startup_seed: seed xatosi ({e})")


def main() -> None:
    asyncio.run(_run())


if __name__ == "__main__":
    main()
