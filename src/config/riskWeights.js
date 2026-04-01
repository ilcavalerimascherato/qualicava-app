/**
 * src/config/riskWeights.js
 * ─────────────────────────────────────────────────────────────
 * UNICA FONTE DI VERITÀ per:
 *  - Pesi di rischio per KPI (usati da riskScoreEngine)
 *  - Criteri di apertura NC automatica (usati da autoNcEngine)
 *
 * MODIFICA QUI per cambiare pesi o soglie senza toccare il codice.
 * ─────────────────────────────────────────────────────────────
 */

// ── Categorie di rischio ──────────────────────────────────────
export const RISK_CATEGORY = {
  CRITICO: 'critico',
  ALTO:    'alto',
  MEDIO:   'medio',
  BASSO:   'basso',
};

// ── Pesi per categoria ────────────────────────────────────────
// Rosso = peso pieno, Giallo = peso * YELLOW_MULTIPLIER, Verde = 0
export const CATEGORY_WEIGHT = {
  [RISK_CATEGORY.CRITICO]: 20,
  [RISK_CATEGORY.ALTO]:    12,
  [RISK_CATEGORY.MEDIO]:    6,
  [RISK_CATEGORY.BASSO]:    2,
};

export const YELLOW_MULTIPLIER = 0.4; // giallo pesa il 40% del rosso

// ── Soglie punteggio rischio struttura ────────────────────────
export const RISK_THRESHOLDS = {
  LOW:    20,  // 0–19   → verde  (basso rischio)
  MEDIUM: 50,  // 20–49  → giallo (rischio moderato)
               // ≥50    → rosso  (rischio elevato)
};

// ── Criteri apertura NC automatica ───────────────────────────
export const AUTO_NC_CRITERIA = {
  // Numero di mesi consecutivi in rosso prima di aprire la NC
  // Modifica qui per cambiare la sensibilità del sistema
  CONSECUTIVE_RED_MONTHS: 2,

  // Solo KPI in queste categorie generano NC automatica
  // (esclude MEDIO e BASSO per evitare alert fatigue)
  ELIGIBLE_CATEGORIES: [RISK_CATEGORY.CRITICO, RISK_CATEGORY.ALTO],
};

