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


# Railway'da 3 xil token turi bor, har biri boshqa header talab qiladi:
#   - Account / Team token  -> Authorization: Bearer <token>
#   - Project token         -> Project-Access-Token: <token>
# Token turini oldindan bilmaymiz, shuning uchun ikkala variantni sinaymiz.
def _header_variants() -> list[dict[str, str]]:
    token = settings.RAILWAY_API_TOKEN
    base = {"Content-Type": "application/json"}
    return [
        {**base, "Authorization": f"Bearer {token}"},
        {**base, "Project-Access-Token": token},
        {**base, "Team-Access-Token": token},
    ]


async def _gql(query: str, variables: dict[str, Any] | None = None) -> dict[str, Any]:
    payload = {"query": query, "variables": variables or {}}
    last_error: str | None = None
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        for headers in _header_variants():
            try:
                resp = await client.post(RAILWAY_API, json=payload, headers=headers)
                resp.raise_for_status()
                data = resp.json()
            except Exception as e:  # noqa: BLE001
                last_error = str(e)[:250]
                continue
            errors = data.get("errors")
            if errors:
                msg = str(errors)
                # Avtorizatsiya xatosi bo'lsa — boshqa header turini sinaymiz
                if "Not Authorized" in msg or "Unauthorized" in msg or "auth" in msg.lower():
                    last_error = msg[:250]
                    continue
                # Boshqa xato (masalan query xatosi) — qaytaramiz
                raise RuntimeError(msg[:300])
            return data.get("data") or {}
    # Hamma header turi muvaffaqiyatsiz
    raise RuntimeError(last_error or "Avtorizatsiya muvaffaqiyatsiz (token noto'g'ri?)")


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
        updatedAt
        staticUrl
        url
        canRedeploy
        meta
      }
    }
  }
}
"""

# Servis konfiguratsiyasi + plan limiti (CPU/RAM cheklovini olish uchun).
# limitOverride bo'lsa — o'sha, bo'lmasa plan limitiga tayanаmiz.
_SERVICE_QUERY = """
query ServiceInfo($serviceId: String!, $environmentId: String!) {
  service(id: $serviceId) {
    id
    name
    createdAt
    serviceInstances {
      edges {
        node {
          environmentId
          region
          numReplicas
          limitOverride
          startCommand
          builder
        }
      }
    }
  }
}
"""

# Metrikalar. Railway metrics() so'rovi sxemasi to'liq hujjatlanmagan va o'zgaruvchan,
# shuning uchun bir nechta ehtimoliy enum/argument variantini ketma-ket sinaymiz.
# Birortasi ishlasa — o'shani ishlatamiz. Hammasi xato bersa — oxirgi xatoni qaytaramiz.

# Variant query'lar: har biri (query, measurements, extra_vars) ko'rinishida.
_METRICS_VARIANTS = [
    # 1) serviceId bilan scope, GB o'lchovi
    {
        "query": """
query Metrics($serviceId: String!, $startDate: DateTime!, $measurements: [MetricMeasurement!]!) {
  metrics(serviceId: $serviceId, startDate: $startDate, measurements: $measurements) {
    measurement
    values { ts value }
  }
}""",
        "measurements": ["CPU_USAGE", "MEMORY_USAGE_GB"],
        "key": "serviceId",
    },
    # 2) projectId + environmentId + serviceId
    {
        "query": """
query Metrics($projectId: String!, $environmentId: String!, $serviceId: String!, $startDate: DateTime!, $measurements: [MetricMeasurement!]!) {
  metrics(projectId: $projectId, environmentId: $environmentId, serviceId: $serviceId, startDate: $startDate, measurements: $measurements) {
    measurement
    values { ts value }
  }
}""",
        "measurements": ["CPU_USAGE", "MEMORY_USAGE_GB"],
        "key": "all",
    },
    # 3) bytes o'lchovi (MEMORY_USAGE_BYTES)
    {
        "query": """
