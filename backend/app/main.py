"""FastAPI application entry point."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import admin, auth, billing, dashboard, inn, maps, managers, markets, mobile, owner, pavilions, settings as settings_api, shops, yertola
from app.config import settings
from app.middleware.security import LoginRateLimitMiddleware, SecurityHeadersMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup va shutdown hodisalari."""
    # Production xavfsizlik tekshiruvi — xavfli sozlama bilan ishga tushmaslik
    if settings.is_production:
        weak = {"changeme", "secret", "test", "dev"}
        secret = settings.JWT_SECRET_KEY or ""
        if len(secret) < 32 or secret.lower() in weak:
            raise RuntimeError(
                "XAVFSIZLIK: production'da kuchli JWT_SECRET_KEY (>=32 belgi) majburiy"
            )
        # Cross-domain cookie 'none' bo'lsa, u faqat HTTPS (secure) bilan ishlaydi
        # — bu _set_auth_cookie'da production'da avtomatik ta'minlanadi.
        print("🔐 Production xavfsizlik tekshiruvi o'tdi")
    print(f"🚀 Orikzor backend starting (env: {settings.ENVIRONMENT})")
    # Kunlik avtomatik backup rejalashtiruvchini ishga tushiramiz
    try:
        from app.services.backup_scheduler import start_scheduler, stop_scheduler
        start_scheduler()
        print("🗄️  Backup scheduler ishga tushdi")
    except Exception as e:  # noqa: BLE001
        print(f"⚠️ Backup scheduler ishga tushmadi: {e}")
        stop_scheduler = None  # type: ignore[assignment]
    yield
    if stop_scheduler:
        stop_scheduler()
    print("👋 Orikzor backend shutting down")


app = FastAPI(
    title="Orikzor API",
    description="O'rikzor Savdo Kompleksi - boshqaruv tizimi",
    version="2.0.0",
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
    lifespan=lifespan,
)

# Xavfsizlik sarlavhalari (har javobga)
app.add_middleware(SecurityHeadersMiddleware, is_production=settings.is_production)

# Login brute-force himoyasi (IP-asosli rate limit)
app.add_middleware(LoginRateLimitMiddleware)

# CORS — faqat ruxsat etilgan origin'lar, aniq metod va sarlavhalar
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
    max_age=600,
)


@app.get("/health")
async def health_check() -> dict[str, str]:
    """Health check endpoint — Docker uchun."""
    return {"status": "ok", "service": "orikzor-backend", "version": "2.0.0"}


@app.get("/")
async def root() -> dict[str, str]:
    return {
        "name": "Orikzor API",
        "version": "2.0.0",
        "docs": "/docs",
    }


# Routerlar
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(markets.router, prefix="/api/markets", tags=["markets"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["dashboard"])
app.include_router(pavilions.router, prefix="/api/pavilions", tags=["pavilions"])
app.include_router(maps.router, prefix="/api/maps", tags=["maps"])
app.include_router(mobile.router, prefix="/api/mobile", tags=["mobile"])
app.include_router(shops.router, prefix="/api/shops", tags=["shops"])
app.include_router(billing.router, prefix="/api/billing", tags=["billing"])
app.include_router(inn.router, prefix="/api/inn", tags=["inn"])
app.include_router(yertola.router, prefix="/api/yertola", tags=["yertola"])
app.include_router(settings_api.router, prefix="/api/settings", tags=["settings"])
app.include_router(owner.router, prefix="/api/owner", tags=["owner"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(managers.router, prefix="/api/managers", tags=["managers"])

# Keyingi bosqichlarda qo'shiladi:
# (barcha asosiy routerlar ulandi)
