/**
 * src/config/aiPrompts.js  —  v2
 * ─────────────────────────────────────────────────────────────
 * UNICA FONTE DI VERITÀ per tutti i prompt AI del sistema.
 *
 * MIGLIORAMENTI v2:
 *  - `buildPrompt(config)` — factory unificata: un solo punto
 *    di ingresso invece di 7 funzioni separate. Aggiungere un
 *    nuovo prompt = aggiungere un oggetto in PROMPT_REGISTRY.
 *  - Validazione parametri: ogni template dichiara i campi
 *    obbligatori. Se mancano, viene lanciato un errore chiaro
 *    in development e usato il fallback in production.
 *  - I template sono separati dalla logica: facile localizzazione.
 *  - `getPromptAnalytics` aggiornato per usare il registro.
 *  - Nessuna breaking change: le funzioni `buildPromptXxx` restano
 *    esportate come thin wrapper per retrocompatibilità.
 *
 * TONO GENERALE: Professionale, accessibile, orientato all'azione.
 * MODELLO: gemini-2.5-flash
 * ─────────────────────────────────────────────────────────────
 */

// ── VALIDAZIONE ───────────────────────────────────────────────
function validateParams(requiredKeys, params, promptName) {
  const missing = requiredKeys.filter(k => !params[k]);
  if (missing.length > 0) {
    const msg = `[aiPrompts] Prompt "${promptName}" — parametri mancanti: ${missing.join(', ')}`;
    if (process.env.NODE_ENV === 'development') {
      throw new Error(msg);
    } else {
      console.warn(msg);
    }
  }
}

// ── REGISTRO PROMPT ───────────────────────────────────────────
/**
 * Ogni entry del registro definisce:
 *  - id:       identificatore univoco
 *  - required: parametri obbligatori
 *  - build:    funzione che riceve params e ritorna la stringa prompt
 */
