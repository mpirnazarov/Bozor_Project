# 1-BOSQICH BAJARILDI — Auth (Alembic + JWT login)

Bu bosqichda backend autentifikatsiya tizimi qo'shildi: Alembic migration,
JWT login (httpOnly cookie + JSON token), `/me`, `/logout` va boshlang'ich
foydalanuvchilarni yaratish skripti.

## Qo'shilgan fayllar

```
backend/
├── alembic.ini                          # Alembic config (async)
├── alembic/
│   ├── env.py                           # Async migration runtime
│   ├── script.py.mako                   # Migration shabloni
│   └── versions/0001_users.py           # users jadvali
└── app/
    ├── deps.py                          # get_current_user, require_admin
    ├── schemas/auth.py                  # LoginRequest, TokenResponse, UserOut
    ├── services/auth_service.py         # authenticate_user, create_user
    ├── api/auth.py                       # /login, /logout, /me
    └── scripts/create_admin.py          # boshlang'ich userlar
```

`main.py` ga auth router ulandi: `prefix="/api/auth"`.

## Ishga tushirish

### 1. Muhitni tayyorlash
```bash
cp .env.example .env
# .env da JWT_SECRET_KEY ni to'ldiring:
#   openssl rand -hex 32
# va POSTGRES_PASSWORD, INITIAL_* parollarini tekshiring
```

### 2. Postgres'ni ko'tarish + backend
```bash
docker compose up -d postgres redis
cd backend
pip install -e .            # yoki: uv pip install -e .
```

### 3. Migration
```bash
cd backend
alembic upgrade head        # users jadvalini yaratadi
```

### 4. Boshlang'ich foydalanuvchilar
```bash
python -m app.scripts.create_admin
# Natija:
#   ✅ Yaratildi: admin (role=admin)
#   ✅ Yaratildi: orikzor (role=user)
```

### 5. Serverni ishga tushirish
```bash
uvicorn app.main:app --reload --port 8000
# Docs: http://localhost:8000/docs
```

## Curl bilan test

```bash
# Login (cookie faylga saqlanadi)
curl -i -c cookies.txt -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"orikzor","password":"Orikzor_2026"}'

# Joriy foydalanuvchi (cookie bilan)
curl -b cookies.txt http://localhost:8000/api/auth/me

# Yoki Bearer token bilan (login javobidagi access_token)
curl http://localhost:8000/api/auth/me \
  -H "Authorization: Bearer <ACCESS_TOKEN>"

# Admin login
curl -i -c admin.txt -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"!@#$Orikzor_2026"}'

# Logout
curl -b cookies.txt -X POST http://localhost:8000/api/auth/logout

# Noto'g'ri parol → 401
curl -i -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"orikzor","password":"xato"}'
```

## Xavfsizlik tafsilotlari
- Parollar **bcrypt** (cost=12) bilan hashlanadi.
- JWT **httpOnly** cookie'da; `secure` faqat productionda (dev HTTP uchun o'chiq).
- `SameSite=Lax`.
- Foydalanuvchi topilmaganda ham bcrypt verify chaqiriladi (timing-attack himoyasi).
- `password_hash` hech qachon API javobida chiqmaydi.

## Default qarorlar (keyingi bosqichga qoldirildi)
- **Rate limiting** (login) — 5-bosqich
- **Refresh token** (`/api/auth/refresh`) — keyinroq
- Hozircha bitta 1 kunlik access token

## Keyingi qadam
**2-bosqich:** qolgan modellar (counterparty, shop, pavilion, monthly_balance,
settings, audit_log) + SQLite (`bazar.db`) → PostgreSQL migratsiya skripti.
