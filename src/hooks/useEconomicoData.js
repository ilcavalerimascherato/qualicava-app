// src/hooks/useEconomicoData.js
// Dati economico_mensile per una società (company_id). RLS (gruppo
// 'financial_read') la consente a superadmin/sede/admin/board/director; tra
// i ruoli struttura SOLO director può leggerla — il chiamante deve evitare
// di montare questo hook per gli altri 3 ruoli, per non fare query inutili
// che torneranno vuote. Usato sia da EconomicoTab (dash director e sessione
// /report "Economico") che indirettamente da EconomicoView.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabaseClient';

export function useEconomicoData(companyId, year) {
  return useQuery({
    queryKey: ['economicoData', companyId, year],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('economico_mensile')
        .select('*, companies(name)')
        .eq('company_id', companyId)
        .eq('anno', year)
        .order('mese');
      if (error) throw error;
      const rows = data || [];
      return {
        actual: rows.filter(r => r.scenario === 'actual').sort((a, b) => a.mese - b.mese),
        budget: rows.filter(r => r.scenario === 'budget').sort((a, b) => a.mese - b.mese),
        companyName: rows[0]?.companies?.name ?? null,
      };
    },
    enabled: !!companyId,
  });
}
