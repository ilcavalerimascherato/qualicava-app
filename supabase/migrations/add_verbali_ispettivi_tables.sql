-- Nuovo modulo "Verbali Ispettivi": archivio dei verbali di ispezione
-- ricevuti da enti esterni (ATS, NAS...), con estrazione AI dei rilievi/
-- prescrizioni, collegamento a non_conformities per il piano di
-- miglioramento, e tracciamento della corrispondenza successiva.
--
-- Punto di aggancio finale nell'app: src/components/conformita/
-- SaeIspettiviPlaceholder.jsx (placeholder letterale per questa feature).
--
-- RLS: riusa gli stessi helper già in produzione per le altre tabelle
-- (user_role(), user_company_id(), user_can_access_facility()) — stesso
-- pattern di verifiche_sessioni/verifiche_scadenze in add_verifiche_tables.sql.
--
-- Nota: non_conformities.id è UUID (confermato da un primo tentativo di
-- esecuzione — schema_dump.sql nel repo è vuoto, non c'era altro modo di
-- saperlo prima) — verbali_rilievi.non_conformity_id è tipizzato di
-- conseguenza.
--
-- Script idempotente (DROP...CASCADE in testa): rilanciabile senza problemi
-- se un tentativo precedente si è fermato a metà.
--
-- Eseguire su Supabase SQL Editor.

DROP TABLE IF EXISTS verbali_corrispondenza CASCADE;
DROP TABLE IF EXISTS verbali_rilievi CASCADE;
DROP TABLE IF EXISTS verbali_ispettivi CASCADE;


