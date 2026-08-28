-- ============================================================================
-- Centralizzazione permessi RLS: role_permission_groups + user_in_group()
-- ============================================================================
-- Prima: ogni policy hardcoda il proprio ARRAY['superadmin','sede','admin',...].
-- Aggiungere un ruolo a un gruppo esistente (es. "chi vede i dati economici")
-- significava DROP/CREATE su N policy sparse in N tabelle (vedi cronologia
-- del rollout del ruolo 'board').
--
-- Dopo: i ruoli ammessi per un "gruppo" di permesso vivono in UNA tabella.
-- Le policy chiamano user_in_group('nome_gruppo') invece di ripetere l'array.
-- Aggiungere un ruolo a un gruppo = un INSERT, zero DROP/CREATE POLICY.
--
-- Questo script:
--   1. crea role_permission_groups + user_in_group()
--   2. popola i gruppi replicando ESATTAMENTE i permessi attuali (nessun
--      cambio di comportamento per i ruoli esistenti), con UNA eccezione
--      esplicita: 'financial_read' include 'director' fin da subito, quindi
--      questo script applica anche la richiesta "director vede i dati
--      economici" (sostituisce il file economico_rls_director.sql, che va
--      scartato/non lanciato)
--   3. riscrive ogni policy che usava un array di ruoli piatto per usare i
--      gruppi al posto dell'array
--
-- Le policy con logica non riducibile a un semplice elenco di ruoli (es. il
-- match azienda/company_id in facilities_select, o la company posseduta in
-- companies_select) NON sono state toccate nella parte non basata su ruoli:
-- solo il pezzo "quali ruoli" è stato spostato nel gruppo.
--
-- NOTA: economico_mensile_struttura non è inclusa qui perché non esiste
-- ancora (va creata da economico_struttura_migration.sql). Si patcha con un
-- secondo script minuscolo dopo che la tabella esiste.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Infrastruttura
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS role_permission_groups (
  group_name text NOT NULL,
  role       text NOT NULL,
  PRIMARY KEY (group_name, role)
);
COMMENT ON TABLE role_permission_groups IS
  'SSOT dei permessi RLS: quali ruoli appartengono a quale gruppo. Le policy chiamano user_in_group(gruppo) invece di ripetere ARRAY[...] di ruoli.';

ALTER TABLE role_permission_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS role_permission_groups_read ON role_permission_groups;
CREATE POLICY role_permission_groups_read ON role_permission_groups
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS role_permission_groups_write ON role_permission_groups;
CREATE POLICY role_permission_groups_write ON role_permission_groups
  FOR ALL USING (user_role() = 'superadmin');

CREATE OR REPLACE FUNCTION user_in_group(p_group text) RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM role_permission_groups
    WHERE group_name = p_group AND role = user_role()
  );
$$;

-- ---------------------------------------------------------------------------
-- 2) Seed gruppi (replica esatta dei permessi attuali + director su financial_read)
-- ---------------------------------------------------------------------------
INSERT INTO role_permission_groups (group_name, role) VALUES
  -- hq: le 3 tabelle amministrative "storiche"
  ('hq','superadmin'), ('hq','sede'), ('hq','admin'),
  -- hq_no_admin: gestione utenti/anagrafiche riservata a superadmin+sede (mai admin)
  ('hq_no_admin','superadmin'), ('hq_no_admin','sede'),
  -- hq_admin: operazioni "pesanti" riservate a superadmin+admin (mai sede)
  ('hq_admin','superadmin'), ('hq_admin','admin'),
  -- hq_board: hq + board (sola lettura per il board sulle aree aggregate)
  ('hq_board','superadmin'), ('hq_board','sede'), ('hq_board','admin'), ('hq_board','board'),
  -- facility_staff: i 4 ruoli che operano "dentro" una struttura via user_facility_access
  ('facility_staff','director'), ('facility_staff','dir_sanitario'),
  ('facility_staff','ref_struttura'), ('facility_staff','ref_qualita'),
  -- financial_read: chi vede dati economici/occupazionali sensibili.
  -- Tra i 4 ruoli struttura SOLO director è incluso (richiesta esplicita:
  -- dir_sanitario/ref_struttura/ref_qualita non vedono l'economico)
  ('financial_read','superadmin'), ('financial_read','sede'), ('financial_read','admin'),
  ('financial_read','board'), ('financial_read','director')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3) Riscrittura policy esistenti
