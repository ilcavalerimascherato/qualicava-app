// src/views/OccupazioneDashboard.jsx
// Vista Saturazione — griglia raggi X con saturazione % vs budget per struttura

import { useState, useMemo } from 'react';
import { Search, MapPin, ChevronDown, Check, Pause, Building2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCdgData, aggregateCdgRecords, calcCdgSummary } from '../hooks/useCdgData';
import { useDashboardData } from '../hooks/useDashboardData';
import { useBadgeCounts } from '../hooks/useBadgeCounts';
import AppHeader from '../components/AppHeader';
import CdgStrutturaCard from '../components/CdgStrutturaCard';

function GroupSemafori({ facilities }) {
  const v = facilities.filter(f => f._semaforo === 'verde').length;
  const g = facilities.filter(f => f._semaforo === 'giallo').length;
  const r = facilities.filter(f => f._semaforo === 'rosso').length;
  const n = facilities.filter(f => f._semaforo === 'grigio').length;
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
      {n > 0 && (
        <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 flex-shrink-0" />
          {n} n/d
        </span>
      )}
    </div>
  );
}

function cdgSemaforo(summary) {
  if (!summary || summary.deltaVsBudget == null) return 'grigio';
  if (summary.deltaVsBudget >= -2) return 'verde';
  if (summary.deltaVsBudget >= -5) return 'giallo';
  return 'rosso';
}

