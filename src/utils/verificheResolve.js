/**
 * src/utils/verificheResolve.js
 * ─────────────────────────────────────────────────────────────
 * Risoluzione dell'ereditarietà della matrice responsabilità: per un
 * template e una struttura, quali righe di verifiche_template_ruoli si
 * applicano — struttura esatta > tipo UDO della struttura > Universale
 * (nessuna facility_id/udo_id). Stesso principio della matrice mostrata
 * da Claudio (Ereditato da Universale / Conflitto UDO specifiche), esteso
 * di un livello per l'override a singola struttura.
 *
 * Completamente agnostico rispetto a React.
 * ─────────────────────────────────────────────────────────────
 */

/**
 * Righe di verifiche_template_ruoli effettivamente applicabili a una
 * struttura per un template, secondo l'ereditarietà.
 * @returns {{ rows: Array, level: 'facility'|'udo'|'universale' }}
 */
export function resolveRuoloRows(templateId, facility, allTemplateRuoli) {
  const rows = (allTemplateRuoli ?? []).filter(r => r.template_id === templateId);

  const facilityRows = rows.filter(r => r.facility_id === facility.id);
  if (facilityRows.length > 0) return { rows: facilityRows, level: 'facility' };

  const udoRows = rows.filter(r => r.udo_id != null && r.udo_id === facility.udo_id);
  if (udoRows.length > 0) return { rows: udoRows, level: 'udo' };

  const universaleRows = rows.filter(r => r.facility_id == null && r.udo_id == null);
  return { rows: universaleRows, level: 'universale' };
}

/**
 * Template attivi e con almeno un ruolo abilitato (a qualunque livello
 * risolto) per una struttura.
 */
export function resolveTemplatesForFacility(facility, templates, allTemplateRuoli) {
  return (templates ?? []).filter(t => {
    if (!t.attivo) return false;
    const { rows } = resolveRuoloRows(t.id, facility, allTemplateRuoli);
    return rows.some(r => r.abilitato);
  });
}

/**
 * Ruoli abilitati risolti per (template, struttura) — usato dal tab
 * Direttore per mostrare chi è responsabile.
 */
export function resolveRuoliAbilitati(templateId, facility, allTemplateRuoli, allRuoli) {
  const { rows } = resolveRuoloRows(templateId, facility, allTemplateRuoli);
  const ruoloIds = new Set(rows.filter(r => r.abilitato).map(r => r.ruolo_id));
  return (allRuoli ?? []).filter(r => ruoloIds.has(r.id));
}
