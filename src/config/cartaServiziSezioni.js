/**
 * src/config/cartaServiziSezioni.js
 * ─────────────────────────────────────────────────────────────
 * Registro delle sezioni "box testuali" della Carta dei Servizi.
 * Unica fonte di verità per:
 *  - il form di compilazione (CartaServiziGeneratorModal → tab Profilo)
 *  - l'ordine di assemblaggio del .docx (cartaServiziDocxBuilder.js)
 *
 * Ogni sezione è salvata come coppia { id: testo } dentro la colonna
 * jsonb `carta_servizi_profili.sezioni` — aggiungere/rimuovere un box
 * in futuro (anche per altre UDO) non richiede una nuova migration.
 *
 * L'elenco copre i contenuti minimi obbligatori della Carta dei Servizi
 * previsti dalla D.G.R. Lombardia X/2569 del 31/10/2014, Allegato 1,
 * punto 3.2.4 lett. a) (12 contenuti minimi) — il riferimento al punto
 * di norma è richiamato nel campo `help` di ogni sezione interessata.
 *
 * Oggi il template attivo è unico (RSA). Il campo `udo` è già presente
 * per poter in futuro filtrare le sezioni per tipo di UDO senza
 * riprogettare il registro.
 * ─────────────────────────────────────────────────────────────
 */

