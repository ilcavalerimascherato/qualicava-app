/**
 * src/utils/verificheAlertEngine.js
 * ─────────────────────────────────────────────────────────────
 * Monitoraggio attivo delle verifiche: per ogni struttura e template
 * applicabile, calcola la prossima scadenza (computeNextDueDate) e segnala
 * un alert se è già passata. Alimenta il badge rosso in AppHeader e il
 * pannello "In evidenza" (VerificheAlertPanel).
 *
 * Completamente agnostico rispetto a React.
 * ─────────────────────────────────────────────────────────────
 */
import { resolveTemplatesForFacility } from './verificheResolve';
import { computeNextDueDate, daysOverdue } from './verificheCadenza';

/**
 * @param {Object} params
 * @param {Array} params.facilities
 * @param {Array} params.templates
 * @param {Array} params.templateRuoli
 * @param {Array} params.sessioni
 * @returns {Array<{ id, facilityId, facilityName, templateId, templateNome, overdue, severity }>}
 *   ordinato per giorni di ritardo decrescente
 */
export function getVerificheAlerts({ facilities, templates, templateRuoli, sessioni }) {
  const alerts = [];

  (facilities ?? []).filter(f => !f.is_suspended).forEach(facility => {
    const applicabili = resolveTemplatesForFacility(facility, templates, templateRuoli);

    applicabili.forEach(template => {
      const sessioniTemplate = (sessioni ?? []).filter(
        s => s.facility_id === facility.id && s.template_id === template.id
      );
      const ultima = sessioniTemplate.length
        ? sessioniTemplate.reduce((max, s) =>
            new Date(s.data_esecuzione) > new Date(max.data_esecuzione) ? s : max
          ).data_esecuzione
        : null;

      const nextDue = computeNextDueDate(template, ultima);
      const overdue = daysOverdue(nextDue);

      if (overdue > 0) {
        alerts.push({
          id: `verifica-${facility.id}-${template.id}`,
          facilityId: facility.id,
          facilityName: facility.name,
          templateId: template.id,
          templateNome: template.nome,
          overdue,
          severity: overdue > 14 ? 'alta' : 'media',
        });
      }
    });
  });

  return alerts.sort((a, b) => b.overdue - a.overdue);
}

/** Numero di alert per una singola struttura — usato dal tab Direttore. */
export function getVerificheAlertsForFacility(facility, templates, templateRuoli, sessioni) {
  return getVerificheAlerts({ facilities: [facility], templates, templateRuoli, sessioni });
}
