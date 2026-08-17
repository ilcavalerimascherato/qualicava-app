// src/constants/auditLogTables.js
// Elenco fisso delle tabelle coperte da trigger di audit (verificato: 30 tabelle
// a trigger creato con successo). haccp_scadenzario è volutamente esclusa: è una
// vista calcolata da facilities/haccp_profili/haccp_scia/haccp_manuali/haccp_analisi
// (già tutte presenti), non ha un trigger proprio e non produrrebbe mai righe se
// selezionata come filtro.
export const AUDIT_LOG_TABLES = [
  { group: 'Non conformità', tables: ['non_conformities'] },
  { group: 'KPI',            tables: ['dim_kpis', 'fact_kpi_monthly'] },
  { group: 'Survey',         tables: [
      'survey_campagne', 'survey_campagna_nomi', 'survey_centri_psichiatria',
      'survey_duplicati', 'survey_facility_mapping', 'survey_personale',
      'survey_rsa', 'survey_seniorliving', 'survey_source_configs', 'survey_ai_reports',
  ]},
  { group: 'Documenti',      tables: [
      'doc_master', 'doc_istanze', 'doc_struttura',
      'doc_master_revisioni', 'document_signatures',
  ]},
  { group: 'Anagrafiche',    tables: [
      'facilities', 'companies', 'udos', 'user_profiles', 'user_facility_access',
  ]},
  { group: 'HACCP',          tables: [
      'haccp_profili', 'haccp_scia', 'haccp_formazione',
      'haccp_analisi', 'haccp_normative_regionali',
  ]},
  { group: 'Sistema',        tables: ['notifications'] },
];
