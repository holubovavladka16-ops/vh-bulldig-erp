# Fakturovač – produkční nasazení (VH Bulldig ERP 8)

## Chyba `invoice_settings` v schema cache

**Příčina:** Na produkční Supabase nejsou aplikované migrace **081** a **082**. Tabulky `invoice_settings`, `issued_invoices`, `issued_invoice_lines` a funkce `next_invoice_number()` v databázi neexistují. GitHub Actions workflow selhaly kvůli chybějícím secrets `SUPABASE_DB_PASSWORD` / `POSTGRES_URL`.

**Oprava:** V Supabase Dashboard → SQL Editor spusťte celý soubor:

`supabase/manual/081_082_fakturovac_production.sql`

Po spuštění obnovte aplikaci (tvrdý refresh). PostgREST načte schéma automaticky (`NOTIFY pgrst` je v skriptu).

## 1. SQL migrace (Supabase)

Alternativně jednotlivé soubory:

1. `supabase/migrations/081_fakturovac_module.sql`
2. `supabase/migrations/082_fakturovac_storage_update.sql`

Nebo GitHub Actions workflow **Apply Fakturovač Migrations 081-082** (vyžaduje nastavené DB secrets).

Ověření:

```sql
SELECT COUNT(*) FROM invoice_settings;
SELECT id, label FROM erp_modules WHERE id = 'fakturovac';
SELECT proname FROM pg_proc WHERE proname = 'next_invoice_number';
```

## 2. Frontend (Vercel)

PR se sloučeným kódem musí být nasazen na produkci:

1. Vercel Dashboard → **vh-bulldig-erp** → Deployments → **Redeploy** z větve `main`
2. Nebo nastavit GitHub Secrets pro automatický deploy: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`

Po nasazení ověřte v JS bundle přítomnost řetězce `Fakturovač`.

## 3. První spuštění

1. Přihlásit se jako **Administrátor**
2. **Nastavení → Nastavení faktur** – vyplnit údaje VH Bulldig s.r.o., nahrát logo, podpis, razítko, bankovní účet
3. **Fakturovač → Nová faktura**
4. Zadat IČO odběratele (ARES doplní údaje automaticky)
5. Přidat položky, stáhnout PDF nebo sdílet přes systémové sdílení zařízení

## 4. Kontrolní checklist

- [ ] Modul **Fakturovač** v postranním menu
- [ ] Nastavení faktur ukládá logo/podpis/razítko
- [ ] Nová faktura dostane unikátní číslo = VS
- [ ] ARES doplní odběratele po zadání IČO
- [ ] PDF obsahuje logo, QR, podpis, razítko
- [ ] PDF lze stáhnout a sdílet (WhatsApp apod.)
- [ ] Historie faktur zobrazuje všechny záznamy
- [ ] Vyhledávání funguje

## 5. Řešení problémů

| Problém | Řešení |
|---------|--------|
| Modul není v menu | Redeploy Vercel + tvrdý refresh prohlížeče |
| Chyba při načtení faktur | Spustit migraci 081 |
| Sdílení PDF nefunguje | Použijte tlačítko Stáhnout PDF |
| Nahrání loga selže | Spustit migraci 082 (storage UPDATE policy) |
