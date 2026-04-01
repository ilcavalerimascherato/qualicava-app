/**
 * src/utils/riskScoreEngine.js
 * ─────────────────────────────────────────────────────────────
 * Calcola il punteggio di rischio per struttura.
 *
 * ALGORITMO:
 *  1. Prende gli ultimi 3 mesi consolidati per la struttura
 *  2. Per ogni mese calcola il punteggio grezzo:
 *     Σ (peso_KPI × moltiplicatore_stato)
 *     dove: rosso=1.0, giallo=YELLOW_MULTIPLIER, verde=0
 *  3. Fa la media mobile sui mesi disponibili (1, 2 o 3)
 *  4. Normalizza su scala 0-100
 *
 * Il punteggio massimo teorico è la somma di tutti i pesi
 * con tutti i KPI in rosso. Normalizzando su quello si ottiene
 * una percentuale di rischio rispetto al worst case.
 * ─────────────────────────────────────────────────────────────
 */
import { KPI_RISK_MAP, YELLOW_MULTIPLIER, RISK_THRESHOLDS } from '../config/riskWeights';
import { computeKpiValue }  from './kpiFormulaEngine';
import { KPI_RULES }        from '../config/kpiRules';
import { getKpiStatus }     from '../config/kpiRules';

/** Punteggio massimo teorico (tutti i KPI in rosso) */
const MAX_SCORE = Array.from(KPI_RISK_MAP.values()).reduce((s, r) => s + r.weight, 0);

/**
 * Calcola il punteggio di rischio per un singolo record mensile.
 * @param {Object} record  - fact_kpi_monthly con metrics_json
 * @param {Object} facility
 * @returns {number} punteggio grezzo (0–MAX_SCORE)
 */
function scoreRecord(record, facility) {
  if (!record?.metrics_json) return 0;

  let score = 0;
  KPI_RULES.forEach(rule => {
    const riskCfg = KPI_RISK_MAP.get(rule.kpi_target);
    if (!riskCfg) return;

    const value = computeKpiValue(rule, record.metrics_json, facility);
    if (value === null) return;

    const status = getKpiStatus(rule, value / 100); // getKpiStatus lavora su 0-1
    if (status === 'red')    score += riskCfg.weight;
    if (status === 'yellow') score += riskCfg.weight * YELLOW_MULTIPLIER;
  });

  return score;
}

/**
 * Restituisce i 3 mesi precedenti al mese corrente (incluso l'ultimo consolidato).
 * @param {number} currentYear
 * @param {number} currentMonth  1-based
 * @returns {Array<{year, month}>}
 */
function getLast3Months(currentYear, currentMonth) {
  const months = [];
  let y = currentYear;
  let m = currentMonth - 1; // partiamo dal mese precedente (più recente consolidato)
  if (m === 0) { m = 12; y--; }

  for (let i = 0; i < 3; i++) {
    months.push({ year: y, month: m });
    m--;
    if (m === 0) { m = 12; y--; }
  }
  return months;
}

/**
 * Calcola il risk score (0-100) per una struttura.
 * Usa la media mobile degli ultimi 3 mesi consolidati.
 *
 * @param {Object}   facility
 * @param {Array}    kpiRecords   - tutti i record fact_kpi_monthly
 * @returns {{
 *   score:    number,           // 0-100
 *   level:    'low'|'medium'|'high',
 *   months:   number,           // mesi usati per il calcolo
 *   detail:   Array             // KPI critici che contribuiscono al punteggio
 * }}
 */
export function calcFacilityRiskScore(facility, kpiRecords) {
  const now   = new Date();
  const last3 = getLast3Months(now.getFullYear(), now.getMonth() + 1);

  const monthScores = [];

  last3.forEach(({ year, month }) => {
    const rec = kpiRecords.find(k =>
      String(k.facility_id) === String(facility.id) &&
      Number(k.year)  === year &&
      Number(k.month) === month &&
      k.status        === 'completed'
    );
    if (rec) {
      monthScores.push(scoreRecord(rec, facility));
    }
  });

  if (monthScores.length === 0) {
    return { score: null, level: 'unknown', months: 0, detail: [] };
  }

  const avgRaw  = monthScores.reduce((s, v) => s + v, 0) / monthScores.length;
  const score   = Math.min(100, Math.round((avgRaw / MAX_SCORE) * 100));

  const level = score < RISK_THRESHOLDS.LOW    ? 'low'
              : score < RISK_THRESHOLDS.MEDIUM  ? 'medium'
              : 'high';

  // Dettaglio KPI che contribuiscono maggiormente (per tooltip)
  const lastRec = kpiRecords.find(k =>
    String(k.facility_id) === String(facility.id) &&
    Number(k.year)  === last3[0].year &&
    Number(k.month) === last3[0].month &&
    k.status        === 'completed'
  );

  const detail = [];
  if (lastRec?.metrics_json) {
    KPI_RULES.forEach(rule => {
      const riskCfg = KPI_RISK_MAP.get(rule.kpi_target);
      if (!riskCfg) return;
      const value  = computeKpiValue(rule, lastRec.metrics_json, facility);
      if (value === null) return;
      const status = getKpiStatus(rule, value / 100);
      if (status === 'red' || status === 'yellow') {
        detail.push({ kpi: rule.kpi_target, status, category: riskCfg.category, weight: riskCfg.weight });
      }
    });
    detail.sort((a, b) => b.weight - a.weight);
  }

  return { score, level, months: monthScores.length, detail };
}

/** Config colori per il badge rischio */
export const RISK_BADGE = {
  low:     { bg: 'bg-emerald-50',  border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Basso'  },
  medium:  { bg: 'bg-amber-50',    border: 'border-amber-200',   text: 'text-amber-700',   dot: 'bg-amber-400',   label: 'Medio'  },
  high:    { bg: 'bg-red-50',      border: 'border-red-200',     text: 'text-red-700',     dot: 'bg-red-500',     label: 'Alto'   },
  unknown: { bg: 'bg-slate-50',    border: 'border-slate-200',   text: 'text-slate-400',   dot: 'bg-slate-300',   label: '—'      },
};
