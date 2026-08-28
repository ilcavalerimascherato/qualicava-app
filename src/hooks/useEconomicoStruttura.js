// src/hooks/useEconomicoStruttura.js
// Dettaglio economico per singola struttura (economico_mensile_struttura),
// oggi popolato solo per le strutture di Over Care srl. Ritorna, per ogni
// struttura della società, l'ultimo mese actual disponibile + il budget
// dello stesso mese, per un confronto rapido tra strutture.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabaseClient';

export function useEconomicoStruttura(companyId, year) {
  return useQuery({
    queryKey: ['economicoStruttura', companyId, year],
    staleTime: 5 * 60 * 1000,
    enabled: !!companyId,
    queryFn: async () => {
      const { data: facilities, error: fErr } = await supabase
        .from('facilities')
        .select('id, name')
        .eq('company_id', companyId);
      if (fErr) throw fErr;
      const facilityIds = (facilities ?? []).map(f => f.id);
      if (facilityIds.length === 0) return [];

      const { data: rows, error } = await supabase
        .from('economico_mensile_struttura')
        .select('facility_id, mese, scenario, ricavi_totali, ebitda, occupazione_media_pct')
        .in('facility_id', facilityIds)
        .eq('anno', year);
      if (error) throw error;

      const byFacility = {};
      for (const r of rows ?? []) {
        if (!byFacility[r.facility_id]) byFacility[r.facility_id] = { actual: [], budget: [] };
        byFacility[r.facility_id][r.scenario === 'actual' ? 'actual' : 'budget'].push(r);
      }

      const nameById = Object.fromEntries((facilities ?? []).map(f => [f.id, f.name]));
      return Object.entries(byFacility).map(([facilityId, { actual, budget }]) => {
        const lastActual = actual.sort((a, b) => a.mese - b.mese).at(-1);
        const sameMonthBudget = budget.find(b => b.mese === lastActual?.mese);
        return {
          facilityId: Number(facilityId),
          facilityName: nameById[facilityId] ?? `#${facilityId}`,
          lastActual,
          budgetSameMonth: sameMonthBudget,
        };
      }).filter(f => f.lastActual).sort((a, b) => a.facilityName.localeCompare(b.facilityName));
    },
  });
}
