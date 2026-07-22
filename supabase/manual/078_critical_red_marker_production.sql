-- PDF 8 KRITICKÁ OPRAVA – výchozí červená barva markeru (produkční SQL Editor)
-- Spusťte po migracích 068–077 nebo samostatně (idempotentní CREATE OR REPLACE / UPDATE).

\i ../migrations/076_pdf8_marker_color_no_diary.sql
\i ../migrations/077_pdf8_marker_color_approved_only.sql
\i ../migrations/078_pdf8_critical_default_red_marker.sql