-- ---------------------------------------------------------------------------

-- audit_log
DROP POLICY IF EXISTS audit_log_select ON audit_log;
CREATE POLICY audit_log_select ON audit_log FOR SELECT USING (user_in_group('hq'));

-- cdg_mensile
DROP POLICY IF EXISTS cdg_mensile_admin ON cdg_mensile;
CREATE POLICY cdg_mensile_admin ON cdg_mensile FOR ALL USING (user_in_group('hq'));

DROP POLICY IF EXISTS cdg_mensile_director_read ON cdg_mensile;
CREATE POLICY cdg_mensile_director_read ON cdg_mensile FOR SELECT USING (user_in_group('financial_read'));

-- cdg_servizi_map
DROP POLICY IF EXISTS cdg_map_admin ON cdg_servizi_map;
CREATE POLICY cdg_map_admin ON cdg_servizi_map FOR ALL USING (user_in_group('hq'));

DROP POLICY IF EXISTS cdg_map_director_read ON cdg_servizi_map;
CREATE POLICY cdg_map_director_read ON cdg_servizi_map FOR SELECT USING (user_in_group('financial_read'));

-- companies (companies_write resta com'era: superadmin only, singolo ruolo)
DROP POLICY IF EXISTS companies_select ON companies;
CREATE POLICY companies_select ON companies FOR SELECT USING (
  user_in_group('hq_board')
  OR ((auth.role() = 'authenticated') AND (id = user_company_id()))
  OR (user_in_group('facility_staff') AND EXISTS (
        SELECT 1 FROM facilities f
        JOIN user_facility_access ufa ON ufa.facility_id = f.id
        WHERE f.company_id = companies.id AND ufa.user_id = auth.uid()
      ))
);

-- dim_kpis
DROP POLICY IF EXISTS dim_kpis_write ON dim_kpis;
CREATE POLICY dim_kpis_write ON dim_kpis FOR ALL USING (user_in_group('hq_admin'));

-- doc_audit_log
DROP POLICY IF EXISTS doc_audit_log_admin ON doc_audit_log;
CREATE POLICY doc_audit_log_admin ON doc_audit_log FOR ALL USING (user_in_group('hq_admin'));

-- doc_istanze (le policy "director_*" sono già facility-scoped senza check di ruolo: non toccate)
DROP POLICY IF EXISTS doc_istanze_write ON doc_istanze;
CREATE POLICY doc_istanze_write ON doc_istanze FOR ALL USING (user_in_group('hq_admin'));

DROP POLICY IF EXISTS doc_istanze_read ON doc_istanze;
CREATE POLICY doc_istanze_read ON doc_istanze FOR SELECT USING (
  user_in_group('hq_admin')
  OR (facility_id IN (SELECT facility_id FROM user_facility_access WHERE user_id = auth.uid()))
);

-- doc_master
DROP POLICY IF EXISTS doc_master_admin ON doc_master;
CREATE POLICY doc_master_admin ON doc_master FOR ALL USING (user_in_group('hq_admin'));

-- doc_master_revisioni
DROP POLICY IF EXISTS doc_master_revisioni_admin ON doc_master_revisioni;
CREATE POLICY doc_master_revisioni_admin ON doc_master_revisioni FOR ALL USING (user_in_group('hq_admin'));

-- doc_struttura
DROP POLICY IF EXISTS doc_struttura_facility ON doc_struttura;
CREATE POLICY doc_struttura_facility ON doc_struttura FOR ALL USING (
  (facility_id IN (SELECT facility_id FROM user_facility_access WHERE user_id = auth.uid()))
  OR user_in_group('hq_admin')
);

-- document_signatures
DROP POLICY IF EXISTS superadmin_full ON document_signatures;
CREATE POLICY superadmin_full ON document_signatures FOR ALL USING (user_in_group('hq'));

-- economico_mensile (QUESTO sostituisce economico_rls_director.sql: financial_read include già 'director')
DROP POLICY IF EXISTS economico_mensile_admin ON economico_mensile;
CREATE POLICY economico_mensile_admin ON economico_mensile FOR ALL USING (user_in_group('hq'));

DROP POLICY IF EXISTS economico_mensile_read ON economico_mensile;
CREATE POLICY economico_mensile_read ON economico_mensile FOR SELECT USING (user_in_group('financial_read'));

-- facilities (facilities_select: NON toccata la parte non-ruolo/company-scoped, solo director->facility_staff)
DROP POLICY IF EXISTS facilities_delete ON facilities;
CREATE POLICY facilities_delete ON facilities FOR DELETE USING (user_in_group('hq_admin'));

DROP POLICY IF EXISTS facilities_insert ON facilities;
CREATE POLICY facilities_insert ON facilities FOR INSERT WITH CHECK (user_in_group('hq'));

DROP POLICY IF EXISTS facilities_select ON facilities;
CREATE POLICY facilities_select ON facilities FOR SELECT USING (
  (user_role() = ANY (ARRAY['superadmin'::text, 'sede'::text, 'board'::text]))
  OR ((user_role() = 'admin'::text) AND ((company_id = user_company_id()) OR (user_company_id() IS NULL)))
  OR (user_in_group('facility_staff') AND user_can_access_facility(id))
);

DROP POLICY IF EXISTS facilities_update ON facilities;
CREATE POLICY facilities_update ON facilities FOR UPDATE USING (
  user_in_group('hq') OR (user_in_group('facility_staff') AND user_can_access_facility(id))
);

-- fact_kpi_monthly (fact_kpi_monthly_director_read è facility-scoped senza check di ruolo: non toccata)
DROP POLICY IF EXISTS kpi_delete ON fact_kpi_monthly;
CREATE POLICY kpi_delete ON fact_kpi_monthly FOR DELETE USING (user_in_group('hq_admin'));

DROP POLICY IF EXISTS kpi_insert ON fact_kpi_monthly;
CREATE POLICY kpi_insert ON fact_kpi_monthly FOR INSERT WITH CHECK (user_in_group('hq'));

DROP POLICY IF EXISTS kpi_select ON fact_kpi_monthly;
CREATE POLICY kpi_select ON fact_kpi_monthly FOR SELECT USING (user_in_group('hq_board'));

DROP POLICY IF EXISTS kpi_update ON fact_kpi_monthly;
CREATE POLICY kpi_update ON fact_kpi_monthly FOR UPDATE USING (user_in_group('hq'));

DROP POLICY IF EXISTS kpi_write ON fact_kpi_monthly;
CREATE POLICY kpi_write ON fact_kpi_monthly FOR ALL USING (
  user_in_group('hq_admin') OR (user_in_group('facility_staff') AND user_can_access_facility(facility_id))
);

-- haccp_* (le policy "director_own_facilities" e "*_director_read" sono facility-scoped senza check di ruolo: non toccate)
DROP POLICY IF EXISTS admin_full_access ON haccp_analisi;
CREATE POLICY admin_full_access ON haccp_analisi FOR ALL USING (user_in_group('hq'));

DROP POLICY IF EXISTS admin_full_access ON haccp_formazione;
CREATE POLICY admin_full_access ON haccp_formazione FOR ALL USING (user_in_group('hq'));

DROP POLICY IF EXISTS admin_full_access ON haccp_manuali;
CREATE POLICY admin_full_access ON haccp_manuali FOR ALL USING (user_in_group('hq'));

DROP POLICY IF EXISTS admin_full_access ON haccp_profili;
CREATE POLICY admin_full_access ON haccp_profili FOR ALL USING (user_in_group('hq'));

DROP POLICY IF EXISTS admin_full_access ON haccp_scia;
CREATE POLICY admin_full_access ON haccp_scia FOR ALL USING (user_in_group('hq'));

-- haccp_normative_regionali
DROP POLICY IF EXISTS haccp_normative_write ON haccp_normative_regionali;
CREATE POLICY haccp_normative_write ON haccp_normative_regionali FOR ALL TO authenticated
  USING (user_in_group('hq_no_admin'));

-- haccp_template_versions
DROP POLICY IF EXISTS admin_write_templates ON haccp_template_versions;
CREATE POLICY admin_write_templates ON haccp_template_versions FOR ALL USING (user_in_group('hq_admin'));

-- non_conformities
DROP POLICY IF EXISTS nc_delete ON non_conformities;
CREATE POLICY nc_delete ON non_conformities FOR DELETE USING (user_in_group('hq_admin'));

DROP POLICY IF EXISTS nc_insert ON non_conformities;
CREATE POLICY nc_insert ON non_conformities FOR INSERT WITH CHECK (
  user_in_group('hq') OR (user_in_group('facility_staff') AND user_can_access_facility(facility_id))
);

DROP POLICY IF EXISTS nc_select ON non_conformities;
CREATE POLICY nc_select ON non_conformities FOR SELECT USING (
  user_in_group('hq_board') OR (user_in_group('facility_staff') AND user_can_access_facility(facility_id))
);

DROP POLICY IF EXISTS nc_update ON non_conformities;
CREATE POLICY nc_update ON non_conformities FOR UPDATE USING (
  user_in_group('hq') OR (user_in_group('facility_staff') AND user_can_access_facility(facility_id))
);

-- survey_ai_reports (survey_ai_reports_director_read è facility-scoped senza check di ruolo: non toccata; nota: _admin e _all erano duplicate identiche, restano due policy identiche per non cambiare nome)
DROP POLICY IF EXISTS survey_ai_reports_admin ON survey_ai_reports;
CREATE POLICY survey_ai_reports_admin ON survey_ai_reports FOR ALL USING (user_in_group('hq'));

DROP POLICY IF EXISTS survey_ai_reports_all ON survey_ai_reports;
CREATE POLICY survey_ai_reports_all ON survey_ai_reports FOR ALL USING (user_in_group('hq'));

-- survey_campagna_nomi (read è facility-scoped senza check di ruolo: non toccata)
DROP POLICY IF EXISTS survey_campagna_nomi_admin ON survey_campagna_nomi;
CREATE POLICY survey_campagna_nomi_admin ON survey_campagna_nomi FOR ALL USING (user_in_group('hq'));

-- survey_campagne
DROP POLICY IF EXISTS survey_campagne_admin ON survey_campagne;
CREATE POLICY survey_campagne_admin ON survey_campagne FOR ALL USING (user_in_group('hq'));

-- survey_cdi
DROP POLICY IF EXISTS survey_cdi_admin ON survey_cdi;
CREATE POLICY survey_cdi_admin ON survey_cdi FOR ALL USING (user_in_group('hq'));

DROP POLICY IF EXISTS survey_cdi_director_read ON survey_cdi;
CREATE POLICY survey_cdi_director_read ON survey_cdi FOR SELECT TO authenticated USING (
  user_in_group('facility_staff') AND EXISTS (
    SELECT 1 FROM survey_facility_mapping sfm
    JOIN user_facility_access ufa ON ufa.facility_id = sfm.facility_id
    WHERE sfm.nome_survey = survey_cdi.struttura::text AND ufa.user_id = auth.uid()
  )
);

-- survey_centri_disabilita
DROP POLICY IF EXISTS survey_centri_disabilita_admin ON survey_centri_disabilita;
CREATE POLICY survey_centri_disabilita_admin ON survey_centri_disabilita FOR ALL USING (user_in_group('hq'));

DROP POLICY IF EXISTS survey_centri_disabilita_director_read ON survey_centri_disabilita;
CREATE POLICY survey_centri_disabilita_director_read ON survey_centri_disabilita FOR SELECT TO authenticated USING (
  user_in_group('facility_staff') AND EXISTS (
    SELECT 1 FROM survey_facility_mapping sfm
    JOIN user_facility_access ufa ON ufa.facility_id = sfm.facility_id
    WHERE sfm.nome_survey = survey_centri_disabilita.struttura::text AND ufa.user_id = auth.uid()
  )
);

-- survey_centri_psichiatria
DROP POLICY IF EXISTS survey_centri_psichiatria_admin ON survey_centri_psichiatria;
CREATE POLICY survey_centri_psichiatria_admin ON survey_centri_psichiatria FOR ALL USING (user_in_group('hq'));

DROP POLICY IF EXISTS survey_centri_psichiatria_director_read ON survey_centri_psichiatria;
CREATE POLICY survey_centri_psichiatria_director_read ON survey_centri_psichiatria FOR SELECT TO authenticated USING (
  user_in_group('facility_staff') AND EXISTS (
    SELECT 1 FROM survey_facility_mapping sfm
    JOIN user_facility_access ufa ON ufa.facility_id = sfm.facility_id
    WHERE sfm.nome_survey = survey_centri_psichiatria.struttura::text AND ufa.user_id = auth.uid()
  )
);

-- survey_duplicati
DROP POLICY IF EXISTS survey_duplicati_select_sede ON survey_duplicati;
CREATE POLICY survey_duplicati_select_sede ON survey_duplicati FOR SELECT USING (user_in_group('hq_admin'));

DROP POLICY IF EXISTS survey_duplicati_update_sede ON survey_duplicati;
CREATE POLICY survey_duplicati_update_sede ON survey_duplicati FOR UPDATE USING (user_in_group('hq_admin'));

-- survey_personale
DROP POLICY IF EXISTS survey_personale_admin ON survey_personale;
CREATE POLICY survey_personale_admin ON survey_personale FOR ALL USING (user_in_group('hq'));

DROP POLICY IF EXISTS survey_personale_director_read ON survey_personale;
CREATE POLICY survey_personale_director_read ON survey_personale FOR SELECT USING (
  user_in_group('facility_staff') AND EXISTS (
    SELECT 1 FROM survey_facility_mapping sfm
    JOIN user_facility_access ufa ON ufa.facility_id = sfm.facility_id
    WHERE sfm.nome_survey = survey_personale.struttura::text AND ufa.user_id = auth.uid()
  )
);

-- survey_rsa
DROP POLICY IF EXISTS survey_rsa_admin ON survey_rsa;
CREATE POLICY survey_rsa_admin ON survey_rsa FOR ALL USING (user_in_group('hq'));

DROP POLICY IF EXISTS survey_rsa_director_read ON survey_rsa;
CREATE POLICY survey_rsa_director_read ON survey_rsa FOR SELECT TO authenticated USING (
  user_in_group('facility_staff') AND EXISTS (
    SELECT 1 FROM survey_facility_mapping sfm
    JOIN user_facility_access ufa ON ufa.facility_id = sfm.facility_id
    WHERE sfm.nome_survey = survey_rsa.struttura::text AND ufa.user_id = auth.uid()
  )
);

-- survey_seniorliving
DROP POLICY IF EXISTS survey_seniorliving_admin ON survey_seniorliving;
CREATE POLICY survey_seniorliving_admin ON survey_seniorliving FOR ALL USING (user_in_group('hq'));

DROP POLICY IF EXISTS survey_seniorliving_director_read ON survey_seniorliving;
CREATE POLICY survey_seniorliving_director_read ON survey_seniorliving FOR SELECT TO authenticated USING (
  user_in_group('facility_staff') AND EXISTS (
    SELECT 1 FROM survey_facility_mapping sfm
    JOIN user_facility_access ufa ON ufa.facility_id = sfm.facility_id
    WHERE sfm.nome_survey = survey_seniorliving.struttura::text AND ufa.user_id = auth.uid()
  )
);

-- udos
DROP POLICY IF EXISTS udos_write ON udos;
CREATE POLICY udos_write ON udos FOR ALL USING (user_in_group('hq_admin'));

-- user_facility_access
DROP POLICY IF EXISTS access_manage ON user_facility_access;
CREATE POLICY access_manage ON user_facility_access FOR ALL USING (user_in_group('hq_admin'));

DROP POLICY IF EXISTS access_select ON user_facility_access;
CREATE POLICY access_select ON user_facility_access FOR SELECT USING (
  (user_id = auth.uid()) OR user_in_group('hq_admin')
);

-- user_profiles (profiles_delete e user_profiles_self_read restano com'erano)
DROP POLICY IF EXISTS profiles_insert ON user_profiles;
CREATE POLICY profiles_insert ON user_profiles FOR INSERT WITH CHECK (user_in_group('hq_no_admin'));

DROP POLICY IF EXISTS profiles_select ON user_profiles;
CREATE POLICY profiles_select ON user_profiles FOR SELECT USING (
  (id = auth.uid()) OR user_in_group('hq_no_admin')
);

DROP POLICY IF EXISTS profiles_update ON user_profiles;
CREATE POLICY profiles_update ON user_profiles FOR UPDATE USING (
  (id = auth.uid()) OR user_in_group('hq_no_admin')
);

-- verbali_corrispondenza
DROP POLICY IF EXISTS verbali_corrispondenza_delete ON verbali_corrispondenza;
CREATE POLICY verbali_corrispondenza_delete ON verbali_corrispondenza FOR DELETE USING (user_in_group('hq_admin'));

DROP POLICY IF EXISTS verbali_corrispondenza_insert ON verbali_corrispondenza;
CREATE POLICY verbali_corrispondenza_insert ON verbali_corrispondenza FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM verbali_ispettivi vi
    WHERE vi.id = verbali_corrispondenza.verbale_id
      AND (user_in_group('hq') OR (user_in_group('facility_staff') AND user_can_access_facility(vi.facility_id)))
  )
);

