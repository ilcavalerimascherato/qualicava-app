-- Nuova sezione operativa "Verifiche": motore checklist configurabile,
-- matrice responsabilità (ruolo × ambito con ereditarietà universale →
-- UDO → struttura), scadenzario normativo.
--
-- v2: facilities.id e udos.id sono INTEGER (non BIGINT come nel primo
-- tentativo) — user_can_access_facility() richiede esattamente
-- p_facility_id integer, verificato via query diretta. Script idempotente:
-- droppa quanto creato dal tentativo precedente prima di ricreare, così si
-- può rilanciare senza districare uno stato parziale a mano.
--
-- RLS: riusa gli stessi helper già confermati in produzione per le altre
-- tabelle (user_role(), user_company_id(), user_can_access_facility()) —
-- stesso pattern di facilities_select/kpi_select/nc_select.
--
-- Eseguire su Supabase SQL Editor.

DROP TABLE IF EXISTS verifiche_esiti CASCADE;
DROP TABLE IF EXISTS verifiche_sessioni CASCADE;
DROP TABLE IF EXISTS verifiche_scadenze CASCADE;
DROP TABLE IF EXISTS verifiche_template_ruoli CASCADE;
DROP TABLE IF EXISTS verifiche_template_voci CASCADE;
DROP TABLE IF EXISTS verifiche_template CASCADE;
DROP TABLE IF EXISTS verifiche_ruoli CASCADE;
ALTER TABLE facilities DROP COLUMN IF EXISTS tipo_gestione_personale;


-- ─── verifiche_ruoli ────────────────────────────────────────────
-- I "player" responsabili (OSS, Infermiere, Direttore, Responsabile
-- Qualità, ...) — lista configurabile da sede, non un enum fisso.
CREATE TABLE verifiche_ruoli (
  id          BIGSERIAL PRIMARY KEY,
  nome        TEXT NOT NULL,
  descrizione TEXT,
  attivo      BOOLEAN NOT NULL DEFAULT true,
  ordine      INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE verifiche_ruoli ENABLE ROW LEVEL SECURITY;

CREATE POLICY verifiche_ruoli_read ON verifiche_ruoli
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY verifiche_ruoli_write ON verifiche_ruoli
  FOR ALL USING (user_role() = ANY (ARRAY['superadmin','admin','sede']));


-- ─── verifiche_template ─────────────────────────────────────────
-- Il template di verifica, con cadenza strutturata (non testuale):
-- cadenza_unita + cadenza_intervallo (+ ancora giorno_settimana/giorno_mese)
-- permette di calcolare deterministicamente la prossima scadenza.
CREATE TABLE verifiche_template (
  id                       BIGSERIAL PRIMARY KEY,
  nome                     TEXT NOT NULL,
  categoria                TEXT NOT NULL,
  rif                      TEXT,
  cadenza_unita            TEXT NOT NULL CHECK (cadenza_unita IN ('giorni','settimane','mesi')),
  cadenza_intervallo       INTEGER NOT NULL DEFAULT 1 CHECK (cadenza_intervallo >= 1),
  cadenza_giorno_settimana INTEGER CHECK (cadenza_giorno_settimana BETWEEN 0 AND 6),
  cadenza_giorno_mese      INTEGER CHECK (cadenza_giorno_mese BETWEEN 1 AND 31),
  attivo                   BOOLEAN NOT NULL DEFAULT true,
  ordine                   INTEGER NOT NULL DEFAULT 0,
  created_by               UUID REFERENCES auth.users(id),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE verifiche_template ENABLE ROW LEVEL SECURITY;

CREATE POLICY verifiche_template_read ON verifiche_template
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY verifiche_template_write ON verifiche_template
  FOR ALL USING (user_role() = ANY (ARRAY['superadmin','admin','sede']));


-- ─── verifiche_template_voci ────────────────────────────────────
-- Sotto-voci di un template (pattern Heliopolis A1-A5). Un template
-- senza righe qui ha esito unico direttamente sulla sessione.
CREATE TABLE verifiche_template_voci (
  id          BIGSERIAL PRIMARY KEY,
  template_id BIGINT NOT NULL REFERENCES verifiche_template(id) ON DELETE CASCADE,
  ordine      INTEGER NOT NULL DEFAULT 0,
  voce        TEXT NOT NULL,
  rif         TEXT
);

ALTER TABLE verifiche_template_voci ENABLE ROW LEVEL SECURITY;

CREATE POLICY verifiche_template_voci_read ON verifiche_template_voci
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY verifiche_template_voci_write ON verifiche_template_voci
  FOR ALL USING (user_role() = ANY (ARRAY['superadmin','admin','sede']));


-- ─── verifiche_template_ruoli ───────────────────────────────────
-- La matrice responsabilità: una riga per (template, ruolo, livello).
-- facility_id e udo_id nullable, al più uno valorizzato — se entrambi
-- null è il livello "Universale" (baseline di gruppo). Risoluzione
-- "chi è responsabile" lato applicazione: facility_id esatto > udo_id
-- della struttura > riga Universale.
CREATE TABLE verifiche_template_ruoli (
  id          BIGSERIAL PRIMARY KEY,
  template_id BIGINT NOT NULL REFERENCES verifiche_template(id) ON DELETE CASCADE,
  ruolo_id    BIGINT NOT NULL REFERENCES verifiche_ruoli(id) ON DELETE CASCADE,
  facility_id INTEGER REFERENCES facilities(id) ON DELETE CASCADE,
  udo_id      INTEGER REFERENCES udos(id) ON DELETE CASCADE,
  abilitato   BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT verifiche_template_ruoli_livello_check
    CHECK (NOT (facility_id IS NOT NULL AND udo_id IS NOT NULL))
);

CREATE UNIQUE INDEX verifiche_template_ruoli_universale_uq
  ON verifiche_template_ruoli (template_id, ruolo_id)
  WHERE facility_id IS NULL AND udo_id IS NULL;
CREATE UNIQUE INDEX verifiche_template_ruoli_udo_uq
  ON verifiche_template_ruoli (template_id, ruolo_id, udo_id)
  WHERE udo_id IS NOT NULL;
CREATE UNIQUE INDEX verifiche_template_ruoli_facility_uq
  ON verifiche_template_ruoli (template_id, ruolo_id, facility_id)
  WHERE facility_id IS NOT NULL;

ALTER TABLE verifiche_template_ruoli ENABLE ROW LEVEL SECURITY;

CREATE POLICY verifiche_template_ruoli_read ON verifiche_template_ruoli
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY verifiche_template_ruoli_write ON verifiche_template_ruoli
  FOR ALL USING (user_role() = ANY (ARRAY['superadmin','admin','sede']));


-- ─── verifiche_sessioni ──────────────────────────────────────────
-- Una sessione di verifica eseguita per una struttura specifica.
CREATE TABLE verifiche_sessioni (
  id             BIGSERIAL PRIMARY KEY,
  template_id    BIGINT NOT NULL REFERENCES verifiche_template(id),
  facility_id    INTEGER NOT NULL REFERENCES facilities(id),
  data_esecuzione DATE NOT NULL DEFAULT CURRENT_DATE,
  eseguita_da    UUID REFERENCES auth.users(id),
  ruolo_id       BIGINT REFERENCES verifiche_ruoli(id),
  note           TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE verifiche_sessioni ENABLE ROW LEVEL SECURITY;

CREATE POLICY verifiche_sessioni_select ON verifiche_sessioni
  FOR SELECT USING (
    (user_role() = ANY (ARRAY['superadmin','admin','sede','board']))
    OR ((user_role() = 'director') AND user_can_access_facility(facility_id))
  );

CREATE POLICY verifiche_sessioni_write ON verifiche_sessioni
  FOR ALL USING (
    (user_role() = ANY (ARRAY['superadmin','admin','sede']))
    OR ((user_role() = 'director') AND user_can_access_facility(facility_id))
  );


-- ─── verifiche_esiti ─────────────────────────────────────────────
-- Esito per voce per sessione (voce_id nullable: se il template non ha
-- sotto-voci, un solo esito generale sulla sessione stessa).
CREATE TABLE verifiche_esiti (
  id          BIGSERIAL PRIMARY KEY,
  sessione_id BIGINT NOT NULL REFERENCES verifiche_sessioni(id) ON DELETE CASCADE,
  voce_id     BIGINT REFERENCES verifiche_template_voci(id),
  esito       TEXT NOT NULL CHECK (esito IN ('OK','NC','NP')),
  nota        TEXT
);

ALTER TABLE verifiche_esiti ENABLE ROW LEVEL SECURITY;

CREATE POLICY verifiche_esiti_select ON verifiche_esiti
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM verifiche_sessioni vs
      WHERE vs.id = verifiche_esiti.sessione_id
        AND (
          (user_role() = ANY (ARRAY['superadmin','admin','sede','board']))
          OR ((user_role() = 'director') AND user_can_access_facility(vs.facility_id))
        )
    )
  );

CREATE POLICY verifiche_esiti_write ON verifiche_esiti
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM verifiche_sessioni vs
      WHERE vs.id = verifiche_esiti.sessione_id
        AND (
          (user_role() = ANY (ARRAY['superadmin','admin','sede']))
          OR ((user_role() = 'director') AND user_can_access_facility(vs.facility_id))
        )
    )
  );


