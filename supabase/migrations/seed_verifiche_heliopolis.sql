-- Seed dei template di verifica reali di Heliopolis, dal prototipo
-- heliopolis_audit_tracker_v3.html — checklist Martedì (Personale/Ore) e
-- Giovedì (audit a rotazione per settore), come dati configurabili nel
-- motore generico invece che hardcoded in un'app a parte.
--
-- Decisione confermata con Claudio: ambito "Universale" (si applicano a
-- tutte le strutture/UDO, non solo a Heliopolis) — questi controlli sono
-- generici, non specifici RSA; il dettaglio per sotto-unità va nella voce
-- quando serve. Ruolo responsabile: "Direttore" (creato se non esiste).
--
-- Le scadenze normative sono assegnate alla facility 4 (R-HELIOPOLIS) —
-- da confermare se vanno duplicate anche sulla 37 (R-HELIOPOLIS-APA).
--
-- Eseguire su Supabase SQL Editor, dopo add_verifiche_tables.sql.

INSERT INTO verifiche_ruoli (nome, descrizione)
SELECT 'Direttore', 'Direttore di struttura'
WHERE NOT EXISTS (SELECT 1 FROM verifiche_ruoli WHERE nome = 'Direttore');

-- ─── Martedì — Personale, Qualifiche e Turnover ──────────────────
WITH tmpl AS (
  INSERT INTO verifiche_template (nome, categoria, cadenza_unita, cadenza_intervallo, cadenza_giorno_settimana, attivo)
  VALUES ('Personale, Qualifiche e Turnover', 'Personale', 'settimane', 1, 2, true)
  RETURNING id
)
INSERT INTO verifiche_template_voci (template_id, ordine, voce, rif)
SELECT id, v.ordine, v.voce, v.rif FROM tmpl, (VALUES
  (1, 'Verifica scostamento ore All. B1 (settimana precedente) — soglia 5%', 'All. B1'),
  (2, 'Ore contrattualizzate vs ore effettivamente erogate', 'All. B1'),
  (3, 'Firme presenze / badge vs turnistica pianificata', 'Cap. p.45'),
  (4, 'Corrispondenza ore fatturate vs registro presenze', 'All. B1'),
  (5, 'Straordinari e sostituzioni non pianificate', NULL),
  (6, 'Audit fascicoli a campione (min. 3): titoli di studio', 'Cap. Qualifiche'),
  (7, 'Corsi sicurezza D.Lgs 81/08 — scaduti o in scadenza', 'D.Lgs 81/08'),
  (8, 'Attestati HACCP personale cucina', 'Reg. CE 852/2004'),
  (9, 'Certificati medici idoneità presenti e aggiornati', NULL),
  (10, 'Contratti e mansionari allineati al profilo operativo', NULL),
  (11, 'Analisi sostituzioni/dimissioni periodo', 'Cap. p.45'),
  (12, 'Copertura reparti critici senza interruzioni', NULL),
  (13, 'Segnalazioni aperte (reclami, infortuni)', 'D.Lgs 81/08'),
  (14, 'Valutazione stress e clima interno', 'Cap. p.45')
) AS v(ordine, voce, rif);

-- ─── Giovedì — Igiene e Sanificazione (mensile) ──────────────────
WITH tmpl AS (
  INSERT INTO verifiche_template (nome, categoria, cadenza_unita, cadenza_intervallo, attivo)
  VALUES ('Igiene e Sanificazione', 'Igiene', 'mesi', 1, true)
  RETURNING id
)
INSERT INTO verifiche_template_voci (template_id, ordine, voce, rif)
SELECT id, v.ordine, v.voce, v.rif FROM tmpl, (VALUES
  (1, 'Carrelli sanificazione: dotazione e stato', 'Proc. San. Rev1 p.14'),
  (2, 'Codice colore mop e panni (zonizzazione)', 'Proc. San. Rev1 p.14'),
  (3, 'Moduli pulizie a fondo compilati e firmati', 'Proc. San. Rev1'),
  (4, 'Prodotti chimici: etichettatura, schede sicurezza, stoccaggio', NULL),
  (5, 'Ispezione visiva 3 aree a campione', NULL),
  (6, 'Registro sanificazioni aggiornato e firmato', NULL)
) AS v(ordine, voce, rif);

