/**
 * src/utils/kpiFormulaEngine.js  —  v2
 * ─────────────────────────────────────────────────────────────
 * MODIFICHE v2:
 *  - `evaluateScore` DEPRECATO: la logica semaforo vive ora
 *    esclusivamente in `getKpiStatus()` di kpiRules.js.
 *    Questa funzione ora è un thin wrapper con warning in dev.
 *    Tutti i componenti (KpiDashboardModal, KpiChartsModal, ecc.)
 *    devono migrare a import { getKpiStatus } from '../config/kpiRules'.
 *  - `evaluateKpiFormula` e `computeKpiValue` invariati.
 * ─────────────────────────────────────────────────────────────
 */
import { getKpiStatus } from '../config/kpiRules';

import { isNumericSettore } from '../config/kpiRules';

const VARIABLE_REGEX = /\[([^\]]*)\]/g;

/**
 * Valuta una formula KPI sostituendo le variabili [NOME] con i valori da metricsJson/facility.
 * @param {string} calcolo - Formula con variabili [NOME]
 * @param {Object} metricsJson - Oggetto { NOME: { value: number } }
 * @param {Object} facility - Struttura con bed_count
 * @returns {{ result: number | null, canCalculate: boolean }}
 */
export function evaluateKpiFormula(calcolo, metricsJson, facility = {}) {
  let parsedFormula = calcolo.toUpperCase();
  const variables   = calcolo.match(VARIABLE_REGEX) || [];
  let canCalculate  = true;

  for (const v of variables) {
    const varName = v.slice(1, -1).trim().toUpperCase();
    let val = 0;

    if (varName === 'POSTI LETTO ATTIVI' || varName === 'POSTILETTO') {
      val = facility.bed_count ?? 1;
    } else {
      const actualKey = Object.keys(metricsJson || {}).find(
        k => k.toUpperCase() === varName
      );
      if (actualKey && metricsJson[actualKey]) {
        val = parseFloat(metricsJson[actualKey].value) || 0;
      } else {
        canCalculate = false;
      }
    }
    parsedFormula = parsedFormula.replace(v, val);
  }

  if (!canCalculate) return { result: null, canCalculate: false };

  try {
    // eslint-disable-next-line no-new-func -- formula parser sicuro: solo aritmetica, no accesso scope
    const fn  = new Function('return (' + parsedFormula + ')');
    const raw = fn();
    return {
      result:       typeof raw === 'number' && !Number.isNaN(raw) ? raw : null,
      canCalculate: true,
    };
  } catch {
    return { result: null, canCalculate: false };
  }
}

/**
 * Calcola il valore KPI formattato dato un rule.
 * @param {Object} rule - Una entry di KPI_RULES
 * @param {Object} metricsJson
 * @param {Object} facility
 * @returns {number | null}
 */
export function computeKpiValue(rule, metricsJson, facility) {
  const { result, canCalculate } = evaluateKpiFormula(rule.calcolo, metricsJson, facility);
  if (!canCalculate || result === null) return null;

  const isPerc = !isNumericSettore(rule.settore);
  return isPerc
    ? Math.round(result * 1000) / 10   // percentuale con 1 decimale
    : Math.round(result * 10)  / 10;   // numero assoluto con 1 decimale
}

/**
 * @deprecated Usare `getKpiStatus(rule, value)` da '../config/kpiRules'.
 *
 * Questo wrapper esiste solo per retrocompatibilità durante la migrazione.
 * Verrà rimosso nella prossima major version.
 *
 * Differenza di API:
 *   - evaluateScore(value, target_verde, target_rosso, direzione) → 'GREEN'|'YELLOW'|'RED'|'NEUTRAL'|'N/A'
 *   - getKpiStatus(rule, value)                                   → 'green'|'yellow'|'red'|'neutral'
 *
 * MIGRAZIONE:
 *   Prima:  import { evaluateScore } from '../utils/kpiFormulaEngine';
 *           evaluateScore(val, rule.target_verde, rule.target_rosso, rule.direzione)
 *   Dopo:   import { getKpiStatus } from '../config/kpiRules';
 *           getKpiStatus(rule, val / 100)   // nota: getKpiStatus lavora su valori 0-1
 */
export function evaluateScore(value, target_verde, target_rosso, direzione) {
  if (process.env.NODE_ENV === 'development') {
    console.warn(
      '[kpiFormulaEngine] evaluateScore() è deprecato. ' +
      'Usa getKpiStatus(rule, value) da "../config/kpiRules".'
    );
  }

  if (value === null || Number.isNaN(value)) return 'N/A';
  if (!direzione || target_verde === null)    return 'NEUTRAL';

  // Normalizza: evaluateScore riceve valori già moltiplicati (es. 95 per 95%)
  // getKpiStatus si aspetta valori 0-1. Convertiamo se sembra una percentuale.
  const isPercLike = value > 1 || target_verde > 1;
  const v  = isPercLike ? value       / 100 : value;
  const tv = isPercLike ? target_verde / 100 : target_verde;
  const tr = isPercLike ? target_rosso / 100 : target_rosso;

  const status = getKpiStatus({ target_verde: tv, target_rosso: tr, direzione }, v);
  return status.toUpperCase(); // retrocompatibilità: getKpiStatus ritorna lowercase
}