// ── Mappatura KPI → peso e categoria ─────────────────────────
// kpi_target deve corrispondere esattamente a KPI_RULES[].kpi_target
export const KPI_RISK_WEIGHTS = [

  // ── CRITICO (peso 20) ─────────────────────────────────────
  {
    kpi_target: 'Cadute Gravi',
    category:   RISK_CATEGORY.CRITICO,
    weight:     CATEGORY_WEIGHT[RISK_CATEGORY.CRITICO],
    nc_title:   'Cadute gravi: superamento soglia critica',
    nc_class:   'Sicurezza ospiti',
  },
  {
    kpi_target: 'Lesioni > III Stadio',
    category:   RISK_CATEGORY.CRITICO,
    weight:     CATEGORY_WEIGHT[RISK_CATEGORY.CRITICO],
    nc_title:   'Lesioni da pressione >III stadio: superamento soglia',
    nc_class:   'Assistenza clinica',
  },
  {
    kpi_target: 'Morti Inattese',
    category:   RISK_CATEGORY.CRITICO,
    weight:     CATEGORY_WEIGHT[RISK_CATEGORY.CRITICO],
    nc_title:   'Mortalità inattesa: superamento soglia',
    nc_class:   'Sicurezza clinica',
  },
  {
    kpi_target: 'Invii PS',
    category:   RISK_CATEGORY.CRITICO,
    weight:     CATEGORY_WEIGHT[RISK_CATEGORY.CRITICO],
    nc_title:   'Invii al Pronto Soccorso: superamento soglia critica',
    nc_class:   'Sicurezza clinica',
  },
  {
    kpi_target: 'Errori Farmaci',
    category:   RISK_CATEGORY.CRITICO,
    weight:     CATEGORY_WEIGHT[RISK_CATEGORY.CRITICO],
    nc_title:   'Errori nella gestione farmaci: superamento soglia',
    nc_class:   'Sicurezza farmacologica',
  },

  // ── ALTO (peso 12) ────────────────────────────────────────
  {
    kpi_target: 'Ospiti Caduti',
    category:   RISK_CATEGORY.ALTO,
    weight:     CATEGORY_WEIGHT[RISK_CATEGORY.ALTO],
    nc_title:   'Cadute ospiti: tasso superiore alla soglia',
    nc_class:   'Sicurezza ospiti',
  },
  {
    kpi_target: 'Cadute Totali',
    category:   RISK_CATEGORY.ALTO,
    weight:     CATEGORY_WEIGHT[RISK_CATEGORY.ALTO],
    nc_title:   'Cadute totali: tasso superiore alla soglia',
    nc_class:   'Sicurezza ospiti',
  },
  {
    kpi_target: 'Lesioni Insorte',
    category:   RISK_CATEGORY.ALTO,
    weight:     CATEGORY_WEIGHT[RISK_CATEGORY.ALTO],
    nc_title:   'Lesioni da pressione insorte in struttura: tasso elevato',
    nc_class:   'Assistenza clinica',
  },
  {
    kpi_target: 'Ospiti con Lesioni',
    category:   RISK_CATEGORY.ALTO,
    weight:     CATEGORY_WEIGHT[RISK_CATEGORY.ALTO],
    nc_title:   'Ospiti con lesioni da pressione: tasso superiore alla soglia',
    nc_class:   'Assistenza clinica',
  },
  {
    kpi_target: 'Contenzioni',
    category:   RISK_CATEGORY.ALTO,
    weight:     CATEGORY_WEIGHT[RISK_CATEGORY.ALTO],
    nc_title:   'Contenzioni: tasso superiore alla soglia',
    nc_class:   'Diritti degli ospiti',
  },
  {
    kpi_target: 'Ricoveri da PS',
    category:   RISK_CATEGORY.ALTO,
    weight:     CATEGORY_WEIGHT[RISK_CATEGORY.ALTO],
    nc_title:   'Ricoveri da PS: tasso superiore alla soglia',
    nc_class:   'Sicurezza clinica',
  },

  // ── MEDIO (peso 6) ────────────────────────────────────────
  {
    kpi_target: 'Val Dolore',
    category:   RISK_CATEGORY.MEDIO,
    weight:     CATEGORY_WEIGHT[RISK_CATEGORY.MEDIO],
    nc_title:   'Valutazione del dolore: copertura insufficiente',
    nc_class:   'Assistenza clinica',
  },
  {
    kpi_target: 'Parametri 15gg',
    category:   RISK_CATEGORY.MEDIO,
    weight:     CATEGORY_WEIGHT[RISK_CATEGORY.MEDIO],
    nc_title:   'Rilevazione parametri quindicinale: copertura insufficiente',
    nc_class:   'Monitoraggio clinico',
  },
  {
    kpi_target: 'PI PAI 30gg',
    category:   RISK_CATEGORY.MEDIO,
    weight:     CATEGORY_WEIGHT[RISK_CATEGORY.MEDIO],
    nc_title:   'PI/PAI entro 30gg: copertura insufficiente',
    nc_class:   'Compliance documentale',
  },
  {
    kpi_target: 'PI PAI 180gg',
    category:   RISK_CATEGORY.MEDIO,
    weight:     CATEGORY_WEIGHT[RISK_CATEGORY.MEDIO],
    nc_title:   'PI/PAI aggiornato entro 180gg: copertura insufficiente',
    nc_class:   'Compliance documentale',
  },
  {
    kpi_target: 'Form. Sicurezza',
    category:   RISK_CATEGORY.MEDIO,
    weight:     CATEGORY_WEIGHT[RISK_CATEGORY.MEDIO],
    nc_title:   'Formazione sicurezza: copertura insufficiente',
    nc_class:   'Formazione',
  },
  {
    kpi_target: 'Farmaci Die',
    category:   RISK_CATEGORY.MEDIO,
    weight:     CATEGORY_WEIGHT[RISK_CATEGORY.MEDIO],
    nc_title:   'Polifarmacoterapia: indice superiore alla soglia',
    nc_class:   'Assistenza farmacologica',
  },
  {
    kpi_target: 'Cont. solo Spondine',
    category:   RISK_CATEGORY.MEDIO,
    weight:     CATEGORY_WEIGHT[RISK_CATEGORY.MEDIO],
    nc_title:   'Spondine: tasso superiore alla soglia',
    nc_class:   'Diritti degli ospiti',
  },

  // ── BASSO (peso 2) ────────────────────────────────────────
  {
    kpi_target: 'Turn Over',
    category:   RISK_CATEGORY.BASSO,
    weight:     CATEGORY_WEIGHT[RISK_CATEGORY.BASSO],
    nc_title:   null, // non genera NC automatica
    nc_class:   null,
  },
  {
    kpi_target: 'Form. HACCP',
    category:   RISK_CATEGORY.BASSO,
    weight:     CATEGORY_WEIGHT[RISK_CATEGORY.BASSO],
    nc_title:   null,
    nc_class:   null,
  },
  {
    kpi_target: 'Reclami Aperti',
    category:   RISK_CATEGORY.BASSO,
    weight:     CATEGORY_WEIGHT[RISK_CATEGORY.BASSO],
    nc_title:   null,
    nc_class:   null,
  },
  {
    kpi_target: 'Audit Interni',
    category:   RISK_CATEGORY.BASSO,
    weight:     CATEGORY_WEIGHT[RISK_CATEGORY.BASSO],
    nc_title:   null,
    nc_class:   null,
  },
  {
    kpi_target: 'Val. Nutrizionale',
    category:   RISK_CATEGORY.BASSO,
    weight:     CATEGORY_WEIGHT[RISK_CATEGORY.BASSO],
    nc_title:   null,
    nc_class:   null,
  },
];

/** Lookup rapido kpi_target → config rischio */
export const KPI_RISK_MAP = new Map(
  KPI_RISK_WEIGHTS.map(r => [r.kpi_target, r])
);
