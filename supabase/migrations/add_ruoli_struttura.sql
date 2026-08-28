-- Aggiunge 3 nuovi ruoli "struttura" (dir_sanitario, ref_struttura, ref_qualita)
-- accanto a 'director': stessi permessi applicativi di director (stessa vista
-- DirectorFacility, stesse strutture assegnate via user_facility_access), ma
-- SENZA visibilità sui dati economici (vedi add_ruoli_struttura_rls_economico.sql).
-- Eseguire su Supabase SQL Editor.
--
-- Vincolo attuale (verificato in produzione):
--   CHECK ((role = ANY (ARRAY['superadmin','admin','director','sede','board'])))

ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;

ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_role_check
  CHECK (role = ANY (ARRAY[
    'superadmin'::text, 'admin'::text, 'director'::text, 'sede'::text, 'board'::text,
    'dir_sanitario'::text, 'ref_struttura'::text, 'ref_qualita'::text
  ]));
