"""FastAPI application entry point."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import admin, auth, billing, dashboard, inn, pavilions, shops, yertola
from app.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup va shutdown hodisalari."""
    # Startup
    print(f"🚀 Orikzor backend starting (env: {settings.ENVIRONMENT})")
    yield
    # Shutdown
    print("👋 Orikzor backend shutting down")


app = FastAPI(
    title="Orikzor API",
    description="O'rikzor Savdo Kompleksi - boshqaruv tizimi",
    version="2.0.0",
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["dashboard"])
app.include_router(pavilions.router, prefix="/api/pavilions", tags=["pavilions"])
app.include_router(shops.router, prefix="/api/shops", tags=["shops"])
app.include_router(billing.router, prefix="/api/billing", tags=["billing"])
app.include_router(inn.router, prefix="/api/inn", tags=["inn"])
app.include_router(yertola.router, prefix="/api/yertola", tags=["yertola"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])

# Keyingi bosqichlarda qo'shiladi:
# (barcha asosiy routerlar ulandi)
