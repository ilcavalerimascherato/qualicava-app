/**
 * src/config/constants.js  —  v2
 * ─────────────────────────────────────────────────────────────
 * UNICA FONTE DI VERITÀ PER LE COSTANTI GLOBALI DELL'APPLICAZIONE
 *
 * MIGLIORAMENTI v2:
 *  - APP_CONFIG espone ora anche metadati versione/ambiente
 *    per il debugging e i log di errore.
 *  - PALETTE rinominata in DESIGN_TOKENS e strutturata con
 *    sezioni semantiche (brand, status, traffic, surface).
 *    Più semplice da usare e da estendere.
 *  - Nuova sezione API_CONFIG per centralizzare endpoint e
 *    timeout, evitando magic string sparsi nei servizi.
 *  - Helper tipizzati per i mesi (getMonthName, getCurrentMonth).
 *  - ROLES centralizzato: fonte di verità per i ruoli possibili.
 * ─────────────────────────────────────────────────────────────
 */

// ── APP CONFIG ────────────────────────────────────────────────
export const APP_CONFIG = {
  NAME:            'QualiCAVA SECURE',
  VERSION:         '2.0.0',
  COMPANY:         'Gruppo OVER',
  YEARS_AVAILABLE: [2024, 2025, 2026, 2027, 2028],
  DEFAULT_COLOR:   '#cbd5e1', // Slate-300
  ENV:             process.env.NODE_ENV ?? 'production',
};

// ── API CONFIG ────────────────────────────────────────────────
export const API_CONFIG = {
  /** Modello Gemini usato per la generazione dei report AI */
  AI_MODEL:    'gemini-2.5-flash',
  /** Timeout in ms per le chiamate AI */
  AI_TIMEOUT:  30_000,
  /** Stale time default React Query (ms) */
  STALE_TIME:  60_000,
};

// ── RUOLI ─────────────────────────────────────────────────────
/** Fonte di verità per tutti i ruoli possibili nell'applicazione.
 *  Usato da AuthContext per i controlli, e dal pannello UserManager. */
export const ROLES = /** @type {const} */ ({
  SUPERADMIN:    'superadmin',
  ADMIN:         'admin',
  SEDE:          'sede',
  BOARD:         'board',
  DIRECTOR:      'director',
  DIR_SANITARIO: 'dir_sanitario',
  REF_STRUTTURA: 'ref_struttura',
  REF_QUALITA:   'ref_qualita',
  VIEWER:        'viewer',
});

export const ROLE_LABELS = {
  [ROLES.SUPERADMIN]:    'Super Admin',
  [ROLES.ADMIN]:         'Amministratore',
  [ROLES.SEDE]:          'Sede',
  [ROLES.BOARD]:         'Board',
  [ROLES.DIRECTOR]:      'Direttore',
  [ROLES.DIR_SANITARIO]: 'Direttore Sanitario',
  [ROLES.REF_STRUTTURA]: 'Referente Struttura',
  [ROLES.REF_QUALITA]:   'Referente Qualità',
  [ROLES.VIEWER]:        'Visualizzatore',
};

/** I 4 ruoli che accedono "dalle strutture" (stessa vista DirectorFacility,
 *  stessi permessi applicativi) — solo DIRECTOR vede i dati economici, gli
 *  altri 3 no (vedi RLS su economico_mensile/economico_mensile_struttura). */
export const FACILITY_STAFF_ROLES = [
  ROLES.DIRECTOR, ROLES.DIR_SANITARIO, ROLES.REF_STRUTTURA, ROLES.REF_QUALITA,
];

// ── SURVEY TYPES ──────────────────────────────────────────────
export const SURVEY_TYPES = {
  CLIENT:   'client',
  OPERATOR: 'operator',
};

// ── STATUS TYPES ──────────────────────────────────────────────
export const STATUS_TYPES = {
  TODO:      'todo',
  PROGRESS:  'progress',
  COMPLETED: 'completed',
};

// ── DESIGN TOKENS ─────────────────────────────────────────────
/**
 * Token di design centralizzati.
 * Usare questi valori ovunque si definiscono stili inline o
 * si configurano librerie grafiche (Recharts, Chart.js, ecc.).
 * Per i classNameTailwind, usare le classi corrispondenti.
 */
