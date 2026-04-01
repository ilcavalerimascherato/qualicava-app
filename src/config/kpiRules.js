/**
 * src/config/kpiRules.js  —  v2
 * ─────────────────────────────────────────────────────────────
 * UNICA FONTE DI VERITÀ per le regole KPI
 * Usato da: KpiChartsModal, KpiLaserModal, KpiDashboardModal, KpiXrayModal
 *
 * MIGLIORAMENTI v2:
 *  - `getKpiStatus(rule, value)` — calcola lo stato semaforo in un
 *    unico posto, eliminando logiche duplicate nei componenti.
 *  - `getKpisBySettore(settore)` — filtra per settore con O(1).
 *  - `getKpiByTarget(target)` — lookup per kpi_target con O(1)
 *    (utile per la validazione dati importati).
 *  - `KPI_RULES_BY_SETTORE` — mappa pre-calcolata settore→regole.
 *  - Costanti SETTORI tipizzate per evitare typo nelle query.
 * ─────────────────────────────────────────────────────────────
 */

// ── SETTORI ───────────────────────────────────────────────────
/** @typedef {'ECONOMICO'|'PS'|'SANITARI'|'LESIONI'|'CADUTE'|'NUMERI'|'CONTENZIONI'|'ASSISTENZA'|'COMPLIANCE'|'ISPEZIONI'} Settore */
export const SETTORI = /** @type {const} */ ({
  ECONOMICO:   'ECONOMICO',
  PS:          'PS',
  SANITARI:    'SANITARI',
  LESIONI:     'LESIONI',
  CADUTE:      'CADUTE',
  NUMERI:      'NUMERI',
  CONTENZIONI: 'CONTENZIONI',
  ASSISTENZA:  'ASSISTENZA',
  COMPLIANCE:  'COMPLIANCE',
  ISPEZIONI:   'ISPEZIONI',
});

/** @typedef {'MAX'|'MIN'|null} Direzione */
/** @typedef {'green'|'yellow'|'red'|'neutral'} KpiStatus */

