-- Estensione del modulo Verbali Ispettivi: allegati multipli per voce di
-- corrispondenza (una PEC porta quasi sempre più di un file) e
-- collegamento opzionale tra voci di corrispondenza ("in risposta a").
--
-- Migration NON distruttiva (a differenza di add_verbali_ispettivi_tables.sql,
-- qui le tabelle esistenti hanno già dati reali in produzione): solo
-- CREATE TABLE IF NOT EXISTS / ALTER TABLE ADD COLUMN IF NOT EXISTS.
--
-- verbali_corrispondenza.allegato_storage_path resta invariata per i dati
-- storici — le nuove voci di corrispondenza usano solo la tabella figlia
-- sottostante, non serve backfill.
--
-- Eseguire su Supabase SQL Editor.

-- ─── verbali_corrispondenza_allegati ────────────────────────────
CREATE TABLE IF NOT EXISTS verbali_corrispondenza_allegati (
  id                BIGSERIAL PRIMARY KEY,
  corrispondenza_id BIGINT NOT NULL REFERENCES verbali_corrispondenza(id) ON DELETE CASCADE,
  storage_path      TEXT NOT NULL,
  nome_file         TEXT NOT NULL,
  created_by        UUID REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS verbali_corrispondenza_allegati_corrispondenza_idx
  ON verbali_corrispondenza_allegati(corrispondenza_id);

ALTER TABLE verbali_corrispondenza_allegati ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS verbali_corrispondenza_allegati_select ON verbali_corrispondenza_allegati;
CREATE POLICY verbali_corrispondenza_allegati_select ON verbali_corrispondenza_allegati
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM verbali_corrispondenza vc
      JOIN verbali_ispettivi vi ON vi.id = vc.verbale_id
      WHERE vc.id = verbali_corrispondenza_allegati.corrispondenza_id
        AND (
          (user_role() = ANY (ARRAY['superadmin','admin','sede','board']))
          OR ((user_role() = 'director') AND user_can_access_facility(vi.facility_id))
        )
    )
  );

DROP POLICY IF EXISTS verbali_corrispondenza_allegati_insert ON verbali_corrispondenza_allegati;
CREATE POLICY verbali_corrispondenza_allegati_insert ON verbali_corrispondenza_allegati
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM verbali_corrispondenza vc
      JOIN verbali_ispettivi vi ON vi.id = vc.verbale_id
      WHERE vc.id = verbali_corrispondenza_allegati.corrispondenza_id
        AND (
          (user_role() = ANY (ARRAY['superadmin','admin','sede']))
          OR ((user_role() = 'director') AND user_can_access_facility(vi.facility_id))
        )
    )
  );

-- Nessuna UPDATE: gli allegati sono immutabili una volta caricati.
DROP POLICY IF EXISTS verbali_corrispondenza_allegati_delete ON verbali_corrispondenza_allegati;
CREATE POLICY verbali_corrispondenza_allegati_delete ON verbali_corrispondenza_allegati
  FOR DELETE USING (user_role() = ANY (ARRAY['superadmin','admin']));


-- ─── verbali_corrispondenza: collegamento "in risposta a" ───────
-- Threading opzionale tra voci di corrispondenza (es. una proroga concessa
-- che risponde a una proroga richiesta) — sempre impostato manualmente
-- dall'operatore, mai in automatico.
ALTER TABLE verbali_corrispondenza ADD COLUMN IF NOT EXISTS riferimento_corrispondenza_id BIGINT REFERENCES verbali_corrispondenza(id);


-- ─── Passo successivo ────────────────────────────────────────────
-- Eseguire poi add_audit_trigger_verbali_corrispondenza_allegati.sql per il
-- trigger di audit sulla nuova tabella (src/constants/auditLogTables.js lato
-- frontend è già stato aggiornato).
