/**
 * src/views/MasterDashboard.jsx
 * ─────────────────────────────────────────────────────────────
 * Vista MASTER HACCP — accessibile solo ad admin/superadmin/sede.
 * Mostra tutte le strutture con il cappello da chef semaforo.
 * Cliccando sul cappello (o sulla card) si apre HaccpFascicoloModal.
 *
 * Props ricevute da route: nessuna (tutto da hook)
 * Query string: ?facility=ID → apre direttamente il fascicolo di quella struttura
 * ─────────────────────────────────────────────────────────────
 */
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChefHat, ArrowLeft, Search, Filter, BookOpen } from 'lucide-react';
import { useDashboardData } from '../hooks/useDashboardData';
import { useHaccpSemafori } from '../hooks/useHaccpData';
import HaccpFascicoloModal  from '../components/HaccpFascicoloModal';

// Configurazione colori semaforo
const SEMAFORO_CFG = {
  verde:  { color: 'text-emerald-500', bg: 'bg-emerald-50',  border: 'border-emerald-200', label: 'In regola',  dot: 'bg-emerald-500' },
  giallo: { color: 'text-amber-400',   bg: 'bg-amber-50',    border: 'border-amber-200',   label: 'Attenzione', dot: 'bg-amber-400'   },
  rosso:  { color: 'text-red-500',     bg: 'bg-red-50',      border: 'border-red-200',     label: 'Critico',    dot: 'bg-red-500'     },
  grigio: { color: 'text-slate-300',   bg: 'bg-slate-50',    border: 'border-slate-200',   label: 'N/A',        dot: 'bg-slate-300'   },
};

export default function MasterDashboard() {
  const navigate        = useNavigate();
  const [searchParams]  = useSearchParams();
  const facilityIdParam = searchParams.get('facility');

  const { data, loading } = useDashboardData(new Date().getFullYear());
  const { semafori, scadenzario, loading: loadingSem } = useHaccpSemafori();

  const [search,          setSearch]          = useState('');
  const [filterSemaforo,  setFilterSemaforo]  = useState('all');
  const [filterRegione,   setFilterRegione]   = useState('all');
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
        haccp_semaforo:    semafori[f.id] ?? (f.haccp_obbligatorio ? 'grigio' : null),
        manuale_presente:  sc ? !!sc.manuale_scadenza : false,
      };
    });
  }, [data.facilities, semafori, scadenzario]);

  // Regioni disponibili per filtro
  const regioni = useMemo(() => {
    const set = new Set(enriched.filter(f => f.region).map(f => f.region));
    return Array.from(set).sort();
  }, [enriched]);

  // Filtro strutture
  const filtered = useMemo(() => {
    return enriched.filter(f => {
      if (f.is_suspended) return false;
      if (search && !f.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterRegione !== 'all' && f.region !== filterRegione) return false;
      if (filterSemaforo === 'haccp_only' && !f.haccp_obbligatorio) return false;
      if (filterSemaforo !== 'all' && filterSemaforo !== 'haccp_only') {
        if (f.haccp_semaforo !== filterSemaforo) return false;
      }
      return true;
    });
  }, [enriched, search, filterRegione, filterSemaforo]);

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

          {/* KPI semaforo sintetico */}
          <div className="flex items-center gap-3">
            {[
              { key: 'verde',  label: 'In regola',  count: counts.verde,  cls: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
              { key: 'giallo', label: 'Attenzione', count: counts.giallo, cls: 'bg-amber-50 border-amber-200 text-amber-700'       },
              { key: 'rosso',  label: 'Critici',    count: counts.rosso,  cls: 'bg-red-50 border-red-200 text-red-700'             },
              { key: 'grigio', label: 'Non censiti',count: counts.grigio, cls: 'bg-slate-100 border-slate-200 text-slate-500'      },
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

      {/* ── Griglia strutture ── */}
      <main className="px-8 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-32 text-slate-400 font-black uppercase tracking-widest animate-pulse">
            Caricamento strutture HACCP...
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
            {filtered.map(f => (
              <HaccpCard
                key={f.id}
                f={f}
                udos={data.udos}
                onClick={() => setSelectedFacility(f)}
              />
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full text-center py-20 text-slate-400 font-bold">
                Nessuna struttura trovata
              </div>
            )}
          </div>
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
  const semaforo = f.haccp_semaforo ?? (f.haccp_obbligatorio ? 'grigio' : null);
  const cfg      = SEMAFORO_CFG[semaforo] ?? SEMAFORO_CFG.grigio;
  const udoName  = udos?.find(u => u.id === f.udo_id)?.name || '';
  const haManualeArchiviato = f.manuale_presente;

  return (
    <div
      onClick={f.haccp_obbligatorio ? onClick : undefined}
      className={`
        bg-white rounded-xl p-4 shadow-sm border flex flex-col gap-2 relative
        transition-all duration-200
        ${f.haccp_obbligatorio
          ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5'
          : 'opacity-50 cursor-default'
        }
        ${cfg.border}
      `}
      style={{ borderTopWidth: '4px', borderTopColor: f.udo_color || '#cbd5e1' }}
    >
      {/* Nome + cappello */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-xs font-black text-slate-800 leading-tight line-clamp-2 flex-1">
          {f.name}
        </h3>
        <div className={`shrink-0 p-1.5 rounded-lg ${cfg.bg}`} title={cfg.label}>
          <ChefHat size={16} className={cfg.color} />
        </div>
      </div>

      {/* Subtitle */}
      {udoName && (
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">
          {udoName}
        </p>
      )}
      {f.region && (
        <p className="text-[10px] text-slate-400 truncate">{f.region}</p>
      )}

      {/* Badge doppio: semaforo sx | manuale dx */}
      <div className="flex gap-1.5 mt-auto">
        {/* Metà sinistra — stato semaforo */}
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg flex-1 ${cfg.bg} border ${cfg.border}`}
          title={cfg.label}>
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
          <span className={`text-[10px] font-black uppercase tracking-widest truncate ${cfg.color}`}>
            {f.haccp_obbligatorio ? cfg.label : 'Non HACCP'}
          </span>
        </div>

        {/* Metà destra — manuale archiviato */}
        {f.haccp_obbligatorio && (
          <div
            className={`flex items-center gap-1 px-2 py-1 rounded-lg border ${
              haManualeArchiviato
                ? 'bg-emerald-50 border-emerald-200'
                : 'bg-red-50 border-red-200'
            }`}
            title={haManualeArchiviato ? 'Manuale prodotto e archiviato' : 'Manuale non ancora prodotto'}
          >
            <BookOpen
              size={12}
              className={haManualeArchiviato ? 'text-emerald-500' : 'text-red-400'}
            />
          </div>
        )}
      </div>
    </div>
  );
}