export const DESIGN_TOKENS = {
  brand: {
    primary:      '#4f46e5', // Indigo-600
    primaryLight: '#e0e7ff', // Indigo-100
    primaryDark:  '#4338ca', // Indigo-700
    accent:       '#10b981', // Emerald-500
    accentLight:  '#d1fae5', // Emerald-100
    accentDark:   '#059669', // Emerald-600
  },
  status: {
    danger:       '#f43f5e', // Rose-500
    dangerHover:  '#e11d48', // Rose-600
    warning:      '#f59e0b', // Amber-500
    success:      '#10b981', // Emerald-500
    info:         '#3b82f6', // Blue-500
  },
  /** Semafori KPI — usati in KpiChartsModal, KpiDashboardModal */
  trafficLight: {
    green:  '#22c55e',
    yellow: '#a855f7', // Purple (per differenziazione da amber)
    red:    '#ef4444',
  },
  surface: {
    background:   '#f8fafc', // Slate-50
    white:        '#ffffff',
    border:       '#e2e8f0', // Slate-200
    borderStrong: '#cbd5e1', // Slate-300
  },
  text: {
    primary:      '#0f172a', // Slate-900
    secondary:    '#475569', // Slate-600
    muted:        '#64748b', // Slate-500
    disabled:     '#94a3b8', // Slate-400
  },
};

// Alias retrocompatibile — evita di rompere componenti esistenti
export const PALETTE = {
  primary:      DESIGN_TOKENS.brand.primary,
  primaryHover: DESIGN_TOKENS.brand.primaryDark,
  danger:       DESIGN_TOKENS.status.danger,
  dangerHover:  DESIGN_TOKENS.status.dangerHover,
  success:      DESIGN_TOKENS.status.success,
  warning:      DESIGN_TOKENS.status.warning,
  background:   DESIGN_TOKENS.surface.background,
  surface:      DESIGN_TOKENS.surface.white,
  text:         DESIGN_TOKENS.text.primary,
  textMuted:    DESIGN_TOKENS.text.muted,
  border:       DESIGN_TOKENS.surface.border,
  trafficLight: DESIGN_TOKENS.trafficLight,
};

// ── MESI ─────────────────────────────────────────────────────
export const MONTHS = [
  { id: 1,  name: 'Gennaio',   short: 'Gen', q: 1 },
  { id: 2,  name: 'Febbraio',  short: 'Feb', q: 1 },
  { id: 3,  name: 'Marzo',     short: 'Mar', q: 1 },
  { id: 4,  name: 'Aprile',    short: 'Apr', q: 2 },
  { id: 5,  name: 'Maggio',    short: 'Mag', q: 2 },
  { id: 6,  name: 'Giugno',    short: 'Giu', q: 2 },
  { id: 7,  name: 'Luglio',    short: 'Lug', q: 3 },
  { id: 8,  name: 'Agosto',    short: 'Ago', q: 3 },
  { id: 9,  name: 'Settembre', short: 'Set', q: 3 },
  { id: 10, name: 'Ottobre',   short: 'Ott', q: 4 },
  { id: 11, name: 'Novembre',  short: 'Nov', q: 4 },
  { id: 12, name: 'Dicembre',  short: 'Dic', q: 4 },
];

// ── REGIONI ───────────────────────────────────────────────────
export const REGIONI_ITALIANE = [
  'Abruzzo', 'Basilicata', 'Calabria', 'Campania', 'Emilia-Romagna',
  'Friuli-Venezia Giulia', 'Lazio', 'Liguria', 'Lombardia', 'Marche',
  'Molise', 'Piemonte', 'Puglia', 'Sardegna', 'Sicilia',
  'Toscana', 'Trentino-Alto Adige', 'Umbria', "Valle d'Aosta", 'Veneto',
];

// ── HELPERS ───────────────────────────────────────────────────
export const getMonthById      = (id) => MONTHS.find(m => m.id === id) ?? null;
export const getMonthsByQuarter = (q) => MONTHS.filter(m => m.q === q);
export const getMonthName      = (id) => getMonthById(id)?.name ?? '—';
export const getCurrentMonth   = ()   => getMonthById(new Date().getMonth() + 1);
export const getCurrentYear    = ()   => new Date().getFullYear();
