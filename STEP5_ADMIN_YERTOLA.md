# 5-BOSQICH BAJARILDI — Admin panel + Yerto'la

Admin API, Excel import, audit log, Yerto'la (Google Sheets) integratsiyasi va
to'liq admin frontend. **Hamma narsa serverda saqlanadi** — admin biror narsani
o'zgartirsa, barcha foydalanuvchilarda ko'rinadi (localStorage'da hech narsa yo'q).

## Backend — qo'shilgan fayllar
```
app/
├── schemas/admin.py                  # DashboardUpdate, ShopUpdate, PavilionUpdate, ImportResult, AuditLogOut
├── services/
│   ├── audit_service.py              # write_audit()
│   ├── import_service.py             # Excel (xlsx) -> monthly_balances
│   └── sheets_service.py             # Google Sheets CSV fetch + in-memory TTL cache
└── api/
    ├── admin.py                      # /api/admin/* (require_admin)
    └── yertola.py                    # /api/yertola/*
```

### Admin endpointlar (hammasi admin huquqi talab qiladi)
```
PUT  /api/admin/dashboard            # dashboard summalarini yangilash (har biri alohida)
PUT  /api/admin/shops/{shop_id}      # magazin tahrirlash (pavilion_id bog'lash)
PUT  /api/admin/pavilions/{id}       # xarita polygon/rang/label tahrirlash
POST /api/admin/import/excel         # xlsx import (?year=&month=)
GET  /api/admin/audit-log            # oxirgi amallar
```
Har bir o'zgartirish **audit_log**'ga yoziladi (kim, nima, qachon).

### Yerto'la
```
GET  /api/yertola                    # pavilion guruhlari + cache holati
GET  /api/yertola/{pavilion_code}    # DB + Sheets birlashtirilgan magazinlar
POST /api/yertola/refresh            # Sheets cache yangilash (admin)
```
Sheets cache **server xotirasida** (in-memory TTL, barcha userlar uchun umumiy).

## Frontend — qo'shilgan fayllar
```
src/
├── api/admin.ts, api/yertola.ts
├── pages/AdminPage.tsx               # tabs (Tabs radix)
└── components/Admin/
    ├── DashboardEditor.tsx           # har bir summa alohida input
    ├── ExcelImport.tsx               # fayl upload + natija
    └── AuditLogView.tsx              # jadval
```
HomePage header'da admin uchun ⚙ tugma (`/admin`).

### Dashboard editor
- Har bir qiymat alohida: Jami, To'langan, 5 ta breakdown.
- Qarzdorlik = Jami − To'langan (avto, faqat ko'rsatiladi).
- Breakdown yig'indisi To'langan'ga teng emasligini ogohlantiradi.
- "Saqlash" → `PUT /api/admin/dashboard` → DB → barcha userlar ko'radi.

## Muhim: hech narsa local emas
- Auth — httpOnly cookie (server JWT), localStorage yo'q.
- Dashboard summalari — `settings` jadvalida (DB).
- Xarita pavilionlari — `pavilions` jadvalida (DB).
- Sheets cache — server xotirasida (in-memory), browser emas.
- Admin o'zgartirgan har bir narsa darhol barcha foydalanuvchilarda aks etadi.

## Test
```bash
# admin login
curl -c a.txt -X POST localhost:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"!@#$Orikzor_2026"}'

# dashboard yangilash
curl -b a.txt -X PUT localhost:8000/api/admin/dashboard \
  -H 'Content-Type: application/json' \
  -d '{"total":11689498000,"paid":10820572206,"services":{"rent":9002499206,"arava":164488000,"xojatxona":247440000,"parking":239792000,"boshqa":1166353000}}'

curl -b a.txt localhost:8000/api/admin/audit-log
curl -b a.txt localhost:8000/api/yertola
```

## Excel import format
Birinchi qator sarlavha. Ustun nomlari moslashuvchan (uz/ru/en):
`inn|stir`, `year|yil`, `month|oy`, `category|type|tur`, `due|debet`, `paid|kredit`,
`account_code`. category: rent/water/electricity yoki Аренда/Вода/Электроэнергия.

## Eslatma
- Excel import upsert (mavjudini yangilaydi). inserted soni taxminiy (upsert).
- Yerto'la Sheets moslashtirilishi (shop_id/inn key) real Sheets ustunlariga
  qarab keyin aniqlashtiriladi.

## Loyiha holati
1-5 bosqichlar tugadi: infra, auth, modellar+migratsiya, API, frontend, admin+yerto'la.
Qolgan ixtiyoriy ishlar: rate limiting, refresh token, Redis cache, xarita
muharriri UI (polygon drag), magazin↔pavilion ommaviy bog'lash, CI/CD, HTTPS.
