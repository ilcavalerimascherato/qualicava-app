/**
 * src/utils/alertEngine.js
 * ─────────────────────────────────────────────────────────────
 * Calcola le situazioni più urgenti del Gruppo per il ticker alert
 * del Cruscotto (§2 del documento di redesign /report):
 *  - NC aperte con azione correttiva scaduta (ac_entro_il)
 *  - KPI in trend negativo da 3+ mesi consecutivi (rosso)
 *  - Strutture sotto soglia di occupazione
 *
 * La quarta fonte del documento (verbali ispettivi con prescrizioni
 * aperte) non è inclusa: la sezione operativa "Verifiche" da cui
 * dovrebbero arrivare quei dati non esiste ancora.
 *
 * Completamente agnostico rispetto a React.
 * ─────────────────────────────────────────────────────────────
 */
import { KPI_RULES, getKpiStatusFromComputedValue } from '../config/kpiRules';
import { computeKpiValue } from './kpiFormulaEngine';
import { getLast3Months } from './riskScoreEngine';
import { aggregateCdgRecords, calcCdgSummary } from '../hooks/useCdgData';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const SEVERITY_WEIGHT = { alta: 2, media: 1 };

/** NC aperte/in lavorazione con azione correttiva oltre la scadenza (ac_entro_il). */
function ncOverdueAlerts(nonConformities, facilitiesById) {
  const today = new Date();
  return (nonConformities || [])
    .filter(nc => nc.stato !== 'Chiuso' && nc.ac_entro_il)
    .map(nc => {
      const daysOverdue = Math.floor((today - new Date(nc.ac_entro_il)) / MS_PER_DAY);
      return { nc, daysOverdue };
    })
    .filter(({ daysOverdue }) => daysOverdue > 0)
    .map(({ nc, daysOverdue }) => ({
      id: `nc-${nc.id}`,
      type: 'nc_overdue',
      severity: daysOverdue > 30 ? 'alta' : 'media',
      urgency: daysOverdue,
      label: `NC "${nc.titolo || nc.classificazione || 'senza titolo'}" scaduta da ${daysOverdue}gg`,
      facilityName: facilitiesById[nc.facility_id]?.name ?? '—',
      target: '/non-conformita',
    }));
}

/** KPI rimasti in stato rosso per gli ultimi 3 mesi consolidati consecutivi. */
function kpiTrendAlerts(facilities, kpiRecords) {
  const now   = new Date();
  const last3 = getLast3Months(now.getFullYear(), now.getMonth() + 1);
  const alerts = [];

  facilities.forEach(facility => {
    if (facility.is_suspended) return;

    KPI_RULES.forEach(rule => {
      const allRed = last3.every(({ year, month }) => {
        const rec = kpiRecords.find(k =>
          String(k.facility_id) === String(facility.id) &&
          Number(k.year)  === year &&
          Number(k.month) === month &&
          k.status        === 'completed'
        );
        if (!rec?.metrics_json) return false;
        const value = computeKpiValue(rule, rec.metrics_json, facility);
        if (value === null) return false;
        return getKpiStatusFromComputedValue(rule, value) === 'red';
      });

      if (allRed) {
        alerts.push({
          id: `kpi-${facility.id}-${rule.kpi_target}`,
          type: 'kpi_trend',
          severity: 'alta',
          urgency: 3,
          label: `${rule.kpi_target} in rosso da 3+ mesi`,
          facilityName: facility.name,
          target: '/report',
        });
      }
    });
  });

  return alerts;
}

/** Strutture con saturazione sotto soglia nell'ultimo mese con dato reale. */
function occupancyAlerts(facilities, cdgByFacility, threshold) {
  const alerts = [];

  facilities.forEach(facility => {
    if (facility.is_suspended || !facility.bed_count) return;
    const records = cdgByFacility[facility.id];
    if (!records?.length) return;

    const summary = calcCdgSummary(aggregateCdgRecords(records), facility.bed_count);
    if (summary?.saturazione == null || summary.saturazione >= threshold) return;

    const gap = threshold - summary.saturazione;
    alerts.push({
      id: `occ-${facility.id}`,
      type: 'occupancy_low',
      severity: gap > 15 ? 'alta' : 'media',
      urgency: gap,
      label: `Occupazione al ${summary.saturazione.toFixed(0)}% (soglia ${threshold}%)`,
      facilityName: facility.name,
      target: '/occupazione',
    });
  });

  return alerts;
}

/**
 * Restituisce le 5 situazioni più urgenti del Gruppo, ordinate per
 * gravità e poi per urgenza (giorni di ritardo, punti sotto soglia, ecc.).
 *
 * @param {Object} params
 * @param {Array}  params.facilities
 * @param {Array}  params.kpiRecords
 * @param {Array}  params.nonConformities
 * @param {Object} params.cdgByFacility        - output di useCdgData: { [facilityId]: rows[] }
 * @param {number} [params.occupancyThreshold]  - soglia % occupazione, default 75
 */
export function getGroupAlerts({
  facilities = [],
  kpiRecords = [],
  nonConformities = [],
  cdgByFacility = {},
  occupancyThreshold = 75,
}) {
  const facilitiesById = Object.fromEntries(facilities.map(f => [f.id, f]));

  const all = [
    ...ncOverdueAlerts(nonConformities, facilitiesById),
    ...kpiTrendAlerts(facilities, kpiRecords),
    ...occupancyAlerts(facilities, cdgByFacility, occupancyThreshold),
  ];

  return all
    .sort((a, b) =>
      (SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity]) ||
      (b.urgency - a.urgency)
    )
    .slice(0, 5);
}
