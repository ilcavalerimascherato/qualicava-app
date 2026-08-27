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
 * MODELLO: Claude (Anthropic) — vedi src/utils/aiClient.js
 * ─────────────────────────────────────────────────────────────
 */

import { TIPOLOGIA_OPTIONS } from './docTipologie';

// Tassonomia fissa dei temi per campagnaTemiCommenti — condivisa qui invece
// che ripetuta nel prompt, così resta un'unica fonte di verità se cambia.
const TEMI_COMMENTI_TASSONOMIA = [
  'Ristorazione / cibo',
  'Personale — organico e presenza',
  'Personale — atteggiamento e relazione',
  'Assistenza medica e infermieristica',
  'Attività ricreative',
  'Struttura, ambienti e manutenzione',
  'Igiene e pulizia',
  'Comunicazione con i familiari',
  'Servizi ancillari (lavanderia, fisioterapia, ecc.)',
];

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
- Lunghezza MASSIMA: 1 pagina A4. Sii cordiale e chiaro.
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

  // ── 8. Apertura Direttore → Ospiti (Restituzione PDF) ────────
  restituzioneAperturaClienti: {
    required: ['facilityName', 'periodo', 'topForza', 'areaAttenzione'],
    build: ({ facilityName, periodo, npsScore, topForza, areaAttenzione }) => `
Sei il Direttore della struttura "${facilityName}".
Scrivi un breve messaggio di apertura per il PDF di restituzione risultati
del questionario di soddisfazione, rivolto agli OSPITI E ALLE FAMIGLIE.

PERIODO: ${periodo}
NPS Score: ${npsScore !== null && npsScore !== undefined ? npsScore : 'non rilevato'}
Punto di forza principale: ${topForza}
Area su cui ci concentriamo: ${areaAttenzione}

REGOLE TASSATIVE:
- Lunghezza MASSIMA: 120 parole.
- Tono: caldo, diretto, autentico. Come una lettera breve.
- Apri con "Gentili ospiti e care famiglie,"
- Ringrazia per la partecipazione e cita il numero del periodo in modo naturale.
- Tocca il punto di forza e l'area di attenzione in modo GENERICO (no numeri grezzi).
- Chiudi con una frase di impegno verso il futuro.
- NON usare titoli o sezioni — testo continuo.
`.trim(),
  },

  // ── 9. Apertura Direttore → Operatori (Restituzione PDF) ─────
  restituzioneAperturaOperatori: {
    required: ['facilityName', 'periodo', 'topForza', 'areaAttenzione'],
    build: ({ facilityName, periodo, topForza, areaAttenzione }) => `
Sei il Direttore della struttura "${facilityName}".
Scrivi un breve messaggio di apertura per il PDF di restituzione risultati
del questionario di clima interno, rivolto agli OPERATORI E AL PERSONALE.

PERIODO: ${periodo}
Punto di forza principale: ${topForza}
Area su cui ci concentriamo: ${areaAttenzione}

REGOLE TASSATIVE:
- Lunghezza MASSIMA: 100 parole.
- Tono: motivante, squadra, costruttivo.
- Apri con "Cari colleghi,"
- Riconosci il contributo del team.
- Tocca il punto di forza e l'area di crescita in modo propositivo (no numeri grezzi).
- Chiudi con una frase orientata al prossimo passo insieme.
- NON usare titoli o sezioni — testo continuo.
`.trim(),
  },

  // ── 10. Sintesi del periodo → Ospiti (Documento Word Utenza) ──
  campagnaSintesiPeriodo: {
    required: ['facilityName', 'periodo', 'nRisposte', 'topAree', 'areeAttenzione'],
    build: ({ facilityName, periodo, nRisposte, topAree, areeAttenzione, npsScore }) => `
Sei il Direttore della struttura "${facilityName}".
Scrivi una breve sintesi di come è andato il periodo, da inserire nel documento
di restituzione risultati agli OSPITI E ALLE FAMIGLIE.

PERIODO: ${periodo}
QUESTIONARI RACCOLTI: ${nRisposte}
NPS: ${npsScore !== null && npsScore !== undefined ? npsScore : 'non rilevato'}
Aree andate meglio: ${topAree}
Aree su cui ci concentriamo: ${areeAttenzione}

REGOLE TASSATIVE:
- Lunghezza: 3-5 frasi, non di più.
- Tono: caldo, diretto, in prima persona (il Direttore che parla agli ospiti).
- Cita le aree andate meglio e quelle di attenzione in modo GENERICO, mai con numeri grezzi.
- NON ripetere il numero di questionari o l'NPS come cifra.
- NON usare titoli o sezioni — testo continuo, nessun elenco puntato.
`.trim(),
  },

  // ── 11. Punti di forza/debolezza → Direzione (Documento Word Direzione) ──
  campagnaPuntiDirezionali: {
    required: ['facilityName', 'campagnaNome', 'dataPayload'],
    build: ({ facilityName, campagnaNome, dataPayload }) => `
Sei un Auditor Analitico per la struttura "${facilityName}".
Analizza i risultati della campagna "${campagnaNome}" e proponi una bozza di
valutazione direzionale, da rivedere ed editare a cura del direttore prima
della pubblicazione.

DATI METRICHE (Domanda: Media/100):
${dataPayload}

REGOLE TASSATIVE:
- NESSUN paragrafo introduttivo, nessun saluto, nessuna data.
- Rispondi SOLO con le due sezioni richieste, nient'altro (niente "Obiettivi").
- Ogni sezione: 3 bullet puntati con "- ", una frase ciascuno, basati sui dati forniti.
- Tono: oggettivo, equilibrato, orientato all'azione.

Rispondi ESATTAMENTE in questo formato (due sezioni, titoli in maiuscolo):
PUNTI DI FORZA
- ...
- ...
- ...
PUNTI DI DEBOLEZZA
- ...
- ...
- ...
`.trim(),
  },

  // ── 11b. Punti di forza / aree di miglioramento → Utenza (Documento Word Utenza) ──
  // Il documento Utenza serve sia il tema clienti (Ospiti e Famiglie) sia il
  // tema operatori (Personale) — `audience` sceglie destinatario e tono senza
  // duplicare il prompt in due entry quasi identiche.
  campagnaPuntiUtenza: {
    required: ['facilityName', 'campagnaNome', 'dataPayload'],
    build: ({ facilityName, campagnaNome, dataPayload, audience = 'ospiti' }) => {
      const isOperatori = audience === 'operatori';
      const targetLabel = isOperatori ? 'PERSONALE E OPERATORI' : 'OSPITI E FAMIGLIE';
      const tono = isOperatori
        ? 'Tono: motivante, da squadra, rivolto al personale, mai burocratico.'
        : 'Tono: caldo, diretto, rivolto a ospiti e famiglie, mai tecnico o clinico.';
      return `
Sei il Direttore della struttura "${facilityName}".
Analizza i risultati della campagna "${campagnaNome}" e proponi una bozza dei
punti di forza e delle aree di miglioramento da comunicare a ${targetLabel}
nel documento di restituzione risultati, da rivedere ed editare a cura del
direttore prima della pubblicazione.

DATI METRICHE (Domanda: Media/100):
${dataPayload}

REGOLE TASSATIVE:
- NESSUN paragrafo introduttivo, nessun saluto, nessuna data.
- Rispondi SOLO con le due sezioni richieste, nient'altro.
- Ogni sezione: 2-3 bullet puntati con "- ", frasi brevi.
- NON usare numeri grezzi (score, percentuali, medie) — parla in termini qualitativi e generici.
- ${tono}

Rispondi ESATTAMENTE in questo formato (due sezioni, titoli in maiuscolo):
I NOSTRI PUNTI DI FORZA
- ...
- ...
DOVE VOGLIAMO MIGLIORARE
- ...
- ...
`.trim();
    },
  },

  // ── 11c. Azioni per il prossimo anno / Impegno → Utenza (Documento Word Utenza) ──
  campagnaAzioniImpegnoUtenza: {
    required: ['facilityName', 'campagnaNome', 'dataPayload'],
    build: ({ facilityName, campagnaNome, dataPayload, audience = 'ospiti' }) => {
      const isOperatori = audience === 'operatori';
      const targetLabel = isOperatori ? 'PERSONALE E OPERATORI' : 'OSPITI E FAMIGLIE';
      const tono = isOperatori
        ? 'Tono valoriale, di squadra e riconoscenza verso il personale.'
        : 'Tono valoriale e di vicinanza verso ospiti e famiglie.';
      return `
Sei il Direttore della struttura "${facilityName}".
Analizza i risultati della campagna "${campagnaNome}" e proponi una bozza delle
azioni per il prossimo anno e dell'impegno della struttura verso ${targetLabel},
da inserire nel documento di restituzione risultati, da rivedere ed editare a
cura del direttore prima della pubblicazione.

DATI METRICHE (Domanda: Media/100):
${dataPayload}

REGOLE TASSATIVE:
- NESSUN paragrafo introduttivo, nessun saluto, nessuna data.
- Rispondi SOLO con le due sezioni richieste, nient'altro.
- Tono PRUDENTE: esprimi intenzioni e valori generali, MAI promesse specifiche,
  scadenze, cifre o impegni operativi concreti (assunzioni, budget, orari,
  interventi puntuali) che la struttura potrebbe non riuscire a mantenere.
- "LE NOSTRE AZIONI PER IL PROSSIMO ANNO": 2-3 bullet puntati con "- ", frasi
  brevi orientate a direzioni di miglioramento generiche legate alle aree
  emerse dai dati (non impegni puntuali).
- "IL NOSTRO IMPEGNO": 2-3 frasi in un unico paragrafo continuo (NON puntato),
  ${tono}

Rispondi ESATTAMENTE in questo formato (due sezioni, titoli in maiuscolo):
LE NOSTRE AZIONI PER IL PROSSIMO ANNO
- ...
- ...
IL NOSTRO IMPEGNO
...
`.trim();
    },
  },

  // ── 11d. Obiettivi e azioni per il prossimo semestre → Direzione (Documento Word Direzione) ──
  campagnaObiettiviDirezione: {
    required: ['facilityName', 'campagnaNome', 'dataPayload'],
    build: ({ facilityName, campagnaNome, dataPayload }) => `
Sei un Auditor Analitico per la struttura "${facilityName}".
Analizza i risultati della campagna "${campagnaNome}" e proponi una bozza di
obiettivi e azioni per il prossimo semestre, da rivedere ed editare a cura del
direttore prima della pubblicazione.

DATI METRICHE (Domanda: Media/100):
${dataPayload}

REGOLE TASSATIVE:
- NESSUN paragrafo introduttivo, nessun saluto, nessuna data.
- 3-4 bullet puntati con "- ", basati sulle aree più critiche emerse dai dati.
- Tono PRUDENTE: obiettivi e direzioni di intervento realistiche, MAI impegni
  operativi specifici che l'AI non può conoscere (assunzioni, budget, importi,
  scadenze precise, nomi di persone o fornitori).
- Tono: oggettivo, orientato all'azione ma prudente.
- Rispondi SOLO con l'elenco puntato, nessun titolo (il titolo è già presente nel documento).
`.trim(),
  },

  // ── 13. Briefing mattutino → Dashboard Master ──────────────
  briefingMattutino: {
    required: ['today', 'totalFacilities', 'activeCount', 'suspendedCount', 'okCount', 'attentionCount', 'criticalCount', 'topCriticalStr'],
    build: ({ today, totalFacilities, activeCount, suspendedCount, okCount, attentionCount, criticalCount, totalOpenNc = 0, ncByRegionStr = '', topCriticalStr }) => `
Sei l'assistente AI di QualiCAVA, sistema di gestione qualità per strutture sociosanitarie italiane.
Genera un briefing mattutino conciso in italiano per il responsabile qualità di sede.

Dati aggiornati al ${today}:
- Strutture totali: ${totalFacilities} (${activeCount} attive, ${suspendedCount} sospese)
- Stato strutture attive: ${okCount} in regola, ${attentionCount} in attenzione, ${criticalCount} critiche
${totalOpenNc > 0 ? `- NC aperte totali: ${totalOpenNc}` : ''}
${ncByRegionStr ? `- NC per regione: ${ncByRegionStr}` : ''}
- Strutture più critiche: ${topCriticalStr}

Genera un briefing con questa struttura ESATTA:
1. Una frase di apertura contestuale alla situazione generale
2. Massimo 2-3 punti di attenzione specifici con nome struttura e problema concreto
3. Una frase conclusiva con il focus suggerito per la giornata

Tono: diretto, professionale. Massimo 120 parole. Testo continuo in 2-3 paragrafi — niente elenchi.
Usa il grassetto HTML <strong> solo per i nomi delle strutture critiche.
`.trim(),
  },

  // ── 14. Sunto commenti liberi → Panel Analisi Campagna ─────
  campagnaSuntoCommenti: {
    required: ['nCommenti', 'totaleQuestionari', 'percRisposta', 'testiFormattati'],
    build: ({ nCommenti, totaleQuestionari, percRisposta, testiFormattati }) => `
Sei un esperto di qualità nel settore socio-sanitario italiano.
Hai ricevuto ${nCommenti} commenti liberi su un totale di ${totaleQuestionari} questionari compilati (${percRisposta}% di risposta ai campi aperti).

COMMENTI:
${testiFormattati}

Produci una sintesi strutturata così:
1. PARTECIPAZIONE AI COMMENTI: una riga con il dato numerico (${nCommenti}/${totaleQuestionari}).
2. TEMI EMERSI: elenca i temi principali con indicazione di quante persone li hanno citato (es. "Qualità del cibo — citato da 4 persone"). Raggruppa commenti simili. Non citare commenti singoli come se fossero opinioni diffuse.
3. SEGNALI POSITIVI: max 3 punti con conteggio.
4. AREE DI ATTENZIONE: max 3 punti con conteggio.

Regola importante: se un tema è citato da 1 sola persona, indicalo esplicitamente come "segnalazione individuale". Non generalizzare mai.
Rispondi in italiano, tono professionale.
`.trim(),
  },

  // ── 12. Temi emersi dai commenti → Direzione (Documento Word Direzione) ──
  campagnaTemiCommenti: {
    required: ['facilityName', 'commentiFormattati', 'nCommenti', 'nQuestionari'],
    build: ({ facilityName, commentiFormattati, nCommenti, nQuestionari }) => `
Sei un esperto di qualità nel settore socio-sanitario italiano.
Hai ricevuto ${nCommenti} commenti liberi su ${nQuestionari} questionari compilati
dagli ospiti/famiglie della struttura "${facilityName}". Raggruppali per tema.

COMMENTI:
${commentiFormattati}

TASSONOMIA FISSA DEI TEMI (usa SOLO questi, nell'ordine dato):
${TEMI_COMMENTI_TASSONOMIA.map((t, i) => `${i + 1}. ${t}`).join('\n')}

REGOLE TASSATIVE:
- Per ogni tema TOCCATO da almeno un commento nel periodo: scrivi il nome del
  tema in maiuscolo seguito da "(N commenti)" con N = quanti commenti lo
  toccano (un commento può toccare più temi), poi 2-3 note riassuntive dei
  pareri diversi emersi, PARAFRASATE — mai copiare testualmente il commento originale.
- Ometti COMPLETAMENTE i temi non toccati da nessun commento nel periodo: non scriverli.
- Se un tema è toccato da 1 solo commento, indicalo come "segnalazione individuale".
- NON inventare conteggi non derivabili dai commenti forniti.
- NESSUN paragrafo introduttivo, nessun saluto. Inizia direttamente con il primo tema presente.
- Tono: professionale, equilibrato, orientato all'azione.
`.trim(),
  },

  // ── 15. Estrazione strutturata verbale ispettivo → Modulo Verbali Ispettivi ──
  // Unico prompt per entrambi i tipi di verbale oggi noti (sopralluogo di
  // vigilanza / controllo di appropriatezza): è l'AI stessa a classificare
  // "tipo_ispezione" leggendo il documento, invece di due prompt da
  // mantenere allineati. Output JSON (non narrativo) — validato/parsato in
  // src/utils/verbaliAiExtraction.js, non mostrato direttamente all'utente.
  estrazioneVerbaleIspettivo: {
    required: [],
    build: ({ oggi = new Date().toISOString().slice(0, 10) } = {}) => `
Sei un esperto di compliance socio-sanitaria italiana (RSA). Ricevi in allegato un
verbale di ispezione emesso da un ente di vigilanza (ATS, NAS o simile) su una
struttura RSA. Oggi è il ${oggi}.

Il verbale può essere di due tipi (riconoscibili dall'intestazione/classificazione
protocollo, es. "Class. 2.07.05" per i sopralluoghi di vigilanza, "Class. 02.07.07"
per i controlli di appropriatezza) o un tipo diverso non ancora catalogato: in quel
caso usa "altro" e compila comunque tutti i campi comuni.

ESTRAI dal documento i seguenti dati e rispondi ESCLUSIVAMENTE con un oggetto JSON
valido, nessun testo prima o dopo, nessun blocco markdown \`\`\`, secondo questo schema:

${VERBALE_EXTRACTION_SCHEMA_DESCRIPTION}

REGOLE TASSATIVE PER L'ESTRAZIONE:
- "rilievi": è la parte più importante. Estrai OGNI criticità, prescrizione,
  esito negativo (NO/N.P. quando segnalato come problema), osservazione con
  contenuto valutativo, o richiesta di documentazione specifica. RAGGRUPPA i
  rilievi simili per area tematica o per fascicolo/FASAS citato invece di creare
  una riga per ogni singolo indicatore non raggiunto: se più indicatori dello
  stesso FASAS o della stessa area hanno una criticità collegata, uniscili in
  UN SOLO rilievo con una descrizione che elenca i punti (es. "Fasas 2020003268:
  la sospensione della contenzione notturna in alcune giornate non risulta
  motivata nel diario"). Non generare un rilievo per ogni riga della checklist
  quando l'esito è positivo/conforme (SI, raggiunto) — solo per le criticità.
- Se il documento non contiene nessuna criticità esplicita (tutti gli indicatori
  raggiunti, nessuna osservazione negativa), "rilievi" può essere un array vuoto:
  non inventare problemi che non ci sono.
- NON creare un rilievo che si limita a ripetere "valutazione_sintetica" o
  l'esito generale della verifica (es. "l'esito è subordinato a ulteriori
  valutazioni") — quello è già catturato nel campo dedicato. Un rilievo deve
  sempre descrivere una criticità o richiesta specifica e concreta, non una
  parafrasi dell'esito complessivo.
- "descrizione" di ogni rilievo deve essere autosufficiente: chi la legge senza
  aprire il PDF deve capire cosa è stato contestato e perché, parafrasando (non
  necessariamente copiando testualmente) il testo del verbale.
- "scadenza_risposta": cerca esplicitamente una data limite per l'invio di
  documentazione o riscontro (es. "entro e non oltre il..."). Se il verbale
  dichiara solo che "l'esito sarà comunicato con atto successivo" senza una
  scadenza di invio documentazione a carico della struttura, lascia
  scadenza_risposta a null (non è una scadenza di risposta della struttura).
- "bozza_risposta_suggerita": solo se scadenza_risposta è valorizzata. Un testo
  breve, professionale, in italiano, pronto per essere adattato dal Direttore —
  NON firmarlo, NON inventare contenuti tecnici specifici che non conosci
  (numeri, nomi, allegati concreti): lascia questi dettagli come placeholder tra
  parentesi quadre, es. "[elencare qui la documentazione allegata]".
- Date sempre in formato ISO "YYYY-MM-DD". Se l'anno non è specificato ma
  desumibile dal contesto, deducilo; altrimenti null.
- Non includere MAI commenti, spiegazioni o testo fuori dal JSON.
`.trim(),
  },

  // ── 16. Estrazione metadati copertina da documento di contenuto → Documenti/Protocolli ──
  // Legge il testo grezzo (senza copertina) di un protocollo/procedura caricato
  // e propone i metadati per la copertina. Tutti i campi sono nullable: quello
  // che l'AI non trova resta null e viene richiesto manualmente in UI (mai
  // inventato). Output JSON, non mostrato direttamente all'utente — validato/
  // parsato in src/utils/documentoAiExtraction.js.
  estrazioneMetadatiDocumento: {
    required: ['testo'],
    build: ({ testo }) => `
Sei un assistente per la gestione documentale di una RSA italiana. Ricevi il testo
grezzo di un documento (protocollo, procedura, istruzione operativa) SENZA la
copertina istituzionale. Il tuo compito è estrarre SOLO i metadati che trovi
esplicitamente scritti nel testo, per pre-compilare la copertina.

TESTO DEL DOCUMENTO (troncato se lungo):
"""
${testo}
"""

Rispondi ESCLUSIVAMENTE con un oggetto JSON valido, nessun testo prima o dopo,
nessun blocco markdown, secondo questo schema:
{
  "titolo": string|null,              // titolo del documento, di solito nelle prime righe
  "codice_documento": string|null,    // codice/sigla del documento, se presente (es. "PCA-012"), spesso in intestazione o piè di pagina
  "tipologia_documento": string|null, // DEVE essere uno di questi valori esatti, o null se non deducibile: ${TIPOLOGIA_OPTIONS.map(t => `"${t}"`).join(', ')}
  "elaborata_da": string|null,        // nome/ruolo di chi ha redatto il documento, SOLO se esplicitamente scritto nel testo
  "verificata_da": string|null,       // nome/ruolo di chi ha verificato, SOLO se esplicitamente scritto nel testo
  "approvato_da": string|null         // nome/ruolo di chi ha approvato, SOLO se esplicitamente scritto nel testo
}

REGOLE TASSATIVE:
- NON INVENTARE MAI un valore. Se un campo non è chiaramente presente nel testo,
  usa null — è preferibile null a un valore indovinato, perché l'utente dovrà
  compilare a mano solo i campi che restano null.
- "codice_documento" solo se è un vero codice/sigla identificativo (es. "PCA-012",
  "PROC-045"), non un numero di pagina o una data.
- "tipologia_documento" solo se puoi sceglierlo con ragionevole certezza tra i
  valori elencati sopra guardando struttura/contenuto del testo; altrimenti null.
- Non includere MAI commenti, spiegazioni o testo fuori dal JSON.
`.trim(),
  },

};

