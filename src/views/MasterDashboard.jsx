/**
 * src/views/MasterDashboard.jsx
 * Vista MASTER HACCP — accessibile solo ad admin/superadmin/sede.
 */
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, MapPin, ChevronDown, Check, Pause, Building2 } from 'lucide-react';
import { useAuth }           from '../contexts/AuthContext';
import { useDashboardData }  from '../hooks/useDashboardData';
import { useBadgeCounts }    from '../hooks/useBadgeCounts';
import { useHaccpSemafori }  from '../hooks/useHaccpData';
import AppHeader             from '../components/AppHeader';
import HaccpFascicoloModal   from '../components/HaccpFascicoloModal';

// Mappa haccpFilter → haccp_semaforo
const HACCP_FILTER_MAP = {
  inRegola:   'verde',
  attenzione: 'giallo',
  critico:    'rosso',
  condivise:  'blu',
  nonCensiti: 'grigio',
};

// Mappa filterStato → haccp_semaforo
const STATO_MAP = {
  conforme:   'verde',
  attenzione: 'giallo',
  critico:    'rosso',
  condivisa:  'blu',
  non_attivo: 'grigio',
};

export default function MasterDashboard() {
  const navigate        = useNavigate();
  const [searchParams]  = useSearchParams();
  const facilityIdParam = searchParams.get('facility');
  const { isAdmin, profile, signOut } = useAuth();

  const year = new Date().getFullYear();
  const { data, loading }                        = useDashboardData(year);
  const { semafori, scadenzario, loading: loadingSem } = useHaccpSemafori();

  const [search,             setSearch]             = useState('');
  const [filterUdo,          setFilterUdo]          = useState('');
  const [selectedRegions,    setSelectedRegions]    = useState([]);
  const [regionDropdownOpen, setRegionDropdownOpen] = useState(false);
  const [showSuspended,      setShowSuspended]      = useState(false);
  const [showSocieta,        setShowSocieta]        = useState(false);
  const [filterStato,        setFilterStato]        = useState('');
  const [haccpFilter,        setHaccpFilter]        = useState(null);
  const [selectedFacility,   setSelectedFacility]   = useState(null);

  // Apri automaticamente il fascicolo se arriva da ?facility=ID
  useEffect(() => {
    if (facilityIdParam && data.facilities.length > 0) {
      const f = data.facilities.find(x => String(x.id) === facilityIdParam);
      if (f) setSelectedFacility(f);
    }
  }, [facilityIdParam, data.facilities]);

  const allIds = useMemo(
    () => (data.facilities ?? []).filter(f => !f.is_suspended).map(f => f.id),
    [data.facilities],
  );
  const { totals: badgeTotals } = useBadgeCounts(allIds, year, isAdmin);

  const companyById = useMemo(() => {
    const map = {};
    (data.companies ?? []).forEach(c => { map[c.id] = c.name; });
    return map;
  }, [data.companies]);

  const handleNavigate = (page) => {
    const routes = {
      dashboard:    '/admin',
      saturazione:  '/occupazione',
      haccp:        '/master',
      documenti:    '/documenti',
      nc:           '/admin',
      report:       '/report',
      impostazioni: '/impostazioni',
    };
    navigate(routes[page] ?? '/admin');
  };

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

  const regioni = useMemo(() => {
    const set = new Set(enriched.filter(f => f.region).map(f => f.region));
    return Array.from(set).sort();
  }, [enriched]);

  const udoNames = useMemo(() => {
    const set = new Set(enriched.map(f => f.udo_name).filter(Boolean));
    return Array.from(set).sort();
  }, [enriched]);

  // Contatori semaforo (su strutture soggette, escluse sospese)
  const counts = useMemo(() => {
    const haccpOnly = enriched.filter(f => f.haccp_obbligatorio && !f.is_suspended);
    return {
      totale: haccpOnly.length,
      verde:  haccpOnly.filter(f => f.haccp_semaforo === 'verde').length,
      giallo: haccpOnly.filter(f => f.haccp_semaforo === 'giallo').length,
      rosso:  haccpOnly.filter(f => f.haccp_semaforo === 'rosso').length,
      grigio: haccpOnly.filter(f => f.haccp_semaforo === 'grigio' || !f.haccp_semaforo).length,
      blu:    haccpOnly.filter(f => f.haccp_semaforo === 'blu').length,
    };
  }, [enriched]);

  const totalBeds = useMemo(
    () => enriched.reduce((sum, f) => sum + (f.bed_count || 0), 0),
    [enriched],
  );

  const totalFacilities = enriched.length;

  // Filtro strutture
  const filtered = useMemo(() => {
    const targetSemaforo = haccpFilter
      ? HACCP_FILTER_MAP[haccpFilter]
      : filterStato
        ? STATO_MAP[filterStato]
        : null;
    return enriched.filter(f => {
      if (!showSuspended && f.is_suspended) return false;
      if (search && !f.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (selectedRegions.length > 0 && !selectedRegions.includes(f.region)) return false;
      if (filterUdo && f.udo_name !== filterUdo) return false;
      if (targetSemaforo && f.haccp_semaforo !== targetSemaforo) return false;
      return true;
    });
  }, [enriched, search, selectedRegions, filterUdo, haccpFilter, filterStato, showSuspended]);

  // Raggruppamento per regione o società
  const groupedFacilities = useMemo(() => {
    const map = {};
    for (const f of filtered) {
      const key = showSocieta
        ? (companyById[f.company_id] ?? 'Senza società')
        : (f.region || 'Altre');
      if (!map[key]) map[key] = [];
      map[key].push(f);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered, showSocieta, companyById]);

  const isLoading = loading || loadingSem;

  return (
    <div className="min-h-screen bg-slate-100 pb-16 font-sans">

      <AppHeader
        activePage="haccp"
        badgeCounts={badgeTotals}
        user={profile}
        onSignOut={signOut}
        onNavigate={handleNavigate}
      />

      {/* Toolbar */}
      <div className="flex items-center justify-between px-5 py-2 bg-white border-b border-slate-200">

        {/* SINISTRA — titolo */}
        <div className="flex-shrink-0">
          <h1 className="text-sm font-semibold text-slate-900">HACCP · Sicurezza alimentare</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {counts.totale} strutture soggette · {totalFacilities} totali
          </p>
        </div>

        {/* CENTRO — filtri standard */}
        <div className="flex-1 flex items-center justify-center gap-2 flex-nowrap px-6">

          {/* Ricerca */}
          <div className="flex items-center gap-1.5 border border-slate-200 rounded-full px-3 py-1.5 bg-slate-50 w-44">
            <Search size={13} className="text-slate-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Cerca struttura..."
              className="bg-transparent text-xs outline-none w-full placeholder-slate-300"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* UDO */}
          <select
            value={filterUdo}
            onChange={e => setFilterUdo(e.target.value)}
            className="border border-slate-200 rounded-full px-3 py-1.5 text-xs text-slate-500 bg-slate-50 appearance-none cursor-pointer"
          >
            <option value="">Tutte le UDO</option>
            {udoNames.map(u => <option key={u} value={u}>{u}</option>)}
          </select>

          {/* Regione multi-select */}
          <div className="relative">
            <button
              onClick={() => setRegionDropdownOpen(prev => !prev)}
              className={`flex items-center gap-1.5 border rounded-full px-3 py-1.5 text-xs whitespace-nowrap ${
                selectedRegions.length > 0
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                  : 'bg-slate-50 border-slate-200 text-slate-500'
              }`}
            >
              <MapPin size={12} />
              {selectedRegions.length === 0 ? 'Tutte le regioni'
                : selectedRegions.length === 1 ? selectedRegions[0]
                : `${selectedRegions.length} regioni`}
              <ChevronDown size={10} className="text-slate-400" />
            </button>
            {regionDropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setRegionDropdownOpen(false)} />
                <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-sm z-20 min-w-[160px] py-1">
                  <button
                    onClick={() => { setSelectedRegions([]); setRegionDropdownOpen(false); }}
                    className={`w-full text-left px-3 py-1.5 text-xs ${
                      selectedRegions.length === 0 ? 'text-emerald-600 font-medium bg-emerald-50' : 'text-slate-500 hover:bg-slate-50'
                    }`}
                  >Tutte le regioni</button>
                  <div className="h-px bg-slate-100 my-1" />
                  {regioni.map(region => (
                    <button
                      key={region}
                      onClick={() => setSelectedRegions(prev =>
                        prev.includes(region) ? prev.filter(r => r !== region) : [...prev, region]
                      )}
                      className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 ${
                        selectedRegions.includes(region) ? 'text-emerald-700 bg-emerald-50' : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${
                        selectedRegions.includes(region) ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300'
                      }`}>
                        {selectedRegions.includes(region) && <Check size={9} color="white" />}
                      </span>
                      {region}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Società */}
          <button
            onClick={() => setShowSocieta(prev => !prev)}
            className={`flex items-center gap-1.5 border rounded-full px-3 py-1.5 text-xs whitespace-nowrap transition-colors ${
              showSocieta
                ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'
            }`}
          >
            <Building2 size={12} />
            Società
          </button>

          {/* Stato HACCP */}
          <select
            value={filterStato}
            onChange={e => { setFilterStato(e.target.value); setHaccpFilter(null); }}
            className="border border-slate-200 rounded-full px-3 py-1.5 text-xs text-slate-500 bg-slate-50 appearance-none cursor-pointer"
          >
            <option value="">Tutti gli stati</option>
            <option value="conforme">Conforme</option>
            <option value="attenzione">Attenzione</option>
            <option value="critico">Critico</option>
            <option value="non_attivo">Non attivo</option>
          </select>

          {/* Sospese */}
          <button
            onClick={() => setShowSuspended(prev => !prev)}
            className={`flex items-center gap-1.5 border rounded-full px-3 py-1.5 text-xs whitespace-nowrap transition-colors ${
              showSuspended
                ? 'bg-amber-50 border-amber-300 text-amber-600'
                : 'bg-slate-50 border-slate-200 text-slate-500'
            }`}
          >
            <Pause size={12} />
            Sospese
          </button>

        </div>

        {/* DESTRA — spazio riservato */}
        <div className="flex-shrink-0 w-24" />

      </div>

      {/* KPI strip */}
      <div className="flex items-center justify-between px-5 py-1.5 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Posti letto attivi</span>
          <span className="text-sm font-semibold text-slate-800">{totalBeds}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setHaccpFilter(prev => prev === 'inRegola' ? null : 'inRegola'); setFilterStato(''); }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
              haccpFilter === 'inRegola'
                ? 'bg-emerald-200 text-emerald-800 ring-1 ring-emerald-400'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
            {counts.verde} in regola
          </button>
          <button
            onClick={() => { setHaccpFilter(prev => prev === 'attenzione' ? null : 'attenzione'); setFilterStato(''); }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
              haccpFilter === 'attenzione'
                ? 'bg-amber-200 text-amber-800 ring-1 ring-amber-400'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
            {counts.giallo} attenzione
          </button>
          <button
            onClick={() => { setHaccpFilter(prev => prev === 'critico' ? null : 'critico'); setFilterStato(''); }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
              haccpFilter === 'critico'
                ? 'bg-red-200 text-red-800 ring-1 ring-red-400'
                : 'bg-red-50 text-red-700 hover:bg-red-100'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
            {counts.rosso} critici
          </button>
          {counts.blu > 0 && (
            <button
              onClick={() => { setHaccpFilter(prev => prev === 'condivise' ? null : 'condivise'); setFilterStato(''); }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                haccpFilter === 'condivise'
                  ? 'bg-blue-200 text-blue-800 ring-1 ring-blue-400'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
              {counts.blu} condivise
            </button>
          )}
          <button
            onClick={() => { setHaccpFilter(prev => prev === 'nonCensiti' ? null : 'nonCensiti'); setFilterStato(''); }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
              haccpFilter === 'nonCensiti'
                ? 'bg-slate-200 text-slate-700 ring-1 ring-slate-400'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-slate-400 flex-shrink-0" />
            {counts.grigio} non censiti
          </button>
        </div>
      </div>

      {/* Contenuto */}
      <div className="pb-10">
        {isLoading ? (
          <div className="flex items-center justify-center py-32 text-slate-400 font-black uppercase tracking-widest animate-pulse">
            Caricamento strutture HACCP...
          </div>
        ) : groupedFacilities.length === 0 ? (
          <div className="text-center py-20 text-slate-400 font-bold">
            Nessuna struttura trovata
          </div>
        ) : (
          groupedFacilities.map(([groupName, groupFacilities]) => (
            <div key={groupName}>
              <div className="flex items-center gap-2 px-5 py-2 mt-3">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
                  {groupName}
                </span>
                <span className="text-xs text-slate-400">{groupFacilities.length} strutture</span>
                <div className="flex-1 h-px bg-slate-200" />
                <GroupSemafori facilities={groupFacilities} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 px-5 pb-2">
                {groupFacilities.map(f => (
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
      </div>

      {selectedFacility && (
        <HaccpFascicoloModal
          facility={selectedFacility}
          onClose={() => setSelectedFacility(null)}
        />
      )}
    </div>
  );
}

// ── GroupSemafori ─────────────────────────────────────────────
function GroupSemafori({ facilities }) {
  const v = facilities.filter(f => f.haccp_semaforo === 'verde').length;
  const g = facilities.filter(f => f.haccp_semaforo === 'giallo').length;
  const r = facilities.filter(f => f.haccp_semaforo === 'rosso').length;
  const b = facilities.filter(f => f.haccp_semaforo === 'blu').length;
  const n = facilities.filter(f => f.haccp_semaforo === 'grigio' || !f.haccp_semaforo).length;
  return (
    <div className="flex items-center gap-1.5">
      {v > 0 && (
        <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
          {v} ok
        </span>
      )}
      {g > 0 && (
        <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
          {g} att.
        </span>
      )}
      {r > 0 && (
        <span className="flex items-center gap-1 text-[10px] font-semibold text-red-700 bg-red-50 px-1.5 py-0.5 rounded">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
          {r} critici
        </span>
      )}
      {b > 0 && (
        <span className="flex items-center gap-1 text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
          {b} condivisa
        </span>
      )}
      {n > 0 && (
        <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 flex-shrink-0" />
          {n} n/d
        </span>
      )}
    </div>
  );
}

// ── HaccpCard ─────────────────────────────────────────────────
function HaccpCard({ f, udos, onClick }) {
  const udoName  = udos?.find(u => u.id === f.udo_id)?.name || f.udo_name || '';
  const udoColor = f.udo_color || '#6366f1';

  const semaforoConfig = {
    verde:  { dot: 'bg-green-500',  bg: 'bg-green-50',  border: 'border-green-200',  label: 'Conforme',        text: 'text-green-700'  },
    giallo: { dot: 'bg-yellow-400', bg: 'bg-yellow-50', border: 'border-yellow-200', label: 'Attenzione',      text: 'text-yellow-700' },
    rosso:  { dot: 'bg-red-500',    bg: 'bg-red-50',    border: 'border-red-200',    label: 'Critico',         text: 'text-red-700'    },
    blu:    { dot: 'bg-blue-500',   bg: 'bg-blue-50',   border: 'border-blue-200',   label: 'Cucina condivisa', text: 'text-blue-700'  },
    grigio: { dot: 'bg-gray-300',   bg: 'bg-gray-50',   border: 'border-gray-200',   label: 'Non attivo',      text: 'text-gray-400'   },
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
        {f.haccp_semaforo === 'blu'
          ? null
          : f.manuale_presente
            ? <span className="text-[9px] text-green-600 font-medium">📋 Manuale</span>
            : <span className="text-[9px] text-red-400 font-medium">📋 Mancante</span>
        }
      </div>
    </div>
  );
}
