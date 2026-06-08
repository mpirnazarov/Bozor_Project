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
            except Exception as e:  # noqa: BLE001
                last_error = str(e)[:250]
                continue

            # GraphQL javobini o'qiymiz (400 bo'lsa ham — tanasida aniq xato bo'ladi)
            try:
                data = resp.json()
            except Exception:  # noqa: BLE001
                last_error = f"HTTP {resp.status_code}: {resp.text[:200]}"
                continue

            errors = data.get("errors")
            if errors:
                msg = str(errors)
                # Avtorizatsiya xatosi bo'lsa — boshqa header turini sinaymiz
                if "Not Authorized" in msg or "Unauthorized" in msg or "auth" in msg.lower():
                    last_error = msg[:250]
                    continue
                # Boshqa xato (masalan query/maydon xatosi) — qaytaramiz
                raise RuntimeError(msg[:400])

            if resp.status_code >= 400:
                last_error = f"HTTP {resp.status_code}: {str(data)[:200]}"
                continue

            return data.get("data") or {}
    # Hamma header turi muvaffaqiyatsiz
    raise RuntimeError(last_error or "Avtorizatsiya muvaffaqiyatsiz (token noto'g'ri?)")


_DEPLOYMENTS_VARIANTS = [
    # 1) boyitilgan
    """
query Deployments($projectId: String!, $environmentId: String!, $serviceId: String!) {
  deployments(first: 10, input: { projectId: $projectId, environmentId: $environmentId, serviceId: $serviceId }) {
    edges { node { id status createdAt updatedAt staticUrl url canRedeploy meta } }
  }
}""",
    # 2) minimal (avval ishlаgan)
    """
query Deployments($projectId: String!, $environmentId: String!, $serviceId: String!) {
  deployments(first: 10, input: { projectId: $projectId, environmentId: $environmentId, serviceId: $serviceId }) {
    edges { node { id status createdAt staticUrl meta } }
  }
}""",
]

# Servis konfiguratsiyasi + plan limiti. serviceInstance maydonlari sxemada
# o'zgaruvchan, shuning uchun eng ishonchlidan boshlab bir nechta variant sinaymiz.
_SERVICE_VARIANTS = [
    # 1) to'liq: region + replicas + limit + builder
    """
query ServiceInfo($serviceId: String!) {
  service(id: $serviceId) {
    id name createdAt
    serviceInstances {
      edges { node { environmentId region numReplicas limitOverride builder } }
    }
  }
}""",
    # 2) limitsiz: region + replicas
    """
query ServiceInfo($serviceId: String!) {
  service(id: $serviceId) {
    id name createdAt
    serviceInstances {
      edges { node { environmentId region numReplicas } }
    }
  }
}""",
    # 3) eng minimal: faqat nom
    """
query ServiceInfo($serviceId: String!) {
  service(id: $serviceId) {
    id name createdAt
  }
}""",
]

# Metrikalar. Railway metrics() so'rovi sxemasi to'liq hujjatlanmagan va o'zgaruvchan,
# shuning uchun bir nechta ehtimoliy enum/argument variantini ketma-ket sinaymiz.
# Birortasi ishlasa — o'shani ishlatamiz. Hammasi xato bersa — oxirgi xatoni qaytaramiz.

