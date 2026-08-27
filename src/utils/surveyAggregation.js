/**
 * src/utils/surveyAggregation.js
 * ─────────────────────────────────────────────────────────────
 * Media pesata (per numero di risposte) delle chiavi di avg_scores su un
 * insieme di campagne — usata sia per "media di una struttura nel periodo"
 * (più campagne della stessa struttura) sia per "media di un gruppo di pari"
 * (una struttura per tipo UDO, più campagne ciascuna). Stesso calcolo,
 * insieme di campagne diverso.
 *
 * Completamente agnostico rispetto a React.
 * ─────────────────────────────────────────────────────────────
 */

/**
 * @param {Array} campaigns    - righe v_survey_campagne (client o operator)
 * @param {Array<number|string>} facilityIds
 * @returns {Object} { [key]: number } media pesata 0-100 per ogni chiave presente
 */
export function computeWeightedAvgScores(campaigns, facilityIds) {
  const ids = new Set((facilityIds ?? []).map(String));
  const relevant = (campaigns ?? []).filter(c => ids.has(String(c.facility_id)) && c.avg_scores);

  const sums = {};
  const weights = {};

  relevant.forEach(c => {
    const weight = c.n_risposte || 1;
    Object.entries(c.avg_scores).forEach(([key, value]) => {
      if (value == null) return;
      sums[key] = (sums[key] ?? 0) + value * weight;
      weights[key] = (weights[key] ?? 0) + weight;
    });
  });

  const result = {};
  Object.keys(sums).forEach(key => {
    result[key] = Math.round(sums[key] / weights[key]);
  });
  return result;
}
