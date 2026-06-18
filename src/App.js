// src/App.js
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import {
  Search, Grid2X2, Grid3X3, LayoutGrid,
  Building2, Briefcase, Pause, Plus, ChevronDown, MapPin, Check,
} from 'lucide-react';

import { useAuth }                                           from './contexts/AuthContext';
import { useModals }                                         from './contexts/ModalContext';
import { useDashboardData, useInvalidate }                   from './hooks/useDashboardData';
import { useHaccpSemafori }                                  from './hooks/useHaccpData';
import { useBadgeCounts }                                    from './hooks/useBadgeCounts';
import { facilityService, questionnaireService } from './services/supabaseService';
import { enrichFacilitiesData, calculateDashboardStats }     from './utils/statusCalculator';
import { calcFacilityRiskScore }                             from './utils/riskScoreEngine';

import Login              from './Login';
import AppHeader          from './components/AppHeader';
import FacilityCard       from './components/FacilityCard';
import CompaniesView     from './components/CompaniesView';
import GlobalReportModal  from './components/GlobalReportModal';
import FacilityModal      from './components/FacilityModal';
import QuestionnaireModal from './components/QuestionnaireModal';
import DataImportModal    from './components/DataImportModal';
import AnalyticsModal     from './components/AnalyticsModal';
import KpiManagerModal    from './components/KpiManagerModal';
import KpiDashboardModal  from './components/KpiDashboardModal';
import KpiChartsModal     from './components/KpiChartsModal';
import KpiHubModal        from './components/KpiHubModal';
import KpiLaserModal      from './components/KpiLaserModal';
import KpiXrayModal           from './components/KpiXrayModal';
import QualityDashboardModal  from './components/QualityDashboardModal';
import RankingModal           from './components/RankingModal';

