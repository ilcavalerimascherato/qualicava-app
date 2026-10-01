-- SSOT per survey a livello SOCIETÀ vs STRUTTURA (es. OASI: poco organico,
-- un'unica rilevazione copre più strutture della stessa società; IL GABBIANO:
-- survey impostata erroneamente a livello società invece che per struttura).
--
-- PRIMA: v_survey_data_normalized duplicava la riga aggregata su OGNI
-- facility_id mappato in survey_facility_mapping per lo stesso nome_survey
-- (stesso total_responses ripetuto identico su ogni struttura coinvolta),
-- company_id era SEMPRE NULL (e pure tipizzato NULL::uuid, mentre
-- companies.id è integer — mai emerso perché mai valorizzato). Il codice
-- frontend (AnalyticsModal.jsx, GlobalReportModal.jsx, DirectorFacility.jsx)
-- filtra già correttamente con la regola
-- "facility_id valorizzato → per struttura, altrimenti company_id → per
-- società" — ma la vista non ha mai prodotto quel secondo caso, quindi
-- isCompanyWide era sempre falso e la redemption veniva calcolata sul
-- totale società diviso solo per il target audience della singola
-- struttura (sovrastimata).
--
-- ORA: nessuna duplicazione — una riga sola per (nome_survey, calendar_id,
-- source_table). facility_id valorizzato quando la mappatura copre una sola
-- struttura, company_id valorizzato (facility_id NULL) quando ne copre più
-- di una — letto da survey_facility_mapping + facilities, non da una
-- lista hardcoded di nomi società.
--
-- resolve_survey_target() è SECURITY DEFINER apposta: la determinazione
-- "questo nome_survey è di struttura o di società" è metadato di targeting
-- (quali facility_id sono mappate), non dato di risposta — deve essere
-- corretta per ogni utente indipendentemente da eventuali RLS restrittive
-- su survey_facility_mapping, altrimenti un direttore con accesso a una
-- sola delle N strutture di una rilevazione societaria la vedrebbe (erratamente)
-- come "per struttura" invece che "per società". La visibilità delle RISPOSTE
-- resta governata dalla RLS invoker-based sulle tabelle survey_* raw
-- (invariata, vedi role_permissions_centralization.sql).
--
-- NOTA EFFETTO COLLATERALE: survey_ai_reports è oggi chiavata per
-- facility_id (upsert in AnalyticsModal.jsx). Per le righe company-wide
-- facility_id è ora NULL, quindi l'eventuale report AI già generato in
-- precedenza per una singola struttura non viene più agganciato da questa
-- vista — va rigenerato. Non un problema di dati (la riga in survey_ai_reports
-- resta nel DB), solo la cache non viene più trovata per quel caso specifico.

