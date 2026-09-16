/**
 * src/hooks/useCartaServiziData.js
 * ─────────────────────────────────────────────────────────────
 * Hook per i dati del generatore Carta dei Servizi, sullo stesso
 * schema di useHaccpData.js.
 * ─────────────────────────────────────────────────────────────
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getProfilo, getGestoreContenuti, getGenerati } from '../services/cartaServiziService';

// Carica profilo struttura + contenuti gestore + storico generazioni
export function useCartaServiziFascicolo(facilityId, companyId) {
  const enabled = !!facilityId;

  const profiloQuery = useQuery({
    queryKey: ['carta_servizi', 'profilo', facilityId],
    queryFn: () => getProfilo(facilityId),
    enabled,
    staleTime: 2 * 60 * 1000,
  });

  const gestoreQuery = useQuery({
    queryKey: ['carta_servizi', 'gestore', companyId],
    queryFn: () => getGestoreContenuti(companyId),
    enabled: !!companyId,
    staleTime: 2 * 60 * 1000,
  });

  const generatiQuery = useQuery({
    queryKey: ['carta_servizi', 'generati', facilityId],
    queryFn: () => getGenerati(facilityId),
    enabled,
    staleTime: 2 * 60 * 1000,
  });

  const isLoading = [profiloQuery, gestoreQuery, generatiQuery].some(q => q.isLoading);

  return {
    loading: isLoading,
    data: {
      profilo:  profiloQuery.data  ?? null,
      gestore:  gestoreQuery.data  ?? null,
      generati: generatiQuery.data ?? [],
    },
  };
}

export function useCartaServiziInvalidate(facilityId, companyId) {
  const qc = useQueryClient();
  return {
    profilo:  () => qc.invalidateQueries({ queryKey: ['carta_servizi', 'profilo',  facilityId] }),
    gestore:  () => qc.invalidateQueries({ queryKey: ['carta_servizi', 'gestore',  companyId] }),
    generati: () => qc.invalidateQueries({ queryKey: ['carta_servizi', 'generati', facilityId] }),
    all:      () => qc.invalidateQueries({ queryKey: ['carta_servizi'] }),
  };
}
