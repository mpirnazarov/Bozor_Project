"""Audit yozuvlarini odam o'qiy oladigan ko'rinishga aylantirish (o'zbek tilida).

Amal (action), resurs va o'zgarishlardan kelib chiqib tushunarli matn quradi.
"""
from typing import Any

# Amal kodlari -> o'zbekcha nom
ACTION_LABELS: dict[str, str] = {
    "create_pavilion": "Region yaratildi",
    "update_pavilion": "Region tahrirlandi",
    "delete_pavilion": "Region o'chirildi",
    "import_shops_csv": "Magazinlar import qilindi (CSV)",
    "import_shops_gsheet": "Magazinlar import qilindi (Google Sheets)",
    "import_balances": "Balanslar import qilindi (Excel)",
    "import_excel": "Balanslar import qilindi (Excel)",
    "import_billing": "Billing import qilindi",
    "import_billing_failed": "Billing import RAD ETILDI (xato)",
    "revert": "Amal ortga qaytarildi",
    "update_dashboard": "Dashboard summalari yangilandi",
    "update_shop": "Magazin tahrirlandi",
    "update_theme": "Mavzu o'zgartirildi",
    "update_hide_unmatched": "Topilmagan magazinlar sozlamasi o'zgartirildi",
    "update_market": "Bozor tahrirlandi",
    "toggle_market": "Bozor holati o'zgartirildi",
    "update_market_theme": "Bozor mavzusi o'zgartirildi",
}

# Resurs turi -> o'zbekcha nom
RESOURCE_LABELS: dict[str, str] = {
    "pavilion": "Region",
    "shop": "Magazin",
    "shops": "Magazinlar",
    "settings": "Sozlamalar",
    "market": "Bozor",
    "balances": "Balanslar",
    "monthly_balances": "Billing (oylik balanslar)",
    "change_snapshot": "Amal (snapshot)",
    "import_log": "Import jurnali (fayl)",
    "dashboard": "Dashboard",
}


def action_label(action: str) -> str:
    return ACTION_LABELS.get(action, action.replace("_", " ").capitalize())


def resource_label(resource_type: str | None, resource_id: str | None) -> str:
    """Resursni batafsil yozadi, masalan: 'Region (#12)' yoki 'Sozlamalar: Mavzu'."""
    if not resource_type:
        return "—"
    base = RESOURCE_LABELS.get(resource_type, resource_type)
    if not resource_id:
        return base

    # Sozlamalar kalitlari uchun chiroyli nom
    settings_names = {
        "app_theme": "Mavzu (Dark/Light)",
        "hide_unmatched": "Topilmagan magazinlarni berkitish",
        "dashboard_stats": "Dashboard summalari",
    }
    if resource_type == "settings" and resource_id in settings_names:
        return f"{base}: {settings_names[resource_id]}"

    # Uzun resurs id (masalan URL yoki fayl nomi) qisqartiriladi
    rid = resource_id if len(resource_id) <= 40 else resource_id[:37] + "..."
    return f"{base} ({rid})"


def _fmt_amount(v: Any) -> str:
    try:
        return f"{int(float(v)):,}".replace(",", " ")
    except (ValueError, TypeError):
        return str(v)


def build_summary(action: str, resource_id: str | None, changes: dict | None) -> str:
    """Amaldan kelib chiqib 1-2 og'iz tushunarli izoh (o'zbekcha)."""
    c = changes or {}

    if action == "update_theme":
        theme = c.get("theme")
        nice = {"dark": "Qorong'i (Dark)", "light": "Yorug' (Light)"}.get(theme, theme)
        return f"Ilova mavzusi «{nice}» ga o'zgartirildi."

    if action == "update_hide_unmatched":
        on = c.get("hidden")
        return (
            "Topilmagan (bazada balansi yo'q) magazinlar berkitildi."
            if on else
            "Topilmagan magazinlar qayta ko'rsatiladigan qilindi."
        )

    if action == "update_dashboard":
        total = c.get("total")
        paid = c.get("paid")
        if total is not None and paid is not None:
            return (
                f"Dashboard summalari yangilandi: jami {_fmt_amount(total)} so'm, "
                f"to'langan {_fmt_amount(paid)} so'm."
            )
        return "Dashboard summalari qo'lda yangilandi."

    if action in ("import_shops_csv", "import_shops_gsheet"):
        rows = c.get("rows", 0)
        ins = c.get("inserted", 0)
        upd = c.get("updated", 0)
        src = "Google Sheets havolasidan" if action.endswith("gsheet") else "CSV fayldan"
        return (
            f"{src} {rows} ta qator o'qildi: {ins} ta yangi magazin qo'shildi, "
            f"{upd} ta yangilandi."
        )

    if action == "create_pavilion":
        return f"Xaritada yangi region «{resource_id or ''}» chizildi."

    if action == "update_pavilion":
        return f"Region «{resource_id or ''}» chegarasi yoki ma'lumoti o'zgartirildi."

    if action == "delete_pavilion":
        return f"Region «{resource_id or ''}» xaritadan o'chirildi."

    if action == "update_shop":
        return f"Magazin «{resource_id or ''}» ma'lumoti tahrirlandi."

    if action == "toggle_market":
        on = c.get("is_active")
        return (
            f"Bozor «{resource_id or ''}» vaqtincha o'chirildi."
            if on is False else
            f"Bozor «{resource_id or ''}» qayta yoqildi."
        )

    if action == "update_market":
        return f"Bozor «{resource_id or ''}» ma'lumoti tahrirlandi."

    # Umumiy holat
    label = action_label(action).lower()
    return f"{label.capitalize()}."
