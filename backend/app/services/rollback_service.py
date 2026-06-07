"""Rollback xizmati — amallarni ortga qaytarish (oxirgi 24 soat).

Har bir o'zgartiruvchi amal oldidan ta'sirlanadigan yozuvlarning oldingi
holati ChangeSnapshot'ga yoziladi. Revert qilinganda faqat o'sha yozuvlar
oldingi holatiga qaytariladi (yangi yaratilganlari o'chiriladi).
"""
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import and_, delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import MonthlyBalance
from app.models.change_snapshot import ChangeSnapshot

REVERT_WINDOW_HOURS = 24

# Qaysi jadvallarni qaytarish mumkin va ularning kalit/maydonlari
_TABLE_MODELS = {
    "monthly_balances": MonthlyBalance,
}
_NUMERIC_FIELDS = {"due_amount", "paid_amount"}


async def save_snapshot(
    db: AsyncSession,
    *,
    action: str,
    table_name: str,
    before_rows: list[dict],
    user_id: int | None,
    market_id: int | None,
    summary: str | None = None,
    audit_id: int | None = None,
) -> ChangeSnapshot:
    """Amal oldidan olingan snapshotni saqlaydi."""
    snap = ChangeSnapshot(
        audit_id=audit_id,
        user_id=user_id,
        market_id=market_id,
        action=action,
        table_name=table_name,
        before_rows=before_rows,
        summary=summary,
    )
    db.add(snap)
    await db.flush()
    return snap


async def list_revertable(db: AsyncSession, hours: int = REVERT_WINDOW_HOURS) -> list[ChangeSnapshot]:
    """Oxirgi N soatdagi, hali qaytarilmagan snapshotlar."""
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    rows = await db.execute(
        select(ChangeSnapshot)
        .where(ChangeSnapshot.created_at >= since, ChangeSnapshot.reverted.is_(False))
        .order_by(ChangeSnapshot.created_at.desc())
    )
    return list(rows.scalars())


async def revert_snapshot(db: AsyncSession, snapshot_id: int) -> tuple[bool, str]:
    """Snapshotni qaytaradi. (ok, xabar)."""
    snap = await db.get(ChangeSnapshot, snapshot_id)
    if snap is None:
        return False, "Snapshot topilmadi"
    if snap.reverted:
        return False, "Bu amal allaqachon qaytarilgan"

    # Vaqt oynasi tekshiruvi
    created = snap.created_at
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) - created > timedelta(hours=REVERT_WINDOW_HOURS):
        return False, f"Faqat oxirgi {REVERT_WINDOW_HOURS} soatdagi amallar qaytariladi"

    model = _TABLE_MODELS.get(snap.table_name)
    if model is None:
        return False, f"'{snap.table_name}' jadvali qaytarishni qo'llab-quvvatlamaydi"

    restored = 0
    deleted = 0
    for item in snap.before_rows:
        key = item.get("key") or {}
        before = item.get("before")
        # Kalit bo'yicha WHERE shartlari
        conds = [getattr(model, k) == v for k, v in key.items()]
        if before is None:
            # Amal paytida yangi yaratilgan — o'chiramiz
            await db.execute(delete(model).where(and_(*conds)))
            deleted += 1
        else:
            # Oldingi qiymatlarga qaytaramiz (upsert)
            values = dict(key)
            for fld, val in before.items():
                values[fld] = Decimal(val) if fld in _NUMERIC_FIELDS else val
            stmt = pg_insert(model.__table__).values(values)
            update_cols = {k: stmt.excluded[k] for k in before}
            stmt = stmt.on_conflict_do_update(
                index_elements=["inn", "year", "month", "category"],
                set_=update_cols,
            )
            await db.execute(stmt)
            restored += 1

    snap.reverted = True
    snap.reverted_at = datetime.now(timezone.utc)
    await db.commit()
    return True, f"Qaytarildi: {restored} yozuv tiklandi, {deleted} yozuv o'chirildi"
