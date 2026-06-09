"""ATJ5 (yoki istalgan blok) bo'yicha qarzdorlik hisobini JADVAL qilib chiqaradi.

Ishlatish (Railway backend service'da yoki DB'ga ulangan muhitda):
    python -m scripts.atj5_table              # ATJ5 ni qidiradi
    python -m scripts.atj5_table "ATJ5"       # nom bo'yicha
    python -m scripts.atj5_table --year 2026 --month 5

Ustunlar:
    Blok | Magazin ID | INN | To'lashi kerak (monthly_rent) | INN qarzi (billing) | Magazin qarz ulushi
Tagida har ustun bo'yicha JAMI.
"""
import asyncio
import sys
from datetime import date
from decimal import Decimal

from sqlalchemy import func, select

from app.database import AsyncSessionLocal
from app.models import MonthlyBalance, Shop
from app.models.pavilion import Pavilion


def _arg(flag: str, default=None):
    if flag in sys.argv:
        i = sys.argv.index(flag)
        if i + 1 < len(sys.argv):
            return sys.argv[i + 1]
    return default


async def main() -> None:
    # Blok nomi (ATJ5) — argument yoki default
    name = None
    for a in sys.argv[1:]:
        if not a.startswith("--"):
            name = a
            break
    name = name or "ATJ5"
    today = date.today()
    year = int(_arg("--year", today.year))
    month = int(_arg("--month", today.month))

    async with AsyncSessionLocal() as db:
        # 1) Pavilionni topamiz (display_name yoki meta.shop_prefix bo'yicha)
        pavs = (await db.execute(select(Pavilion))).scalars().all()
        pav = None
        for p in pavs:
            dn = (p.display_name or "").upper()
            pref = ""
            if isinstance(p.meta, dict):
                pref = (p.meta.get("shop_prefix") or "").upper()
            if name.upper() in (dn, pref) or name.upper() in dn:
                pav = p
                break
        if pav is None:
            print(f"❌ '{name}' bloki topilmadi. Mavjud bloklar:")
            for p in pavs[:50]:
                pref = p.meta.get("shop_prefix") if isinstance(p.meta, dict) else ""
                print(f"   id={p.id} name={p.display_name!r} prefix={pref!r}")
            return

        # 2) Blok magazinlari
        prefix = None
        if isinstance(pav.meta, dict):
            prefix = (pav.meta.get("shop_prefix") or "").strip() or None
        if prefix:
            shops = (await db.execute(
                select(Shop).where(
                    Shop.market_id == pav.market_id,
                    Shop.shop_id.like(f"{prefix}-%"),
                    Shop.is_active.is_(True),
                ).order_by(Shop.shop_id)
            )).scalars().all()
        else:
            shops = (await db.execute(
                select(Shop).where(Shop.pavilion_id == pav.id, Shop.is_active.is_(True))
                .order_by(Shop.shop_id)
            )).scalars().all()

        inns = list({s.inn for s in shops if s.inn})

        # 3) Har INN qarzi (Дебет yig'indisi, barcha kategoriya)
        inn_debt: dict[str, Decimal] = {}
        if inns:
            rows = (await db.execute(
                select(MonthlyBalance.inn, func.coalesce(func.sum(MonthlyBalance.due_amount), 0))
                .where(
                    MonthlyBalance.inn.in_(inns),
                    MonthlyBalance.year == year,
                    MonthlyBalance.month == month,
                    MonthlyBalance.due_amount > 0,
                ).group_by(MonthlyBalance.inn)
            )).all()
            inn_debt = {inn: Decimal(str(d)) for inn, d in rows}

        # 4) Har INN ning butun bozordagi aktiv magazinlar soni (taqsimot uchun)
        inn_count: dict[str, int] = {}
        if inns:
            crows = (await db.execute(
                select(Shop.inn, func.count(Shop.shop_id))
                .where(Shop.inn.in_(inns), Shop.is_active.is_(True))
                .group_by(Shop.inn)
            )).all()
            inn_count = {inn: int(c) for inn, c in crows}

        # 5) Jadval
        blok = pav.display_name
        hdr = f"{'Blok':<8}{'Magazin ID':<22}{'INN':<14}{'To‘lashi kerak':>18}{'INN qarzi':>18}{'Magazin ulushi':>18}"
        print("\n" + hdr)
        print("-" * len(hdr))

        t_rent = Decimal(0)
        t_inn_debt_unique = Decimal(0)
        t_share = Decimal(0)
        seen_inn: set[str] = set()

        for s in shops:
            inn = s.inn or "—"
            rent = Decimal(str(s.monthly_rent or 0))
            debt_full = inn_debt.get(s.inn, Decimal(0)) if s.inn else Decimal(0)
            n = max(inn_count.get(s.inn, 1), 1) if s.inn else 1
            share = debt_full / n
            t_rent += rent
            t_share += share
            if s.inn and s.inn not in seen_inn:
                seen_inn.add(s.inn)
                t_inn_debt_unique += debt_full
            print(f"{blok:<8}{s.shop_id:<22}{inn:<14}{rent:>18,.0f}{debt_full:>18,.0f}{share:>18,.0f}")

        print("-" * len(hdr))
        print(f"{'JAMI':<8}{len(shops):<22}{'':<14}{t_rent:>18,.0f}{t_inn_debt_unique:>18,.0f}{t_share:>18,.0f}")
        print(f"\nBlok: {blok}  |  Magazinlar: {len(shops)}  |  Davr: {month:02d}.{year}")
        print(f"To‘lashi kerak (JAMI monthly_rent) = {t_rent:,.0f} so‘m")
        print(f"INN qarzi (noyob INN bo‘yicha)      = {t_inn_debt_unique:,.0f} so‘m")
        print(f"Magazin qarz ulushi (JAMI)          = {t_share:,.0f} so‘m  <- modaldagi 'Qarzdorlik'")
        print(f"To‘langan = Jami − Qarzdorlik        = {t_rent - t_share:,.0f} so‘m")


if __name__ == "__main__":
    asyncio.run(main())
