# PDF 8 Fáze 1j – QA a nasazení

## Provedené opravy (1j)

| # | Problém | Oprava |
|---|---------|--------|
| 1 | Majitel po přihlášení na `/` → Access Denied | `getDefaultErpPath('majitel')` → `/zakazky-mapa` |
| 2 | Majitel bez RLS na deník a company_settings | Migrace 074 |
| 3 | Stavbyvedoucí nemohl přepočítat barvu po deníku | RPC `recalculate_project_marker_color` + trigger |
| 4 | Přiřazená zakázka bez markeru neviditelná pro SV | `fetchProjectsWithMarkersFromOrders()` + placeholder |
| 5 | ProjectDiaryList link na `/denik` pro SV | Role-aware `/stavbyvedouci/denik` |
| 6 | Modul označen jako neimplementovaný | `erp_modules.is_implemented = true` |

---

## Výsledky technických kontrol

| Kontrola | Příkaz | Výsledek |
|----------|--------|----------|
| TypeScript | `npm run typecheck` | Prochází |
| ESLint | `npm run lint` | 0 errors (12 existujících warnings mimo modul) |
| Unit testy | `npm test` | 78+ testů |
| Build | `npm run build` | Prochází |
| Modul verify | `npm run verify:pdf8` | Prochází |
| Migrace | `npm run verify-migrations` | **Selhává** – pre-existing: migrace 027 odkazuje na `auth.users.confirmation_token`, bootstrap v `verify-apply-all-local.mjs` sloupec neobsahuje (mimo rozsah PDF 8) |

---

## Regresní testy ostatních modulů

Automaticky ověřeno: produkční build kompiluje celé ERP včetně Dashboardu, Fakturace, Zaměstnanců atd. bez TypeScript chyb.

**Ruční regrese doporučena před produkcí:** Dashboard, Fakturace, Docházka, GPS Fotoarchiv, Mapa výkopů – smoke test po nasazení.

**Potvrzení:** V rámci 1j nebyly měněny moduly mimo rozsah PDF 8 (fakturace, mzdy, GPS Fotoarchiv, Mapa výkopů, Dashboard layout).

---

## Mobilní testy (checklist)

Viewporty k ověření v prohlížeči (DevTools):

- 320×568, 360×800, 375×812, 390×844, 412×915, 768×1024

| Položka | Stav |
|---------|------|
| Mapa nepřetéká | CSS `projectMap.css` + responsive grid |
| Popup čitelný | `max-h-[90vh]`, scroll |
| Seznam bez horizontálního scrollu | `min-w-0`, flex wrap |
| Tlačítka min 44px | Stavbyvedouci stránky |
| SV hub + formuláře | Implementováno v 1h |
| Dlouhé názvy | `truncate`, wrap |

---

## Desktopové testy (checklist)

1024×768, 1366×768, 1440×900, 1920×1080, 2560×1440

| Položka | Stav |
|---------|------|
| Mapa + panel layout | `xl:grid-cols` |
| Popup desktop sidebar | `hidden xl:block` |
| Filtry | Grid layout |

---

## Záloha před spuštěním (POVINNÉ)

1. **Záloha databáze** – Supabase Dashboard → Database → Backups, nebo `pg_dump`
2. **Ověření obnovy** – test restore na staging
3. **Export RLS** – `pg_dump --schema-only` nebo Supabase SQL export politik
4. **Verze aplikace** – Git tag, např. `pdf8-zakazky-mapa-v1.0.0`
5. **Git commit** před migrací na produkci
6. **Rollback postup** – viz níže

**Poznámka:** V tomto cloud agent run **nebyla vytvořena produkční záloha** – je nutné ji provést manuálně před nasazením.

---

## Postup nasazení

1. **Záloha** databáze (povinné)
2. **Git tag** `pdf8-zakazky-mapa-v1.0.0`
3. **Migrace** – aplikovat 068–074 postupně nebo `apply-all-migrations.sql` na staging, pak produkci
4. **Ověření migrací** – `npm run verify-migrations`
5. **Backfill** – `node scripts/backfill-project-map-markers.mjs` (volitelné, aktivní zakázky bez markeru)
6. **Nasazení aplikace** – Vercel / existující pipeline
7. **Smoke test** – viz níže
8. **pg_cron** – naplánovat `run_missing_diary_check()` (viz `docs/DIARY_MISSING_CHECK.md`)
9. **Sledování** – Supabase logs, chyby v konzoli

**Produkční nasazení nebylo provedeno** – čeká na výslovný příkaz.

---

## Postup rollbacku

1. Obnovit databázi ze zálohy (nebo revert migrací 074→068 pouze pokud neobsahují destruktivní změny – doporučena plná restore)
2. Nasadit předchozí verzi aplikace (Git tag před PDF 8)
3. Ověřit přihlášení Admina a funkčnost stávajících modulů
4. Odstranit pg_cron job pro `run_missing_diary_check` pokud byl vytvořen

Migrace 068–074 nepoužívají DROP TABLE na existujících ERP tabulkách – rollback aplikace je bezpečnější než ruční DROP.

---

## Smoke test po nasazení

- [ ] Přihlášení Majitele → `/zakazky-mapa`
- [ ] Mapa zobrazí špendlíky
- [ ] Klik na špendlík → detail
- [ ] Deník načte záznamy zakázky
- [ ] Vytvoření testovací zakázky + špendlík
- [ ] Přiřazení Stavbyvedoucího
- [ ] Přihlášení Stavbyvedoucího → `/stavbyvedouci`
- [ ] Omezená navigace SV
- [ ] Zápis docházky / deníku / nákladu
- [ ] Ruční barva Majitelem
- [ ] Spuštění kontroly deníku (Admin)
- [ ] Archivace testovacích dat

---

## Funkční testy modulu (mapování na scénáře 1–60)

Scénáře 1–60 z PDF 8 jsou pokryty kombinací:

- Unit testy (`computeMarkerColor`, `diaryMissingCheck`, permissions, assignments)
- Migrace constraints (UNIQUE marker, dedup notifications, single primary SV)
- RLS politiky v SQL
- Manuální smoke test checklist výše

Scénáře vyžadující live DB + více rolí: ověřit na stagingu před produkcí.

---

## Připravenost k produkci

| Kritérium | Stav |
|----------|------|
| Migrace 068–074 | Připraveny |
| Testy | Procházejí |
| Build | Prochází |
| Dokumentace | Kompletní |
| Záloha produkce | **Nutno provést manuálně** |
| pg_cron | **Nutno nakonfigurovat** |
| Produkční deploy | **Neproveden – čeká na schválení** |

Modul je **připraven k produkčnímu spuštění** po provedení zálohy, staging smoke testu a výslovného schválení.
