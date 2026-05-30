# 1-BOSQICH: Backend Skeleton va Auth Modul

## ⏱ Vaqt: ~30-45 daqiqa

## 🎯 MAQSAD

PostgreSQL ulanishi, Alembic migration, User model va JWT-based autentifikatsiya tizimini yaratish.

---

## 📥 Kontekst (Claude Code'ga bering)

> Men "O'rikzor v2" loyihasini boshlayapman — PHP+SQLite tizimini Python+FastAPI+PostgreSQL'ga ko'chirayapman. 
> 
> Loyiha papkasi: `orikzor-v2/`
> 
> `CLAUDE_CODE_PROMPT.md` faylda to'liq spetsifikatsiya bor.
> 
> Hozir **1-bosqich**: backend skeleton + auth. Quyidagilarni yarating:
> 
> 1. `backend/alembic.ini` va `backend/alembic/env.py` — Alembic konfiguratsiyasi (async)
> 2. `backend/app/models/user.py` allaqachon bor — uni o'qing
> 3. Birinchi Alembic migration — users jadvalini yaratadi
> 4. `backend/app/schemas/auth.py` — Pydantic schemas: `LoginRequest`, `TokenResponse`, `UserOut`
> 5. `backend/app/services/auth_service.py` — `authenticate_user`, `create_user` funksiyalari
> 6. `backend/app/api/auth.py` — endpointlar:
>    - `POST /login` (httpOnly cookie + JSON token)
>    - `POST /logout`
>    - `GET /me`
> 7. `backend/app/deps.py` — `get_current_user`, `require_admin` dependency'lar
> 8. `backend/app/scripts/create_admin.py` — boshlang'ich admin va orikzor user yaratish
> 9. `main.py` ga auth routerni qo'shing
> 10. Curl bilan testlash uchun misol komandalar
> 
> **Talablar**:
> - SQLAlchemy 2.0 **async** style
> - Pydantic **v2**
> - JWT — `python-jose`, bcrypt — `passlib`
> - Tokenlar **httpOnly + Secure + SameSite=Lax** cookie'da
> - JSON response'da ham token qaytaring (mobile app uchun)
> - Login rate limiting (ko'p marta noto'g'ri kirish himoyasi)
> - Audit log uchun login/logout hodisalarini yozing (keyinroq)

---

## ✅ Bosqich tugaganda tekshirish

```bash
# 1. Migration ishladi
docker compose exec backend alembic upgrade head

# 2. Adminlar yaratildi
docker compose exec backend python -m app.scripts.create_admin

# 3. Login ishlaydi
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"!@#$Orikzor_2026"}' \
  -c cookies.txt

# 4. /me ishlaydi
curl http://localhost:8000/api/auth/me -b cookies.txt

# 5. Logout
curl -X POST http://localhost:8000/api/auth/logout -b cookies.txt
```

---

## 🚀 Keyingi qadam

`02-models-and-migration.md` — qolgan modellar (shops, counterparties, monthly_balances) va SQLite'dan migratsiya.
