-- Fix mapping CASE testuali per survey_seniorliving in v_survey_data_normalized e v_survey_campagne.
-- Motivo: confronto tra le opzioni previste nei CASE e i valori DISTINCT realmente
-- presenti nelle 5 tabelle raw ha rilevato che diverse colonne di survey_seniorliving
-- usano diciture diverse da quelle attese, causando NULL silenziosi (fino al 90% delle
-- righe su soddisfazione_pulizia, 100% su informazioni_prenotazione/informazioni_ingresso).
-- Le altre 3 tabelle raw (survey_rsa, survey_personale) sono state verificate e NON
-- necessitano modifiche.
--
-- Valori confermati (nessuna altra domanda necessaria):
--  - soddisfazione_complessiva:            + Insufficiente=25, Scarso=0
--  - informazioni_prenotazione/ingresso:   scala sostituita con quella reale del form
--                                           (Molto chiare e dettagliate=100, Chiare=75,
--                                            Sufficienti=50, Poco chiare=25, Scarse=0)
--  - bagno/spazio_eterno/personale_assistenza/animazione/personale_pulizie/qualita_cibo:
--                                           + Non soddisfatte=0
--  - soddisfazione_pulizia:                + forme maschili Soddisfatto=75,
--                                           Molto soddisfatto=100, Scarso=0
--                                           (mantenute anche le forme femminili esistenti)
--  - soddisfazione_personale (soddisfazione_tempo): + Insufficiente=25, Scarso=0
--  - consiglio_struttura (nps_consiglio):  scala ricostruita a 6 livelli
--                                           Certamente=100, Si/Sì=80, Gliene parlo=60,
--                                           Forse=40, Probabilmente no=20, No=0
--
-- survey_centri_psichiatria: le 13 domande a scelta testuale usano nel form l'etichetta
-- "Sufficiente" e non "Abbastanza soddisfatto" come previsto dal CASE originale, causando
-- NULL silenziosi tra l'8% e il 20% delle risposte su ciascuna domanda (342 risposte perse
-- in totale nel campione verificato). Aggiunto WHEN 'Sufficiente' THEN 60 accanto a
-- WHEN 'Abbastanza soddisfatto' THEN 60 in tutti e 13 i rami, in entrambe le viste
-- (mantenuto anche il ramo 'Abbastanza soddisfatto' nel caso comparisse in futuro).
--
-- survey_centri_disabilita: rimossa la chiave voto_assistenza (fonte: risposte_cura_assistenza).
-- Verificato su tutte le righe non-NULL della colonna (21/21): sono tutte testo libero
-- (motivazioni a supporto di un'altra domanda), zero valori numerici validi. La domanda
-- non è mai stata raccolta come voto in questa tabella, quindi la chiave va tolta invece
-- di continuare a produrre un NULL costante.

CREATE OR REPLACE VIEW v_survey_data_normalized AS
WITH sl_righe AS (
  SELECT
    sfm.facility_id,
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
  LEFT JOIN survey_facility_mapping sfm ON sfm.nome_survey = sl.struttura::text
  WHERE sfm.facility_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM survey_duplicati sd
      WHERE sd.tabella_origine = 'survey_seniorliving'
        AND sd.riga_id = sl.id
        AND sd.stato = 'eliminato'
    )
),
rsa_righe AS (
  SELECT
    sfm.facility_id,
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
  LEFT JOIN survey_facility_mapping sfm ON sfm.nome_survey = r_1.struttura::text
  WHERE sfm.facility_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM survey_duplicati sd
      WHERE sd.tabella_origine = 'survey_rsa'
        AND sd.riga_id = r_1.id
        AND sd.stato = 'eliminato'
    )
),
dis_righe AS (
  SELECT
    sfm.facility_id,
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
  LEFT JOIN survey_facility_mapping sfm ON sfm.nome_survey = d.struttura::text
  WHERE sfm.facility_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM survey_duplicati sd
      WHERE sd.tabella_origine = 'survey_centri_disabilita'
        AND sd.riga_id = d.id
        AND sd.stato = 'eliminato'
    )
),
psi_righe AS (
  SELECT
    sfm.facility_id,
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
  LEFT JOIN survey_facility_mapping sfm ON sfm.nome_survey = p.struttura::text
  WHERE sfm.facility_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM survey_duplicati sd
      WHERE sd.tabella_origine = 'survey_centri_psichiatria'
        AND sd.riga_id = p.id
        AND sd.stato = 'eliminato'
    )
),
per_righe AS (
  SELECT
    sfm.facility_id,
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
  LEFT JOIN survey_facility_mapping sfm ON sfm.nome_survey = pp.struttura::text
  WHERE sfm.facility_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM survey_duplicati sd
      WHERE sd.tabella_origine = 'survey_personale'
        AND sd.riga_id = pp.id
        AND sd.stato = 'eliminato'
    )
),
tutte AS (
  SELECT facility_id, riga_id, nome_survey_originale, calendar_id, year, riga_json, created_at, source_table, survey_type FROM sl_righe
  UNION ALL
  SELECT facility_id, riga_id, nome_survey_originale, calendar_id, year, riga_json, created_at, source_table, survey_type FROM rsa_righe
  UNION ALL
  SELECT facility_id, riga_id, nome_survey_originale, calendar_id, year, riga_json, created_at, source_table, survey_type FROM dis_righe
  UNION ALL
  SELECT facility_id, riga_id, nome_survey_originale, calendar_id, year, riga_json, created_at, source_table, survey_type FROM psi_righe
  UNION ALL
  SELECT facility_id, riga_id, nome_survey_originale, calendar_id, year, riga_json, created_at, source_table, survey_type FROM per_righe
),
conteggi_reali AS (
  SELECT nome_survey_originale, calendar_id, source_table, count(DISTINCT riga_id) AS risposte_reali
  FROM tutte
  GROUP BY nome_survey_originale, calendar_id, source_table
),
facility_per_survey AS (
  SELECT nome_survey, count(*) AS n_facility
  FROM survey_facility_mapping
  GROUP BY nome_survey
),
aggregati AS (
  SELECT
    t.facility_id,
    t.calendar_id,
    t.year,
    t.source_table,
    t.survey_type,
    min(t.nome_survey_originale::text) AS nome_survey_originale,
    max(fps.n_facility) > 1 AS is_company_wide,
    jsonb_agg(t.riga_json ORDER BY t.created_at) AS responses_json,
    max(cr.risposte_reali) AS total_responses,
    min(t.created_at) AS created_at
  FROM tutte t
  JOIN conteggi_reali cr
    ON cr.nome_survey_originale::text = t.nome_survey_originale::text
   AND cr.calendar_id = t.calendar_id
   AND cr.source_table = t.source_table
  JOIN facility_per_survey fps ON fps.nome_survey = t.nome_survey_originale::text
  GROUP BY t.facility_id, t.calendar_id, t.year, t.source_table, t.survey_type
)
SELECT
  gen_random_uuid() AS id,
  a.facility_id,
  NULL::uuid AS company_id,
  a.survey_type AS type,
  a.year,
  a.calendar_id,
  a.responses_json,
  jsonb_build_object(
    'total_responses', a.total_responses,
    'source', a.source_table,
    'is_company_wide', a.is_company_wide,
    'nome_survey', a.nome_survey_originale
  ) AS summary_stats,
  r.ai_report_ospiti,
  r.ai_report_direzione,
  a.created_at
