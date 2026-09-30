// src/hooks/useChiusuraPortfolio.js
// Vista portfolio per il tab "Economico" di /report (Sede/Board): tutte le
// strutture con almeno una chiusura mensile importata per l'anno corrente,
// con Ricavi/EBITDA YTD (somma dei mesi actual) e l'occupazione media
// dell'ultimo mese disponibile. Nessun filtro per società — l'obiettivo è
// mettere insieme tutte le UDO, non guardarle una alla volta.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabaseClient';

export function useChiusuraPortfolio(year) {
  return useQuery({
    queryKey: ['chiusuraPortfolio', year],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chiusura_mensile_struttura')
        .select('*, facilities(name)')
        .eq('anno', year)
        .order('mese');
      if (error) throw error;
      const rows = data || [];

      const byFacility = {};
      for (const r of rows) {
        if (!byFacility[r.facility_id]) {
          byFacility[r.facility_id] = { facilityId: r.facility_id, facilityName: r.facilities?.name ?? `#${r.facility_id}`, actual: [], budget: [] };
        }
        byFacility[r.facility_id][r.scenario === 'actual' ? 'actual' : 'budget'].push(r);
      }

      const sum = (list, key) => list.reduce((s, r) => s + (r[key] ?? 0), 0);

      return Object.values(byFacility)
        .filter(f => f.actual.length > 0)
        .map(f => {
          const lastActual = f.actual.slice().sort((a, b) => a.mese - b.mese).at(-1);
          const sameMonthBudget = f.budget.find(b => b.mese === lastActual?.mese);
          return {
            facilityId: f.facilityId,
            facilityName: f.facilityName,
            ricaviYtd: sum(f.actual, 'ricavi'),
            ebitdaYtd: sum(f.actual, 'ebitda'),
            ebitdaBudgetYtd: sum(f.budget.filter(b => b.mese <= (lastActual?.mese ?? 0)), 'ebitda'),
            occupazioneMedia: lastActual && lastActual.totale_giornate
              ? (lastActual.giornate_occupate ?? 0) / lastActual.totale_giornate
              : null,
            ultimoMese: lastActual?.mese ?? null,
            budgetEbitdaUltimoMese: sameMonthBudget?.ebitda ?? null,
          };
        })
        .sort((a, b) => b.ebitdaYtd - a.ebitdaYtd);
    },
  });
}
