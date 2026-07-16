# Changelog – Repair Session (2026-07-08 / 2026-07-09)

Your original, completely unmodified upload is still safely on disk (nothing was ever changed in
place) — this changelog documents every change applied to produce `vh-bulldig-erp-repaired.zip`.

## Phase 1 — Authentication, database connections, migrations, module loading

- **Reviewed and confirmed sound, no changes made:** `AuthContext.tsx`, `ProtectedRoute.tsx`,
  `lib/supabase.ts` client setup. No login/session bug was found in the code.
- **Fixed (real bug):** `admin_upsert_attendance` had silently lost the ability to record
  non-"present" attendance (vacation/sick/on-call/unpaid leave) when the function was rebuilt across
  migrations 028→035. Added `supabase/migrations/042_restore_admin_attendance_status.sql`, plus:
  - `src/types/workers.ts` — added `attendance_status` back to `AttendanceUpsertInput`
  - `src/lib/attendance/api.ts` — passes the new `p_status` parameter
  - `src/components/attendance/AttendanceFormModal.tsx` — added the status selector back to the form
- **Fixed (real bug):** `supabase/apply-all-migrations.sql` was 9 migrations out of date (stopped at
  032 of 45). Regenerated via `npm run build-apply-all-sql`; now contains all 46 migrations.
- **Verified, no changes needed:** RLS is enabled on every table (46/46); every RPC called from the
  frontend has a matching `GRANT EXECUTE`; every heavily-redefined function (`submit_worker_daily_form`,
  `portal_save_form`, `get_report_detail`, `approve_daily_report`, `get_job_order_detail`,
  `get_profit_overview`, etc.) was checked against its latest migration definition — all match the
  frontend call sites exactly, with the one exception fixed above.

## Phase 2 — PDF exports, watermark, Czech fonts

- **Verified, no changes needed.** `printDocument.ts` already implements A4-formatted print/PDF
  output with Noto Sans (Czech diacritics) and a full watermark system (migration 038,
  `CompanySettingsContext`, upload UI in `CompanySettingsPage.tsx`). Used consistently by 10 modules.
  No bug found; nothing changed.

## Phase 3 — Employee forms, attendance, reports, project reports

- **Verified, no changes needed** beyond the attendance-status fix in Phase 1. Checked every
  RPC call (`admin_save_form`, `portal_submit_form`, `portal_get_forms`, `get_report_detail`,
  `delete_daily_report`, `approve_daily_report`, `return_daily_report`, `get_job_order_detail`,
  `get_profit_overview`) against its migration definition — all consistent.

## Phase 4 — Google Drive, WhatsApp/Messenger/email, GPS photos & maps

- **Google Drive integration does not exist anywhere in this codebase**, past or present — flagged
  for your decision (new feature vs. was this meant to be something else?). Nothing removed or added.
- **Fixed (real, confirmed bug):** "Messenger" sharing used Facebook's `/dialog/send` with
  `app_id=0`, which is not a valid app ID — the button has never actually worked in any of its 4
  copies (payroll, diary, photos ×2, worker form-link). Replaced with a shared, working
  implementation using the Web Share API with a clipboard-copy fallback (the same pattern this
  codebase's own author already used for the separate "Sdílet" button in `PhotoDocumentView.tsx`):
  - New file: `src/lib/share/webShare.ts`
  - Removed the broken `getMessengerShareUrl`/`getFormLinkMessengerUrl` builders from:
    `src/lib/payroll/share.ts`, `src/lib/diary/share.ts`, `src/lib/photos/share.ts`,
    `src/lib/workers/formLinkShare.ts`
  - Updated call sites: `src/components/payroll/PayrollSlipDetailModal.tsx`,
    `src/components/diary/DiaryExportPanel.tsx`, `src/components/photos/PhotoShareButtons.tsx`,
    `src/components/photos/PhotoDocumentView.tsx`, `src/components/workers/tabs/FormLinkTab.tsx`
- **Verified, no changes needed:** WhatsApp and email sharing (`wa.me`, `mailto:` links) work
  correctly everywhere they're used. GPS photo storage policies (upload/read/update/delete across
  6 buckets) are complete and idempotent. Map link generators (Mapy.cz, Google Maps, Street View,
  OpenStreetMap, static map for print) are all correctly formed.
