"""Google Sheets CSV fetch — in-memory TTL cache bilan.

Yerto'la magazinlari Google Sheets'dan olinadi. Cache server xotirasida (barcha
foydalanuvchilar uchun umumiy), localStorage'da emas.
"""
import csv
import io
import time

import httpx

from app.config import settings

# In-memory cache: barcha so'rovlar uchun umumiy (server xotirasi)
_cache: dict[str, tuple[float, list[dict]]] = {}


async def fetch_sheets_rows(force: bool = False) -> list[dict]:
    """
    Sheets CSV'ni o'qib, qatorlar ro'yxatini (dict) qaytaradi.

    Cache TTL (settings.SHEETS_CACHE_TTL_SECONDS) ichida qayta yuklamaydi.
    """
    url = settings.SHEETS_CSV_URL
    if not url:
        return []

    now = time.time()
    cached = _cache.get(url)
    if not force and cached and (now - cached[0]) < settings.SHEETS_CACHE_TTL_SECONDS:
        return cached[1]

    async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        text = resp.text

    reader = csv.DictReader(io.StringIO(text))
    rows = [dict(r) for r in reader]
    _cache[url] = (now, rows)
    return rows


def cache_info() -> dict:
    url = settings.SHEETS_CSV_URL
    cached = _cache.get(url)
    if not cached:
        return {"cached": False, "rows": 0, "age_seconds": None}
    return {
        "cached": True,
        "rows": len(cached[1]),
        "age_seconds": round(time.time() - cached[0], 1),
    }
