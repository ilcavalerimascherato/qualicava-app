/**
 * src/utils/npsTrendStats.js
 * ─────────────────────────────────────────────────────────────
 * Trend NPS nel tempo per struttura, con banda di gruppo ed early warning
 * (Fase 3 "Soddisfazione", §3 del documento di redesign /report: "un NPS
 * che scende per 2 semestri consecutivi è un early warning").
 *
 * Le survey sono per campagna (non mensili come i KPI), quindi il bucket
 * naturale è il semestre, non il mese. Completamente agnostico da React.
 * ─────────────────────────────────────────────────────────────
 */

/**
 * @param {string} dateStr - data ISO (es. data_fine o data_inizio campagna)
 * @returns {{ year: number, half: 1|2, label: string, sortKey: number }}
 */
export function getSemesterKey(dateStr) {
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const half = d.getMonth() < 6 ? 1 : 2;
  return { year, half, label: `H${half} ${year}`, sortKey: year * 2 + (half - 1) };
}

/**
 * Serie NPS per una struttura, una media per semestre (una struttura può
 * avere più campagne nello stesso semestre).
 * @param {Array} campaigns - righe v_survey_campagne (client), con avg_scores.nps_consiglio
 * @param {number|string} facilityId
 * @returns {Array<{ label: string, sortKey: number, nps: number }>} ordinato per sortKey crescente
 */
export function computeFacilityNpsTrend(campaigns, facilityId) {
  const bySemester = new Map();

  (campaigns ?? [])
    .filter(c => String(c.facility_id) === String(facilityId))
    .forEach(c => {
      const nps = c.avg_scores?.nps_consiglio;
      const dateRef = c.data_fine || c.data_inizio;
      if (nps == null || !dateRef) return;
      const { label, sortKey } = getSemesterKey(dateRef);
      if (!bySemester.has(sortKey)) bySemester.set(sortKey, { label, sortKey, values: [] });
      bySemester.get(sortKey).values.push(nps);
    });

  return [...bySemester.values()]
    .sort((a, b) => a.sortKey - b.sortKey)
    .map(s => ({ label: s.label, sortKey: s.sortKey, nps: Math.round(s.values.reduce((a, b) => a + b, 0) / s.values.length) }));
}

/**
 * Media e deviazione standard di gruppo per semestre, su un insieme di
 * strutture (es. stesso tipo UDO) — usata per la banda del grafico.
 * @param {Array} campaigns
 * @param {Array<number|string>} facilityIds
 * @returns {Array<{ label: string, sortKey: number, mean: number, std: number, count: number }>}
 */
export function computeGroupNpsBySemester(campaigns, facilityIds) {
  const ids = new Set(facilityIds.map(String));
  const bySemester = new Map();

  (campaigns ?? [])
    .filter(c => ids.has(String(c.facility_id)))
    .forEach(c => {
      const nps = c.avg_scores?.nps_consiglio;
      const dateRef = c.data_fine || c.data_inizio;
      if (nps == null || !dateRef) return;
      const { label, sortKey } = getSemesterKey(dateRef);
      if (!bySemester.has(sortKey)) bySemester.set(sortKey, { label, sortKey, values: [] });
      bySemester.get(sortKey).values.push(nps);
    });

  return [...bySemester.values()]
    .sort((a, b) => a.sortKey - b.sortKey)
    .map(({ label, sortKey, values }) => {
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const std = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
      return { label, sortKey, mean: Math.round(mean), std: Math.round(std), count: values.length };
    });
}

/**
 * True se l'NPS della struttura è sceso per 2 semestri consecutivi
 * (3 punti in ordine cronologico strettamente decrescenti).
 * @param {Array<{ sortKey: number, nps: number }>} trend - da computeFacilityNpsTrend
 */
export function detectNpsDecline(trend) {
  if (!trend || trend.length < 3) return false;
  const n = trend.length;
  return trend[n - 1].nps < trend[n - 2].nps && trend[n - 2].nps < trend[n - 3].nps;
}
