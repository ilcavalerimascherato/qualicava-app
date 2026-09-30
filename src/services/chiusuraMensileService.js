// src/services/chiusuraMensileService.js
// Import del file di chiusura mensile P&L prodotto dal CDG (un file = una
// struttura, un foglio con tre blocchi di colonne affiancati: PY actual, CY
// actual, CY budget). Stesso principio di occupazioneImportService.js: ogni
// funzione lancia l'errore, non lo gestisce — tocca al chiamante (UI).
import * as XLSX from 'xlsx';
import { supabase } from '../supabaseClient';

const log = (action, details = {}) => {
  supabase.auth.getSession()
    .then(({ data: { session } }) =>
      supabase.from('logs').insert([{
        user_email: session?.user?.email ?? 'unknown',
        action,
        details,
      }])
    )
    .catch(err => console.warn('[log] fallito silenziosamente:', err));
};

// Righe del conto economico da estrarre — chiave interna -> etichetta esatta
// (dopo rimozione di un eventuale prefisso numerico "NN. ") così da matchare
// per contenuto invece che per numero di riga, che cambia da file a file.
const PL_ROWS = {
  ricavi:               'RICAVI',
  global_service:       'GLOBAL SERVICE',
  costi_personale:       'COSTI DEL PERSONALE',
  consulenze:            'CONSULENZE',
  servizi_manutenzioni:  'COSTI PER SERVIZI E MANUTENZIONI',
  utenze:                'UTENZE',
  locazioni:              'LOCAZIONI',
  ebitda:                 'EBITDA',
};

const REQUIRED_KPI_ROWS = {
  totale_giornate:             'TOTALE GIORNATE',
  giornate_occupate:           'TOTALE GIORNATE OCCUPATE',
  costo_locazione_pl_occupato: 'COSTO LOCAZIONE PER POSTO LETTO OCCUPATO',
  ricavi_pl_occupato:          'RICAVI PER POSTO LETTO OCCUPATO (MENSILE)',
};

// Voci "di servizio" — confermato sul campo che il modello CDG NON è
// uniforme tra strutture: alcune esternalizzano la ristorazione (etichetta
// "...ESTERNA"), altre la gestiscono internamente con un'etichetta diversa
// ("...GIORNATA ALIMENTARE (INTERNA)"), altre ancora non hanno affatto la
// riga lavanderia (es. Roma Aris) o chiamano le giornate alimentari in modo
// diverso (Villa Lina: "Nr. Giornate Alimentari (Fattura)"). Più alias per
// chiave, provati in ordine — se nessuno matcha il valore resta null, MAI
// un errore bloccante per l'intero import: sono voci accessorie, non il
// conto economico.
const OPTIONAL_ROWS = {
  costo_medio_lavanderia:   ['COSTO MEDIO SERVIZIO LAV. & NOL. BIANCHERIA'],
  costo_medio_ristorazione: ['COSTO MEDIO SERVIZIO RISTORAZIONE (ESTERNA)', 'COSTO MEDIO GIORNATA ALIMENTARE (INTERNA)'],
  giornata_alimentare:      ['GIORNATA ALIMENTARE', 'NR. GIORNATE ALIMENTARI (FATTURA)'],
};

const REQUIRED_ROWS = { ...PL_ROWS, ...REQUIRED_KPI_ROWS };
const ALL_ROW_KEYS = [...Object.keys(REQUIRED_ROWS), ...Object.keys(OPTIONAL_ROWS)];

function normalizeLabel(v) {
  return String(v ?? '').trim().replace(/^\d+\.\s*/, '').replace(/\s+/g, ' ').toUpperCase();
}