// ── Vista principale ──────────────────────────────────────────────────────────
export default function OccupazioneDashboard() {
  const navigate = useNavigate();
  const { isAdmin, profile, signOut } = useAuth();
  const year = new Date().getFullYear();
  const [filtroSemaforo, setFiltroSemaforo]     = useState(null);
  const [search, setSearch]                     = useState('');
  const [filterUdo, setFilterUdo]               = useState('');
  const [selectedRegions, setSelectedRegions]   = useState([]);
  const [regionDropdownOpen, setRegionDropdownOpen] = useState(false);
  const [showSuspended, setShowSuspended]       = useState(false);
  const [showSocieta, setShowSocieta]           = useState(false);

  const { data: dashData, loading } = useDashboardData(year);
  const { data: cdgData }           = useCdgData(null, year);

  const allIds = useMemo(
    () => (dashData.facilities ?? []).filter(f => !f.is_suspended).map(f => f.id),
    [dashData.facilities],
  );
  const { totals: badgeTotals } = useBadgeCounts(allIds, year, isAdmin);

  const companyById = useMemo(() => {
    const map = {};
    (dashData.companies ?? []).forEach(c => { map[c.id] = c.name; });
    return map;
  }, [dashData.companies]);

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

  const facilitiesConSemaforo = useMemo(() => {
    const facilities = dashData?.facilities ?? [];
    return facilities.map(f => {
      const records    = cdgData?.cdgByFacility?.[f.id] ?? [];
      const aggregated = aggregateCdgRecords(records);
      const summary    = calcCdgSummary(aggregated, f.bed_count || 0);
      return { ...f, _semaforo: cdgSemaforo(summary), _cdgRecords: records };
    });
  }, [dashData, cdgData]);

  const availableUdos = useMemo(
    () => [...new Set(facilitiesConSemaforo.map(f => f.udo_name).filter(Boolean))].sort(),
    [facilitiesConSemaforo],
  );

  const availableRegions = useMemo(
    () => [...new Set(facilitiesConSemaforo.map(f => f.region).filter(Boolean))].sort(),
    [facilitiesConSemaforo],
  );

  const counts = useMemo(() => {
    const c = { verde: 0, giallo: 0, rosso: 0, grigio: 0 };
    facilitiesConSemaforo.forEach(f => c[f._semaforo]++);
    return c;
  }, [facilitiesConSemaforo]);

  const totalBeds = useMemo(
    () => facilitiesConSemaforo.reduce((sum, f) => sum + (f.bed_count || 0), 0),
    [facilitiesConSemaforo],
  );

  const totalFacilities = facilitiesConSemaforo.length;

  const filtered = useMemo(() => {
    return facilitiesConSemaforo.filter(f => {
      if (filtroSemaforo && f._semaforo !== filtroSemaforo) return false;
      if (search && !f.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterUdo && f.udo_name !== filterUdo) return false;
      if (selectedRegions.length > 0 && !selectedRegions.includes(f.region)) return false;
      if (!showSuspended && f.is_suspended) return false;
      return true;
    });
  }, [facilitiesConSemaforo, filtroSemaforo, search, filterUdo, selectedRegions, showSuspended]);

  const groupedFacilities = useMemo(() => {
    const groups = {};
    filtered.forEach(f => {
      const key = showSocieta
        ? (companyById[f.company_id] ?? 'Senza società')
        : (f.region ?? 'Altra');
      if (!groups[key]) groups[key] = [];
      groups[key].push(f);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b, 'it', { sensitivity: 'base' }));
  }, [filtered, showSocieta, companyById]);

  return (
    <div className="min-h-screen bg-gray-50">

      {/* MOD 2 — AppHeader */}
      <AppHeader
        activePage="saturazione"
        badgeCounts={badgeTotals}
        user={profile}
        onSignOut={signOut}
        onNavigate={handleNavigate}
      />

      {/* Context bar + toolbar */}
      <div className="flex items-center justify-between px-5 py-2 bg-white border-b border-slate-200">

        {/* SINISTRA — titolo */}
        <div className="flex-shrink-0">
          <h1 className="text-sm font-semibold text-slate-900">Saturazione strutture</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            % posti letto occupati vs budget · mese precedente chiuso · {totalFacilities} strutture
          </p>
        </div>

        {/* CENTRO — filtri */}
        <div className="flex-1 flex items-center justify-center gap-2 flex-nowrap px-6">

          {/* Ricerca */}
          <div className="flex items-center gap-1.5 border border-slate-200 rounded-full px-3 py-1.5 bg-slate-50 w-44">
            <Search size={13} className="text-slate-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Cerca struttura..."
              className="bg-transparent text-xs outline-none w-full text-slate-700 placeholder-slate-300"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Filtro UDO */}
          <select
            value={filterUdo}
            onChange={e => setFilterUdo(e.target.value)}
            className="flex items-center gap-1.5 border border-slate-200 rounded-full px-3 py-1.5 text-xs text-slate-500 bg-slate-50 whitespace-nowrap appearance-none cursor-pointer"
          >
            <option value="">Tutte le UDO</option>
            {availableUdos.map(u => <option key={u} value={u}>{u}</option>)}
          </select>

          {/* Filtro Regione multi-select */}
          <div className="relative">
            <button
              onClick={() => setRegionDropdownOpen(prev => !prev)}
              className={`flex items-center gap-1.5 border rounded-full px-3 py-1.5 text-xs whitespace-nowrap transition-colors ${
                selectedRegions.length > 0
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                  : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'
              }`}
            >
              <MapPin size={12} />
              {selectedRegions.length === 0
                ? 'Tutte le regioni'
                : selectedRegions.length === 1
                  ? selectedRegions[0]
                  : `${selectedRegions.length} regioni`
              }
              <ChevronDown size={10} className="text-slate-400" />
            </button>

            {regionDropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setRegionDropdownOpen(false)} />
                <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-sm z-20 min-w-[160px] py-1">
                  <button
                    onClick={() => { setSelectedRegions([]); setRegionDropdownOpen(false); }}
                    className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                      selectedRegions.length === 0 ? 'text-emerald-600 font-medium bg-emerald-50' : 'text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    Tutte le regioni
                  </button>
                  <div className="h-px bg-slate-100 my-1" />
                  {availableRegions.map(region => (
                    <button
                      key={region}
                      onClick={() => setSelectedRegions(prev =>
                        prev.includes(region) ? prev.filter(r => r !== region) : [...prev, region]
                      )}
                      className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors ${
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

          {/* Toggle Sospese */}
          <button
            onClick={() => setShowSuspended(prev => !prev)}
            className={`flex items-center gap-1.5 border rounded-full px-3 py-1.5 text-xs whitespace-nowrap transition-colors ${
              showSuspended
                ? 'bg-amber-50 border-amber-300 text-amber-600'
                : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'
            }`}
          >
            <Pause size={12} />
            Sospese
          </button>

        </div>

        {/* DESTRA — spazio riservato */}
        <div className="flex-shrink-0 w-24" />

      </div>

      {/* MOD 4 — KPI strip */}
      <div className="flex items-center justify-between px-5 py-1.5 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Posti letto attivi</span>
          <span className="text-sm font-semibold text-slate-800">{totalBeds}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFiltroSemaforo(prev => prev === 'verde' ? null : 'verde')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
              filtroSemaforo === 'verde'
                ? 'bg-emerald-200 text-emerald-800 ring-1 ring-emerald-400'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
            {counts.verde} in target
          </button>
          <button
            onClick={() => setFiltroSemaforo(prev => prev === 'giallo' ? null : 'giallo')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
              filtroSemaforo === 'giallo'
                ? 'bg-amber-200 text-amber-800 ring-1 ring-amber-400'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
            {counts.giallo} attenzione
          </button>
          <button
            onClick={() => setFiltroSemaforo(prev => prev === 'rosso' ? null : 'rosso')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
              filtroSemaforo === 'rosso'
                ? 'bg-red-200 text-red-800 ring-1 ring-red-400'
                : 'bg-red-50 text-red-700 hover:bg-red-100'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
            {counts.rosso} sotto budget
          </button>
          <button
            onClick={() => setFiltroSemaforo(prev => prev === 'grigio' ? null : 'grigio')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
              filtroSemaforo === 'grigio'
                ? 'bg-slate-200 text-slate-700 ring-1 ring-slate-400'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-slate-400 flex-shrink-0" />
            {counts.grigio} senza dati
          </button>
        </div>
      </div>

      {/* Griglia raggruppata per regione o società */}
      <div className="pb-10">
        {loading ? (
          <p className="text-sm text-gray-400 text-center py-12">Caricamento…</p>
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
              <div className="grid grid-cols-6 gap-3 px-5 pb-2">
                {groupFacilities.map(f => (
                  <CdgStrutturaCard
                    key={f.id}
                    facility={f}
                    cdgRecords={f._cdgRecords}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
}