FROM aggregati a
LEFT JOIN survey_ai_reports r
  ON r.facility_id = a.facility_id
 AND r.calendar_id = a.calendar_id
 AND r.source_table = a.source_table;


CREATE OR REPLACE VIEW v_survey_campagne AS
WITH raw_righe AS (
  SELECT
    sr.struttura,
    sr.created_at,
    'client'::text AS survey_type,
    jsonb_strip_nulls(jsonb_build_object(
      'soddisfazione_generale', CASE WHEN sr.soddisfazione_complessiva IS NOT NULL THEN (sr.soddisfazione_complessiva * 10::numeric)::integer ELSE NULL::integer END,
      'info_ingresso', CASE WHEN sr.accoglienze_reception IS NOT NULL THEN (sr.accoglienze_reception * 10::numeric)::integer ELSE NULL::integer END,
      'voto_assistenza', CASE WHEN sr.personale_accoglienza IS NOT NULL THEN (sr.personale_accoglienza * 10::numeric)::integer ELSE NULL::integer END,
      'rispetto_dignita', CASE WHEN sr.riservatezza_personale IS NOT NULL THEN (sr.riservatezza_personale * 10::numeric)::integer ELSE NULL::integer END,
      'soddisfazione_pulizia', CASE WHEN sr.igiene IS NOT NULL THEN (sr.igiene * 10::numeric)::integer ELSE NULL::integer END,
      'voto_animazione', CASE WHEN sr.animazione IS NOT NULL THEN (sr.animazione * 10::numeric)::integer ELSE NULL::integer END,
      'soddisfazione_servizi', CASE WHEN sr.servizi IS NOT NULL THEN (sr.servizi * 10::numeric)::integer ELSE NULL::integer END,
      'fisioterapia', CASE WHEN sr.fisioterapia IS NOT NULL THEN (sr.fisioterapia * 10::numeric)::integer ELSE NULL::integer END,
      'voto_ristorazione_qualita', CASE WHEN sr.qualita_pasto IS NOT NULL THEN (sr.qualita_pasto * 10::numeric)::integer ELSE NULL::integer END,
      'voto_alloggio', CASE WHEN sr.ambienti IS NOT NULL THEN (sr.ambienti * 10::numeric)::integer ELSE NULL::integer END,
      'soddisfazione_tempo', CASE WHEN sr.soddisfazione_personale IS NOT NULL THEN (sr.soddisfazione_personale * 10::numeric)::integer ELSE NULL::integer END,
      'assistenza_medica', CASE WHEN sr.assistenza_medica IS NOT NULL THEN (sr.assistenza_medica * 10::numeric)::integer ELSE NULL::integer END,
      'assistenza_notturna', CASE WHEN sr.assistenza_infermieristica IS NOT NULL THEN (sr.assistenza_infermieristica * 10::numeric)::integer ELSE NULL::integer END,
      'nps_consiglio', CASE WHEN sr.consiglio_struttura IS NOT NULL THEN (sr.consiglio_struttura * 10::numeric)::integer ELSE NULL::integer END
    )) AS riga_json
  FROM survey_rsa sr
  WHERE NOT EXISTS (
    SELECT 1 FROM survey_duplicati sd
    WHERE sd.tabella_origine = 'survey_rsa' AND sd.riga_id = sr.id AND sd.stato = 'eliminato'
  )

  UNION ALL

  SELECT
    sl.struttura,
    sl.created_at,
    'client'::text AS survey_type,
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
        END
    )) AS riga_json
  FROM survey_seniorliving sl
  WHERE NOT EXISTS (
    SELECT 1 FROM survey_duplicati sd
    WHERE sd.tabella_origine = 'survey_seniorliving' AND sd.riga_id = sl.id AND sd.stato = 'eliminato'
  )

  UNION ALL

  SELECT
    d.struttura,
    d.created_at,
    'client'::text AS survey_type,
    jsonb_strip_nulls(jsonb_build_object(
      'soddisfazione_generale', CASE WHEN d.soddisfazione_servizi IS NOT NULL THEN (d.soddisfazione_servizi * 10::numeric)::integer ELSE NULL::integer END,
      'nps_consiglio', CASE WHEN d.consiglio_struttura IS NOT NULL THEN (d.consiglio_struttura * 10::numeric)::integer ELSE NULL::integer END,
      'voto_animazione', CASE WHEN d.attivita_proposte IS NOT NULL THEN (d.attivita_proposte * 10::numeric)::integer ELSE NULL::integer END,
      'voto_alloggio', CASE WHEN d.locali IS NOT NULL THEN (d.locali * 10::numeric)::integer ELSE NULL::integer END,
      'soddisfazione_pulizia', CASE WHEN d.pulizia_manutenzione IS NOT NULL THEN (d.pulizia_manutenzione * 10::numeric)::integer ELSE NULL::integer END,
      'info_cura', CASE WHEN d.progetto_cura IS NOT NULL THEN (d.progetto_cura * 10::numeric)::integer ELSE NULL::integer END,
      'ascolto', CASE WHEN d.soddisfazione_ascolto IS NOT NULL THEN (d.soddisfazione_ascolto * 10::numeric)::integer ELSE NULL::integer END,
      'contatto_struttura', CASE WHEN d.contatto_struttura IS NOT NULL THEN (d.contatto_struttura * 10::numeric)::integer ELSE NULL::integer END,
      'relazione_equipe', CASE WHEN d.equipe_sanitaria IS NOT NULL THEN (d.equipe_sanitaria * 10::numeric)::integer ELSE NULL::integer END,
      'cura_bisogni', CASE WHEN d.bisogni_necessita IS NOT NULL THEN (d.bisogni_necessita * 10::numeric)::integer ELSE NULL::integer END
    )) AS riga_json
  FROM survey_centri_disabilita d
  WHERE NOT EXISTS (
    SELECT 1 FROM survey_duplicati sd
    WHERE sd.tabella_origine = 'survey_centri_disabilita' AND sd.riga_id = d.id AND sd.stato = 'eliminato'
  )

  UNION ALL

  SELECT
    p.struttura,
    p.created_at,
    'client'::text AS survey_type,
    jsonb_strip_nulls(jsonb_build_object(
      'soddisfazione_generale', CASE p.servizi WHEN 'Molto soddisfatto' THEN 100 WHEN 'Soddisfatto' THEN 80 WHEN 'Abbastanza soddisfatto' THEN 60 WHEN 'Sufficiente' THEN 60 WHEN 'Poco soddisfatto' THEN 40 WHEN 'Insoddisfatto' THEN 20 ELSE NULL END,
      'info_ingresso', CASE p.soddisfazione_accoglienza WHEN 'Molto soddisfatto' THEN 100 WHEN 'Soddisfatto' THEN 80 WHEN 'Abbastanza soddisfatto' THEN 60 WHEN 'Sufficiente' THEN 60 WHEN 'Poco soddisfatto' THEN 40 WHEN 'Insoddisfatto' THEN 20 ELSE NULL END,
      'voto_animazione', CASE p.attivita_proposte WHEN 'Molto soddisfatto' THEN 100 WHEN 'Soddisfatto' THEN 80 WHEN 'Abbastanza soddisfatto' THEN 60 WHEN 'Sufficiente' THEN 60 WHEN 'Poco soddisfatto' THEN 40 WHEN 'Insoddisfatto' THEN 20 ELSE NULL END,
      'voto_alloggio', CASE p.comfort_abitazione WHEN 'Molto soddisfatto' THEN 100 WHEN 'Soddisfatto' THEN 80 WHEN 'Abbastanza soddisfatto' THEN 60 WHEN 'Sufficiente' THEN 60 WHEN 'Poco soddisfatto' THEN 40 WHEN 'Insoddisfatto' THEN 20 ELSE NULL END,
      'soddisfazione_pulizia', CASE p.pulizia WHEN 'Molto soddisfatto' THEN 100 WHEN 'Soddisfatto' THEN 80 WHEN 'Abbastanza soddisfatto' THEN 60 WHEN 'Sufficiente' THEN 60 WHEN 'Poco soddisfatto' THEN 40 WHEN 'Insoddisfatto' THEN 20 ELSE NULL END,
      'voto_ristorazione_qualita', CASE p.servizio_ristorazione WHEN 'Molto soddisfatto' THEN 100 WHEN 'Soddisfatto' THEN 80 WHEN 'Abbastanza soddisfatto' THEN 60 WHEN 'Sufficiente' THEN 60 WHEN 'Poco soddisfatto' THEN 40 WHEN 'Insoddisfatto' THEN 20 ELSE NULL END,
      'assistenza_diurna', CASE p.assistenza_diurna WHEN 'Molto soddisfatto' THEN 100 WHEN 'Soddisfatto' THEN 80 WHEN 'Abbastanza soddisfatto' THEN 60 WHEN 'Sufficiente' THEN 60 WHEN 'Poco soddisfatto' THEN 40 WHEN 'Insoddisfatto' THEN 20 ELSE NULL END,
      'assistenza_notturna', CASE p.assistenza_notturna WHEN 'Molto soddisfatto' THEN 100 WHEN 'Soddisfatto' THEN 80 WHEN 'Abbastanza soddisfatto' THEN 60 WHEN 'Sufficiente' THEN 60 WHEN 'Poco soddisfatto' THEN 40 WHEN 'Insoddisfatto' THEN 20 ELSE NULL END,
      'rispetto_dignita', CASE p.dignita_intimita WHEN 'Molto soddisfatto' THEN 100 WHEN 'Soddisfatto' THEN 80 WHEN 'Abbastanza soddisfatto' THEN 60 WHEN 'Sufficiente' THEN 60 WHEN 'Poco soddisfatto' THEN 40 WHEN 'Insoddisfatto' THEN 20 ELSE NULL END,
      'coinvolgimento_cure', CASE p.decisioni_salute WHEN 'Molto soddisfatto' THEN 100 WHEN 'Soddisfatto' THEN 80 WHEN 'Abbastanza soddisfatto' THEN 60 WHEN 'Sufficiente' THEN 60 WHEN 'Poco soddisfatto' THEN 40 WHEN 'Insoddisfatto' THEN 20 ELSE NULL END,
      'appagamento_vita', CASE p.appagamento_vita_quotidiana WHEN 'Molto soddisfatto' THEN 100 WHEN 'Soddisfatto' THEN 80 WHEN 'Abbastanza soddisfatto' THEN 60 WHEN 'Sufficiente' THEN 60 WHEN 'Poco soddisfatto' THEN 40 WHEN 'Insoddisfatto' THEN 20 ELSE NULL END,
      'info_cura', CASE p.spiegazioni_stato_salute WHEN 'Molto soddisfatto' THEN 100 WHEN 'Soddisfatto' THEN 80 WHEN 'Abbastanza soddisfatto' THEN 60 WHEN 'Sufficiente' THEN 60 WHEN 'Poco soddisfatto' THEN 40 WHEN 'Insoddisfatto' THEN 20 ELSE NULL END,
      'voto_spazio_esterno', CASE p.ambienti WHEN 'Molto soddisfatto' THEN 100 WHEN 'Soddisfatto' THEN 80 WHEN 'Abbastanza soddisfatto' THEN 60 WHEN 'Sufficiente' THEN 60 WHEN 'Poco soddisfatto' THEN 40 WHEN 'Insoddisfatto' THEN 20 ELSE NULL END
    )) AS riga_json
  FROM survey_centri_psichiatria p
  WHERE NOT EXISTS (
    SELECT 1 FROM survey_duplicati sd
    WHERE sd.tabella_origine = 'survey_centri_psichiatria' AND sd.riga_id = p.id AND sd.stato = 'eliminato'
  )

  UNION ALL

  SELECT
    pp.struttura,
    pp.created_at,
    'operator'::text AS survey_type,
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
    )) AS riga_json
  FROM survey_personale pp
  WHERE NOT EXISTS (
    SELECT 1 FROM survey_duplicati sd
    WHERE sd.tabella_origine = 'survey_personale' AND sd.riga_id = pp.id AND sd.stato = 'eliminato'
  )
),
facility_righe AS (
  SELECT
    c.id AS campagna_id,
    c.nome AS campagna_nome,
    c.survey_type,
    c.data_inizio,
    c.data_fine,
    c.stato,
    n.facility_id,
    NULL::integer AS company_id,
    n.udo_type,
    count(r.struttura) AS n_risposte,
    jsonb_agg(r.riga_json ORDER BY r.created_at) FILTER (WHERE r.riga_json <> '{}'::jsonb) AS responses_json
  FROM survey_campagne c
  JOIN survey_campagna_nomi n ON n.campagna_id = c.id AND n.facility_id IS NOT NULL
  JOIN raw_righe r
    ON r.struttura::text = n.nome_survey
   AND r.survey_type = c.survey_type
   AND r.created_at >= c.data_inizio
   AND r.created_at <= (c.data_fine + '1 day'::interval)
  GROUP BY c.id, c.nome, c.survey_type, c.data_inizio, c.data_fine, c.stato, n.facility_id, n.udo_type
),
facility_scores AS (
  SELECT
    fr.campagna_id,
    fr.facility_id,
    fr.udo_type,
    kv.key,
    avg(kv.value::text::numeric) AS avg_val,
    min(kv.value::text::integer) AS min_val,
    max(kv.value::text::integer) AS max_val
  FROM facility_righe fr
  JOIN survey_campagna_nomi n ON n.campagna_id = fr.campagna_id AND n.facility_id = fr.facility_id
  JOIN raw_righe r
    ON r.struttura::text = n.nome_survey
   AND r.survey_type = (SELECT survey_type FROM survey_campagne WHERE id = fr.campagna_id)
   AND r.created_at >= (SELECT data_inizio FROM survey_campagne WHERE id = fr.campagna_id)
   AND r.created_at <= ((SELECT data_fine FROM survey_campagne WHERE id = fr.campagna_id) + '1 day'::interval)
  CROSS JOIN LATERAL jsonb_each(r.riga_json) kv(key, value)
  GROUP BY fr.campagna_id, fr.facility_id, fr.udo_type, kv.key
),
facility_scores_agg AS (
  SELECT
    campagna_id,
    facility_id,
    udo_type,
    jsonb_object_agg(key, round(avg_val)) AS avg_scores,
    jsonb_object_agg(key, min_val) AS min_scores,
    jsonb_object_agg(key, max_val) AS max_scores
  FROM facility_scores
  GROUP BY campagna_id, facility_id, udo_type
),
udo_avg AS (
  SELECT campagna_id, udo_type, key, round(avg(avg_val)) AS udo_avg_val
  FROM facility_scores
  GROUP BY campagna_id, udo_type, key
),
udo_avg_agg AS (
  SELECT campagna_id, udo_type, jsonb_object_agg(key, udo_avg_val) AS udo_avg_scores
  FROM udo_avg
  GROUP BY campagna_id, udo_type
),
company_righe AS (
  SELECT
    c.id AS campagna_id,
    c.nome AS campagna_nome,
    c.survey_type,
    c.data_inizio,
    c.data_fine,
    c.stato,
    NULL::integer AS facility_id,
    n.company_id,
    NULL::text AS udo_type,
    count(r.struttura) AS n_risposte,
    jsonb_agg(r.riga_json ORDER BY r.created_at) FILTER (WHERE r.riga_json <> '{}'::jsonb) AS responses_json
  FROM survey_campagne c
  JOIN (
    SELECT DISTINCT ON (campagna_id, nome_survey) campagna_id, nome_survey, company_id
    FROM survey_campagna_nomi
    WHERE company_id IS NOT NULL
  ) n ON n.campagna_id = c.id
  JOIN raw_righe r
    ON r.struttura::text = n.nome_survey
   AND r.survey_type = c.survey_type
   AND r.created_at >= c.data_inizio
   AND r.created_at <= (c.data_fine + '1 day'::interval)
  GROUP BY c.id, c.nome, c.survey_type, c.data_inizio, c.data_fine, c.stato, n.company_id
),
company_scores AS (
  SELECT
    cr.campagna_id,
    cr.company_id,
    kv.key,
    avg(kv.value::text::numeric) AS avg_val,
    min(kv.value::text::integer) AS min_val,
    max(kv.value::text::integer) AS max_val
  FROM company_righe cr
  JOIN (
    SELECT DISTINCT ON (campagna_id, nome_survey) campagna_id, nome_survey, company_id
    FROM survey_campagna_nomi
    WHERE company_id IS NOT NULL
  ) n ON n.campagna_id = cr.campagna_id AND n.company_id = cr.company_id
  JOIN raw_righe r
    ON r.struttura::text = n.nome_survey
   AND r.survey_type = (SELECT survey_type FROM survey_campagne WHERE id = cr.campagna_id)
   AND r.created_at >= (SELECT data_inizio FROM survey_campagne WHERE id = cr.campagna_id)
   AND r.created_at <= ((SELECT data_fine FROM survey_campagne WHERE id = cr.campagna_id) + '1 day'::interval)
  CROSS JOIN LATERAL jsonb_each(r.riga_json) kv(key, value)
  GROUP BY cr.campagna_id, cr.company_id, kv.key
),
company_scores_agg AS (
  SELECT
    campagna_id,
    company_id,
    jsonb_object_agg(key, round(avg_val)) AS avg_scores,
    jsonb_object_agg(key, min_val) AS min_scores,
    jsonb_object_agg(key, max_val) AS max_scores
  FROM company_scores
  GROUP BY campagna_id, company_id
)
SELECT
  fr.campagna_id, fr.campagna_nome, fr.survey_type, fr.data_inizio, fr.data_fine, fr.stato,
  fr.facility_id, fr.company_id, fr.udo_type, fr.n_risposte, fr.responses_json,
  fsa.avg_scores, fsa.min_scores, fsa.max_scores, ua.udo_avg_scores
FROM facility_righe fr
LEFT JOIN facility_scores_agg fsa ON fsa.campagna_id = fr.campagna_id AND fsa.facility_id = fr.facility_id
LEFT JOIN udo_avg_agg ua ON ua.campagna_id = fr.campagna_id AND ua.udo_type = fr.udo_type

UNION ALL

SELECT
  cr.campagna_id, cr.campagna_nome, cr.survey_type, cr.data_inizio, cr.data_fine, cr.stato,
  cr.facility_id, cr.company_id, cr.udo_type, cr.n_risposte, cr.responses_json,
  csa.avg_scores, csa.min_scores, csa.max_scores, NULL::jsonb AS udo_avg_scores
FROM company_righe cr
LEFT JOIN company_scores_agg csa ON csa.campagna_id = cr.campagna_id AND csa.company_id = cr.company_id;
