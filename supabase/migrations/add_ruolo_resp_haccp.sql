-- Aggiunge la figura "Responsabile HACCP" (ruolo 'resp_haccp'):
--  1. due nuove colonne su facilities (nome + email) nel box "Riferimenti struttura"
--  2. nuovo ruolo in user_profiles (CHECK constraint)
--  3. nuovo gruppo RLS 'facility_access' = i 4 ruoli struttura + resp_haccp,
--     usato SOLO sulle policy di lettura di facilities e companies.
--
-- Scelta deliberata: 'resp_haccp' NON viene aggiunto a 'facility_staff'. Quel
-- gruppo governa scrittura KPI, NC, verbali, verifiche e lettura survey: il
-- Responsabile HACCP deve vedere solo la propria struttura e i documenti, quindi
-- a livello DB non deve poter leggere/scrivere altro. Le policy di doc_istanze,
-- doc_struttura e haccp_* sono già facility-scoped senza check di ruolo (vedi
-- role_permissions_centralization.sql) e funzionano automaticamente via
-- user_facility_access.
--
-- Eseguire su Supabase SQL Editor.
--
-- DA VERIFICARE IN PRODUZIONE dopo l'esecuzione (non presenti nel repo):
--  - la funzione admin_write_user_profile (usata da invite-user) non deve avere
--    una lista di ruoli ammessi che escluda 'resp_haccp'
--  - le policy dei bucket Storage dei documenti non devono elencare i ruoli

-- 1) Colonne struttura
ALTER TABLE facilities
  ADD COLUMN IF NOT EXISTS responsabile_haccp       text,
  ADD COLUMN IF NOT EXISTS email_responsabile_haccp text;

-- 2) Ruolo utente
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;

ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_role_check
  CHECK (role = ANY (ARRAY[
    'superadmin'::text, 'admin'::text, 'director'::text, 'sede'::text, 'board'::text,
    'dir_sanitario'::text, 'ref_struttura'::text, 'ref_qualita'::text,
    'resp_haccp'::text
  ]));

-- 3) Gruppo RLS di sola lettura struttura
INSERT INTO role_permission_groups (group_name, role) VALUES
  ('facility_access','director'), ('facility_access','dir_sanitario'),
  ('facility_access','ref_struttura'), ('facility_access','ref_qualita'),
  ('facility_access','resp_haccp')
ON CONFLICT DO NOTHING;

DROP POLICY IF EXISTS facilities_select ON facilities;
CREATE POLICY facilities_select ON facilities FOR SELECT USING (
  (user_role() = ANY (ARRAY['superadmin'::text, 'sede'::text, 'board'::text]))
  OR ((user_role() = 'admin'::text) AND ((company_id = user_company_id()) OR (user_company_id() IS NULL)))
  OR (user_in_group('facility_access') AND user_can_access_facility(id))
);

DROP POLICY IF EXISTS companies_select ON companies;
CREATE POLICY companies_select ON companies FOR SELECT USING (
  user_in_group('hq_board')
  OR ((auth.role() = 'authenticated') AND (id = user_company_id()))
  OR (user_in_group('facility_access') AND EXISTS (
        SELECT 1 FROM facilities f
        JOIN user_facility_access ufa ON ufa.facility_id = f.id
        WHERE f.company_id = companies.id AND ufa.user_id = auth.uid()
      ))
);

-- Ricarica la cache dello schema di PostgREST: senza, l'API non vede le nuove
-- colonne e il salvataggio fallisce con "Could not find the ... column of
-- 'facilities' in the schema cache".
NOTIFY pgrst, 'reload schema';

-- Verifica rapida (facoltativa):
--   SELECT * FROM role_permission_groups WHERE group_name = 'facility_access';
