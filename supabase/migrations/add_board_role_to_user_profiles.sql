-- Aggiunge il ruolo 'board' all'elenco dei ruoli ammessi su user_profiles.role.
-- Necessario per la Fase 1 del redesign /report (Cruscotto): il ruolo board
-- vede solo /report in sola lettura, senza gli altri permessi HQ di 'sede'.
-- Eseguire su Supabase SQL Editor.
--
-- Vincolo attuale (verificato in produzione):
--   CHECK ((role = ANY (ARRAY['superadmin','admin','director','sede'])))

ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;

ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_role_check
  CHECK (role = ANY (ARRAY['superadmin'::text, 'admin'::text, 'director'::text, 'sede'::text, 'board'::text]));