-- ─── Giovedì — Cucina e Bar (mensile) ─────────────────────────────
WITH tmpl AS (
  INSERT INTO verifiche_template (nome, categoria, cadenza_unita, cadenza_intervallo, attivo)
  VALUES ('Cucina e Bar', 'Ristorazione', 'mesi', 1, true)
  RETURNING id
)
INSERT INTO verifiche_template_voci (template_id, ordine, voce, rif)
SELECT id, v.ordine, v.voce, v.rif FROM tmpl, (VALUES
  (1, 'Temperature pasti (caldo ≥65°C, freddo ≤8°C)', 'Cap. Rist. p.8.2'),
  (2, 'Registrazione temperature frigo/freezer in continuo', 'Cap. Rist. p.8.2'),
  (3, 'Etichettatura magazzino: scadenze, allergeni', 'Cap. Rist. p.12'),
  (4, 'Pulizia cappe aspiranti e filtri', 'Cap. Rist. p.12'),
  (5, 'Area bar ospiti: pulizia e scadenze prodotti', 'Cap. Rist. p.12'),
  (6, 'Campionature pasti effettuate (tracciabilità)', 'Reg. CE 852/2004')
) AS v(ordine, voce, rif);

-- ─── Giovedì — Area Clinica e Riabilitativa (mensile) ────────────
WITH tmpl AS (
  INSERT INTO verifiche_template (nome, categoria, cadenza_unita, cadenza_intervallo, attivo)
  VALUES ('Area Clinica e Riabilitativa', 'Area Clinica', 'mesi', 1, true)
  RETURNING id
)
INSERT INTO verifiche_template_voci (template_id, ordine, voce, rif)
SELECT id, v.ordine, v.voce, v.rif FROM tmpl, (VALUES
  (1, 'PAI aggiornato: firma infermiere, fisioterapista, psicologo', 'Cap. Serv. p.10-11'),
  (2, 'Ausili: sollevatori (data revisione, libretto)', 'D.Lgs 81/08'),
  (3, 'Letti degenza: manovelle, spondine, freni', NULL),
  (4, 'Registro consegne infermieristiche compilato', NULL),
  (5, 'Minutaggio erogato vs PAI (campione 3 ospiti)', 'Cap. Serv.'),
  (6, 'Dispositivi medici: scadenze, sterilizzazione', NULL)
) AS v(ordine, voce, rif);

-- ─── Giovedì — Logistica e Reception (mensile) ───────────────────
WITH tmpl AS (
  INSERT INTO verifiche_template (nome, categoria, cadenza_unita, cadenza_intervallo, attivo)
  VALUES ('Logistica e Reception', 'Logistica', 'mesi', 1, true)
  RETURNING id
)
INSERT INTO verifiche_template_voci (template_id, ordine, voce, rif)
SELECT id, v.ordine, v.voce, v.rif FROM tmpl, (VALUES
  (1, 'Reception: registro visitatori aggiornato e firmato', 'Cap. Serv. p.40'),
  (2, 'Reception: accoglienza ospiti/famiglie', 'Cap. Serv. p.40'),
  (3, 'Lavanderia: tracciabilità biancheria (sacchi nominali)', 'Cap. Serv. p.40'),
  (4, 'Magazzino: rotazione FIFO, assenza scaduti', NULL),
  (5, 'Magazzino: stoccaggio chimici separato da alimentari', NULL),
  (6, 'Reclami: registro aggiornato, risposte entro 30 gg', NULL)
) AS v(ordine, voce, rif);

-- ─── Manutenzioni e Antincendio (semestrale) ─────────────────────
WITH tmpl AS (
  INSERT INTO verifiche_template (nome, categoria, cadenza_unita, cadenza_intervallo, attivo)
  VALUES ('Manutenzioni e Antincendio', 'Manutenzioni', 'mesi', 6, true)
  RETURNING id
)
INSERT INTO verifiche_template_voci (template_id, ordine, voce, rif)
SELECT id, v.ordine, v.voce, v.rif FROM tmpl, (VALUES
  (1, 'Registro antincendio aggiornato e firmato', 'D.Lgs 81/08'),
  (2, 'Ticket aperti: evasione entro SLA contrattuali', 'Cap. SLA'),
  (3, 'Estintori: controllo visivo e data revisione', NULL),
  (4, 'Porte tagliafuoco: funzionamento, segnaletica', 'DM 03/11/2004'),
  (5, 'Gruppo elettrogeno: ultima verifica, livello gasolio', NULL),
  (6, 'Impianto gas medicali: pressioni, scadenza revisione', NULL)
) AS v(ordine, voce, rif);

