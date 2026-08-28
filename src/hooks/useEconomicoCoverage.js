// src/hooks/useEconomicoCoverage.js
// Elenco delle società che hanno almeno una chiusura mensile caricata in
// economico_mensile per l'anno dato — usato per popolare selettori senza
// mostrare società che tornerebbero sempre vuote.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabaseClient';

export function useEconomicoCoverage(year) {
  return useQuery({
    queryKey: ['economicoCoverage', year],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('economico_mensile')
        .select('company_id, companies(name)')
        .eq('anno', year);
      if (error) throw error;
      const seen = new Map();
      for (const r of data ?? []) {
        if (!seen.has(r.company_id)) seen.set(r.company_id, r.companies?.name ?? `#${r.company_id}`);
      }
      return Array.from(seen, ([companyId, companyName]) => ({ companyId, companyName }))
        .sort((a, b) => a.companyName.localeCompare(b.companyName));
    },
  });
}
