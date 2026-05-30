# 4-BOSQICH: Frontend (React + TypeScript + Tailwind)

## 🎯 MAQSAD

React frontend, asosiy layout, login page, xarita view.

---

## 📥 Kontekst (Claude Code'ga bering)

> Backend tayyor. Endi frontend.
> 
> **Stack**: Vite + React 18 + TypeScript + TailwindCSS + Shadcn UI + TanStack Query + Zustand + Axios + React Router
> 
> Quyidagilarni yarating:
> 
> ### 1. Vite + TS setup
> - `vite.config.ts` — proxy `/api` → `http://backend:8000`
> - `tsconfig.json` — strict mode
> - `tailwind.config.js` + `postcss.config.js`
> - `src/styles/globals.css` — Tailwind directive'lar
> 
> ### 2. API klient (`src/api/client.ts`)
> - Axios instance
> - `withCredentials: true` (cookie uchun)
> - Interceptor: 401 → login sahifasiga redirect
> - Type-safe wrapper'lar
> 
> ### 3. Auth (`src/api/auth.ts` va `src/hooks/useAuth.ts`)
> - `login`, `logout`, `me` API funksiyalari
> - React Query mutation/query
> - `AuthProvider` context
> 
> ### 4. Router (`src/routes.tsx`)
> ```
> /                  → HomePage (xarita, auth talab qiladi)
> /login             → LoginPage
> /admin             → AdminPage (admin role talab qiladi)
> ```
> 
> ### 5. `LoginPage.tsx`
> Eski `index.html`'dagi login overlay'ga o'xshash dizayn:
> - Gradient background
> - 🏪 logo
> - "O'rikzor Savdo Kompleksi" sarlavhasi
> - Login va parol inputlari
> - Xato xabari
> - © 2026 BetaSoft footer
> 
> ### 6. `HomePage.tsx` skeleton
> - Header (logo + INN qidirish + foydalanuvchi menu)
> - Dashboard stats (`HeaderStats.tsx`)
> - SVG xarita (`MapView.tsx`)
> 
> ### 7. `MapView.tsx`
> - SVG viewBox `0 0 1568 1109`
> - `map.jpg` background image (`<image>` element)
> - 16 ta pavilion `<g>` polygon (backend'dan `/api/pavilions` olib)
> - Polygon bosilganda `PavilionModal` ochiladi
> - Hover effekt
> 
> ### 8. `PavilionModal.tsx`
> - Header: pavilion nomi, statistika
> - Status filter chips (Hammasi/Qarzsiz/Qarzdor/Qisman/Topilmadi)
> - Kategoriya filter chips (Barchasi/Arenda/Elektr/Suv)
> - Loading spinner
> - Tile grid (`ShopTile.tsx`)
> - Tile bosilganda `ShopDetailModal.tsx`
> 
> ### 9. `useBatchBilling.ts` hook
> - TanStack Query bilan
> - Kategoriya o'zgarganda backend'dan billing oladi
> - Cache 5 daqiqa
> 
> ### 10. Zustand store (`src/store/filterStore.ts`)
> ```typescript
> {
>   currentCategory: 'all' | 'rent' | 'electricity' | 'water',
>   currentStatus: 'all' | 'paid' | 'unpaid' | 'partial' | 'notfound',
>   setCategory: (c) => void,
>   setStatus: (s) => void,
> }
> ```
> 
> ### Talablar:
> - **localStorage'da hech narsa saqlanmasin** — auth httpOnly cookie'da
> - **TypeScript strict mode** — barcha types aniq
> - **TanStack Query** har bir API chaqiruvi uchun
> - **Tailwind utility classes** — custom CSS minimal
> - **Shadcn UI komponentlar** uchun `lib/utils.ts` (cn helper)
> - **Accessibility**: ARIA labels, keyboard navigation
> - **Mobile responsive** — Tailwind breakpoints
> - **Loading states**, **error boundaries**

---

## ✅ Bosqich tugaganda tekshirish

```bash
# Frontend ishga tushiring
cd frontend && npm install
docker compose up frontend

# Brauzer
# http://localhost:3000 — login sahifa
# Login: orikzor / Orikzor_2026
# → Asosiy sahifa, xarita, dashboard
# Polygon bossangiz → modal ochiladi
# Kategoriya filter bossangiz → ranglar yangilanadi
```

---

## 🚀 Keyingi qadam

`05-yertola-and-admin.md` — Yerto'la integratsiya + admin paneli.