-- ─── verbali_ispettivi ───────────────────────────────────────────
-- Header del verbale caricato: metadati del sopralluogo, stato di
-- elaborazione AI, esito sintetico, scadenza/stato della risposta.
CREATE TABLE verbali_ispettivi (
  id                         BIGSERIAL PRIMARY KEY,
  facility_id                INTEGER NOT NULL REFERENCES facilities(id),
  company_id                 INTEGER REFERENCES companies(id),

  -- Classificazione (l'AI classifica da sola leggendo il verbale)
  tipo_ispezione             TEXT NOT NULL DEFAULT 'altro'
                                CHECK (tipo_ispezione IN ('sopralluogo_vigilanza','controllo_appropriatezza','altro')),
  classificazione_originale  TEXT,   -- es. "2.07.05" / "02.07.07" letto dal PDF
  ente                       TEXT,   -- ATS / NAS / altro
  numero_verbale             TEXT,
  data_sopralluogo           DATE,
  ora_sopralluogo            TIME,

  -- Matching struttura (cudes estratto dal PDF vs facilities.cudes)
  cudes_estratto             TEXT,
  facility_match_status      TEXT NOT NULL DEFAULT 'da_confermare'
                                CHECK (facility_match_status IN ('auto_confermato','da_confermare','manuale','non_trovato')),

  -- File PDF originale (Storage privato, path {facility_id}/verbali/...)
  pdf_storage_path           TEXT NOT NULL,
  pdf_uploaded_by            UUID REFERENCES auth.users(id),
  pdf_uploaded_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Stato pipeline di estrazione AI
  stato_elaborazione_ai      TEXT NOT NULL DEFAULT 'in_coda'
                                CHECK (stato_elaborazione_ai IN ('in_coda','in_corso','completata','errore','non_richiesta')),
  ai_errore_dettaglio        TEXT,
  ai_estrazione_raw          JSONB,   -- risposta AI grezza completa, per audit/debug
  ai_model_usato             TEXT,
  ai_estratto_il             TIMESTAMPTZ,

  -- Esito sintetico (campi specifici per tipo, nullable)
  valutazione_sintetica      TEXT CHECK (valutazione_sintetica IN ('in_possesso_requisiti','subordinato_valutazioni','non_in_possesso')),  -- Tipo A
  percentuale_indicatori     NUMERIC(5,2),   -- Tipo B
  totale_fascicoli_esaminati INTEGER,
  indicatori_raggiunti       INTEGER,
  indicatori_non_raggiunti   INTEGER,
  indicatori_non_pertinenti  INTEGER,

  -- Contenuto narrativo/grezzo
  osservazioni_raw           TEXT,
  checklist_grezza           JSONB,   -- checklist per area/indicatore, non normalizzata riga per riga

  -- Documentazione richiesta e risposta all'ente
  documentazione_richiesta   TEXT,
  scadenza_risposta          DATE,
  indirizzo_invio_risposta   TEXT,
  oggetto_pec_suggerito      TEXT,
  responsabile_istruttoria_nome  TEXT,
  responsabile_istruttoria_tel   TEXT,
  responsabile_istruttoria_email TEXT,

  -- Revisione umana (obbligatoria prima che i rilievi diventino NC)
  stato_revisione             TEXT NOT NULL DEFAULT 'bozza_ai'
                                 CHECK (stato_revisione IN ('bozza_ai','in_revisione','confermato')),
  confermato_da                UUID REFERENCES auth.users(id),
  confermato_il                TIMESTAMPTZ,

  -- Stato risposta
  stato_risposta                TEXT NOT NULL DEFAULT 'da_rispondere'
                                   CHECK (stato_risposta IN ('da_rispondere','bozza_predisposta','inviata','non_richiesta')),
  data_risposta_inviata          DATE,
  bozza_risposta_ai              TEXT,

  -- Un procedimento ATS può generare più verbali nel tempo (es. "l'esito
  -- conclusivo del procedimento verrà comunicato con atto successivo")
  procedimento_verbale_id        BIGINT REFERENCES verbali_ispettivi(id),

  note                            TEXT,
  created_by                      UUID REFERENCES auth.users(id),
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX verbali_ispettivi_facility_idx ON verbali_ispettivi(facility_id);
CREATE INDEX verbali_ispettivi_scadenza_risposta_idx ON verbali_ispettivi(scadenza_risposta) WHERE stato_risposta = 'da_rispondere';

ALTER TABLE verbali_ispettivi ENABLE ROW LEVEL SECURITY;

CREATE POLICY verbali_ispettivi_select ON verbali_ispettivi
  FOR SELECT USING (
    (user_role() = ANY (ARRAY['superadmin','admin','sede','board']))
    OR ((user_role() = 'director') AND user_can_access_facility(facility_id))
  );

CREATE POLICY verbali_ispettivi_insert ON verbali_ispettivi
  FOR INSERT WITH CHECK (
    (user_role() = ANY (ARRAY['superadmin','admin','sede']))
    OR ((user_role() = 'director') AND user_can_access_facility(facility_id))
  );

CREATE POLICY verbali_ispettivi_update ON verbali_ispettivi
  FOR UPDATE USING (
    (user_role() = ANY (ARRAY['superadmin','admin','sede']))
    OR ((user_role() = 'director') AND user_can_access_facility(facility_id))
  );

-- DELETE ristretto ad admin/superadmin (default deciso nel piano — un
-- direttore che carica un verbale sbagliato lo segnala, non lo cancella
-- da solo, per non perdere traccia di un documento ricevuto da un ente).
CREATE POLICY verbali_ispettivi_delete ON verbali_ispettivi
  FOR DELETE USING (user_role() = ANY (ARRAY['superadmin','admin']));


-- ─── verbali_rilievi ─────────────────────────────────────────────
-- Rilievi/prescrizioni estratti dal verbale (raggruppati per area
-- tematica/FASAS di default, non 1 riga per ogni singolo "NO" della
-- checklist) — bozza AI fino alla conferma, poi collegati a una riga
-- non_conformities.
CREATE TABLE verbali_rilievi (
  id                     BIGSERIAL PRIMARY KEY,
  verbale_id             BIGINT NOT NULL REFERENCES verbali_ispettivi(id) ON DELETE CASCADE,
  ordine                 INTEGER NOT NULL DEFAULT 0,
  tipo                   TEXT NOT NULL CHECK (tipo IN ('prescrizione','osservazione','criticita_fasas','richiesta_documentazione')),
  area_tematica          TEXT,
  riferimento_fasas      TEXT,
  riferimento_indicatore TEXT,
  descrizione            TEXT NOT NULL,
  gravita_suggerita      TEXT CHECK (gravita_suggerita IN ('Bassa','Media','Alta')),
  scadenza_specifica     DATE,
  stato_revisione        TEXT NOT NULL DEFAULT 'proposto_ai'
                            CHECK (stato_revisione IN ('proposto_ai','confermato','modificato','scartato')),
  escluso_da_nc          BOOLEAN NOT NULL DEFAULT false,
  non_conformity_id      UUID REFERENCES non_conformities(id),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX verbali_rilievi_verbale_idx ON verbali_rilievi(verbale_id);

ALTER TABLE verbali_rilievi ENABLE ROW LEVEL SECURITY;

CREATE POLICY verbali_rilievi_select ON verbali_rilievi
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM verbali_ispettivi vi
      WHERE vi.id = verbali_rilievi.verbale_id
        AND (
          (user_role() = ANY (ARRAY['superadmin','admin','sede','board']))
          OR ((user_role() = 'director') AND user_can_access_facility(vi.facility_id))
        )
    )
  );

CREATE POLICY verbali_rilievi_insert ON verbali_rilievi
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM verbali_ispettivi vi
      WHERE vi.id = verbali_rilievi.verbale_id
        AND (
          (user_role() = ANY (ARRAY['superadmin','admin','sede']))
          OR ((user_role() = 'director') AND user_can_access_facility(vi.facility_id))
        )
    )
  );

CREATE POLICY verbali_rilievi_update ON verbali_rilievi
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM verbali_ispettivi vi
      WHERE vi.id = verbali_rilievi.verbale_id
        AND (
          (user_role() = ANY (ARRAY['superadmin','admin','sede']))
          OR ((user_role() = 'director') AND user_can_access_facility(vi.facility_id))
        )
    )
  );