export function toNumber(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const n = parseFloat(String(v).trim().replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function excelDateToJsDate(v) {
  if (v == null) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'number') {
    // Seriale Excel plausibile per una data (giorni dal 1899-12-30, stesso
    // epoch usato da XLSX) — esclude numeri piccoli come 0/1 che altrimenti
    // "convertirebbero" in date vicine al 1899 e farebbero scattare falsi
    // positivi nel riconoscimento della riga delle date.
    if (v < 20000 || v > 80000) return null;
    return new Date(Math.round((v - 25569) * 86400 * 1000));
  }
  if (typeof v !== 'string' || !v.trim()) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Legge il foglio "ACT <anno>" del file di chiusura e lo converte nella
 * griglia grezza (array di array), pronta per l'estrazione posizionale.
 */
export async function readChiusuraGrid(file) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  // Il file porta anche un foglio "ACT <anno-1>" più semplice (solo raffronto
  // storico) accanto a quello vero e proprio con i tre blocchi affiancati —
  // si prende sempre l'anno più recente tra i fogli che matchano il pattern.
  const actSheets = workbook.SheetNames
    .map(n => ({ name: n, match: n.trim().match(/^ACT\s?(\d{4})$/i) }))
    .filter(x => x.match)
    .sort((a, b) => Number(b.match[1]) - Number(a.match[1]));
  const sheetName = actSheets[0]?.name;
  if (!sheetName) {
    throw new Error('Foglio "ACT <anno>" non trovato nel file — formato non riconosciuto.');
  }
  const grid = sheetToAbsoluteGrid(workbook.Sheets[sheetName]);
  return { grid, sheetName };
}

// sheet_to_json({header:1}) compatta le colonne a partire dalla prima
// colonna USATA del foglio, non dalla colonna A — questo file ha range
// utilizzato che parte da B (dims "B1:CB63"), quindi con sheet_to_json gli
// indici di riga/colonna non corrisponderebbero a quelli "naturali" del
// foglio (rischio di bug silenzioso se il range cambia da file a file).
// Si costruisce quindi la griglia leggendo le celle direttamente dal range
// dichiarato (sheet['!ref']), con indici assoluti (0 = colonna A / riga 1).
function sheetToAbsoluteGrid(sheet) {
  const range = XLSX.utils.decode_range(sheet['!ref']);
  const grid = [];
  for (let r = 0; r <= range.e.r; r++) {
    const row = [];
    for (let c = 0; c <= range.e.c; c++) {
      row[c] = sheet[XLSX.utils.encode_cell({ r, c })]?.v ?? null;
    }
    grid[r] = row;
  }
  return grid;
}

/**
 * Individua le righe del conto economico/KPI per etichetta, cercando in
 * tutte le colonne di ogni riga (non una colonna fissa) — robusto anche se
 * il range utilizzato del foglio non parte dalla colonna A.
 */
const LABEL_COL_SEARCH_RANGE = 6; // le etichette vivono nelle prime colonne del blocco, ma la colonna esatta può variare da file a file

// Scansiona l'intero foglio e ritorna, per ogni etichetta cercata, la prima
// riga la cui colonna (nelle prime LABEL_COL_SEARCH_RANGE) normalizzata è
// uguale al target. Una singola passata su tutta la griglia raccoglie i
// match di TUTTE le etichette passate in un colpo solo (più veloce che
// riscansionare il foglio una volta per etichetta).
function findLabelRows(grid, targets) {
  const found = {};
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < Math.min(LABEL_COL_SEARCH_RANGE, grid[r]?.length ?? 0); c++) {
      const label = normalizeLabel(grid[r][c]);
      if (!label || !targets.has(label) || found[label] != null) continue;
      found[label] = r;
    }
  }
  return found;
}

// Etichetta leggibile per chiedere all'operatore "a quale riga corrisponde
// [questo]?" quando nessun alias conosciuto matcha — vedi extractChiusura.
export const OPTIONAL_ROW_LABELS = {
  costo_medio_lavanderia:   'Costo medio servizio lavanderia',
  costo_medio_ristorazione: 'Costo medio ristorazione / giornata alimentare',
  giornata_alimentare:      'Totale giornate alimentari erogate',
};

