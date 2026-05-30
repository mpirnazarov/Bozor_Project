# O'RIKZOR V2 — TO'LIQ LOYIHA BO'YICHA TOPSHIRIQ

## 🎯 LOYIHANING MAQSADI

"O'rikzor Savdo Kompleksi" bozor boshqaruv tizimini **professional, scalable, secure** ko'rinishda qayta yozish.

**Eski tizim** (almashtirilmoqda):
- PHP backend + SQLite + Vanilla JS (single file index.html ~17000 qator)
- LocalStorage'da auth saqlanardi (xavfsiz emas)
- File-based DB, deployment Plesk shared hosting

**Yangi tizim** (yaratiladi):
- **Backend**: Python + FastAPI + SQLAlchemy + Alembic + Pydantic v2
- **DB**: PostgreSQL 15+ (production-grade)
- **Frontend**: React + TypeScript + Vite + TailwindCSS + Shadcn UI
- **Auth**: JWT (server-side) + httpOnly cookies
- **Deployment**: Docker Compose (PostgreSQL + Backend + Frontend + nginx)

---

## 📋 ASOSIY FUNKSIYALAR (eski tizimdan saqlanadi)

### 1. **Foydalanuvchi roli**
- 🔐 **Login** (oddiy foydalanuvchi): `orikzor` / `Orikzor_2026`
- 🛡️ **Admin** (boshqaruv): `admin` / `!@#$Orikzor_2026`
- Server-side session, JWT tokens, httpOnly cookies

### 2. **Interaktiv xarita** (eski sahifadan ko'chiriladi)
- SVG xarita (map.jpg fonida)
- 16 ta pavilion polygon:
  - 1-7 raqamli pavilionlar (uzun bloklar)
  - **A-F harfli pavilionlar** (21-26 ID lar)
  - ATJ4 (27), 6P (28), K1 (29), ATJ5 (30)
- Pavilion bosilganda modal ochiladi

