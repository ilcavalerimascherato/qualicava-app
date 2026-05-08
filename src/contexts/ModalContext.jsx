/**
 * src/contexts/ModalContext.jsx  —  v2
 * ─────────────────────────────────────────────────────────────
 * MIGLIORAMENTI v2:
 *  - MODAL_IDS rimane come fonte di verità, ma è esportato
 *    così i componenti possono validare i nomi al compile time
 *    tramite JSDoc typedef (nessun cambio a runtime).
 *  - Aggiunta action TOGGLE per semplificare bottoni on/off.
 *  - Aggiunta `openWith(modal, payload)` per passare dati
 *    contestuali al modal senza useState separati in App.js
 *    (es: apri KpiManager con { facility } già dentro).
 *  - `useModal(id)` — hook granulare per modal singolo.
 * ─────────────────────────────────────────────────────────────
 */
import { createContext, useContext, useReducer, useCallback, useMemo } from 'react';

/**
 * @typedef {'udo'|'facility'|'questionnaire'|'dataImport'|'analytics'|
 *   'kpiManager'|'kpiDashboard'|'kpiCharts'|'kpiHub'|'kpiLaser'|
 *   'kpiXray'|'globalReport'|'userManager'|'nonConformity'|'qualityDashboard'|
 *   'ranking'} ModalId
 */
export const MODAL_IDS = /** @type {const} */ ([
  'udo', 'facility', 'questionnaire', 'dataImport', 'analytics',
  'kpiManager', 'kpiDashboard', 'kpiCharts', 'kpiHub', 'kpiLaser',
  'kpiXray', 'globalReport', 'userManager', 'nonConformity', 'qualityDashboard',
  'ranking'
]);

const initialState = {
  modals:   Object.fromEntries(MODAL_IDS.map(id => [id, false])),
  payloads: Object.fromEntries(MODAL_IDS.map(id => [id, null])),
};

function modalReducer(state, action) {
  switch (action.type) {
    case 'OPEN':
      return {
        modals:   { ...initialState.modals, [action.modal]: true },
        payloads: { ...initialState.payloads, [action.modal]: action.payload ?? null },
      };
    case 'OPEN_KEEP':
      return {
        ...state,
        modals:   { ...state.modals, [action.modal]: true },
        payloads: { ...state.payloads, [action.modal]: action.payload ?? null },
      };
    case 'CLOSE':
      return {
        ...state,
        modals:   { ...state.modals,   [action.modal]: false },
        payloads: { ...state.payloads, [action.modal]: null  },
      };
    case 'TOGGLE':
      return {
        ...state,
        modals: { ...state.modals, [action.modal]: !state.modals[action.modal] },
      };
    case 'CLOSE_ALL':
      return { ...initialState };
    default:
      return state;
  }
}

const ModalContext = createContext(null);

export function ModalProvider({ children }) {
  const [state, dispatch] = useReducer(modalReducer, initialState);

  /** Chiude tutto il resto, apre il modal (con payload opzionale) */
  const open = useCallback(
    (modal, payload = null) => dispatch({ type: 'OPEN', modal, payload }),
    []
  );

  /** Apre senza chiudere gli altri (modal stackati) */
  const openKeep = useCallback(
    (modal, payload = null) => dispatch({ type: 'OPEN_KEEP', modal, payload }),
    []
  );

  const close    = useCallback((modal) => dispatch({ type: 'CLOSE',     modal }), []);
  const toggle   = useCallback((modal) => dispatch({ type: 'TOGGLE',    modal }), []);
  const closeAll = useCallback(()      => dispatch({ type: 'CLOSE_ALL'        }), []);
  const isOpen   = useCallback((modal) => !!state.modals[modal], [state.modals]);

  /** Recupera il payload associato al modal (es. facility selezionata) */
  const getPayload = useCallback((modal) => state.payloads[modal], [state.payloads]);

  const value = useMemo(() => ({
    modals:  state.modals,
    open, openKeep, close, toggle, closeAll, isOpen, getPayload,
  }), [state.modals, open, openKeep, close, toggle, closeAll, isOpen, getPayload]);

  return (
    <ModalContext.Provider value={value}>
      {children}
    </ModalContext.Provider>
  );
}

/** Hook globale — accede a tutti i modal */
export function useModals() {
  const ctx = useContext(ModalContext);
  if (ctx === null) throw new Error('useModals deve essere usato dentro <ModalProvider>');
  return ctx;
}

/**
 * Hook granulare — accede a un singolo modal.
 * Evita re-render inutili nei componenti che controllano un solo modal.
 * @param {ModalId} id
 */
export function useModal(id) {
  const { modals, open, close, toggle, getPayload } = useModals();
  return {
    isOpen:  modals[id],
    payload: getPayload(id),
    open:    (payload) => open(id, payload),
    close:   ()        => close(id),
    toggle:  ()        => toggle(id),
  };
}