// ── REGOLE ───────────────────────────────────────────────────
export const KPI_RULES = [
  { indicatore: 'Ospiti assistiti nel mese', settore: SETTORI.ECONOMICO, calcolo: '[OSPITI ASSISTITI NEL MESE] / [POSTI LETTO ATTIVI]', kpi_target: 'Turn Over', target_verde: 0.98, target_rosso: 0.94, direzione: 'MAX' },
  { indicatore: 'Ospiti inviati al PS', settore: SETTORI.PS, calcolo: '[OSPITI INVIATI AL PS] / [OSPITI ASSISTITI NEL MESE]', kpi_target: 'Invii PS', target_verde: 0.02, target_rosso: 0.05, direzione: 'MIN' },
  { indicatore: 'Valutazione del dolore', settore: SETTORI.SANITARI, calcolo: '[VALUTAZIONE DEL DOLORE] / [OSPITI ASSISTITI NEL MESE]', kpi_target: 'Val Dolore', target_verde: 1.0, target_rosso: 0.95, direzione: 'MAX' },
  { indicatore: 'Ricoveri in seguito ad invio in PS', settore: SETTORI.PS, calcolo: '[RICOVERI IN SEGUITO AD INVIO IN PS] / [OSPITI ASSISTITI NEL MESE]', kpi_target: 'Ricoveri da PS', target_verde: 0.85, target_rosso: 0.7, direzione: 'MAX' },
  { indicatore: 'Rilevazione parametri quindicinale', settore: SETTORI.SANITARI, calcolo: '[RILEVAZIONE PARAMETRI QUINDICINALE] / [OSPITI ASSISTITI NEL MESE]', kpi_target: 'Parametri 15gg', target_verde: 0.95, target_rosso: 0.9, direzione: 'MAX' },
  { indicatore: 'Numero ospiti con lesioni da pressione in trattamento', settore: SETTORI.LESIONI, calcolo: '[NUMERO OSPITI CON LESIONI DA PRESSIONE IN TRATTAMENTO] / [OSPITI ASSISTITI NEL MESE]', kpi_target: 'Ospiti con Lesioni', target_verde: 0.1, target_rosso: 0.15, direzione: 'MIN' },
  { indicatore: 'Numero lesioni da pressione in trattamento', settore: SETTORI.LESIONI, calcolo: '[NUMERO LESIONI DA PRESSIONE IN TRATTAMENTO] / [OSPITI ASSISTITI NEL MESE]', kpi_target: 'Lesioni', target_verde: 0.1, target_rosso: 0.15, direzione: 'MIN' },
  { indicatore: 'Numero lesioni da pressione superiori al III stadio', settore: SETTORI.LESIONI, calcolo: '[NUMERO LESIONI DA PRESSIONE SUPERIORI AL III STADIO] / [OSPITI ASSISTITI NEL MESE]', kpi_target: 'Lesioni > III Stadio', target_verde: 0.1, target_rosso: 0.15, direzione: 'MIN' },
  { indicatore: 'Numero lesioni da pressione insorte in struttura', settore: SETTORI.LESIONI, calcolo: '[NUMERO LESIONI DA PRESSIONE INSORTE IN STRUTTURA] / [NUMERO LESIONI DA PRESSIONE IN TRATTAMENTO]', kpi_target: 'Lesioni Insorte', target_verde: 0.03, target_rosso: 0.05, direzione: 'MIN' },
  { indicatore: 'Lesioni da pressione guarite', settore: SETTORI.LESIONI, calcolo: '[LESIONI DA PRESSIONE GUARITE] / [NUMERO LESIONI DA PRESSIONE IN TRATTAMENTO]', kpi_target: 'Lesioni Guarite', target_verde: 0.2, target_rosso: 0.1, direzione: 'MIN' },
  { indicatore: 'Ospiti caduti', settore: SETTORI.CADUTE, calcolo: '[OSPITI CADUTI] / [OSPITI ASSISTITI NEL MESE]', kpi_target: 'Ospiti Caduti', target_verde: 0.08, target_rosso: 0.12, direzione: 'MIN' },
  { indicatore: 'Cadute totali', settore: SETTORI.CADUTE, calcolo: '[CADUTE TOTALI] / [OSPITI ASSISTITI NEL MESE]', kpi_target: 'Cadute Totali', target_verde: 0.08, target_rosso: 0.12, direzione: 'MIN' },
  { indicatore: 'Cadute gravi', settore: SETTORI.CADUTE, calcolo: '[CADUTE GRAVI] / [OSPITI ASSISTITI NEL MESE]', kpi_target: 'Cadute Gravi', target_verde: 0.00, target_rosso: 0.01, direzione: 'MIN' },
  { indicatore: 'Cadute con invio in Pronto Soccorso', settore: SETTORI.PS, calcolo: '[CADUTE CON INVIO IN PRONTO SOCCORSO] / [OSPITI ASSISTITI NEL MESE]', kpi_target: 'Cadute invio PS', target_verde: 0.05, target_rosso: 0.1, direzione: 'MIN' },
  { indicatore: 'Mortalita', settore: SETTORI.NUMERI, calcolo: '[MORTALITA]', kpi_target: 'Morti', target_verde: 0.1, target_rosso: 0.3, direzione: 'MIN' },
  { indicatore: 'Morti inattese', settore: SETTORI.NUMERI, calcolo: '[MORTI INATTESE]', kpi_target: 'Morti Inattese', target_verde: 0.1, target_rosso: 0.3, direzione: 'MIN' },
  { indicatore: 'Errore gestione farmaci', settore: SETTORI.NUMERI, calcolo: '[ERRORE GESTIONE FARMACI]', kpi_target: 'Errori Farmaci', target_verde: 0.01, target_rosso: 0.05, direzione: 'MIN' },
  { indicatore: 'numero farmaci mediamente assunti in una giornata campione', settore: SETTORI.NUMERI, calcolo: '[NUMERO FARMACI MEDIAMENTE ASSUNTI IN UNA GIORNATA CAMPIONE] / [OSPITI ASSISTITI NEL MESE]', kpi_target: 'Farmaci Die', target_verde: 7, target_rosso: 9, direzione: 'MIN' },
  { indicatore: 'numero ospiti con almeno una contenzione prescritta', settore: SETTORI.CONTENZIONI, calcolo: '[NUMERO OSPITI CON ALMENO UNA CONTENZIONE PRESCRITTA] / [OSPITI ASSISTITI NEL MESE]', kpi_target: 'Contenzioni', target_verde: 0.2, target_rosso: 0.35, direzione: 'MIN' },
  { indicatore: 'numero ospiti con solo spondine a letto', settore: SETTORI.CONTENZIONI, calcolo: '[NUMERO OSPITI CON SOLO SPONDINE A LETTO] / [OSPITI ASSISTITI NEL MESE]', kpi_target: 'Cont. solo Spondine', target_verde: 0.15, target_rosso: 0.30, direzione: 'MIN' },
  { indicatore: 'Ospiti con valutazione stato nutrizionale', settore: SETTORI.SANITARI, calcolo: '[OSPITI CON VALUTAZIONE STATO NUTRIZIONALE] / [OSPITI ASSISTITI NEL MESE]', kpi_target: 'Val. Nutrizionale', target_verde: 0.95, target_rosso: 0.9, direzione: 'MAX' },
  { indicatore: 'numero ospiti valutati a rischio malnutrizione / disidratazione', settore: SETTORI.ASSISTENZA, calcolo: '[NUMERO OSPITI VALUTATI A RISCHIO MALNUTRIZIONE / DISIDRATAZIONE] / [OSPITI ASSISTITI NEL MESE]', kpi_target: 'Rischio Malnutrizione', target_verde: 0.01, target_rosso: 0.1, direzione: 'MIN' },
  { indicatore: 'numero ospiti con disfagia', settore: SETTORI.ASSISTENZA, calcolo: '[NUMERO OSPITI CON DISFAGIA] / [OSPITI ASSISTITI NEL MESE]', kpi_target: 'Disfagia', target_verde: 0.05, target_rosso: 0.1, direzione: 'MIN' },
  { indicatore: 'numero ospiti che necessitano di assistenza per essere alimentati', settore: SETTORI.ASSISTENZA, calcolo: '[NUMERO OSPITI CHE NECESSITANO DI ASSISTENZA PER ESSERE ALIMENTATI] / [OSPITI ASSISTITI NEL MESE]', kpi_target: 'Assistenza Alim.', target_verde: 0.05, target_rosso: 0.2, direzione: 'MIN' },
  { indicatore: 'numero ospiti con alimentazione enterale con sonda', settore: SETTORI.ASSISTENZA, calcolo: '[NUMERO OSPITI CON ALIMENTAZIONE ENTERALE CON SONDA] / [OSPITI ASSISTITI NEL MESE]', kpi_target: 'Alim. Sonda', target_verde: 0.01, target_rosso: 0.05, direzione: 'MIN' },
  { indicatore: 'Numero ospiti con incontinenza (singola o doppia)', settore: SETTORI.ASSISTENZA, calcolo: '[NUMERO OSPITI CON INCONTINENZA (SINGOLA O DOPPIA)] / [OSPITI ASSISTITI NEL MESE]', kpi_target: 'Incontinenza', target_verde: 0.3, target_rosso: 0.8, direzione: 'MIN' },
  { indicatore: 'Ospiti con PI PAI redatto entro 30 gg dall ingresso', settore: SETTORI.COMPLIANCE, calcolo: '[OSPITI CON PI PAI REDATTO ENTRO 30 GG DALL INGRESSO] / [OSPITI ASSISTITI NEL MESE]', kpi_target: 'PI PAI 30gg', target_verde: 1, target_rosso: 0.95, direzione: 'MAX' },
  { indicatore: 'Ospiti con PI PAI aggiornato entro 180 gg', settore: SETTORI.COMPLIANCE, calcolo: '[OSPITI CON PI PAI AGGIORNATO ENTRO 180 GG] / [OSPITI ASSISTITI NEL MESE]', kpi_target: 'PI PAI 180gg', target_verde: 1, target_rosso: 0.95, direzione: 'MAX' },
  { indicatore: 'numero segnalazioni per reclami aperte nel mese', settore: SETTORI.ISPEZIONI, calcolo: '[NUMERO SEGNALAZIONI PER RECLAMI APERTE NEL MESE]', kpi_target: 'Reclami Aperti', target_verde: null, target_rosso: null, direzione: null },
  { indicatore: 'numero segnalazioni per reclami chiuse nel mese', settore: SETTORI.ISPEZIONI, calcolo: '[NUMERO SEGNALAZIONI PER RECLAMI CHIUSE NEL MESE]', kpi_target: 'Reclami Chiusi', target_verde: 1, target_rosso: 0.9, direzione: 'MAX' },
  { indicatore: 'Numero totale dipendenti soggetti a formazione sicurezza', settore: SETTORI.NUMERI, calcolo: '[NUMERO TOTALE DIPENDENTI SOGGETTI A FORMAZIONE SICUREZZA]', kpi_target: 'Lavoratori', target_verde: null, target_rosso: null, direzione: null },
  { indicatore: 'Numero dipendenti con formazione sicurezza valida', settore: SETTORI.COMPLIANCE, calcolo: '[NUMERO DIPENDENTI CON FORMAZIONE SICUREZZA VALIDA] / [NUMERO TOTALE DIPENDENTI SOGGETTI A FORMAZIONE SICUREZZA]', kpi_target: 'Form. Sicurezza', target_verde: 0.95, target_rosso: 0.9, direzione: 'MAX' },
  { indicatore: 'Numero totale dipendenti soggetti a formazione HACCP', settore: SETTORI.NUMERI, calcolo: '[NUMERO TOTALE DIPENDENTI SOGGETTI A FORMAZIONE HACCP]', kpi_target: 'Addetti Cucina', target_verde: null, target_rosso: null, direzione: null },
  { indicatore: 'Numero dipendenti con formazione HACCP valida', settore: SETTORI.COMPLIANCE, calcolo: '[NUMERO DIPENDENTI CON FORMAZIONE HACCP VALIDA] / [NUMERO TOTALE DIPENDENTI SOGGETTI A FORMAZIONE HACCP]', kpi_target: 'Form. HACCP', target_verde: 0.95, target_rosso: 0.9, direzione: 'MAX' },
  { indicatore: 'numero incident reporting interni e near miss', settore: SETTORI.NUMERI, calcolo: '[NUMERO INCIDENT REPORTING INTERNI E NEAR MISS]', kpi_target: 'IR e Near Miss', target_verde: 0.01, target_rosso: 0.1, direzione: 'MIN' },
  { indicatore: 'numero audit interni ricevuti (giornate) da Sede', settore: SETTORI.ISPEZIONI, calcolo: '[NUMERO AUDIT INTERNI RICEVUTI (GIORNATE) DA SEDE]', kpi_target: 'Audit Interni', target_verde: null, target_rosso: null, direzione: null },
  { indicatore: 'Numero di ispezioni ricevute da Enti esterni (ATS, NAS, ecc)', settore: SETTORI.ISPEZIONI, calcolo: '[NUMERO DI ISPEZIONI RICEVUTE DA ENTI ESTERNI (ATS, NAS, ECC)]', kpi_target: 'Ispezioni Esterne', target_verde: null, target_rosso: null, direzione: null },
];

