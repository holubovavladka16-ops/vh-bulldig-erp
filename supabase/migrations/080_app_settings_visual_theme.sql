-- Přidání sloupce visual_theme pro výběr vizuálního motivu aplikace
ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS visual_theme TEXT NOT NULL DEFAULT 'neon-glass'
  CHECK (visual_theme IN (
    'neon-glass',
    'black-gold',
    'premium-gold',
    'purple-premium',
    'industrial-blue'
  ));

COMMENT ON COLUMN app_settings.visual_theme IS 'Vizuální motiv aplikace (Neon Glass, Black & Gold, …)';