CREATE POLICY verbali_rilievi_delete ON verbali_rilievi
  FOR DELETE USING (user_role() = ANY (ARRAY['superadmin','admin']));


-- ─── verbali_corrispondenza ──────────────────────────────────────
-- Scambi successivi con l'ente (proroghe, integrazioni, esito
-- procedimento) — non solo la risposta iniziale, che vive già come
-- data_riscontro_segnalante sulla riga non_conformities collegata.
CREATE TABLE verbali_corrispondenza (
  id                    BIGSERIAL PRIMARY KEY,
  verbale_id            BIGINT NOT NULL REFERENCES verbali_ispettivi(id) ON DELETE CASCADE,
  tipo                  TEXT NOT NULL CHECK (tipo IN ('risposta_iniziale','proroga_richiesta','proroga_concessa','integrazione','comunicazione_ente','esito_procedimento','altro')),
  direzione             TEXT NOT NULL CHECK (direzione IN ('in_uscita','in_entrata')),
  data                  DATE NOT NULL,
  oggetto               TEXT,
  testo                 TEXT,
  allegato_storage_path TEXT,
  protocollo            TEXT,
  created_by            UUID REFERENCES auth.users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX verbali_corrispondenza_verbale_idx ON verbali_corrispondenza(verbale_id);

ALTER TABLE verbali_corrispondenza ENABLE ROW LEVEL SECURITY;

CREATE POLICY verbali_corrispondenza_select ON verbali_corrispondenza
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM verbali_ispettivi vi
      WHERE vi.id = verbali_corrispondenza.verbale_id
        AND (
          (user_role() = ANY (ARRAY['superadmin','admin','sede','board']))
          OR ((user_role() = 'director') AND user_can_access_facility(vi.facility_id))
        )
    )
  );

CREATE POLICY verbali_corrispondenza_insert ON verbali_corrispondenza
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM verbali_ispettivi vi
      WHERE vi.id = verbali_corrispondenza.verbale_id
        AND (
          (user_role() = ANY (ARRAY['superadmin','admin','sede']))
          OR ((user_role() = 'director') AND user_can_access_facility(vi.facility_id))
        )
    )
  );

CREATE POLICY verbali_corrispondenza_update ON verbali_corrispondenza
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM verbali_ispettivi vi
      WHERE vi.id = verbali_corrispondenza.verbale_id
        AND (
          (user_role() = ANY (ARRAY['superadmin','admin','sede']))
          OR ((user_role() = 'director') AND user_can_access_facility(vi.facility_id))
        )
    )
  );

CREATE POLICY verbali_corrispondenza_delete ON verbali_corrispondenza
  FOR DELETE USING (user_role() = ANY (ARRAY['superadmin','admin']));


-- ─── facilities.cudes ────────────────────────────────────────────
-- Identificativo struttura usato dagli enti (ATS/NAS) nei verbali —
-- necessario per il matching automatico struttura↔verbale caricato.
-- Va popolato una tantum per le strutture esistenti dopo questa migration
-- (nessun dato equivalente già presente altrove nel sistema).
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS cudes TEXT;
CREATE INDEX IF NOT EXISTS facilities_cudes_idx ON facilities(cudes);


-- ─── non_conformities: collegamento al verbale di origine ───────
-- Nullable — non tocca la logica di validazione esistente in
-- NcFormModal.jsx (classificazione='Verbale Ente Vigilanza' continua ad
-- attivare needsRiscontro/data_riscontro_segnalante come oggi).
ALTER TABLE non_conformities ADD COLUMN IF NOT EXISTS verbale_id BIGINT REFERENCES verbali_ispettivi(id);
ALTER TABLE non_conformities ADD COLUMN IF NOT EXISTS verbale_rilievo_id BIGINT REFERENCES verbali_rilievi(id);


-- ─── Passi manuali NON coperti da questa migration ──────────────
-- 1. Storage bucket: nessuna migration di questo repo crea bucket via SQL
--    (haccp-documents/company-logos/signatures sono stati creati a mano da
--    Dashboard Supabase) — stessa prassi da seguire qui:
--      - Crea bucket "verbali-ispettivi", NON pubblico.
--      - Policy Storage equivalenti alle RLS sopra (upload/lettura per
--        director sulla propria struttura + admin/sede/board), sul modello
--        del bucket "haccp-documents" già configurato.
-- 2. Audit trail: nessun trigger di audit_log è definito in questo repo
--    (creati a mano, non versionati) — replicare per verbali_ispettivi,
--    verbali_rilievi, verbali_corrispondenza lo stesso trigger già attivo
--    sulle altre ~30 tabelle elencate in src/constants/auditLogTables.js,
--    poi aggiungere queste 3 tabelle a quella costante lato frontend.
-- 3. Popolamento facilities.cudes per le strutture esistenti (manuale).
