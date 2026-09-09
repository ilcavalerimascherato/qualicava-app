// src/services/occupazioneImportService.js
// Regola fondamentale: ogni service lancia l'errore, non lo gestisce.
// La gestione (toast, UI) spetta al chiamante.

import * as XLSX from 'xlsx';
import { supabase } from '../supabaseClient';

// ─── Log service (fire-and-forget, stesso pattern di supabaseService.js) ──
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

const MESE_MAP = {
  gen: 1, feb: 2, mar: 3, apr: 4, mag: 5, giu: 6,
  lug: 7, ago: 8, set: 9, ott: 10, nov: 11, dic: 12,
};

function parseMese(v) {
  if (v == null) return null;
  if (typeof v === 'number') return v >= 1 && v <= 12 ? v : null;
  const key = String(v).trim().slice(0, 3).toLowerCase();
  return MESE_MAP[key] ?? null;
}

// Celle Excel numeriche arrivano già come number; testo con virgola decimale
// ("59,8") viene comunque gestito per robustezza (es. celle formattate come testo).
function toNumber(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const n = parseFloat(String(v).trim().replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function toInt(v) {
  const n = toNumber(v);
  return n == null ? null : Math.round(n);
}

// Le intestazioni del file BI possono variare leggermente (spazi extra,
// maiuscole/minuscole) da un export all'altro: la lettura delle colonne
// è quindi case/whitespace-insensitive invece di usare le chiavi esatte.
function normalizeHeader(h) {
  return String(h).trim().toLowerCase().replace(/\s+/g, ' ');
}

function indexRow(raw) {
  const idx = {};
  for (const [k, v] of Object.entries(raw)) {
    idx[normalizeHeader(k)] = v;
  }
  return idx;
}

/**
 * Legge il primo foglio di un file .xlsx e lo converte in array di oggetti
 * (una entry per riga, chiavi = intestazioni colonna).
 */
export async function parseXlsxFile(file) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true });
}

/**
 * Converte una riga grezza del file BI nel formato interno usato per il
 * matching e l'import. Righe con dati insufficienti (anno/mese/sede/servizio
 * mancanti o mese non riconosciuto) vengono segnalate come errore.
 */
export function normalizeRow(raw) {
  const idx = indexRow(raw);

  const sede     = idx['sede']     != null ? String(idx['sede']).trim()     : '';
  const servizio = idx['servizio'] != null ? String(idx['servizio']).trim() : '';
  const anno     = toInt(idx['anno']);
  const mese     = parseMese(idx['mese']);

  if (!sede || !servizio || !anno || !mese) {
    return {
      ok: false,
      sede, servizio, anno, mese,
      motivo: !mese ? `Mese non riconosciuto ("${idx['mese']}")` : 'Anno, Sede o Servizio mancanti',
    };
  }

  const uscitaAris = toNumber(idx['uscita aris']);
  let mediaOspiti = toNumber(idx['media ospiti']);
  if (mediaOspiti != null && uscitaAris != null) {
    mediaOspiti -= uscitaAris;
  }

  return {
    ok: true,
    sede,
    servizio,
    anno,
    mese,
    giornate:                toInt(idx['giornate']),
    assenze:                 toInt(idx['assenze']),
    media_ospiti:            mediaOspiti,
    media_ospiti_definitivi: toNumber(idx['media ospiti definitivi']),
    media_ospiti_temporanei: toNumber(idx['media ospiti temporanei']),
    ingressi:                toInt(idx['ingressi']),
    dimissioni:              toInt(idx['dimissioni']),
    n_ospiti:                toInt(idx['n ospiti']),
  };
}

/**
 * Interroga cdg_servizi_map una sola volta e associa ogni riga normalizzata
 * al relativo cdg_map_id tramite (sede_bi, servizio_bi).
 * Ritorna { matched, errors } — nessuna scrittura sul DB.
 */
export async function matchToServiziMap(rawRows) {
  const { data: mappe, error } = await supabase
    .from('cdg_servizi_map')
    .select('id, sede_bi, servizio_bi')
    .eq('attivo', true);
  if (error) throw error;

  const lookup = new Map();
  for (const m of mappe || []) {
    lookup.set(`${m.sede_bi.trim()}||${m.servizio_bi.trim()}`, m.id);
  }

  const matched = [];
  const errors = [];

  for (const raw of rawRows) {
    const row = normalizeRow(raw);
    if (!row.ok) {
      errors.push({ sede: row.sede, servizio: row.servizio, anno: row.anno, mese: row.mese, motivo: row.motivo });
      continue;
    }
    const cdgMapId = lookup.get(`${row.sede}||${row.servizio}`);
    if (!cdgMapId) {
      errors.push({
        sede: row.sede, servizio: row.servizio, anno: row.anno, mese: row.mese,
        motivo: 'Nessuna corrispondenza trovata in cdg_servizi_map',
      });
      continue;
    }
    matched.push({ ...row, cdg_map_id: cdgMapId });
  }

  return { matched, errors };
}

const CHUNK_SIZE = 300;

/**
 * Upsert su cdg_mensile per le righe già associate a un cdg_map_id.
 * Il payload NON include mai budget_media_ospiti: nell'ON CONFLICT DO UPDATE
 * di Postgres vengono aggiornate solo le colonne presenti, quindi un budget
 * già impostato per (cdg_map_id, anno, mese) resta intatto.
 */
export async function importOccupazioneMensile(matchedRows, userId) {
  const now = new Date().toISOString();
  const payload = matchedRows.map(r => ({
    cdg_map_id:              r.cdg_map_id,
    anno:                    r.anno,
    mese:                    r.mese,
    giornate:                r.giornate,
    assenze:                 r.assenze,
    media_ospiti:            r.media_ospiti,
    media_ospiti_definitivi: r.media_ospiti_definitivi,
    media_ospiti_temporanei: r.media_ospiti_temporanei,
    ingressi:                r.ingressi,
    dimissioni:              r.dimissioni,
    n_ospiti:                r.n_ospiti,
    imported_at:             now,
    imported_by:             userId ?? null,
  }));

  for (let i = 0; i < payload.length; i += CHUNK_SIZE) {
    const chunk = payload.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase
      .from('cdg_mensile')
      .upsert(chunk, { onConflict: 'cdg_map_id,anno,mese' });
    if (error) throw error;
  }

  const periodi = Array.from(new Set(payload.map(r => `${r.anno}-${String(r.mese).padStart(2, '0')}`))).sort();
  log('IMPORT_OCCUPAZIONE_MENSILE', { righeImportate: payload.length, periodi });

  return { righeImportate: payload.length, periodi };
}
