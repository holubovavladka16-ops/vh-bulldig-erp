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

## 2. Edge Function – odeslání faktury e-mailem s PDF

Funkce `send-invoice-email` vyžaduje Supabase Secrets:

- `RESEND_API_KEY` – API klíč z https://resend.com
- `RESEND_FROM` – ověřená odesílací adresa (např. `Fakturace VH Bulldig <fakturace@vase-domena.cz>`)

Nasazení:

```bash
npx supabase functions deploy send-invoice-email --project-ref khhalcjgvqoyskkjlkyg
```

## 3. Frontend (Vercel)

PR se sloučeným kódem musí být nasazen na produkci:

1. Vercel Dashboard → **vh-bulldig-erp** → Deployments → **Redeploy** z větve `main`
2. Nebo nastavit GitHub Secrets pro automatický deploy: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`

Po nasazení ověřte v JS bundle přítomnost řetězce `Fakturovač`.

## 4. První spuštění

1. Přihlásit se jako **Administrátor**
2. **Nastavení → Nastavení faktur** – vyplnit údaje VH Bulldig s.r.o., nahrát logo, podpis, razítko, bankovní účet
3. **Fakturovač → Nová faktura**
4. Zadat IČO odběratele (ARES doplní údaje automaticky)
5. Přidat položky, vytvořit PDF, odeslat e-mailem

## 5. Kontrolní checklist

- [ ] Modul **Fakturovač** v postranním menu
- [ ] Nastavení faktur ukládá logo/podpis/razítko
- [ ] Nová faktura dostane unikátní číslo = VS
- [ ] ARES doplní odběratele po zadání IČO
- [ ] PDF obsahuje logo, QR, podpis, razítko
- [ ] E-mail odejde s PDF přílohou (Resend)
- [ ] Historie faktur zobrazuje všechny záznamy
- [ ] Vyhledávání funguje

## 6. Řešení problémů

| Problém | Řešení |
|---------|--------|
| Modul není v menu | Redeploy Vercel + tvrdý refresh prohlížeče |
| Chyba při načtení faktur | Spustit migraci 081 |
| E-mail bez PDF | Nastavit `RESEND_API_KEY` a nasadit edge function |
| Nahrání loga selže | Spustit migraci 082 (storage UPDATE policy) |
