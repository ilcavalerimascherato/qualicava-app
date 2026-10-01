/**
 * src/utils/soddisfazioneGroups.js
 * ─────────────────────────────────────────────────────────────
 * Raggruppa le strutture filtrate per UDO (le "diverse realtà" del gruppo,
 * Claudio 2026-09-30: "non mi serve vedere i risultati customer per singola
 * struttura... o un risultato di gruppo o per UDO, le singole le guardo
 * dalla dash dei direttori") + individua le rilevazioni a livello società in
 * ambito (facility_id NULL, company_id valorizzato — es. OASI, Il Gabbiano,
 * vedi fix_survey_company_wide_ssot.sql), mostrate come voce a sé invece che
 * spalmate su un UDO che non le rappresenta correttamente (una rilevazione
 * societaria può coprire strutture di UDO diversi).
 *
 * Stessa lista di gruppi riusata da RadarPerUdo.jsx, TrendNpsPerUdo.jsx e
 * GapOspitiOperatoriPerUdo.jsx, per colori/etichette coerenti tra i 3 grafici.
 *
 * Completamente agnostico rispetto a React.
 * ─────────────────────────────────────────────────────────────
 */

const COMPANY_COLOR = '#8b5cf6'; // viola — distingue a colpo d'occhio le voci "società" dalle UDO (colore proprio)

/**
 * @param {Array} facilities - già filtrate (UniversalFilterBar/applyFacilityFilters)
 * @param {Array} udos
 * @param {Array} companies
 * @param {Array} campaignsClient  - righe v_survey_campagne, usate solo per scoprire quali società hanno una rilevazione societaria in ambito
 * @param {Array} campaignsOperator
 * @returns {Array<{ id: string, kind: 'udo'|'company', label: string, color: string, facilityIds: number[], companyIds: number[] }>}
 */
export function buildSoddisfazioneGroups(facilities, udos, companies, campaignsClient, campaignsOperator) {
  const active = (facilities ?? []).filter(f => !f.is_suspended);

  const udoMap = new Map((udos ?? []).map(u => [u.id, u]));
  const byUdo = new Map();
  active.forEach(f => {
    if (f.udo_id == null) return;
    if (!byUdo.has(f.udo_id)) byUdo.set(f.udo_id, []);
    byUdo.get(f.udo_id).push(f.id);
  });
  const udoGroups = [...byUdo.entries()].map(([udoId, facilityIds]) => {
    const udo = udoMap.get(udoId);
    return {
      id: `udo-${udoId}`,
      kind: 'udo',
      label: udo?.name ?? 'UDO',
      color: udo?.color || '#6366f1',
      facilityIds,
      companyIds: [],
    };
  });

  // Una rilevazione societaria è "in ambito" se la società ha almeno una
  // struttura nel filtro attivo — coerente con come UniversalFilterBar
  // restringe già le strutture per regione/società/UDO.
  const companyMap = new Map((companies ?? []).map(c => [c.id, c]));
  const companyIdsInScope = new Set(active.map(f => f.company_id).filter(Boolean));
  const companyWideIds = new Set();
  [...(campaignsClient ?? []), ...(campaignsOperator ?? [])].forEach(c => {
    if (c.facility_id == null && c.company_id != null && companyIdsInScope.has(c.company_id)) {
      companyWideIds.add(c.company_id);
    }
  });
  const companyGroups = [...companyWideIds].map(companyId => ({
    id: `company-${companyId}`,
    kind: 'company',
    label: companyMap.get(companyId)?.name ?? 'Società',
    color: COMPANY_COLOR,
    facilityIds: [],
    companyIds: [companyId],
  }));

  return [...udoGroups, ...companyGroups].sort((a, b) => a.label.localeCompare(b.label, 'it'));
}
