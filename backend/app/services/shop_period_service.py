"""Magazin davrlari (shop_periods) bilan ishlash.

Ikki vazifa:

1. YOZISH — `apply_shop_change()`: magazin egasi yoki ijara narxi o'zgarganda
   amaldagi davrni yopib, yangisini ochadi. Shu sababli o'tgan oy hisoboti
   keyingi o'zgarishlardan himoyalanadi.

2. O'QISH — `periods_at()`: berilgan SANADA amal qilgan holatni qaytaradi.
   Hisobotlar `shops` jadvalidagi bugungi qiymat o'rniga shundan foydalanadi.
"""
from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.shop_period import ShopPeriod


def _dec(v) -> Decimal:
    try:
        return Decimal(str(v or 0))
    except Exception:  # noqa: BLE001
        return Decimal(0)


async def open_period(
    db: AsyncSession, market_id: int, shop_id: str
) -> ShopPeriod | None:
    """Magazinning hozir ochiq (valid_to IS NULL) davri."""
    return (await db.execute(
        select(ShopPeriod).where(
            ShopPeriod.market_id == market_id,
            ShopPeriod.shop_id == shop_id,
            ShopPeriod.valid_to.is_(None),
        ).order_by(ShopPeriod.valid_from.desc()).limit(1)
    )).scalars().first()


async def apply_shop_change(
    db: AsyncSession,
    *,
    market_id: int,
    shop_id: str,
    inn: str | None,
    monthly_rent: Decimal | float | int | None,
    counterparty_name: str | None = None,
    effective_from: date | None = None,
    source: str | None = None,
) -> bool:
    """Yangi holatni davr sifatida yozadi. O'zgarish bo'lmasa — hech narsa.

    Qaytaradi: True — yangi davr ochildi, False — o'zgarish yo'q.

    DIQQAT: `flush` qilinadi, lekin `commit` QILINMAYDI — chaqiruvchi
    tranzaksiyani o'zi yopadi (import snapshot/rollback bilan ishlaydi).
    """
    eff = effective_from or date.today()
    new_rent = _dec(monthly_rent)
    new_inn = (inn or None)

    cur = await open_period(db, market_id, shop_id)

    if cur is not None:
        # O'zgarish bormi?
        if (cur.inn or None) == new_inn and _dec(cur.monthly_rent) == new_rent:
            # Nom aniqlashtirilgan bo'lsa — uni yangilash tarixni buzmaydi
            if counterparty_name and cur.counterparty_name != counterparty_name:
                cur.counterparty_name = counterparty_name
            return False

        # Eski davrni o'zgarish kunidan BIR KUN OLDIN yopamiz.
        # Agar davr aynan shu kuni ochilgan bo'lsa (kun ichida ikkinchi
        # o'zgarish) — yangi yozuv yaratmasdan o'shanining ustiga yozamiz,
        # aks holda uzunligi 0 bo'lgan davr paydo bo'lardi.
        if cur.valid_from >= eff:
            cur.inn = new_inn
            cur.monthly_rent = new_rent
            if counterparty_name:
                cur.counterparty_name = counterparty_name
            if source:
                cur.source = source
            await db.flush()
            return True
        cur.valid_to = eff - timedelta(days=1)

    db.add(ShopPeriod(
        market_id=market_id,
        shop_id=shop_id,
        inn=new_inn,
        counterparty_name=counterparty_name,
        monthly_rent=new_rent,
        valid_from=eff,
        valid_to=None,
        source=source,
    ))
    await db.flush()
    return True


async def periods_at(
    db: AsyncSession, market_id: int, shop_ids: list[str], on_date: date
) -> dict[str, ShopPeriod]:
    """Berilgan sanada amal qilgan davrlar: shop_id -> ShopPeriod.

    Yozuvi bo'lmagan magazin lug'atga tushmaydi — chaqiruvchi bunday holatda
    `shops` jadvalidagi bugungi qiymatga qaytadi.
    """
    if not shop_ids:
        return {}
    rows = (await db.execute(
        select(ShopPeriod).where(
            ShopPeriod.market_id == market_id,
            ShopPeriod.shop_id.in_(shop_ids),
            ShopPeriod.valid_from <= on_date,
        ).order_by(ShopPeriod.shop_id, ShopPeriod.valid_from)
    )).scalars()

    out: dict[str, ShopPeriod] = {}
    for p in rows:
        if p.valid_to is not None and p.valid_to < on_date:
            continue  # davr shu sanadan oldin yopilgan
        # valid_from bo'yicha o'sish tartibida — oxirgi mos keluvchi qoladi
        out[p.shop_id] = p
    return out


async def rent_map_for_month(
    db: AsyncSession,
    market_id: int,
    shop_ids: list[str],
    year: int,
    month: int,
    fallback: dict[str, Decimal],
) -> dict[str, Decimal]:
    """Shu OY uchun amal qilgan ijara summalari (oy oxiridagi holat).

    Davr yozuvi bo'lmagan magazin uchun `fallback` (bugungi monthly_rent)
    qiymati qoladi. Jadval hali yaratilmagan bo'lsa ham xato bermaydi.
    """
    import calendar as _cal

    out = dict(fallback)
    if not shop_ids:
        return out
    on_date = date(year, month, _cal.monthrange(year, month)[1])
    try:
        periods = await periods_at(db, market_id, shop_ids, on_date)
    except Exception:  # noqa: BLE001
        return out
    for sid, p in periods.items():
        out[sid] = _dec(p.monthly_rent)
    return out