function locateRows(grid) {
  const rowIndexByKey = {};

  const requiredTargets = new Set(Object.values(REQUIRED_ROWS));
  const requiredHits = findLabelRows(grid, requiredTargets);
  const missing = [];
  for (const [key, label] of Object.entries(REQUIRED_ROWS)) {
    if (requiredHits[label] != null) rowIndexByKey[key] = requiredHits[label];
    else missing.push(key);
  }
  if (missing.length) {
    throw new Error(`Righe non trovate nel foglio: ${missing.join(', ')}. Il modello del file potrebbe essere cambiato.`);
  }

  // Mai indovinare una riga ambigua (es. "Totale" ricorre più volte con
  // significati diversi nello stesso foglio): se nessun alias conosciuto
  // matcha, la chiave finisce in unmatchedOptional e tocca all'operatore
  // confermare quale riga usare (vedi extractChiusura + ImportChiusuraModal).
  const optionalTargets = new Set(Object.values(OPTIONAL_ROWS).flat());
  const optionalHits = findLabelRows(grid, optionalTargets);
  const unmatchedOptional = [];
  for (const [key, aliases] of Object.entries(OPTIONAL_ROWS)) {
    const alias = aliases.find(a => optionalHits[a] != null);
    if (alias) rowIndexByKey[key] = optionalHits[alias];
    else unmatchedOptional.push(key);
  }

  return { rowIndexByKey, unmatchedOptional };
}

/**
 * Tutte le righe etichettate del foglio (prima colonna non vuota nelle
 * prime LABEL_COL_SEARCH_RANGE) — la lista da cui l'operatore sceglie
 * manualmente quando una chiave opzionale resta senza match automatico.
 * `excludeRowIndexes` toglie le righe già assegnate ad altre chiavi, per
 * non proporre due volte la stessa riga.
 */
export function listCandidateRows(grid, excludeRowIndexes = []) {
  const excluded = new Set(excludeRowIndexes);
  const rows = [];
  for (let r = 0; r < grid.length; r++) {
    if (excluded.has(r)) continue;
    for (let c = 0; c < LABEL_COL_SEARCH_RANGE; c++) {
      const raw = grid[r]?.[c];
      if (raw != null && String(raw).trim()) {
        rows.push({ rowIndex: r, label: String(raw).trim() });
        break;
      }
    }
  }
  return rows;
}

/**
 * Individua i tre blocchi di colonne mensili (PY actual, CY actual, CY
 * budget) scansionando le righe di intestazione — nessuna colonna
 * hardcoded, il numero di mesi già chiusi varia da file a file.
 * Le righe di intestazione (scenario, granularità, data) sono cercate nelle
 * prime ~6 righe del foglio invece di assumerne la posizione esatta.
 */
export function locateColumnBlocks(grid) {
  let scenarioRow = -1, granRow = -1, dateRow = -1;
  for (let r = 0; r < Math.min(grid.length, 8); r++) {
    const row = grid[r] ?? [];
    const texts = row.map(v => String(v ?? '').trim().toLowerCase());
    if (scenarioRow < 0 && texts.some(t => t === 'actual' || t === 'bdgt' || t === 'py')) scenarioRow = r;
    if (granRow < 0 && texts.some(t => t === 'mtd' || t === 'ytd')) granRow = r;
    // La riga delle date vere e proprie ne ha molte affiancate — una singola
    // cella "data-simile" isolata altrove (es. il timbro della chiusura in
    // testa al foglio) non deve far scattare un falso positivo.
    if (dateRow < 0 && row.filter(v => excelDateToJsDate(v) instanceof Date).length >= 3) dateRow = r;
  }
  if (scenarioRow < 0 || granRow < 0 || dateRow < 0) {
    throw new Error('Intestazioni delle colonne non riconosciute — formato del file non atteso.');
  }

  // Anno di chiusura: dalla cella data più recente in riga "YTD".
  const ytdDates = grid[dateRow]
    .map((v, c) => (String(grid[granRow]?.[c] ?? '').trim().toLowerCase() === 'ytd' ? excelDateToJsDate(v) : null))
    .filter(Boolean);
  if (!ytdDates.length) throw new Error('Impossibile determinare l\'anno di chiusura dal file.');
  const annoChiusura = Math.max(...ytdDates.map(d => d.getFullYear()));
  const meseChiusura = ytdDates.find(d => d.getFullYear() === annoChiusura)?.getMonth() + 1;

  const blocks = { py: [], actual: [], budget: [] };
  const nCols = grid[dateRow]?.length ?? 0;
  for (let c = 0; c < nCols; c++) {
    const scenario = String(grid[scenarioRow]?.[c] ?? '').trim().toLowerCase();
    const gran = String(grid[granRow]?.[c] ?? '').trim().toLowerCase();
    const date = excelDateToJsDate(grid[dateRow]?.[c]);
    if (gran !== 'mtd' || !date) continue;
    const mese = date.getMonth() + 1;
    if (scenario === 'actual' && date.getFullYear() === annoChiusura - 1) blocks.py.push({ mese, col: c });
    else if (scenario === 'actual' && date.getFullYear() === annoChiusura) blocks.actual.push({ mese, col: c });
    else if (scenario === 'bdgt' && date.getFullYear() === annoChiusura) blocks.budget.push({ mese, col: c });
  }

  return { annoChiusura, meseChiusura, blocks };
}

