# Plán projektu – VH Bulldig ERP

> Tento dokument nahrazuje původní verzi, která popisovala pouze počáteční scaffold projektu
> (obecné tabulky `employees`/`projects`/`orders`/…). Aplikace od té doby prošla 15 skutečnými
> moduly a 46 SQL migracemi – tento soubor nyní odpovídá reálné architektuře (stav: červenec 2026).

## 1. Přehled

Neveřejné ERP pro **VH Bulldig s.r.o.** – stavební/výkopová firma. Používají ho pouze administrátoři;
dělníci pracují přes samostatný, tokenový **Zaměstnanecký portál** (`/portal/:token`), ne přes ERP samotné.

Technologie: **React 19 + TypeScript 5.7 (strict) + Vite 6 + Tailwind CSS 4 + react-router-dom 7 +
Supabase JS 2 + Leaflet**. Nasazení: Vercel nebo Netlify (oba konfigurační soubory jsou v repozitáři).

---

## 2. Architektura adresářů

```
vh-bulldig-erp/
├── src/
│   ├── components/          # Sdílené i modulové komponenty (auth/, workers/, attendance/, photos/, diary/…)
│   ├── pages/                # Stránky podle modulů (viz tabulka níže)
│   ├── context/              # AuthContext, CompanySettingsContext
│   ├── lib/                  # Supabase klient + API vrstva podle modulu (workers/, attendance/, orders/…)
│   ├── types/                # TypeScript definice (database.ts, workers.ts, …)
│   ├── constants/            # Navigace, role, oprávnění, štítky
│   └── routes/               # AppRoutes.tsx
├── supabase/
│   ├── migrations/           # 46 SQL migrací (001–042 + duplicitní čísla 026–029, viz §5)
│   ├── functions/            # Edge funkce (diary-ai-polish, notify-login)
│   └── apply-all-migrations.sql  # Generovaný konsolidovaný soubor (npm run build-apply-all-sql)
├── api/                       # Vercel serverless funkce (ai-polish-text.js)
└── scripts/                   # Nástroje pro nasazení migrací a ověřování (viz §6)
```

---

## 3. Uživatelské role a oprávnění

| Role | Popis | Přístup do ERP |
|---|---|---|
| Administrator | Plný přístup ke všem modulům | Vše |
| Vedoucí, Dělník | Existují jako role v databázi | Nemají přístup do ERP frontendu (viz `constants/permissions.ts`) – pracují přes Zaměstnanecký portál |

Oprávnění se vynucují na dvou úrovních: frontend (`constants/permissions.ts`, `ProtectedRoute`) a
databáze (`SECURITY DEFINER` funkce s kontrolou `get_user_role() = 'administrator'`, RLS na všech tabulkách).

---

## 4. Moduly a jejich datové zázemí

| Modul | Cesta | Hlavní tabulky |
|---|---|---|
| Dashboard | `/` | agreguje ostatní moduly |
| Dělníci | `/delnici` | `workers`, `worker_price_items`, `worker_documents`, `worker_history` |
| Docházka | `/dochazka` | `worker_attendance_records` |
| Denní formuláře | `/denni-formulare` | `worker_daily_forms`, `worker_form_task_items`, `worker_form_photos` |
| Zakázky | `/zakazky` | `job_orders`, `job_order_photos/documents/invoices` |
| Výkazy | `/vykazy` | `worker_reports` |
| Výplatní pásky | `/vyplatni-pasky` | odvozeno z docházky + ceníku |
| Stavební deník | `/denik` | `construction_diary_entries` |
| Náklady (Ekonomika) | `/ekonomika` | `job_costs`, `job_cost_photos/documents` |
| Paragony | `/paragony` | `receipts` |
| Přípojky | `/pripojky` | `utility_connections` |
| Fotodokumentace GPS | `/fotky`, `/fotky-na-mape` | `gps_photos`, `gps_photo_history` |
| Mapa výkopů | `/mapa-vykopu` | `excavation_routes`, `construction_points*` |
| Dokumenty (smlouvy) | `/dokumenty` | generováno klientsky (šablony, číslování) |
| Statistiky (Profit overview) | `/statistiky` | odvozeno ze zakázek/nákladů |
| Zaměstnanecký portál | `/portal/:token` | čte výhradně přes tokenové RPC funkce (`portal_get_*`) |

---

## 5. Databázové migrace – důležité poznámky

- **46 migrací** (001–042). Čtyři čísla existují dvakrát se zcela odlišným obsahem
  (`026`, `027`, `028`, `029`) – pořadí spouštění je deterministické (abecední řazení souborů),
  ale kolize čísel je zdroj rizika pro budoucí migrace a měla by být při další příležitosti přečíslována.
- **`supabase/apply-all-migrations.sql`** je generovaný soubor – **vždy** ho po přidání nové migrace
  přegenerovat příkazem `npm run build-apply-all-sql`, jinak bude bootstrap nové Supabase instance
  neúplný (stalo se to mezi migracemi 032 a 041, opraveno v rámci opravné fáze 1).
- Několik tabulek z původního scaffoldu (`employees`, `projects`, `orders`, `attendance`, `invoices`,
  `payroll`, `warehouses`, `warehouse_items`, `documents`, `vehicles`, `reports` – migrace 001) je
  nahrazeno novějšími moduly a v kódu se již nepoužívá. Ponechány beze změny, dokud nebude potvrzeno,
  že je lze bezpečně odstranit z produkční databáze.

---

## 6. Nástroje pro nasazení migrací (`scripts/`)

Existují čtyři alternativní cesty pro aplikaci migrací – nejsou to duplicity, ale platné cesty pro
různá prostředí/oprávnění:

| Skript | Kdy použít |
|---|---|
| `apply-migrations.mjs` | Supabase CLI je nainstalované a přihlášené |
| `apply-migrations-pg.mjs` | Přímé PostgreSQL připojení (`SUPABASE_DB_PASSWORD`) |
| `apply-migrations-dashboard.mjs` | Supabase Management API (`SUPABASE_ACCESS_TOKEN`), bez hesla k DB |
| `run-apply-all-migrations.mjs` | Spustí předgenerovaný `apply-all-migrations.sql` napřímo |

---

## 7. Spuštění

```bash
npm install
cp .env.example .env.local   # vyplnit Supabase URL a anon key
npm run dev
```

Migrace aplikovat jedním ze skriptů v §6, nebo ručně vložením `supabase/apply-all-migrations.sql`
do Supabase Dashboard → SQL Editor (po předchozím spuštění `npm run build-apply-all-sql`).
