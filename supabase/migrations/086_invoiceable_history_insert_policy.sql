-- Migrace 086 – Doplnění chybějící INSERT politiky pro historii výkazů
-- Spusťte po 085_profit_overview_majitel_and_work_reports.sql
--
-- Migrace 084 vytvořila u invoiceable_work_report_history pouze politiku pro
-- čtení (SELECT). Bez politiky pro INSERT by frontendové zapisování historie
-- (vytvoření výkazu, přidání/změna/odstranění položky) bylo RLS zablokované.
-- Uzavření a znovuotevření zapisují historii přes SECURITY DEFINER funkce,
-- které RLS obchází, proto se tento nedostatek projevil až při reálném
-- napojení historie na běžné operace s řádky.
--
-- Žádná změna struktury tabulky, žádný nový sloupec – jen doplňková RLS
-- politika se stejným omezením (administrator, majitel) jako zbytek modulu.

CREATE POLICY "Admin a majitel – zápis historie" ON invoiceable_work_report_history
  FOR INSERT WITH CHECK (get_user_role() IN ('administrator', 'majitel'));