DROP POLICY IF EXISTS verbali_corrispondenza_select ON verbali_corrispondenza;
CREATE POLICY verbali_corrispondenza_select ON verbali_corrispondenza FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM verbali_ispettivi vi
    WHERE vi.id = verbali_corrispondenza.verbale_id
      AND (user_in_group('hq_board') OR (user_in_group('facility_staff') AND user_can_access_facility(vi.facility_id)))
  )
);

DROP POLICY IF EXISTS verbali_corrispondenza_update ON verbali_corrispondenza;
CREATE POLICY verbali_corrispondenza_update ON verbali_corrispondenza FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM verbali_ispettivi vi
    WHERE vi.id = verbali_corrispondenza.verbale_id
      AND (user_in_group('hq') OR (user_in_group('facility_staff') AND user_can_access_facility(vi.facility_id)))
  )
);

-- verbali_ispettivi
DROP POLICY IF EXISTS verbali_ispettivi_delete ON verbali_ispettivi;
CREATE POLICY verbali_ispettivi_delete ON verbali_ispettivi FOR DELETE USING (user_in_group('hq_admin'));

DROP POLICY IF EXISTS verbali_ispettivi_insert ON verbali_ispettivi;
CREATE POLICY verbali_ispettivi_insert ON verbali_ispettivi FOR INSERT WITH CHECK (
  user_in_group('hq') OR (user_in_group('facility_staff') AND user_can_access_facility(facility_id))
);

