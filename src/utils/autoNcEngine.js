/**
 * src/utils/autoNcEngine.js  —  v2
 * ─────────────────────────────────────────────────────────────
 * Motore per apertura automatica Non Conformità da KPI critici.
 *
 * QUANDO VIENE CHIAMATO:
 *  Dopo ogni salvataggio KPI con status='completed' in KpiManagerModal.
 *
 * CRITERI (configurabili in riskWeights.js):
 *  - KPI in stato ROSSO
 *  - Categoria CRITICO o ALTO
 *  - Rosso per N mesi consecutivi (default: 2)
 *  - Non esiste già una NC aperta per stesso KPI + struttura
 *
 * MAPPING CAMPI DB (non_conformities):
 *  segnalazione_da  = 'System'        → identifica NC auto-generate
 *  classificazione  = riskCfg.nc_class
 *  ambito           = riskCfg.kpi_target  → KPI che l'ha generata
 *  gravita          = 'Alta' | 'Media'
 *  analisi_dinamica = descrizione del problema rilevato
 *  stato            = 'Aperto'
 *
 * Il direttore può modificare tutti i campi liberamente.
 * Il campo segnalazione_da='System' rimane come traccia di origine.
 * ─────────────────────────────────────────────────────────────
 */
import { supabase }                         from '../supabaseClient';
import { KPI_RISK_MAP, AUTO_NC_CRITERIA }   from '../config/riskWeights';
import { computeKpiValue }                  from './kpiFormulaEngine';
import { KPI_RULES, getKpiStatus }          from '../config/kpiRules';

const { CONSECUTIVE_RED_MONTHS, ELIGIBLE_CATEGORIES } = AUTO_NC_CRITERIA;

const MONTH_NAMES = [
  '', 'Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
  'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre',
];

/** Ottieni gli ultimi N record mensili completati per una struttura */
async function getLastNRecords(facilityId, year, month, n) {
  const targets = [];
  let y = year, m = month;
  for (let i = 0; i < n; i++) {
    targets.push({ year: y, month: m });
    m--;
    if (m === 0) { m = 12; y--; }
  }

  const results = await Promise.all(
    targets.map(({ year: y2, month: m2 }) =>
      supabase
        .from('fact_kpi_monthly')
        .select('year, month, metrics_json')
        .eq('facility_id', facilityId)
        .eq('year', y2)
        .eq('month', m2)
        .eq('status', 'completed')
        .maybeSingle()
        .then(({ data }) => data)
    )
  );

  return results; // array di N elementi, null se mese non trovato
}

/**
 * Verifica se esiste già una NC aperta (Aperto o Pending)
 * con lo stesso KPI trigger per questa struttura.
 * Usa il campo ambito per identificare il KPI trigger.
 */
async function hasOpenNcForKpi(facilityId, kpiTarget) {
  const { data } = await supabase
    .from('non_conformities')
    .select('id')
    .eq('facility_id', facilityId)
    .eq('segnalazione_da', 'System')
    .eq('ambito', kpiTarget)
    .in('stato', ['Aperto', 'Pending'])
    .maybeSingle();
  return !!data;
}

/**
 * Apre una NC automatica nel DB.
 */
async function openAutoNc(facilityId, companyId, year, month, riskCfg, kpiValue) {
  const monthName = MONTH_NAMES[month] || `mese ${month}`;

  const payload = {
    facility_id:      facilityId,
    company_id:       companyId || null,
    year,
    stato:            'Aperto',
    gravita:          riskCfg.category === 'critico' ? 'Alta' : 'Media',
    classificazione:  riskCfg.nc_class,
    segnalazione_da:  'System',                // ← label identificativa NC automatica
    ambito:           riskCfg.kpi_target,      // ← KPI che ha generato la NC
    analisi_dinamica: `KPI "${riskCfg.kpi_target}" in stato ROSSO per ${CONSECUTIVE_RED_MONTHS} mesi consecutivi. Valore rilevato: ${kpiValue}. Periodo: ${monthName} ${year}. NC aperta automaticamente dal sistema di monitoraggio qualità.`,
    cause_evento:     `Superamento soglia critica per ${CONSECUTIVE_RED_MONTHS} mesi consecutivi`,
    opened_at:        new Date().toISOString(),
    opened_by_role:   'system',
  };

  const { error } = await supabase.from('non_conformities').insert([payload]);
  if (error) {
    console.error('[autoNcEngine] Errore apertura NC:', error.message, payload);
    return false;
  }
  return true;
}

/**
 * Entry point principale.
 * Chiamare dopo handleSave('completed') in KpiManagerModal.
 *
 * @param {string|number} facilityId
 * @param {string}        facilityName   (solo per logging)
 * @param {number}        year
 * @param {number}        month
 * @param {Object}        facility       oggetto struttura (per computeKpiValue)
 * @returns {Promise<string[]>}          kpi_target per cui è stata aperta una NC
 */
export async function checkAndOpenAutoNcs(facilityId, facilityName, year, month, facility) {
  const openedNcs = [];

  // 1. Ottieni gli ultimi N mesi consolidati
  const records = await getLastNRecords(facilityId, year, month, CONSECUTIVE_RED_MONTHS);
  const validRecords = records.filter(Boolean);

  // Se non abbiamo abbastanza mesi, non fare nulla
  if (validRecords.length < CONSECUTIVE_RED_MONTHS) {
    return openedNcs;
  }

  // 2. Controlla ogni KPI eleggibile
  for (const rule of KPI_RULES) {
    const riskCfg = KPI_RISK_MAP.get(rule.kpi_target);
    if (!riskCfg)                                          continue;
    if (!ELIGIBLE_CATEGORIES.includes(riskCfg.category))  continue;
    if (!riskCfg.nc_title)                                 continue;

    // Verifica che tutti gli N record abbiano questo KPI in rosso
    const allRed = validRecords.every(rec => {
      if (!rec?.metrics_json) return false;
      const value = computeKpiValue(rule, rec.metrics_json, facility);
      if (value === null) return false;
      // getKpiStatus lavora su scala 0-1, computeKpiValue restituisce percentuale (0-100)
      const normalized = ['NUMERI','ISPEZIONI'].includes(rule.settore) ? value : value / 100;
      return getKpiStatus(rule, normalized) === 'red';
    });

    if (!allRed) continue;

    // Verifica che non esista già una NC aperta per questo KPI
    const alreadyOpen = await hasOpenNcForKpi(facilityId, rule.kpi_target);
    if (alreadyOpen) continue;

    // Calcola valore corrente per la descrizione
    const lastRecord   = validRecords[0];
    const currentValue = computeKpiValue(rule, lastRecord.metrics_json, facility);
    const isNumeric    = ['NUMERI','ISPEZIONI'].includes(rule.settore);
    const displayValue = currentValue !== null
      ? `${currentValue}${isNumeric ? '' : '%'}`
      : '—';

    // Apri la NC
    const opened = await openAutoNc(
      facilityId,
      facility.company_id,
      year,
      month,
      riskCfg,
      displayValue,
    );

    if (opened) {
      openedNcs.push(rule.kpi_target);
      console.info(`[autoNcEngine] ✓ NC aperta: ${rule.kpi_target} @ ${facilityName}`);
    }
  }

  return openedNcs;
}
