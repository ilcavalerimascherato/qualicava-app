// src/hooks/useChiusuraMensile.js
// Chiusura mensile P&L (chiusura_mensile_struttura) per una singola
// struttura — usata dal tab "Economico" della dash Direttore. Stesso shape
// di useEconomicoData.js (che questo hook sostituisce): split actual/budget
// ordinati per mese, per anno corrente e precedente (serve per "vs 2025").
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabaseClient';

export function useChiusuraMensile(facilityId, year) {
  return useQuery({
    queryKey: ['chiusuraMensile', facilityId, year],
    staleTime: 5 * 60 * 1000,
    enabled: !!facilityId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chiusura_mensile_struttura')
        .select('*')
        .eq('facility_id', facilityId)
        .in('anno', [year - 1, year])
        .order('mese');
      if (error) throw error;
      const rows = data || [];
      return {
        actual: rows.filter(r => r.scenario === 'actual' && r.anno === year).sort((a, b) => a.mese - b.mese),
        actualPrevYear: rows.filter(r => r.scenario === 'actual' && r.anno === year - 1).sort((a, b) => a.mese - b.mese),
        budget: rows.filter(r => r.scenario === 'budget' && r.anno === year).sort((a, b) => a.mese - b.mese),
      };
    },
  });
}