-- ─── Psicologhe / Animazione (annuale) ───────────────────────────
WITH tmpl AS (
  INSERT INTO verifiche_template (nome, categoria, cadenza_unita, cadenza_intervallo, attivo)
  VALUES ('Psicologhe e Animazione', 'Animazione', 'mesi', 12, true)
  RETURNING id
)
INSERT INTO verifiche_template_voci (template_id, ordine, voce, rif)
SELECT id, v.ordine, v.voce, v.rif FROM tmpl, (VALUES
  (1, 'Interventi psicologici = inserimenti diario clinico', NULL),
  (2, 'Attività animazione = inserimenti diario/minutaggio', NULL),
  (3, 'PEI aggiornati e firmati dal responsabile', 'Cap. Serv.'),
  (4, 'Registro attività sociali compilato', NULL),
  (5, 'Materiali/spazi attività ludico-riabilitative presenti', NULL)
) AS v(ordine, voce, rif);

-- ─── Legionella (semestrale) ──────────────────────────────────────
WITH tmpl AS (
  INSERT INTO verifiche_template (nome, categoria, cadenza_unita, cadenza_intervallo, attivo)
  VALUES ('Controllo Legionella', 'Sicurezza Impianti', 'mesi', 6, true)
  RETURNING id
)
INSERT INTO verifiche_template_voci (template_id, ordine, voce, rif)
SELECT id, v.ordine, v.voce, v.rif FROM tmpl, (VALUES
  (1, 'Sopralluogo impianti idrici: serbatoi, bollitori, docce', 'L.G. 2015'),
  (2, 'Temperatura ACS: ≥60°C alla produzione', 'L.G. 2015'),
  (3, 'Campionamento acqua eseguito da ditta incaricata', NULL),
  (4, 'Registro campionamenti aggiornato', NULL),
  (5, 'Risultati precedente campionamento: esito OK', NULL)
) AS v(ordine, voce, rif);

-- ─── Ascensori (biennale) ──────────────────────────────────────────
WITH tmpl AS (
  INSERT INTO verifiche_template (nome, categoria, cadenza_unita, cadenza_intervallo, attivo)
  VALUES ('Ascensori', 'Sicurezza Impianti', 'mesi', 24, true)
  RETURNING id
)
INSERT INTO verifiche_template_voci (template_id, ordine, voce, rif)
SELECT id, v.ordine, v.voce, v.rif FROM tmpl, (VALUES
  (1, 'Revisione biennale ICEPI effettuata', 'DPR 162/99'),
  (2, 'Libretto ascensori aggiornato', NULL),
  (3, 'Verbale collaudo positivo ricevuto', NULL),
  (4, 'Comunicazione ASL/INAIL effettuata se dovuta', NULL)
) AS v(ordine, voce, rif);

-- ─── Staffing e Clima estivo (annuale) ────────────────────────────
WITH tmpl AS (
  INSERT INTO verifiche_template (nome, categoria, cadenza_unita, cadenza_intervallo, attivo)
  VALUES ('Staffing e Clima Estivo', 'Personale', 'mesi', 12, true)
  RETURNING id
)
INSERT INTO verifiche_template_voci (template_id, ordine, voce, rif)
SELECT id, v.ordine, v.voce, v.rif FROM tmpl, (VALUES
  (1, 'Analisi turnover: sostituzioni estive in eccesso', 'Cap. p.45'),
  (2, 'Copertura agosto: piano ferie concordato', NULL),
  (3, 'Impianti clima: funzionamento e temperature ambienti', NULL),
  (4, 'Stress termico operatori: DPI disponibili', 'D.Lgs 81/08')
) AS v(ordine, voce, rif);

-- ─── Manutenzioni Tecniche — Caldaie/UTA (annuale) ────────────────
WITH tmpl AS (
  INSERT INTO verifiche_template (nome, categoria, cadenza_unita, cadenza_intervallo, attivo)
  VALUES ('Manutenzioni Tecniche — Caldaie e UTA', 'Manutenzioni', 'mesi', 12, true)
  RETURNING id
)
INSERT INTO verifiche_template_voci (template_id, ordine, voce, rif)
SELECT id, v.ordine, v.voce, v.rif FROM tmpl, (VALUES
  (1, 'Caldaie: manutenzione programmata eseguita', 'DPR 412/93'),
  (2, 'UTA: filtri sostituiti, verifica portate', NULL),
  (3, 'Gruppo elettrogeno: collaudo stagionale', NULL),
  (4, 'Libretto centrale termica aggiornato', NULL)
) AS v(ordine, voce, rif);

