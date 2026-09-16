-- ============================================================================
-- Generatore Carta dei Servizi — tabelle dedicate (stile HACCP: profilo per
-- struttura + storico generazioni), separate dal modulo doc_master generico
-- perché il contenuto (es. "come raggiungerci") è realmente diverso per
-- ogni struttura, non un unico master distribuito con placeholder.
--
-- Riusa role_permission_groups + user_in_group() già introdotti in
-- role_permissions_centralization.sql. Nessun nuovo gruppo: 'hq_admin'
-- (superadmin, admin) copre esattamente i ruoli che vedono il tab
-- "Generazione" in DocumentiPage.jsx (isAdminRole). Il Direttore accede
-- solo alle righe della propria struttura tramite user_role()='director'
-- + user_can_access_facility(), replicando l'esclusione già usata per
-- 'financial_read' (gli altri 3 ruoli struttura — dir_sanitario,
-- ref_struttura, ref_qualita — non vedono né generano questo documento).
-- ============================================================================

-- ── carta_servizi_gestore ────────────────────────────────────────────────
-- 1 riga per company: contenuti condivisi da tutte le sedi dello stesso
-- gestore (Mission/Valori, Lettera di presentazione).
CREATE TABLE IF NOT EXISTS carta_servizi_gestore (
  id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id            integer NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  mission_valori        text,
  lettera_presentazione text,
  firmatario_nome       text,
  firmatario_ruolo      text,
  updated_at            timestamptz NOT NULL DEFAULT now(),
  updated_by            uuid REFERENCES auth.users(id)
);

COMMENT ON TABLE carta_servizi_gestore IS
  'Contenuti Carta dei Servizi condivisi a livello di gestore (company), riutilizzati su tutte le sue strutture.';

ALTER TABLE carta_servizi_gestore ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS carta_servizi_gestore_write ON carta_servizi_gestore;
CREATE POLICY carta_servizi_gestore_write ON carta_servizi_gestore FOR ALL USING (
  user_in_group('hq_admin')
);

DROP POLICY IF EXISTS carta_servizi_gestore_read ON carta_servizi_gestore;
CREATE POLICY carta_servizi_gestore_read ON carta_servizi_gestore FOR SELECT USING (
  user_in_group('hq')
  OR (
    user_role() = 'director'
    AND EXISTS (
      SELECT 1 FROM facilities f
      WHERE f.company_id = carta_servizi_gestore.company_id
        AND user_can_access_facility(f.id)
    )
  )
);

-- ── carta_servizi_profili ────────────────────────────────────────────────
-- 1 riga per facility: input strutturato (SSOT), sullo stile di
-- haccp_profili. 'sezioni' è una mappa { id_sezione: testo } guidata dal
-- registro in src/config/cartaServiziSezioni.js — permette di aggiungere
-- nuovi box in futuro (anche per altre UDO) senza nuove migration.
CREATE TABLE IF NOT EXISTS carta_servizi_profili (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  facility_id  integer NOT NULL UNIQUE REFERENCES facilities(id) ON DELETE CASCADE,
  sezioni      jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   uuid REFERENCES auth.users(id)
);

COMMENT ON TABLE carta_servizi_profili IS
  'Profilo Carta dei Servizi per struttura: box testuali specifici (descrizione, come raggiungerci, servizi, orari, retta, ecc.), compilati da admin o dal Direttore della struttura.';

ALTER TABLE carta_servizi_profili ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS carta_servizi_profili_write ON carta_servizi_profili;
CREATE POLICY carta_servizi_profili_write ON carta_servizi_profili FOR ALL USING (
  user_in_group('hq_admin')
  OR (user_role() = 'director' AND user_can_access_facility(facility_id))
);

DROP POLICY IF EXISTS carta_servizi_profili_read ON carta_servizi_profili;
CREATE POLICY carta_servizi_profili_read ON carta_servizi_profili FOR SELECT USING (
  user_in_group('hq')
  OR (user_role() = 'director' AND user_can_access_facility(facility_id))
);

-- ── carta_servizi_generati ───────────────────────────────────────────────
-- Storico dei documenti generati (come haccp_manuali). Niente flusso di
-- "richiesta": sia admin che Direttore generano direttamente.
CREATE TABLE IF NOT EXISTS carta_servizi_generati (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  facility_id       integer NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  numero_revisione  integer NOT NULL DEFAULT 1,
  data_generazione  date NOT NULL DEFAULT current_date,
  generato_da       uuid REFERENCES auth.users(id),
  note_revisione    text,
  file_path         text NOT NULL,
  file_url          text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE carta_servizi_generati IS
  'Storico versioni della Carta dei Servizi generata per struttura (file .docx in bucket carta-servizi-documents).';

CREATE INDEX IF NOT EXISTS carta_servizi_generati_facility_idx
  ON carta_servizi_generati (facility_id, numero_revisione DESC);

ALTER TABLE carta_servizi_generati ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS carta_servizi_generati_write ON carta_servizi_generati;
CREATE POLICY carta_servizi_generati_write ON carta_servizi_generati FOR ALL USING (
  user_in_group('hq_admin')
  OR (user_role() = 'director' AND user_can_access_facility(facility_id))
);

DROP POLICY IF EXISTS carta_servizi_generati_read ON carta_servizi_generati;
CREATE POLICY carta_servizi_generati_read ON carta_servizi_generati FOR SELECT USING (
  user_in_group('hq')
  OR (user_role() = 'director' AND user_can_access_facility(facility_id))
);

-- ── Storage bucket dedicato ──────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('carta-servizi-documents', 'carta-servizi-documents', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS carta_servizi_documents_write ON storage.objects;
CREATE POLICY carta_servizi_documents_write ON storage.objects FOR ALL USING (
  bucket_id = 'carta-servizi-documents'
  AND (
    user_in_group('hq_admin')
    OR user_role() = 'director'
  )
) WITH CHECK (
  bucket_id = 'carta-servizi-documents'
  AND (
    user_in_group('hq_admin')
    OR user_role() = 'director'
  )
);

DROP POLICY IF EXISTS carta_servizi_documents_read ON storage.objects;
CREATE POLICY carta_servizi_documents_read ON storage.objects FOR SELECT USING (
  bucket_id = 'carta-servizi-documents'
  AND user_in_group('hq')
);
