"""Sana bo'yicha arenda billing import (Excel).

Kutilgan ustunlar (TDSheet formati):
  Контрагент | Договор контрагента | Основное арендное место (= magazin ID)
  | Арендная площадь | ИНН | Ойлик сумма | Карз | тўланган

Har magazin uchun tanlangan SANADA: oylik summa, qarz, to'langan saqlanadi.
Import oldidan struktura tekshiriladi — mos kelmasa aniq xato qaytariladi.
"""
from __future__ import annotations

import io
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal, InvalidOperation

from openpyxl import load_workbook
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import RentBilling, Shop


# Ustun aliaslari (normalizatsiya bilan solishtiriladi)
_ALIASES = {
    "shop_id": ["основноеарендноеместо", "арендноеместо", "магазин", "магазин№", "магазинid", "shopid", "magazinid", "magazin"],
    "name": ["контрагент", "kontragent", "ijarachi", "ижарачи", "egasi"],
    "contract": ["договорконтрагента", "договор", "shartnoma", "контракт"],
    "inn": ["инн", "inn", "stir"],
    "amount": ["ойликсумма", "oyliksumma", "сумма", "summa", "арендаплата", "ойлик"],
    "debt": ["карз", "қарз", "qarz", "qarzdorlik", "долг", "задолженность"],
    "paid": ["тўланган", "туланган", "tolangan", "to'langan", "оплачено", "оплата"],
}

# Faylni qabul qilish uchun MAJBURIY ustunlar
_REQUIRED = ["shop_id", "amount"]


def _norm(h) -> str:
    return "".join(str(h or "").lower().split()).replace("-", "").replace("_", "").replace("’", "'").replace("`", "'")


def _build_col_map(headers: list) -> dict[str, int]:
    col: dict[str, int] = {}
    norm_aliases = {f: {_norm(a) for a in al} for f, al in _ALIASES.items()}
    for idx, h in enumerate(headers):
        nh = _norm(h)
        if not nh:
            continue
        for field_name, aliases in norm_aliases.items():
            if field_name in col:
                continue
            if nh in aliases:
                col[field_name] = idx
                break
    return col


def _to_decimal(v) -> Decimal:
    if v is None:
        return Decimal(0)
    if isinstance(v, (int, float)):
        try:
            return Decimal(str(v))
        except InvalidOperation:
            return Decimal(0)
    s = str(v).strip().replace(" ", "").replace("\u00a0", "").replace(",", ".")
    if not s or s in {"-", "—"}:
        return Decimal(0)
    try:
        return Decimal(s)
    except InvalidOperation:
        return Decimal(0)


def _clean_inn(v) -> str | None:
    if v is None:
        return None
    s = "".join(ch for ch in str(v) if ch.isdigit())
    return s or None


class StructureError(Exception):
    """Excel strukturasi kutilganidan farq qilganda."""


@dataclass
class RentImportResult:
    rows_read: int = 0
    upserted: int = 0
    with_debt: int = 0
    no_debt: int = 0
    inn_updates: int = 0
    skipped: list = field(default_factory=list)
    errors: list = field(default_factory=list)
    detected_columns: dict = field(default_factory=dict)
    bill_date: str = ""


