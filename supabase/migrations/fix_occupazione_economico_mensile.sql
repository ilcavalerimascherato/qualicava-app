-- Fix: occupazione_media_pct in economico_mensile è stata importata 100x
-- troppo grande (es. 8471 invece di 84.71) — bug isolato all'import
-- company-level, economico_mensile_struttura non è affetta (verificato).
UPDATE economico_mensile
SET occupazione_media_pct = occupazione_media_pct / 100
WHERE occupazione_media_pct IS NOT NULL
  AND occupazione_media_pct > 100;
