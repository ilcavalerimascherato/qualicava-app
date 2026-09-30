// src/services/occupazioneReportService.js
// Report xlsx "occupazione mese vs mese precedente" per tutte le strutture —
// lavora solo su dati già caricati in memoria dalla dashboard Saturazione
// (nessuna chiamata Supabase qui).

import * as XLSX from 'xlsx';
import { aggregateCdgRecords, calcCdgSummary } from '../hooks/useCdgData';

export const MESE_LABEL = ['', 'Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

/**
 * Tutti i periodi (anno, mese) con dato reale disponibili su almeno una
 * facility, ordinati dal più recente — per popolare i due selettori del
 * modal di esportazione.
 */
export function getAvailablePeriods(facilities) {
  const map = new Map();
  for (const f of facilities) {
    const aggregated = aggregateCdgRecords(f._cdgRecords || []);
    for (const r of aggregated) {
      const key = `${r.anno}-${r.mese}`;
      if (!map.has(key)) map.set(key, { anno: r.anno, mese: r.mese });
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    b.anno !== a.anno ? b.anno - a.anno : b.mese - a.mese
  );
}

function summaryAtPeriod(aggregated, bedCount, period) {
  if (!period) return null;
  const idx = aggregated.findIndex(r => r.anno === period.anno && r.mese === period.mese);
  if (idx === -1) return null;
  return calcCdgSummary(aggregated.slice(0, idx + 1), bedCount);
}

/**
 * Una riga per facility con i summary dei due periodi scelti dall'utente,
 * ricalcolando calcCdgSummary su una porzione dell'array aggregato che
 * finisce esattamente al periodo richiesto — così i delta restano corretti
 * rispetto al mese immediatamente precedente a ciascun periodo.
 */
export function buildOccupazioneReportRows(facilities, periodCurrent, periodPrevious) {
  return facilities
    .map(f => {
      const aggregated = aggregateCdgRecords(f._cdgRecords || []);
      const current  = summaryAtPeriod(aggregated, f.bed_count || 0, periodCurrent);
      const previous = summaryAtPeriod(aggregated, f.bed_count || 0, periodPrevious);
      return { name: f.name, bedCount: f.bed_count || 0, current, previous };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'it', { sensitivity: 'base' }));
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
 * monte, es. solo attive) usando i loro _cdgRecords già caricati, per i due
 * periodi (anno, mese) scelti dall'utente nel modal di esportazione.
 */
export function exportOccupazioneReport(facilities, periodCurrent, periodPrevious) {
  const rows = buildOccupazioneReportRows(facilities, periodCurrent, periodPrevious);

  const meseLabelCurrent = periodCurrent ? `${MESE_LABEL[periodCurrent.mese]} ${periodCurrent.anno}` : 'Mese corrente';
  const meseLabelPrev    = periodPrevious ? `${MESE_LABEL[periodPrevious.mese]} ${periodPrevious.anno}` : 'Mese precedente';

  const wb = buildOccupazioneReportWorkbook(rows, meseLabelPrev, meseLabelCurrent);
  const fileSuffix = periodCurrent ? `${MESE_LABEL[periodCurrent.mese]}_${periodCurrent.anno}` : 'report';
  XLSX.writeFile(wb, `Report_occupazione_${fileSuffix}.xlsx`);
}
