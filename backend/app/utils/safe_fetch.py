"""SSRF'dan himoyalangan URL fetch.

Tashqi URL'dan ma'lumot yuklashda (Google Sheets import) ichki/maxfiy
manzillarga so'rov yuborilishini bloklaydi:
- faqat http/https
- xost IP'ga resolve qilinadi va private/loopback/link-local/metadata bloklanadi
- hajm cheklanadi (DoS oldini olish)
"""
import ipaddress
import socket
from urllib.parse import urlparse

import httpx

# Yuklab olinadigan maksimal hajm (10 MB)
MAX_FETCH_BYTES = 10 * 1024 * 1024

# Bulut metadata va xavfli xostlar
_BLOCKED_HOSTNAMES = {
    "localhost",
    "metadata.google.internal",
}


class UnsafeUrlError(ValueError):
    """URL ichki yoki xavfli manzilga ishora qiladi."""


def _is_blocked_ip(ip_str: str) -> bool:
    try:
        ip = ipaddress.ip_address(ip_str)
    except ValueError:
        return True  # noma'lum format — bloklaymiz
    return (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local       # 169.254.0.0/16 — bulut metadata
        or ip.is_reserved
        or ip.is_multicast
        or ip.is_unspecified
    )


def validate_public_url(url: str) -> str:
    """URL xavfsizligini tekshiradi. Xavfli bo'lsa UnsafeUrlError ko'taradi."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise UnsafeUrlError("Faqat http/https URL'lar ruxsat etiladi")
    host = parsed.hostname
    if not host:
        raise UnsafeUrlError("URL xost qismi yo'q")
    if host.lower() in _BLOCKED_HOSTNAMES:
        raise UnsafeUrlError("Bu xostga ruxsat yo'q")

    # Xostni IP'ga resolve qilamiz va barcha natijalarni tekshiramiz
    try:
        infos = socket.getaddrinfo(host, parsed.port or (443 if parsed.scheme == "https" else 80))
    except socket.gaierror as e:
        raise UnsafeUrlError(f"Xostni aniqlab bo'lmadi: {host}") from e

    for info in infos:
        ip_str = info[4][0]
        if _is_blocked_ip(ip_str):
            raise UnsafeUrlError("Ichki yoki maxfiy manzilga ruxsat yo'q")

    return url


async def fetch_url_safely(url: str, timeout: float = 30.0) -> bytes:
    """SSRF tekshiruvidan o'tkazib, URL kontentini xavfsiz yuklaydi.

    - Redirect'larda ham har bir qadam tekshiriladi (manual redirect).
    - Hajm MAX_FETCH_BYTES bilan cheklanadi.
    """
    current = validate_public_url(url)
    async with httpx.AsyncClient(follow_redirects=False, timeout=timeout) as client:
        # Redirectlarni qo'lda kuzatamiz (har biri SSRF tekshiruvidan o'tadi)
        for _ in range(5):
            resp = await client.get(current)
            if resp.is_redirect and "location" in resp.headers:
                current = validate_public_url(str(resp.next_request.url))  # type: ignore[union-attr]
                continue
            resp.raise_for_status()
            content = resp.content
            if len(content) > MAX_FETCH_BYTES:
                raise UnsafeUrlError("Fayl hajmi juda katta (10 MB dan oshmasligi kerak)")
            return content
        raise UnsafeUrlError("Juda ko'p redirect")
