-- Estende al ruolo 'board' le policy RLS di sola lettura già concesse a
-- 'sede'/'admin'/'superadmin' su companies, facilities, fact_kpi_monthly,
-- non_conformities. Necessario per la Fase 1 del redesign /report
-- (Cruscotto): senza questa migration, un utente 'board' vede 0 righe da
-- queste tabelle (le policy elencano i ruoli ammessi in un array fisso che
-- non includeva 'board').
--
-- In più, 'companies_select' non includeva esplicitamente 'sede' (solo
-- 'admin'/'superadmin') — probabile gap preesistente, corretto qui insieme
-- a 'board' perché sede deve vedere tutte le società come admin.
--
-- Eseguire su Supabase SQL Editor.

ALTER POLICY companies_select ON companies
USING (
  (user_role() = ANY (ARRAY['superadmin'::text, 'admin'::text, 'sede'::text, 'board'::text]))
  OR ((auth.role() = 'authenticated'::text) AND (id = user_company_id()))
  OR ((user_role() = 'director'::text) AND (EXISTS (
      SELECT 1 FROM (facilities f JOIN user_facility_access ufa ON ((ufa.facility_id = f.id)))
      WHERE ((f.company_id = companies.id) AND (ufa.user_id = auth.uid()))
  )))
);

ALTER POLICY facilities_select ON facilities
USING (
  (user_role() = ANY (ARRAY['superadmin'::text, 'sede'::text, 'board'::text]))
  OR ((user_role() = 'admin'::text) AND ((company_id = user_company_id()) OR (user_company_id() IS NULL)))
  OR ((user_role() = 'director'::text) AND user_can_access_facility(id))
);

ALTER POLICY kpi_select ON fact_kpi_monthly
USING (user_role() = ANY (ARRAY['superadmin'::text, 'sede'::text, 'admin'::text, 'board'::text]));

ALTER POLICY nc_select ON non_conformities
USING (
  (user_role() = ANY (ARRAY['superadmin'::text, 'sede'::text, 'admin'::text, 'board'::text]))
  OR ((user_role() = 'director'::text) AND user_can_access_facility(facility_id))
);
