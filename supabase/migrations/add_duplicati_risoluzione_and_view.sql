-- Pannello "Verifica duplicati survey": colonne di risoluzione su survey_duplicati
-- + view di dettaglio v_survey_duplicati_dettaglio.
-- Eseguire su Supabase SQL Editor. Sicuro da ri-eseguire (IF NOT EXISTS / CREATE OR REPLACE).
--
-- ATTENZIONE — verifiche da fare a mano prima/dopo l'esecuzione:
--  1. `riga_id::text` qui sotto è un cast difensivo perché non ho potuto verificare
--     se il tipo di survey_duplicati.riga_id combacia nativamente con l'id (bigint?)
--     delle 5 tabelle raw. Se combacia già, il cast è innocuo ma superfluo.
--  2. Questa migration NON tocca v_survey_data_normalized né v_survey_campagne.
--     Perché "Eliminare" abbia un effetto reale sulle statistiche delle campagne,
--     quelle due view vanno patchate a mano per escludere le righe con
--     survey_duplicati.stato = 'eliminato' (pattern NOT EXISTS, vedi
--     documentazione del pannello). Non ho visibilità sulla loro definizione
--     reale quindi non posso scrivere qui la patch esatta.

-- ── Parte A — colonne di risoluzione ────────────────────────────────
ALTER TABLE survey_duplicati
  ADD COLUMN IF NOT EXISTS risolto_da  uuid REFERENCES user_profiles(id),
  ADD COLUMN IF NOT EXISTS risolto_il  timestamptz,
  ADD COLUMN IF NOT EXISTS motivo      text;

-- ── Parte B — view di dettaglio per il pannello ─────────────────────
CREATE OR REPLACE VIEW v_survey_duplicati_dettaglio AS
WITH righe AS (
  SELECT 'survey_rsa'::text AS tabella_origine, r.id::text AS riga_id,
         r.created_at, r.struttura, r.note AS commento, NULL::text AS identificativo,
         to_jsonb(r) - ARRAY['id','created_at','struttura','note'] AS risposte
  FROM survey_rsa r
  UNION ALL
  SELECT 'survey_seniorliving', r.id::text, r.created_at, r.struttura,
         r."Note" AS commento, NULL::text,
         to_jsonb(r) - ARRAY['id','created_at','struttura','Note']
  FROM survey_seniorliving r
  UNION ALL
  SELECT 'survey_centri_psichiatria', r.id::text, r.created_at, r.struttura,
         r.note, r.nome_cognome,
         to_jsonb(r) - ARRAY['id','created_at','struttura','note','nome_cognome']
  FROM survey_centri_psichiatria r
  UNION ALL
  SELECT 'survey_personale', r.id::text, r.created_at, r.struttura,
         r.note, NULL::text,
         to_jsonb(r) - ARRAY['id','created_at','struttura','note']
  FROM survey_personale r
  UNION ALL
  SELECT 'survey_centri_disabilita', r.id::text, r.created_at, r.struttura,
         r.risposte_cura_assistenza AS commento, NULL::text AS identificativo,
         to_jsonb(r) - ARRAY['id','created_at','struttura','risposte_cura_assistenza']
  FROM survey_centri_disabilita r
)
SELECT
  d.gruppo_id, d.tabella_origine, d.riga_id, d.stato,
  d.risolto_da, d.risolto_il, d.motivo, d.campagna_id,
  righe.created_at, righe.struttura, righe.commento, righe.identificativo, righe.risposte,
  c.nome AS campagna_nome, c.data_inizio, c.data_fine, c.survey_type,
  fm.facility_id, f.name AS facility_name, f.company_id,
  up.full_name AS risolto_da_nome
FROM survey_duplicati d
JOIN righe ON righe.tabella_origine = d.tabella_origine AND righe.riga_id = d.riga_id::text
LEFT JOIN survey_campagne c ON c.id = d.campagna_id
LEFT JOIN survey_facility_mapping fm ON fm.nome_survey = righe.struttura
LEFT JOIN facilities f ON f.id = fm.facility_id
LEFT JOIN user_profiles up ON up.id = d.risolto_da;
