// src/hooks/useDashboardData.js
// Riscritto con React Query: cache intelligente, invalidazione selettiva per entità
// Prerequisito: <QueryClientProvider> in index.js
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabaseClient';

// ─── Query keys centralizzate ────────────────────────────────
// Usare questi oggetti garantisce coerenza nelle invalidazioni
export const queryKeys = {
  udos:              ()          => ['udos'],
  companies:         ()          => ['companies'],
  facilities:        ()          => ['facilities'],
  surveys:           (year)      => ['surveys', year],
  kpiRecords:        (year)      => ['kpiRecords', year],
};

// ─── Fetcher singoli ─────────────────────────────────────────
const fetchers = {
  udos: async () => {
    const { data, error } = await supabase.from('udos').select('*').order('name');
    if (error) throw error;
    return data;
  },
  companies: async () => {
    const { data, error } = await supabase.from('companies').select('*').order('name');
    if (error) throw error;
    return data;
  },
  facilities: async () => {
    const { data, error } = await supabase.from('facilities').select('*').order('name');
    if (error) throw error;
    return data;
  },
  surveys: async (year) => {
    const { data, error } = await supabase
      .from('v_survey_data_normalized')
      .select('*')
      .like('calendar_id', `${year}-%`);
    if (error) throw error;
    return data;
  },
  kpiRecords: async (year) => {
    const { data, error } = await supabase
      .from('fact_kpi_monthly')
      .select('*')
      .in('year', [year, year - 1]);
    if (error) throw error;
    return data;
  },
};

// ─── Hook principale ─────────────────────────────────────────
export function useDashboardData(year) {
  const udosQuery = useQuery({
    queryKey: queryKeys.udos(),
    queryFn: fetchers.udos,
    staleTime: 10 * 60 * 1000, // UDO cambiano raramente: cache 10 minuti
  });

  const companiesQuery = useQuery({
    queryKey: queryKeys.companies(),
    queryFn: fetchers.companies,
    staleTime: 10 * 60 * 1000,
  });

  const facilitiesQuery = useQuery({
    queryKey: queryKeys.facilities(),
    queryFn: fetchers.facilities,
    staleTime: 2 * 60 * 1000,
  });

  const surveysQuery = useQuery({
    queryKey: queryKeys.surveys(year),
    queryFn: () => fetchers.surveys(year),
    staleTime: 60 * 1000,
  });

  const kpiQuery = useQuery({
    queryKey: queryKeys.kpiRecords(year),
    queryFn: () => fetchers.kpiRecords(year),
    staleTime: 60 * 1000,
  });

  // Loading globale: true solo al primo caricamento (non ai refetch silenziosi)
  const isLoading = [
    udosQuery, companiesQuery, facilitiesQuery,
    surveysQuery, kpiQuery
  ].some(q => q.isLoading);

  // Errore globale: raccoglie tutti gli errori in un array
  const errors = [
    udosQuery, companiesQuery, facilitiesQuery,
    surveysQuery, kpiQuery
  ].filter(q => q.error).map(q => q.error.message);

  return {
    loading: isLoading,
    errors,
    data: {
      udos:            udosQuery.data         || [],
      companies:       companiesQuery.data    || [],
      facilities:      facilitiesQuery.data   || [],
      surveys:         surveysQuery.data      || [],
      kpiRecords:      kpiQuery.data          || [],
    },
  };
}

// ─── Hook per invalidazione selettiva ─────────────────────────
// Da usare nei componenti dopo operazioni CRUD invece di fetchAll()
export function useInvalidate() {
  const queryClient = useQueryClient();
  return {
    // Invalida solo le strutture (dopo save/delete facility)
    facilities:       ()     => queryClient.invalidateQueries({ queryKey: queryKeys.facilities() }),
    // Invalida solo i KPI di un dato anno
    kpiRecords:       (year) => queryClient.invalidateQueries({ queryKey: queryKeys.kpiRecords(year) }),
    // Invalida tutto (solo per operazioni che impattano dati multipli)
    all:              ()     => queryClient.invalidateQueries(),
    surveys:          (year) => queryClient.invalidateQueries({ queryKey: queryKeys.surveys(year) }),
    udos:             ()     => queryClient.invalidateQueries({ queryKey: queryKeys.udos() }),
  };
}