/**
 * Estrae dal foglio i valori mensili per le tre serie (py/actual/budget),
 * senza scrivere nulla — pronta per l'anteprima in UI.
 *
 * manualRowOverrides: { [chiave opzionale]: rowIndex | 'skip' } — mapping
 * confermato dall'operatore per le chiavi che extractChiusura non è
 * riuscita a matchare da sola (vedi unmatchedOptional nel risultato).
 * 'skip' = confermato che questa struttura non ha quella voce, non chiedere
 * più. Un rowIndex numerico usa quella riga come se fosse un alias trovato.
 */
export function extractChiusura(grid, manualRowOverrides = {}) {
  const { rowIndexByKey, unmatchedOptional } = locateRows(grid);
  for (const [key, override] of Object.entries(manualRowOverrides)) {
    if (typeof override === 'number') rowIndexByKey[key] = override;
  }
  const stillUnmatched = unmatchedOptional.filter(key => manualRowOverrides[key] == null);

  const { annoChiusura, meseChiusura, blocks } = locateColumnBlocks(grid);

  const buildSeries = (colsForScenario, anno) =>
    colsForScenario
      .sort((a, b) => a.mese - b.mese)
      .map(({ mese, col }) => {
        const values = {};
        for (const key of ALL_ROW_KEYS) {
          values[key] = toNumber(grid[rowIndexByKey[key]]?.[col]);
        }
        return { anno, mese, values };
      });

  // Il blocco "Actual" dell'anno in corso copre sempre tutte e 12 le colonne
  // mensili del foglio, ma i mesi dopo la chiusura sono segnaposto a zero
  // (non "non ancora disponibili" — proprio 0), non actual veri: si tagliano
  // qui, altrimenti verrebbero salvati come mesi chiusi a zero. Budget e PY
  // restano su tutti i 12 mesi (pianificazione nota in anticipo/anno già
  // chiuso per intero).
  const actualSeries = buildSeries(blocks.actual, annoChiusura).filter(e => e.mese <= meseChiusura);

  return {
    annoChiusura,
    meseChiusura,
    py:     buildSeries(blocks.py, annoChiusura - 1),
    actual: actualSeries,
    budget: buildSeries(blocks.budget, annoChiusura),
    rowIndexByKey,
    unmatchedOptional: stillUnmatched,
  };
}

/**
 * Converte l'estrazione in righe pronte per l'upsert su
 * chiusura_mensile_struttura. I mesi "py" diventano righe scenario='actual'
 * dell'anno precedente — vedi nota nella migration.
 */
export function buildChiusuraRows(extraction, facilityId, companyId, userId) {
  const now = new Date().toISOString();
  const toRow = (entry, scenario) => ({
    facility_id: facilityId,
    company_id: companyId ?? null,
    anno: entry.anno,
    mese: entry.mese,
    scenario,
    ...entry.values,
    imported_at: now,
    imported_by: userId ?? null,
  });

  return [
    ...extraction.py.map(e => toRow(e, 'actual')),
    ...extraction.actual.map(e => toRow(e, 'actual')),
    ...extraction.budget.map(e => toRow(e, 'budget')),
  ];
}

const CHUNK_SIZE = 300;

export async function importChiusuraMensile(rows, userId) {
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase
      .from('chiusura_mensile_struttura')
      .upsert(chunk, { onConflict: 'facility_id,anno,mese,scenario' });
    if (error) throw error;
  }

  const periodi = Array.from(new Set(rows.map(r => `${r.scenario} ${r.anno}-${String(r.mese).padStart(2, '0')}`))).sort();
  log('IMPORT_CHIUSURA_MENSILE', { facilityId: rows[0]?.facility_id, righeImportate: rows.length, periodi, userId });

  return { righeImportate: rows.length, periodi };
}
