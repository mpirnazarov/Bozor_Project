# 3-BOSQICH BAJARILDI — API endpointlar

Asosiy biznes API'lari qo'shildi: dashboard, pavilions, shops, billing, INN.
Barcha endpointlar autentifikatsiya talab qiladi (login bo'lishi shart).

## Qo'shilgan fayllar

```
backend/app/
├── schemas/
│   ├── dashboard.py        # DashboardOut, ServicesBreakdown
│   ├── pavilion.py          # PavilionOut, PavilionDetailOut
│   └── billing.py           # ShopOut, BillingStatusOut, batch, INN schemas
├── services/
│   ├── dashboard_service.py # settings o'qish + live hisoblash
│   └── billing_service.py   # magazin/INN status hisoblash (N+1 siz)
└── api/
    ├── dashboard.py         # GET /api/dashboard
    ├── pavilions.py         # GET /api/pavilions[/{id}[/shops]]
    ├── shops.py             # GET /api/shops[/{shop_id}]
    ├── billing.py           # POST /api/billing/batch
    └── inn.py               # GET /api/inn/search, GET /api/inn/{inn}
```

## Endpointlar

### Dashboard
```
GET /api/dashboard
    → settings.dashboard_stats'dan (admin tahrirlagan qiymatlar)
    {total, paid, debt, services{rent,arava,xojatxona,parking,boshqa}, period, source:"settings"}

GET /api/dashboard?live=true&year=2026&month=5
    → monthly_balances'dan jonli hisoblanadi (source:"live")
```
"Real ma'lumot" tugmasi (frontend) `?live=true` ni chaqiradi.

### Pavilions
```
GET /api/pavilions                    # barcha aktiv (xarita uchun, koordinatalar)
GET /api/pavilions/{id}               # + shop_count
GET /api/pavilions/{id}/shops?year&month   # magazinlar + billing (tile ranglari)
```

### Shops
```
GET /api/shops?inn=&pavilion=&q=&page=&per_page=   # sahifalangan
GET /api/shops/{shop_id}?year&month                # + kontragent + billing
```

### Billing
```
POST /api/billing/batch
    body: {"shop_ids": ["01-1-1-151", ...], "year": 2026, "month": 5}
    → {results: {shop_id: {status, total_due, total_paid, total_debt, categories}}}
```

### INN
```
GET /api/inn/search?q=ZUBAYR&limit=20    # INN yoki nom bo'yicha
GET /api/inn/{inn}                        # kontragent + magazinlari
```

## Billing status logikasi
Status **INN darajasida** hisoblanadi (bir INN'da bir nechta magazin bo'lishi
mumkin, ular shu INN balansini ulashadi). Joriy oy `monthly_balances`
yig'indisidan:
- `paid` (qarzsiz, 🟢) — `due - paid <= 1`
- `partial` (qisman, 🟡) — qarz bor, lekin biror to'lov qilingan
- `unpaid` (to'lamagan, 🔴) — qarz bor, to'lov yo'q
- `no_data` (⚪) — bu INN uchun balans yo'q

Real ma'lumotda tekshirilgan taqsimot (2941 magazin):
`paid=2598, partial=210, unpaid=45, no_data=88`.

`compute_batch_status` N+1 query'siz ishlaydi — barcha INN balanslarini bitta
so'rovda oladi.

## Curl test
```bash
# avval login (cookie)
curl -c c.txt -X POST localhost:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"orikzor","password":"Orikzor_2026"}'

curl -b c.txt localhost:8000/api/dashboard
curl -b c.txt 'localhost:8000/api/dashboard?live=true'
curl -b c.txt localhost:8000/api/pavilions
curl -b c.txt 'localhost:8000/api/shops?per_page=5'
curl -b c.txt localhost:8000/api/shops/01-1-1-151
curl -b c.txt 'localhost:8000/api/inn/search?q=ZUBAYR'
curl -b c.txt -X POST localhost:8000/api/billing/batch \
  -H 'Content-Type: application/json' \
  -d '{"shop_ids":["01-1-1-151","04-5-1-141"],"year":2026,"month":5}'
```

## Keyingi qadam
**4-bosqich:** Frontend (React + TS + Tailwind + Shadcn) — login page, xarita view,
pavilion modal, shop detail, INN search, dashboard header.
