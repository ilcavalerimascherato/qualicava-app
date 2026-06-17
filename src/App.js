// src/App.js
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import {
  Search, Grid2X2, Grid3X3, LayoutGrid,
  Building2, Briefcase, Pause, Plus, ChevronDown, ChevronUp,
} from 'lucide-react';

import { useAuth }                                           from './contexts/AuthContext';
import { useModals }                                         from './contexts/ModalContext';
import { useDashboardData, useInvalidate }                   from './hooks/useDashboardData';
import { useHaccpSemafori }                                  from './hooks/useHaccpData';
import { useBadgeCounts }                                    from './hooks/useBadgeCounts';
import { facilityService, questionnaireService } from './services/supabaseService';
import { getDocumentiInScadenza }                            from './services/documentiService';
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
  const [docScadenze, setDocScadenze]           = useState({ docs: [], scaduti: 0 });
  const [semaforoFilter, setSemaforoFilter]     = useState(null);
  const [kpiStripOpen, setKpiStripOpen]         = useState(true);

  const { loading: dataLoading, data, errors } = useDashboardData(year);
  const { semafori: haccpSemafori }            = useHaccpSemafori();

  useEffect(() => {
    errors.forEach(msg => toast.error(`Errore dati: ${msg}`, { id: msg }));
  }, [errors]);

  useEffect(() => {
    if (!['superadmin', 'admin'].includes(profile?.role)) return;
    getDocumentiInScadenza(90).then(setDocScadenze).catch(() => {});
  }, [profile?.role]);

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
      return true;
    });
  }, [processedData.list, filterUdo, searchQuery, showSuspended, selectedCompany, semaforoFilter]);

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
          <p className="text-[11px] text-slate-400">
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

          {/* Società */}
          <button
            onClick={() => {
              if (showSocieta) setSelectedCompany(null);
              setShowSocieta(prev => !prev);
            }}
            className={`flex items-center gap-1.5 border rounded-full px-3 py-1.5 text-xs whitespace-nowrap flex-shrink-0 ${
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
            className={`flex items-center gap-1.5 border rounded-full px-3 py-1.5 text-xs whitespace-nowrap flex-shrink-0 ${
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
                className={`p-1.5 ${gridCols === cls ? 'bg-emerald-600 text-white' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
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
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-full px-4 py-1.5 whitespace-nowrap transition-colors"
            >
              <Plus size={13} /> Struttura
            </button>
          </div>
        )}

      </div>

      {/* ── KPI Strip ── */}
      {kpiStripOpen ? (
        <div className="flex items-center px-5 py-1.5 bg-slate-50 border-b border-slate-200 text-xs flex-nowrap">
          <div className="flex items-center gap-2 pr-4 mr-4 border-r border-slate-200">
            <span className="text-slate-400">Posti letto attivi</span>
            <span className="font-bold text-slate-800">{processedData.totalBeds}</span>
          </div>
          <div className="flex items-center gap-2 pr-4 mr-4 border-r border-slate-200">
            <span className="text-slate-400">Survey clienti</span>
            <div className="flex items-center gap-1.5">
              <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 transition-all" style={{ width: `${processedData.clientPct || 0}%` }} />
              </div>
              <span className="font-bold text-slate-700 tabular-nums">{processedData.clientPct || 0}%</span>
            </div>
          </div>
          <div className="flex items-center gap-2 pr-4 mr-4 border-r border-slate-200">
            <span className="text-slate-400">Survey staff</span>
            <div className="flex items-center gap-1.5">
              <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 transition-all" style={{ width: `${processedData.staffPct || 0}%` }} />
              </div>
              <span className="font-bold text-slate-700 tabular-nums">{processedData.staffPct || 0}%</span>
            </div>
          </div>
          {['superadmin', 'admin'].includes(profile?.role) && (
            <button
              onClick={() => navigate('/documenti')}
              className="flex items-center gap-2 pr-4 mr-4 border-r border-slate-200 hover:text-indigo-600 transition-colors"
            >
              <span className="text-slate-400">DocuMaster</span>
              {docScadenze.scaduti === 0 && docScadenze.docs.length === 0 ? (
                <span className="font-bold text-emerald-600">✓ ok</span>
              ) : (
                <div className="flex items-center gap-1">
                  {docScadenze.scaduti > 0 && (
                    <span className="bg-red-100 text-red-700 text-[10px] font-semibold px-1.5 py-0.5 rounded">
                      {docScadenze.scaduti} scad.
                    </span>
                  )}
                  {(docScadenze.docs.length - docScadenze.scaduti) > 0 && (
                    <span className="bg-amber-100 text-amber-700 text-[10px] font-semibold px-1.5 py-0.5 rounded">
                      {docScadenze.docs.length - docScadenze.scaduti} in sc.
                    </span>
                  )}
                </div>
              )}
            </button>
          )}
          <div className="flex items-center gap-2">
            <span className="text-slate-400">NC aperte</span>
            <span className="font-bold text-red-600 tabular-nums">{badgeTotals.nc}</span>
          </div>

          {/* SEMAFORI — destra */}
          <div className="flex-1 flex items-center justify-end gap-2 mr-3">
            <button
              onClick={() => setSemaforoFilter(prev => prev === 'low' ? null : 'low')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
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
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
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
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
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
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                semaforoFilter === 'suspended'
                  ? 'bg-slate-200 text-slate-700 ring-1 ring-slate-400'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-slate-400 flex-shrink-0" />
              {processedData.countSuspended} sosp.
            </button>
          </div>

          <button
            onClick={() => setKpiStripOpen(false)}
            className="text-slate-400 flex items-center gap-1 text-[10px] hover:text-slate-600 flex-shrink-0"
          >
            <ChevronUp size={10} /> comprimi
          </button>
        </div>
      ) : (
        <button
          onClick={() => setKpiStripOpen(true)}
          className="w-full text-center text-[10px] text-slate-400 py-0.5 bg-slate-50 border-b border-slate-200 hover:bg-slate-100 transition-colors"
        >
          ▼ mostra KPI
        </button>
      )}

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
                    <span className="text-[10px] text-slate-400">({facs.length})</span>
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