export const CARTA_SERVIZI_SEZIONI = [
  {
    id: 'tipologia_autorizzativa',
    gruppo: 'struttura',
    udo: 'RSA',
    ordine: 1,
    label: 'Tipologia autorizzativa e posti letto',
    help: 'RSA estensiva / di mantenimento / RAF, eventuali nuclei specializzati (demenze, Alzheimer...), numero e nome dei nuclei, delibera di accreditamento. Indicare sempre i posti abilitati all\'esercizio, accreditati e a contratto (contenuto minimo obbligatorio DGR X/2569/2014, punto 2).',
    placeholder: 'Es: RSA di mantenimento con complessivi 70 posti letto, tutti accreditati e a contratto, articolata in 3 nuclei da 20-25 posti...',
  },
  {
    id: 'normativa_regionale',
    gruppo: 'struttura',
    udo: 'RSA',
    ordine: 2,
    label: 'Riferimenti normativi regionali',
    help: 'Leggi e regolamenti regionali specifici che disciplinano l\'autorizzazione/accreditamento di questa struttura (per la Lombardia: DGR X/2569/2014 e provvedimenti specifici RSA).',
    placeholder: 'Es: L. Reg. ... n. .../..., Reg. Reg. ... n. .../...',
  },
  {
    id: 'presentazione',
    gruppo: 'struttura',
    udo: 'RSA',
    ordine: 3,
    label: 'Presentazione della struttura',
    help: 'Descrizione narrativa: ambienti, spazi comuni, spazi esterni, anno di apertura, elementi distintivi.',
    placeholder: 'Es: La struttura si sviluppa su tre piani, con ampio giardino esterno...',
  },
  {
    id: 'come_raggiungerci',
    gruppo: 'struttura',
    udo: 'RSA',
    ordine: 4,
    label: 'Come raggiungerci',
    help: 'Indicazioni stradali e mezzi pubblici; indicare anche l\'eventuale disponibilità di un servizio di trasporto della struttura (contenuto minimo obbligatorio DGR X/2569/2014, punto 6).',
    placeholder: 'Es: In auto: ... — Mezzi pubblici: ... — Servizio trasporto struttura: ...',
  },
  {
    id: 'accessibilita',
    gruppo: 'struttura',
    udo: 'RSA',
    ordine: 5,
    label: 'Accessibilità e articolazione dei piani',
    help: 'Come sono organizzati i piani/reparti, accessibilità per persone con disabilità motoria.',
    placeholder: 'Es: Al piano terra sono presenti gli uffici, la palestra e la sala mensa...',
  },
  {
    id: 'destinatari',
    gruppo: 'struttura',
    udo: 'RSA',
    ordine: 6,
    label: 'Destinatari e condizioni che danno titolo all\'accesso',
    help: 'A chi si rivolge la struttura (età, livello di non autosufficienza, patologie escluse/incluse) e requisiti/condizioni per accedervi (contenuto minimo obbligatorio DGR X/2569/2014, punto 1).',
    placeholder: 'Es: Persone non autosufficienti, ultrasessantacinquenni...',
  },
  {
    id: 'documentazione_ammissione',
    gruppo: 'struttura',
    udo: 'RSA',
    ordine: 7,
    label: 'Documentazione e modalità di informazione per l\'ammissione',
    help: 'Documenti richiesti per l\'ingresso e come vengono fornite le informazioni sui servizi al nuovo ospite/famiglia prima dell\'ammissione.',
    placeholder: 'Es: Documento d\'identità, tessera sanitaria, certificato medico con diagnosi e terapie, documentazione clinica precedente...',
  },
  {
    id: 'liste_attesa_accoglienza',
    gruppo: 'struttura',
    udo: 'RSA',
    ordine: 8,
    label: 'Liste d\'attesa, accoglienza e presa in carico',
    help: 'Criteri di formazione e gestione della lista d\'attesa, modalità di accoglienza (unità operativa o persona incaricata delle visite guidate), presa in carico e dimissione degli utenti (contenuto minimo obbligatorio DGR X/2569/2014, punto 3).',
    placeholder: 'Es: La lista d\'attesa segue il criterio cronologico; le visite guidate sono a cura del Servizio Accoglienza...',
  },
  {
    id: 'servizi_tutelari',
    gruppo: 'struttura',
    udo: 'RSA',
    ordine: 9,
    label: 'Servizi tutelari',
    help: 'Assistenza sanitaria, infermieristica, riabilitativa, di animazione, sociale (contenuto minimo obbligatorio DGR X/2569/2014, punto 4 — modalità di erogazione delle prestazioni).',
    placeholder: 'Es: Assistenza medica e infermieristica 24h, fisioterapia, animazione...',
  },
  {
    id: 'servizi_alberghieri',
    gruppo: 'struttura',
    udo: 'RSA',
    ordine: 10,
    label: 'Servizi alberghieri',
    help: 'Ristorazione, lavanderia, parrucchiere, podologo e altri servizi di comfort.',
    placeholder: 'Es: Servizio di ristorazione interno, lavanderia inclusa nella retta...',
  },
  {
    id: 'giornata_tipo',
    gruppo: 'struttura',
    udo: 'RSA',
    ordine: 11,
    label: 'Giornata tipo',
    help: 'Fasce orarie e attività principali della giornata (contenuto minimo obbligatorio DGR X/2569/2014, punto 4, per le unità d\'offerta residenziali).',
    placeholder: 'Es: 7:00-8:30 risveglio e igiene personale — 8:30-9:30 colazione...',
  },
  {
    id: 'orari',
    gruppo: 'struttura',
    udo: 'RSA',
    ordine: 12,
    label: 'Orario di funzionamento e orario di visita',
    help: 'Orario di visita dei familiari, orario reception/centralino, orari dei pasti (contenuto minimo obbligatorio DGR X/2569/2014, punto 5).',
    placeholder: 'Es: Visite consentite dalle 10:00 alle 20:00 — Reception 9:00-19:00...',
  },
  {
    id: 'personale',
    gruppo: 'struttura',
    udo: 'RSA',
    ordine: 13,
    label: 'Il personale operante e organizzazione interna',
    help: 'Ruoli, figure professionali e livelli di responsabilità (in particolare per le aree sanitarie), oltre ai nominativi già in anagrafica struttura.',
    placeholder: 'Es: Medici, infermieri, OSS, fisioterapisti, educatori, assistente sociale, coordinati dal Direttore di struttura...',
  },
  {
    id: 'ingresso_economico',
    gruppo: 'struttura',
    udo: 'RSA',
    ordine: 14,
    label: 'Aspetti economici: retta e costi aggiuntivi',
    help: 'Tipologie di rette applicate, dettaglio dei costi aggiuntivi per prestazioni specifiche, eventuale deposito cauzionale e relative modalità di applicazione (contenuto minimo obbligatorio DGR X/2569/2014, punto 7).',
    placeholder: 'Es: Retta giornaliera di € ..., deposito cauzionale pari a una mensilità, pagamento anticipato entro il giorno 5...',
  },
  {
    id: 'dichiarazione_fiscale',
    gruppo: 'struttura',
    udo: 'RSA',
    ordine: 15,
    label: 'Certificazione ai fini fiscali',
    help: 'Modalità e tempistiche di rilascio agli utenti della dichiarazione/certificazione della retta versata, utile ai fini della dichiarazione dei redditi (contenuto minimo obbligatorio DGR X/2569/2014, punto 11).',
    placeholder: 'Es: La Direzione rilascia annualmente, su richiesta, la certificazione delle rette versate ai fini fiscali...',
  },
  {
    id: 'animazione',
    gruppo: 'struttura',
    udo: 'RSA',
    ordine: 16,
    label: 'Attività di animazione e laboratori',
    help: 'Programma di animazione, laboratori, uscite, eventi.',
    placeholder: 'Es: Laboratori di manualità creativa, musicoterapia, gite ricreative...',
  },
  {
    id: 'rapporti_territorio',
    gruppo: 'struttura',
    udo: 'RSA',
    ordine: 17,
    label: 'Rapporti con le famiglie e il territorio',
    help: 'Modalità di coinvolgimento dei familiari, collaborazione con volontariato e territorio; referente per i rapporti con gli uffici di protezione giuridica e servizi sociali del territorio.',
    placeholder: 'Es: Incontri periodici con i familiari, sportello ADS, collaborazione con associazioni di volontariato...',
  },
  {
    id: 'tutela_reclami_dimissioni',
    gruppo: 'struttura',
    udo: 'RSA',
    ordine: 18,
    label: 'Tutela dei diritti, reclami, dimissioni e continuità delle cure',
    help: 'Strumenti e modalità per tutelare i diritti degli ospiti, tempi di gestione di segnalazioni e reclami, indicazioni in caso di dimissioni o trasferimento ad altra struttura e per assicurare la continuità delle cure (contenuto minimo obbligatorio DGR X/2569/2014, punto 8).',
    placeholder: 'Es: Reclami tramite modulo dedicato o lettera; risposta immediata per segnalazioni semplici, riscontro scritto entro 7 giorni per quelle complesse; alla dimissione viene rilasciata una relazione di continuità assistenziale...',
  },
  {
    id: 'soddisfazione_utenza',
    gruppo: 'struttura',
    udo: 'RSA',
    ordine: 19,
    label: 'Rilevazione della soddisfazione dell\'utenza',
    help: 'Strumenti, modalità e tempi di valutazione del grado di soddisfazione di ospiti e caregiver, anche ai fini della rilevazione dei disservizi (contenuto minimo obbligatorio DGR X/2569/2014, punto 9).',
    placeholder: 'Es: Questionario di soddisfazione somministrato con cadenza annuale, risultati diffusi tramite affissione ai piani...',
  },
  {
    id: 'accesso_documentazione',
    gruppo: 'struttura',
    udo: 'RSA',
    ordine: 20,
    label: 'Accesso alla documentazione sociosanitaria',
    help: 'Tempistiche e modalità per la consultazione o il rilascio del fascicolo socio-assistenziale e sanitario (FASAS) agli aventi diritto (contenuto minimo obbligatorio DGR X/2569/2014, punto 12).',
    placeholder: 'Es: Richiesta scritta agli Uffici Amministrativi; consegna entro 7 giorni, eventuali integrazioni entro 30 giorni; costo di €...',
  },
  {
    id: 'note_finali',
    gruppo: 'struttura',
    udo: 'RSA',
    ordine: 21,
    label: 'Note libere finali',
    help: 'Qualsiasi altra informazione utile non coperta dalle sezioni precedenti.',
    placeholder: '',
  },
];

export const CARTA_SERVIZI_SEZIONI_STRUTTURA = CARTA_SERVIZI_SEZIONI
  .filter(s => s.gruppo === 'struttura')
  .sort((a, b) => a.ordine - b.ordine);

export function getSezioneById(id) {
  return CARTA_SERVIZI_SEZIONI.find(s => s.id === id) ?? null;
}
