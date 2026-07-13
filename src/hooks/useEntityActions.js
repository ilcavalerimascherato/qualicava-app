/**
 * src/hooks/useEntityActions.js
 * ─────────────────────────────────────────────────────────────
 * Hook centralizzato per tutte le operazioni CRUD sulle entità
 * principali (facility, questionnaire, udo).
 *
 * ELIMINA la duplicazione di try/catch/toast/invalidate in App.js.
 * Ogni action ritorna { ok: boolean, error?: string } per chi vuole
 * gestire il risultato localmente.
 * ─────────────────────────────────────────────────────────────
 */
import { useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { facilityService, udoService } from '../services/supabaseService';
import { useInvalidate } from './useDashboardData';
import { useModals } from '../contexts/ModalContext';

export function useEntityActions() {
  const invalidate = useInvalidate();
  const { close }  = useModals();

  // ── helper generico ──────────────────────────────────────────
  const run = useCallback(async ({ fn, successMsg, errorPrefix, closeModal, onSuccess }) => {
    try {
      await fn();
      if (successMsg)  toast.success(successMsg);
      if (closeModal)  close(closeModal);
      if (onSuccess)   await onSuccess();
      return { ok: true };
    } catch (err) {
      const msg = err?.message ?? 'Errore sconosciuto';
      toast.error(`${errorPrefix}: ${msg}`);
      return { ok: false, error: msg };
    }
  }, [close]);

  // ── facility ─────────────────────────────────────────────────
  const saveFacility = useCallback((data, onSuccess) =>
    run({
      fn: () => facilityService.save(data),
      successMsg:  'Struttura salvata',
      errorPrefix: 'Errore salvataggio struttura',
      closeModal:  'facility',
      onSuccess:   async () => { await invalidate.facilities(); onSuccess?.(); },
    }), [run, invalidate]);

  const deleteFacility = useCallback(async (id, onSuccess) => {
    if (!window.confirm("Eliminare questa struttura? L'operazione è irreversibile.")) return { ok: false };
    return run({
      fn: () => facilityService.delete(id),
      successMsg:  'Struttura eliminata',
      errorPrefix: 'Errore eliminazione struttura',
      closeModal:  'facility',
      onSuccess:   async () => { await invalidate.facilities(); onSuccess?.(); },
    });
  }, [run, invalidate]);

  const toggleSuspendFacility = useCallback((facility) =>
    run({
      fn: () => facilityService.toggleSuspend(facility),
      errorPrefix: 'Errore sospensione struttura',
      onSuccess:   () => invalidate.facilities(),
    }), [run, invalidate]);

  // ── udo ──────────────────────────────────────────────────────
  const saveUdo = useCallback((data) =>
    run({
      fn: () => udoService.save(data),
      errorPrefix: 'Errore salvataggio UDO',
      onSuccess:   () => invalidate.udos(),
    }), [run, invalidate]);

  const deleteUdo = useCallback(async (id) => {
    if (!window.confirm('Eliminare questa UDO?')) return { ok: false };
    return run({
      fn: () => udoService.delete(id),
      errorPrefix: 'Errore eliminazione UDO',
      onSuccess:   () => invalidate.udos(),
    });
  }, [run, invalidate]);

  return {
    saveFacility,
    deleteFacility,
    toggleSuspendFacility,
    saveUdo,
    deleteUdo,
  };
}
