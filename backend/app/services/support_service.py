"""Tex-podderjka to'lov logikasi.

Qoidalar:
- Bozor yaratilgandan keyin 3 oy TEKIN.
- Keyin har oy 2.4 mln so'm.
- Owner qo'lda har oy uchun "to'landi" deb belgilaydi.
- Joriy oy uchun oyning 6-sanasigacha to'lanmasa — ogohlantirish (banner).
- Owner bozorni qo'lda bloklashi mumkin (support_blocked).
"""
from datetime import date, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.market import Market
from app.models.support_payment import (
    SUPPORT_DUE_DAY, SUPPORT_FREE_MONTHS, SUPPORT_MONTHLY_FEE, SupportPayment,
)


def _add_months(d: date, months: int) -> date:
    """Sanaga oy qo'shadi (kutubxonasiz)."""
    m = d.month - 1 + months
    y = d.year + m // 12
    m = m % 12 + 1
    # oxirgi kun muammosi: oddiy holatda kun saqlanadi, oshib ketsa kamaytiramiz
    day = min(d.day, [31, 29 if y % 4 == 0 and (y % 100 != 0 or y % 400 == 0) else 28,
                      31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1])
    return date(y, m, day)


def _free_until(created: datetime) -> date:
    """Tekin davr tugaydigan sana (yaratilgan + 3 oy)."""
    return _add_months(created.date(), SUPPORT_FREE_MONTHS)


def is_in_free_period(market: Market, today: date | None = None) -> bool:
    today = today or date.today()
    return today < _free_until(market.created_at)


async def get_support_status(db: AsyncSession, market: Market, today: date | None = None) -> dict:
    """Bozorning tex-podderjka holati: tekinmi, joriy oy to'langanmi, ogohlantirishmi."""
    today = today or date.today()
    free = is_in_free_period(market, today)
    free_until = _free_until(market.created_at)

    # Joriy oy to'lovi
    paid_this_month = False
    if not free:
        row = await db.execute(
            select(SupportPayment).where(
                SupportPayment.market_id == market.id,
                SupportPayment.year == today.year,
                SupportPayment.month == today.month,
            )
        )
        sp = row.scalar_one_or_none()
        paid_this_month = bool(sp and sp.is_paid)

    # Ogohlantirish: tekin emas, to'lanmagan va oyning 6-sanasidan o'tgan
    needs_warning = (not free) and (not paid_this_month) and (today.day > SUPPORT_DUE_DAY)
    # Yoki hali 6-sanagacha bo'lsa ham to'lanmagan bo'lsa — yumshoq eslatma
    pending = (not free) and (not paid_this_month)

    # E'tibor darajasi (super dashboard rangi uchun):
    #   blocked  — bloklangan (eng jiddiy)
    #   red      — to'lanmagan va oyning 5-sanasidan o'tgan (kechikkan)
    #   yellow   — to'lanmagan, lekin hali 1-5 sanalar oralig'ida
    #   ok       — to'langan
    #   free     — tekin davr
    if market.support_blocked:
        attention = "blocked"
    elif free:
        attention = "free"
    elif paid_this_month:
        attention = "ok"
    elif today.day > 5:
        attention = "red"
    else:
        attention = "yellow"

    return {
        "free_period": free,
        "free_until": free_until.isoformat(),
        "monthly_fee": float(SUPPORT_MONTHLY_FEE),
        "paid_this_month": paid_this_month,
        "needs_warning": needs_warning,
        "pending": pending,
        "support_blocked": market.support_blocked,
        "due_day": SUPPORT_DUE_DAY,
        "attention": attention,
    }


async def mark_payment(
    db: AsyncSession, market_id: int, year: int, month: int, is_paid: bool, notes: str | None = None
) -> SupportPayment:
    """Owner shu oy uchun to'lov holatini belgilaydi (upsert)."""
    row = await db.execute(
        select(SupportPayment).where(
            SupportPayment.market_id == market_id,
            SupportPayment.year == year,
            SupportPayment.month == month,
        )
    )
    sp = row.scalar_one_or_none()
    if sp is None:
        sp = SupportPayment(
            market_id=market_id, year=year, month=month,
            amount=SUPPORT_MONTHLY_FEE, is_paid=is_paid,
            paid_at=datetime.now() if is_paid else None, notes=notes,
        )
        db.add(sp)
    else:
        sp.is_paid = is_paid
        sp.paid_at = datetime.now() if is_paid else None
        if notes is not None:
            sp.notes = notes
    await db.flush()
    return sp


async def list_payments(db: AsyncSession, market_id: int) -> list[SupportPayment]:
    """Bozorning barcha to'lov yozuvlari (oxirgidan boshlab)."""
    row = await db.execute(
        select(SupportPayment)
        .where(SupportPayment.market_id == market_id)
        .order_by(SupportPayment.year.desc(), SupportPayment.month.desc())
    )
    return list(row.scalars())