-- ─── verifiche_scadenze ──────────────────────────────────────────
-- Scadenzario normativo generico per struttura.
CREATE TABLE verifiche_scadenze (
  id                    BIGSERIAL PRIMARY KEY,
  facility_id           INTEGER NOT NULL REFERENCES facilities(id),
  nome                  TEXT NOT NULL,
  data_scadenza         DATE NOT NULL,
  ricorrenza            TEXT,
  riferimento_normativo TEXT,
  ditta_riferimento     TEXT,
  attivo                BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE verifiche_scadenze ENABLE ROW LEVEL SECURITY;

CREATE POLICY verifiche_scadenze_select ON verifiche_scadenze
  FOR SELECT USING (
    (user_role() = ANY (ARRAY['superadmin','admin','sede','board']))
    OR ((user_role() = 'director') AND user_can_access_facility(facility_id))
  );

CREATE POLICY verifiche_scadenze_write ON verifiche_scadenze
  FOR ALL USING (user_role() = ANY (ARRAY['superadmin','admin','sede']));


-- ─── facilities.tipo_gestione_personale ─────────────────────────
-- Campo anagrafico: distingue lo scenario di gestione del personale.
-- Il controllo di conformità agli standard di accreditamento resta
-- dovuto in ogni caso (template Universale, indipendente da questo
-- campo) — serve solo ad agganciare in futuro il controllo aggiuntivo
-- sullo scostamento ore contrattuali (fuori scope in questo incremento).
ALTER TABLE facilities
  ADD COLUMN tipo_gestione_personale TEXT
  CHECK (tipo_gestione_personale IN ('diretta','appalto_parziale','appalto_completo'));
