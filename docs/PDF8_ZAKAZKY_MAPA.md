# PDF 8 – Modul Zakázky a mapa (ERP 8)

## Účel modulu

Modul **Zakázky a mapa** (`/zakazky-mapa`) poskytuje mapový přehled stavebních zakázek s barevnými špendlíky podle stavu deníku a termínů, propojením se stavebním deníkem, rolí Stavbyvedoucího a automatickými upozorněními na chybějící denní zápis.

Identifikátor projektu v celém modulu:

```text
project_id = job_orders.id
```

Neexistuje samostatná tabulka `projects`.

---

## Databázové tabulky

| Tabulka | Účel |
|---------|------|
| `project_map_markers` | Hlavní špendlík zakázky (1:1, UNIQUE `project_id`) |
| `project_user_assignments` | Přiřazení Stavbyvedoucích k zakázce |
| `project_notifications` | Upozornění (typ `missing_diary`) |
| `project_marker_status_history` | Auditní historie změn barvy |
| `project_status_overrides` | Schéma pro budoucí date-ranged override (nepoužito v UI) |
| `job_orders` | Zakázky (existující tabulka ERP) |
| `construction_diary_entries` | Stavební deník (+ sloupec `entry_status`) |
| `company_settings` | `diary_check_time`, `working_days`, `timezone` |

### Klíčové sloupce `project_map_markers`

- `project_id` → `job_orders.id`
- `gps_lat`, `gps_lng`, `gps_accuracy`, `is_approximate`
- `marker_color`: `green` | `red` | `orange` | `blue`
- `color_source`: `auto` | `manual`
- `color_label`: textový popis stavu

---

## Migrace (068–074)

| Soubor | Fáze | Obsah |
|--------|------|-------|
| `068_pdf8_project_map_module.sql` | 1a–1g základ | Tabulky, RLS, role `stavbyvedouci` |
| `069_pdf8_marker_optional_gps.sql` | 1b | Nullable GPS |
| `070_pdf8_manual_marker_color_majitel.sql` | 1f | Role `majitel`, ruční barva |
| `071_pdf8_stavbyvedouci_assignments_rls.sql` | 1g | Přiřazení, audit, scoped reads |
| `072_pdf8_stavbyvedouci_workers_rpc.sql` | 1h | RPC pracovníci |
| `073_pdf8_diary_missing_notifications.sql` | 1i | Upozornění, cron RPC |
| `074_pdf8_phase_1j_finalize.sql` | 1j | Majitel RLS, RPC přepočet, modul hotový |

---

## Role a oprávnění

| Role | Přístup |
|------|---------|
| **Administrátor** | Plný přístup, dashboard, všechny zakázky |
| **Majitel** | Všechny zakázky, mapa, deník, ruční barva, přiřazení SV; výchozí route `/zakazky-mapa` |
| **Stavbyvedoucí** | Pouze přidělené zakázky; route `/stavbyvedouci`; bez mezd/ceníků |
| **Účetní** | Bez ERP přístupu (enum existuje pro budoucí použití) |

### Routy modulu

| Route | Role |
|-------|------|
| `/zakazky-mapa` | Admin, Majitel, Stavbyvedoucí (RLS filtr) |
| `/zakazky/:id` | Admin, Majitel, Stavbyvedoucí (jen přidělené) |
| `/stavbyvedouci/*` | Pouze Stavbyvedoucí |
| `/denik` | Admin, Majitel |
| `/stavbyvedouci/denik` | Stavbyvedoucí |

---

## Barevné stavy (automatické)

Priorita: **červená > oranžová > zelená > modrá**

| Barva | Auto label | Podmínka |
|-------|------------|----------|
| Modrá | Čeká na zahájení | Před `start_date` |
| Zelená | Probíhá v pořádku | Platný deník pro aktuální pracovní den |
| Oranžová | Vyžaduje kontrolu | Blížící se termín, chybějící včerejší zápis |
| Červená | Chybí stavební deník | Po `diary_check_time` bez platného deníku |
| Červená | Vyžaduje zásah | Po `end_date` nebo 3+ chybějící pracovní dny |

Ruční override (`color_source = manual`): pouze Admin/Majitel. Barvy červená/oranžová/modrá pozastaví automatickou kontrolu deníku.

---

## Platný denní zápis

`entry_status` ∈ `approved`, `submitted`, `pending_review`

Neplatí: `draft`, `returned`, `rejected`

---

## Automatické úlohy

### Kontrola chybějícího deníku

RPC: `run_missing_diary_check()`

- Používá `company_settings.diary_check_time`, `working_days`, `timezone`
- Vytváří upozornění pro Admin, Majitele a primárního Stavbyvedoucího
- Nastavuje červený špendlík „Chybí stavební deník“
- Idempotentní (unikátní index)

Naplánování: viz `docs/DIARY_MISSING_CHECK.md`

### Přepočet barvy

RPC: `recalculate_project_marker_color(project_id)`

Volá se po uložení platného deníku (trigger) a z frontendu.

---

## RLS – přehled

- **Admin**: ALL na modulové tabulky
- **Majitel**: ALL markers/assignments/notifications; SELECT diary, company_settings (074)
- **Stavbyvedoucí**: SELECT/INSERT/UPDATE scoped přes `is_assigned_to_project(project_id)`
- **Nepřihlášený**: žádný přístup (RLS + auth)

Detailní politiky: migrace 068–074.

---

## Frontend – klíčové soubory

```
src/pages/zakazkyMapa/
src/pages/stavbyvedouci/
src/lib/zakazkyMapa/
src/components/zakazkyMapa/
src/constants/stavbyvedouciNavigation.ts
src/constants/projectNotifications.ts
```

---

## Ověření

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run verify:pdf8
npm run verify-migrations
```

---

## Známá omezení

- `project_status_overrides` – tabulka existuje, UI nepoužívá (ruční stav přes `project_map_markers.color_source`)
- Role `ucetni` – bez ERP přístupu
- Klient-side přepočet barvy používá firemní timezone z DB; plná shoda se serverem přes RPC `recalculate_project_marker_color`
- pg_cron musí být nakonfigurován manuálně v produkci

---

## Verze modulu

`erp_modules.zakazky-mapa`: `is_implemented = true`, `module_version = 1.0.0` (migrace 074)