export default function App() {
  const { session, loading: authLoading, isAdmin, profile, signOut } = useAuth();
  const { modals, open, close } = useModals();
  const navigate   = useNavigate();
  const invalidate = useInvalidate();

  const [year]                                  = useState(new Date().getFullYear());
  const [showSuspended, setShowSuspended]       = useState(false);
  const [gridCols, setGridCols]                 = useState('lg:grid-cols-4');
  const [filterUdo, setFilterUdo]               = useState('all');
  const [showSocieta, setShowSocieta]           = useState(false);
  const [selectedCompany, setSelectedCompany]   = useState(null);
  const [searchQuery, setSearchQuery]           = useState('');
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [dataTarget, setDataTarget]             = useState(null);
  const [semaforoFilter, setSemaforoFilter]     = useState(null);
  const [selectedRegions, setSelectedRegions]       = useState([]);
  const [regionDropdownOpen, setRegionDropdownOpen] = useState(false);

  const { loading: dataLoading, data, errors } = useDashboardData(year);
  const { semafori: haccpSemafori }            = useHaccpSemafori();

  useEffect(() => {
    errors.forEach(msg => toast.error(`Errore dati: ${msg}`, { id: msg }));
  }, [errors]);

  const processedData = useMemo(() => {
    const enriched = enrichFacilitiesData(data.facilities, data.surveys, data.kpiRecords, year, data.udos);
    const withHaccp = enriched.map(f => ({
      ...f,
      haccp_semaforo: haccpSemafori[f.id] ?? (f.haccp_obbligatorio ? 'grigio' : null),
    }));
    const withRisk = withHaccp.map(f => {
      const { score, level } = calcFacilityRiskScore(f, data.kpiRecords);
      return { ...f, riskScore: score, riskLevel: level };
    });
    const stats = calculateDashboardStats(withRisk, 'all');
    return {
      list: withRisk,
      ...stats,
      countLow:       withRisk.filter(f => !f.is_suspended && f.riskLevel === 'low').length,
      countMedium:    withRisk.filter(f => !f.is_suspended && f.riskLevel === 'medium').length,
      countHigh:      withRisk.filter(f => !f.is_suspended && f.riskLevel === 'high').length,
      countSuspended: withRisk.filter(f => f.is_suspended).length,
    };
  }, [data.facilities, data.surveys, data.kpiRecords, data.udos, year, haccpSemafori]);

  const allFacilityIds = useMemo(
    () => processedData.list.filter(f => !f.is_suspended).map(f => f.id),
    [processedData.list],
  );
  const { totals: badgeTotals } = useBadgeCounts(allFacilityIds, year, isAdmin);

  const availableRegions = useMemo(
    () => [...new Set(data.facilities.map(f => f.region).filter(Boolean))].sort(),
    [data.facilities],
  );

  const filteredFacilities = useMemo(() => {
    return processedData.list.filter(f => {
      if (semaforoFilter === 'suspended') {
        if (!f.is_suspended) return false;
      } else {
        if (!showSuspended && f.is_suspended) return false;
        if (semaforoFilter && f.riskLevel !== semaforoFilter) return false;
      }
      const q = searchQuery.toLowerCase();
      if (!f.name.toLowerCase().includes(q) && !(f.address || '').toLowerCase().includes(q)) return false;
      if (filterUdo !== 'all' && String(f.udo_id) !== String(filterUdo)) return false;
      if (selectedCompany && f.company_id !== selectedCompany.id) return false;
      if (selectedRegions.length > 0 && !selectedRegions.includes(f.region)) return false;
      return true;
    });
  }, [processedData.list, filterUdo, searchQuery, showSuspended, selectedCompany, semaforoFilter, selectedRegions]);

  const facilitiesByRegion = useMemo(() => {
    const active    = filteredFacilities.filter(f => !f.is_suspended);
    const suspended = filteredFacilities.filter(f => f.is_suspended);
    const groups    = {};
    active.forEach(f => {
      const r = f.region || 'Senza regione';
      if (!groups[r]) groups[r] = [];
      groups[r].push(f);
    });
    const regionEntries = Object.entries(groups).sort(([a], [b]) =>
      a.localeCompare(b, 'it', { sensitivity: 'base' }),
    );
    return { regionEntries, suspended };
  }, [filteredFacilities]);

  const handleSuspendToggle = async (facility) => {
    try {
      await facilityService.toggleSuspend(facility);
      await invalidate.facilities();
    } catch (err) {
      toast.error(`Errore sospensione: ${err.message}`);
    }
  };

  const handleDirectorView = (facility) => {
    navigate(`/facility/${facility.id}`);
  };

  const handleHaccpClick = (facility) => {
    navigate(`/master?facility=${facility.id}`);
  };

  const handleFacilitySave = async (d) => {
    try {
      const saved = await facilityService.save(d);
      await invalidate.facilities();
      close('facility');
      setSelectedFacility(null);
      toast.success('Struttura salvata');
      return saved;
    } catch (err) {
      toast.error(`Errore salvataggio: ${err.message}`);
      throw err;
    }
  };

  const handleFacilityDelete = async (id) => {
    if (!window.confirm('Eliminare questa struttura? L\'operazione è irreversibile.')) { return; }
    try {
      await facilityService.delete(id);
      close('facility');
      await invalidate.facilities();
      toast.success('Struttura eliminata');
    } catch (err) {
      toast.error(`Errore eliminazione: ${err.message}`);
    }
  };

  const handleQuestionnaireSave = async (p) => {
    try {
      await questionnaireService.upsert(p);
      close('questionnaire');
      await invalidate.questionnaires(year);
      toast.success('Questionario salvato');
    } catch (err) {
      toast.error(`Errore DB: ${err.message}`);
    }
  };

  const handleDataClick = (facility, type) => {
    const hasData = data.surveys.some(s =>
      s.type === type &&
      (s.facility_id === facility.id || (!s.facility_id && s.company_id === facility.company_id))
    );
    setDataTarget({ facility, type });
    open(hasData ? 'analytics' : 'dataImport');
  };

  const handleNavigate = (page) => {
    const actions = {
      saturazione:  () => navigate('/occupazione'),
      haccp:        () => navigate('/master'),
      documenti:    () => navigate('/documenti'),
      nc:           () => open('qualityDashboard'),
      report:       () => navigate('/report'),
      impostazioni: () => navigate('/impostazioni'),
    };
    actions[page]?.();
  };

  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50 font-black text-slate-400 uppercase tracking-[0.2em]">
        Caricamento...
      </div>
    );
  }
  if (!session) { return <Login />; }

  return (
    <div className="min-h-screen bg-slate-100 pb-10 text-slate-900 font-sans">
      <Toaster position="top-right" />

      {/* ── AppHeader ── */}
      <AppHeader
        activePage="dashboard"
        badgeCounts={badgeTotals}
        user={profile}
        onSignOut={signOut}
        onNavigate={handleNavigate}
      />

      {/* ── Context bar + Toolbar (unica riga) ── */}
      <div className="flex items-center px-5 py-2 bg-white border-b border-slate-200 gap-4">

        {/* SINISTRA — titolo fisso */}
        <div className="flex-shrink-0">
          <h1 className="text-sm font-semibold text-slate-900 whitespace-nowrap">Dashboard strutture</h1>
          <p className="text-[11px] text-slate-500">
            {year} · {processedData.list.filter(f => !f.is_suspended).length} attive · {processedData.list.filter(f => f.is_suspended).length} sospese
          </p>
        </div>

        {/* CENTRO — filtri centrati */}
        <div className="flex-1 flex items-center justify-center gap-2 flex-nowrap">

          {/* Ricerca */}
          <div className="flex items-center gap-1.5 border border-slate-200 rounded-full px-3 py-1.5 bg-slate-50 w-44 flex-shrink-0">
            <Search size={13} className="text-slate-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Cerca struttura..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-transparent text-xs outline-none w-full text-slate-700 placeholder-slate-300"
            />
          </div>

          {/* UDO */}
          <div className="relative flex-shrink-0">
            <Building2 size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <select
              value={filterUdo}
              onChange={e => setFilterUdo(e.target.value)}
              className="border border-slate-200 rounded-full pl-8 pr-6 py-1.5 text-xs text-slate-500 bg-slate-50 appearance-none cursor-pointer outline-none whitespace-nowrap"
            >
              <option value="all">Tutte le UDO</option>
              {data.udos.map(u => (
                <option key={u.id} value={String(u.id)}>{u.name}</option>
              ))}
            </select>
            <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* FILTRO REGIONE — multi-select */}
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setRegionDropdownOpen(prev => !prev)}
              className={`flex items-center gap-1.5 border rounded-full px-3 py-1.5 text-xs whitespace-nowrap transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 ${
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
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setRegionDropdownOpen(false)}
                />
                <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-sm z-20 min-w-[160px] py-1 overflow-hidden">
                  <button
                    onClick={() => { setSelectedRegions([]); setRegionDropdownOpen(false); }}
                    className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                      selectedRegions.length === 0
                        ? 'text-emerald-600 font-medium bg-emerald-50'
                        : 'text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    Tutte le regioni
                  </button>
                  <div className="h-px bg-slate-100 my-1" />
                  {availableRegions.map(region => (
                    <button
                      key={region}
                      onClick={() => {
                        setSelectedRegions(prev =>
                          prev.includes(region)
                            ? prev.filter(r => r !== region)
                            : [...prev, region]
                        );
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors ${
                        selectedRegions.includes(region)
                          ? 'text-emerald-700 bg-emerald-50'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${
                        selectedRegions.includes(region)
                          ? 'bg-emerald-600 border-emerald-600'
                          : 'border-slate-300'
                      }`}>
                        {selectedRegions.includes(region) && (
                          <Check size={9} className="text-white" />
                        )}
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
            onClick={() => {
              if (showSocieta) setSelectedCompany(null);
              setShowSocieta(prev => !prev);
            }}
            className={`flex items-center gap-1.5 border rounded-full px-3 py-1.5 text-xs whitespace-nowrap flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 ${
              showSocieta
                ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                : 'bg-slate-50 border-slate-200 text-slate-500'
            }`}
          >
            <Briefcase size={12} /> Società
          </button>

          {selectedCompany && !showSocieta && (
            <div className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full text-xs font-medium text-emerald-700 flex-shrink-0">
              {selectedCompany.name}
              <button onClick={() => setSelectedCompany(null)} className="ml-0.5 hover:text-red-600 leading-none">✕</button>
            </div>
          )}

          {/* Sospese */}
          <button
            onClick={() => setShowSuspended(prev => !prev)}
            className={`flex items-center gap-1.5 border rounded-full px-3 py-1.5 text-xs whitespace-nowrap flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 ${
              showSuspended
                ? 'bg-amber-50 border-amber-300 text-amber-600'
                : 'bg-slate-50 border-slate-200 text-slate-500'
            }`}
          >
            <Pause size={12} /> Sospese
          </button>

          {/* Density */}
          <div className="flex border border-slate-200 rounded overflow-hidden flex-shrink-0">
            {[
              { cls: 'lg:grid-cols-4', Icon: Grid2X2    },
              { cls: 'lg:grid-cols-6', Icon: Grid3X3    },
              { cls: 'lg:grid-cols-8', Icon: LayoutGrid },
            ].map(({ cls, Icon }) => (
              <button
                key={cls}
                onClick={() => setGridCols(cls)}
                className={`p-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 ${gridCols === cls ? 'bg-emerald-600 text-white' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
              >
                <Icon size={13} />
              </button>
            ))}
          </div>

        </div>

        {/* DESTRA — + Struttura */}
        {isAdmin && (
          <div className="flex-shrink-0">
            <button
              onClick={() => { setSelectedFacility(null); open('facility'); }}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-full px-4 py-1.5 whitespace-nowrap transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1"
            >
              <Plus size={13} /> Struttura
            </button>
          </div>
        )}

      </div>

      {/* ── KPI Strip ── */}
      <div className="flex items-center justify-between px-5 py-1.5 bg-slate-50 border-b border-slate-200">

        {/* SINISTRA — posti letto */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Posti letto attivi</span>
          <span className="text-sm font-semibold text-slate-800">{processedData.totalBeds}</span>
        </div>

        {/* DESTRA — semafori */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSemaforoFilter(prev => prev === 'low' ? null : 'low')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 ${
              semaforoFilter === 'low'
                ? 'bg-emerald-200 text-emerald-800 ring-1 ring-emerald-400'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
            {processedData.countLow} ok
          </button>
          <button
            onClick={() => setSemaforoFilter(prev => prev === 'medium' ? null : 'medium')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 ${
              semaforoFilter === 'medium'
                ? 'bg-amber-200 text-amber-800 ring-1 ring-amber-400'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
            {processedData.countMedium} att.
          </button>
          <button
            onClick={() => setSemaforoFilter(prev => prev === 'high' ? null : 'high')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 ${
              semaforoFilter === 'high'
                ? 'bg-red-200 text-red-800 ring-1 ring-red-400'
                : 'bg-red-50 text-red-700 hover:bg-red-100'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
            {processedData.countHigh} critici
          </button>
          <button
            onClick={() => setSemaforoFilter(prev => prev === 'suspended' ? null : 'suspended')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 ${
              semaforoFilter === 'suspended'
                ? 'bg-slate-200 text-slate-700 ring-1 ring-slate-400'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-slate-400 flex-shrink-0" />
            {processedData.countSuspended} sosp.
          </button>
        </div>

      </div>

      {/* ── Main ── */}
      <main className="px-6 py-4">
        {dataLoading ? (
          <div className="flex items-center justify-center py-32 text-slate-400 font-black uppercase tracking-widest">
            Caricamento strutture...
          </div>
        ) : showSocieta ? (
          <CompaniesView
            companies={data.companies}
            facilities={data.facilities}
            onSelectCompany={(company) => {
              setSelectedCompany(company);
              setShowSocieta(false);
            }}
          />
        ) : (
          <>
            {/* Strutture sospese */}
            {facilitiesByRegion.suspended.length > 0 && (
              <section className="mb-6 bg-amber-50 rounded-xl p-4 border border-amber-100">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Strutture sospese</span>
                  <span className="text-[10px] text-amber-500">({facilitiesByRegion.suspended.length})</span>
                </div>
                <div className={`grid gap-3 ${
                  gridCols === 'lg:grid-cols-4' ? 'grid-cols-4' :
                  gridCols === 'lg:grid-cols-6' ? 'grid-cols-5' :
                  'grid-cols-6'
                }`}>
                  {facilitiesByRegion.suspended.map(f => (
                    <div key={f.id} className="opacity-60">
                      <FacilityCard
                        f={f}
                        onEdit={() => {
                          const fresh = data.facilities.find(x => x.id === f.id) || f;
                          setSelectedFacility(fresh);
                          open('facility');
                        }}
                        onDirectorView={isAdmin ? handleDirectorView : undefined}
                        onHaccpClick={handleHaccpClick}
                        onSuspendToggle={handleSuspendToggle}
                        onKpiClick={(facility) => { setSelectedFacility(facility); open('kpiManager'); }}
                        onDataClick={handleDataClick}
                        isAdmin={['superadmin','admin','sede'].includes(profile?.role)}
                        kpiRecords={data.kpiRecords}
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Strutture per regione */}
            {facilitiesByRegion.regionEntries.map(([region, facs]) => {
              const rVerde  = facs.filter(f => f.riskLevel === 'low').length;
              const rGiallo = facs.filter(f => f.riskLevel === 'medium').length;
              const rRosso  = facs.filter(f => f.riskLevel === 'high').length;

              return (
                <section key={region} className="mb-6">
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{region}</span>
                    <span className="text-[10px] text-slate-500">({facs.length})</span>
                    {rVerde  > 0 && <span className="text-[9px] bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full px-1.5 py-0.5 leading-none">{rVerde} ok</span>}
                    {rGiallo > 0 && <span className="text-[9px] bg-amber-50 text-amber-600 border border-amber-200 rounded-full px-1.5 py-0.5 leading-none">{rGiallo} att.</span>}
                    {rRosso  > 0 && <span className="text-[9px] bg-red-50 text-red-600 border border-red-200 rounded-full px-1.5 py-0.5 leading-none">{rRosso} crit.</span>}
                  </div>
                  <div className={`grid gap-3 ${
                    gridCols === 'lg:grid-cols-4' ? 'grid-cols-4' :
                    gridCols === 'lg:grid-cols-6' ? 'grid-cols-5' :
                    'grid-cols-6'
                  }`}>
                    {facs.map(f => (
                      <FacilityCard
                        key={f.id}
                        f={f}
                        onEdit={() => {
                          const fresh = data.facilities.find(x => x.id === f.id) || f;
                          setSelectedFacility(fresh);
                          open('facility');
                        }}
                        onDirectorView={isAdmin ? handleDirectorView : undefined}
                        onHaccpClick={handleHaccpClick}
                        onSuspendToggle={handleSuspendToggle}
                        onKpiClick={(facility) => { setSelectedFacility(facility); open('kpiManager'); }}
                        onDataClick={handleDataClick}
                        isAdmin={['superadmin','admin','sede'].includes(profile?.role)}
                        kpiRecords={data.kpiRecords}
                      />
                    ))}
                  </div>
                </section>
              );
            })}

            {/* Empty state */}
            {facilitiesByRegion.regionEntries.length === 0 && facilitiesByRegion.suspended.length === 0 && (
              <div className="flex items-center justify-center py-24 text-slate-400 text-sm">
                Nessuna struttura trovata
              </div>
            )}
          </>
        )}
      </main>

      <FacilityModal
        isOpen={modals.facility}
        onClose={() => close('facility')}
        udos={data.udos}
        facility={selectedFacility}
        onSave={handleFacilitySave}
        onDelete={handleFacilityDelete}
      />
      <QuestionnaireModal
        isOpen={modals.questionnaire}
        onClose={() => close('questionnaire')}
        info={selectedFacility}
        year={year}
        questionnaires={data.questionnaires}
        onSave={handleQuestionnaireSave}
      />
      {selectedFacility && (
        <KpiManagerModal
          key={`kpi-${selectedFacility.id}`}
          isOpen={modals.kpiManager}
          onClose={() => close('kpiManager')}
          facility={selectedFacility}
          year={year}
          onUpdateSuccess={() => invalidate.kpiRecords(year)}
        />
      )}
      {dataTarget && (
        <>
          <DataImportModal
            isOpen={modals.dataImport}
            onClose={() => close('dataImport')}
            facility={dataTarget.facility}
            type={dataTarget.type}
            year={year}
            onUploadSuccess={() => invalidate.surveys(year)}
          />
          <AnalyticsModal
            isOpen={modals.analytics}
            onClose={() => close('analytics')}
            facility={dataTarget.facility}
            type={dataTarget.type}
            surveys={data.surveys}
            facilities={data.facilities}
            udos={data.udos}
            onOpenImport={() => { close('analytics'); open('dataImport'); }}
            onUpdateSuccess={() => invalidate.surveys(year)}
          />
        </>
      )}
      <KpiChartsModal
        isOpen={modals.kpiCharts}
        onClose={() => close('kpiCharts')}
        facilities={data.facilities}
        udos={data.udos}
        kpiRecords={data.kpiRecords}
        year={Number(year)}
      />
      <GlobalReportModal
        isOpen={modals.globalReport}
        onClose={() => close('globalReport')}
        facilities={data.facilities}
        udos={data.udos}
        surveys={data.surveys}
        kpiRecords={data.kpiRecords}
        year={Number(year)}
      />
      <KpiDashboardModal
        isOpen={modals.kpiDashboard}
        onClose={() => close('kpiDashboard')}
        facilities={data.facilities}
        kpiRecords={data.kpiRecords}
        year={Number(year)}
      />
      <KpiHubModal
        isOpen={modals.kpiHub}
        onClose={() => close('kpiHub')}
        onSelect={(view) => { close('kpiHub'); open(view); }}
      />
      <KpiLaserModal
        isOpen={modals.kpiLaser}
        onClose={() => close('kpiLaser')}
        facilities={data.facilities}
        udos={data.udos}
        kpiRecords={data.kpiRecords}
        year={Number(year)}
      />
      <KpiXrayModal
        isOpen={modals.kpiXray}
        onClose={() => close('kpiXray')}
        facilities={data.facilities}
        kpiRecords={data.kpiRecords}
        year={Number(year)}
      />
      <QualityDashboardModal
        isOpen={modals.qualityDashboard}
        onClose={() => close('qualityDashboard')}
        facilities={data.facilities}
        udos={data.udos}
        kpiRecords={data.kpiRecords}
        surveys={data.surveys}
        year={Number(year)}
        isSuperAdmin={profile?.role === 'superadmin'}
      />
      <RankingModal
        isOpen={modals.ranking}
        onClose={() => close('ranking')}
        facilities={processedData.list}
        kpiRecords={data.kpiRecords}
      />
    </div>
  );
}
