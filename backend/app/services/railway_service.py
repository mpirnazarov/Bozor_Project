"""Railway GraphQL API integratsiyasi — CPU/RAM usage + deployment ro'yxati.

Token va ID'lar environment variable'dan olinadi (config.Settings):
    RAILWAY_API_TOKEN, RAILWAY_PROJECT_ID, RAILWAY_ENVIRONMENT_ID, RAILWAY_SERVICE_ID

XAVFSIZLIK: token faqat backend'da, hech qachon frontendga yuborilmaydi.
API barqaror "stable" emas — Railway sxemani o'zgartirsa, bu buzilishi mumkin,
shuning uchun barcha so'rovlar xatoga chidamli (try/except) qilingan.
"""
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

from app.config import settings

RAILWAY_API = "https://backboard.railway.com/graphql/v2"
_TIMEOUT = 15


def is_configured() -> bool:
    return bool(settings.RAILWAY_API_TOKEN and settings.RAILWAY_PROJECT_ID)


async def _gql(query: str, variables: dict[str, Any] | None = None) -> dict[str, Any]:
    headers = {
        "Authorization": f"Bearer {settings.RAILWAY_API_TOKEN}",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.post(
            RAILWAY_API,
            json={"query": query, "variables": variables or {}},
            headers=headers,
        )
        resp.raise_for_status()
        data = resp.json()
        if "errors" in data and data["errors"]:
            raise RuntimeError(str(data["errors"])[:300])
        return data.get("data") or {}


_DEPLOYMENTS_QUERY = """
query Deployments($projectId: String!, $environmentId: String!, $serviceId: String!) {
  deployments(
    first: 10
    input: { projectId: $projectId, environmentId: $environmentId, serviceId: $serviceId }
  ) {
    edges {
      node {
        id
        status
        createdAt
        staticUrl
        meta
      }
    }
  }
}
"""

# Metrikalar: CPU (vCPU), RAM (bytes) — oxirgi soatlik o'rtacha
_METRICS_QUERY = """
query Metrics($projectId: String!, $startDate: DateTime!, $measurements: [MetricMeasurement!]!) {
  metrics(
    projectId: $projectId
    startDate: $startDate
    measurements: $measurements
  ) {
    measurement
    values {
      ts
      value
    }
  }
}
"""


async def get_deployments() -> list[dict]:
    """Oxirgi deploymentlar ro'yxati."""
    if not is_configured():
        return []
    data = await _gql(_DEPLOYMENTS_QUERY, {
        "projectId": settings.RAILWAY_PROJECT_ID,
        "environmentId": settings.RAILWAY_ENVIRONMENT_ID,
        "serviceId": settings.RAILWAY_SERVICE_ID,
    })
    out = []
    for edge in (data.get("deployments") or {}).get("edges") or []:
        node = edge.get("node") or {}
        out.append({
            "id": node.get("id"),
            "status": node.get("status"),
            "created_at": node.get("createdAt"),
            "url": node.get("staticUrl"),
        })
    return out


async def get_metrics() -> dict:
    """Oxirgi soatdagi CPU/RAM o'rtacha va oxirgi qiymat."""
    if not is_configured():
        return {}
    start = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    data = await _gql(_METRICS_QUERY, {
        "projectId": settings.RAILWAY_PROJECT_ID,
        "startDate": start,
        "measurements": ["CPU_USAGE", "MEMORY_USAGE_GB"],
    })
    result: dict[str, Any] = {}
    for m in data.get("metrics") or []:
        name = m.get("measurement")
        values = [v.get("value") for v in (m.get("values") or []) if v.get("value") is not None]
        if not values:
            continue
        latest = values[-1]
        avg = sum(values) / len(values)
        if name == "CPU_USAGE":
            result["cpu_vcpu_latest"] = round(latest, 3)
            result["cpu_vcpu_avg"] = round(avg, 3)
        elif name == "MEMORY_USAGE_GB":
            result["ram_gb_latest"] = round(latest, 3)
            result["ram_gb_avg"] = round(avg, 3)
    return result


async def get_railway_overview() -> dict:
    """Super dashboard uchun Railway umumiy holati (xatoga chidamli)."""
    if not is_configured():
        return {"configured": False}

    overview: dict[str, Any] = {"configured": True}

    try:
        overview["metrics"] = await get_metrics()
    except Exception as e:  # noqa: BLE001
        overview["metrics_error"] = str(e)[:200]
        overview["metrics"] = {}

    try:
        overview["deployments"] = await get_deployments()
    except Exception as e:  # noqa: BLE001
        overview["deployments_error"] = str(e)[:200]
        overview["deployments"] = []

    return overview
