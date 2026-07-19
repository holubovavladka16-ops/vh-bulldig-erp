# Okamžité nasazení na Vercel (2 minuty)

Kód je na `main` (v1.8.1 + fotodokumentace 100 %), ale **produkce stále běží starý build**, protože chybí Vercel credentials v GitHubu.

## Problém

GitHub Actions workflow `Vercel Production Deploy` selhává:

```
Chybí GitHub secrets: VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID
```

Push na `main` **sám o sobě nenasazuje** – Vercel projekt není napojený na auto-deploy z Gitu (nebo je vypnutý).

---

## Varianta A – Nejjrychlejší (Vercel Dashboard)

1. Otevřete [vercel.com/dashboard](https://vercel.com/dashboard)
2. Projekt **vh-bulldig-erp**
3. **Deployments** → u posledního deploye **⋯** → **Redeploy**  
   **NEBO** Settings → Git → **Connect Repository** → `holubovavladka16-ops/vh-bulldig-erp`, branch `main`
4. Po dokončení ověřte: https://vh-bulldig-erp.vercel.app/fotky  
   V patičce aplikace musí být **v1.8.1**

---

## Varianta B – GitHub Secrets (automatický deploy při každém pushi)

1. **VERCEL_TOKEN** – [vercel.com/account/tokens](https://vercel.com/account/tokens) → Create Token

2. **VERCEL_ORG_ID** a **VERCEL_PROJECT_ID** – lokálně:
   ```bash
   npx vercel link
   cat .vercel/project.json
   ```

3. GitHub → repo **vh-bulldig-erp** → **Settings** → **Secrets and variables** → **Actions**  
   (nebo Environment **Production – vh-bulldig-erp**)

   | Secret | Hodnota |
   |--------|---------|
   | `VERCEL_TOKEN` | token z kroku 1 |
   | `VERCEL_ORG_ID` | `orgId` z project.json |
   | `VERCEL_PROJECT_ID` | `projectId` z project.json |

4. **Actions** → **Vercel Production Deploy** → **Run workflow**  
   Nebo push na `main` spustí deploy automaticky.

---

## Ověření po nasazení

```bash
npm run build   # volitelně lokálně
node scripts/verify-production-deploy.mjs
```

Očekávaný výstup: `OK – nový build je na produkci.`

Na stránce `/fotky` uvidíte panel **„Specifikace modulu – implementované parametry“**.

---

## Supabase (pro plnou funkčnost fotodokumentace)

Spusťte v SQL Editoru (pokud ještě ne):

1. `supabase/manual/062_fotodokumentace_columns_production.sql`
2. `supabase/manual/063_public_gallery_rpc_production.sql`
