# 4-BOSQICH BAJARILDI — Frontend (React + TS + Vite + Tailwind)

To'liq frontend: login, dashboard, dinamik SVG xarita, pavilion/shop modallar,
INN qidirish. Backend API'lariga ulanadi (httpOnly cookie auth).

## Stack
React 18 + TypeScript (strict) + Vite + TailwindCSS + TanStack Query + Zustand +
Axios + React Router + Radix Dialog. (Shadcn o'rniga yengil custom UI.)

## Struktura
```
frontend/
├── index.html, vite.config.ts, tsconfig*.json
├── tailwind.config.js, postcss.config.js, nginx.conf
├── public/            # map.jpg shu yerga qo'yiladi (README.txt bor)
└── src/
    ├── main.tsx, App.tsx, routes.tsx, vite-env.d.ts
    ├── styles/globals.css
    ├── types/api.ts            # backend schemalariga mos TS tiplar
    ├── lib/utils.ts            # cn(), fmtUZS(), status ranglari
    ├── store/authStore.ts      # Zustand auth (login/logout/checkAuth)
    ├── api/                    # client + auth/dashboard/pavilions/shops/inn
    ├── components/
    │   ├── ui/Modal.tsx        # Modal + Spinner
    │   ├── Dashboard/HeaderStats.tsx   # stats + breakdown popup + "Real hisobla"
    │   ├── INN/InnSearch.tsx
    │   └── Map/MapView.tsx, PavilionModal.tsx, ShopDetailModal.tsx
    └── pages/                  # LoginPage, HomePage, AdminPage
```

## Asosiy oqim
1. `App` ochilganda `checkAuth()` (`GET /auth/me`) — cookie bor bo'lsa avtomatik kirish.
2. `/login` — orikzor yoki admin. Muvaffaqiyatdan keyin `/` ga.
3. `/` (HomePage):
   - **HeaderStats** — Jami / To'langan / Qarzdorlik. To'langan yonidagi (i)
     tugma → tushum tarkibi popup. "Real hisobla" tugmasi → `?live=true`.
   - **InnSearch** — INN yoki nom bo'yicha, tanlanganda kontragent modali.
   - **MapView** — `GET /api/pavilions`'dan **dinamik** SVG render (har polygon,
     rang, label DB'dan; 4-pavilion ikki polygonli `metadata.extra_polygons`).
4. Pavilion bosilganda **PavilionModal** — tile grid, status filtr chip'lar,
   rang-kodlangan (yashil/sariq/qizil/kulrang), loading state.
5. Tile bosilganda **ShopDetailModal** — magazin + kontragent + 3 to'lov karta
   (Arenda/Elektr/Suv) + status banner.
6. 401 bo'lsa — avtomatik `/login` ga (axios interceptor).

## Ishga tushirish (lokal, backendsiz dev)
```bash
cd frontend
npm install
npm run dev          # http://localhost:3000
# /api so'rovlari http://localhost:8000 ga proxy qilinadi (vite.config.ts)
```

To'liq stack (Docker):
```bash
docker compose up -d postgres redis backend frontend
# frontend: http://localhost:3000
```

## map.jpg
Xarita foni — `frontend/public/map.jpg` ga qo'ying (eski loyihadan). Bo'lmasa
xarita foni bo'sh ko'rinadi, lekin polygonlar baribir render bo'ladi.

## Eslatma
- Barcha summalar/ranglar/koordinatalar DB'dan keladi — hech narsa hardcoded emas.
- "Real hisobla" live rejimda rent real, qolgan xizmatlar 0 (ular settings'da).

## Keyingi qadam (5-bosqich)
Admin panel funksional qismi: dashboard summalarini tahrirlash (har biri alohida),
magazin↔pavilion bog'lash (xarita muharriri), Excel import, audit log; va
Yerto'la (Google Sheets) integratsiyasi.