### 3. **Dashboard (header global stats)**
- **Jami**: 11,689,498,000 so'm
- **To'langan**: 10,820,572,206 so'm
- **Qarz**: hisoblanadi (jami - to'langan)
- **Jami** tugmasiga bosilganda popup:
  - 🏪 Arenda: 9,218,700,903
  - 🛒 Arava xizmati: 164,488,000
  - 🚻 Xojatxona xizmati: 247,440,000
  - 🚗 Avtomobillarni saqlash: 239,792,000
  - 📦 Boshqa tushumlar: 1,166,353,000

### 4. **Pavilion modal (magazin grid)**
- Tile grid: har magazin uchun rangli kvadrat
- **Status filter chips**: Hammasi / Qarzsiz / Qarzdor / Qisman / To'lamagan / Topilmadi
- **Kategoriya filter chips**: 📋 Barchasi / 🏠 Arenda / ⚡ Elektr / 💧 Suv
- Loading state (spinner) kategoriya o'zgarganda
- Ranglar:
  - 🟢 Yashil — qarzsiz
  - 🟡 Sariq — qisman to'lagan
  - 🔴 Qizil — to'lamagan
  - ⚪ Kulrang — ma'lumot yo'q

### 5. **Magazin detail modal**
- Magazin ma'lumotlari (ID, INN, kontragent, telefon, shartnoma)
- 3 ta to'lov karta (Arenda, Elektr, Suv) — joriy oy uchun
- Status banner (rangli)

### 6. **INN qidirish**
- Header'da search input
- INN yoki nom bo'yicha qidirish
- Topgan magazinlar ro'yxati

### 7. **Admin paneli**
- Login form (server JWT)
- Magazinlar CRUD
- To'lov ma'lumotlarini Excel'dan import (xlsx upload)
- Oylik balanslar boshqaruvi
- Foydalanuvchilar boshqaruvi (kelajakda)

### 8. **Yerto'la (12-region)**
- Google Sheets integratsiyasi
- Sheets ma'lumotlari + DB ma'lumotlari birlashtiriladi
- 571 ta yerto'la magazin, 16 ta pavilion guruh
- Maxsus alohida modal/sahifa

---

## 🏗 LOYIHA STRUKTURASI

```
orikzor/
├── docker-compose.yml              # PostgreSQL + Backend + Frontend + Nginx
├── .env.example                    # Environment variables shabloni
├── .gitignore
├── README.md
│
├── backend/                        # Python FastAPI
│   ├── pyproject.toml              # Poetry yoki uv
│   ├── Dockerfile
│   ├── alembic.ini
│   ├── alembic/                    # DB migration'lar
│   │   ├── env.py
│   │   └── versions/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                 # FastAPI entry point
│   │   ├── config.py               # Settings (pydantic-settings)
│   │   ├── database.py             # SQLAlchemy engine + session
│   │   ├── deps.py                 # Dependencies (auth, db)
│   │   │
│   │   ├── models/                 # SQLAlchemy models
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   ├── shop.py
│   │   │   ├── counterparty.py
│   │   │   ├── monthly_balance.py
│   │   │   ├── region.py
│   │   │   └── settings.py
│   │   │
│   │   ├── schemas/                # Pydantic models
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   ├── shop.py
│   │   │   ├── billing.py
│   │   │   └── ...
│   │   │
│   │   ├── api/                    # Routerlar
│   │   │   ├── __init__.py
│   │   │   ├── auth.py             # /api/auth/login, /logout, /me
│   │   │   ├── shops.py            # /api/shops
│   │   │   ├── billing.py          # /api/billing/batch
│   │   │   ├── inn.py              # /api/inn/{inn}
│   │   │   ├── pavilions.py        # /api/pavilions
│   │   │   ├── dashboard.py        # /api/dashboard
│   │   │   ├── yertola.py          # /api/yertola
│   │   │   └── admin.py            # /api/admin/* (import, CRUD)
│   │   │
│   │   ├── services/               # Biznes logika
│   │   │   ├── auth_service.py     # Login, JWT
│   │   │   ├── billing_service.py
│   │   │   ├── sheets_service.py   # Google Sheets fetch+cache
│   │   │   └── import_service.py   # Excel import
│   │   │
│   │   ├── utils/
│   │   │   ├── security.py         # Password hash, JWT
│   │   │   └── shop_id_matcher.py  # Cross-tier ID variants
│   │   │
│   │   └── scripts/
│   │       ├── migrate_from_sqlite.py  # Eski DB'dan ko'chirish
│   │       └── create_admin.py
│   │
│   └── tests/
│       ├── test_auth.py
│       ├── test_billing.py
│       └── ...
│
├── frontend/                       # React + TypeScript + Vite
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── public/
│   │   ├── map.jpg                 # Xarita rasmi
│   │   └── favicon.ico
│   │
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── routes.tsx              # React Router
│       │
│       ├── api/                    # Axios + React Query
│       │   ├── client.ts           # Axios instance + interceptors
│       │   ├── auth.ts
│       │   ├── shops.ts
│       │   ├── billing.ts
│       │   └── ...
│       │
│       ├── components/
│       │   ├── ui/                 # Shadcn UI (button, input, modal)
│       │   ├── Map/
│       │   │   ├── MapView.tsx         # Asosiy SVG xarita
│       │   │   ├── Pavilion.tsx        # Bitta polygon
│       │   │   ├── PavilionModal.tsx
│       │   │   ├── ShopTile.tsx
│       │   │   ├── ShopDetailModal.tsx
│       │   │   └── CategoryFilter.tsx
│       │   ├── Dashboard/
│       │   │   ├── HeaderStats.tsx
│       │   │   └── ServicesBreakdown.tsx
│       │   ├── INN/
│       │   │   └── InnSearch.tsx
│       │   ├── Yertola/
│       │   │   └── YertolaView.tsx
│       │   └── Auth/
│       │       └── LoginForm.tsx
│       │
│       ├── pages/
│       │   ├── HomePage.tsx        # Asosiy sahifa
│       │   ├── LoginPage.tsx
│       │   └── AdminPage.tsx
│       │
│       ├── hooks/
│       │   ├── useAuth.ts
│       │   └── useBilling.ts
│       │
│       ├── store/                  # Zustand
│       │   ├── authStore.ts
│       │   └── filterStore.ts
│       │
│       ├── types/                  # TypeScript types
│       │   └── api.ts
│       │
│       └── styles/
│           └── globals.css
│
├── data/
│   ├── map.jpg                     # Xarita rasmi (mavjud)
│   ├── bazar.db                    # Eski SQLite DB (migratsiya uchun)
│   └── seed/
│       └── initial_data.sql        # Boshlang'ich ma'lumotlar
│
└── nginx/
    └── nginx.conf                  # Reverse proxy config
```

---

## 🔧 TEXNOLOGIK STACK

### Backend
```toml
[python]
version = "3.11+"

[dependencies]
fastapi = "^0.110"
uvicorn = "^0.29"
sqlalchemy = "^2.0"
asyncpg = "^0.29"           # Async PostgreSQL driver
alembic = "^1.13"           # DB migration
pydantic = "^2.6"
pydantic-settings = "^2.2"
python-jose = "^3.3"        # JWT
passlib = "^1.7"            # Password hashing (bcrypt)
python-multipart = "^0.0"   # File upload
openpyxl = "^3.1"           # Excel
httpx = "^0.27"             # Async HTTP (Google Sheets)
redis = "^5.0"              # Cache (optional)
```

### Frontend
```json
{
  "react": "^18.3",
  "typescript": "^5.4",
  "vite": "^5.2",
  "@tanstack/react-query": "^5.32",
  "axios": "^1.6",
  "react-router-dom": "^6.23",
  "tailwindcss": "^3.4",
  "zustand": "^4.5",
  "lucide-react": "^0.383",
  "@radix-ui/react-*": "shadcn ui asoslari"
}
```

### Infrastructure
- **PostgreSQL 15+** (asosiy DB)
- **Redis 7** (cache, optional)
- **Nginx** (reverse proxy + static fayllar)
- **Docker Compose** (development + production)

---

## 📊 POSTGRESQL DB SCHEMA

```sql
-- USERS jadvali (auth)
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'user',  -- 'user', 'admin'
  full_name VARCHAR(255),
  email VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

-- COUNTERPARTIES (kontragentlar)
CREATE TABLE counterparties (
  id SERIAL PRIMARY KEY,
  inn VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(500) NOT NULL,
  contract_no VARCHAR(100),
  contract_date DATE,
  phone VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_counterparties_inn ON counterparties(inn);
CREATE INDEX idx_counterparties_name ON counterparties USING gin(name gin_trgm_ops);

-- PAVILIONS (xarita pavilionlari)
CREATE TABLE pavilions (
  id INT PRIMARY KEY,
  display_name VARCHAR(100) NOT NULL,        -- "1-PAVILON", "A-BLOK", "ATJ4"
  display_text VARCHAR(10),                  -- "1", "A", "ATJ4" (xaritada)
  pavilion_type VARCHAR(50),                 -- "long", "block", "atj", "kiosk"
  polygon_points TEXT,                        -- SVG polygon: "476,262 595,262 ..."
  fill_color VARCHAR(20) DEFAULT '#d4a373',
  fill_opacity REAL DEFAULT 0.45,
  stroke_color VARCHAR(20) DEFAULT '#b45309',
  stroke_width REAL DEFAULT 3,
  label_x REAL,
  label_y REAL,
  label_rotation REAL DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  display_order INT DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- SHOPS (magazinlar)
CREATE TABLE shops (
  id SERIAL PRIMARY KEY,
  shop_id VARCHAR(50) UNIQUE NOT NULL,       -- "04-3-1-058", "07-12-Yerto'la-029"
  pavilion_code VARCHAR(100),                 -- "04-3-1", "07-12-Yerto'la"
  pavilion_id INT REFERENCES pavilions(id) ON DELETE SET NULL,
  inn VARCHAR(20) REFERENCES counterparties(inn) ON DELETE SET NULL,
  shop_type VARCHAR(100),
  purpose TEXT,
  monthly_rent NUMERIC(15, 2) DEFAULT 0,
  source_sheet VARCHAR(100),
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_shops_shop_id ON shops(shop_id);
CREATE INDEX idx_shops_pavilion_code ON shops(pavilion_code);
CREATE INDEX idx_shops_inn ON shops(inn);
CREATE INDEX idx_shops_active ON shops(is_active);

-- MONTHLY_BALANCES (oylik balanslar — asosiy billing manbai)
CREATE TABLE monthly_balances (
  id SERIAL PRIMARY KEY,
  inn VARCHAR(20) NOT NULL,
  year SMALLINT NOT NULL,
  month SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
  category VARCHAR(20) NOT NULL,             -- 'rent', 'electricity', 'water'
  due_amount NUMERIC(15, 2) DEFAULT 0,       -- debet
  paid_amount NUMERIC(15, 2) DEFAULT 0,      -- kredit
  account_code INT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(inn, year, month, category)
);

CREATE INDEX idx_balances_inn ON monthly_balances(inn);
CREATE INDEX idx_balances_period ON monthly_balances(year, month);
CREATE INDEX idx_balances_inn_period ON monthly_balances(inn, year, month);

-- SETTINGS (umumiy sozlamalar)
CREATE TABLE settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_by INT REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AUDIT_LOG (kimning nima qilganini saqlash)
CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  action VARCHAR(50) NOT NULL,               -- "login", "create_shop", "update_balance"
  resource_type VARCHAR(50),
  resource_id VARCHAR(100),
  changes JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_created ON audit_log(created_at);
```

---

## 🚀 ASOSIY API ENDPOINTLAR

### Auth (`/api/auth/`)
```
POST   /api/auth/login           # JWT token, httpOnly cookie
POST   /api/auth/logout
GET    /api/auth/me              # Joriy foydalanuvchi
POST   /api/auth/refresh         # Token yangilash
```

### Dashboard
```
GET    /api/dashboard            # Header stats + xizmatlar breakdown
```

### Shops & Billing
```
GET    /api/shops                # ?inn=, ?pavilion=, ?page=, ?per_page=
GET    /api/shops/{shop_id}
POST   /api/billing/batch        # body: {shop_ids, year, month}
GET    /api/inn/{inn}            # INN bo'yicha kontragent + magazinlar
GET    /api/inn/search?q=        # Qidirish
```

### Pavilions
```
GET    /api/pavilions            # Barcha pavilionlar (xarita uchun)
GET    /api/pavilions/{id}       # Pavilion + magazinlar
GET    /api/pavilions/{id}/shops # Pavilion magazinlari billing bilan
```

### Yertola
```
GET    /api/yertola              # Pavilions list
GET    /api/yertola/{pavilion}   # Magazinlar Sheets+DB
POST   /api/yertola/refresh      # Sheets cache yangilash
```

### Admin (auth: admin)
```
GET    /api/admin/users
POST   /api/admin/users
PUT    /api/admin/shops/{id}
POST   /api/admin/import/excel   # Excel upload
GET    /api/admin/audit-log
```

---

## ⚙️ MUHIM TALABLAR

### Xavfsizlik
- ✅ **localStorage'da hech narsa saqlanmaydi** — barcha sessiya server'da
- ✅ **JWT httpOnly cookie** (XSS himoyasi)
- ✅ **CSRF tokens** har bir POST/PUT/DELETE uchun
- ✅ **Password hashing** (bcrypt, cost=12)
- ✅ **SQL injection** himoyasi (SQLAlchemy parametrlangan)
- ✅ **Rate limiting** (login uchun)
- ✅ **CORS** to'g'ri sozlangan

### Performance
- ✅ **Async** SQLAlchemy (asyncpg)
- ✅ **Connection pool** (10-20 ulanish)
- ✅ **Redis cache** (Google Sheets, dashboard)
- ✅ **Indexlar** to'liq
- ✅ **N+1 query** oldini olish (eager loading)

### Code quality
- ✅ **Type hints** hamma joyda
- ✅ **Pydantic schemas** validation
- ✅ **Pytest** testlar
- ✅ **Ruff** + **Black** linting
- ✅ **TypeScript strict mode** frontend
- ✅ **ESLint + Prettier**

---

## 📦 MIGRATSIYA MAVJUD MA'LUMOTLARDAN

1. **`scripts/migrate_from_sqlite.py`** — eski `bazar.db`'dan PostgreSQL'ga ko'chirish
2. Boshlang'ich admin foydalanuvchi yaratish:
   ```bash
   python -m app.scripts.create_admin --username admin --password '!@#$Orikzor_2026'
   python -m app.scripts.create_admin --username orikzor --password 'Orikzor_2026' --role user
   ```
3. Pavilion polygon'lar `pavilions` jadvaliga yuklanadi
4. Settings yuklanadi (DEFAULT_TOTAL_SUM, services, va h.k.)

---

## 🎯 BIRINCHI QADAMLAR (Claude Code'da)

### 1-bosqich: Infrastructure
- [ ] `docker-compose.yml` + `.env.example`
- [ ] PostgreSQL service
- [ ] Backend skeleton (`backend/`)
- [ ] Frontend skeleton (`frontend/`)
- [ ] Nginx reverse proxy

### 2-bosqich: Backend boshlanishi
- [ ] FastAPI app setup
- [ ] SQLAlchemy + Alembic
- [ ] Auth (JWT + httpOnly cookies)
- [ ] User model + login endpoint
- [ ] Migration script (SQLite → PostgreSQL)

### 3-bosqich: Asosiy API
- [ ] Shops CRUD
- [ ] Billing batch endpoint
- [ ] INN search
- [ ] Pavilions endpoint
- [ ] Dashboard endpoint

### 4-bosqich: Frontend
- [ ] Vite + React + TS setup
- [ ] Tailwind + Shadcn UI
- [ ] React Router
- [ ] Auth context + login form
- [ ] MapView component (SVG)
- [ ] PavilionModal
- [ ] CategoryFilter
- [ ] ShopDetailModal

### 5-bosqich: Yangi xususiyatlar
- [ ] Yertola Google Sheets
- [ ] Excel import (admin)
- [ ] Audit log
- [ ] Redis cache

### 6-bosqich: Deployment
- [ ] Production Docker setup
- [ ] HTTPS (Let's Encrypt)
- [ ] Backup strategiyasi
- [ ] CI/CD (GitHub Actions)

---

## 💡 SUHBAT BOSHLANISHI UCHUN

Claude Code'ga shu prompt'ni yuborish:

> "Men `CLAUDE_CODE_PROMPT.md` fayldagi loyihani boshlamoqchiman. Avval `docker-compose.yml` va backend skeleton'ini yaratamiz. PostgreSQL ulanishi, FastAPI app strukturasi, auth modulini ko'rsating. Boshlang."

Yoki:

> "Migratsiya skriptidan boshlaylik — `bazar.db` SQLite faylidagi ma'lumotlarni PostgreSQL'ga ko'chirish uchun `migrate_from_sqlite.py` yarating. Avval SQLAlchemy modellarini ko'rsating."
