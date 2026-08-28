// src/components/economico/EconomicoView.jsx
// Sezione /report dedicata all'economico per sede/board/admin/superadmin
// (permesso 'viewReportSections', gate applicato dal chiamante ReportPage).
// A differenza del riepilogo compresso in KPI & Economics (un solo mese,
// tutte le società affiancate — pensato per lo sguardo d'insieme da board),
// qui si sceglie una società e si vede il trend Actual vs Budget su tutto
// l'anno, mese per mese, più il dettaglio per struttura dove disponibile
// (oggi solo Over Care srl).
import { useEffect, useState } from 'react';
import { Wallet } from 'lucide-react';
import { useEconomicoCoverage } from '../../hooks/useEconomicoCoverage';
import EconomicoGruppoPanel from '../kpieconomics/EconomicoGruppoPanel';
import EconomicoTab from '../EconomicoTab';
import EconomicoStrutturaBreakdown from './EconomicoStrutturaBreakdown';

export default function EconomicoView({ year }) {
  const { data: coverage, isLoading } = useEconomicoCoverage(year);
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);

  useEffect(() => {
    if (!selectedCompanyId && coverage && coverage.length > 0) {
      setSelectedCompanyId(coverage[0].companyId);
    }
  }, [coverage, selectedCompanyId]);

  return (
    <div className="space-y-5">
      <EconomicoGruppoPanel year={year} />

      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Wallet size={16} className="text-gray-400" />
            <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Dettaglio per società — trend annuale</h3>
          </div>
        </div>

        {isLoading ? (
          <p className="text-sm text-gray-400 italic py-2">Caricamento…</p>
        ) : !coverage || coverage.length === 0 ? (
          <p className="text-xs text-gray-400 leading-relaxed">
            Nessuna società ha ancora una chiusura mensile caricata in QualiCAVA.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 mb-4">
              {coverage.map(c => (
                <button
                  key={c.companyId}
                  onClick={() => setSelectedCompanyId(c.companyId)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    selectedCompanyId === c.companyId
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {c.companyName}
                </button>
              ))}
            </div>

            {selectedCompanyId && (
              <div className="space-y-4">
                <EconomicoTab companyId={selectedCompanyId} year={year} />
                <EconomicoStrutturaBreakdown companyId={selectedCompanyId} year={year} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