// Schema JSON atteso dal prompt "estrazioneVerbaleIspettivo" — esportato a
// parte (non solo interpolato nel prompt) così src/utils/verbaliAiExtraction.js
// può riferirlo per documentazione/validazione senza duplicarlo.
export const VERBALE_EXTRACTION_SCHEMA_DESCRIPTION = `{
  "tipo_ispezione": "sopralluogo_vigilanza" | "controllo_appropriatezza" | "altro",
  "classificazione_originale": string|null,   // es. "2.07.05" o "02.07.07" letto dall'intestazione
  "ente": string|null,                        // es. "ATS Città Metropolitana di Milano"
  "numero_verbale": string|null,
  "data_sopralluogo": "YYYY-MM-DD"|null,
  "ora_sopralluogo": "HH:MM"|null,
  "cudes": string|null,                       // codice Cudes della struttura, se presente
  "struttura_nome_da_verbale": string|null,
  "team_ispettivo": [{"nominativo": string, "qualifica": string, "struttura_appartenenza": string|null}],
  "presenti_ente_gestore": [{"nominativo": string, "qualifica": string}],
  "tipo_verifica": string|null,                // solo Tipo A: mantenimento requisiti / segnalazione / altro
  "azioni_intraprese": [string]|null,          // solo Tipo B: elenco checkbox spuntate
  "valutazione_sintetica": "in_possesso_requisiti" | "subordinato_valutazioni" | "non_in_possesso" | null,
  "riepilogo_indicatori": {
    "totale_fascicoli_esaminati": number|null,
    "indicatori_raggiunti": number|null,
    "indicatori_non_raggiunti": number|null,
    "indicatori_non_pertinenti": number|null,
    "percentuale": number|null
  },
  "osservazioni_raw": string,                  // testo narrativo "Osservazioni"/"Osservazioni sui Fascicoli", verbatim o quasi
  "checklist_grezza": object,                  // libero: area/indicatore -> esito, solo per riferimento, NON deve duplicare i rilievi
  "rilievi": [
    {
      "tipo": "prescrizione" | "osservazione" | "criticita_fasas" | "richiesta_documentazione",
      "area_tematica": string,                 // es. "Contenzione fisica", "Requisiti organizzativi", "Lesioni da pressione"
      "riferimento_fasas": string|null,
      "riferimento_indicatore": string|null,
      "descrizione": string,                   // parafrasato, chiaro, autosufficiente senza dover rileggere il PDF
      "gravita_suggerita": "Bassa" | "Media" | "Alta" | null
    }
  ],
  "documentazione_richiesta": string|null,
  "scadenza_risposta": "YYYY-MM-DD"|null,
  "indirizzo_invio_risposta": string|null,
  "oggetto_pec_suggerito": string|null,
  "responsabile_istruttoria": {"nome": string|null, "telefono": string|null, "email": string|null},
  "bozza_risposta_suggerita": string|null      // solo se scadenza_risposta presente
}`;

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
