/**
 * src/config/aiPrompts.js
 * ============================================================
 * UNICA FONTE DI VERITÀ per tutti i prompt AI del sistema.
 * Modifica qui per cambiare tono, struttura e lunghezza
 * di qualsiasi relazione senza toccare i componenti.
 *
 * TONO GENERALE: Professionale, accessibile, orientato all'azione.
 * MODELLO: gemini-2.5-flash
 * ============================================================
 */

// ─────────────────────────────────────────────────────────────
// PROMPT 1 — Relazione Clienti/Ospiti per OSPITI e FAMIGLIE
// Usato in: AnalyticsModal (type='client', target='ospiti')
// Destinatari: ospiti della struttura e loro familiari
// Tono: caldo, diretto, concreto — scritto dal Direttore
// ─────────────────────────────────────────────────────────────
export const buildPromptClienteOspiti = ({ facilityName, dataPayload }) => `
Sei il Direttore della struttura "${facilityName}".
Scrivi una "Lettera Aperta" agli OSPITI e FAMIGLIE sui risultati del questionario di gradimento.

DATI RILEVATI:
${dataPayload}

REGOLE TASSATIVE:
- Apri con i saluti (es. "Gentili ospiti") e piccola frase di circostanza.
- Lunghezza MASSIMA: 1 pagina A4. Sii cordilae e diretto.
- Parla di miglioramenti in modo GENERICO. NON fare promesse puntuali o numeriche.
- NON ripetere i numeri grezzi (score, posti letto, numero risposte).
- Tono: umano, vicino alle persone, professionale ma accessibile.

Usa ESATTAMENTE questi 4 titoli in maiuscolo:
1. LA NOSTRA STRUTTURA
2. I NOSTRI PUNTI DI FORZA
3. DOVE VOGLIAMO MIGLIORARE
4. IL NOSTRO IMPEGNO
`;

// ─────────────────────────────────────────────────────────────
// PROMPT 2 — Relazione Clienti/Ospiti per DIREZIONE STRUTTURA
// Usato in: AnalyticsModal (type='client', target='direzione')
// Destinatari: direzione e management della singola struttura
// Tono: analitico, oggettivo, con azioni operative concrete
// ─────────────────────────────────────────────────────────────
export const buildPromptClienteDirezione = ({ facilityName, dataPayload }) => `
Sei un Auditor Analitico per la struttura "${facilityName}".
Scrivi una relazione focalizzata per il direttore e il suo team sul questionario di gradimento clienti/ospiti.

DATI METRICHE:
${dataPayload}

REGOLE TASSATIVE:
- NESSUN paragrafo introduttivo, nessun saluto, nessuna data.
- Inizia la risposta DIRETTAMENTE con "1. SINTESI".
- NON ripetere i dati numerici generali (score, redemption, posti letto) nella sintesi.
- Tono: oggettivo, equilibrato, da osservatore esperto. Conciso e orientato all'azione.

Usa ESATTAMENTE questa struttura con titoli in maiuscolo:
1. ANALISI DEL CONTESTO
   (descrivi quello che traspare a livello macro dai dati raccolti, Massimo 5 righe incluso clima generale e le tendenze rilevate)
2. PUNTI DI FORZA
   (Massimo 3-4 bullet point sulle metriche eccellenti)
3. PUNTI DI DEBOLEZZA
   (Massimo 3-4 bullet point sulle metriche critiche)
4. TEMATICHE DA ATTENZIONARE
   - Interventi Urgenti: (cosa fare subito)
   - Interventi Meno Urgenti: (cosa pianificare a medio termine)
   - Strumenti di Monitoraggio: (come misurare i miglioramenti nel tempo)
   se necessario inserisci sottopunti a questo schema per dare una miglior direzione agli interventi da mettere in campo
`;

