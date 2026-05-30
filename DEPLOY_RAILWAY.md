# 🚀 DEPLOY — Railway'da demo (eng oson yo'l)

Bu yo'riqnoma loyihani **Railway**'ga joylab, random HTTPS URL oladi. Server,
TLS, PostgreSQL — hammasi avtomatik. ~15 daqiqa.

> Railway `docker-compose.yml`ni to'g'ridan-to'g'ri ishlatmaydi — har bir servis
> alohida qo'shiladi. Quyida shu jarayon tushuntirilgan.

---

## 0. Tayyorgarlik
- Railway hisobi: https://railway.com (GitHub bilan kirish).
- Hobby plan: $5/oy (ichida $5 kredit). Demo uchun yetarli.
- Loyihani **GitHub repo**'ga yuklang (Railway repodan build qiladi):
  ```bash
  cd orikzor-v2
  git init && git add -A && git commit -m "orikzor v2"
  # GitHub'da repo oching, so'ng:
  git remote add origin https://github.com/SIZNING_USERNAME/orikzor-v2.git
  git push -u origin main
  ```

---

## 1. Railway loyiha yaratish
1. Railway dashboard → **New Project** → **Empty Project**.
2. Loyihaga nom bering (masalan `orikzor-demo`).

---

## 2. PostgreSQL qo'shish
1. **+ New** → **Database** → **Add PostgreSQL**.
2. Railway uni yaratadi va `DATABASE_URL` o'zgaruvchisini beradi.
3. ⚠ Bizning backend **asyncpg** ishlatadi. Keyingi qadamda backend
   `DATABASE_URL`ni to'g'rilaymiz (`postgresql+asyncpg://...`).

---

## 3. Backend servisini qo'shish
1. **+ New** → **GitHub Repo** → repongizni tanlang.
2. Servis nomi: `backend`.
3. **Settings → Build**:
   - **Root Directory**: `backend`
   - (Dockerfile avtomatik topiladi: `backend/Dockerfile`)
4. **Variables** (Settings → Variables) ga qo'shing:
   ```
   DATABASE_URL = postgresql+asyncpg://postgres:PAROL@HOST:PORT/railway
   JWT_SECRET_KEY = <64 belgilik random> 
   ENVIRONMENT = production
   COOKIE_SAMESITE = none
   INITIAL_ADMIN_USERNAME = admin
   INITIAL_ADMIN_PASSWORD = !@#$Orikzor_2026
   INITIAL_USER_USERNAME = orikzor
   INITIAL_USER_PASSWORD = Orikzor_2026
   ALLOWED_ORIGINS = https://FRONTEND-URL.up.railway.app
   ```
   - `DATABASE_URL`: Postgres servisining `DATABASE_URL`ini oling va boshini
     `postgresql://` → `postgresql+asyncpg://` ga o'zgartiring. (Yoki Railway
     reference: `postgresql+asyncpg://${{Postgres.PGUSER}}:${{Postgres.PGPASSWORD}}@${{Postgres.PGHOST}}:${{Postgres.PGPORT}}/${{Postgres.PGDATABASE}}`)
   - `JWT_SECRET_KEY`: terminalda `openssl rand -hex 32`.
   - `ALLOWED_ORIGINS`ni 5-qadamdan keyin to'ldirasiz (frontend URL bo'lgach).
5. **Settings → Networking → Generate Domain** — backend uchun random URL oladi,
   masalan `https://backend-xxxx.up.railway.app`. Bu URL'ni eslab qoling.
6. Deploy avtomatik boshlanadi. Log'da ko'rasiz:
   ```
   alembic upgrade head ... 
   ✅ Yaratildi: admin / orikzor
   → startup_seed: to'liq migratsiya (/app/bazar.db)
   ✅ 2077 kontragent, 16 pavilion, 2941 magazin, 5662 balans
   ```
   Tekshirish: `https://backend-xxxx.up.railway.app/health` → `{"status":"ok"}`

---

## 4. Frontend servisini qo'shish
1. **+ New** → **GitHub Repo** → **bir xil repo**ni yana tanlang.
2. Servis nomi: `frontend`.
3. **Settings → Build**:
   - **Root Directory**: `frontend`
4. **Variables**:
   ```
   VITE_API_URL = https://backend-xxxx.up.railway.app/api
   ```
   (3-qadamdagi backend domeni + `/api`)
5. **Settings → Networking → Generate Domain** — frontend uchun random URL:
   `https://frontend-yyyy.up.railway.app`. **Demo havolasi shu.**

---

## 5. Bog'lashni yakunlash (muhim — cookie uchun)
1. **Backend** servisiga qайting → **Variables** →
   `ALLOWED_ORIGINS` ni frontend URL'iga o'rnating:
   ```
   ALLOWED_ORIGINS = https://frontend-yyyy.up.railway.app
   ```
2. Backend avtomatik qayta deploy bo'ladi.

Bu kerak, chunki frontend va backend turli domenda — cookie (`SameSite=None;
Secure`) va CORS to'g'ri ishlashi uchun frontend domeni ruxsat etilishi shart.

---

## 6. Demo!
`https://frontend-yyyy.up.railway.app` oching:
- Login: `orikzor` / `Orikzor_2026`
- Admin: `admin` / `!@#$Orikzor_2026`

Xarita, dashboard, pavilion modallar, INN qidiruv, admin panel — hammasi ishlaydi.
Admin biror summani o'zgartirsa — barcha userlarda ko'rinadi (DB'da saqlanadi).

---

## 💡 Maslahatlar
- **Tartib**: Postgres → Backend (domen oling) → Frontend (domen oling) →
  backend `ALLOWED_ORIGINS`ni to'ldiring.
- **Random URL**: Railway "Generate Domain" tugmasi har servisga `*.up.railway.app`
  beradi — alohida domen sotib olish shart emas.
- **Narx**: 3 servis (Postgres+backend+frontend) demo trafik bilan ~$5/oy
  ichida. `Settings → uxlatish (sleep)`ni yoqsangiz, ishlatilmaganda deyarli 0.
- **Redis shart emas**: Sheets cache server xotirasida ishlaydi, demo uchun
  Redis qo'shmasangiz ham bo'ladi (`REDIS_URL`ni bo'sh qoldiring).
- **map.jpg**: xarita foni uchun `frontend/public/map.jpg` ni repoga qo'shing
  (bo'lmasa polygonlar baribir ko'rinadi).

## Muqobil (yanada osonroq, lekin VPS)
Agar bitta serverda hammasini `docker-compose up` bilan ishlatmoqchi bo'lsangiz:
DigitalOcean/Hetzner VPS + **Coolify** (docker-compose'ni to'g'ridan-to'g'ri
qo'llab-quvvatlaydi). Lekin VPS sozlash Railway'dan ko'ra ko'proq ish talab qiladi.
Demo uchun Railway tavsiya etiladi.
