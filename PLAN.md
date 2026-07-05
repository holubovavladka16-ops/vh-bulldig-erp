# Plán projektu – VH Bulldig ERP

## 1. Přehled

Profesionální webová ERP aplikace pro **VH Bulldig s.r.o.** – stavební/dělnická firma.
Technologie: **React 19 + TypeScript + Vite 6 + Tailwind CSS 4 + Supabase**.

---

## 2. Architektura

```
vh-bulldig-erp/
├── src/
│   ├── components/          # Sdílené UI komponenty
│   │   ├── layout/          # AppLayout, Sidebar, Header
│   │   ├── auth/            # ProtectedRoute
│   │   └── ui/              # Button, Card, Input, Badge…
│   ├── pages/               # Stránky podle modulů
│   │   ├── auth/            # LoginPage
│   │   ├── dashboard/       # DashboardPage
│   │   └── modules/         # Placeholder moduly
│   ├── context/             # AuthContext (globální stav)
│   ├── hooks/               # useAuth, usePermissions
│   ├── lib/                 # supabase klient
│   ├── types/               # TypeScript definice
│   ├── constants/           # Navigace, role, oprávnění
│   ├── routes/              # Konfigurace rout
│   └── styles/              # Globální CSS
├── supabase/
│   └── migrations/          # SQL migrace
└── public/
```

---

## 3. Uživatelské role a oprávnění

| Role          | Popis                          | Přístup                          |
|---------------|--------------------------------|----------------------------------|
| Administrátor | Plný přístup ke všem modulům   | Vše                             |
| Vedoucí       | Správa týmů, projektů, reportů | Většina modulů (bez nastavení) |
| Dělník        | Základní operace               | Docházka, Dokumenty, Projekty (read) |

Oprávnění jsou definována v `constants/permissions.ts` a kontrolována na frontendu i v Supabase RLS.

---

## 4. Databázové schéma (Supabase)

### Tabulky

- **profiles** – rozšíření auth.users (jméno, role, avatar, aktivní)
- **employees** – zaměstnanci (propojení s profilem)
- **projects** – stavební projekty
- **orders** – zakázky
- **attendance** – docházka
- **invoices** – fakturace
- **payroll** – mzdy
- **warehouses** / **warehouse_items** – sklady
- **documents** – dokumenty
- **vehicles** – vozový park
- **reports** – uložené reporty

### Bezpečnost

- Row Level Security (RLS) na všech tabulkách
- Trigger pro automatické vytvoření profilu po registraci
- Enum `user_role`: `administrator`, `vedouci`, `delnik`

---

## 5. Moduly (připravené routy)

| Modul        | Cesta            | Stav        |
|--------------|------------------|-------------|
| Dashboard    | `/`              | ✅ Hotovo   |
| Docházka     | `/dochazka`      | 🔲 Placeholder |
| Zaměstnanci  | `/zamestnanci`   | 🔲 Placeholder |
| Projekty     | `/projekty`      | 🔲 Placeholder |
| Zakázky      | `/zakazky`       | 🔲 Placeholder |
| Fakturace    | `/fakturace`     | 🔲 Placeholder |
| Mzdy         | `/mzdy`          | 🔲 Placeholder |
| Sklady       | `/sklady`        | 🔲 Placeholder |
| Dokumenty    | `/dokumenty`     | 🔲 Placeholder |
| Vozový park  | `/vozovy-park`   | 🔲 Placeholder |
| Reporty      | `/reporty`       | 🔲 Placeholder |

---

## 6. UI/UX design

- **Barevné schéma**: Tmavě modrá (#1e3a5f) + amber/oranžová (#f59e0b) – stavební/industriální
- **Layout**: Fixní levé sidebar menu + horní header + obsah
- **Responzivita**: Sidebar se skrývá na mobilu (hamburger menu)
- **Login**: Fullscreen split layout s brandingem firmy
- **Dashboard**: KPI karty, rychlé akce, přehled modulů

---

## 7. Kroky implementace

1. ✅ Scaffold projektu (Vite + React + TS)
2. ✅ Tailwind CSS konfigurace
3. ✅ Supabase migrace a typy
4. ✅ Auth systém (login, session, role)
5. ✅ Layout (Sidebar + Header)
6. ✅ Dashboard administrátora
7. ✅ Placeholder stránky pro moduly
8. ✅ Dokumentace a .env.example

---

## 8. Spuštění

```bash
cd vh-bulldig-erp
npm install
cp .env.example .env   # vyplnit Supabase URL a anon key
npm run dev
```

Supabase migrace spustit v Supabase Dashboard → SQL Editor.