query Metrics($serviceId: String!, $startDate: DateTime!, $measurements: [MetricMeasurement!]!) {
  metrics(serviceId: $serviceId, startDate: $startDate, measurements: $measurements) {
    measurement
    values { ts value }
  }
}""",
        "measurements": ["CPU_USAGE", "MEMORY_USAGE_BYTES"],
        "key": "serviceId",
    },
    # 4) faqat projectId (eski usul)
    {
        "query": """
query Metrics($projectId: String!, $startDate: DateTime!, $measurements: [MetricMeasurement!]!) {
  metrics(projectId: $projectId, startDate: $startDate, measurements: $measurements) {
    measurement
    values { ts value }
  }
}""",
        "measurements": ["CPU_USAGE", "MEMORY_USAGE_GB"],
        "key": "projectId",
    },
]


def _metrics_vars(variant: dict, start: str) -> dict[str, Any]:
    base = {"startDate": start, "measurements": variant["measurements"]}
    key = variant["key"]
    if key == "serviceId":
        base["serviceId"] = settings.RAILWAY_SERVICE_ID
    elif key == "projectId":
        base["projectId"] = settings.RAILWAY_PROJECT_ID
    else:  # all
        base["projectId"] = settings.RAILWAY_PROJECT_ID
        base["environmentId"] = settings.RAILWAY_ENVIRONMENT_ID
        base["serviceId"] = settings.RAILWAY_SERVICE_ID
    return base


async def get_deployments() -> list[dict]:
    """Oxirgi deploymentlar ro'yxati (kengaytirilgan ma'lumot bilan)."""
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
        meta = node.get("meta") or {}
        # meta odatda commit/branch ma'lumotini saqlaydi (struktura o'zgaruvchan)
        commit_msg = None
        commit_sha = None
        branch = None
        if isinstance(meta, dict):
            commit_msg = meta.get("commitMessage") or meta.get("commit_message")
            commit_sha = meta.get("commitHash") or meta.get("commitSha") or meta.get("commit")
            branch = meta.get("branch")
        out.append({
            "id": node.get("id"),
            "status": node.get("status"),
            "created_at": node.get("createdAt"),
            "updated_at": node.get("updatedAt"),
            "url": node.get("staticUrl") or node.get("url"),
            "can_redeploy": node.get("canRedeploy"),
            "commit_message": commit_msg,
            "commit_sha": (commit_sha[:7] if isinstance(commit_sha, str) else None),
            "branch": branch,
        })
    return out


async def get_service_info() -> dict:
    """Servis konfiguratsiyasi: region, replicas, CPU/RAM limiti."""
    if not is_configured():
        return {}
    data = await _gql(_SERVICE_QUERY, {
        "serviceId": settings.RAILWAY_SERVICE_ID,
        "environmentId": settings.RAILWAY_ENVIRONMENT_ID,
    })
    svc = data.get("service") or {}
    info: dict[str, Any] = {
        "name": svc.get("name"),
        "created_at": svc.get("createdAt"),
    }
    # Joriy environment'ga mos serviceInstance'ni topamiz
    for edge in (svc.get("serviceInstances") or {}).get("edges") or []:
        node = edge.get("node") or {}
        if node.get("environmentId") == settings.RAILWAY_ENVIRONMENT_ID:
            info["region"] = node.get("region")
            info["replicas"] = node.get("numReplicas")
            info["builder"] = node.get("builder")
            limit = node.get("limitOverride") or {}
            # limitOverride: {"containers": {"cpu": X, "memoryGB": Y}} ko'rinishida bo'lishi mumkin
            if isinstance(limit, dict):
                cont = limit.get("containers") or limit
                if isinstance(cont, dict):
                    info["cpu_limit"] = cont.get("cpu")
                    info["ram_limit_gb"] = cont.get("memoryGB") or cont.get("memory")
            break
    return info


async def get_metrics() -> dict:
    """Oxirgi soatdagi CPU/RAM o'rtacha va oxirgi qiymat.

    Bir nechta query variantini ketma-ket sinaymiz (Railway sxemasi noaniq).
    Birortasi ma'lumot qaytarsa — o'shani ishlatamiz.
    """
    if not is_configured():
        return {}
    start = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()

    last_error: str | None = None
    for variant in _METRICS_VARIANTS:
        try:
            data = await _gql(variant["query"], _metrics_vars(variant, start))
        except Exception as e:  # noqa: BLE001
            last_error = str(e)[:250]
            continue  # bu variant ishlamadi, keyingisini sinaymiz

        result = _parse_metrics(data)
        if result:
            return result  # ma'lumot topildi

    # Hech bir variant ma'lumot bermadi
    if last_error:
        raise RuntimeError(last_error)
    return {}


def _parse_metrics(data: dict) -> dict:
    """metrics javobini cpu/ram qiymatlariga aylantiradi."""
    result: dict[str, Any] = {}
    for m in data.get("metrics") or []:
        name = (m.get("measurement") or "").upper()
        values = [v.get("value") for v in (m.get("values") or []) if v.get("value") is not None]
        if not values:
            continue
        latest = values[-1]
        avg = sum(values) / len(values)
        if "CPU" in name:
            result["cpu_vcpu_latest"] = round(latest, 3)
            result["cpu_vcpu_avg"] = round(avg, 3)
        elif "MEM" in name or "RAM" in name:
            # Bytes bo'lsa GB ga aylantiramiz (qiymat katta bo'lsa)
            div = 1_073_741_824 if latest > 1024 else 1
            result["ram_gb_latest"] = round(latest / div, 3)
            result["ram_gb_avg"] = round(avg / div, 3)
    return result


# Plan limitlari (foiz hisoblash uchun fallback). Railway'dan aniq limit
# olinmasa, plan turiga qarab standart qiymat ishlatamiz.
# settings.RAILWAY_PLAN: "hobby" | "pro" | "trial" (default "pro")
_PLAN_LIMITS = {
    "trial": {"cpu": 2.0, "ram": 1.0},
    "hobby": {"cpu": 8.0, "ram": 8.0},
    "pro": {"cpu": 32.0, "ram": 32.0},
}


def _plan_limit() -> dict:
    plan = (getattr(settings, "RAILWAY_PLAN", "") or "pro").lower()
    return _PLAN_LIMITS.get(plan, _PLAN_LIMITS["pro"])


async def get_railway_overview() -> dict:
    """Owner dashboard uchun Railway umumiy holati (xatoga chidamli)."""
    if not is_configured():
        return {"configured": False}

    overview: dict[str, Any] = {"configured": True}

    try:
        overview["metrics"] = await get_metrics()
    except Exception as e:  # noqa: BLE001
        overview["metrics_error"] = str(e)[:200]
        overview["metrics"] = {}

    try:
        overview["service"] = await get_service_info()
    except Exception as e:  # noqa: BLE001
        overview["service_error"] = str(e)[:200]
        overview["service"] = {}

    try:
        overview["deployments"] = await get_deployments()
    except Exception as e:  # noqa: BLE001
        overview["deployments_error"] = str(e)[:200]
        overview["deployments"] = []

    # CPU/RAM foizini hisoblaymiz: limit Railway'dan kelса o'sha, bo'lmasa plan limiti
    plan = _plan_limit()
    svc = overview.get("service") or {}
    metrics = overview.get("metrics") or {}
    cpu_limit = svc.get("cpu_limit") or plan["cpu"]
    ram_limit = svc.get("ram_limit_gb") or plan["ram"]
    overview["limits"] = {
        "cpu_vcpu": cpu_limit,
        "ram_gb": ram_limit,
        "source": "railway" if svc.get("cpu_limit") else "plan",
        "plan": (getattr(settings, "RAILWAY_PLAN", "") or "pro").lower(),
    }
    pct: dict[str, Any] = {}
    if metrics.get("cpu_vcpu_latest") is not None and cpu_limit:
        pct["cpu"] = round(metrics["cpu_vcpu_latest"] / cpu_limit * 100, 1)
    if metrics.get("ram_gb_latest") is not None and ram_limit:
        pct["ram"] = round(metrics["ram_gb_latest"] / ram_limit * 100, 1)
    overview["usage_pct"] = pct

    return overview
