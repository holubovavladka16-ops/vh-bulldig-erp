-- Migrace 088 – Seed ceníku položek pro modul Fakturační výkaz prací
-- Spusťte po 087_invoiceable_header_immutable_when_closed.sql
--
-- Idempotentní vložení standardních položek do tabulky invoiceable_items.
-- Existující položky se stejným názvem se nepřepisují (ON CONFLICT DO NOTHING).

INSERT INTO invoiceable_items (
  name,
  category,
  unit,
  price_from,
  price_to,
  price_step,
  default_price,
  allow_custom_price,
  is_active
) VALUES
  -- 1. Výkopy podle objemu (m³)
  ('Výkop', 'Výkopy podle objemu', 'm³', 0, 999999, 10, 0, true, true),
  ('Ruční výkop', 'Výkopy podle objemu', 'm³', 0, 999999, 10, 0, true, true),
  ('Ruční zához', 'Výkopy podle objemu', 'm³', 0, 999999, 10, 0, true, true),
  ('Ruční výkop a zához', 'Výkopy podle objemu', 'm³', 0, 999999, 10, 0, true, true),
  ('Strojní výkop', 'Výkopy podle objemu', 'm³', 0, 999999, 10, 0, true, true),

  -- 2. Výkopy rýh v zemině (bm)
  ('Výkop rýhy 40–50 × 25 cm', 'Výkopy rýh v zemině', 'bm', 0, 999999, 10, 0, true, true),
  ('Výkop rýhy 50 × 35 cm', 'Výkopy rýh v zemině', 'bm', 0, 999999, 10, 0, true, true),
  ('Výkop rýhy 70 × 35 cm', 'Výkopy rýh v zemině', 'bm', 0, 999999, 10, 0, true, true),
  ('Výkop rýhy 80 × 35 cm', 'Výkopy rýh v zemině', 'bm', 0, 999999, 10, 0, true, true),
  ('Výkop rýhy 90 × 35 cm', 'Výkopy rýh v zemině', 'bm', 0, 999999, 10, 0, true, true),
  ('Výkop rýhy 100 × 45 cm', 'Výkopy rýh v zemině', 'bm', 0, 999999, 10, 0, true, true),
  ('Výkop rýhy 110–120 × 50 cm', 'Výkopy rýh v zemině', 'bm', 0, 999999, 10, 0, true, true),

  -- 3. Výkopy rýh v zámkové dlažbě (bm)
  ('Výkop rýhy v zámkové dlažbě 50 × 50 cm', 'Výkopy rýh v zámkové dlažbě', 'bm', 0, 999999, 10, 0, true, true),
  ('Výkop rýhy v zámkové dlažbě 70 × 50 cm', 'Výkopy rýh v zámkové dlažbě', 'bm', 0, 999999, 10, 0, true, true),
  ('Výkop rýhy v zámkové dlažbě hloubka 90–100 cm', 'Výkopy rýh v zámkové dlažbě', 'bm', 0, 999999, 10, 0, true, true),

  -- 4. Výkopy rýh v žulových kostkách (bm)
  ('Výkop rýhy v žulových kostkách 50 × 50 cm hloubka 50 cm', 'Výkopy rýh v žulových kostkách', 'bm', 0, 999999, 10, 0, true, true),
  ('Výkop rýhy v žulových kostkách 50 × 50 cm hloubka 70 cm', 'Výkopy rýh v žulových kostkách', 'bm', 0, 999999, 10, 0, true, true),
  ('Výkop rýhy v žulových kostkách 50 × 50 cm hloubka 100–120 cm', 'Výkopy rýh v žulových kostkách', 'bm', 0, 999999, 10, 0, true, true),

  -- 5. Dlažby a žulové kostky (m²)
  ('Demontáž zámkové dlažby', 'Dlažby a žulové kostky', 'm²', 0, 999999, 10, 0, true, true),
  ('Pokládka zámkové dlažby', 'Dlažby a žulové kostky', 'm²', 0, 999999, 10, 0, true, true),
  ('Demontáž žulových kostek', 'Dlažby a žulové kostky', 'm²', 0, 999999, 10, 0, true, true),
  ('Pokládka žulových kostek', 'Dlažby a žulové kostky', 'm²', 0, 999999, 10, 0, true, true),

  -- 6. Asfaltové práce (bm)
  ('Řezání asfaltu', 'Asfaltové práce', 'bm', 0, 999999, 10, 0, true, true),

  -- 7. Pískování (bm)
  ('Pískování 0–10 cm', 'Pískování', 'bm', 0, 999999, 10, 0, true, true),
  ('Pískování 11–20 cm', 'Pískování', 'bm', 0, 999999, 10, 0, true, true),
  ('Pískování 21–30 cm', 'Pískování', 'bm', 0, 999999, 10, 0, true, true),

  -- 8. Telekomunikační práce
  ('Tahání HDPE (bm)', 'Telekomunikační práce', 'bm', 0, 999999, 10, 0, true, true),
  ('Tahání multiductu (bm)', 'Telekomunikační práce', 'bm', 0, 999999, 10, 0, true, true),
  ('Spojka (ks)', 'Telekomunikační práce', 'ks', 0, 999999, 10, 0, true, true),
  ('Průraz objektu (ks)', 'Telekomunikační práce', 'ks', 0, 999999, 10, 0, true, true),
  ('Stavba pilíře (ks)', 'Telekomunikační práce', 'ks', 0, 999999, 10, 0, true, true),

  -- 9. Montážní práce
  ('Montážní práce (hod)', 'Montážní práce', 'hod', 0, 999999, 10, 0, true, true),
  ('Tahání kabelu VO (bm)', 'Montážní práce', 'bm', 0, 999999, 10, 0, true, true),
  ('Tahání kabelu NN (bm)', 'Montážní práce', 'bm', 0, 999999, 10, 0, true, true),
  ('Tahání kabelu VN (bm)', 'Montážní práce', 'bm', 0, 999999, 10, 0, true, true),
  ('Pokládka zemnící pásky (bm)', 'Montážní práce', 'bm', 0, 999999, 10, 0, true, true),

  -- 10. Strojní a hodinové práce
  ('Strojní práce (hod)', 'Strojní a hodinové práce', 'hod', 0, 999999, 10, 0, true, true),
  ('Hodinová práce (hod)', 'Strojní a hodinové práce', 'hod', 0, 999999, 10, 0, true, true),
  ('Prostoje (hod)', 'Strojní a hodinové práce', 'hod', 0, 999999, 10, 0, true, true),

  -- 11. Doprava a zemní práce
  ('Dovoz zeminy (t)', 'Doprava a zemní práce', 't', 0, 999999, 10, 0, true, true),
  ('Odvoz zeminy (t)', 'Doprava a zemní práce', 't', 0, 999999, 10, 0, true, true),
  ('Kilometry (km)', 'Doprava a zemní práce', 'km', 0, 999999, 10, 0, true, true)
ON CONFLICT (name) DO NOTHING;

NOTIFY pgrst, 'reload schema';