async def import_rent_billing_excel(
    db: AsyncSession,
    content: bytes,
    bill_date: date,
    market_id: int = 1,
) -> RentImportResult:
    res = RentImportResult(bill_date=bill_date.isoformat())

    try:
        wb = load_workbook(io.BytesIO(content), data_only=True, read_only=True)
    except Exception as exc:  # noqa: BLE001
        raise StructureError(f"Faylni ochib bo'lmadi (.xlsx kerak): {exc}") from exc

    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        raise StructureError("Fayl bo'sh")

    # Sarlavhani topish (birinchi 5 qatorda eng mos)
    header_idx, best = 0, {}
    for i, r in enumerate(rows[:5]):
        cm = _build_col_map(list(r))
        if len(cm) > len(best):
            best, header_idx = cm, i
    col = best

    # Struktura tekshiruvi — majburiy ustunlar bormi?
    field_labels = {
        "shop_id": "Магазин ID (Основное арендное место)",
        "name": "Контрагент", "contract": "Договор", "inn": "ИНН",
        "amount": "Ойлик сумма", "debt": "Карз", "paid": "тўланган",
    }
    res.detected_columns = {field_labels.get(k, k): v for k, v in col.items()}
    missing = [field_labels[f] for f in _REQUIRED if f not in col]
    if missing:
        raise StructureError(
            "Excel strukturasi mos kelmadi. Topilmagan ustun(lar): "
            + ", ".join(missing)
            + ". Kerakli ustunlar: Контрагент, Договор контрагента, "
            "Основное арендное место, Арендная площадь, ИНН, Ойлик сумма, Карз, тўланган."
        )
    if "debt" not in col and "paid" not in col:
        res.errors.append("⚠️ «Карз» va «тўланган» ustunlari topilmadi — qarz 0 deb saqlanadi")

    data_rows = rows[header_idx + 1:]
    records: list[dict] = []
    seen: set[str] = set()

    for offset, row in enumerate(data_rows):
        idx = header_idx + 2 + offset
        row = list(row)

        def get(f: str):
            i = col.get(f)
            return row[i] if (i is not None and i < len(row)) else None

        shop_id = str(get("shop_id") or "").strip()
        if not shop_id:
            continue
        res.rows_read += 1

        if shop_id in seen:
            res.skipped.append({"row": idx, "shop_id": shop_id,
                                "reason": "Faylda takrorlangan magazin ID — birinchisi olindi"})
            continue
        seen.add(shop_id)

        amount = _to_decimal(get("amount"))
        debt = _to_decimal(get("debt"))
        paid = _to_decimal(get("paid"))
        inn = _clean_inn(get("inn"))
        name = str(get("name") or "").strip() or None
        contract = str(get("contract") or "").strip() or None

        if debt > 0:
            res.with_debt += 1
        else:
            res.no_debt += 1

        records.append({
            "market_id": market_id,
            "shop_id": shop_id,
            "bill_date": bill_date,
            "inn": inn,
            "counterparty_name": name,
            "contract_no": contract,
            "monthly_amount": amount,
            "debt": debt,
            "paid": paid,
        })

    if not records:
        raise StructureError("Hech qanday yaroqli magazin qatori topilmadi")

    # monthly_amount ni Shop.monthly_rent bilan solishtirish va normallashtirish
    # Agar monthly_amount >> Shop.monthly_rent bo'lsa — bu bitta shop uchun
    # ko'p do'konning yig'indisi kelgan (1C da asosiy shop). Nisbat bo'yicha tuzatamiz.
    shop_ids = [r["shop_id"] for r in records]
    shops_q = await db.execute(
        select(Shop.shop_id, Shop.monthly_rent)
        .where(Shop.shop_id.in_(shop_ids), Shop.market_id == market_id)
    )
    shop_rent_map: dict[str, Decimal] = {
        sid: Decimal(str(rent or 0))
        for sid, rent in shops_q.all()
    }

    for rec in records:
        shop_rent = shop_rent_map.get(rec["shop_id"], Decimal(0))
        file_amount = rec["monthly_amount"]

        # Agar fayldagi summa do'kon ijarasidan sezilarli farq qilsa
        # (masalan 2x yoki ko'proq) — nisbat bo'yicha tuzatamiz
        if shop_rent > 0 and file_amount > 0 and file_amount > shop_rent * Decimal("1.5"):
            ratio = shop_rent / file_amount
            new_paid = (rec["paid"] * ratio).quantize(Decimal("0.01"))
            new_debt = max(Decimal(0), shop_rent - new_paid)
            rec["monthly_amount"] = shop_rent
            rec["paid"] = new_paid
            rec["debt"] = new_debt
        elif shop_rent > 0 and rec["paid"] <= 0:
            # paid=0 kelsa — amount - debt formulasi
            rec["paid"] = max(Decimal(0), rec["monthly_amount"] - rec["debt"])

    # Upsert (shu sana + magazin bo'yicha)
    CHUNK = 1000
    for i in range(0, len(records), CHUNK):
        chunk = records[i:i + CHUNK]
        stmt = pg_insert(RentBilling.__table__).values(chunk)
        stmt = stmt.on_conflict_do_update(
            index_elements=["market_id", "shop_id", "bill_date"],
            set_={
                "inn": stmt.excluded.inn,
                "counterparty_name": stmt.excluded.counterparty_name,
                "contract_no": stmt.excluded.contract_no,
                "monthly_amount": stmt.excluded.monthly_amount,
                "debt": stmt.excluded.debt,
                "paid": stmt.excluded.paid,
            },
        )
        await db.execute(stmt)

    # Shop.inn ni fayldagi (yangi) INN bilan yangilaymiz — modal/mobile to'g'ri
    # INN ko'rsatishi uchun (rent_billing'ga yozish Shop.inn ni o'zgartirmaydi).
    from app.models import Shop
    from sqlalchemy import update as _update
    inn_updates = 0
    for rec in records:
        if rec["inn"]:
            await db.execute(
                _update(Shop)
                .where(Shop.shop_id == rec["shop_id"], Shop.market_id == market_id)
                .values(inn=rec["inn"])
            )
            inn_updates += 1
    res.inn_updates = inn_updates

    res.upserted = len(records)
    return res
