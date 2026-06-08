"""Tashqi backup saqlash — S3-mos (Cloudflare R2 / AWS S3 / Backblaze B2).

boto3 orqali ishlaydi. Sozlamalar bo'sh bo'lsa — o'chiq (faqat Volume'da saqlanadi).
"""
from pathlib import Path

from app.config import settings


def is_enabled() -> bool:
    # AWS S3 uchun endpoint shart emas (region'dan aniqlanadi).
    # R2/B2 uchun endpoint kerak. Shuning uchun faqat kalit+bucket majburiy.
    return bool(
        settings.S3_ACCESS_KEY
        and settings.S3_SECRET_KEY
        and settings.S3_BUCKET
    )


def _client():
    import boto3  # lokal import — boto3 yo'q bo'lsa ham app ishlayveradi
    from botocore.config import Config

    # AWS uchun region "auto" emas, aniq region kerak. "auto" faqat R2 uchun.
    region = settings.S3_REGION or "us-east-1"
    return boto3.client(
        "s3",
        endpoint_url=settings.S3_ENDPOINT_URL or None,  # AWS'da bo'sh — avtomatik
        aws_access_key_id=settings.S3_ACCESS_KEY,
        aws_secret_access_key=settings.S3_SECRET_KEY,
        region_name=region,
        config=Config(signature_version="s3v4", retries={"max_attempts": 3}),
    )


def _key(filename: str) -> str:
    prefix = (settings.S3_PREFIX or "").strip("/")
    return f"{prefix}/{filename}" if prefix else filename


def upload_file(local_path: Path, filename: str) -> tuple[bool, str, str]:
    """Faylni S3/R2 ga yuklaydi. (ok, key, error)."""
    if not is_enabled():
        return False, "", "S3 sozlanmagan"
    key = _key(filename)
    try:
        client = _client()
        client.upload_file(str(local_path), settings.S3_BUCKET, key)
        return True, key, ""
    except Exception as e:  # noqa: BLE001
        return False, key, str(e)[:300]


def download_to(key: str, local_path: Path) -> tuple[bool, str]:
    """S3/R2 dan faylni yuklab oladi (restore uchun, agar lokal yo'q bo'lsa)."""
    if not is_enabled():
        return False, "S3 sozlanmagan"
    try:
        client = _client()
        client.download_file(settings.S3_BUCKET, key, str(local_path))
        return True, ""
    except Exception as e:  # noqa: BLE001
        return False, str(e)[:300]


def delete_key(key: str) -> bool:
    if not is_enabled() or not key:
        return False
    try:
        client = _client()
        client.delete_object(Bucket=settings.S3_BUCKET, Key=key)
        return True
    except Exception:  # noqa: BLE001
        return False


def presigned_url(key: str, expires: int = 3600) -> str | None:
    """Vaqtinchalik yuklab olish havolasi (foydalanuvchi to'g'ridan-to'g'ri olсin)."""
    if not is_enabled() or not key:
        return None
    try:
        client = _client()
        return client.generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.S3_BUCKET, "Key": key},
            ExpiresIn=expires,
        )
    except Exception:  # noqa: BLE001
        return None