CREATE OR REPLACE FUNCTION public.resolve_survey_target(p_nome_survey text)
RETURNS TABLE(facility_id integer, company_id integer)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    CASE WHEN count(*) = 1 THEN max(sfm.facility_id) END AS facility_id,
    -- Assume che tutte le facility mappate sullo stesso nome_survey
    -- appartengano alla stessa società (vero per costruzione: è la società
    -- che ha fatto un'unica rilevazione sulle proprie strutture) — se mai
    -- non lo fossero, MAX(f.company_id) prende comunque una società valida
    -- invece di lasciare la riga orfana.
    CASE WHEN count(*) > 1 THEN max(f.company_id) END AS company_id
  FROM survey_facility_mapping sfm
  JOIN facilities f ON f.id = sfm.facility_id
  WHERE sfm.nome_survey = p_nome_survey
$$;

GRANT EXECUTE ON FUNCTION public.resolve_survey_target(text) TO authenticated;

-- company_id passa da NULL::uuid (mai valorizzato) a un vero integer (FK
-- companies.id) — CREATE OR REPLACE VIEW non può cambiare il tipo di una
-- colonna esistente, quindi va ricreata da zero (nessun'altra vista
-- tracciata nelle migration dipende da questa, verificato).
--
-- security_invoker = false ESPLICITO (non solo il default): questa vista è
-- stata volutamente riportata a "bypassa RLS" in
-- revert_security_invoker_perf_regression.sql per un incidente di
-- performance (statement timeout in dashboard admin) — non ancora risolto
-- alla radice (RLS sottostante da ottimizzare). Va mantenuto finché quel
-- lavoro non viene rifatto, altrimenti si reintroduce lo stesso incidente.
DROP VIEW IF EXISTS v_survey_data_normalized;

CREATE VIEW v_survey_data_normalized WITH (security_invoker = false) AS
WITH sl_righe AS (
  SELECT
    sl.id AS riga_id,
    sl.struttura AS nome_survey_originale,
    to_char(sl.created_at, 'YYYY-MM') AS calendar_id,
    EXTRACT(year FROM sl.created_at)::integer AS year,
    jsonb_strip_nulls(jsonb_build_object(
      'soddisfazione_generale',
        CASE sl.soddisfazione_complessiva
          WHEN 'Molto soddisfatto' THEN 100
          WHEN 'Soddisfatto' THEN 75
          WHEN 'Sufficiente' THEN 50
          WHEN 'Poco soddisfatto' THEN 25
          WHEN 'Insufficiente' THEN 25
          WHEN 'Insoddisfatto' THEN 0
          WHEN 'Scarso' THEN 0
          ELSE NULL
        END,
      'info_prenotazione',
        CASE sl.informazioni_prenotazione
          WHEN 'Molto chiare e dettagliate' THEN 100
          WHEN 'Chiare' THEN 75
          WHEN 'Sufficienti' THEN 50
          WHEN 'Poco chiare' THEN 25
          WHEN 'Scarse' THEN 0
          ELSE NULL
        END,
      'info_ingresso',
        CASE sl.informazioni_ingresso
          WHEN 'Molto chiare e dettagliate' THEN 100
          WHEN 'Chiare' THEN 75
          WHEN 'Sufficienti' THEN 50
          WHEN 'Poco chiare' THEN 25
          WHEN 'Scarse' THEN 0
          ELSE NULL
        END,
      'voto_alloggio',
        CASE sl.alloggio
          WHEN 'Molto soddisfatte' THEN 100
          WHEN 'Soddisfatte' THEN 75
          WHEN 'Sufficiente' THEN 50
          WHEN 'Insufficiente' THEN 25
          WHEN 'Insoddisfatto' THEN 0
          ELSE NULL
        END,
      'voto_bagno',
        CASE sl.bagno
          WHEN 'Molto soddisfatte' THEN 100
          WHEN 'Soddisfatte' THEN 75
          WHEN 'Sufficiente' THEN 50
          WHEN 'Insufficiente' THEN 25
          WHEN 'Insoddisfatto' THEN 0
          WHEN 'Non soddisfatte' THEN 0
          ELSE NULL
        END,
      'voto_spazio_esterno',
        CASE sl.spazio_eterno
          WHEN 'Molto soddisfatte' THEN 100
          WHEN 'Soddisfatte' THEN 75
          WHEN 'Sufficiente' THEN 50
          WHEN 'Insufficiente' THEN 25
          WHEN 'Insoddisfatto' THEN 0
          WHEN 'Non soddisfatte' THEN 0
          ELSE NULL
        END,
      'voto_assistenza',
        CASE sl.personale_assistenza
          WHEN 'Molto soddisfatte' THEN 100
          WHEN 'Soddisfatte' THEN 75
          WHEN 'Sufficiente' THEN 50
          WHEN 'Insufficiente' THEN 25
          WHEN 'Insoddisfatto' THEN 0
          WHEN 'Non soddisfatte' THEN 0
          ELSE NULL
        END,
      'voto_animazione',
        CASE sl.animazione
          WHEN 'Molto soddisfatte' THEN 100
          WHEN 'Soddisfatte' THEN 75
          WHEN 'Sufficiente' THEN 50
          WHEN 'Insufficiente' THEN 25
          WHEN 'Insoddisfatto' THEN 0
          WHEN 'Non soddisfatte' THEN 0
          ELSE NULL
        END,
      'voto_pulizie',
        CASE sl.personale_pulizie
          WHEN 'Molto soddisfatte' THEN 100
          WHEN 'Soddisfatte' THEN 75
          WHEN 'Sufficiente' THEN 50
          WHEN 'Insufficiente' THEN 25
          WHEN 'Insoddisfatto' THEN 0
          WHEN 'Non soddisfatte' THEN 0
          ELSE NULL
        END,
      'soddisfazione_pulizia',
        CASE sl.soddisfazione_pulizia
          WHEN 'Molto soddisfatte' THEN 100
          WHEN 'Molto soddisfatto' THEN 100
          WHEN 'Soddisfatte' THEN 75
          WHEN 'Soddisfatto' THEN 75
          WHEN 'Sufficiente' THEN 50
          WHEN 'Insufficiente' THEN 25
          WHEN 'Insoddisfatto' THEN 0
          WHEN 'Scarso' THEN 0
          ELSE NULL
        END,
      'voto_ristorazione_qualita',
        CASE sl.qualita_cibo
          WHEN 'Molto soddisfatte' THEN 100
          WHEN 'Soddisfatte' THEN 75
          WHEN 'Sufficiente' THEN 50
          WHEN 'Insufficiente' THEN 25
          WHEN 'Insoddisfatto' THEN 0
          WHEN 'Non soddisfatte' THEN 0
          ELSE NULL
        END,
      'soddisfazione_tempo',
        CASE sl.soddisfazione_personale
          WHEN 'Molto soddisfatto' THEN 100
          WHEN 'Soddisfatto' THEN 75
          WHEN 'Sufficiente' THEN 50
          WHEN 'Poco soddisfatto' THEN 25
          WHEN 'Insufficiente' THEN 25
          WHEN 'Insoddisfatto' THEN 0
          WHEN 'Scarso' THEN 0
          ELSE NULL
        END,
      'nps_consiglio',
        CASE sl.consiglio_struttura
          WHEN 'Certamente' THEN 100
          WHEN 'Si' THEN 80
          WHEN 'Sì' THEN 80
          WHEN 'Gliene parlo' THEN 60
          WHEN 'Forse' THEN 40
          WHEN 'Probabilmente no' THEN 20
          WHEN 'No' THEN 0
          ELSE NULL
        END
    )) AS riga_json,
    sl.created_at,
    'survey_seniorliving' AS source_table,
    'client' AS survey_type
  FROM survey_seniorliving sl
  WHERE EXISTS (SELECT 1 FROM survey_facility_mapping sfm WHERE sfm.nome_survey = sl.struttura::text)
    AND NOT EXISTS (
      SELECT 1 FROM survey_duplicati sd
      WHERE sd.tabella_origine = 'survey_seniorliving'
        AND sd.riga_id = sl.id
        AND sd.stato = 'eliminato'
    )
),
rsa_righe AS (
  SELECT
    r_1.id AS riga_id,
    r_1.struttura AS nome_survey_originale,
    to_char(r_1.created_at, 'YYYY-MM') AS calendar_id,
    EXTRACT(year FROM r_1.created_at)::integer AS year,
    jsonb_strip_nulls(jsonb_build_object(
      'soddisfazione_generale', CASE WHEN r_1.soddisfazione_complessiva IS NOT NULL THEN (r_1.soddisfazione_complessiva * 10::numeric)::integer ELSE NULL::integer END,
      'info_ingresso', CASE WHEN r_1.accoglienze_reception IS NOT NULL THEN (r_1.accoglienze_reception * 10::numeric)::integer ELSE NULL::integer END,
      'voto_assistenza', CASE WHEN r_1.personale_accoglienza IS NOT NULL THEN (r_1.personale_accoglienza * 10::numeric)::integer ELSE NULL::integer END,
      'rispetto_dignita', CASE WHEN r_1.riservatezza_personale IS NOT NULL THEN (r_1.riservatezza_personale * 10::numeric)::integer ELSE NULL::integer END,
      'soddisfazione_pulizia', CASE WHEN r_1.igiene IS NOT NULL THEN (r_1.igiene * 10::numeric)::integer ELSE NULL::integer END,
      'voto_animazione', CASE WHEN r_1.animazione IS NOT NULL THEN (r_1.animazione * 10::numeric)::integer ELSE NULL::integer END,
      'soddisfazione_servizi', CASE WHEN r_1.servizi IS NOT NULL THEN (r_1.servizi * 10::numeric)::integer ELSE NULL::integer END,
      'fisioterapia', CASE WHEN r_1.fisioterapia IS NOT NULL THEN (r_1.fisioterapia * 10::numeric)::integer ELSE NULL::integer END,
      'voto_ristorazione_qualita', CASE WHEN r_1.qualita_pasto IS NOT NULL THEN (r_1.qualita_pasto * 10::numeric)::integer ELSE NULL::integer END,
      'voto_alloggio', CASE WHEN r_1.ambienti IS NOT NULL THEN (r_1.ambienti * 10::numeric)::integer ELSE NULL::integer END,
      'soddisfazione_tempo', CASE WHEN r_1.soddisfazione_personale IS NOT NULL THEN (r_1.soddisfazione_personale * 10::numeric)::integer ELSE NULL::integer END,
      'assistenza_medica', CASE WHEN r_1.assistenza_medica IS NOT NULL THEN (r_1.assistenza_medica * 10::numeric)::integer ELSE NULL::integer END,
      'assistenza_notturna', CASE WHEN r_1.assistenza_infermieristica IS NOT NULL THEN (r_1.assistenza_infermieristica * 10::numeric)::integer ELSE NULL::integer END,
      'nps_consiglio', CASE WHEN r_1.consiglio_struttura IS NOT NULL THEN (r_1.consiglio_struttura * 10::numeric)::integer ELSE NULL::integer END
    )) AS riga_json,
    r_1.created_at,
    'survey_rsa' AS source_table,
    'client' AS survey_type
  FROM survey_rsa r_1
  WHERE EXISTS (SELECT 1 FROM survey_facility_mapping sfm WHERE sfm.nome_survey = r_1.struttura::text)
    AND NOT EXISTS (
      SELECT 1 FROM survey_duplicati sd
      WHERE sd.tabella_origine = 'survey_rsa'
        AND sd.riga_id = r_1.id
        AND sd.stato = 'eliminato'
    )
),
dis_righe AS (
  SELECT
    d.id AS riga_id,
    d.struttura AS nome_survey_originale,
    to_char(d.created_at, 'YYYY-MM') AS calendar_id,
    EXTRACT(year FROM d.created_at)::integer AS year,
    jsonb_strip_nulls(jsonb_build_object(
      'soddisfazione_generale', CASE WHEN d.soddisfazione_servizi IS NOT NULL THEN (d.soddisfazione_servizi * 10::numeric)::integer ELSE NULL::integer END,
      'info_cura', CASE WHEN d.progetto_cura IS NOT NULL THEN (d.progetto_cura * 10::numeric)::integer ELSE NULL::integer END,
      'ascolto', CASE WHEN d.soddisfazione_ascolto IS NOT NULL THEN (d.soddisfazione_ascolto * 10::numeric)::integer ELSE NULL::integer END,
      'contatto_struttura', CASE WHEN d.contatto_struttura IS NOT NULL THEN (d.contatto_struttura * 10::numeric)::integer ELSE NULL::integer END,
      'relazione_equipe', CASE WHEN d.equipe_sanitaria IS NOT NULL THEN (d.equipe_sanitaria * 10::numeric)::integer ELSE NULL::integer END,
      'voto_alloggio', CASE WHEN d.locali IS NOT NULL THEN (d.locali * 10::numeric)::integer ELSE NULL::integer END,
      'soddisfazione_pulizia', CASE WHEN d.pulizia_manutenzione IS NOT NULL THEN (d.pulizia_manutenzione * 10::numeric)::integer ELSE NULL::integer END,
      'voto_animazione', CASE WHEN d.attivita_proposte IS NOT NULL THEN (d.attivita_proposte * 10::numeric)::integer ELSE NULL::integer END,
      'cura_bisogni', CASE WHEN d.bisogni_necessita IS NOT NULL THEN (d.bisogni_necessita * 10::numeric)::integer ELSE NULL::integer END,
      'nps_consiglio', CASE WHEN d.consiglio_struttura IS NOT NULL THEN (d.consiglio_struttura * 10::numeric)::integer ELSE NULL::integer END
    )) AS riga_json,
    d.created_at,
    'survey_centri_disabilita' AS source_table,
    'client' AS survey_type
  FROM survey_centri_disabilita d
  WHERE EXISTS (SELECT 1 FROM survey_facility_mapping sfm WHERE sfm.nome_survey = d.struttura::text)
    AND NOT EXISTS (
      SELECT 1 FROM survey_duplicati sd
      WHERE sd.tabella_origine = 'survey_centri_disabilita'
        AND sd.riga_id = d.id
        AND sd.stato = 'eliminato'
    )
),
psi_righe AS (
  SELECT
    p.id AS riga_id,
    p.struttura AS nome_survey_originale,
    to_char(p.created_at, 'YYYY-MM') AS calendar_id,
    EXTRACT(year FROM p.created_at)::integer AS year,
    jsonb_strip_nulls(jsonb_build_object(
      'soddisfazione_generale', CASE p.servizi WHEN 'Molto soddisfatto' THEN 100 WHEN 'Soddisfatto' THEN 80 WHEN 'Abbastanza soddisfatto' THEN 60 WHEN 'Sufficiente' THEN 60 WHEN 'Poco soddisfatto' THEN 40 WHEN 'Insoddisfatto' THEN 20 ELSE NULL END,
      'info_ingresso', CASE p.soddisfazione_accoglienza WHEN 'Molto soddisfatto' THEN 100 WHEN 'Soddisfatto' THEN 80 WHEN 'Abbastanza soddisfatto' THEN 60 WHEN 'Sufficiente' THEN 60 WHEN 'Poco soddisfatto' THEN 40 WHEN 'Insoddisfatto' THEN 20 ELSE NULL END,
      'appagamento_vita', CASE p.appagamento_vita_quotidiana WHEN 'Molto soddisfatto' THEN 100 WHEN 'Soddisfatto' THEN 80 WHEN 'Abbastanza soddisfatto' THEN 60 WHEN 'Sufficiente' THEN 60 WHEN 'Poco soddisfatto' THEN 40 WHEN 'Insoddisfatto' THEN 20 ELSE NULL END,
      'info_cura', CASE p.spiegazioni_stato_salute WHEN 'Molto soddisfatto' THEN 100 WHEN 'Soddisfatto' THEN 80 WHEN 'Abbastanza soddisfatto' THEN 60 WHEN 'Sufficiente' THEN 60 WHEN 'Poco soddisfatto' THEN 40 WHEN 'Insoddisfatto' THEN 20 ELSE NULL END,
      'assistenza_diurna', CASE p.assistenza_diurna WHEN 'Molto soddisfatto' THEN 100 WHEN 'Soddisfatto' THEN 80 WHEN 'Abbastanza soddisfatto' THEN 60 WHEN 'Sufficiente' THEN 60 WHEN 'Poco soddisfatto' THEN 40 WHEN 'Insoddisfatto' THEN 20 ELSE NULL END,
      'assistenza_notturna', CASE p.assistenza_notturna WHEN 'Molto soddisfatto' THEN 100 WHEN 'Soddisfatto' THEN 80 WHEN 'Abbastanza soddisfatto' THEN 60 WHEN 'Sufficiente' THEN 60 WHEN 'Poco soddisfatto' THEN 40 WHEN 'Insoddisfatto' THEN 20 ELSE NULL END,
      'rispetto_dignita', CASE p.dignita_intimita WHEN 'Molto soddisfatto' THEN 100 WHEN 'Soddisfatto' THEN 80 WHEN 'Abbastanza soddisfatto' THEN 60 WHEN 'Sufficiente' THEN 60 WHEN 'Poco soddisfatto' THEN 40 WHEN 'Insoddisfatto' THEN 20 ELSE NULL END,
      'coinvolgimento_cure', CASE p.decisioni_salute WHEN 'Molto soddisfatto' THEN 100 WHEN 'Soddisfatto' THEN 80 WHEN 'Abbastanza soddisfatto' THEN 60 WHEN 'Sufficiente' THEN 60 WHEN 'Poco soddisfatto' THEN 40 WHEN 'Insoddisfatto' THEN 20 ELSE NULL END,
      'voto_animazione', CASE p.attivita_proposte WHEN 'Molto soddisfatto' THEN 100 WHEN 'Soddisfatto' THEN 80 WHEN 'Abbastanza soddisfatto' THEN 60 WHEN 'Sufficiente' THEN 60 WHEN 'Poco soddisfatto' THEN 40 WHEN 'Insoddisfatto' THEN 20 ELSE NULL END,
      'voto_alloggio', CASE p.comfort_abitazione WHEN 'Molto soddisfatto' THEN 100 WHEN 'Soddisfatto' THEN 80 WHEN 'Abbastanza soddisfatto' THEN 60 WHEN 'Sufficiente' THEN 60 WHEN 'Poco soddisfatto' THEN 40 WHEN 'Insoddisfatto' THEN 20 ELSE NULL END,
      'voto_spazio_esterno', CASE p.ambienti WHEN 'Molto soddisfatto' THEN 100 WHEN 'Soddisfatto' THEN 80 WHEN 'Abbastanza soddisfatto' THEN 60 WHEN 'Sufficiente' THEN 60 WHEN 'Poco soddisfatto' THEN 40 WHEN 'Insoddisfatto' THEN 20 ELSE NULL END,
      'soddisfazione_pulizia', CASE p.pulizia WHEN 'Molto soddisfatto' THEN 100 WHEN 'Soddisfatto' THEN 80 WHEN 'Abbastanza soddisfatto' THEN 60 WHEN 'Sufficiente' THEN 60 WHEN 'Poco soddisfatto' THEN 40 WHEN 'Insoddisfatto' THEN 20 ELSE NULL END,
      'voto_ristorazione_qualita', CASE p.servizio_ristorazione WHEN 'Molto soddisfatto' THEN 100 WHEN 'Soddisfatto' THEN 80 WHEN 'Abbastanza soddisfatto' THEN 60 WHEN 'Sufficiente' THEN 60 WHEN 'Poco soddisfatto' THEN 40 WHEN 'Insoddisfatto' THEN 20 ELSE NULL END
    )) AS riga_json,
    p.created_at,
    'survey_centri_psichiatria' AS source_table,
    'client' AS survey_type
  FROM survey_centri_psichiatria p
  WHERE EXISTS (SELECT 1 FROM survey_facility_mapping sfm WHERE sfm.nome_survey = p.struttura::text)
    AND NOT EXISTS (
      SELECT 1 FROM survey_duplicati sd
      WHERE sd.tabella_origine = 'survey_centri_psichiatria'
        AND sd.riga_id = p.id
        AND sd.stato = 'eliminato'
    )
),
per_righe AS (
  SELECT
    pp.id AS riga_id,
    pp.struttura AS nome_survey_originale,
    to_char(pp.created_at, 'YYYY-MM') AS calendar_id,
    EXTRACT(year FROM pp.created_at)::integer AS year,
    jsonb_strip_nulls(jsonb_build_object(
      'soddisfazione_generale', CASE WHEN pp.soddisfazione_struttura_centro::text ~ '^[0-9]+(\.[0-9]+)?$' THEN (pp.soddisfazione_struttura_centro::numeric * 10::numeric)::integer ELSE NULL::integer END,
      'sicurezza_ambiente', CASE WHEN pp.ambiente_lavoro::text ~ '^[0-9]+(\.[0-9]+)?$' THEN (pp.ambiente_lavoro::numeric * 10::numeric)::integer ELSE NULL::integer END,
      'riconoscimento', CASE WHEN pp.riconoscimento_lavoro::text ~ '^[0-9]+(\.[0-9]+)?$' THEN (pp.riconoscimento_lavoro::numeric * 10::numeric)::integer ELSE NULL::integer END,
      'supporto_leadership', CASE WHEN pp.supporto_responsabile::text ~ '^[0-9]+(\.[0-9]+)?$' THEN (pp.supporto_responsabile::numeric * 10::numeric)::integer ELSE NULL::integer END,
      'etica_assistenza', CASE WHEN pp.trattamento_ospiti::text ~ '^[0-9]+(\.[0-9]+)?$' THEN (pp.trattamento_ospiti::numeric * 10::numeric)::integer ELSE NULL::integer END,
      'chiarezza_ruolo', CASE WHEN pp.responsabilita_ruolo::text ~ '^[0-9]+(\.[0-9]+)?$' THEN (pp.responsabilita_ruolo::numeric * 10::numeric)::integer ELSE NULL::integer END,
      'qualita_tecnica', CASE WHEN pp.cure_ospiti::text ~ '^[0-9]+(\.[0-9]+)?$' THEN (pp.cure_ospiti::numeric * 10::numeric)::integer ELSE NULL::integer END,
      'reputazione_lavoro', CASE
        WHEN pp.consiglio_struttura_lavoro::text = 'Non so' THEN NULL::integer
        WHEN pp.consiglio_struttura_lavoro::text ~ '^[0-9]+(\.[0-9]+)?$' THEN (pp.consiglio_struttura_lavoro::numeric * 10::numeric)::integer
        ELSE NULL::integer
      END,
      'reputazione_servizio', CASE
        WHEN pp.consiglio_struttura_assistenza::text = 'Non so' THEN NULL::integer
        WHEN pp.consiglio_struttura_assistenza::text ~ '^[0-9]+(\.[0-9]+)?$' THEN (pp.consiglio_struttura_assistenza::numeric * 10::numeric)::integer
        ELSE NULL::integer
      END
    )) AS riga_json,
    pp.created_at,
    'survey_personale' AS source_table,
    'operator' AS survey_type
  FROM survey_personale pp
  WHERE EXISTS (SELECT 1 FROM survey_facility_mapping sfm WHERE sfm.nome_survey = pp.struttura::text)
    AND NOT EXISTS (
      SELECT 1 FROM survey_duplicati sd
      WHERE sd.tabella_origine = 'survey_personale'
        AND sd.riga_id = pp.id
        AND sd.stato = 'eliminato'
    )
),
tutte AS (
  SELECT riga_id, nome_survey_originale, calendar_id, year, riga_json, created_at, source_table, survey_type FROM sl_righe
  UNION ALL
  SELECT riga_id, nome_survey_originale, calendar_id, year, riga_json, created_at, source_table, survey_type FROM rsa_righe
  UNION ALL
  SELECT riga_id, nome_survey_originale, calendar_id, year, riga_json, created_at, source_table, survey_type FROM dis_righe
  UNION ALL
  SELECT riga_id, nome_survey_originale, calendar_id, year, riga_json, created_at, source_table, survey_type FROM psi_righe
  UNION ALL
  SELECT riga_id, nome_survey_originale, calendar_id, year, riga_json, created_at, source_table, survey_type FROM per_righe
),
conteggi_reali AS (
  SELECT nome_survey_originale, calendar_id, source_table, count(DISTINCT riga_id) AS risposte_reali
  FROM tutte
  GROUP BY nome_survey_originale, calendar_id, source_table
),
aggregati AS (
  SELECT
    t.nome_survey_originale,
    t.calendar_id,
    t.year,
    t.source_table,
    t.survey_type,
    jsonb_agg(t.riga_json ORDER BY t.created_at) AS responses_json,
    max(cr.risposte_reali) AS total_responses,
    min(t.created_at) AS created_at
  FROM tutte t
  JOIN conteggi_reali cr
    ON cr.nome_survey_originale::text = t.nome_survey_originale::text
   AND cr.calendar_id = t.calendar_id
   AND cr.source_table = t.source_table
  GROUP BY t.nome_survey_originale, t.calendar_id, t.year, t.source_table, t.survey_type
)
SELECT
  gen_random_uuid() AS id,
  tgt.facility_id,
  tgt.company_id,
  a.survey_type AS type,
  a.year,
  a.calendar_id,
  a.responses_json,
  jsonb_build_object(
    'total_responses', a.total_responses,
    'source', a.source_table,
    'is_company_wide', tgt.company_id IS NOT NULL,
    'nome_survey', a.nome_survey_originale
  ) AS summary_stats,
  r.ai_report_ospiti,
  r.ai_report_direzione,
  a.created_at
FROM aggregati a
CROSS JOIN LATERAL resolve_survey_target(a.nome_survey_originale::text) tgt
LEFT JOIN survey_ai_reports r
  ON r.facility_id = tgt.facility_id
 AND r.calendar_id = a.calendar_id
 AND r.source_table = a.source_table;

-- DROP VIEW cancella eventuali GRANT precedenti sulla vista — ripristinati esplicitamente.
GRANT SELECT ON v_survey_data_normalized TO authenticated;
