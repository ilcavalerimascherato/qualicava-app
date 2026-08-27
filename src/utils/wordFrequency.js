/**
 * src/utils/wordFrequency.js
 * ─────────────────────────────────────────────────────────────
 * Tokenizzazione e conteggio frequenze per la word cloud dei commenti
 * liberi (Fase 3 "Soddisfazione", §3 del documento di redesign /report).
 * Costruita in-house (nessuna libreria word cloud installata, decisione
 * confermata con l'utente): tokenizzazione semplice + stopword italiane +
 * conteggio, nessun NLP/stemming — trasparente e verificabile.
 *
 * Completamente agnostico rispetto a React.
 * ─────────────────────────────────────────────────────────────
 */

// Stopword italiane comuni (articoli, preposizioni, congiunzioni, verbi
// ausiliari, avverbi generici) — lista pragmatica, non esaustiva.
const STOPWORDS = new Set([
  'il','lo','la','i','gli','le','un','uno','una','del','dello','della','dei','degli','delle',
  'al','allo','alla','ai','agli','alle','dal','dallo','dalla','dai','dagli','dalle',
  'nel','nello','nella','nei','negli','nelle','sul','sullo','sulla','sui','sugli','sulle',
  'di','a','da','in','con','su','per','tra','fra','e','o','ma','se','che','chi','cui','non',
  'più','molto','poco','tutto','tutti','tutte','anche','come','quando','dove','perché','perche',
  'sono','è','e\'','era','stato','stata','stati','state','essere','avere','ho','hai','ha','abbiamo','avete','hanno',
  'io','tu','lui','lei','noi','voi','loro','mio','mia','miei','mie','tuo','tua','tuoi','tue',
  'suo','sua','suoi','sue','nostro','nostra','nostri','nostre','vostro','vostra','vostri','vostre',
  'questo','questa','questi','queste','quello','quella','quelli','quelle','si','ci','vi','ne','mi','ti',
  'ed','od','pero','però','quindi','cosi','così','ogni','alcuni','alcune','altro','altra','altri','altre',
  'bene','male','molto','poco','via','qui','qua','li','là','ecco','solo','ancora','già','giu','giù','su',
  // Forme elise (dell'ospite, all'interno, nell'attesa, quest'anno, sull'onda,
  // un'attività...): il tokenizer spezza sull'apostrofo, quindi il frammento
  // prima dell'apice va in lista a parte dalla sua forma piena.
  'dell','all','nell','sull','dall','quest','un',
]);

const MIN_WORD_LENGTH = 3;
const TOKEN_REGEX = /[a-zàèéìòù]+/gi;

/**
 * Tokenizza un testo italiano: minuscolo, rimuove punteggiatura/numeri,
 * scarta stopword e parole troppo corte.
 * @param {string} text
 * @returns {string[]}
 */
export function tokenize(text) {
  if (!text) return [];
  const matches = text.toLowerCase().match(TOKEN_REGEX) ?? [];
  return matches.filter(w => w.length >= MIN_WORD_LENGTH && !STOPWORDS.has(w));
}

/**
 * Conta le frequenze delle parole su un array di testi.
 * @param {string[]} texts
 * @param {number} [topN=60] - massimo numero di parole restituite
 * @returns {Array<{ word: string, count: number }>} ordinato per frequenza decrescente
 */
export function computeWordFrequencies(texts, topN = 60) {
  const counts = new Map();
  (texts ?? []).forEach(text => {
    tokenize(text).forEach(word => {
      counts.set(word, (counts.get(word) ?? 0) + 1);
    });
  });

  return [...counts.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);
}
