"""Kunlik avtomatik backup rejalashtiruvchi (oddiy asyncio loop).

Tashqi kutubxonasiz: har soatda tekshiradi, agar belgilangan soat (UTC) bo'lsa
va o'sha kuni hali auto-backup bo'lmagan bo'lsa — backup yaratadi.
"""
import asyncio
from datetime import datetime, timezone

from sqlalchemy import select

from app.config import settings
from app.database import AsyncSessionLocal
from app.models.backup_log import BackupLog
from app.services.backup_service import create_backup, is_available

_task: asyncio.Task | None = None


async def _already_backed_up_today() -> bool:
    today = datetime.now(timezone.utc).date()
    async with AsyncSessionLocal() as db:
        rows = await db.execute(
            select(BackupLog).where(
                BackupLog.trigger == "auto", BackupLog.status == "success"
            ).order_by(BackupLog.created_at.desc()).limit(1)
        )
        last = rows.scalar_one_or_none()
        if last is None:
            return False
        created = last.created_at
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        return created.date() == today


async def _loop() -> None:
    # Ishga tushgandan 60s keyin boshlaymiz (migration tugashi uchun)
    await asyncio.sleep(60)
    while True:
        try:
            now = datetime.now(timezone.utc)
            if is_available() and now.hour == settings.BACKUP_HOUR_UTC:
                if not await _already_backed_up_today():
                    async with AsyncSessionLocal() as db:
                        await create_backup(db, trigger="auto")
                    print(f"✅ Avtomatik backup bajarildi ({now.isoformat()})")
        except Exception as e:  # noqa: BLE001
            print(f"⚠️ Avtomatik backup xatosi: {e}")

        # Tex-podderjka invoicelarini avtomatik yaratish (kuniga bir marta tekshiriladi)
        try:
            now = datetime.now(timezone.utc)
            if now.hour == settings.BACKUP_HOUR_UTC:
                from app.services.invoice_service import generate_support_invoices
                async with AsyncSessionLocal() as db:
                    n = await generate_support_invoices(db)
                if n:
                    print(f"🧾 {n} ta tex-podderjka invoice yaratildi")
        except Exception as e:  # noqa: BLE001
            print(f"⚠️ Invoice generatsiya xatosi: {e}")

        # Har 30 daqiqada tekshiramiz (soat oynasini o'tkazib yubormaslik uchun)
        await asyncio.sleep(1800)


def start_scheduler() -> None:
    global _task
    if _task is None or _task.done():
        _task = asyncio.create_task(_loop())


def stop_scheduler() -> None:
    global _task
    if _task and not _task.done():
        _task.cancel()
        _task = None