-- ─── Riepilogo Annuale (annuale) ───────────────────────────────────
WITH tmpl AS (
  INSERT INTO verifiche_template (nome, categoria, cadenza_unita, cadenza_intervallo, attivo)
  VALUES ('Riepilogo Annuale', 'Riepilogo', 'mesi', 12, true)
  RETURNING id
)
INSERT INTO verifiche_template_voci (template_id, ordine, voce, rif)
SELECT id, v.ordine, v.voce, v.rif FROM tmpl, (VALUES
  (1, 'Riconciliazione Allegato B — ore annue dovute vs erogate', 'All. B1'),
  (2, 'NC aperte anno: elenco e stato chiusura', NULL),
  (3, 'Scadenze normative anno prossimo: piano predisposto', NULL),
  (4, 'Budget ore anno prossimo concordato con committente', NULL)
) AS v(ordine, voce, rif);


-- ─── Assegnazione Universale a "Direttore" per tutti i template creati sopra ──
INSERT INTO verifiche_template_ruoli (template_id, ruolo_id, abilitato)
SELECT t.id, r.id, true
FROM verifiche_template t
CROSS JOIN verifiche_ruoli r
WHERE r.nome = 'Direttore'
  AND t.nome IN (
    'Personale, Qualifiche e Turnover', 'Igiene e Sanificazione', 'Cucina e Bar',
    'Area Clinica e Riabilitativa', 'Logistica e Reception', 'Manutenzioni e Antincendio',
    'Psicologhe e Animazione', 'Controllo Legionella', 'Ascensori',
    'Staffing e Clima Estivo', 'Manutenzioni Tecniche — Caldaie e UTA', 'Riepilogo Annuale'
  )
  AND NOT EXISTS (
    SELECT 1 FROM verifiche_template_ruoli tr
    WHERE tr.template_id = t.id AND tr.ruolo_id = r.id
      AND tr.facility_id IS NULL AND tr.udo_id IS NULL
  );


-- ─── Scadenze normative — facility 4 (R-HELIOPOLIS) e 37 (R-HELIOPOLIS-APA) ──
-- Duplicate su entrambe le strutture (confermato da Claudio).
INSERT INTO verifiche_scadenze (facility_id, nome, data_scadenza, ricorrenza, riferimento_normativo, ditta_riferimento)
VALUES
  (4, 'Campionamento Legionella — 1° semestre', '2027-05-31', 'semestrale', 'Linee Guida 2015', NULL),
  (4, 'Revisione biennale Ascensori', '2027-07-26', 'biennale', 'DPR 162/99', NULL),
  (4, 'Verifica impianto antincendio', '2027-09-15', 'annuale', 'D.Lgs 81/08', NULL),
  (4, 'Campionamento Legionella — 2° semestre', '2026-11-30', 'semestrale', 'Linee Guida 2015', NULL),
  (4, 'Manutenzione caldaie / UTA', '2026-10-01', 'annuale', 'DPR 412/93', NULL),
  (4, 'Comunicazione gas fluorurati ISPRA', '2026-12-31', 'annuale', 'DPR 43/2012', NULL),
  (37, 'Campionamento Legionella — 1° semestre', '2027-05-31', 'semestrale', 'Linee Guida 2015', NULL),
  (37, 'Revisione biennale Ascensori', '2027-07-26', 'biennale', 'DPR 162/99', NULL),
  (37, 'Verifica impianto antincendio', '2027-09-15', 'annuale', 'D.Lgs 81/08', NULL),
  (37, 'Campionamento Legionella — 2° semestre', '2026-11-30', 'semestrale', 'Linee Guida 2015', NULL),
  (37, 'Manutenzione caldaie / UTA', '2026-10-01', 'annuale', 'DPR 412/93', NULL),
  (37, 'Comunicazione gas fluorurati ISPRA', '2026-12-31', 'annuale', 'DPR 43/2012', NULL);