DROP POLICY IF EXISTS verbali_ispettivi_select ON verbali_ispettivi;
CREATE POLICY verbali_ispettivi_select ON verbali_ispettivi FOR SELECT USING (
  user_in_group('hq_board') OR (user_in_group('facility_staff') AND user_can_access_facility(facility_id))
);

DROP POLICY IF EXISTS verbali_ispettivi_update ON verbali_ispettivi;
CREATE POLICY verbali_ispettivi_update ON verbali_ispettivi FOR UPDATE USING (
  user_in_group('hq') OR (user_in_group('facility_staff') AND user_can_access_facility(facility_id))
);

-- verbali_rilievi
DROP POLICY IF EXISTS verbali_rilievi_delete ON verbali_rilievi;
CREATE POLICY verbali_rilievi_delete ON verbali_rilievi FOR DELETE USING (user_in_group('hq_admin'));

DROP POLICY IF EXISTS verbali_rilievi_insert ON verbali_rilievi;
CREATE POLICY verbali_rilievi_insert ON verbali_rilievi FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM verbali_ispettivi vi
    WHERE vi.id = verbali_rilievi.verbale_id
      AND (user_in_group('hq') OR (user_in_group('facility_staff') AND user_can_access_facility(vi.facility_id)))
  )
);

DROP POLICY IF EXISTS verbali_rilievi_select ON verbali_rilievi;
CREATE POLICY verbali_rilievi_select ON verbali_rilievi FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM verbali_ispettivi vi
    WHERE vi.id = verbali_rilievi.verbale_id
      AND (user_in_group('hq_board') OR (user_in_group('facility_staff') AND user_can_access_facility(vi.facility_id)))
  )
);

