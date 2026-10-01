/**
 * src/utils/surveyAggregation.js
 * ─────────────────────────────────────────────────────────────
 * Media pesata (per numero di risposte) delle chiavi di avg_scores su un
 * insieme di campagne — usata per aggregare "n strutture" (es. tutte quelle
 * di uno stesso tipo UDO) in un unico punteggio di gruppo.
 *
 * Stessa regola SSOT usata in tutto il resto dell'app (getSurveyStatus,
 * AnalyticsModal, GlobalReportModal, DirectorFacility): una campagna è o
 * per struttura (facility_id valorizzato) o per società (facility_id NULL,
 * company_id valorizzato — vedi fix_survey_company_wide_ssot.sql). Qui si
 * sceglie ESPLICITAMENTE quali facilityIds e/o companyIds includere, invece
 * di dedurlo implicitamente come fa getSurveyStatus per una singola
 * struttura — utile per aggregare per UDO (companyIds vuoto, le campagne
 * societarie non sono attribuibili a un singolo UDO) o per mostrare una
 * campagna societaria come voce a sé (facilityIds vuoto).
 *
 * Completamente agnostico rispetto a React.
 * ─────────────────────────────────────────────────────────────
 */

function weightedAverage(relevant) {
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

/**
 * @param {Array} campaigns    - righe v_survey_campagne (client o operator)
 * @param {Array<number|string>} facilityIds - strutture da includere (match su facility_id)
 * @param {Array<number|string>} [companyIds] - società da includere (match su company_id, solo campagne con facility_id NULL)
 * @returns {Object} { [key]: number } media pesata 0-100 per ogni chiave presente
 */
export function computeWeightedAvgScores(campaigns, facilityIds, companyIds = []) {
  const fIds = new Set((facilityIds ?? []).map(String));
  const cIds = new Set((companyIds ?? []).map(String));
  const relevant = (campaigns ?? []).filter(c => {
    if (!c.avg_scores) return false;
    return c.facility_id != null ? fIds.has(String(c.facility_id)) : cIds.has(String(c.company_id));
  });
  return weightedAverage(relevant);
}
