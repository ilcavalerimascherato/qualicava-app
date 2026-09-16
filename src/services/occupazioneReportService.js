// src/services/occupazioneReportService.js
// Report xlsx "occupazione mese vs mese precedente" per tutte le strutture —
// lavora solo su dati già caricati in memoria dalla dashboard Saturazione
// (nessuna chiamata Supabase qui).

import * as XLSX from 'xlsx';
import { aggregateCdgRecords, calcCdgSummary } from '../hooks/useCdgData';

const MESE_LABEL = ['', 'Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

function prevMonthOf(anno, mese) {
  return mese === 1 ? { anno: anno - 1, mese: 12 } : { anno, mese: mese - 1 };
}

/**
 * Una riga per facility con i summary del mese corrente (ultimo con dato
 * reale) e del mese precedente, riusando calcCdgSummary due volte sullo
 * stesso array aggregato (la seconda volta senza l'ultimo mese) così i
 * delta del mese "precedente" restano corretti rispetto al mese ancora prima.
 */
export function buildOccupazioneReportRows(facilities) {
  return facilities
    .map(f => {
      const aggregated = aggregateCdgRecords(f._cdgRecords || []);
      const current  = calcCdgSummary(aggregated, f.bed_count || 0);
      const previous = aggregated.length > 1
        ? calcCdgSummary(aggregated.slice(0, -1), f.bed_count || 0)
        : null;
      return { name: f.name, bedCount: f.bed_count || 0, current, previous };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'it', { sensitivity: 'base' }));
}

function pickLatestPeriod(rows) {
  let best = null;
  for (const r of rows) {
    if (!r.current) continue;
    const key = r.current.anno * 12 + r.current.mese;
    if (!best || key > best.key) best = { key, anno: r.current.anno, mese: r.current.mese };
  }
  return best;
}

const HEADER_SUB = ['pl disponibili', 'pl budget', 'ospiti', '% di riempimento', 'delta mese precedente', 'delta su budget'];
const PCT_COLS   = [4, 5, 6, 10, 11, 12];
const DEC_COLS   = [1, 2, 3, 7, 8, 9];

export function buildOccupazioneReportWorkbook(rows, meseLabelPrev, meseLabelCurrent) {
  const aoa = [
    ['Unità Organizzativa', meseLabelPrev, '', '', '', '', '', meseLabelCurrent, '', '', '', '', ''],
    ['', ...HEADER_SUB, ...HEADER_SUB],
  ];

  for (const r of rows) {
    aoa.push([
      r.name,
      r.bedCount || null,
      r.previous?.budget ?? null,
      r.previous?.mediaOspiti ?? null,
      r.previous?.saturazione != null ? r.previous.saturazione / 100 : null,
      r.previous?.deltaMom != null ? r.previous.deltaMom / 100 : null,
      r.previous?.pctVsBudget != null ? r.previous.pctVsBudget / 100 : null,
      r.bedCount || null,
      r.current?.budget ?? null,
      r.current?.mediaOspiti ?? null,
      r.current?.saturazione != null ? r.current.saturazione / 100 : null,
      r.current?.deltaMom != null ? r.current.deltaMom / 100 : null,
      r.current?.pctVsBudget != null ? r.current.pctVsBudget / 100 : null,
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!merges'] = [
    { s: { r: 0, c: 1 }, e: { r: 0, c: 6 } },
    { s: { r: 0, c: 7 }, e: { r: 0, c: 12 } },
  ];
  ws['!cols'] = [{ wch: 28 }, ...Array(12).fill({ wch: 13 })];

  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let R = 2; R <= range.e.r; R++) {
    for (const C of PCT_COLS) {
      const ref = XLSX.utils.encode_cell({ r: R, c: C });
      if (ws[ref]) ws[ref].z = '0.00%';
    }
    for (const C of DEC_COLS) {
      const ref = XLSX.utils.encode_cell({ r: R, c: C });
      if (ws[ref]) ws[ref].z = '0.0';
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Occupazione');
  return wb;
}

/**
 * Genera e scarica il report xlsx per le facility passate (già filtrate a
 * monte, es. solo attive) usando i loro _cdgRecords già caricati.
 */
export function exportOccupazioneReport(facilities) {
  const rows = buildOccupazioneReportRows(facilities);
  const period = pickLatestPeriod(rows);

  const meseLabelCurrent = period ? `${MESE_LABEL[period.mese]} ${period.anno}` : 'Mese corrente';
  const prev = period ? prevMonthOf(period.anno, period.mese) : null;
  const meseLabelPrev = prev ? `${MESE_LABEL[prev.mese]} ${prev.anno}` : 'Mese precedente';

  const wb = buildOccupazioneReportWorkbook(rows, meseLabelPrev, meseLabelCurrent);
  const fileSuffix = period ? `${MESE_LABEL[period.mese]}_${period.anno}` : 'report';
  XLSX.writeFile(wb, `Report_occupazione_${fileSuffix}.xlsx`);
}
