"""Xavfsizlik middleware'lari: HTTP xavfsizlik sarlavhalari va login rate-limit.

2026 amaliyoti:
- Security headers (HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy,
  Permissions-Policy) — clickjacking, MIME-sniffing, ma'lumot sizib chiqishidan himoya.
- Login endpoint uchun oddiy IP-asosli rate limit — brute-force hujumini sekinlashtiradi.
"""
import time
from collections import defaultdict, deque

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Har javobga xavfsizlik sarlavhalarini qo'shadi."""

    def __init__(self, app, *, is_production: bool):
        super().__init__(app)
        self.is_production = is_production

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        h = response.headers
        h.setdefault("X-Content-Type-Options", "nosniff")
        h.setdefault("X-Frame-Options", "DENY")
        h.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        h.setdefault("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
        h.setdefault("Cross-Origin-Opener-Policy", "same-origin")
        if self.is_production:
            # HSTS — faqat HTTPS bo'lgan productionда
            h.setdefault(
                "Strict-Transport-Security",
                "max-age=63072000; includeSubDomains",
            )
        return response


class LoginRateLimitMiddleware(BaseHTTPMiddleware):
    """Login endpoint uchun IP-asosli rate limit (in-memory sliding window).

    Standart: 1 IP'dan 5 daqiqada 10 ta urinish. Oshsa — 429.
    Eslatma: bitta instansiya xotirasida ishlaydi; ko'p instansiyada Redis
    bilan almashtirilishi mumkin, lekin bitta urinishlarni ham yaxshi cheklaydi.
    """

    def __init__(self, app, *, path: str = "/api/auth/login", max_attempts: int = 10, window_seconds: int = 300):
        super().__init__(app)
        self.path = path
        self.max_attempts = max_attempts
        self.window = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def _client_ip(self, request: Request) -> str:
        # Reverse-proxy orqasida bo'lsa X-Forwarded-For birinchi IP
        fwd = request.headers.get("x-forwarded-for")
        if fwd:
            return fwd.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    async def dispatch(self, request: Request, call_next):
        if request.url.path == self.path and request.method == "POST":
            ip = self._client_ip(request)
            now = time.time()
            dq = self._hits[ip]
            # Eski urinishlarni tozalaymiz
            while dq and now - dq[0] > self.window:
                dq.popleft()
            if len(dq) >= self.max_attempts:
                retry = int(self.window - (now - dq[0]))
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Juda ko'p urinish. Birozdan keyin qayta urinib ko'ring."},
                    headers={"Retry-After": str(max(retry, 1))},
                )
            dq.append(now)
            # Xotira o'smasligi uchun vaqti-vaqti bilan bo'sh IP'larni tozalash
            if len(self._hits) > 10000:
                empties = [k for k, v in self._hits.items() if not v]
                for k in empties[:5000]:
                    self._hits.pop(k, None)
        return await call_next(request)
