// src/contexts/ModalContext.jsx
// Elimina il pattern modals:{} in App.js — ora ogni modal ha un'API pulita
import { createContext, useContext, useReducer, useCallback } from 'react';

// Tutti i modal dell'app registrati qui — aggiungere è una riga sola
const MODAL_IDS = [
  'udo', 'facility', 'questionnaire', 'dataImport', 'analytics',
  'kpiManager', 'kpiDashboard', 'kpiCharts', 'kpiHub', 'kpiLaser',
  'kpiXray', 'globalReport', 'userManager', 'nonConformity', 'qualityDashboard'
];

const initialState = Object.fromEntries(MODAL_IDS.map(id => [id, false]));

function modalReducer(state, action) {
  switch (action.type) {
    case 'OPEN':
      // Chiude tutto il resto, apre solo quello richiesto
      return { ...initialState, [action.modal]: true };
    case 'OPEN_KEEP':
      // Apre senza chiudere gli altri (per modal stackati)
      return { ...state, [action.modal]: true };
    case 'CLOSE':
      return { ...state, [action.modal]: false };
    case 'CLOSE_ALL':
      return { ...initialState };
    default:
      return state;
  }
}

const ModalContext = createContext(null);

export function ModalProvider({ children }) {
  const [modals, dispatch] = useReducer(modalReducer, initialState);

  const open      = useCallback((modal)        => dispatch({ type: 'OPEN',       modal }), []);
  const openKeep  = useCallback((modal)        => dispatch({ type: 'OPEN_KEEP',  modal }), []);
  const close     = useCallback((modal)        => dispatch({ type: 'CLOSE',      modal }), []);
  const closeAll  = useCallback(()             => dispatch({ type: 'CLOSE_ALL'        }), []);
  const isOpen    = useCallback((modal)        => !!modals[modal],                        [modals]);

  return (
    <ModalContext.Provider value={{ modals, open, openKeep, close, closeAll, isOpen }}>
      {children}
    </ModalContext.Provider>
  );
}

export function useModals() {
  const ctx = useContext(ModalContext);
  if (ctx === null) throw new Error('useModals deve essere usato dentro <ModalProvider>');
  return ctx;
}
