-- Colonne per i contenuti AI dei documenti Word di campagna survey (rivisti
-- ed editati dal direttore prima di essere incorporati nel .docx — vedi
-- src/components/AnalisiCampagnaPanel.jsx e src/services/surveyCampagnaDocService.js).
-- Additive e difensiva: nessun CREATE TABLE locale per survey_ai_reports
-- (tabella creata da dashboard), quindi IF NOT EXISTS su ogni colonna.
ALTER TABLE survey_ai_reports ADD COLUMN IF NOT EXISTS sintesi_periodo_utenza text;
ALTER TABLE survey_ai_reports ADD COLUMN IF NOT EXISTS punti_forza_direzione text;
ALTER TABLE survey_ai_reports ADD COLUMN IF NOT EXISTS punti_debolezza_direzione text;
ALTER TABLE survey_ai_reports ADD COLUMN IF NOT EXISTS temi_commenti_direzione text;
ALTER TABLE survey_ai_reports ADD COLUMN IF NOT EXISTS punti_forza_utenza text;
ALTER TABLE survey_ai_reports ADD COLUMN IF NOT EXISTS dove_migliorare_utenza text;
ALTER TABLE survey_ai_reports ADD COLUMN IF NOT EXISTS obiettivi_direzione text;
ALTER TABLE survey_ai_reports ADD COLUMN IF NOT EXISTS azioni_utenza text;
ALTER TABLE survey_ai_reports ADD COLUMN IF NOT EXISTS impegno_utenza text;
