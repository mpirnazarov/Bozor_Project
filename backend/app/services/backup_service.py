"""DB backup xizmati — pg_dump orqali to'liq backup (fayllar ham DB ichida).

Backuplar Railway Volume'ga (.sql.gz) saqlanadi. Har backup BackupLog'ga yoziladi.
Restore — pg_dump faylни psql orqali qaytaradi (xavfli, parol bilan himoyalangan).

XAVFSIZLIK:
- pg_dump/psql credential'larni DATABASE_URL'dan oladi (env'da).
- Restore faqat owner paroli tasdiqlanganda ishlaydi (endpointда tekshiriladi).
"""
import asyncio
import gzip
import os
import shutil
import time
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.backup_log import BackupLog
from app.services import s3_service


def _backup_dir() -> Path:
    """Backup papkasi. Volume mavjud bo'lmasa /tmp'ga tushadi."""
    d = Path(settings.BACKUP_DIR)
    try:
        d.mkdir(parents=True, exist_ok=True)
        # yozish mumkinligini tekshiramiz
        test = d / ".write_test"
        test.write_text("ok")
        test.unlink()
        return d
    except Exception:  # noqa: BLE001
        fallback = Path("/tmp/backups")
        fallback.mkdir(parents=True, exist_ok=True)
        return fallback


_PG_BIN_DIRS = [
    "/usr/lib/postgresql/18/bin",
    "/usr/lib/postgresql/17/bin",
    "/usr/local/bin",
    "/usr/bin",
]


def _find_bin(name: str) -> str | None:
    """pg_dump/psql ni PATH'dan yoki ma'lum papkalardan topadi."""
    found = shutil.which(name)
    if found:
        return found
    for d in _PG_BIN_DIRS:
        candidate = os.path.join(d, name)
        if os.path.exists(candidate) and os.access(candidate, os.X_OK):
            return candidate
    return None


def is_available() -> bool:
    """pg_dump o'rnatilganmi?"""
    return _find_bin("pg_dump") is not None


async def _run(cmd: list[str], stdin_bytes: bytes | None = None) -> tuple[int, bytes, bytes]:
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdin=asyncio.subprocess.PIPE if stdin_bytes is not None else None,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    out, err = await proc.communicate(input=stdin_bytes)
    return proc.returncode or 0, out, err


async def create_backup(db: AsyncSession, trigger: str = "manual", user_id: int | None = None) -> BackupLog:
    """To'liq DB backup yaratadi (pg_dump | gzip) va Volume'ga saqlaydi."""
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    fname = f"orikzor_{ts}_{trigger}.sql.gz"
    bdir = _backup_dir()
    fpath = bdir / fname

    log = BackupLog(filename=fname, trigger=trigger, status="running", user_id=user_id)
    db.add(log)
    await db.commit()
    await db.refresh(log)

    start = time.monotonic()
    try:
        if not is_available():
            raise RuntimeError("pg_dump topilmadi (postgresql-client o'rnatilmagan)")

        # pg_dump --no-owner --no-acl --clean --if-exists  <DATABASE_URL>
        pg_dump_bin = _find_bin("pg_dump") or "pg_dump"
        cmd = [
            pg_dump_bin, settings.database_url_raw,
            "--no-owner", "--no-acl", "--clean", "--if-exists",
        ]
        code, out, err = await _run(cmd)
        if code != 0:
            raise RuntimeError(f"pg_dump xato (code {code}): {err.decode('utf-8', 'replace')[:300]}")

        # gzip va yozish
        with gzip.open(fpath, "wb", compresslevel=6) as f:
            f.write(out)

        size = fpath.stat().st_size
        log.status = "success"
        log.size_bytes = size
        log.duration_ms = int((time.monotonic() - start) * 1000)
        await db.commit()

        # Tashqi (S3/R2) ga yuklash — sozlangan bo'lsa
        if s3_service.is_enabled():
            ok_s3, key, s3_err = s3_service.upload_file(fpath, fname)
            log.s3_uploaded = ok_s3
            log.s3_key = key if ok_s3 else None
            log.s3_error = None if ok_s3 else s3_err
            await db.commit()

        # Eski backup'larni tozalash
        await _cleanup_old(db)
    except Exception as e:  # noqa: BLE001
        log.status = "failed"
        log.error = str(e)[:1000]
        log.duration_ms = int((time.monotonic() - start) * 1000)
        # Buzuq faylни o'chiramiz
        try:
            if fpath.exists():
                fpath.unlink()
        except Exception:  # noqa: BLE001
            pass
        await db.commit()
    await db.refresh(log)
    return log


