// src/hooks/useSurveyDuplicati.js
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabaseClient';

export function useSurveyDuplicati() {
  return useQuery({
    queryKey: ['survey_duplicati_dettaglio'],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_survey_duplicati_dettaglio')
        .select('*');
      if (error) throw error;
      return data ?? [];
    },
  });
}
