/**
 * src/hooks/useHaccpData.js
 * ─────────────────────────────────────────────────────────────
 * Hook per i dati HACCP. Espone:
 *  - useHaccpSemafori() → mappa { facility_id: semaforo } da haccp_scadenzario
 *  - useHaccpFascicolo(facilityId) → tutti i dati HACCP di una struttura
 * ─────────────────────────────────────────────────────────────
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabaseClient';
import { fetchEffectiveHaccpSemafori } from '../utils/haccpSemaforo';

// ── useHaccpSemafori ──────────────────────────────────────────
// Carica la view haccp_scadenzario e ritorna una mappa id→semaforo
// (regola "cucina condivisa → blu" centralizzata in utils/haccpSemaforo.js,
// stessa fonte usata da useBadgeCounts.js per il badge di navigazione).
// Usato da MasterDashboard per colorare i cappelli
export function useHaccpSemafori() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['haccp', 'semafori'],
    queryFn: () => fetchEffectiveHaccpSemafori(),
    staleTime: 5 * 60 * 1000,
  });

  return {
    semafori: data?.semafori ?? {},
    scadenzario: data?.scadenzario ?? {},
    loading: isLoading,
    error,
  };
}

// ── useHaccpFascicolo ─────────────────────────────────────────
// Carica tutti i dati HACCP per una singola struttura
export function useHaccpFascicolo(facilityId) {
  const enabled = !!facilityId;

  const profiloQuery = useQuery({
    queryKey: ['haccp', 'profilo', facilityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('haccp_profili')
        .select('*')
        .eq('struttura_id', facilityId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled,
    staleTime: 2 * 60 * 1000,
  });

  const sciaQuery = useQuery({
    queryKey: ['haccp', 'scia', facilityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('haccp_scia')
        .select('*')
        .eq('struttura_id', facilityId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled,
    staleTime: 2 * 60 * 1000,
  });

  const manualiQuery = useQuery({
    queryKey: ['haccp', 'manuali', facilityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('haccp_manuali')
        .select('*')
        .eq('struttura_id', facilityId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled,
    staleTime: 2 * 60 * 1000,
  });

  const analisiQuery = useQuery({
    queryKey: ['haccp', 'analisi', facilityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('haccp_analisi')
        .select('*')
        .eq('struttura_id', facilityId)
        .order('data_campionamento', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled,
    staleTime: 2 * 60 * 1000,
  });

  const formazioneQuery = useQuery({
    queryKey: ['haccp', 'formazione', facilityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('haccp_formazione')
        .select('*')
        .eq('struttura_id', facilityId)
        .order('data_scadenza', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled,
    staleTime: 2 * 60 * 1000,
  });

  const scadenzarioQuery = useQuery({
    queryKey: ['haccp', 'scadenzario', facilityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('haccp_scadenzario')
        .select('*')
        .eq('struttura_id', facilityId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled,
    staleTime: 2 * 60 * 1000,
  });

  const isLoading = [
    profiloQuery, sciaQuery, manualiQuery,
    analisiQuery, formazioneQuery, scadenzarioQuery,
  ].some(q => q.isLoading);

  return {
    loading: isLoading,
    data: {
      profilo:     profiloQuery.data     ?? null,
      scia:        sciaQuery.data        ?? [],
      manuali:     manualiQuery.data     ?? [],
      analisi:     analisiQuery.data     ?? [],
      formazione:  formazioneQuery.data  ?? [],
      scadenzario: scadenzarioQuery.data ?? null,
    },
  };
}

// ── useHaccpInvalidate ────────────────────────────────────────

export function useHaccpInvalidate(facilityId) {
  const qc = useQueryClient();
  return {
    profilo:    () => qc.invalidateQueries({ queryKey: ['haccp', 'profilo',    facilityId] }),
    scia:       () => qc.invalidateQueries({ queryKey: ['haccp', 'scia',       facilityId] }),
    manuali:    () => qc.invalidateQueries({ queryKey: ['haccp', 'manuali',    facilityId] }),
    analisi:    () => qc.invalidateQueries({ queryKey: ['haccp', 'analisi',    facilityId] }),
    formazione: () => qc.invalidateQueries({ queryKey: ['haccp', 'formazione', facilityId] }),
    semafori:   () => qc.invalidateQueries({ queryKey: ['haccp', 'semafori']               }),
    all:        () => qc.invalidateQueries({ queryKey: ['haccp']                            }),
  };
}