async def _cleanup_old(db: AsyncSession) -> None:
    """GFS retention: kunlik(7) + haftalik(4) + oylik(12).

    Manual backuplar hech qachon avtomatik o'chirilmaydi.
    Har success-backup'ga category beriladi (daily/weekly/monthly) — ko'rsatish uchun.
    Keep to'plamiga kirmagan AUTO backuplar o'chiriladi.
    """
    rows = await db.execute(
        select(BackupLog).where(BackupLog.status == "success").order_by(BackupLog.created_at.desc())
    )
    logs = list(rows.scalars())  # eng yangi birinchi

    keep_ids: set[int] = set()
    # Har bir backupga "asosiy" kategoriya belgilaymiz (eng kuchli: monthly>weekly>daily)
    category_of: dict[int, str] = {}

    seen_days: set[str] = set()
    seen_weeks: set[str] = set()
    seen_months: set[str] = set()
    daily_kept = weekly_kept = monthly_kept = 0

    for b in logs:
        # Manual backup — doim saqlanadi, category=manual
        if b.trigger == "manual":
            keep_ids.add(b.id)
            category_of[b.id] = "manual"
            continue

        created = b.created_at
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        day_key = created.strftime("%Y-%m-%d")
        iso = created.isocalendar()
        week_key = f"{iso[0]}-W{iso[1]:02d}"
        month_key = created.strftime("%Y-%m")

        cat = None
        # Kunlik: har kunning eng yangisi, oxirgi 7 kun
        if day_key not in seen_days and daily_kept < settings.BACKUP_KEEP_DAILY:
            seen_days.add(day_key)
            daily_kept += 1
            keep_ids.add(b.id)
            cat = "daily"
        # Haftalik: har ISO-haftaning eng yangisi, 4 ta (kunlikdan tashqari haftalar)
        if cat is None and week_key not in seen_weeks and weekly_kept < settings.BACKUP_KEEP_WEEKLY:
            seen_weeks.add(week_key)
            weekly_kept += 1
            keep_ids.add(b.id)
            cat = "weekly"
        # Oylik: har oyning eng yangisi, 12 ta (yuqoridagilardan tashqari oylar)
        if cat is None and month_key not in seen_months and monthly_kept < settings.BACKUP_KEEP_MONTHLY:
            seen_months.add(month_key)
            monthly_kept += 1
            keep_ids.add(b.id)
            cat = "monthly"

        # Kunlik/haftalik saqlangan backup o'z hafta/oyini ham "band" qiladi
        # (keyingi haftalik/oylik boshqa davrdan tanlansin)
        if b.id in keep_ids:
            seen_weeks.add(week_key)
            seen_months.add(month_key)

        if cat:
            category_of[b.id] = cat

    bdir = _backup_dir()
    for b in logs:
        if b.id in keep_ids:
            # Kategoriyani yangilaymiz (ko'rsatish uchun)
            new_cat = category_of.get(b.id, b.category)
            if b.category != new_cat:
                b.category = new_cat
            continue
        # Keep'da yo'q — o'chiramiz (faqat auto)
        try:
            fp = bdir / b.filename
            if fp.exists():
                fp.unlink()
        except Exception:  # noqa: BLE001
            pass
        if b.s3_key:
            try:
                s3_service.delete_key(b.s3_key)
            except Exception:  # noqa: BLE001
                pass
        await db.delete(b)
    await db.commit()


def backup_path(filename: str) -> Path | None:
    """Backup faylining yo'li (mavjud bo'lsa)."""
    # Xavfsizlik: faqat fayl nomi (path traversal yo'q)
    safe = os.path.basename(filename)
    fp = _backup_dir() / safe
    return fp if fp.exists() else None


async def restore_backup(db: AsyncSession, backup_id: int) -> tuple[bool, str]:
    """Backupни qaytaradi (psql orqali). XAVFLI — joriy ma'lumotlar almashtiriladi."""
    log = await db.get(BackupLog, backup_id)
    if log is None or log.status != "success":
        return False, "Backup topilmadi yoki muvaffaqiyatsiz"
    fp = backup_path(log.filename)
    # Lokal fayl yo'q bo'lsa, tashqi (S3/R2) dan yuklab olishga urinamiz
    if fp is None and log.s3_key and s3_service.is_enabled():
        target = _backup_dir() / os.path.basename(log.filename)
        ok_dl, dl_err = s3_service.download_to(log.s3_key, target)
        if ok_dl:
            fp = target
        else:
            return False, f"Lokal fayl yo'q, S3 dan yuklab bo'lmadi: {dl_err}"
    if fp is None:
        return False, "Backup fayli topilmadi (lokal ham, tashqi ham yo'q)"
    psql_bin = _find_bin("psql")
    if not is_available() or psql_bin is None:
        return False, "psql topilmadi (postgresql-client o'rnatilmagan)"

    try:
        with gzip.open(fp, "rb") as f:
            sql_bytes = f.read()
        code, out, err = await _run([psql_bin, settings.database_url_raw], stdin_bytes=sql_bytes)
        if code != 0:
            return False, f"Restore xato (code {code}): {err.decode('utf-8', 'replace')[:300]}"
        return True, "Backup muvaffaqiyatli qaytarildi"
    except Exception as e:  # noqa: BLE001
        return False, f"Restore xato: {str(e)[:300]}"


async def list_backups(db: AsyncSession, limit: int = 50) -> list[BackupLog]:
    rows = await db.execute(
        select(BackupLog).order_by(BackupLog.created_at.desc()).limit(limit)
    )
    return list(rows.scalars())