DROP POLICY IF EXISTS verbali_rilievi_update ON verbali_rilievi;
CREATE POLICY verbali_rilievi_update ON verbali_rilievi FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM verbali_ispettivi vi
    WHERE vi.id = verbali_rilievi.verbale_id
      AND (user_in_group('hq') OR (user_in_group('facility_staff') AND user_can_access_facility(vi.facility_id)))
  )
);

-- verifiche_esiti
DROP POLICY IF EXISTS verifiche_esiti_select ON verifiche_esiti;
CREATE POLICY verifiche_esiti_select ON verifiche_esiti FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM verifiche_sessioni vs
    WHERE vs.id = verifiche_esiti.sessione_id
      AND (user_in_group('hq_board') OR (user_in_group('facility_staff') AND user_can_access_facility(vs.facility_id)))
  )
);

DROP POLICY IF EXISTS verifiche_esiti_write ON verifiche_esiti;
CREATE POLICY verifiche_esiti_write ON verifiche_esiti FOR ALL USING (
  EXISTS (
    SELECT 1 FROM verifiche_sessioni vs
    WHERE vs.id = verifiche_esiti.sessione_id
      AND (user_in_group('hq') OR (user_in_group('facility_staff') AND user_can_access_facility(vs.facility_id)))
  )
);

