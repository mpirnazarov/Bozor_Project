"""Magazinlarni CSV (Google Sheets / Excel eksporti) dan import qilish.

Mantiq (eski loyihaga o'xshash):
- Har bir qatorda shop_id (masalan "04-1-1-001"), firma nomi, INN, ijara va h.k.
- shop_id bo'yicha magazin upsert qilinadi (bor bo'lsa yangilanadi).
- INN bo'yicha kontragentga bog'lanadi (FK). Kontragent yo'q bo'lsa yaratiladi.
- Statistika: o'qilgan, qo'shilgan, yangilangan, bog'langan, topilmaganlar ro'yxati.
"""
import csv
import io
import re
from decimal import Decimal, InvalidOperation

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Counterparty, Shop

# Ustun nomlarini moslashtirish — turli sarlavhalarni qabul qilamiz
_COL_ALIASES = {
    "shop_id": ["shop_id", "id", "magazin id", "магазин", "do'kon id", "dokon_id", "kod", "код"],
    "name": ["name", "nomi", "firma", "tashkilot", "наименование", "наименование организации", "kontragent"],
    "inn": ["inn", "иннn", "stir", "стир", "инн"],
    "rent": ["rent", "ijara", "arenda", "аренда", "summa", "сумма", "monthly_rent"],
    "phone": ["phone", "telefon", "тел", "телефон"],
    "purpose": ["purpose", "maqsad", "faoliyat", "shop_type", "tur", "вид"],
}

# shop_id formati: NN-N-N-NNN (masalan 04-1-1-001). Moslashuvchan: raqam-tire bo'limlar
_SHOP_ID_RE = re.compile(r"^[A-Za-z0-9]+-[A-Za-z0-9]+-[A-Za-z0-9]+(-[A-Za-z0-9]+)*$")


def _norm_header(h: str) -> str:
    return (h or "").strip().lower().replace("ʼ", "'").replace("`", "'")


def _build_col_map(headers: list[str]) -> dict[str, int]:
    """Sarlavhalardan ustun indekslarini aniqlaydi."""
    col_map: dict[str, int] = {}
    norm = [_norm_header(h) for h in headers]
    for field, aliases in _COL_ALIASES.items():
        for i, h in enumerate(norm):
            if h in aliases or any(h == _norm_header(a) for a in aliases):
                col_map[field] = i
                break
    return col_map


def _clean_inn(v: str) -> str | None:
    digits = re.sub(r"\D", "", v or "")
    return digits or None


def _parse_decimal(v: str) -> Decimal:
    if not v:
        return Decimal(0)
    cleaned = re.sub(r"[^\d.,-]", "", str(v)).replace(",", ".")
    # bir nechta nuqta bo'lsa, oxirgisini kasr deb olamiz
    if cleaned.count(".") > 1:
        parts = cleaned.split(".")
        cleaned = "".join(parts[:-1]) + "." + parts[-1]
    try:
        return Decimal(cleaned or 0)
    except InvalidOperation:
        return Decimal(0)


async def import_shops_csv(
    db: AsyncSession,
    content: bytes,
    market_id: int = 1,
    source: str = "csv",
) -> dict:
    """CSV bytes'dan magazinlarni import qiladi.

    Qaytaradi: statistika dict — rows_read, inserted, updated, linked,
    counterparties_created, not_found (ro'yxat), errors.
    """
    text = content.decode("utf-8-sig", errors="replace")
    # Ajratuvchini aniqlash (vergul yoki nuqtali vergul)
    sample = text[:2000]
    delim = ";" if sample.count(";") > sample.count(",") else ","
    reader = csv.reader(io.StringIO(text), delimiter=delim)

    rows = list(reader)
    if not rows:
        return {
            "rows_read": 0, "inserted": 0, "updated": 0, "linked": 0,
            "counterparties_created": 0, "not_found": [], "errors": ["Fayl bo'sh"],
        }

    headers = rows[0]
    col = _build_col_map(headers)
    if "shop_id" not in col:
        # birinchi ustun shop_id deb taxmin qilamiz
        col["shop_id"] = 0

    inserted = updated = linked = cp_created = 0
    not_found: list[dict] = []
    errors: list[str] = []
    rows_read = 0

    # Mavjud kontragentlar INN to'plami (tez tekshirish uchun)
    existing_inns = set(
        (await db.execute(select(Counterparty.inn))).scalars().all()
    )

    for idx, row in enumerate(rows[1:], start=2):
        if not row or all(not c.strip() for c in row):
            continue
        rows_read += 1

        def get(field: str) -> str:
            i = col.get(field)
            return (row[i].strip() if i is not None and i < len(row) else "")

        shop_id = get("shop_id")
        if not shop_id:
            not_found.append({"row": idx, "reason": "shop_id yo'q", "raw": ",".join(row[:3])})
            continue
        if not _SHOP_ID_RE.match(shop_id):
            # format mos kelmasa ham qabul qilamiz, lekin belgilab qo'yamiz
            errors.append(f"Qator {idx}: shop_id formati g'alati ({shop_id})")

        name = get("name")
        inn = _clean_inn(get("inn"))
        rent = _parse_decimal(get("rent"))
        phone = get("phone") or None
        purpose = get("purpose") or None

        # Kontragentni INN bo'yicha bog'lash / yaratish
        if inn:
            if inn not in existing_inns:
                db.add(Counterparty(inn=inn, name=name or f"INN {inn}", phone=phone))
                existing_inns.add(inn)
                cp_created += 1
            linked += 1
        else:
            not_found.append({
                "row": idx, "shop_id": shop_id,
                "reason": "INN yo'q — kontragentga bog'lanmadi",
                "name": name,
            })

        # Magazin upsert — shop_id VA market_id bo'yicha qidiramiz, shunda
        # turli bozorlarda bir xil shop_id bo'lsa ham aralashmaydi.
        existing = (
            await db.execute(
                select(Shop).where(
                    Shop.shop_id == shop_id,
                    Shop.market_id == market_id,
                )
            )
        ).scalar_one_or_none()

        if existing:
            existing.inn = inn or existing.inn
            existing.shop_type = name or existing.shop_type
            existing.purpose = purpose or existing.purpose
            if rent:
                existing.monthly_rent = rent
            existing.source_sheet = source
            updated += 1
        else:
            db.add(Shop(
                shop_id=shop_id,
                market_id=market_id,
                inn=inn,
                shop_type=name or None,
                purpose=purpose,
                monthly_rent=rent,
                source_sheet=source,
                is_active=True,
            ))
            inserted += 1

    await db.commit()

    return {
        "rows_read": rows_read,
        "inserted": inserted,
        "updated": updated,
        "linked": linked,
        "counterparties_created": cp_created,
        "not_found": not_found[:500],  # juda uzun bo'lmasligi uchun
        "not_found_count": len(not_found),
        "errors": errors[:100],
    }