- **Fixed (real gap, lower severity):** the Supabase Edge Function fallback for the AI text-polish
  feature (`diary-ai-polish`) only supported the diary prompt and only accepted a logged-in session,
  while the primary Vercel function (`api/ai-polish-text.js`) supports both `diary` and `daily_form`
  contexts plus portal-token auth. During a Vercel outage, this meant admins polishing a daily-form
  entry got the wrong prompt, and portal (worker) users had no fallback at all. Fixed:
  - `supabase/functions/diary-ai-polish/index.ts` — added the `daily_form` prompt (matching the
    Vercel function's wording exactly) and portal-token authentication via `portal_get_worker`
  - `supabase/config.toml` — set `verify_jwt = false` for this function (required so portal-token
    requests, which aren't user JWTs, can reach the function's own auth check — mirrors the Vercel
    function's security model, which also does its own check rather than relying on a platform gate)
  - `src/lib/ai/geminiPolish.ts` — now sends `context` and (when applicable) the portal token to the
    fallback, and allows portal users to use the fallback too

## Phase 5 — Cleanup, documentation, production readiness

- **Refreshed `PLAN.md`**, which still described the week-1 scaffold (generic `employees`/`projects`/
  `orders` tables, 11 placeholder modules) — replaced with an accurate map of the real 15-module
  architecture, the migration-numbering caveat, and the dead-table note (see below).
- **Reviewed and intentionally left unchanged:** the four migration-apply scripts in `scripts/`
  (`apply-migrations.mjs`, `apply-migrations-pg.mjs`, `apply-migrations-dashboard.mjs`,
  `run-apply-all-migrations.mjs`). These looked like duplicated tooling at first glance, but they're
  legitimate alternate paths for different deployment setups (Supabase CLI / direct Postgres /
  Management API / consolidated SQL file) — not broken duplication. Left alone.

## Deliberately NOT done — needs your decision first

These two items from the original architecture report are still open. Both are safe to leave
exactly as they are (they cause no bugs), and both involve your live database, so I didn't want to
act on them without confirmation:

1. **Four duplicate migration numbers** (026, 027, 028, 029 each exist twice with unrelated content).
   Execution order happens to be correct today by coincidence of alphabetical sorting. Renumbering
   is straightforward for a fresh database, but needs a different, careful approach if your Supabase
   project already has some of these applied — tell me whether this project is already live with
   real data, and I'll handle it appropriately.
2. **11 dead legacy tables** from the original scaffold (`employees`, `projects`, `orders`,
   `attendance`, `invoices`, `payroll`, `warehouses`, `warehouse_items`, `documents`, `vehicles`,
   `reports`) — confirmed unused anywhere in the current frontend. Safe to drop, but only once you
   confirm nothing external (manual SQL, BI tooling, another integration) depends on them.

## Phase 6 — Worker portal link must never be localhost

- **Fixed (real, confirmed bug):** `getPortalUrl()` (and 3 related links) built URLs from
  `window.location.origin`. When run from `npm run dev`, that's `http://localhost:5173` — so any
  portal link generated and sent to a worker's phone was unusable outside the admin's own machine.
  - Added `getPublicAppUrl()` in `src/lib/env.ts` — reads `VITE_PUBLIC_APP_URL`, falls back to
    `window.location.origin` only for local-dev convenience, and warns in the browser console if
    it's missing in a production build.
  - `src/constants/workers.ts` → `getPortalUrl()` now builds `${getPublicAppUrl()}/portal/{token}`
    — this is the single source used by every share channel (form-link tab, WhatsApp, Messenger,
    email, copy), so the fix applies everywhere at once.
  - Same fix applied to the other two links that get sent outside the browser:
    `src/components/settings/AdminInviteModal.tsx` and `src/pages/settings/PermissionsSettingsPage.tsx`
    (admin invite login link), and `src/context/AuthContext.tsx` (password-reset redirect link).
  - Added `VITE_PUBLIC_APP_URL` to `.env.example`, `.env.production.example`, and `.env.production`
    (as a placeholder to fill in once the Vercel domain is known).
- **Verified, no changes needed:**
  - `vercel.json` and `netlify.toml` already have correct SPA catch-all rewrites, so opening
    `/portal/{token}` directly on a phone (not navigating from within the app) already works —
    it won't 404.
  - The employee portal (`EmployeePortalPage.tsx` → `PortalLayout`) uses a single-column,
    `max-w-lg`, `min-h-dvh` fluid layout — this is a correct mobile-first design that already scales
    cleanly to tablet and desktop without needing separate breakpoints.
  - The token stays in the URL path (`/portal/:token`) and is validated with `isValidPortalToken`
    before any data loads — unchanged.
  - End-to-end code path re-checked: worker creation → `getPortalUrl(token)` → `portal_save_form` /
    `portal_submit_form` (params match migration 041 exactly, confirmed in Phase 3) →
    `sync_form_downstream` → `worker_attendance_records` / `worker_reports`. This chain was already
    verified consistent in earlier phases; nothing in this fix changes it.
- **Not done (needs a decision, not just code):** the email link is sent via a `mailto:` URL, which
  opens the *admin's own* email client with a plain-text body — `mailto:` cannot carry real HTML
  (that's a limitation of the URI scheme itself, not a bug). In practice, virtually every mail client
  (Gmail, Outlook, Apple Mail, WhatsApp, Messenger) auto-turns a plain `https://...` URL into a
  clickable link, so it does work as a real clickable link today. A literal HTML **button** reading
  "Otevřít formulář" would require sending the email server-side through a transactional email API
  (e.g. Resend, SendGrid, Postmark) instead of the client-side `mailto:` approach — that's a new
  integration needing an API key/account I don't have, not something I can add silently. Tell me if
  you want this built and which provider you'd use.

## Phase 7 — Production deployment prep (Vercel)

- `vercel.json` was already correctly configured (build command, SPA rewrites, security headers,
  asset caching) — nothing needed there.
- Exact deployment steps are in the message accompanying this changelog.

## Phase 8 — Mobile Chrome login showed "Neplatné přihlašovací údaje" with correct credentials

**Skutečná příčina:** e-mailové pole na přihlašovací stránce (`src/pages/auth/LoginPage.tsx`) nemělo
nastavené `autoCapitalize="none"`/`autoCorrect="off"`. Na některých mobilních klávesnicích (typicky
Android/Gboard v určitých konfiguracích) prohlížeč i přes `type="email"` první písmeno adresy
automaticky velké — uživatel napíše `test@bulldig.cz`, ale odešle se `Test@bulldig.cz`. Zároveň
databázová funkce `internal_create_auth_user` (migrace 017) ukládá e-mail vždy jako
`lower(trim(p_email))` — účet je v `auth.users` uložen výhradně malými písmeny. Klientský kód ale
před odesláním do Supabase e-mail pouze ořezával (`email.trim()`), nikoli převáděl na malá písmena —
takže při shodě velkých/malých písmen mohlo dojít k neshodě mezi tím, co bylo odesláno, a tím, co je
uloženo. Na notebooku (fyzická klávesnice, žádné automatické velké písmeno) k tomu nedocházelo.

Toto přesně odpovídá pozorovanému chování (funguje na PC, selže na mobilu, stejné údaje, konkrétní
chybová hláška „Neplatné přihlašovací údaje" = doslovný překlad Supabase chyby „Invalid login
credentials", což Supabase vrací právě a pouze při neshodě e-mailu/hesla — ne při chybě sítě, CORS
nebo konfigurace, takže velká část původně navržených příčin (CORS, localhost, env proměnné,
produkční doména) byla tímto vyloučena přímo z pozorovaného chování).

**Změněné soubory:**
- `src/pages/auth/LoginPage.tsx` — e-mailové pole nově má `autoCapitalize="none"`,
  `autoCorrect="off"`, `spellCheck={false}`, `inputMode="email"`, takže mobilní klávesnice už
  velké písmeno vůbec nenavrhne ani nevloží.
- `src/context/AuthContext.tsx` — `signIn()` nyní posílá e-mail jako `email.trim().toLowerCase()`
  místo jen `email.trim()` — druhá, nezávislá pojistka přímo na místě, kde e-mail jde do Supabase,
  funkční i kdyby první opatření selhalo (např. jiná klávesnice/prohlížeč) nebo kdyby uživatel velké
  písmeno napsal sám ručně.

**Co jsem NEudělal a proč:** stejný vzor (`type="email"` bez `autoCapitalize`) má i formulář prvního
nastavení administrátora (`FirstSetupForm.tsx`) a pozvánka nového uživatele
(`AdminInviteModal.tsx`). Nebyly nahlášené jako rozbité, takže jsem je záměrně nechal beze změny,
abych nerozšiřoval rozsah zásahu nad rámec nahlášeného problému — dejte vědět, pokud mám stejnou
drobnou úpravu (jen přidání atributů, žádná logika) přidat i tam pro konzistenci.



I initialize a local git repository at the start of each phase as a working backup, but accidentally
deleted it (`rm -rf .git`) while cleaning up before packaging this zip, instead of just excluding it
from the archive. The commit-by-commit history itself isn't recoverable, but every change is fully
and accurately described above, and your original upload was never touched — it's still your
unmodified pre-repair backup.

## Fáze 9 — mobilní přihlášení stále selhává i po opravě velikosti písmen v e-mailu

**Poctivě: toto NENÍ potvrzená oprava.** Oprava z minula (case-insensitive e-mail) zjevně nebyla
(jedinou) skutečnou příčinou, protože problém přetrvává. Nemám přístup k vašemu telefonu ani k reálné
síťové komunikaci, takže bych bez nových dat jen hádal znovu — a to jste výslovně odmítl. Místo toho:

**Co jsem přidal:** skutečnou diagnostiku přímo do přihlašovací obrazovky. Když teď přihlášení selže,
pod chybovou hláškou se objeví odkaz „Zobrazit technické podrobnosti", který ukáže:
- jaký e-mail byl doopravdy odeslán do Supabase (maskovaně, ale s délkou řetězce – odhalí neviditelné
  mezery/znaky),
- délku odeslaného hesla ve znacích (odhalí mezeru navíc přidanou mobilní klávesnicí/autofill),
- jakou Supabase URL adresu appka na mobilu skutečně používá (musí sedět na
  `khhalcjgvqoyskkjlkyg.supabase.co` – pokud ne, telefon běží na jiném/starém buildu),
- skutečnou doménu, na které appka na mobilu běží (`window.location.origin` – musí sedět na
  `vh-bulldig-system2.vercel.app`, ne na `-git-...` preview alias),
- surovou chybu ze Supabase (status/name/code/message) – ne přeloženou verzi.

**Změněné soubory:**
- `src/context/AuthContext.tsx` — přidány funkce `maskEmail`/`buildLoginDebugInfo`, `signIn()`
  nyní vrací i `debug` s výše popsanými údaji při neúspěchu.
- `src/pages/auth/LoginPage.tsx` — přidáno rozbalovací pole „Technické podrobnosti" pod chybovou
  hláškou.

**Nová hlavní hypotéza (silnější než minule):** protože Supabase vrací přesně „Invalid login
credentials" (ne chybu sítě/CORS/konfigurace), signál skutečně dorazil do GoTrue a byl vyhodnocen.
Nejpravděpodobnější zbývající vysvětlení jsou:
1. Mobil běží na jiném/starším Vercel nasazení (cache prohlížeče, service worker, nebo jiná
   preview URL) s jinými proměnnými prostředí zabudovanými do JS balíčku při buildu – to diagnostika
   výše odhalí okamžitě.
2. Test na notebooku ve skutečnosti neprobíhá „od nuly" – notebook může mít uloženou starou platnou
   session v localStorage a vy tedy netestujete heslo, jen otevíráte už přihlášenou appku.
3. Mobilní autofill/klávesnice vkládá do hesla neviditelnou mezeru navíc.

**Co teď potřebuji od vás** (popsáno v doprovodné zprávě) — bez tohoto nelze pokračovat fakty,
jen dalšími dohady.

## Fáze 10 — PRIORITA 1: Docházka OD–DO nesmí nikdy automaticky generovat výdělek

**Skutečná původní chyba (potvrzena na 2 nezávislých místech, backend i frontend):**

1. **Frontend** (`src/components/attendance/AttendanceFormModal.tsx`, funkce `buildTaskItems()`):
   při každém uložení docházky s vyplněným Začátkem/Koncem práce appka AUTOMATICKY přidala do
   odesílaných výkonů syntetický řádek `{ položka: "Hodinová sazba", množství: odpracované_hodiny }`
   – bez ohledu na to, co admin skutečně zapsal do Výkonů. Přesně to způsobovalo, že např. 9 hodin
   docházky (07:00–16:00) se automaticky vynásobilo hodinovou sazbou a přičetlo k výdělku.
2. **Backend** (`calculate_form_earnings`, SQL migrace 007, nezměněno až dosud): i kdyby frontend
   tohle neposílal, funkce sama o sobě obsahovala větev, která pro typ práce "hodinová"/"kombinovaná"
   vzala `worker_daily_forms.hours` (odvozeno čistě z časů OD–DO) a vynásobila ho cenou položky
   ceníku jménem přesně "Hodinová sazba". Navíc `admin_upsert_attendance` (migrace 034/035/042)
   ještě navíc explicitní položku "Hodinová sazba" ze Výkazu práce odváděla pryč do proměnné hodin
   a tu pak přepisovala docházkovými hodinami – takže i ruční zadání "4 hodiny" ve Výkonech mohlo
   být přebito reálnou docházkou (9 hodin).

**Oprava – docházka a placená práce jsou nyní zcela oddělené:**
- `hours` sloupec (`worker_daily_forms.hours`) i nadále vždy = časy OD–DO (evidence docházky),
  beze změny – reporty, statistiky, docházkové přehledy fungují stejně jako dřív.
- Výdělek se nově počítá VÝHRADNĚ součtem `worker_form_task_items` (Výkaz práce), bez výjimky,
  bez ohledu na typ práce. Žádné automatické násobení hodin docházky sazbou už neexistuje – ani
  na backendu, ani na frontendu.
- Položka "Hodinová práce" (dřív "Hodinová sazba" – přejmenováno pro srozumitelnost) se chová jako
  kterákoli jiná položka ceníku: objeví se v roletce „Druh činnosti" u tlačítka „Přidat výkon",
  a výdělek z ní = ručně zadané množství hodin × osobní sazba pracovníka. Víc výkonů za den se
  sčítá přesně jako dřív (funkčnost "Přidat výkon" beze změny).

**Odkud se načítá hodinová sazba:** z osobního ceníku konkrétního pracovníka
(`worker_price_items`, řádek "Hodinová práce", sloupec `price`) – stejně jako u všech ostatních
položek. Každý pracovník může mít jinou sazbu.

**Změněné soubory:**
- `supabase/migrations/043_fix_attendance_never_drives_earnings.sql` (nová migrace) –
  `calculate_form_earnings`, `save_form_task_items`, `admin_upsert_attendance`, `admin_save_form`
  + bezpečné přejmenování existujících položek "Hodinová sazba" → "Hodinová práce" (jen popisek,
  žádná data se neztrácí).
- `src/lib/workers/earnings.ts` – odstraněno automatické násobení hodin × sazba; "Hodinová práce"
  přestává být vyloučena z výkonů.
- `src/components/attendance/AttendanceFormModal.tsx` – odstraněno automatické přidávání
  syntetického výkonu z docházkových hodin (`buildTaskItems`), odstraněn matoucí náhled
  "(300 Kč/h → 2700 Kč)" u docházkových hodin, opraveno načítání uložených výkonů při editaci
  (dřív se položka "Hodinová práce" při editaci skryla).
- `src/constants/workers.ts` – přejmenována výchozí položka ceníku pro nové pracovníky
  "Hodinová sazba" → "Hodinová práce"; opraveny popisky typů práce, které dřív mylně tvrdily,
  že "hodinová" práce se platí automaticky.

**Návaznost na výkazy/souhrny/výplatní pásky/PDF:** ověřeno – `worker_reports.earnings`,
`get_payroll_slip_summaries` i PDF export čerpají výhradně z `worker_daily_forms.earnings`
(nastaveného přes `calculate_form_earnings`), nikde jinde se výdělek nepočítá znovu. Oprava se tedy
propaguje automaticky celým řetězcem beze změny v reportech/PDF samotných.

**Co jsem NEudělal (mimo prioritu, respektováno):** nesahal jsem na přihlášení, uvítací obrazovku,
Supabase URL/klíče, Vercel konfiguraci, focení ani PDF vodoznak.

**Testy, které jsem skutečně provedl:** statická kontrola kódu (žádný rozbitý import), ověření
přesného souladu nové SQL logiky se skutečným schématem tabulek (opravil jsem si sám jednu chybu
při psaní – první verze `save_form_task_items` počítala se sloupci, které ve skutečné tabulce
neexistují; opraveno na přesnou shodu se schématem), a manuální trasování celého datového toku
(docházka → Výkaz práce → výkaz zaměstnance → souhrn období → výplatní páska). **Neprovedl jsem**
(nemám k tomu prostředky): spuštění `npm run build`, běh appky, ani reálný test v prohlížeči/na
mobilu – to je potřeba provést na vaší straně.

## Fáze 11 — PRIORITA 1: Fotoaparát v mobilu (GPS foto modul)

**Skutečná příčina:** kamera (`getUserMedia`) se spouštěla AUTOMATICKY uvnitř React efektu hned
po přepnutí na záložku "Fotoaparát" — ne přímo synchronně z kliknutí uživatele. Mobilní prohlížeče
(zejména Safari na iPhonu, částečně i Android Chrome) toto spolehlivě nepodporují: požadavek na
oprávnění ke kameře spuštěný mimo přímý synchronní dosah kliknutí může být tiše zablokován nebo
zůstane viset bez odpovědi — tlačítko "Vyfotit" pak zůstává navždy neaktivní a živý náhled se
nikdy neobjeví, i když GPS (které tímto omezením vázané není) funguje normálně. To přesně odpovídá
nahlášenému chování (GPS/adresa fungují, kamera ne).

**Oprava:** kamera se nyní spouští výhradně přímo z `onClick` tlačítka "Spustit fotoaparát" (a
"Zkusit znovu" / "Vyfotit znovu"), nikdy automaticky.

**Změněné soubory:**
- `src/hooks/useCameraStream.ts` — přepsáno z auto-spouštěcího efektu na explicitní `start()`
  volanou z kliknutí; přidána kontrola HTTPS (`window.isSecureContext`); rozlišeny konkrétní chyby
  (zamítnuto / nedostupné / používá jiná aplikace / nezabezpečené připojení) s přesnými českými
  hláškami podle zadání; kamera se garantovaně vypne při odchodu z komponenty.
- `src/components/photos/PhotoCaptureFlow.tsx` — přidána úvodní obrazovka s tlačítkem "Spustit
  fotoaparát"; při chybě tlačítko "Zkusit znovu"; přidána nová záložní možnost "Fotoaparát
  (záložní)" s `capture="environment"` (skutečně otevře fotoaparát, ne galerii); původní tlačítko
  "Galerie" zachováno beze změny pro výběr existující fotky.

**Oprávnění ke kameře:** žádá se standardním `getUserMedia`, výhradně po kliknutí – prohlížeč sám
zobrazí systémový dialog při prvním použití.

**Zadní kamera:** `facingMode: 'environment'` (beze změny, již dříve správně nastaveno).

**Záložní řešení:** nové tlačítko `<input type="file" accept="image/*" capture="environment">` —
přesně dle zadání, odděleně od běžné Galerie.

**Ukládání fotografie, GPS, adresy, data, zakázky a autora:** beze změny — tato část (`createGpsPhoto`,
zobrazení v galerii/na mapě, sdílení PDF/WhatsApp/Messenger/e-mail) byla již funkční a nebyla nijak
upravována.

**Co jsem NEudělal (mimo prioritu):** nesahal jsem na přihlášení, uvítací obrazovku, Supabase,
Vercel konfiguraci, hodinovou práci ani formulář pro dělníka.

**Testy, které jsem skutečně provedl:** statická kontrola kódu, ověření že žádný jiný soubor
`useCameraStream` nepoužívá (jediný spotřebitel je `PhotoCaptureFlow.tsx`, plně upraven), kontrola
CSS/vrstvení kamery (žádný vizuální bug nenalezen), kontrola HTTP hlaviček a `index.html` na
Permissions-Policy blokující kameru (žádná nenalezena).

**Co vyžaduje ruční test na telefonu (nemohu ověřit sám – nemám fyzické zařízení):** skutečné
otevření zadní kamery na Android Chrome i iOS Safari, reálné pořízení a uložení fotografie,
zobrazení na mapě/v galerii, chování při zamítnutí oprávnění, a ověření že po zavření modalu
kamera skutečně zhasne (kontrolka kamery v telefonu zmizí).

**Produkční build:** neproveden (nemám `npm install`/build přístup v tomto prostředí – síť je
zde vypnutá). **Nový deploy na Vercel je nutný** po vašem úspěšném buildu.

## Fáze 12 — 3 potvrzené chyby po reálném testu na produkci

### 1) Uvítací obrazovka po přihlášení — VYTVOŘENO (nemohu potvrdit, že šlo o "regresi")
Prohledal jsem celý repozitář (od úplného začátku této zakázky) a text "vítejte", "krásný,
úspěšný a bezpečný pracovní den" ani žádná komponenta typu Welcome/Splash/Greeting se v kódu
nikde nenacházela – ani ve verzi, kterou jste mi poprvé poslal jako ZIP. Nemohu tedy potvrdit,
že šlo o regresi vzniklou při mých úpravách; nejpravděpodobnější vysvětlení je, že tato obrazovka
existovala v nějaké dřívější verzi projektu, která se do mnou analyzovaného ZIPu už nedostala.
Funkci jsem nyní implementoval nově, přesně podle zadání.

**Nové/změněné soubory:**
- `src/components/auth/WelcomeGreeting.tsx` (nový) – celoobrazovkové uvítání s logem VH Bulldig,
  přesným textem ze zadání, automatickým odchodem po ~2,5 s (nebo klik pro přeskočení).
- `src/context/AuthContext.tsx` – přidán stavový příznak `justSignedIn`, nastavuje se výhradně
  při úspěšném zavolání `signIn()` (nikdy při obnově již existující session/refresh tokenu/
  otevření appky s platným přihlášením) – takže se uvítání zobrazí jen po skutečném novém
  přihlášení, ne při každém refreshi stránky.
- `src/pages/auth/LoginPage.tsx` – po úspěšném přihlášení se místo okamžitého přesměrování
  nejprve zobrazí `WelcomeGreeting`, pak automaticky pokračuje do appky.

### 2) Fotoaparát — SKUTEČNÁ PŘÍČINA NALEZENA A OPRAVENA
Minulá oprava (přesun spouštění kamery za kliknutí) byla nutná, ale neúplná – zůstala v ní druhá,
skrytá chyba: `<video>` element se v kódu vykresloval AŽ POTÉ, co se stav kamery přepnul na
"active" (`{camera.isActive ? <video ref={...}/> : <placeholder/>}`). Jenže uvnitř `start()`
se stream přiřazoval do `videoRef.current` DŘÍVE, než se stav na "active" vůbec přepnul – tedy
v okamžiku přiřazení `<video>` element ještě vůbec neexistoval v DOM a `videoRef.current` bylo
`null`. Kamera se fakticky spustila (proto fungovalo oprávnění i GPS), ale živý obraz se nikdy
nedostal do video elementu, takže `video.readyState` zůstalo navždy 0 a `captureFrame()` proto
vždy vrátilo `null` → "Snímek se nepodařilo pořídit."

**Změněné soubory:**
- `src/components/photos/PhotoCaptureFlow.tsx` – `<video>` element se nyní vykresluje VŽDY
  (nikdy podmíněně), takže `videoRef` je platný dřív, než `start()` k němu vůbec přistoupí.
  Stavy "spouštím", "chyba + Zkusit znovu", "spustit fotoaparát" se nyní vykreslují jako
  překryvná vrstva NAD videem, ne jako jeho náhrada. Přidáno samostatné záložní tlačítko
  „Fotoaparát (záložní)" s `capture="environment"` (skutečně otevře fotoaparát telefonu),
  odděleně od původní Galerie.
- `src/styles/photoMap.css` – `.photo-camera-placeholder` nyní `position: absolute` s tmavým
  pozadím, aby se správně překrývalo přes vždy-přítomné video.
- `src/hooks/useCameraStream.ts` – beze změny oproti minulé opravě (start na kliknutí zůstává).

**Zbytek toku (uložení GPS/adresy/data/zakázky/autora, galerie, mapa, sdílení) jsem znovu
nekontroloval** – v minulém kole jsem ověřil, že je funkční a nesouvisí s tímto problémem, a
nebyl důvod to měnit.

### 3) PGRST202 (admin_upsert_attendance) — SQL PŘIPRAVENO, VYŽADUJE RUČNÍ KROK VE SUPABASE
Toto přesně souhlasí s mým vysvětlením z minula: migrace 043 s `p_status` parametrem existuje
v kódu projektu, ale **nasazení na Vercel migraci do Supabase samo nespustí** – to jsou dvě
oddělené věci (Vercel nasazuje jen frontend, SQL migrace se musí spustit ručně proti databázi).
Odtud PGRST202. Při přípravě téhle opravy jsem navíc našel a opravil DALŠÍ, závažnější chybu
ve stejné migraci: `calculate_task_line_earnings` nikdy neuměla typ jednotky "hodina" (chyběla
větev v CASE výrazu) – bez opravy by nová položka "Hodinová práce" v databázi vždy vyšla na 0 Kč,
i po opravě z minulého kola. Opraveno v téže migraci 043.

**Co musíte udělat vy v Supabase (já k vaší databázi nemám přístup):**
1. Otevřete Supabase Dashboard → SQL Editor.
2. Zkopírujte a spusťte celý obsah souboru `supabase/migrations/043_fix_attendance_never_drives_earnings.sql`
   z přiloženého ZIPu (obsahuje i opravu z minulého kola – je bezpečné ho spustit, i kdybyste
   předchozí verzi ještě nespustili).
3. Počkejte pár vteřin (soubor na konci sám pošle `NOTIFY pgrst, 'reload schema'`), pak zkuste
   uložit docházku znovu.

## Ověření provedené v tomto kole
- **Reálný TypeScript parser** (dostupný v tomto prostředí nezávisle na projektu) spuštěn nad
  všemi 8 změněnými soubory – 0 syntaktických chyb.
- Pokus o částečné `tsc --noEmit` proti `tsconfig.app.json` projektu (bez nainstalovaných
  závislostí projektu, tedy neúplné) – žádné chyby mimo očekávané "modul nenalezen" u externích
  balíčků, které v tomto prostředí nejsou nainstalované. **Toto NENÍ plnohodnotná náhrada za
  `npm run build` – nemám zde `npm install` přístup (žádná síť).**
- Ověřeno: žádný rozbitý `@/` import v celém `src/`.
- SQL migrace 043 ručně ověřena proti skutečnému schématu tabulek (opravena jedna vlastní chyba
  z minulého kola + nově nalezená chyba s `calculate_task_line_earnings`).

**`npm run build` jsem NESPUSTIL** – nemám v tomto prostředí přístup k instalaci závislostí ani
spuštění produkčního buildu. To musíte provést vy.

## Fáze 13 — KRITICKÁ REGRESE: uvítací obrazovka se v produkci vůbec nezobrazila

### Skutečná diagnostika (ne další dohad)
1. **Ověřeno, že existuje jen JEDNA přihlašovací stránka a jeden AuthContext** –
   `find src -iname "*LoginPage*" -o -iname "*AuthContext*"` vrací přesně 2 soubory, žádné
   duplicity. `AppRoutes.tsx` má přesně jednu routu `/prihlaseni` → `<LoginPage/>`. `App.tsx` má
   přesně jeden `<AuthProvider>`. Teorie "dva různé toky" se nepotvrdila.
2. **Skutečná příčina architektury:** `WelcomeGreeting` se v minulé verzi vykresloval jako
   podmíněný `return` PŘÍMO uvnitř `LoginPage` – tedy jen dokud appka zůstávala na trase
   `/prihlaseni`. To je křehké a neodpovídá zadání "samostatný overlay nad celou aplikací" –
   správně to mělo být nezávislé na tom, jaká routa/stránka je zrovna aktivní.
3. Nejpravděpodobnější důvod, proč se na telefonu nic neobjevilo: buď (a) testováno bez
   skutečného odhlášení a nového přihlášení (otevření appky s už aktivní session `justSignedIn`
   správně zůstává `false` – to je zamýšlené chování, ne bug), nebo (b) prohlížeč/Vercel
   servíroval starší cache buildu. Obojí nejde ze mě odsud ověřit – proto jsem přidal diagnostické
   logy (bod 4 zadání), aby bylo možné to příště zjistit jistě, ne odhadem.

### Oprava architektury (nezávislá na předchozí implementaci)
Uvítání se nyní vykresluje v `App.tsx` jako **přímý sourozenec `<AppRoutes/>`** (uvnitř
`AuthProvider`+`CompanySettingsProvider`, ale mimo jakoukoli konkrétní stránku) – zobrazí se tedy
doslova NAD čímkoli, co je zrovna na obrazovce, nezávisle na routování. Řídí ho jen jedna
podmínka: `justSignedIn` z `AuthContext`.

**Přesně které soubory byly změněny:**
- `src/App.tsx` – přidán `WelcomeOverlayHost` (nová komponenta v tomto souboru), vykreslen jako
  sourozenec `<AppRoutes/>`.
- `src/components/auth/WelcomeGreeting.tsx` (přepsáno) – doba běhu přesně 10 000 ms
  (`DURATION_MS = 10000`), přidány diagnostické `console.log` na mount/unmount/skip.
- `src/context/AuthContext.tsx` – přidán `console.log` přesně v místě, kde se `justSignedIn`
  nastavuje na `true` (jediné místo, kde se to děje – uvnitř úspěšné větve `signIn()`).
- `src/pages/auth/LoginPage.tsx` – zjednodušeno zpět na čisté `<Navigate to="/" replace />` po
  přihlášení; logiku uvítání už neřeší (přesunuta do App.tsx, viz výše).

### Přesně kde se overlay vykresluje
`src/App.tsx`, komponenta `WelcomeOverlayHost`, vykreslena jako sourozenec `<AppRoutes />`
uvnitř `<CompanySettingsProvider>`. Není součástí žádné konkrétní stránky/dashboardu.

### Jak je zajištěno přesně 10 sekund
`WelcomeGreeting.tsx`: konstanta `DURATION_MS = 10000`; `setTimeout` po 10 000 ms spustí odeznění
(300 ms fade), po dalších 400 ms zavolá `onDone()`. Progress bar dole má CSS `transition: width
10000ms linear` – vizuálně odpočítává přesně těch 10 vteřin.

### Jak je zajištěno, že se nezobrazí po refreshi
`justSignedIn` se nastavuje NA TRUE výhradně uvnitř `AuthContext.signIn()` – jediné volání
`setJustSignedIn(true)` v celém souboru je přímo v úspěšné větvi po zavolání
`supabase.auth.signInWithPassword`. Obnova stránky/existující session prochází JINOU cestou
(`onAuthStateChange`/`getSession()` při startu appky), která `justSignedIn` nikdy nenastavuje –
zůstává `false` (výchozí hodnota), takže overlay se při refreshi/obnově session nikdy nezobrazí.

### Diagnostické logy (dočasné, dle bodu 4 zadání)
V konzoli prohlížeče (na telefonu přes vzdálené ladění: `chrome://inspect` z PC pro Android
Chrome, nebo Web Inspector z Macu pro iPhone Safari) by se po přihlášení měly objevit v pořadí:
1. `[AUTH DIAGNOSTIKA] signIn() uspělo, justSignedIn nastaveno na true …`
2. `[AUTH DIAGNOSTIKA] App.tsx: justSignedIn=true → vykresluji WelcomeOverlayHost …`
3. `[AUTH DIAGNOSTIKA] WelcomeGreeting: komponenta se vykreslila (mount) …`
4. (po 10 s) `[AUTH DIAGNOSTIKA] WelcomeGreeting: začíná mizet …`
5. `[AUTH DIAGNOSTIKA] WelcomeGreeting: onDone() voláno, overlay se zavírá`
6. `[AUTH DIAGNOSTIKA] WelcomeGreeting: unmount (cleanup)`

Pokud se po nasazení této verze v konzoli neobjeví ANI log č. 1, problém není v React kódu vůbec –
znamená to, že prohlížeč/Vercel/CDN pořád servíruje starší JS bundle (cache). V tom případě prosím
zkuste natvrdo vymazat cache dané domény v telefonu nebo otestovat v anonymním/soukromém okně.

### Ověření provedené v tomto kole
- Potvrzeno: jen 1 `LoginPage.tsx`, 1 `AuthContext.tsx`, 1 route, 1 `AuthProvider` – žádná
  duplicita k sjednocení.
- Žádný `window.location.href`/`reload` v auth toku, který by mohl vynulovat stav před
  vykreslením.
- Reálný TypeScript parser nad všemi 4 změněnými soubory – 0 syntaktických chyb.
- Žádný rozbitý `@/` import v celém `src/`.
- **`npm run build` opět nespuštěn** – nemám v tomto prostředí přístup k instalaci závislostí.
  Toto vyžaduje vaše ověření.

## Fáze 14 — Mobilní zobrazení výběru ceníku ve formuláři pro dělníky

**Skutečná příčina:** výběr "Druh činnosti" používal obyčejný nativní HTML `<select>`. Otevřený
seznam nativního selectu vykresluje sám operační systém telefonu (na iPhonu celoobrazovkový
"wheel picker", na Androidu velký modální seznam) – jeho vzhled, výšku řádků a rozestupy nejde
CSS stylovat vůbec, na žádné platformě. Proto byly položky obrovské a seznam zabíral skoro celou
obrazovku – to nešlo opravit úpravou CSS na stávající komponentě, native select prostě nejde
takhle stylovat.

**Řešení:** nahrazen vlastní, plně CSS-stylovanou komponentou (`PriceItemPicker.tsx`) – tlačítko +
vlastní rozbalovací panel postavený v Reactu, žádný nativní systémový picker.

**Změněné soubory:**
- `src/components/workers/PriceItemPicker.tsx` (nová komponenta) – kompaktní dvouřádkový výběr:
  název položky na prvním řádku, `jednotka · cena` (např. „Kč/bm · 350 Kč") na druhém, přesně dle
  zadaného formátu. Otevřený seznam max. `45vh` výšky s vlastním scrollováním (nikdy nezabírá
  skoro celou obrazovku), zavírá se kliknutím mimo, klávesou Esc, nebo výběrem položky.
- `src/components/workers/TaskLinesEditor.tsx` – použití nahrazeno (admin formulář výkonů).
- `src/components/portal/PortalPerformanceEditor.tsx` – použití nahrazeno (formulář pro dělníky
  v Zaměstnaneckém portálu – toto je ta skutečná mobilní komponenta, kterou dělníci vyplňují).
  Respektuje existující `workerMode` – dělníkům se cena v řádcích nezobrazuje, stejně jako dřív
  v souhrnu pod výběrem.

**Jak je řešen mobilní výběr ceníku:** vlastní komponenta místo nativního `<select>` – plná
kontrola nad velikostí řádků, odsazením a typografií na všech platformách stejně.

**Jak nepřetékají dlouhé názvy:** `line-clamp-2` + `break-words` – dlouhý název se zalomí max. na
2 řádky (přesně dle požadavku "dvouřádkové zobrazení na menších displejích"), nikdy nepřeteče mimo
šířku tlačítka/řádku; `min-w-0` na flex kontejnerech zajišťuje, že text nemůže vytlačit rodiče do
šířky (klasická příčina horizontálního scrollu u flexboxu s dlouhým textem).

**Jak formulář nepřesahuje šířku telefonu:** rozbalovací panel je `absolute inset-x-0` – přesně
tak široký jako tlačítko, nikdy širší; žádný prvek v `TaskLinesEditor`/`PortalPerformanceEditor`
nemá pevnou šířku ani `white-space: nowrap`, který by mohl vynutit horizontální scroll (ověřeno
greppem – žádný nalezen).

**Horní hlavička:** zkontrolována (`PortalLayout` v `PortalDailyFormTab.tsx`) – `sticky top-0`
hlavička je normální součástí dokumentového toku (ne `position: fixed`), takže `<main>` pod ní
nikdy nepřekrývá – nebyl důvod nic měnit.

**Výpočty, databáze, ceny, ostatní moduly:** nedotčeno – `PriceItemPicker` jen zobrazuje a vybírá
`price_item_id`, veškerá logika výpočtu (`calculateTaskLineEarnings`, `calculate_form_earnings`)
zůstává beze změny.

**Ověření provedené v tomto kole:** reálný TypeScript parser nad všemi 3 soubory – 0 syntaktických
chyb; žádný rozbitý `@/` import; ověřeno, že `<Select>` (nativní) už se v žádném z obou souborů
nepoužívá, žádný zapomenutý zbytek. **`npm run build` opět nespuštěn** – nemám zde přístup k
instalaci závislostí, potřebuji vaše ověření.

## Fáze 15 — Mobilní ceník (karty místo tabulky) + oprava chybné sdílené URL

### 1) Osobní ceník na mobilu — OPRAVENO
**Příčina:** sdílená komponenta `DataTable` (používaná v desítkách tabulek po celé appce) má
záměrně `min-w-[360px]/[640px]` + `overflow-x-auto` — na mobilu se tedy nezmenšuje, ale nabízí
vodorovné posouvání s nápovědou "Posuňte tabulku do stran". Přesně to uživatel popsal (oříznuté
hodnoty, nutnost scrollovat do stran). Sdílenou komponentu jsem neměnil (ovlivnilo by to všechny
ostatní tabulky v appce, mimo zadaný rozsah) — místo toho jsem pro tyto dvě konkrétní obrazovky
přidal alternativní karetní zobrazení pro mobil.

**Změněné soubory:**
- `src/components/workers/tabs/PriceListTab.tsx` — admin pohled na ceník zaměstnance (karta
  Dělníci → detail → Ceník). Přidáno karetní rozložení (`md:hidden`), tabulka zachována pro
  desktop/tablet (`hidden md:block`). Karta: název (víceřádkový, nikdy oříznutý), jednotka a cena
  vždy celé, tlačítka nahoru/dolů/smazat a přepínač aktivní/neaktivní dole, všechny ovládací prvky
  `min-h-[44px]`.
- `src/components/portal/PortalPriceListCard.tsx` — READ-ONLY ceník, který vidí sám dělník
  v Zaměstnaneckém portálu na mobilu (pravděpodobně přesně to místo, které bylo nahlášeno).
  Stejný princip: karty na mobilu, tabulka na desktopu.

**Jak je řešen mobilní ceník:** vlastní karetní layout misto tabulky pod `md` breakpointem —
`break-words`/`leading-snug` pro víceřádkové názvy (nikdy `truncate`/ellipsis), žádné pevné šířky,
žádné `overflow-x`. Ověřeno, že žádný prvek v obou souborech nemá `min-w`/`white-space: nowrap`,
který by mohl vynutit horizontální scroll.

**Od jaké šířky funguje:** karty jsou plně tekuté (`w-full`, žádné pevné šířky) — fungují od
libovolně úzkého displeje, ne jen od 320 px.

### 2) Sdílení formuláře (Messenger/WhatsApp) — SKUTEČNÁ PŘÍČINA NALEZENA, OPRAVENO
**Přesná příčina:** ve Fázi 6 (dřívější kolo oprav) jsem do `.env.production` přidal zástupný
text `VITE_PUBLIC_APP_URL=https://REPLACE-WITH-YOUR-VERCEL-DOMAIN.vercel.app` s poznámkou "doplňte
po nasazení" — ale funkce `getPublicAppUrl()` v `src/lib/env.ts`, která tuhle hodnotu čte, tenhle
konkrétní zástupný text nerozpoznávala jako neplatný (seznam `EXAMPLE_MARKERS` obsahoval jen
`vas-projekt`/`your-project` apod., ne tenhle konkrétní řetězec). Appka tedy zástupný text vzala
jako skutečnou doménu a přesně to poslala do sdílených odkazů → 404 DEPLOYMENT_NOT_FOUND. Toto je
MOJE vlastní chyba z dřívějšího kola, ne něco, co bylo v projektu předtím.

**Oprava (`src/lib/env.ts`):** `getPublicAppUrl()` nyní ověřuje, že hodnota vypadá jako
skutečná adresa (musí začínat `https://`, nesmí obsahovat `replace-with`, `your-...`,
`placeholder`, `localhost` apod.) — pokud test neprojde, **vždy** (i v produkci) padá zpět na
`window.location.origin`, přesně jak jste navrhoval jako lepší řešení. To znamená: i kdyby v
budoucnu někdo znovu zapomněl vyplnit `VITE_PUBLIC_APP_URL` nebo tam nechal zástupný text, appka
se sama opraví použitím skutečné aktuální domény prohlížeče – tahle třída chyby už nemůže nastat
znovu.

**`.env.production`** — opraveno na `VITE_PUBLIC_APP_URL=https://vh-bulldig-erp.vercel.app`
(přesně dle vašeho zadání). **`.env.production.example`** — aktualizován komentář, aby bylo jasné,
že jde o volitelnou hodnotu s bezpečným fallbackem.

**Jak se nyní vytváří sdílená URL:** `getPublicAppUrl()` → `.env.production`
(`VITE_PUBLIC_APP_URL`, pokud vypadá věrohodně) **nebo automaticky `window.location.origin`**
(bezpečný výchozí stav) → `getPortalUrl(token)` = `${základ}/portal/${token}`.

**Výsledná cesta sdíleného formuláře:** `https://vh-bulldig-erp.vercel.app/portal/<portal_token>`
— existující, funkční, needěná routa (`AppRoutes.tsx`, řádek s `/portal/:token`), **ověřeno, že
NENÍ obalená v `<ProtectedRoute>`** — tedy funguje v anonymním okně bez přihlášení administrátora,
přesně jak požadováno.

**Ověřeno, že výsledek už neobsahuje `replace-with-your-vercel-domain`:** ano — hodnota v
`.env.production` je nyní skutečná doména, a i kdyby nebyla, kód ji aktivně odmítne a použije
`window.location.origin` místo ní. Prohledal jsem celý projekt (`grep -rn` přes celé `src/`,
`.env*`) — jediný výskyt zástupného textu byl přesně ten jeden řádek v `.env.production`, nyní
opravený.

**Token, Messenger, WhatsApp, kopírování, navigator.share:** beze změny nutná – tyto mechanismy
(`shareToMessenger` s Web Share API + fallback na schránku, `wa.me` přímý odkaz, `getPortalUrl`
zachovávající token) byly funkčně správné už z dřívějších kol; jediná chyba byla ve špatné
základní URL, kterou teď dostávají všechny správně.

### Ověření provedené v tomto kole
Reálný TypeScript parser nad všemi 4 změněnými soubory – 0 syntaktických chyb. Žádný rozbitý `@/`
import. Ověřeno, že CSS třídy `table-glass`/`neon-border` použité v nových kartách skutečně
existují (`src/index.css`). Prohledán celý projekt na zbývající výskyty zástupné domény – žádné
další nenalezeny. **`npm run build` opět nespuštěn** – nemám v tomto prostředí přístup k instalaci
závislostí, potřebuji vaše ověření.

## Fáze 16 — Redesign PDF šablony (denní výkaz a sdílená struktura) + oprava patičky/číslování

**Kontext:** místo požadované "jen diagnostiky" přišel v mezičase přímý, podrobný specifikační
požadavek na přepracování vzhledu – proto jsem rovnou implementoval (diagnostika níže je zároveň
vysvětlením PROČ byly původní 2 konkrétní bugy - přesahující patička a "Strana 0/0").

**Skutečné příčiny dvou konkrétních bugů, které spec zmiňoval:**
- **Patička přes podpis:** patička byla `position: fixed` (opakuje se na každé vytištěné stránce)
  a spoléhala na pevně odhadnutý `padding-bottom: 18mm` na `<body>`, aby jí text neproháněl. Když
  byl obsah delší/kratší, než tenhle odhad počítal, patička reálně physicky překryla podpis.
- **"Strana 0 / 0":** CSS `counter(pages)` (celkový počet stran) není v Chromu při tisku/PDF
  spolehlivě podporován vůbec – vrací prázdno/0. A `counter(page)` navíc ukazuje reálné číslo
  JEN ve skutečném tiskovém kontextu (při reálném tisku/uložení do PDF) – v pouhém HTML náhledu
  (okno otevřené přes `window.open`, ještě NEvytištěné) counter kontext vůbec neexistuje, takže
  tam číslo bude vždy 0 – to je nevyhnutelná vlastnost prohlížečů, ne chyba kódu.

**Oprava:** patička už není `fixed` – normální tok dokumentu, `margin-top: 40px` od podpisu,
takže se nikdy nemůže "vsunout" do obsahu nad sebou. Zobrazuje jen `counter(page)` (bez
nespolehlivého total-page), tedy ukáže skutečné číslo stránky, na které patička reálně leží,
při reálném tisku/PDF (v pouhém náhledu bez tisku bude logicky prázdná – to je limit prohlížečů).

**Redesign dle zadání (`src/lib/print/printDocument.ts`, sdílené pro VŠECHNY PDF dokumenty):**
- Vodoznak: opacity 0.04, `position: absolute`, šířka 70 % strany, `z-index: -100` (dle zadaných
  CSS hodnot přesně). Pozor: s `absolute` (místo původního `fixed`) se vodoznak u vícestránkových
  dokumentů zobrazí jen jednou (na stránce, kam v toku spadne), ne opakovaně na každé straně –
  to je přesně to, o co bylo požádáno v zadaném CSS bloku.
- Hlavička: tenká linka `1px solid #e0e0e0` místo tlusté tmavě modré, `padding-bottom: 15px`,
  `margin-bottom: 20px`.
- Popisky metadat (`Pozice:`, `Datum:` apod.) nyní tučně a tmavě modře (`#1e3a5f`), místo šedě.
- Nadpis dokumentu zvětšen a vycentrován (odpovídá 24 px/bold/tmavě modrá).
- Tabulka výkonů: barvy záhlaví `#e8f1f5`/`#1d3557`, ohraničení `#d0e1e9`, padding 10px – přesně
  dle zadání.
- Explicitní `border: none` na `html, body, .doc-shell` a bílé pozadí – žádný černý rámeček.

**Toto se týká VŠECH PDF dokumentů v appce** (denní výkazy, výplatní pásky, smlouvy, deník,
paragony, náklady, fotodokumentace, mapa výkopů) – jde o sdílenou šablonu, takže oprava platí
všude najednou, ne jen pro "Denní výkaz".

**Změněný soubor:** pouze `src/lib/print/printDocument.ts` (žádný jiný soubor nebyl třeba měnit –
`ReportDetailView.tsx` a ostatní generátory obsahu už používaly `.doc-meta-grid`/`.doc-table`/
`.doc-section` třídy, takže redesign sdílené šablony se na ně promítl automaticky beze změny
jejich vlastního kódu).

**Ověření provedené v tomto kole:** reálný TypeScript parser nad změněným souborem – 0 chyb.
Žádný rozbitý import. **`npm run build` opět nespuštěn** – nemám zde přístup k instalaci
závislostí, potřebuji vaše ověření. Vizuální výsledek (přesné rozestupy, barvy dle oka) je potřeba
zkontrolovat na reálném náhledu/PDF – to já odsud nevidím.
