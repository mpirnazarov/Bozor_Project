"""Dashboard biznes logikasi — settings o'qish yoki live hisoblash."""
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import DASHBOARD_SETTINGS_KEY, BillingCategory, MonthlyBalance, Setting
from app.schemas.dashboard import DashboardOut, Period, ServicesBreakdown

# settings yo'q bo'lsa ishlatiladigan zaxira qiymatlar (FAQAT orikzor uchun)
_FALLBACK = {
    "total": 11689498000,
    "paid": 10820572206,
    "services": {
        "rent": 9002499206,
        "arava": 164488000,
        "xojatxona": 247440000,
        "parking": 239792000,
        "boshqa": 1166353000,
    },
    "period": {"year": 2026, "month": 5},
}

# Yangi bozorlar uchun — 0 dan boshlanadi
_ZERO_STATS: dict = {
    "total": 0,
    "paid": 0,
    "services": {
        "rent": 0,
        "arava": 0,
        "xojatxona": 0,
        "parking": 0,
        "boshqa": 0,
    },
}


async def get_dashboard_from_settings(db: AsyncSession) -> DashboardOut:
    """settings.dashboard_stats'dan o'qiydi (admin tahrirlagan qiymatlar)."""
    setting = await db.get(Setting, DASHBOARD_SETTINGS_KEY)
    data = setting.value if setting and isinstance(setting.value, dict) else _FALLBACK

    total = int(data.get("total", 0))
    paid = int(data.get("paid", 0))
    services = data.get("services", {})
    period = data.get("period", _FALLBACK["period"])

    return DashboardOut(
        total=total,
        paid=paid,
        debt=total - paid,
        services=ServicesBreakdown(**services),
        period=Period(**period),
        source="settings",
    )


def get_dashboard_from_market(market) -> DashboardOut:
    """Market.dashboard_stats'dan o'qiydi — yangi bozorlar uchun (0 dan boshlaydi).

    market.dashboard_stats bo'sh yoki yo'q bo'lsa — noldan boshlaydi.
    """
    from datetime import date as _date
    data = market.dashboard_stats or {}
    # Bo'sh stats — 0 dan boshlash
    if not data:
        data = _ZERO_STATS

    total = int(data.get("total", 0))
    paid = int(data.get("paid", 0))
    services = data.get("services", {})
    today = _date.today()
    period = data.get("period", {"year": today.year, "month": today.month})

    return DashboardOut(
        total=total,
        paid=paid,
        debt=max(0, total - paid),
        services=ServicesBreakdown(
            rent=int(services.get("rent", 0)),
            arava=int(services.get("arava", 0)),
            xojatxona=int(services.get("xojatxona", 0)),
            parking=int(services.get("parking", 0)),
            boshqa=int(services.get("boshqa", 0)),
        ),
        period=Period(**period),
        source="settings",
    )


async def get_dashboard_live(
    db: AsyncSession, year: int, month: int, market_id: int | None = None
) -> DashboardOut:
    """monthly_balances'dan jonli hisoblaydi (real ma'lumot tugmasi uchun)."""
    # Kategoriya bo'yicha due/paid yig'indisi
    q = (
        select(
            MonthlyBalance.category,
            func.coalesce(func.sum(MonthlyBalance.due_amount), 0),
            func.coalesce(func.sum(MonthlyBalance.paid_amount), 0),
        )
        .where(MonthlyBalance.year == year, MonthlyBalance.month == month)
        .group_by(MonthlyBalance.category)
    )
    if market_id is not None:
        q = q.where(MonthlyBalance.market_id == market_id)
    result = await db.execute(q)

    due_by_cat: dict[str, Decimal] = {}
    paid_by_cat: dict[str, Decimal] = {}
    for cat, due, paid in result.all():
        due_by_cat[cat] = Decimal(due)
        paid_by_cat[cat] = Decimal(paid)

    # DIQQAT: bu tizimda har (INN, kategoriya) saldosi:
    #   Дебет (due_amount) = QARZ (to'lanmagan), Кредит (paid_amount) = TO'LANGAN.
    # Shuning uchun:
    #   Qarz       = sum(due_amount)
    #   To'langan  = sum(paid_amount)
    #   Jami (начислено) = To'langan + Qarz
    total_debt = sum(due_by_cat.values(), Decimal(0))
    total_paid = sum(paid_by_cat.values(), Decimal(0))
    total_sum = total_paid + total_debt

    # Live rejimda breakdown faqat rent/electricity/water mavjud — arava,
    # xojatxona, parking, boshqa DB'da alohida saqlanmaydi, shuning uchun 0.
    rent_paid = paid_by_cat.get(BillingCategory.RENT.value, Decimal(0))

    return DashboardOut(
        total=int(total_sum),
        paid=int(total_paid),
        debt=int(total_debt),
        services=ServicesBreakdown(
            rent=int(rent_paid),
            arava=0,
            xojatxona=0,
            parking=0,
            boshqa=0,
        ),
        period=Period(year=year, month=month),
        source="live",
    )