# Variant query'lar: har biri (query, measurements, extra_vars) ko'rinishida.
_METRICS_VARIANTS = [
    # 1) serviceId scope — CPU/RAM/Network/Disk (to'liq)
    {
        "query": """
query Metrics($serviceId: String!, $startDate: DateTime!, $measurements: [MetricMeasurement!]!) {
  metrics(serviceId: $serviceId, startDate: $startDate, measurements: $measurements) {
    measurement
    values { ts value }
  }
}""",
        "measurements": ["CPU_USAGE", "MEMORY_USAGE_GB", "NETWORK_TX_GB", "DISK_USAGE_GB"],
        "key": "serviceId",
    },
    # 2) serviceId scope — faqat CPU/RAM (network/disk enum xato bo'lsa)
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
    # 3) projectId + environmentId + serviceId
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
    # 4) bytes o'lchovi (MEMORY_USAGE_BYTES)
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
    # 5) faqat projectId (eski usul)
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
    variables = {
        "projectId": settings.RAILWAY_PROJECT_ID,
        "environmentId": settings.RAILWAY_ENVIRONMENT_ID,
        "serviceId": settings.RAILWAY_SERVICE_ID,
    }
    data: dict[str, Any] = {}
    last_error: str | None = None
    for query in _DEPLOYMENTS_VARIANTS:
        try:
            data = await _gql(query, variables)
            break
        except Exception as e:  # noqa: BLE001
            last_error = str(e)[:250]
            continue
    if not data and last_error:
        raise RuntimeError(last_error)

    out = []
    for edge in (data.get("deployments") or {}).get("edges") or []:
        node = edge.get("node") or {}
        meta = node.get("meta") or {}
        commit_msg = commit_sha = branch = None
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
    """Servis konfiguratsiyasi: region, replicas, CPU/RAM limiti.

    Bir nechta query variantini sinaymiz (sxema o'zgaruvchan).
    """
    if not is_configured():
        return {}
    data: dict[str, Any] = {}
    last_error: str | None = None
    for query in _SERVICE_VARIANTS:
        try:
            data = await _gql(query, {"serviceId": settings.RAILWAY_SERVICE_ID})
            break  # ishladi
        except Exception as e:  # noqa: BLE001
            last_error = str(e)[:250]
            continue
    if not data:
        if last_error:
            raise RuntimeError(last_error)
        return {}

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
    # 24 soatlik oyna (grafik uchun)
    start = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()

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
    """metrics javobini cpu/ram/network/disk qiymatlari + tarixiga aylantiradi."""
    result: dict[str, Any] = {}
    GB = 1_073_741_824
    for m in data.get("metrics") or []:
        name = (m.get("measurement") or "").upper()
        pts = [(v.get("ts"), v.get("value")) for v in (m.get("values") or []) if v.get("value") is not None]
        values = [v for _, v in pts]
        if not values:
            continue
        latest = values[-1]
        avg = sum(values) / len(values)
        if "CPU" in name:
            result["cpu_vcpu_latest"] = round(latest, 3)
            result["cpu_vcpu_avg"] = round(avg, 3)
            result["cpu_series"] = [{"ts": t, "v": round(v, 3)} for t, v in pts]
        elif "MEM" in name or "RAM" in name:
            div = GB if latest > 1024 else 1
            result["ram_gb_latest"] = round(latest / div, 3)
            result["ram_gb_avg"] = round(avg / div, 3)
            result["ram_series"] = [{"ts": t, "v": round(v / div, 3)} for t, v in pts]
        elif "NETWORK" in name or "EGRESS" in name or "TX" in name or "RX" in name:
            # Yig'indi (GB). Network odatda bytes.
            total = sum(values)
            div = GB if total > 1024 else 1
            result["network_gb_total"] = round(total / div, 4)
            result["network_gb_latest"] = round(latest / div, 5)
        elif "DISK" in name or "VOLUME" in name:
            div = GB if latest > 1024 else 1
            result["disk_gb_latest"] = round(latest / div, 3)
    return result


# ===== Qo'shimcha ma'lumotlar (har biri xatoga chidamli) =====

# Railway pricing (2026): CPU $20/vCPU/oy, RAM $10/GB/oy.
# estimatedUsage measurement bo'yicha miqdor (vCPU-min, GB-min, GB) qaytaradi.
# Biz uni taxminiy $ ga aylantiramiz.
_USAGE_VARIANTS = [
    # 1) estimatedUsage — measurements + date range (eng keng tarqalgan)
    {
        "query": """
query Usage($projectId: String!, $startDate: String!, $endDate: String!, $measurements: [MetricMeasurement!]!) {
  estimatedUsage(projectId: $projectId, startDate: $startDate, endDate: $endDate, measurements: $measurements) {
    measurement estimatedValue
  }
}""",
        "kind": "estimatedUsage",
    },
    # 2) estimatedUsage — measurementsiz
    {
        "query": """
query Usage($projectId: String!, $startDate: String!, $endDate: String!) {
  estimatedUsage(projectId: $projectId, startDate: $startDate, endDate: $endDate) {
    measurement estimatedValue
  }
}""",
        "kind": "estimatedUsage",
    },
    # 3) usage — measurements bilan (Railway buni majburiy talab qiladi)
    {
        "query": """
query Usage($projectId: String!, $startDate: String!, $endDate: String!, $measurements: [MetricMeasurement!]!) {
  usage(projectId: $projectId, startDate: $startDate, endDate: $endDate, measurements: $measurements) {
    measurement value
  }
}""",
        "kind": "usage",
    },
]

# measurement -> taxminiy oylik narx koeffitsienti ($).
# estimatedValue odatda "minut" birligida (vCPU-minut, GB-minut) yoki GB bo'ladi.
_USAGE_PRICE = {
    "CPU_USAGE": 20.0 / (30 * 24 * 60),       # $/vCPU-minut
    "MEMORY_USAGE_GB": 10.0 / (30 * 24 * 60),  # $/GB-minut
    "NETWORK_TX_GB": 0.10,                      # $/GB egress
    "DISK_USAGE_GB": 0.25 / (30 * 24 * 60),    # $/GB-minut (taxminiy)
}


async def get_usage() -> dict:
    """Bu oygi taxminiy resurs xarajati ($). Xato bo'lsa sababni qaytaradi."""
    if not is_configured():
        return {}
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    measurements = ["CPU_USAGE", "MEMORY_USAGE_GB"]

    last_error: str | None = None
    for variant in _USAGE_VARIANTS:
        variables: dict[str, Any] = {
            "projectId": settings.RAILWAY_PROJECT_ID,
            "startDate": month_start.isoformat(),
            "endDate": now.isoformat(),
        }
        if "$measurements" in variant["query"]:
            variables["measurements"] = measurements
        try:
            data = await _gql(variant["query"], variables)
        except Exception as e:  # noqa: BLE001
            last_error = str(e)[:250]
            continue

        items = data.get("estimatedUsage") or data.get("usage") or []
        if not isinstance(items, list):
            continue
        total_cost = 0.0
        raw_total = 0.0
        for it in items:
            meas = (it.get("measurement") or "").upper()
            val = it.get("estimatedValue")
            if val is None:
                val = it.get("value")
            if val is None:
                continue
            val = float(val)
            raw_total += val
            price = _USAGE_PRICE.get(meas)
            if price is not None:
                total_cost += val * price
        if raw_total > 0:
            # Agar narx koeffitsienti topilmasa, qiymatning o'zini ($ deb) ko'rsatamiz
            cost = total_cost if total_cost > 0 else raw_total
            return {"month_cost_usd": round(cost, 2)}

    # Hech narsa topilmadi — sababni qaytaramiz (diagnostika uchun)
    if last_error:
        return {"error": last_error}
    return {}


_DOMAINS_QUERY = """
query Domains($serviceId: String!, $environmentId: String!) {
  domains(serviceId: $serviceId, environmentId: $environmentId) {
    serviceDomains { domain }
    customDomains { domain status }
  }
}"""


async def get_domains() -> list[dict]:
    """Servisning domenlari + SSL/status holati."""
    if not is_configured():
        return []
    try:
        data = await _gql(_DOMAINS_QUERY, {
            "serviceId": settings.RAILWAY_SERVICE_ID,
            "environmentId": settings.RAILWAY_ENVIRONMENT_ID,
        })
    except Exception:  # noqa: BLE001
        return []
    out = []
    d = data.get("domains") or {}
    for sd in d.get("serviceDomains") or []:
        if sd.get("domain"):
            out.append({"domain": sd["domain"], "type": "railway", "status": "active"})
    for cd in d.get("customDomains") or []:
        if cd.get("domain"):
            status = cd.get("status")
            status_str = status if isinstance(status, str) else (status or {}).get("dnsRecords") or "custom"
            out.append({"domain": cd["domain"], "type": "custom", "status": str(status_str)})
    return out


_ENV_COUNT_QUERY = """
query Vars($projectId: String!, $environmentId: String!, $serviceId: String!) {
  variables(projectId: $projectId, environmentId: $environmentId, serviceId: $serviceId)
}"""


async def get_env_count() -> int | None:
    """Servisdagi environment o'zgaruvchilar soni (qiymatlarsiz)."""
    if not is_configured():
        return None
    try:
        data = await _gql(_ENV_COUNT_QUERY, {
            "projectId": settings.RAILWAY_PROJECT_ID,
            "environmentId": settings.RAILWAY_ENVIRONMENT_ID,
            "serviceId": settings.RAILWAY_SERVICE_ID,
        })
    except Exception:  # noqa: BLE001
        return None
    variables = data.get("variables")
    if isinstance(variables, dict):
        return len(variables)
    return None


_PROJECT_QUERY = """
query Project($projectId: String!) {
  project(id: $projectId) {
    id name
    services { edges { node { id name } } }
  }
}"""


async def get_project_services() -> dict:
    """Loyihadagi servislar ro'yxati."""
    if not is_configured():
        return {}
    try:
        data = await _gql(_PROJECT_QUERY, {"projectId": settings.RAILWAY_PROJECT_ID})
    except Exception:  # noqa: BLE001
        return {}
    proj = data.get("project") or {}
    services = []
    for edge in (proj.get("services") or {}).get("edges") or []:
        node = edge.get("node") or {}
        if node.get("name"):
            services.append({"id": node.get("id"), "name": node.get("name")})
    return {"name": proj.get("name"), "services": services}


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

    # Qo'shimcha ma'lumotlar — har biri ixtiyoriy, xato bo'lsa shunchaki tashlab ketamiz
    overview["usage"] = await get_usage()
    overview["domains"] = await get_domains()
    env_count = await get_env_count()
    if env_count is not None:
        overview["env_count"] = env_count
    overview["project"] = await get_project_services()

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
