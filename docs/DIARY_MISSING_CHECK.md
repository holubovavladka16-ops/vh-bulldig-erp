# Kontrola chybějícího stavebního deníku (PDF 8 Fáze 1i)

## Mechanismus spuštění

Produkční kontrola běží **serverově** přes PostgreSQL funkci:

```sql
SELECT run_missing_diary_check();
```

Funkce je idempotentní – opakované spuštění nevytváří duplicitní upozornění (unikátní index na `project_id + type + missing_date + target_user_id`).

### Doporučené naplánování (Supabase)

1. V Supabase Dashboard → **Database → Extensions** povolte `pg_cron` (pokud je dostupné).
2. Naplánujte denní job **po** `company_settings.diary_check_time` v pásmu `company_settings.timezone` (výchozí `Europe/Prague`), např. 20:05:

```sql
SELECT cron.schedule(
  'pdf8-missing-diary-check',
  '5 20 * * 1-5',
  $$SELECT run_missing_diary_check();$$
);
```

3. Upravte CRON výraz podle `working_days` ve firemním nastavení.

### Ruční test v ERP

Administrátor nebo Majitel může spustit kontrolu tlačítkem **Spustit kontrolu** v modulu `/zakazky-mapa` (panel upozornění).

## Platný denní zápis

Za platný se považuje záznam s `entry_status` ∈:

- `approved`
- `submitted`
- `pending_review`

**Neplatí:** `draft`, `returned`, `rejected`

## Automatické vyřešení

Po vložení nebo změně deníku na platný stav trigger `resolve_missing_diary_notifications_insert` zavolá `resolve_missing_diary_notifications()` – upozornění se označí jako vyřešená (`is_resolved = true`, `resolved_at`, `resolved_by`), záznam se **nemazá**.

Frontend navíc volá `recalculateProjectMarkerColor()` pro obnovení barvy špendlíku.

## Ruční stavy pozastavující kontrolu

Automatická kontrola se neprovede, pokud má zakázka ruční override (`color_source = manual`) s barvou:

- červená (nepracuje se),
- oranžová (investor),
- modrá (ukončeno / čekání).

## Migrace

Soubor: `supabase/migrations/073_pdf8_diary_missing_notifications.sql`
