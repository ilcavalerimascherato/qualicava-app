-- Aggiunge colonna 'titolo' alla tabella non_conformities
-- Eseguire su Supabase SQL Editor se la colonna non esiste ancora.
-- Verifica preventiva:
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'non_conformities' AND column_name = 'titolo';

ALTER TABLE non_conformities
  ADD COLUMN IF NOT EXISTS titolo TEXT;
