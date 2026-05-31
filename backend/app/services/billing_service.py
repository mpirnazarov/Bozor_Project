"""Billing biznes logikasi — magazin/INN statusini hisoblash.

Status INN darajasida hisoblanadi: magazinning INN'i bo'yicha joriy oy
monthly_balances yig'indisidan kelib chiqadi (bitta INN'da bir nechta magazin
bo'lishi mumkin — barchasi shu INN balansini ulashadi).
"""
from collections import defaultdict
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import MonthlyBalance, Shop
from app.schemas.billing import (
    BillingStatusOut,
    CategoryBalance,
    ShopStatus,
)

# Qisman to'lov chegarasi — kichik qoldiqlarni "qarzsiz" deb hisoblash uchun
_EPS = Decimal("1")


def _status_from_amounts(debt: Decimal, paid: Decimal, has_data: bool) -> ShopStatus:
    # DIQQAT: bu tizimda due_amount = QOLGAN QARZ. Shuning uchun bu yerga
    # to'g'ridan-to'g'ri qarz (debt) keladi, "to'liq hisob" emas.
    if not has_data:
        return ShopStatus.NO_DATA
    if debt <= _EPS:
        return ShopStatus.PAID
    if paid > _EPS:
        return ShopStatus.PARTIAL
    return ShopStatus.UNPAID


async def _balances_by_inn(
    db: AsyncSession, inns: list[str], year: int, month: int
) -> dict[str, list[MonthlyBalance]]:
    """Berilgan INN'lar uchun joriy oy balanslarini INN bo'yicha guruhlaydi."""
    if not inns:
        return {}
    result = await db.execute(
        select(MonthlyBalance).where(
            MonthlyBalance.inn.in_(inns),
            MonthlyBalance.year == year,
            MonthlyBalance.month == month,
        )
    )
    grouped: dict[str, list[MonthlyBalance]] = defaultdict(list)
    for bal in result.scalars():
        grouped[bal.inn].append(bal)
    return grouped


def _build_status(
    shop_id: str, inn: str | None, balances: list[MonthlyBalance]
) -> BillingStatusOut:
    # DIQQAT: due_amount = QOLGAN QARZ, paid_amount = to'langan.
    #   Qarz (debt)      = due_amount
    #   To'langan (paid) = paid_amount
    #   Jami (due/total) = paid_amount + due_amount
    cats: list[CategoryBalance] = []
    total_paid = Decimal(0)
    total_debt = Decimal(0)
    for b in balances:
        debt = b.due_amount if b.due_amount > 0 else Decimal(0)
        line_total = b.paid_amount + debt  # shu xizmat bo'yicha jami
        cats.append(
            CategoryBalance(
                category=b.category,
                due=line_total,      # "due" = jami hisoblangan (paid + qarz)
                paid=b.paid_amount,
                debt=debt,
            )
        )
        total_paid += b.paid_amount
        total_debt += debt

    has_data = len(balances) > 0
    status = _status_from_amounts(total_debt, total_paid, has_data)
    total_sum = total_paid + total_debt
    return BillingStatusOut(
        shop_id=shop_id,
        inn=inn,
        status=status,
        total_due=total_sum,      # Jami = to'langan + qarz
        total_paid=total_paid,
        total_debt=total_debt,
        categories=cats,
    )


async def compute_batch_status(
    db: AsyncSession, shop_ids: list[str], year: int, month: int
) -> dict[str, BillingStatusOut]:
    """Bir nechta magazin uchun billing statusini hisoblaydi (N+1 siz)."""
    if not shop_ids:
        return {}

    # shop_id -> inn
    rows = await db.execute(
        select(Shop.shop_id, Shop.inn).where(Shop.shop_id.in_(shop_ids))
    )
    shop_inn: dict[str, str | None] = {sid: inn for sid, inn in rows.all()}

    inns = [inn for inn in shop_inn.values() if inn]
    by_inn = await _balances_by_inn(db, list(set(inns)), year, month)

    out: dict[str, BillingStatusOut] = {}
    for sid in shop_ids:
        inn = shop_inn.get(sid)
        balances = by_inn.get(inn, []) if inn else []
        out[sid] = _build_status(sid, inn, balances)
    return out


async def compute_shop_status(
    db: AsyncSession, shop_id: str, inn: str | None, year: int, month: int
) -> BillingStatusOut:
    """Bitta magazin uchun billing statusi."""
    balances: list[MonthlyBalance] = []
    if inn:
        by_inn = await _balances_by_inn(db, [inn], year, month)
        balances = by_inn.get(inn, [])
    return _build_status(shop_id, inn, balances)
