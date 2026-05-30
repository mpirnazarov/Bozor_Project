# 2-BOSQICH: Modellar va SQLite Migratsiya

## 🎯 MAQSAD

Barcha SQLAlchemy modellarini yaratish, Alembic migration va eski `bazar.db` SQLite faylidan ma'lumotlarni PostgreSQL'ga ko'chirish.

---

## 📥 Kontekst (Claude Code'ga bering)

> 1-bosqich tugadi (auth ishlaydi). Endi qolgan modellarni yarataylik va eski SQLite faylidan migratsiya.
> 
> Eski `bazar.db` schema'si — `CLAUDE_CODE_PROMPT.md`'da batafsil. Asosiy jadvallar:
> - `counterparties` (2077 qator) — INN, ism, telefon
> - `shops` (2941 qator) — magazinlar
> - `monthly_balances` (5662 qator) — asosiy billing manbai
> - `regions` (4 qator) — eski xarita konfiguratsiyasi
> - `settings` (56 qator) — sozlamalar
> 
> Yaratishingiz kerak:
> 
> 1. **Modellar**:
>    - `models/counterparty.py` — Counterparty
>    - `models/pavilion.py` — Pavilion (yangi, xaritadagi polygonlar uchun)
>    - `models/shop.py` — Shop (counterparty va pavilion bilan relationship)
>    - `models/monthly_balance.py` — MonthlyBalance
>    - `models/settings.py` — Setting (JSONB value)
>    - `models/audit_log.py` — AuditLog
> 
> 2. **Migration**:
>    - Alembic autogenerate qo'llang
>    - Indexlar va constraints to'liq
>    - pg_trgm GIN index Counterparty.name uchun
> 
> 3. **Pavilion seed data** — boshlang'ich 16 ta pavilion (asl `index.html`'dan ko'chiring):
>    ```
>    Pavilion 1-5 (raqamli, uzun)
>    Pavilion 6 (text='7')
>    Pavilion 21-26 (text='A','B','C','D','E','F')
>    Pavilion 27 (ATJ4), 28 (6P), 29 (K1), 30 (ATJ5)
>    ```
>    Polygon koordinatalari `data/seed/pavilions.json` faylda saqlansin.
> 
> 4. **Settings seed**:
>    ```json
>    {
>      "dashboard_total": 11689498000,
>      "dashboard_paid": 10820572206,
>      "services": {
>        "rent": 9218700903,
>        "arava": 164488000,
>        "xojatxona": 247440000,
>        "parking": 239792000,
>        "boshqa": 1166353000
>      },
>      "current_year": 2026,
>      "current_month": 5
>    }
>    ```
> 
> 5. **Migratsiya skripti** — `app/scripts/migrate_from_sqlite.py`:
>    - SQLite faylni ochib, jadvallarni ko'chirish
>    - INN bo'yicha counterparty bog'lanish
>    - `monthly_balances.type` (kirillcha 'Аренда' → 'rent', 'Электроэнергия' → 'electricity', 'Вода' → 'water')
>    - Pavilion'larni shop_id'ga qarab aniqlash (`shop_id` prefix bilan)
>    - Progress bar (tqdm) ko'rsatish
>    - Idempotent — qayta ishga tushirsa duplicate yaratmasin

---

## ✅ Bosqich tugaganda tekshirish

```bash
# 1. Migration
docker compose exec backend alembic upgrade head

# 2. Pavilion va settings seed
docker compose exec backend python -m app.scripts.seed_pavilions
docker compose exec backend python -m app.scripts.seed_settings

# 3. SQLite migratsiya
docker compose exec backend python -m app.scripts.migrate_from_sqlite /data/bazar.db

# 4. Tekshirish
docker compose exec postgres psql -U orikzor -c "SELECT COUNT(*) FROM shops WHERE is_active = true;"
docker compose exec postgres psql -U orikzor -c "SELECT COUNT(*) FROM monthly_balances;"
docker compose exec postgres psql -U orikzor -c "SELECT COUNT(*) FROM counterparties;"
```

---

## 🚀 Keyingi qadam

`03-api-endpoints.md` — Shops, Billing, INN, Pavilions, Dashboard endpointlari.
