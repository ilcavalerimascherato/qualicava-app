// src/utils/kpiAnomalyEngine.js
// Motore di validazione anomalie logiche nei dati KPI.
// Restituisce una lista di anomalie per un dato metrics_json.
// Completamente agnostico rispetto a React.

const get = (json, key) => {
  if (!json) return null;
  const entry = json[key];
  if (!entry || entry.is_na) return null;
  const v = parseFloat(entry.value);
  return isNaN(v) ? null : v;
};

// Ogni regola: { id, msg, severity, check(json) -> bool }
// check ritorna TRUE se c'è anomalia
export const ANOMALY_RULES = [

  // ── Contenzioni ─────────────────────────────────────────────
  {
    id: 'spondine_gt_contenzioni',
    msg: 'Spondine a letto > contenzioni prescritte (le spondine sono un sottoinsieme)',
    severity: 'alta',
    check: (j) => {
      const spondine     = get(j, 'numero ospiti con solo spondine a letto');
      const contenzioni  = get(j, 'numero ospiti con almeno una contenzione prescritta');
      if (spondine === null || contenzioni === null) return false;
      return spondine > contenzioni;
    }
  },

  // ── Formazione ───────────────────────────────────────────────
  {
    id: 'form_sic_gt_totale',
    msg: 'Dipendenti con formazione sicurezza valida > totale soggetti a formazione',
    severity: 'alta',
    check: (j) => {
      const validi = get(j, 'Numero dipendenti con formazione sicurezza valida');
      const totale = get(j, 'Numero totale dipendenti soggetti a formazione sicurezza');
      if (validi === null || totale === null) return false;
      return validi > totale;
    }
  },
  {
    id: 'form_haccp_gt_totale',
    msg: 'Dipendenti con formazione HACCP valida > totale soggetti a formazione HACCP',
    severity: 'alta',
    check: (j) => {
      const validi = get(j, 'Numero dipendenti con formazione HACCP valida');
      const totale = get(j, 'Numero totale dipendenti soggetti a formazione HACCP');
      if (validi === null || totale === null) return false;
      return validi > totale;
    }
  },
  {
    id: 'addetti_cucina_gt_lavoratori',
    msg: 'Addetti cucina (soggetti HACCP) > lavoratori totali (soggetti sicurezza): gli addetti cucina sono un sottoinsieme dei lavoratori',
    severity: 'alta',
    check: (j) => {
      const cucina     = get(j, 'Numero totale dipendenti soggetti a formazione HACCP');
      const lavoratori = get(j, 'Numero totale dipendenti soggetti a formazione sicurezza');
      if (cucina === null || lavoratori === null) return false;
      return cucina > lavoratori;
    }
  },

  // ── Lesioni ──────────────────────────────────────────────────
  {
    id: 'lesioni_insorte_gt_trattamento',
    msg: 'Lesioni insorte in struttura > lesioni totali in trattamento',
    severity: 'alta',
    check: (j) => {
      const insorte     = get(j, 'Numero lesioni da pressione insorte in struttura');
      const trattamento = get(j, 'Numero lesioni da pressione in trattamento');
      if (insorte === null || trattamento === null) return false;
      return insorte > trattamento;
    }
  },
  {
    id: 'lesioni_iii_gt_trattamento',
    msg: 'Lesioni >III stadio > lesioni totali in trattamento',
    severity: 'alta',
    check: (j) => {
      const iii         = get(j, 'Numero lesioni da pressione superiori al III stadio');
      const trattamento = get(j, 'Numero lesioni da pressione in trattamento');
      if (iii === null || trattamento === null) return false;
      return iii > trattamento;
    }
  },
  {
    id: 'ospiti_lesioni_gt_ospiti',
    msg: 'Ospiti con lesioni > ospiti assistiti nel mese',
    severity: 'alta',
    check: (j) => {
      const lesioni = get(j, 'Numero ospiti con lesioni da pressione in trattamento');
      const ospiti  = get(j, 'Ospiti assistiti nel mese');
      if (lesioni === null || ospiti === null) return false;
      return lesioni > ospiti;
    }
  },

  // ── Cadute ───────────────────────────────────────────────────
  {
    id: 'cadute_gravi_gt_totali',
    msg: 'Cadute gravi > cadute totali',
    severity: 'alta',
    check: (j) => {
      const gravi  = get(j, 'Cadute gravi');
      const totali = get(j, 'Cadute totali');
      if (gravi === null || totali === null) return false;
      return gravi > totali;
    }
  },
  {
    id: 'cadute_ps_gt_totali',
    msg: 'Cadute con invio PS > cadute totali',
    severity: 'alta',
    check: (j) => {
      const ps     = get(j, 'Cadute con invio in Pronto Soccorso');
      const totali = get(j, 'Cadute totali');
      if (ps === null || totali === null) return false;
      return ps > totali;
    }
  },
  {
    id: 'ospiti_caduti_gt_ospiti',
    msg: 'Ospiti caduti > ospiti assistiti nel mese',
    severity: 'alta',
    check: (j) => {
      const caduti = get(j, 'Ospiti caduti');
      const ospiti = get(j, 'Ospiti assistiti nel mese');
      if (caduti === null || ospiti === null) return false;
      return caduti > ospiti;
    }
  },

  // ── PS ───────────────────────────────────────────────────────
  {
    id: 'ricoveri_gt_invii_ps',
    msg: 'Ricoveri da PS > invii al PS',
    severity: 'alta',
    check: (j) => {
      const ricoveri = get(j, 'Ricoveri in seguito ad invio in PS');
      const invii    = get(j, 'Ospiti inviati al PS');
      if (ricoveri === null || invii === null) return false;
      return ricoveri > invii;
    }
  },

  // ── PI/PAI ───────────────────────────────────────────────────
  {
    id: 'pipai_180_gt_ospiti',
    msg: 'PI/PAI aggiornati 180gg > ospiti assistiti',
    severity: 'media',
    check: (j) => {
      const pipai  = get(j, 'Ospiti con PI PAI aggiornato entro 180 gg');
      const ospiti = get(j, 'Ospiti assistiti nel mese');
      if (pipai === null || ospiti === null) return false;
      return pipai > ospiti;
    }
  },
  {
    id: 'pipai_30_gt_ospiti',
    msg: 'PI/PAI redatti 30gg > ospiti assistiti',
    severity: 'media',
    check: (j) => {
      const pipai  = get(j, 'Ospiti con PI PAI redatto entro 30 gg dall ingresso');
      const ospiti = get(j, 'Ospiti assistiti nel mese');
      if (pipai === null || ospiti === null) return false;
      return pipai > ospiti;
    }
  },

  // ── Valori impossibili ───────────────────────────────────────
  {
    id: 'valutazione_dolore_gt_ospiti',
    msg: 'Valutazioni del dolore > ospiti assistiti',
    severity: 'media',
    check: (j) => {
      const val    = get(j, 'Valutazione del dolore');
      const ospiti = get(j, 'Ospiti assistiti nel mese');
      if (val === null || ospiti === null) return false;
      return val > ospiti;
    }
  },
  {
    id: 'parametri_gt_ospiti',
    msg: 'Rilevazioni parametri > ospiti assistiti',
    severity: 'media',
    check: (j) => {
      const param  = get(j, 'Rilevazione parametri quindicinale');
      const ospiti = get(j, 'Ospiti assistiti nel mese');
      if (param === null || ospiti === null) return false;
      return param > ospiti;
    }
  },
];

/**
 * Esegue tutte le regole su un metrics_json.
 * @returns Array<{ id, msg, severity }> — lista anomalie trovate
 */
export function detectAnomalies(metricsJson) {
  if (!metricsJson) return [];
  return ANOMALY_RULES.filter(r => r.check(metricsJson)).map(({ id, msg, severity }) => ({ id, msg, severity }));
}

/**
 * Severità massima tra le anomalie rilevate.
 * @returns 'alta' | 'media' | null
 */
export function maxSeverity(anomalies) {
  if (!anomalies?.length) return null;
  return anomalies.some(a => a.severity === 'alta') ? 'alta' : 'media';
}
