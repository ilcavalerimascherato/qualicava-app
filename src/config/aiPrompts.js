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

// ── KPI ANALISI COMPARATIVA — prompt preset ────────────────────
export const kpiAnalisiComparativa = {
  completa: (data) => `Sei un esperto di qualità nelle strutture residenziali sociosanitarie (RSA) italiane. Analizza questi dati KPI mensili per ${data.count} strutture di un gruppo LTC e fornisci: 1) i 3 pattern più preoccupanti con spiegazione clinica 2) correlazioni significative tra KPI diversi 3) raccomandazioni prioritarie di intervento. Sii diretto e pratico, usa terminologia del settore LTC italiano. Anomalie rilevate: ${data.critical} critiche, ${data.warnings} avvisi. Dati: ${JSON.stringify(data.summary)}`,

  cadute: (data) => `Analizza il profilo di sicurezza e cadute di queste RSA italiane. Considera: tasso cadute/ospiti, presenza di contenzioni, rilevazione parametri, invii al PS. Commenta il rischio reale, le best practice da applicare secondo le linee guida AGENAS e i KPI sentinella da monitorare. Dati: ${JSON.stringify(data.summary)}`,

  formazione: (data) => `Analizza la situazione della formazione del personale in queste RSA. Valuta la copertura formazione HACCP e sicurezza, identifica strutture a rischio compliance normativa (D.Lgs 81/2008, Reg. CE 852/2004), segnala possibili errori di inserimento dati. Dati: ${JSON.stringify(data.summary)}`,

  outlier: (data) => `Identifica le strutture outlier in questo gruppo LTC italiano. Distingui tra anomalie da dimensione struttura (numero ospiti) e anomalie reali di qualità. Per ogni outlier: causa probabile, rischio associato, azione raccomandata. Dati: ${JSON.stringify(data.summary)}`,
};