-- verifiche_ruoli
DROP POLICY IF EXISTS verifiche_ruoli_write ON verifiche_ruoli;
CREATE POLICY verifiche_ruoli_write ON verifiche_ruoli FOR ALL USING (user_in_group('hq'));

-- verifiche_scadenze
DROP POLICY IF EXISTS verifiche_scadenze_select ON verifiche_scadenze;
CREATE POLICY verifiche_scadenze_select ON verifiche_scadenze FOR SELECT USING (
  user_in_group('hq_board') OR (user_in_group('facility_staff') AND user_can_access_facility(facility_id))
);

DROP POLICY IF EXISTS verifiche_scadenze_write ON verifiche_scadenze;
CREATE POLICY verifiche_scadenze_write ON verifiche_scadenze FOR ALL USING (user_in_group('hq'));

-- verifiche_sessioni
DROP POLICY IF EXISTS verifiche_sessioni_select ON verifiche_sessioni;
CREATE POLICY verifiche_sessioni_select ON verifiche_sessioni FOR SELECT USING (
  user_in_group('hq_board') OR (user_in_group('facility_staff') AND user_can_access_facility(facility_id))
);

DROP POLICY IF EXISTS verifiche_sessioni_write ON verifiche_sessioni;
CREATE POLICY verifiche_sessioni_write ON verifiche_sessioni FOR ALL USING (
  user_in_group('hq') OR (user_in_group('facility_staff') AND user_can_access_facility(facility_id))
);

-- verifiche_template
DROP POLICY IF EXISTS verifiche_template_write ON verifiche_template;
CREATE POLICY verifiche_template_write ON verifiche_template FOR ALL USING (user_in_group('hq'));

-- verifiche_template_ruoli
DROP POLICY IF EXISTS verifiche_template_ruoli_write ON verifiche_template_ruoli;
CREATE POLICY verifiche_template_ruoli_write ON verifiche_template_ruoli FOR ALL USING (user_in_group('hq'));

-- verifiche_template_voci
DROP POLICY IF EXISTS verifiche_template_voci_write ON verifiche_template_voci;
CREATE POLICY verifiche_template_voci_write ON verifiche_template_voci FOR ALL USING (user_in_group('hq'));

-- ============================================================================
-- Verifica rapida dopo l'esecuzione (facoltativa, solo lettura):
--   SELECT * FROM role_permission_groups ORDER BY group_name, role;
-- ============================================================================
