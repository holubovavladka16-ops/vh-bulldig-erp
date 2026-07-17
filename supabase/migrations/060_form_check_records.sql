-- Modul: Kontrola formuláře – Fáze 4 (záznamy porovnání s docházkou)

DO $$ BEGIN
  CREATE TYPE form_check_outcome AS ENUM ('match', 'mismatch', 'manual_review');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS form_check_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES paper_monthly_forms(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  month SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year SMALLINT NOT NULL CHECK (year >= 2020),
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  outcome form_check_outcome NOT NULL,
  difference_count INTEGER NOT NULL DEFAULT 0,
  ocr_result JSONB NOT NULL DEFAULT '{}'::jsonb,
  comparison_result JSONB NOT NULL DEFAULT '{}'::jsonb,
  photo_path TEXT,
  checked_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_form_check_records_form ON form_check_records(form_id);
CREATE INDEX IF NOT EXISTS idx_form_check_records_worker_period ON form_check_records(worker_id, year, month);
CREATE INDEX IF NOT EXISTS idx_form_check_records_checked_at ON form_check_records(checked_at DESC);

ALTER TABLE form_check_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin čte záznamy kontroly formuláře"
  ON form_check_records FOR SELECT
  USING (get_user_role() = 'administrator');

CREATE POLICY "Admin zapisuje záznamy kontroly formuláře"
  ON form_check_records FOR INSERT
  WITH CHECK (get_user_role() = 'administrator');

GRANT SELECT, INSERT ON form_check_records TO authenticated;

NOTIFY pgrst, 'reload schema';
