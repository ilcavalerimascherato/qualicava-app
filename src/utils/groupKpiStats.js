/**
 * src/utils/groupKpiStats.js
 * ─────────────────────────────────────────────────────────────
 * Statistiche di gruppo per KPI (Fase 2 "KPI & Economics", §2 del
 * documento di redesign /report). Due responsabilità:
 *
 *  1. Completezza dati per struttura/mese: quante delle KPI_RULES
 *     calcolabili hanno un valore non nullo quel mese. Sotto il 70%
 *     la struttura viene esclusa dalle medie di gruppo (non solo
 *     segnalata) — il documento è esplicito su questo.
 *  2. Media di gruppo per KPI su una finestra di mesi, escludendo i
 *     mesi/strutture sotto soglia di completezza.
 *
 * Completamente agnostico rispetto a React.
 * ─────────────────────────────────────────────────────────────
 */
import { KPI_RULES, getKpiStatusFromComputedValue } from '../config/kpiRules';
import { computeKpiValue } from './kpiFormulaEngine';

export const COMPLETENESS_THRESHOLD = 0.7;

/**
 * Trova il record fact_kpi_monthly completato per una struttura/anno/mese.
 */
function findRecord(kpiRecords, facilityId, year, month) {
  return kpiRecords.find(k =>
    String(k.facility_id) === String(facilityId) &&
    Number(k.year)  === year &&
    Number(k.month) === month &&
    k.status        === 'completed'
  ) ?? null;
}

/**
 * Completezza di un record: % di KPI_RULES con un valore calcolabile
 * (non nullo) su quel record. Non esiste un mapping settore↔UDO in
 * QualiCAVA, quindi "atteso" = l'intero set di KPI_RULES, non un
 * sottoinsieme per tipo struttura.
 *
 * @returns {number|null} null se non esiste alcun record quel mese
 *   (nessuna sottomissione, diverso da "sottomissione parziale")
 */
export function computeFacilityCompleteness(facility, kpiRecords, year, month) {
  const record = findRecord(kpiRecords, facility.id, year, month);
  if (!record?.metrics_json) return null;

  let computable = 0;
  KPI_RULES.forEach(rule => {
    const value = computeKpiValue(rule, record.metrics_json, facility);
    if (value !== null) computable++;
  });

  return computable / KPI_RULES.length;
}

/**
 * Serie mensile della media di gruppo per un KPI, su una finestra di mesi.
 * Esclude dalla media le strutture con completezza sotto soglia quel mese.
 *
 * @param {Object} rule        - una entry di KPI_RULES
 * @param {Array}  facilities  - strutture da includere (già filtrate per regione/società/UDO)
 * @param {Array}  kpiRecords
 * @param {Array}  months      - array di {yearNum, monthNum, label} (es. getTimeHorizon(year).slice(-6))
 * @returns {Array<{ label: string, avg: number|null, includedCount: number, excludedCount: number }>}
 */
export function computeGroupKpiSeries(rule, facilities, kpiRecords, months) {
  const activeFacilities = facilities.filter(f => !f.is_suspended);

  return months.map(({ yearNum, monthNum, label }) => {
    const values = [];
    let excludedCount = 0;

    activeFacilities.forEach(facility => {
      const completeness = computeFacilityCompleteness(facility, kpiRecords, yearNum, monthNum);
      if (completeness === null) return; // nessuna sottomissione, non conta né come inclusa né esclusa per soglia
      if (completeness < COMPLETENESS_THRESHOLD) { excludedCount++; return; }

      const record = findRecord(kpiRecords, facility.id, yearNum, monthNum);
      const value  = computeKpiValue(rule, record.metrics_json, facility);
      if (value !== null) values.push(value);
    });

    const avg = values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : null;
    return { label, avg, includedCount: values.length, excludedCount };
  });
}

/**
 * Stato semaforo aggregato di gruppo per un KPI in un dato mese (usa la
 * media di gruppo come valore rappresentativo).
 */
export function getGroupKpiStatus(rule, groupAvg) {
  return getKpiStatusFromComputedValue(rule, groupAvg);
}
