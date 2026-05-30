"""Dashboard biznes logikasi — settings o'qish yoki live hisoblash."""
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import DASHBOARD_SETTINGS_KEY, BillingCategory, MonthlyBalance, Setting
from app.schemas.dashboard import DashboardOut, Period, ServicesBreakdown

# settings yo'q bo'lsa ishlatiladigan zaxira qiymatlar
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


async def get_dashboard_live(
    db: AsyncSession, year: int, month: int
) -> DashboardOut:
    """monthly_balances'dan jonli hisoblaydi (real ma'lumot tugmasi uchun)."""
    # Kategoriya bo'yicha due/paid yig'indisi
    result = await db.execute(
        select(
            MonthlyBalance.category,
            func.coalesce(func.sum(MonthlyBalance.due_amount), 0),
            func.coalesce(func.sum(MonthlyBalance.paid_amount), 0),
        )
        .where(MonthlyBalance.year == year, MonthlyBalance.month == month)
        .group_by(MonthlyBalance.category)
    )

    due_by_cat: dict[str, Decimal] = {}
    paid_by_cat: dict[str, Decimal] = {}
    for cat, due, paid in result.all():
        due_by_cat[cat] = Decimal(due)
        paid_by_cat[cat] = Decimal(paid)

    total_due = sum(due_by_cat.values(), Decimal(0))
    total_paid = sum(paid_by_cat.values(), Decimal(0))

    # Live rejimda breakdown faqat rent/electricity/water mavjud — arava,
    # xojatxona, parking, boshqa DB'da alohida saqlanmaydi, shuning uchun 0.
    rent_paid = paid_by_cat.get(BillingCategory.RENT.value, Decimal(0))

    return DashboardOut(
        total=int(total_due),
        paid=int(total_paid),
        debt=int(total_due - total_paid),
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
