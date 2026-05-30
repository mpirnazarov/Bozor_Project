# 2-BOSQICH BAJARILDI — Modellar + SQLite→PostgreSQL migratsiya

Barcha asosiy modellar, ularning Alembic migration'i va eski `bazar.db`'dan
ma'lumotlarni ko'chiruvchi idempotent skript qo'shildi.

## Qo'shilgan fayllar

```
backend/
├── alembic/versions/0002_core_tables.py   # barcha core jadvallar + indexlar
└── app/
    ├── models/
    │   ├── counterparty.py                 # Counterparty (+ pg_trgm GIN)
    │   ├── pavilion.py                      # Pavilion (xarita polygonlari)
    │   ├── shop.py                          # Shop (FK: pavilion, counterparty)
    │   ├── monthly_balance.py               # MonthlyBalance + BillingCategory
    │   ├── settings.py                      # Setting (JSONB) + DASHBOARD_SETTINGS_KEY
    │   └── audit_log.py                     # AuditLog
    └── scripts/
        ├── pavilion_seed.py                 # 16 ta pavilion seed
        └── migrate_from_sqlite.py           # SQLite -> PG migratsiya
```

## Modellar tafsiloti
- **Counterparty** — `inn` PK; `name` ustida pg_trgm GIN index (fuzzy qidirish uchun).
- **Pavilion** — xarita polygonlari; **16 ta pavilion to'liq `index.html`dan
  ekstrakt qilingan** (real koordinatalar, ranglar, label x/y/o'lcham/burchak).
  4-pavilion ikki polygonli (`metadata.extra_polygons`). Hammasi aktiv.
- **Shop** — `shop_id` unique; `pavilion_id`, `inn` FK (SET NULL).
- **MonthlyBalance** — asosiy billing; `UNIQUE(inn, year, month, category)`.
  Eski ruscha `type` (`Аренда`/`Вода`/`Электроэнергия`) → `rent`/`water`/`electricity`.
  `debet`→`due_amount`, `kredit`→`paid_amount`.
- **Setting** — JSONB value. Dashboard summalari `dashboard_stats` kaliti ostida.
- **AuditLog** — amallar tarixi.

## Ishga tushirish

```bash
cd backend
alembic upgrade head        # 0002 — barcha core jadvallar yaratiladi

# Migratsiya (docker'da bazar.db /data ga mount qilingan)
python -m app.scripts.migrate_from_sqlite
# yoki yo'lni ko'rsatib:
python -m app.scripts.migrate_from_sqlite --sqlite ../data/bazar.db
```

Kutilayotgan natija (real `bazar.db` bo'yicha tekshirilgan):
```
✅ 2077 ta kontragent
✅ 16 ta pavilion   (to'liq koordinatali, index.html'dan)
✅ 2941 ta magazin
✅ 5662 ta balans   (0 o'tkazib yuborilgan)
✅ 3 ta sozlama
```

Skript **idempotent** — qayta ishga tushirsangiz `ON CONFLICT DO UPDATE` orqali
yangilaydi, dublikat yaratmaydi.

## Dashboard summalari (muhim)
Summalar DB'dan **hisoblanmaydi** — `settings.dashboard_stats` JSON'ida turadi.
Admin har bir qiymatni alohida tahrirlaydi (jami, to'langan, 5 ta breakdown),
qarz = jami − to'langan avtomatik. Main page shu bitta manbadan o'qiydi.

Boshlang'ich qiymatlar:
```json
{
  "total": 11689498000,
  "paid": 10820572206,
  "services": {
    "rent": 9002499206, "arava": 164488000, "xojatxona": 247440000,
    "parking": 239792000, "boshqa": 1166353000
  },
  "period": {"year": 2026, "month": 5}
}
```
Breakdown yig'indisi = 10,820,572,206 (to'langan'ga aniq teng).

> **Kelajak (3-bosqich):** dashboard endpointida `?live=true` parametri —
> `monthly_balances`'dan jonli hisoblab qaytaradi. Frontendda "real ma'lumot"
> tugmasi shuni chaqiradi.

## Pavilion bog'lanishi haqida
16 ta pavilion endi to'liq koordinatalar bilan DB'da (xarita to'liq dinamik).
Lekin eski `shops.pavilion_code` formati (`04-3-1`, `07-12-Yerto'la` ...) pavilion
`id`lari (1-30) bilan to'g'ridan-to'g'ri mos kelmaydi, shuning uchun `shops.pavilion_id`
dastlab NULL qoladi va `pavilion_code` saqlanadi. Magazin↔pavilion bog'lanishini
keyin admin xarita muharririda yoki alohida mapping script bilan amalga oshiramiz.

## Keyingi qadam
**3-bosqich:** API endpointlar — `/api/dashboard` (+`?live=true`), `/api/pavilions`,
`/api/shops`, `/api/billing/batch`, `/api/inn/search`.
