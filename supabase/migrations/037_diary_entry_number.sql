-- Číslování zápisů stavebního deníku

CREATE SEQUENCE IF NOT EXISTS construction_diary_entry_number_seq START 1;

ALTER TABLE construction_diary_entries
  ADD COLUMN IF NOT EXISTS entry_number INTEGER;

UPDATE construction_diary_entries
SET entry_number = nextval('construction_diary_entry_number_seq')
WHERE entry_number IS NULL;

CREATE OR REPLACE FUNCTION assign_diary_entry_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.entry_number IS NULL THEN
    NEW.entry_number := nextval('construction_diary_entry_number_seq');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS diary_entry_number_trigger ON construction_diary_entries;
CREATE TRIGGER diary_entry_number_trigger
  BEFORE INSERT ON construction_diary_entries
  FOR EACH ROW EXECUTE FUNCTION assign_diary_entry_number();

NOTIFY pgrst, 'reload schema';
