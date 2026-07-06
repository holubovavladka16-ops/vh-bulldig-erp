-- AI asistent stavebního deníku (Gemini)

ALTER TABLE construction_diary_entries
  ADD COLUMN IF NOT EXISTS rough_work_description TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ai_work_description TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ai_assisted BOOLEAN NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
