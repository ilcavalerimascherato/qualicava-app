/**
 * src/views/MasterDashboard.jsx
 * ─────────────────────────────────────────────────────────────
 * Vista MASTER HACCP — accessibile solo ad admin/superadmin/sede.
 * Mostra tutte le strutture raggruppate per regione con semaforo HACCP.
 * Cliccando su una card si apre HaccpFascicoloModal.
 *
 * Props ricevute da route: nessuna (tutto da hook)
 * Query string: ?facility=ID → apre direttamente il fascicolo di quella struttura
 * ─────────────────────────────────────────────────────────────
 */
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChefHat, ArrowLeft, Search, Filter } from 'lucide-react';
import { useDashboardData } from '../hooks/useDashboardData';
import { useHaccpSemafori } from '../hooks/useHaccpData';
import HaccpFascicoloModal  from '../components/HaccpFascicoloModal';

export default function MasterDashboard() {
  const navigate        = useNavigate();
  const [searchParams]  = useSearchParams();
  const facilityIdParam = searchParams.get('facility');

  const year = new Date().getFullYear();
  const { data, loading } = useDashboardData(year);
  const { semafori, scadenzario, loading: loadingSem } = useHaccpSemafori();

  const [search,           setSearch]           = useState('');
  const [filterSemaforo,   setFilterSemaforo]   = useState('all');
  const [filterRegione,    setFilterRegione]    = useState('all');
  const [filterUdo,        setFilterUdo]        = useState('all');
  const [selectedFacility, setSelectedFacility] = useState(null);

  // Apri automaticamente il fascicolo se arriva da ?facility=ID
  useEffect(() => {
    if (facilityIdParam && data.facilities.length > 0) {
      const f = data.facilities.find(x => String(x.id) === facilityIdParam);
      if (f) setSelectedFacility(f);
    }
  }, [facilityIdParam, data.facilities]);

  // Arricchisce facilities con semaforo HACCP
  const enriched = useMemo(() => {
    return data.facilities.map(f => {
      const sc = scadenzario?.[f.id];
      return {
        ...f,
        haccp_semaforo:   semafori[f.id] ?? (f.haccp_obbligatorio ? 'grigio' : null),
        manuale_presente: sc ? !!sc.manuale_scadenza : false,
      };
    });
  }, [data.facilities, semafori, scadenzario]);

  // Regioni disponibili per filtro
  const regioni = useMemo(() => {
    const set = new Set(enriched.filter(f => f.region).map(f => f.region));
    return Array.from(set).sort();
  }, [enriched]);

  // UDO disponibili per filtro
  const udoNames = useMemo(() => {
    const set = new Set(enriched.map(f => f.udo_name).filter(Boolean));
    return Array.from(set).sort();
  }, [enriched]);

  // Filtro strutture
  const filtered = useMemo(() => {
    return enriched.filter(f => {
      if (f.is_suspended) return false;
      if (search && !f.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterRegione !== 'all' && f.region !== filterRegione) return false;
      if (filterUdo !== 'all' && f.udo_name !== filterUdo) return false;
      if (filterSemaforo === 'haccp_only' && !f.haccp_obbligatorio) return false;
      if (filterSemaforo !== 'all' && filterSemaforo !== 'haccp_only') {
        if (f.haccp_semaforo !== filterSemaforo) return false;
      }
      return true;
    });
  }, [enriched, search, filterRegione, filterUdo, filterSemaforo]);

  // Raggruppamento per regione
  const byRegione = useMemo(() => {
    const map = {};
    for (const f of filtered) {
      const key = f.region || 'Altre';
      if (!map[key]) map[key] = [];
      map[key].push(f);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  // Contatori semaforo
  const counts = useMemo(() => {
    const haccpOnly = enriched.filter(f => f.haccp_obbligatorio && !f.is_suspended);
    return {
      totale: haccpOnly.length,
      verde:  haccpOnly.filter(f => f.haccp_semaforo === 'verde').length,
      giallo: haccpOnly.filter(f => f.haccp_semaforo === 'giallo').length,
      rosso:  haccpOnly.filter(f => f.haccp_semaforo === 'rosso').length,
      grigio: haccpOnly.filter(f => f.haccp_semaforo === 'grigio' || !f.haccp_semaforo).length,
    };
  }, [enriched]);

  const isLoading = loading || loadingSem;

  return (
    <div className="min-h-screen bg-slate-100 pb-16 font-sans">

      {/* ── Header ── */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-30 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/admin')}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              title="Torna alla dashboard"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex items-center gap-3">
              <div className="bg-amber-500 p-2.5 rounded-xl text-white shadow">
                <ChefHat size={22} />
              </div>
              <div>
                <h1 className="text-lg font-black tracking-tight text-slate-900">
                  HACCP <span className="text-amber-500">GRUPPO OVER</span>
                </h1>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                  Gestione sicurezza alimentare · {counts.totale} strutture soggette
                </p>
              </div>
            </div>
          </div>

          {/* Badge semaforo cliccabili */}
          <div className="flex items-center gap-3">
            {[
              { key: 'verde',  label: 'In regola',   count: counts.verde,  cls: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
              { key: 'giallo', label: 'Attenzione',  count: counts.giallo, cls: 'bg-amber-50 border-amber-200 text-amber-700'       },
              { key: 'rosso',  label: 'Critici',     count: counts.rosso,  cls: 'bg-red-50 border-red-200 text-red-700'             },
              { key: 'grigio', label: 'Non censiti', count: counts.grigio, cls: 'bg-slate-100 border-slate-200 text-slate-500'      },
            ].map(({ key, label, count, cls }) => (
              <button
                key={key}
                onClick={() => setFilterSemaforo(prev => prev === key ? 'all' : key)}
                className={`flex flex-col items-center px-4 py-2 rounded-xl border font-black transition-all ${cls} ${filterSemaforo === key ? 'ring-2 ring-offset-1 ring-current' : 'opacity-80 hover:opacity-100'}`}
              >
                <span className="text-2xl">{count}</span>
                <span className="text-[10px] uppercase tracking-widest font-bold">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Filtri */}
        <div className="flex items-center gap-3 mt-4">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Cerca struttura..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-sm outline-none focus:border-amber-400"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-slate-400" />
            <select
              value={filterRegione}
              onChange={e => setFilterRegione(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-amber-400"
            >
              <option value="all">Tutte le regioni</option>
              {regioni.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <select
              value={filterUdo}
              onChange={e => setFilterUdo(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-amber-400"
            >
              <option value="all">Tutte le UDO</option>
              {udoNames.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            <select
              value={filterSemaforo}
              onChange={e => setFilterSemaforo(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-amber-400"
            >
              <option value="all">Tutti gli stati</option>
              <option value="haccp_only">Solo HACCP</option>
              <option value="verde">🟢 In regola</option>
              <option value="giallo">🟡 Attenzione</option>
              <option value="rosso">🔴 Critici</option>
              <option value="grigio">⚪ Non censiti</option>
            </select>
          </div>
          <span className="text-xs font-bold text-slate-400 ml-auto">
            {filtered.length} strutture
          </span>
        </div>
      </header>

      {/* ── Contenuto ── */}
      <main className="p-4 space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-32 text-slate-400 font-black uppercase tracking-widest animate-pulse">
            Caricamento strutture HACCP...
          </div>
        ) : byRegione.length === 0 ? (
          <div className="text-center py-20 text-slate-400 font-bold">
            Nessuna struttura trovata
          </div>
        ) : (
          byRegione.map(([regione, strutture]) => (
            <div key={regione}>
              {/* Separatore regione */}
              <div className="flex items-center gap-2 mb-3">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-2">
                  {regione} · {strutture.length} strutture
                </span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>
              {/* Griglia strutture */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {strutture.map(f => (
                  <HaccpCard
                    key={f.id}
                    f={f}
                    udos={data.udos}
                    onClick={() => setSelectedFacility(f)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </main>

      {/* ── Modale fascicolo HACCP ── */}
      {selectedFacility && (
        <HaccpFascicoloModal
          facility={selectedFacility}
          onClose={() => setSelectedFacility(null)}
        />
      )}
    </div>
  );
}

// ── HaccpCard ─────────────────────────────────────────────────
function HaccpCard({ f, udos, onClick }) {
  const udoName  = udos?.find(u => u.id === f.udo_id)?.name || f.udo_name || '';
  const udoColor = f.udo_color || '#6366f1';

  const semaforoConfig = {
    verde:  { dot: 'bg-green-500',  bg: 'bg-green-50',  border: 'border-green-200',  label: 'Conforme',   text: 'text-green-700'  },
    giallo: { dot: 'bg-yellow-400', bg: 'bg-yellow-50', border: 'border-yellow-200', label: 'Attenzione', text: 'text-yellow-700' },
    rosso:  { dot: 'bg-red-500',    bg: 'bg-red-50',    border: 'border-red-200',    label: 'Critico',    text: 'text-red-700'    },
    grigio: { dot: 'bg-gray-300',   bg: 'bg-gray-50',   border: 'border-gray-200',   label: 'Non attivo', text: 'text-gray-400'   },
  };
  const s = semaforoConfig[f.haccp_semaforo] || semaforoConfig.grigio;

  return (
    <div
      onClick={f.haccp_obbligatorio ? onClick : undefined}
      className={`relative rounded-xl border ${s.border} ${s.bg}
                  p-3 flex flex-col gap-2 transition-all
                  ${f.haccp_obbligatorio
                    ? 'cursor-pointer hover:shadow-md hover:border-opacity-80'
                    : 'opacity-60 cursor-default'}`}
    >
      {/* Striscia colore UDO */}
      <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-xl"
           style={{ background: udoColor }} />

      {/* UDO + semaforo dot */}
      <div className="flex items-center justify-between mt-1">
        <span className="text-[9px] font-bold uppercase tracking-wider truncate"
              style={{ color: udoColor }}>
          {udoName}
        </span>
        <div className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
      </div>

      {/* Nome struttura */}
      <p className="text-[11px] font-semibold text-gray-800 leading-tight line-clamp-2 min-h-[28px]">
        {f.name}
      </p>

      {/* Regione + posti letto */}
      <p className="text-[10px] text-gray-400 truncate">
        {f.region} · {f.bed_count ? `${f.bed_count} pl` : '—'}
      </p>

      {/* Footer: stato + manuale */}
      <div className="flex items-center justify-between gap-1 pt-1 border-t border-black/5">
        <span className={`text-[9px] font-medium ${s.text}`}>{s.label}</span>
        {f.manuale_presente
          ? <span className="text-[9px] text-green-600 font-medium">📋 Manuale</span>
          : <span className="text-[9px] text-red-400 font-medium">📋 Mancante</span>
        }
      </div>
    </div>
  );
}