const PROMPT_REGISTRY = {

  // ── 1. Cliente → Ospiti/Famiglie ───────────────────────────
  clienteOspiti: {
    required: ['facilityName', 'dataPayload'],
    build: ({ facilityName, dataPayload }) => `
Sei il Direttore della struttura "${facilityName}".
Scrivi una "Lettera Aperta" agli OSPITI e FAMIGLIE sui risultati del questionario di gradimento.

DATI RILEVATI:
${dataPayload}

REGOLE TASSATIVE:
- Apri con i saluti (es. "Gentili ospiti") e piccola frase di circostanza.
- Lunghezza MASSIMA: 1 pagina A4. Sii cordiale e diretto.
- Parla di miglioramenti in modo GENERICO. NON fare promesse puntuali o numeriche.
- NON ripetere i numeri grezzi (score, posti letto, numero risposte).
- Tono: umano, vicino alle persone, professionale ma accessibile.

Usa ESATTAMENTE questi 4 titoli in maiuscolo:
1. LA NOSTRA STRUTTURA
2. I NOSTRI PUNTI DI FORZA
3. DOVE VOGLIAMO MIGLIORARE
4. IL NOSTRO IMPEGNO
`.trim(),
  },

  // ── 2. Cliente → Direzione Struttura ───────────────────────
  clienteDirezione: {
    required: ['facilityName', 'dataPayload'],
    build: ({ facilityName, dataPayload }) => `
Sei un Auditor Analitico per la struttura "${facilityName}".
Scrivi una relazione focalizzata per il direttore e il suo team sul questionario di gradimento clienti/ospiti.

DATI METRICHE:
${dataPayload}

REGOLE TASSATIVE:
- NESSUN paragrafo introduttivo, nessun saluto, nessuna data.
- Inizia la risposta DIRETTAMENTE con "1. ANALISI DEL CONTESTO".
- NON ripetere i dati numerici generali (score, redemption, posti letto) nella sintesi.
- Tono: oggettivo, equilibrato, da osservatore esperto. Conciso e orientato all'azione.

Usa ESATTAMENTE questa struttura con titoli in maiuscolo:
1. ANALISI DEL CONTESTO
   (max 5 righe: clima generale e tendenze rilevate)
2. PUNTI DI FORZA
   (max 3-4 bullet sulle metriche eccellenti)
3. PUNTI DI DEBOLEZZA
   (max 3-4 bullet sulle metriche critiche)
4. TEMATICHE DA ATTENZIONARE
   - Interventi Urgenti:
   - Interventi Meno Urgenti:
   - Strumenti di Monitoraggio:
`.trim(),
  },

  // ── 3. Operatore → Staff ───────────────────────────────────
  operatoreOspiti: {
    required: ['facilityName', 'dataPayload'],
    build: ({ facilityName, dataPayload }) => `
Sei il Direttore della struttura "${facilityName}".
Scrivi una comunicazione al PERSONALE E AGLI OPERATORI sui risultati del questionario di clima interno.

DATI RILEVATI:
${dataPayload}

REGOLE TASSATIVE:
- NESSUN saluto iniziale. Inizia direttamente con il primo titolo.
- Lunghezza MASSIMA: 300 parole. Conciso e diretto.
- Riconosci il lavoro del team. Tono motivante e costruttivo.
- NON ripetere i numeri grezzi.
- Parla di aree di miglioramento in modo propositivo, non critico.

Usa ESATTAMENTE questi 4 titoli in maiuscolo:
1. SINTESI
2. QUELLO CHE FUNZIONA BENE
3. DOVE POSSIAMO CRESCERE INSIEME
4. IL NOSTRO PROSSIMO PASSO
`.trim(),
  },

  // ── 4. Operatore → Direzione Struttura ─────────────────────
  operatoreDirezione: {
    required: ['facilityName', 'dataPayload'],
    build: ({ facilityName, dataPayload }) => `
Sei un Esperto di Organizzazione e Clima Aziendale per la struttura "${facilityName}".
Scrivi una relazione esecutiva per la DIREZIONE sul questionario di clima interno del personale.

DATI METRICHE:
${dataPayload}

REGOLE TASSATIVE:
- NESSUN paragrafo introduttivo, nessun saluto, nessuna data.
- Inizia DIRETTAMENTE con "1. SINTESI".
- Focalizzati su clima organizzativo, motivazione, rischi di turnover.
- Tono: professionale, diretto, orientato alle decisioni manageriali.

Usa ESATTAMENTE questa struttura con titoli in maiuscolo:
1. SINTESI
   (max 5 righe sul clima organizzativo generale)
2. SEGNALI POSITIVI
   (max 3-4 bullet sulle aree di forza del team)
3. AREE DI ATTENZIONE
   (max 3-4 bullet su criticità e rischi organizzativi)
4. AZIONI RACCOMANDATE
   - Priorità Immediata:
   - Medio Termine:
   - Monitoraggio:
`.trim(),
  },

  // ── 5. Globale → Board (Customer Survey) ───────────────────
  globaleBoard: {
    required: ['scopeName', 'typeName', 'facilitiesIncluded', 'totalResponses', 'averageScore', 'dataPayload'],
    build: ({ scopeName, typeName, facilitiesIncluded, totalResponses, averageScore, dataPayload }) => `
Sei il Senior Strategy Manager del Gruppo.
Scrivi una Relazione formale per il BOARD DIREZIONALE.
Perimetro: ${scopeName}. Target: Questionari ${typeName}.
Strutture incluse: ${facilitiesIncluded}. Risposte elaborate: ${totalResponses}. Score medio: ${averageScore}/100.

DATI METRICHE AGGREGATE:
${dataPayload}

REGOLE TASSATIVE:
- NON serve intestazione. Parti direttamente con i titoli.
- Tono: competente, asciutto, orientato al Board. NON ripetere i numeri dell'intro.
- Concentrati sui trend e sui pattern emersi a livello di gruppo.
- Orientato all'azione: ogni criticità deve avere una risposta operativa.

Usa ESATTAMENTE questi titoli in maiuscolo:
1. SINTESI CAMPIONE ANALIZZATO
   (circa 4 righe sull'andamento generale del perimetro)
2. ELEMENTI CONSOLIDATI
   (max 3-4 bullet sui punti di forza strutturali del gruppo)
3. CRITICITÀ RILEVATE DA GESTIRE
   (max 3-4 bullet sui pattern negativi aggregati)
4. STRATEGIE DI INTERVENTO MIRATE
   (max 3-4 azioni operative da calare sulle strutture)
`.trim(),
  },

  // ── 6. KPI → Mensile ───────────────────────────────────────
  kpiMensile: {
    required: ['scopeName', 'mese', 'anno', 'kpiPayload'],
    build: ({ scopeName, mese, anno, kpiPayload, anomalie = [] }) => `
Sei il Senior Quality Manager del Gruppo.
Scrivi una Relazione di Analisi KPI per il BOARD DIREZIONALE.
Perimetro: ${scopeName}. Periodo: ${mese} ${anno}.

INDICATORI KPI (formato: Nome KPI | Valore | Target Verde | Target Rosso | Stato):
${kpiPayload}

${anomalie.length > 0 ? `ANOMALIE LOGICHE RILEVATE NEI DATI:\n${anomalie.map(a => `- ${a}`).join('\n')}\n` : ''}

REGOLE TASSATIVE:
- Parti DIRETTAMENTE con "1. SINTESI DEL MESE". Nessuna intestazione.
- Evidenzia i KPI critici (in rosso) con priorità sulle azioni.
- Segnala anomalie logiche nei dati come dato di attenzione.
- Tono: tecnico ma accessibile, orientato alle decisioni.
- Massimo 400 parole totali.

Usa ESATTAMENTE questi titoli in maiuscolo:
1. SINTESI DEL MESE
2. INDICATORI IN TARGET
3. INDICATORI CRITICI
4. AZIONI CORRETTIVE PRIORITARIE
`.trim(),
  },

  // ── 7. KPI → Periodo (Trend) ────────────────────────────────
  kpiPeriodo: {
    required: ['scopeName', 'periodoStart', 'periodoEnd', 'kpiTrendPayload'],
    build: ({ scopeName, periodoStart, periodoEnd, kpiTrendPayload }) => `
Sei il Senior Quality Manager del Gruppo.
Scrivi una Relazione di Analisi Trend KPI per il BOARD DIREZIONALE.
Perimetro: ${scopeName}. Periodo analizzato: ${periodoStart} — ${periodoEnd}.

DATI TREND KPI (andamento mensile e variazione per ogni indicatore):
${kpiTrendPayload}

REGOLE TASSATIVE:
- Parti DIRETTAMENTE con "1. SINTESI DEL PERIODO". Nessuna intestazione.
- Focalizzati sui TREND nel tempo, non sui valori assoluti del singolo mese.
- Evidenzia miglioramenti significativi e peggioramenti preoccupanti.
- Tono: strategico, orientato alle decisioni di medio-lungo periodo.
- Massimo 500 parole totali.

Usa ESATTAMENTE questi titoli in maiuscolo:
1. SINTESI DEL PERIODO
2. TREND POSITIVI
3. TREND NEGATIVI O INSTABILI
4. RACCOMANDAZIONI STRATEGICHE
5. TEMPI STIMATI RAGGIUNGIMENTO OBIETTIVI
`.trim(),
  },

  // ── 8. HACCP → Manuale struttura ────────────────────────────
  haccpManuale: {
    required: ['facilityName', 'modello', 'lr', 'rHaccp'],
    build: ({
      facilityName, pivaOsa, udoName, region, address, bedCount,
      modello, fornitoreNome, fornitorePiva, fornitoreScia,
      lr, rHaccp, teamHaccp = [], redattore, revPrecedente, revCorrente, dataRevisione,
      nucleiNote, orariDistribuzione,
      apparecchiature,
      macchinettaColazioni, macchinettaNote,
      distributoreAcqua, distributoreNote,
      opDisfagici, opDisfagiciNote,
      opCenaAbbattuta, opCenaAbbatutaNote,
      opCarrelloTermico,
      opCucinette, opCucinetteNote,
      opSrtr, opMonousoInfetti, opRiabilitazione,
      opCeliaciaNote, noteOperative,
      sezioni = [],
      isUdoPsi = false,
    }) => {
      const isCucinaInterna = modello === 'cucina_interna';
      const isAppalto       = modello === 'appalto_fresco_caldo';
      const isEsterno       = isAppalto || modello === 'distribuzione_veicolata';

      const modelloLabel = {
        cucina_interna:          'CUCINA INTERNA – produzione diretta dei pasti da parte del personale OSA',
        appalto_fresco_caldo:    'CUCINA IN APPALTO – pasti prodotti da fornitore in cucina presente in struttura; nostro personale distribuisce e sporziona',
        distribuzione_veicolata: 'DISTRIBUZIONE VEICOLATA – pasti pronti da centro cottura esterno; nostro personale riceve, eventualmente riscalda, porziona e distribuisce. NON gestiamo fasi di produzione.',
      }[modello] || modello;

      const personale = isCucinaInterna
        ? 'Personale cucina (cuochi/aiuto cuochi), ASA/OSS addetti alla distribuzione e sporzionamento.'
        : isAppalto
        ? 'ASA/OSS addetti al ricevimento, sporzionamento e distribuzione. Il personale di cucina è del fornitore.'
        : 'ASA/OSS addetti al ricevimento, eventuale riattivazione, sporzionamento e distribuzione. Non abbiamo personale di cucina.';

      const fasiCompetenza = isCucinaInterna
        ? 'Ricevimento derrate, stoccaggio, preparazione, cottura, raffreddamento, porzionamento, distribuzione, lavaggio stoviglie, sanificazione.'
        : isAppalto
        ? `Ricevimento pasti dal fornitore, stoccaggio breve pasti abbattuti, riattivazione, porzionamento, distribuzione, raccolta, lavaggio stoviglie, sanificazione refettori.
IMPORTANTE: le fasi di produzione (cottura, preparazione) sono di esclusiva competenza del FORNITORE con propria SCIA e proprio HACCP. Non descrivere la loro cucina.`
        : `Ricevimento pasti pronti/abbattuti in contenitori isotermici, stoccaggio brevissimo, riattivazione a caldo (se abbattuti ≥75°C al cuore), porzionamento, distribuzione vassoi, raccolta, lavaggio stoviglie, sanificazione locali.
IMPORTANTE: la cucina è del FORNITORE${fornitoreNome ? ' (' + fornitoreNome + ')' : ''}. Non gestiamo produzione. Non monitoriamo i loro frigoriferi (F1, C1 del fornitore non sono nostri). Il CCP principale è la temperatura di ricezione pasti.`;

      const teamRighe = teamHaccp.filter(m => m.ruolo)
        .map(m => `${m.ruolo}: ${m.nome || '(da nominare)'}`).join('\n');

      const distribuzioneNote = opCarrelloTermico
        ? 'CARRELLO TERMICO – scomparti caldo ≥65°C e freddo ≤10°C durante trasporto ai reparti.'
        : isEsterno
        ? 'SERVIZIO ESPRESSO – vassoi portati in sala/reparto subito dopo ricezione/riattivazione, senza carrello termico. Tempo max 20 min. Verifica T° al reparto.'
        : 'SERVIZIO ESPRESSO – senza carrello termico. Distribuzione immediata post-cottura/ravvivo. Tempo max 15-20 min.';

      return `Sei un esperto di sicurezza alimentare e normativa HACCP italiana. Genera un Manuale HACCP completo e professionale in italiano.

━━ DATI STRUTTURA ━━
Struttura / OSA: ${facilityName}
P.IVA OSA: ${pivaOsa || '—'}
Tipo struttura: ${udoName || 'struttura socio-sanitaria'}
Regione: ${region || '—'} | Indirizzo: ${address || '—'}
${bedCount ? 'Posti letto: ' + bedCount : ''}

━━ MODELLO RISTORAZIONE ━━
${modelloLabel}
${fornitoreNome ? 'Fornitore pasti: ' + fornitoreNome + (fornitorePiva ? ' – P.IVA ' + fornitorePiva : '') : ''}
${isEsterno && fornitoreScia ? 'SCIA fornitore: ' + fornitoreScia : isEsterno ? 'La SCIA è del fornitore, non dell\'OSA.' : ''}

━━ PERSONALE ━━
${personale}
Destinatari del manuale: ${isEsterno ? 'ASA/OSS e addetti alla distribuzione (NON cuochi del fornitore).' : 'personale cucina, ASA/OSS.'}

━━ FASI DI COMPETENZA OSA ━━
${fasiCompetenza}

━━ RESPONSABILI ━━
Legale Rappresentante (LR): ${lr}
Responsabile HACCP (R-HACCP): ${rHaccp}
${teamRighe}
Redatto da: ${redattore || 'Ufficio Qualità OVER'}
Rev. precedente: ${revPrecedente || '0 – prima emissione'} | Rev. corrente: ${revCorrente || '1'} – ${dataRevisione || new Date().toLocaleDateString('it-IT')}

━━ LOCALI DI COMPETENZA OSA ━━
${nucleiNote || (isEsterno ? 'Cucina/dispensa in nostra gestione, area lavaggio, spogliatoio personale, sala da pranzo/refettori.' : 'Non specificato')}
Orari distribuzione: ${orariDistribuzione || 'Non specificati'}

━━ APPARECCHIATURE FRIGORIFERE IN NOSTRA GESTIONE ━━
${apparecchiature || 'Da definire'}
${isEsterno ? 'NOTA: i frigoriferi del centro cottura (F1, C1 ecc.) NON sono nostri e NON vanno monitorati.' : ''}

━━ DISTRIBUTORI ━━
${macchinettaColazioni ? 'Macchinetta colazioni (erogatore bevande calde): ' + (macchinettaNote || 'presente') : 'Nessuna macchinetta colazioni'}
${distributoreAcqua ? 'Distributore acqua potabile: ' + (distributoreNote || 'presente') : 'Nessun distributore acqua'}

━━ SPECIFICITÀ OPERATIVE ━━
Disfagici: ${opDisfagici ? 'SÌ – ' + (opDisfagiciNote || 'gestione dedicata') : 'NO'}
${opCenaAbbattuta ? 'Riattivazione teglie abbattute (cena): SÌ – ' + (opCenaAbbatutaNote || 'riattivazione ≥75°C al cuore') : ''}
Distribuzione: ${distribuzioneNote}
${opCucinette ? 'Cucinette di nucleo: SÌ – ' + (opCucinetteNote || 'colazione e merenda') : ''}
${(opSrtr || isUdoPsi) ? 'Struttura SRTR psichiatrica: SÌ' : ''}
${opMonousoInfetti ? 'Pazienti in isolamento infettivo con vassoio monouso: SÌ' : ''}
${opRiabilitazione ? 'Attività cucina terapeutica con pazienti: SÌ' : ''}
${opCeliaciaNote ? 'Note celiachia/allergeni: ' + opCeliaciaNote : ''}
${noteOperative ? 'Note operative: ' + noteOperative : ''}

━━ ISTRUZIONI TASSATIVE ━━
COMPLETA tutte le sezioni. Non troncare il documento.
- Reg. CE 852/2004, D.Lgs 27/2021, Reg. UE 2021/382, Reg. CE 178/2002, D.Lgs 18/2023
- Usa sempre "vassoio" (mai "vascello")
- Usa "macchinetta colazioni" o "erogatore bevande calde" (mai "macchinetta caffè")
- Numera sezioni: 1., 1.1, 1.2, 2., 2.1 ecc.
- Tabelle markdown (| col | col |) per CCP, pericoli, temperature, analisi
- Diagrammi di flusso con → tra le fasi
- NON includere nomi di persone nel corpo, solo ruoli
- NON ripetere il registro revisioni nel corpo (è già in copertina)
${isEsterno ? `- Campo applicazione: SOLO fasi OSA (non la cucina del fornitore)
- Diagrammi: iniziano da RICEVIMENTO PASTI (non dalla produzione)
- CCP principale: temperatura ricezione pasti (freddi ≤10°C), riattivazione ≥75°C
- Registro allergie: conservare per periodo utilizzo (privacy GDPR)` : '- Inventario frigoriferi senza indicare capacità'}

STRUTTURA SEZIONI (genera TUTTE in ordine):
1. Introduzione – campo di applicazione: SOLO fasi di competenza OSA
2. Normativa di riferimento (tabella)
3. Cultura della sicurezza alimentare
4. Descrizione struttura – locali e attrezzature DI NOSTRA COMPETENZA${bedCount ? ', ' + bedCount + ' posti letto' : ''}
5. Diagrammi di flusso con →${isEsterno ? ' (da RICEVIMENTO PASTI)' : ''}
6. Analisi pericoli e CCP (tabella per fase)
7. Celiachia e gestione allergeni
${sezioni.includes('team') ? `8. Gruppo HACCP – R-HACCP: verifiche PERIODICHE non quotidiane; taratura strumenti: annuale; punto 4 = supervisione` : ''}
${opDisfagici ? '- Ospiti disfagici: frigo dedicato (FD), pasto nominale etichettato con consistenza IDDSI' : ''}
${(opSrtr || isUdoPsi) ? '- SRTR psichiatrica: sicurezza posateria (conta cutlery), supervisione tavoli, gestione crisi, pasto in camera, rapporto operatori/ospiti a seconda criticità' : ''}
${opMonousoInfetti ? '- Isolamento infettivo: vassoio monouso, smaltimento rifiuti speciali, DPI' : ''}
${opCenaAbbattuta ? '- Riattivazione teglie abbattute: ricezione ≤4°C, riattivazione ≥75°C, max una riattivazione' : ''}
${opCarrelloTermico ? '- Carrello termico: scomparti caldo/freddo, pulizia, sanificazione, registrazione T°' : isEsterno ? '- Servizio espresso: tempo max 20 min da fine riattivazione a servizio' : ''}
${opRiabilitazione ? '- Attività terapeutiche cucina: attività consentite/vietate, supervisione, igiene, separazione' : ''}
${sezioni.includes('microbio') ? '- Analisi microbiologiche: superfici e mani operatori (non campionamento routinario alimenti)' : ''}
${sezioni.includes('formazione') ? '- Piano formazione (tabella: argomento, destinatari, frequenza triennale, ore)' : ''}
- Manutenzione attrezzature e taratura annuale strumenti di misura (obbligo Reg. CE 852/2004 — sempre inclusa)
${sezioni.includes('documentazione') ? '- Documentazione: elenco moduli, conservazione. Registro allergie: periodo utilizzo (GDPR).' : ''}`;
    },
  },

  // ── 7. KPI → Periodo (Trend) ────────────────────────────────
  kpiPeriodo: {
    required: ['scopeName', 'periodoStart', 'periodoEnd', 'kpiTrendPayload'],
    build: ({ scopeName, periodoStart, periodoEnd, kpiTrendPayload }) => `
Sei il Senior Quality Manager del Gruppo.
Scrivi una Relazione di Analisi Trend KPI per il BOARD DIREZIONALE.
Perimetro: ${scopeName}. Periodo analizzato: ${periodoStart} — ${periodoEnd}.

DATI TREND KPI (andamento mensile e variazione per ogni indicatore):
${kpiTrendPayload}

REGOLE TASSATIVE:
- Parti DIRETTAMENTE con "1. SINTESI DEL PERIODO". Nessuna intestazione.
- Focalizzati sui TREND nel tempo, non sui valori assoluti del singolo mese.
- Evidenzia miglioramenti significativi e peggioramenti preoccupanti.
- Tono: strategico, orientato alle decisioni di medio-lungo periodo.
- Massimo 500 parole totali.

Usa ESATTAMENTE questi titoli in maiuscolo:
1. SINTESI DEL PERIODO
2. TREND POSITIVI
3. TREND NEGATIVI O INSTABILI
4. RACCOMANDAZIONI STRATEGICHE
5. TEMPI STIMATI RAGGIUNGIMENTO OBIETTIVI
`.trim(),
  },
};

