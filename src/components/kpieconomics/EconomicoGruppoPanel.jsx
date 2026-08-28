// src/components/kpieconomics/EconomicoGruppoPanel.jsx
// Confronto Actual vs Budget per società — copertura parziale (solo le
// società con una chiusura mensile caricata in economico_mensile). Le altre
// non compaiono: nessun modo di distinguere "a zero" da "non tracciata" senza
// un elenco esplicito di coperture, quindi si mostra solo ciò che c'è.
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Wallet } from 'lucide-react';
import { supabase } from '../../supabaseClient';

function fmtEuro(n) {
  if (n === null || n === undefined) return '—';
  const neg = n < 0;
  return (neg ? '-' : '') + Math.round(Math.abs(n)).toLocaleString('it-IT') + ' €';
}
function fmtPct(n) {
  if (n === null || n === undefined) return '—';
  return n.toFixed(1).replace('.', ',') + '%';
}

function useEconomicoGruppo(year) {
  return useQuery({
    queryKey: ['economicoGruppoPanel', year],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('economico_mensile')
        .select('company_id, mese, scenario, ricavi_totali, ebitda, occupazione_media_pct, companies(name)')
        .eq('anno', year);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export default function EconomicoGruppoPanel({ year }) {
  const { data: rows, isLoading } = useEconomicoGruppo(year);

  const byCompany = useMemo(() => {
    if (!rows) return [];
    const map = {};
    for (const r of rows) {
      if (!map[r.company_id]) map[r.company_id] = { companyId: r.company_id, name: r.companies?.name ?? `#${r.company_id}`, actual: [], budget: [] };
      map[r.company_id][r.scenario === 'actual' ? 'actual' : 'budget'].push(r);
    }
    return Object.values(map).map(c => {
      const lastActual = c.actual.sort((a, b) => a.mese - b.mese).at(-1);
      const budgetSameMonth = c.budget.find(b => b.mese === lastActual?.mese);
      return { ...c, lastActual, budgetSameMonth };
    }).filter(c => c.lastActual).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Wallet size={16} className="text-gray-400" />
          <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Economico — Actual vs Budget</h3>
        </div>
        <span className="text-[11px] text-gray-400">{byCompany.length} società coperte · fonte: chiusure mensili</span>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400 italic py-2">Caricamento…</p>
      ) : byCompany.length === 0 ? (
        <p className="text-xs text-gray-400 leading-relaxed">
          Nessuna società ha ancora una chiusura mensile caricata in QualiCAVA.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {byCompany.map(c => {
            const ricaviA = c.lastActual.ricavi_totali, ricaviB = c.budgetSameMonth?.ricavi_totali;
            const ebitdaA = c.lastActual.ebitda;
            const margine = ricaviA ? (ebitdaA / ricaviA * 100) : null;
            const sottoBudget = ricaviB != null && ricaviA < ricaviB;
            return (
              <div key={c.companyId} className="rounded-xl border border-gray-200 p-3 flex flex-col gap-1.5">
                <p className="text-xs font-semibold text-gray-700 truncate" title={c.name}>{c.name}</p>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Mese {c.lastActual.mese}/{year}</p>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-[11px] text-gray-400">Ricavi</span>
                  <span className={`text-sm font-bold ${sottoBudget ? 'text-red-500' : 'text-gray-800'}`}>{fmtEuro(ricaviA)}</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-[11px] text-gray-400">EBITDA</span>
                  <span className={`text-sm font-bold ${ebitdaA < 0 ? 'text-red-500' : 'text-green-600'}`}>{fmtEuro(ebitdaA)}</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-[11px] text-gray-400">Margine</span>
                  <span className={`text-xs font-semibold ${margine != null && margine < 0 ? 'text-red-500' : 'text-gray-600'}`}>{fmtPct(margine)}</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-[11px] text-gray-400">Occupazione</span>
                  <span className="text-xs font-semibold text-gray-600">{fmtPct(c.lastActual.occupazione_media_pct)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
