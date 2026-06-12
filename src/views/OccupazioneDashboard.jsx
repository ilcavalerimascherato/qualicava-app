// src/views/OccupazioneDashboard.jsx
// Vista Saturazione — griglia raggi X con saturazione % vs budget per struttura

import { useState, useMemo } from 'react';
import { Users, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCdgData, aggregateCdgRecords, calcCdgSummary } from '../hooks/useCdgData';
import { useDashboardData } from '../hooks/useDashboardData';
import CdgStrutturaCard from '../components/CdgStrutturaCard';

function cdgSemaforo(summary) {
  if (!summary || summary.deltaVsBudget == null) return 'grigio';
  if (summary.deltaVsBudget >= -2) return 'verde';
  if (summary.deltaVsBudget >= -5) return 'giallo';
  return 'rosso';
}

// ── Vista principale ──────────────────────────────────────────────────────────
export default function OccupazioneDashboard() {
  const navigate = useNavigate();
  const year = new Date().getFullYear();
  const [filtroSemaforo, setFiltroSemaforo] = useState(null);
  const [search, setSearch]                 = useState('');

  const { data: dashData, loading } = useDashboardData(year);
  const { data: cdgData }           = useCdgData(null, year);

  const facilitiesConSemaforo = useMemo(() => {
    const facilities = dashData?.facilities ?? [];
    return facilities.map(f => {
      const records    = cdgData?.cdgByFacility?.[f.id] ?? [];
      const aggregated = aggregateCdgRecords(records);
      const summary    = calcCdgSummary(aggregated, f.bed_count || 0);
      return { ...f, _semaforo: cdgSemaforo(summary), _cdgRecords: records };
    });
  }, [dashData, cdgData]);

  const counts = useMemo(() => {
    const c = { verde: 0, giallo: 0, rosso: 0, grigio: 0 };
    facilitiesConSemaforo.forEach(f => c[f._semaforo]++);
    return c;
  }, [facilitiesConSemaforo]);

  const filtered = useMemo(() => {
    return facilitiesConSemaforo.filter(f => {
      if (filtroSemaforo && f._semaforo !== filtroSemaforo) return false;
      if (search && !f.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [facilitiesConSemaforo, filtroSemaforo, search]);

  const FILTRI = [
    { key: 'verde',  label: 'In target',    dot: 'bg-green-500'  },
    { key: 'giallo', label: 'Attenzione',   dot: 'bg-yellow-400' },
    { key: 'rosso',  label: 'Sotto budget', dot: 'bg-red-500'    },
    { key: 'grigio', label: 'Senza dati',   dot: 'bg-gray-300'   },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/admin')}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors mr-2"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Users size={16} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-gray-800">Saturazione</h1>
              <p className="text-xs text-gray-400">
                % posti letto occupati vs budget — mese precedente chiuso
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {FILTRI.map(f => (
              <button
                key={f.key}
                onClick={() => setFiltroSemaforo(filtroSemaforo === f.key ? null : f.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                  border transition-all ${filtroSemaforo === f.key
                    ? 'bg-gray-800 text-white border-gray-800'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}
              >
                <span className={`w-2 h-2 rounded-full ${f.dot}`} />
                {f.label} <span className="font-bold ml-1">{counts[f.key]}</span>
              </button>
            ))}
            <input
              type="text"
              placeholder="Cerca struttura…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="px-3 py-1.5 text-xs border border-gray-200 rounded-full
                         focus:outline-none focus:border-blue-400 w-40"
            />
          </div>
        </div>
      </div>

      {/* Griglia */}
      <div className="px-6 py-6">
        {loading ? (
          <p className="text-sm text-gray-400 text-center py-12">Caricamento…</p>
        ) : (
          <>
            <p className="text-xs text-gray-400 mb-4">
              {filtered.length} strutture
              {filtroSemaforo ? ` · ${filtroSemaforo}` : ''}
              {search ? ` · "${search}"` : ''}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
              {filtered.map(f => (
                <CdgStrutturaCard
                  key={f.id}
                  facility={f}
                  cdgRecords={f._cdgRecords}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
