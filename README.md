# O'rikzor v2 🏪

> Bozor boshqaruv tizimi — PostgreSQL + FastAPI + React

Eski v1 (PHP + SQLite + Vanilla JS) tizimining qayta yozilgan versiyasi.

---

## ✨ Asosiy xususiyatlar

- 🗺 Interaktiv SVG xarita (16+ pavilion, A-F bloklar)
- 💰 To'lov boshqaruvi (Arenda, Elektr, Suv)
- 🔐 Server-side autentifikatsiya (JWT + httpOnly cookies)
- 📊 Dashboard + statistika
- 🔍 INN bo'yicha qidirish
- 📑 Excel import (admin)
- 📈 Audit log
- 🏚 Yerto'la magazinlar (Google Sheets integratsiya)

---

## 🚀 Tez boshlash

### 1. Repo'ni klon qiling va env yarating
```bash
git clone <repo-url> orikzor
cd orikzor
cp .env.example .env

# JWT secret yarating
echo "JWT_SECRET_KEY=$(openssl rand -hex 32)" >> .env
```

### 2. Docker bilan ishga tushiring
```bash
docker compose up -d postgres redis
docker compose up backend
```

### 3. Migration + ma'lumotlarni yuklang
```bash
# Backend container ichida
docker compose exec backend alembic upgrade head
docker compose exec backend python -m app.scripts.create_admin
docker compose exec backend python -m app.scripts.migrate_from_sqlite /data/bazar.db
```

### 4. Frontend
```bash
docker compose up frontend
```

### 5. Brauzer
- Frontend: http://localhost:3000
- API docs: http://localhost:8000/docs
- Login: `orikzor` / `Orikzor_2026`
- Admin: `admin` / `!@#$Orikzor_2026`

---

## 📁 Struktura

```
orikzor/
├── backend/        # Python + FastAPI + SQLAlchemy + Alembic
├── frontend/       # React + TypeScript + Vite + Tailwind
├── data/           # map.jpg + boshlang'ich ma'lumotlar
├── nginx/          # Reverse proxy
└── docker-compose.yml
```

To'liq strukturasi → `CLAUDE_CODE_PROMPT.md`

---

## 🛠 Texnologiyalar

**Backend**: Python 3.11 · FastAPI · SQLAlchemy 2.0 (async) · Alembic · Pydantic v2 · python-jose (JWT) · bcrypt · asyncpg · openpyxl · httpx

**Frontend**: React 18 · TypeScript · Vite · TailwindCSS · Shadcn UI · TanStack Query · React Router · Zustand · Axios

**Infrastructure**: PostgreSQL 15 · Redis 7 · Nginx · Docker Compose

---

## 👨‍💻 Development

```bash
# Backend (hot reload)
cd backend
poetry install
poetry run uvicorn app.main:app --reload

# Frontend (hot reload)
cd frontend
npm install
npm run dev

# Tests
cd backend && pytest
cd frontend && npm test

# Lint
cd backend && ruff check . && black .
cd frontend && npm run lint
```

---

## 📦 Production deployment

```bash
docker compose --profile production up -d
```

HTTPS uchun nginx/ssl/ ichida sertifikatlar bo'lishi kerak (Let's Encrypt).

---

## 📄 Litsenziya

Proprietary — BetaSoft

---

## 👤 Egasi

Muslimbek Pirnazarov · +998 90 000 26 66