// ── LOOKUP MAPS (O(1)) ────────────────────────────────────────
/** Mappa settore → array di regole (pre-calcolata, non ricalcolare nei render) */
export const KPI_RULES_BY_SETTORE = KPI_RULES.reduce((acc, rule) => {
  if (!acc[rule.settore]) acc[rule.settore] = [];
  acc[rule.settore].push(rule);
  return acc;
}, {});

/** Mappa kpi_target → regola */
const KPI_BY_TARGET = new Map(KPI_RULES.map(r => [r.kpi_target, r]));

// ── HELPERS ───────────────────────────────────────────────────
export const KPI_SECTORS = Object.keys(SETTORI);

/** Filtra le regole KPI per settore */
export const getKpisBySettore = (settore) => KPI_RULES_BY_SETTORE[settore] ?? [];

/** Cerca una regola per kpi_target */
export const getKpiByTarget = (target) => KPI_BY_TARGET.get(target) ?? null;

/**
 * Calcola lo stato semaforo di un KPI dato il suo valore.
 * Unica implementazione — elimina logica duplicata nei componenti.
 *
 * @param {Object} rule  - Una entry di KPI_RULES
 * @param {number} value - Il valore calcolato del KPI
 * @returns {KpiStatus}  - 'green' | 'yellow' | 'red' | 'neutral'
 */
export function getKpiStatus(rule, value) {
  const { target_verde, target_rosso, direzione } = rule;

  // KPI senza target → solo informativo
  if (target_verde === null || target_rosso === null || !direzione) {
    return 'neutral';
  }

  if (direzione === 'MAX') {
    if (value >= target_verde) return 'green';
    if (value >= target_rosso) return 'yellow';
    return 'red';
  }

  if (direzione === 'MIN') {
    if (value <= target_verde) return 'green';
    if (value <= target_rosso) return 'yellow';
    return 'red';
  }

  return 'neutral';
}

/**
 * Formatta un valore KPI come percentuale leggibile.
 * @param {number|null} value
 * @param {number} decimals
 */
export function formatKpiValue(value, decimals = 1) {
  if (value === null || value === undefined || isNaN(value)) return '—';
  return `${(value * 100).toFixed(decimals)}%`;
}
/**
 * Restituisce true se il settore produce valori assoluti (non percentuali).
 * Usare questa funzione ovunque invece di hardcodare la lista.
 * Settori numerici: NUMERI, ISPEZIONI
 */
export function isNumericSettore(settore) {
  return ['NUMERI', 'ISPEZIONI'].includes(settore);
}

