"""Application configuration using pydantic-settings."""
from functools import lru_cache
from typing import Literal

from pydantic import Field, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings — environment variables'dan o'qiladi."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # Database (Railway "postgresql://" beradi — biz asyncpg'ga normalizatsiya qilamiz)
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://orikzor:changeme@localhost:5432/orikzor",
    )

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT
    JWT_SECRET_KEY: str = Field(min_length=32)
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 kun

    # Environment
    ENVIRONMENT: Literal["development", "production", "testing"] = "development"

    # CORS
    ALLOWED_ORIGINS: str = "http://localhost:3000"

    # Cookie: cross-domain deploy (frontend != backend domeni) uchun "none"
    # bo'lishi kerak. Bitta domen yoki dev'da "lax".
    COOKIE_SAMESITE: Literal["lax", "none", "strict"] = "lax"

    # === Railway integratsiyasi (ixtiyoriy) ===
    # Token Railway dashboard -> Account Settings -> Tokens dan olinadi.
    # XAVFSIZLIK: faqat backend environment'da saqlanadi, frontendga chiqmaydi.
    RAILWAY_API_TOKEN: str = ""
    RAILWAY_PROJECT_ID: str = ""
    RAILWAY_ENVIRONMENT_ID: str = ""
    RAILWAY_SERVICE_ID: str = ""
    # Plan: "trial" | "hobby" | "pro" — CPU/RAM foizini hisoblash uchun limit
    RAILWAY_PLAN: str = "pro"

    # === Backup ===
    # Railway Volume mount nuqtasi (masalan /data). Backup shu yerga saqlanadi.
    BACKUP_DIR: str = "/data/backups"
    # === GFS (Grandfather-Father-Son) retention ===
    BACKUP_KEEP_DAILY: int = 7     # oxirgi 7 kunlik
    BACKUP_KEEP_WEEKLY: int = 4    # oxirgi 4 haftalik
    BACKUP_KEEP_MONTHLY: int = 12  # oxirgi 12 oylik
    # Avtomatik kunlik backup vaqti (soat, 0-23, server vaqti UTC)
    BACKUP_HOUR_UTC: int = 19  # 19:00 UTC = 00:00 Toshkent (UTC+5)

    # === Tashqi backup (Cloudflare R2 / AWS S3 / Backblaze B2 — S3-mos) ===
    # Bo'sh bo'lsa tashqi yuklash o'chiq (faqat Volume'da saqlanadi).
    S3_ENDPOINT_URL: str = ""       # R2: https://<accountid>.r2.cloudflarestorage.com
    S3_ACCESS_KEY: str = ""
    S3_SECRET_KEY: str = ""
    S3_BUCKET: str = ""
    S3_REGION: str = ""            # AWS: masalan "eu-north-1"; R2: "auto"
    S3_PREFIX: str = "orikzor-backups"  # bucket ichidagi papka

    @computed_field  # type: ignore[misc]
    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    @computed_field  # type: ignore[misc]
    @property
    def database_url_async(self) -> str:
        """DATABASE_URL'ni asyncpg drayveriga normalizatsiya qiladi.

        Railway/Heroku 'postgresql://' yoki 'postgres://' beradi — bularni
        'postgresql+asyncpg://' ga aylantiramiz.
        """
        url = self.DATABASE_URL
        if url.startswith("postgres://"):
            url = "postgresql://" + url[len("postgres://") :]
        if url.startswith("postgresql://"):
            url = "postgresql+asyncpg://" + url[len("postgresql://") :]
        return url

    @computed_field  # type: ignore[misc]
    @property
    def database_url_raw(self) -> str:
        """pg_dump/psql uchun toza 'postgresql://' URL (asyncpg drayverisiz)."""
        url = self.DATABASE_URL
        if url.startswith("postgres://"):
            url = "postgresql://" + url[len("postgres://") :]
        if url.startswith("postgresql+asyncpg://"):
            url = "postgresql://" + url[len("postgresql+asyncpg://") :]
        return url

    # Google Sheets (yerto'la uchun)
    SHEETS_CSV_URL: str = ""
    SHEETS_CACHE_TTL_SECONDS: int = 3600

    # Initial admin (faqat birinchi marta yaratish uchun)
    INITIAL_ADMIN_USERNAME: str = "admin"
    INITIAL_ADMIN_PASSWORD: str = ""
    INITIAL_USER_USERNAME: str = "orikzor"
    INITIAL_USER_PASSWORD: str = ""

    @property
    def is_development(self) -> bool:
        return self.ENVIRONMENT == "development"

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"


@lru_cache
def get_settings() -> Settings:
    """Cached settings — har safar qaytadan o'qilmasin."""
    return Settings()


settings = get_settings()