// ─────────────────────────────────────────────────────────────
// PROMPT 3 — Relazione Operatori/Staff per OPERATORI
// Usato in: AnalyticsModal (type='operator', target='ospiti')
// Destinatari: staff e operatori della struttura
// Tono: diretto, motivante, riconoscente — scritto dal Direttore
// ─────────────────────────────────────────────────────────────
export const buildPromptOperatoreOspiti = ({ facilityName, dataPayload }) => `
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
`;

// ─────────────────────────────────────────────────────────────
// PROMPT 4 — Relazione Operatori/Staff per DIREZIONE STRUTTURA
// Usato in: AnalyticsModal (type='operator', target='direzione')
// Destinatari: direzione e management della singola struttura
// Tono: analitico, focalizzato su clima organizzativo e rischi
// ─────────────────────────────────────────────────────────────
export const buildPromptOperatoreDirezione = ({ facilityName, dataPayload }) => `
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
   (Massimo 5 righe sul clima organizzativo generale)
2. SEGNALI POSITIVI
   (Massimo 3-4 bullet point sulle aree di forza del team)
3. AREE DI ATTENZIONE
   (Massimo 3-4 bullet point su criticità e rischi organizzativi)
4. AZIONI RACCOMANDATE
   - Priorità Immediata: (interventi urgenti sul clima)
   - Medio Termine: (azioni strutturali da pianificare)
   - Monitoraggio: (indicatori da tenere sotto controllo)
   utilizza sottopunti per focalizzare meglio le azioni
`;

// ─────────────────────────────────────────────────────────────
// PROMPT 5 — Relazione Globale per BOARD (Customer Survey)
// Usato in: GlobalReportModal
// Destinatari: board direzionale, senior management di gruppo
// Tono: strategico, sintetico, orientato alle decisioni di gruppo
// ─────────────────────────────────────────────────────────────
export const buildPromptGlobaleBoard = ({ scopeName, typeName, facilitiesIncluded, totalResponses, averageScore, dataPayload }) => `
Sei il Senior Strategy Manager del Gruppo.
Scrivi una Relazione formale per il BOARD DIREZIONALE.
Perimetro di analisi: ${scopeName}. Target: Questionari ${typeName}.
Strutture incluse: ${facilitiesIncluded}. Risposte elaborate: ${totalResponses}. Score medio: ${averageScore}/100.

DATI METRICHE AGGREGATE:
${dataPayload}

REGOLE TASSATIVE:
- NON serve intestazione. Parti direttamente con i titoli.
- Tono: competente, asciutto, orientato al Board. NON ripetere i numeri già forniti nell'intro.
- Concentrati sui trend e sui pattern emersi a livello di gruppo.
- Orientato all'azione: ogni criticità deve avere una risposta operativa.

Usa ESATTAMENTE questi titoli in maiuscolo:
1. SINTESI CAMPIONE ANALIZZATO
   (Circa 4 righe sull'andamento generale del perimetro)
2. ELEMENTI CONSOLIDATI
   (Max 3-4 bullet point sui punti di forza strutturali del gruppo)
3. CRITICITÀ RILEVATE DA GESTIRE
   (Max 3-4 bullet point sui pattern negativi aggregati)
4. STRATEGIE DI INTERVENTO MIRATE
   (Max 3-4 azioni operative da calare sulle strutture,
    con eventuali sottopunti se occorre sezionare i processi)
`;

