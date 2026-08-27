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
  nonConformities:   (year)      => ['nonConformities', year],
  campaignsClient:   ()          => ['campaignsClient'],
  campaignsOperator: ()          => ['campaignsOperator'],
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
    // Copre anche l'anno precedente: la regola "ultimi 12 mesi" di
    // getSurveyStatus può ricadere su campagne dell'anno solare prima.
    const { data, error } = await supabase
      .from('v_survey_data_normalized')
      .select('*')
      .gte('calendar_id', `${year - 1}-01`)
      .lte('calendar_id', `${year}-12`);
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
  nonConformities: async (year) => {
    const { data, error } = await supabase
      .from('non_conformities')
      .select('*')
      .in('year', [year, year - 1]);
    if (error) throw error;
    return data;
  },
  // Campagne survey ospiti con punteggi già aggregati (avg_scores.nps_consiglio)
  // — usato dal Cruscotto per l'NPS medio di gruppo.
  campaignsClient: async () => {
    const { data, error } = await supabase
      .from('v_survey_campagne')
      .select('campagna_id, facility_id, company_id, survey_type, data_inizio, data_fine, n_risposte, avg_scores')
      .eq('survey_type', 'client')
      .not('facility_id', 'is', null);
    if (error) throw error;
    return data;
  },
  // Campagne survey operatori — usato dal confronto ospiti vs operatori (Fase 3).
  campaignsOperator: async () => {
    const { data, error } = await supabase
      .from('v_survey_campagne')
      .select('campagna_id, facility_id, company_id, survey_type, data_inizio, data_fine, n_risposte, avg_scores')
      .eq('survey_type', 'operator')
      .not('facility_id', 'is', null);
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

  const ncQuery = useQuery({
    queryKey: queryKeys.nonConformities(year),
    queryFn: () => fetchers.nonConformities(year),
    staleTime: 60 * 1000,
  });

  const campaignsClientQuery = useQuery({
    queryKey: queryKeys.campaignsClient(),
    queryFn: fetchers.campaignsClient,
    staleTime: 2 * 60 * 1000,
  });

  const campaignsOperatorQuery = useQuery({
    queryKey: queryKeys.campaignsOperator(),
    queryFn: fetchers.campaignsOperator,
    staleTime: 2 * 60 * 1000,
  });

  // Loading globale: true solo al primo caricamento (non ai refetch silenziosi)
  const isLoading = [
    udosQuery, companiesQuery, facilitiesQuery,
    surveysQuery, kpiQuery, ncQuery, campaignsClientQuery, campaignsOperatorQuery
  ].some(q => q.isLoading);

  // Errore globale: raccoglie tutti gli errori in un array
  const errors = [
    udosQuery, companiesQuery, facilitiesQuery,
    surveysQuery, kpiQuery, ncQuery, campaignsClientQuery, campaignsOperatorQuery
  ].filter(q => q.error).map(q => q.error.message);

  return {
    loading: isLoading,
    errors,
    data: {
      udos:              udosQuery.data           || [],
      companies:         companiesQuery.data      || [],
      facilities:        facilitiesQuery.data     || [],
      surveys:           surveysQuery.data        || [],
      kpiRecords:        kpiQuery.data            || [],
      nonConformities:   ncQuery.data              || [],
      campaignsClient:   campaignsClientQuery.data   || [],
      campaignsOperator: campaignsOperatorQuery.data || [],
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
    nonConformities:  (year) => queryClient.invalidateQueries({ queryKey: queryKeys.nonConformities(year) }),
  };
}
