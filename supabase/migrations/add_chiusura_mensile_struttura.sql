-- Chiusura mensile P&L per struttura, importata da Impostazioni → Dati dal
-- file Excel che il Controllo di Gestione produce ogni mese (un file = una
-- struttura, tre blocchi nello stesso foglio: PY actual, CY actual, budget).
-- Alimenta il tab "Economico" della dash Direttore e il tab "Economico" di
-- /report (vista portfolio Sede/Board) — sostituiscono economico_mensile/
-- economico_mensile_struttura in quei due punti (quelle tabelle restano,
-- usate ancora da SemaforiGruppo.jsx per il Cruscotto).
--
-- I dati "PY" (anno precedente) del file si scrivono come scenario='actual'
-- con anno = anno_chiusura - 1: sono semplicemente l'actual dell'anno prima,
-- niente terzo valore di scenario — ogni import corregge così anche i mesi
-- già chiusi dell'anno precedente con i numeri restated dal CDG.
--
-- RLS: stesso pattern centralizzato di cdg_mensile/economico_mensile in
-- role_permissions_centralization.sql — nessun gruppo nuovo.
--
-- Eseguire su Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS chiusura_mensile_struttura (
  id                           BIGSERIAL PRIMARY KEY,
  facility_id                  INTEGER NOT NULL REFERENCES facilities(id),
  company_id                   INTEGER REFERENCES companies(id),
  anno                         INTEGER NOT NULL,
  mese                         INTEGER NOT NULL CHECK (mese BETWEEN 1 AND 12),
  scenario                     TEXT NOT NULL CHECK (scenario IN ('actual','budget')),

  ricavi                       NUMERIC,
  global_service               NUMERIC,
  costi_personale              NUMERIC,
  consulenze                   NUMERIC,
  servizi_manutenzioni         NUMERIC,
  utenze                       NUMERIC,
  locazioni                    NUMERIC,
  ebitda                       NUMERIC,

  totale_giornate              NUMERIC,
  giornate_occupate            NUMERIC,
  costo_locazione_pl_occupato  NUMERIC,
  ricavi_pl_occupato           NUMERIC,
  costo_medio_lavanderia       NUMERIC,
  costo_medio_ristorazione     NUMERIC,
  giornata_alimentare          NUMERIC,

  imported_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  imported_by                  UUID REFERENCES auth.users(id),

  UNIQUE(facility_id, anno, mese, scenario)
);

CREATE INDEX IF NOT EXISTS chiusura_mensile_struttura_facility_idx
  ON chiusura_mensile_struttura(facility_id, anno);

ALTER TABLE chiusura_mensile_struttura ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chiusura_mensile_struttura_admin ON chiusura_mensile_struttura;
CREATE POLICY chiusura_mensile_struttura_admin ON chiusura_mensile_struttura
  FOR ALL USING (user_in_group('hq'));

DROP POLICY IF EXISTS chiusura_mensile_struttura_read ON chiusura_mensile_struttura;
CREATE POLICY chiusura_mensile_struttura_read ON chiusura_mensile_struttura
  FOR SELECT USING (user_in_group('financial_read'));


-- ─── Passi manuali NON coperti da questa migration ──────────────
-- 1. Audit trail: trigger di audit_log (fn_audit_trigger(), già definita nel
--    DB) creato a mano su Supabase, poi aggiungere "chiusura_mensile_struttura"
--    a src/constants/auditLogTables.js lato frontend (già fatto in questo
--    commit, il trigger va creato separatamente):
--      CREATE TRIGGER audit_chiusura_mensile_struttura
--        AFTER INSERT OR UPDATE OR DELETE ON chiusura_mensile_struttura
--        FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();