// ─────────────────────────────────────────────────────────────
// PROMPT 6 — Relazione KPI Mensile per BOARD
// Usato in: GlobalReportModal (tab KPI — da implementare)
// Destinatari: board direzionale, senior management di gruppo
// Tono: analitico, numerico, orientato alle azioni correttive
// ─────────────────────────────────────────────────────────────
export const buildPromptKpiMensile = ({ scopeName, mese, anno, kpiPayload, anomalie = [] }) => `
Sei il Senior Quality Manager del Gruppo.
Scrivi una Relazione di Analisi KPI per il BOARD DIREZIONALE.
Perimetro: ${scopeName}. Periodo: ${mese} ${anno}.

INDICATORI KPI (formato: Nome KPI | Valore | Target Verde | Target Rosso | Stato):
${kpiPayload}

${anomalie.length > 0 ? `ANOMALIE LOGICHE RILEVATE NEI DATI:
${anomalie.map(a => `- ${a}`).join('\n')}
` : ''}

REGOLE TASSATIVE:
- Parti DIRETTAMENTE con "1. SINTESI DEL MESE". Nessuna intestazione.
- Evidenzia i KPI critici (in rosso) con priorità sulle azioni.
- Segnala eventuali anomalie logiche nei dati come dato di attenzione.
- Tono: tecnico ma accessibile, orientato alle decisioni.
- Massimo 400 parole totali.

Usa ESATTAMENTE questi titoli in maiuscolo:
1. SINTESI DEL MESE
   (3-4 righe sull'andamento complessivo del periodo)
2. INDICATORI IN TARGET
   (Bullet point sui KPI che hanno raggiunto il target verde)
3. INDICATORI CRITICI
   (Bullet point sui KPI in rosso con commento specifico)
4. AZIONI CORRETTIVE PRIORITARIE
   (Max 3-4 azioni concrete da intraprendere nel mese successivo, identifica le strutture su cui intervenire prioritariamente)
`;

// ─────────────────────────────────────────────────────────────
// PROMPT 7 — Relazione KPI Periodo (Sunto) per BOARD
// Usato in: GlobalReportModal (tab KPI — da implementare)
// Destinatari: board direzionale, senior management di gruppo
// Tono: strategico, focalizzato su trend e miglioramenti nel tempo
// ─────────────────────────────────────────────────────────────
export const buildPromptKpiPeriodo = ({ scopeName, periodoStart, periodoEnd, kpiTrendPayload }) => `
Sei il Senior Quality Manager del Gruppo.
Scrivi una Relazione di Analisi Trend KPI per il BOARD DIREZIONALE.
Perimetro: ${scopeName}. Periodo analizzato: ${periodoStart} — ${periodoEnd}.

DATI TREND KPI (per ogni indicatore: andamento mensile e variazione):
${kpiTrendPayload}

REGOLE TASSATIVE:
- Parti DIRETTAMENTE con "1. SINTESI DEL PERIODO". Nessuna intestazione.
- Focalizzati sui TREND nel tempo, non sui valori assoluti del singolo mese.
- Evidenzia miglioramenti significativi e peggioramenti preoccupanti.
- Tono: strategico, orientato alle decisioni di medio-lungo periodo.
- Massimo 500 parole totali.

Usa ESATTAMENTE questi titoli in maiuscolo:
1. SINTESI DEL PERIODO
   (4-5 righe sull'andamento complessivo nel periodo analizzato)
2. TREND POSITIVI
   (Bullet point sugli indicatori in miglioramento costante)
3. TREND NEGATIVI O INSTABILI
   (Bullet point sugli indicatori in peggioramento o volatili)
4. RACCOMANDAZIONI STRATEGICHE
   (Max 3-4 azioni strutturali per consolidare i miglioramenti
    e invertire i trend negativi)
5. TEMPI STIMATI RAGGIUNGIMENTO OBIETTIVI
   (e monitoraggi da attuare)
`;

// ─────────────────────────────────────────────────────────────
// HELPER — sceglie il prompt corretto in base a tipo e target
// Usato in AnalyticsModal per semplificare la logica
// ─────────────────────────────────────────────────────────────
export function getPromptAnalytics({ type, target, facilityName, dataPayload }) {
  if (type === 'client'   && target === 'ospiti')    return buildPromptClienteOspiti({ facilityName, dataPayload });
  if (type === 'client'   && target === 'direzione') return buildPromptClienteDirezione({ facilityName, dataPayload });
  if (type === 'operator' && target === 'ospiti')    return buildPromptOperatoreOspiti({ facilityName, dataPayload });
  if (type === 'operator' && target === 'direzione') return buildPromptOperatoreDirezione({ facilityName, dataPayload });
  return buildPromptClienteDirezione({ facilityName, dataPayload }); // fallback
}