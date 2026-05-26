/**
 * src/hooks/useDirectorData.js
 * ─────────────────────────────────────────────────────────────
 * Hook dedicato per le viste director (DirectorApp, DirectorFacility).
 *
 * PERCHÉ ESISTE:
 *  useDashboardData carica TUTTE le strutture e tutti i dati.
 *  Per un direttore con 1-3 strutture questo è uno spreco:
 *  – N strutture non sue scaricate e scartate lato client
 *  – kpiRecords e surveys di tutte le strutture del gruppo
 *
 * QUESTA SOLUZIONE:
 *  Filtra le query Supabase con .in('facility_id', ids) in modo
 *  che il DB restituisca solo i dati delle strutture assegnate.
 *  RLS garantisce comunque che l'utente non veda altro.
 *
 * USO:
 *   const { data, loading } = useDirectorData(profile.accessibleFacilityIds, year);
 *
 * FALLBACK SICURO:
 *  Se facilityIds è vuoto o undefined, l'hook ritorna dati vuoti
 *  senza fare chiamate al DB.
 * ─────────────────────────────────────────────────────────────
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabaseClient';

// Chiavi query distinte da quelle di useDashboardData per non inquinare la cache HQ
const directorKeys = {
  facilities: (ids)        => ['director', 'facilities', ids],
  surveys:    (ids, year)  => ['director', 'surveys', ids, year],
  kpiRecords: (ids, year)  => ['director', 'kpiRecords', ids, year],
  udos:       ()           => ['udos'], // condiviso — stessa cache dell'admin
};

/**
 * @param {number[]} facilityIds - Array di id strutture accessibili
 * @param {number}   year
 */
export function useDirectorData(facilityIds, year) {
  const ids = facilityIds ?? [];
  const enabled = ids.length > 0;

  const facilitiesQuery = useQuery({
    queryKey: directorKeys.facilities(ids),
    queryFn:  async () => {
      const { data, error } = await supabase
        .from('facilities')
        .select('*')
        .in('id', ids)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled,
    staleTime: 2 * 60 * 1000,
  });

  const surveysQuery = useQuery({
    queryKey: directorKeys.surveys(ids, year),
    queryFn:  async () => {
      const { data, error } = await supabase
        .from('v_survey_data_normalized')
        .select('*')
        .in('facility_id', ids)
        .like('calendar_id', `${year}-%`);
      if (error) throw error;
      return data;
    },
    enabled,
    staleTime: 60 * 1000,
  });

  const kpiQuery = useQuery({
    queryKey: directorKeys.kpiRecords(ids, year),
    queryFn:  async () => {
      const { data, error } = await supabase
        .from('fact_kpi_monthly')
        .select('*')
        .in('facility_id', ids)
        .in('year', [year, year - 1]);
      if (error) throw error;
      return data;
    },
    enabled,
    staleTime: 60 * 1000,
  });

  // UDO condivisi — stessa logica di useDashboardData
  const udosQuery = useQuery({
    queryKey: ['udos'],
    queryFn:  async () => {
      const { data, error } = await supabase.from('udos').select('*').order('name');
      if (error) throw error;
      return data;
    },
    staleTime: 10 * 60 * 1000,
  });

  const isLoading = [facilitiesQuery, surveysQuery, kpiQuery, udosQuery]
    .some(q => q.isLoading);

  const errors = [facilitiesQuery, surveysQuery, kpiQuery, udosQuery]
    .filter(q => q.error)
    .map(q => q.error.message);

  return {
    loading: isLoading,
    errors,
    data: {
      facilities: facilitiesQuery.data ?? [],
      surveys:    surveysQuery.data    ?? [],
      kpiRecords: kpiQuery.data        ?? [],
      udos:       udosQuery.data       ?? [],
    },
  };
}

/** Invalidazione selettiva per le operazioni CRUD del direttore */
export function useDirectorInvalidate(facilityIds, year) {
  const queryClient = useQueryClient();
  const ids = facilityIds ?? [];
  return {
    surveys:    () => queryClient.invalidateQueries({ queryKey: directorKeys.surveys(ids, year) }),
    kpiRecords: () => queryClient.invalidateQueries({ queryKey: directorKeys.kpiRecords(ids, year) }),
    facilities: () => queryClient.invalidateQueries({ queryKey: directorKeys.facilities(ids) }),
  };
}
