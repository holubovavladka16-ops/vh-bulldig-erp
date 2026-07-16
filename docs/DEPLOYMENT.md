# Nasazení VH Bulldig ERP → erp.vhbulldig.cz

Frontend je statická SPA (Vite + React). Backend běží na **Supabase Cloud** – hosting slouží pouze pro soubory z `dist/`.

## Požadavky

- Supabase projekt s aplikovanými migracemi (`npm run apply-migrations` nebo SQL z `supabase/apply-all-migrations.sql`)
- Doména **erp.vhbulldig.cz** (DNS u registrátora)
- Git repozitář na GitHubu/GitLabu

## Proměnné prostředí (produkce)

| Proměnná | Hodnota |
|----------|---------|
| `VITE_SUPABASE_URL` | `https://khhalcjgvqoyskkjlkyg.supabase.co` (nebo váš Project URL) |
| `VITE_SUPABASE_ANON_KEY` | anon / publishable key ze Supabase Dashboard |
| `VITE_INITIAL_ADMIN_EMAIL` | `admin@vhbulldig.cz` (volitelné, jen pro bootstrap skripty) |

> Build musí proběhnout **s nastavenými VITE_ proměnnými** – Vite je vkládá do bundle při `npm run build`.
> Produkční hodnoty jsou v souboru `.env.production` (commitnutý, pouze veřejné klíče). Alternativně nastavte proměnné ve Vercel dashboardu – mají přednost před `.env.production`.

## Inicializace databáze (jednorázově)

Cloud projekt musí dostat migrace a prvního administrátora:

```bash
# 1. Doplňte do .env.local (necommitovat):
#    SUPABASE_DB_PASSWORD=...   (Dashboard → Settings → Database)
#    nebo SUPABASE_ACCESS_TOKEN=... (Dashboard → Account → Access Tokens)

# 2. Spusťte kompletní setup:
npm run setup-complete
```

Alternativa: GitHub Actions workflow **Supabase Database Setup** (secrets viz `.github/workflows/supabase-setup.yml`).

Ručně: SQL Editor → vložte `supabase/apply-all-migrations.sql` → `npm run bootstrap-admin`.

---

## Varianta A: Vercel (doporučeno)

1. Import repozitáře na [vercel.com](https://vercel.com) → **Add New Project**.
2. Framework: **Vite** (nebo detekce z `vercel.json`).
3. **Environment Variables** → přidejte `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
4. Deploy.
5. **Settings → Domains** → přidejte `erp.vhbulldig.cz`.
6. U registrátora DNS:
   - **CNAME** `erp` → `cname.vercel-dns.com` (nebo hodnota z Vercel UI)
   - případně **A** záznam dle instrukcí Vercel

Soubor `vercel.json` v kořeni projektu už obsahuje SPA rewrite a bezpečnostní hlavičky.

### CLI (volitelně)

```bash
npm i -g vercel
vercel login
vercel --prod
vercel domains add erp.vhbulldig.cz
```

---

## Varianta B: Netlify

1. [app.netlify.com](https://app.netlify.com) → **Add new site** → Import z Git.
2. Build command: `npm run build`, Publish directory: `dist` (viz `netlify.toml`).
3. **Site configuration → Environment variables** → `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
4. **Domain management** → přidejte `erp.vhbulldig.cz`.
5. DNS: **CNAME** `erp` → `<váš-site>.netlify.app` nebo Netlify DNS.

---

## Supabase po nasazení

1. **Authentication → URL Configuration**
   - Site URL: `https://erp.vhbulldig.cz`
   - Redirect URLs: `https://erp.vhbulldig.cz/**`
2. Ověřte RLS a migrace 020–022 na cloudu.
3. Spusťte `npm run bootstrap-admin` s produkčními credentials (jednorázově).

---

## Ověření po nasazení

- [ ] `https://erp.vhbulldig.cz/prihlaseni` – přihlášení
- [ ] Mobilní zobrazení (Chrome DevTools nebo telefon)
- [ ] Modul Fotodokumentace – GPS a kamera (HTTPS je povinné pro geolokaci)
- [ ] `/statistiky` – Přehled hospodaření a zisku

---

## Lokální mobilní test (před produkcí)

```powershell
# Terminál 1
npm run dev:local:stack

# Terminál 2
npm run dev:local:app
```

V terminálu se vypíše **IP počítače** a **mobilní URL** (Vite `0.0.0.0`, API na LAN IP). Telefon musí být ve stejné Wi‑Fi.
