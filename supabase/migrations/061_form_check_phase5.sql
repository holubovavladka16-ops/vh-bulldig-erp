-- Modul: Kontrola formuláře – Fáze 5 (rozšíření záznamů kontroly)

ALTER TABLE form_check_records
  ADD COLUMN IF NOT EXISTS ocr_confidence NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS form_number TEXT;

CREATE INDEX IF NOT EXISTS idx_form_check_records_outcome ON form_check_records(outcome);
CREATE INDEX IF NOT EXISTS idx_form_check_records_checked_by ON form_check_records(checked_by);

NOTIFY pgrst, 'reload schema';
