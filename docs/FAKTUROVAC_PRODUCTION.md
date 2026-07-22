# Fakturovač – produkční nasazení (VH Bulldig ERP 8)

## 1. SQL migrace (Supabase)

Spusťte v **SQL Editoru** nebo přes GitHub Actions workflow **Apply Fakturovač Migrations 081-082**:

1. `supabase/migrations/081_fakturovac_module.sql`
2. `supabase/migrations/082_fakturovac_storage_update.sql`

Ověření:

```sql
SELECT id, label, path FROM erp_modules WHERE id = 'fakturovac';
SELECT COUNT(*) FROM invoice_settings;
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
