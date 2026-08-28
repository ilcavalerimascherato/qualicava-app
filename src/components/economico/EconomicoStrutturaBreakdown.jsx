// src/components/economico/EconomicoStrutturaBreakdown.jsx
// Dettaglio per singola struttura di una società (economico_mensile_struttura),
// oggi disponibile solo per Over Care srl. Non mostra nulla se la società non
// ha dettaglio per struttura (nessun coverage flag: se la query torna vuota,
// il componente non si renderizza — il chiamante non deve indovinare quali
// società hanno il breakdown).
import { useEconomicoStruttura } from '../../hooks/useEconomicoStruttura';

function fmtEuro(n) {
  if (n === null || n === undefined) return '—';
  const neg = n < 0;
  return (neg ? '-' : '') + Math.round(Math.abs(n)).toLocaleString('it-IT') + ' €';
}
function fmtPct(n) {
  if (n === null || n === undefined) return '—';
  return n.toFixed(1).replace('.', ',') + '%';
}

export default function EconomicoStrutturaBreakdown({ companyId, year }) {
  const { data: rows, isLoading } = useEconomicoStruttura(companyId, year);

  if (isLoading || !rows || rows.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Dettaglio per struttura — ultimo mese disponibile
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-gray-400 uppercase tracking-wide">
              <th className="py-1.5 pr-3 font-medium">Struttura</th>
              <th className="py-1.5 pr-3 font-medium text-right">Ricavi</th>
              <th className="py-1.5 pr-3 font-medium text-right">EBITDA</th>
              <th className="py-1.5 font-medium text-right">Occ. %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map(f => {
              const ricaviA = f.lastActual.ricavi_totali, ricaviB = f.budgetSameMonth?.ricavi_totali;
              const ebitdaA = f.lastActual.ebitda;
              const sottoBudget = ricaviB != null && ricaviA < ricaviB;
              return (
                <tr key={f.facilityId}>
                  <td className="py-1.5 pr-3 text-gray-700 font-medium">{f.facilityName}</td>
                  <td className={`py-1.5 pr-3 text-right ${sottoBudget ? 'text-red-500' : 'text-gray-700'}`}>{fmtEuro(ricaviA)}</td>
                  <td className={`py-1.5 pr-3 text-right ${ebitdaA < 0 ? 'text-red-500' : 'text-gray-700'}`}>{fmtEuro(ebitdaA)}</td>
                  <td className="py-1.5 text-right text-gray-700">{fmtPct(f.lastActual.occupazione_media_pct)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
