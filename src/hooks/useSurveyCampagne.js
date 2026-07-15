import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabaseClient';

export function useSurveyCampagne(facilityId, companyId) {
  return useQuery({
    queryKey: ['survey_campagne', facilityId, companyId],
    enabled: !!facilityId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      // Campagne per struttura
      const { data: facilityData, error: e1 } = await supabase
        .from('v_survey_campagne')
        .select('*')
        .eq('facility_id', facilityId)
        .order('data_inizio', { ascending: false });
      if (e1) throw e1;

      // Campagne aziendali (company_id, facility_id null)
      let companyData = [];
      if (companyId) {
        const { data, error: e2 } = await supabase
          .from('v_survey_campagne')
          .select('*')
          .eq('company_id', companyId)
          .is('facility_id', null)
          .order('data_inizio', { ascending: false });
        if (e2) throw e2;
        // Etichetta come aziendale
        companyData = (data ?? []).map(c => ({
          ...c,
          campagna_nome: `${c.campagna_nome} · aziendale`,
          is_company_wide: true,
        }));
      }

      return [...(facilityData ?? []), ...companyData];
    },
  });
}

export function useAllSurveyCampagne() {
  return useQuery({
    queryKey: ['survey_campagne_all'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('survey_campagne')
        .select('*')
        .order('data_inizio', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}
