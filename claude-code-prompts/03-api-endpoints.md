# 3-BOSQICH: API Endpointlar

## 🎯 MAQSAD

Asosiy biznes API'larni yaratish: shops, billing, INN, pavilions, dashboard.

---

## 📥 Kontekst (Claude Code'ga bering)

> 2-bosqich tugadi — barcha ma'lumotlar PostgreSQL'da. Endi API'larni yarataylik.
> 
> Quyidagi endpointlarni yarating:
> 
> ### 1. `app/api/dashboard.py`
> ```
> GET /api/dashboard
> Javob: {
>   "total": 11689498000,
>   "paid": 10820572206,
>   "debt": 868925794,
>   "services": {
>     "rent": 9218700903,
>     "arava": 164488000,
>     "xojatxona": 247440000,
>     "parking": 239792000,
>     "boshqa": 1166353000
>   },
>   "period": {"year": 2026, "month": 5}
> }
> ```
> Settings jadvalidan o'qib qaytaradi. Agar `?live=true` parametri bor bo'lsa, monthly_balances'dan hisoblab qaytaradi.
> 
> ### 2. `app/api/pavilions.py`
> ```
> GET /api/pavilions                # Barcha aktiv pavilionlar (xarita uchun)
> GET /api/pavilions/{id}           # Bitta pavilion + magazinlar soni
> GET /api/pavilions/{id}/shops     # Magazinlar + billing
>     query: ?year=2026&month=5&category=all|rent|electricity|water
> ```
> 
> ### 3. `app/api/shops.py`
> ```
> GET /api/shops                    # ?pavilion=, ?inn=, ?q=, ?page=, ?per_page=
> GET /api/shops/{shop_id}          # Bitta magazin (cross-tier ID matching bilan)
> ```
> 
> ### 4. `app/api/billing.py`
> ```
> POST /api/billing/batch
> Body: {
>   "shop_ids": ["01-1-1-001", "01-1-1-002", ...],
>   "year": 2026,
>   "month": 5
> }
> Javob: {
>   "billings": {
>     "01-1-1-001": {
>       "inn": "303095497",
>       "rent": {"due": 5000000, "paid": 5000000, "debt": 0},
>       "electricity": {"due": 250000, "paid": 200000, "debt": 50000},
>       "water": {"due": 50000, "paid": 50000, "debt": 0}
>     }
>   }
> }
> ```
> 
> ### 5. `app/api/inn.py`
> ```
> GET /api/inn/search?q=marcas      # Qidirish (trigram + ILIKE)
> GET /api/inn/{inn}                # INN bo'yicha kontragent + magazinlar + payments
>     query: ?year=2026&month=5
> ```
> 
> ### Talablar:
> - **Auth talabi**: barcha endpointlar `require_user` dependency'sini ishlatadi (login kerak)
> - **Admin endpointlar**: `require_admin`
> - **Pagination**: 50 default, 200 max
> - **Cross-tier ID matching** — `utils/shop_id_matcher.py` yarating:
>   ```python
>   def get_shop_id_variants(shop_id: str) -> list[str]:
>       """04-3-1-058 ↔ 04-3-1-58 variantlarini qaytaradi."""
>   ```
> - **Bitta SQL** so'rovi bilan batch billing (N+1 oldini olish)
> - **Type matching**: 
>   ```python
>   def normalize_billing_type(raw: str) -> str:
>       """'Аренда' → 'rent', 'Электроэнергия' → 'electricity', 'Вода' → 'water'."""
>   ```
> - **Pydantic v2 schemas** har bir response uchun
> - **OpenAPI** auto-generated docs (`/docs`)
> 
> ### Service layer
> 
> `app/services/billing_service.py`:
> ```python
> async def get_batch_billing(
>     db: AsyncSession,
>     shop_ids: list[str],
>     year: int,
>     month: int,
> ) -> dict[str, BillingItem]:
>     """Optimallashgan batch billing — bitta query."""
> ```

---

## ✅ Bosqich tugaganda tekshirish

```bash
# Login va session
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"!@#$Orikzor_2026"}' \
  -c cookies.txt

# Dashboard
curl http://localhost:8000/api/dashboard -b cookies.txt

# Pavilions
curl http://localhost:8000/api/pavilions -b cookies.txt
curl http://localhost:8000/api/pavilions/1/shops?year=2026&month=5 -b cookies.txt

# Shop
curl http://localhost:8000/api/shops/01-1-1-001 -b cookies.txt

# Billing batch
curl -X POST http://localhost:8000/api/billing/batch \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"shop_ids":["01-1-1-001","01-1-1-002"],"year":2026,"month":5}'

# INN search
curl http://localhost:8000/api/inn/search?q=marcas -b cookies.txt
curl http://localhost:8000/api/inn/307415584 -b cookies.txt
```

---

## 🚀 Keyingi qadam

`04-frontend-setup.md` — React skeleton, auth, asosiy layout.
