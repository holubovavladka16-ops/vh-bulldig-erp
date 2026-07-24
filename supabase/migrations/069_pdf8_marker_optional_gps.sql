-- PDF 8 Fáze 1b – hlavní špendlík může existovat bez GPS (dopočet později)

ALTER TABLE project_map_markers
  ALTER COLUMN gps_lat DROP NOT NULL,
  ALTER COLUMN gps_lng DROP NOT NULL;

COMMENT ON COLUMN project_map_markers.gps_lat IS
  'Zeměpisná šířka hlavního špendlíku; NULL = neúplný, čeká na geokódování.';

COMMENT ON COLUMN project_map_markers.gps_lng IS
  'Zeměpisná délka hlavního špendlíku; NULL = neúplný, čeká na geokódování.';

NOTIFY pgrst, 'reload schema';