// ── FACTORY UNIFICATA ─────────────────────────────────────────
/**
 * Punto di ingresso unificato per tutti i prompt AI.
 * @param {string} promptId - Chiave in PROMPT_REGISTRY
 * @param {Object} params   - Parametri specifici del prompt
 * @returns {string}        - Stringa prompt pronta per l'API
 */
export function buildPrompt(promptId, params) {
  const entry = PROMPT_REGISTRY[promptId];
  if (!entry) {
    const msg = `[aiPrompts] Prompt "${promptId}" non trovato nel registro. ID disponibili: ${Object.keys(PROMPT_REGISTRY).join(', ')}`;
    throw new Error(msg);
  }
  validateParams(entry.required, params, promptId);
  return entry.build(params);
}

// ── HELPER ANALYTICS (retrocompatibilità) ─────────────────────
export function getPromptAnalytics({ type, target, facilityName, dataPayload }) {
  const key =
    type === 'client'   && target === 'ospiti'    ? 'clienteOspiti'    :
    type === 'client'   && target === 'direzione' ? 'clienteDirezione'  :
    type === 'operator' && target === 'ospiti'    ? 'operatoreOspiti'   :
    type === 'operator' && target === 'direzione' ? 'operatoreDirezione' :
    'clienteDirezione'; // fallback
  return buildPrompt(key, { facilityName, dataPayload });
}

// ── THIN WRAPPERS (retrocompatibilità) ────────────────────────
export const buildPromptClienteOspiti    = (p) => buildPrompt('clienteOspiti',    p);
export const buildPromptClienteDirezione = (p) => buildPrompt('clienteDirezione', p);
export const buildPromptOperatoreOspiti  = (p) => buildPrompt('operatoreOspiti',  p);
export const buildPromptOperatoreDirezione = (p) => buildPrompt('operatoreDirezione', p);
export const buildPromptGlobaleBoard     = (p) => buildPrompt('globaleBoard',     p);
export const buildPromptKpiMensile       = (p) => buildPrompt('kpiMensile',       p);
export const buildPromptKpiPeriodo       = (p) => buildPrompt('kpiPeriodo',       p);
export const buildPromptHaccpManuale     = (p) => buildPrompt('haccpManuale',     p);
