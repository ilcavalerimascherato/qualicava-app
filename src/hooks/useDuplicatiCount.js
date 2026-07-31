// src/hooks/useDuplicatiCount.js
// Conta i gruppi (non le righe) di survey_duplicati ancora da verificare —
// usato come badge sulla SettingsCard "Verifica duplicati".
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabaseClient';

export function useDuplicatiCount() {
  const { data, isLoading } = useQuery({
    queryKey: ['survey_duplicati_count'],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('survey_duplicati')
        .select('gruppo_id')
        .eq('stato', 'da_verificare');
      if (error) throw error;
      return new Set((data ?? []).map(r => r.gruppo_id)).size;
    },
  });
  return { loading: isLoading, count: data ?? 0 };
}
