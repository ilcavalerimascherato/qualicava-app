// src/App.js
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import {
  Settings, LogOut, ShieldCheck,
  Search, Grid2X2, Grid3X3, LayoutGrid, FileSignature, BarChart2, PawPrint
} from 'lucide-react';

import { useAuth }                                           from './contexts/AuthContext';
import { useModals }                                         from './contexts/ModalContext';
import { useDashboardData, useInvalidate }                   from './hooks/useDashboardData';
import { facilityService, questionnaireService, udoService } from './services/supabaseService';
import { enrichFacilitiesData, calculateDashboardStats }     from './utils/statusCalculator';

import Login              from './Login';
import FacilityCard       from './components/FacilityCard';
import GlobalReportModal  from './components/GlobalReportModal';
import UdoManagerModal    from './components/UdoManagerModal';
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
import QualityDashboardModal from './components/QualityDashboardModal';

export default function App() {
  const { session, loading: authLoading, isAdmin, profile, signOut } = useAuth();
  const { modals, open, close } = useModals();
  const navigate   = useNavigate();
  const invalidate = useInvalidate();

  const [year]                                  = useState(new Date().getFullYear());
  const [showSuspended, setShowSuspended]       = useState(false);
  const [gridCols, setGridCols]                 = useState('lg:grid-cols-4');
  const [filterUdo, setFilterUdo]               = useState('all');
  const [filterStatus, setFilterStatus]         = useState('all');
  const [searchQuery, setSearchQuery]           = useState('');
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [dataTarget, setDataTarget]             = useState(null);

  const { loading: dataLoading, data, errors } = useDashboardData(year);

  useEffect(() => {
    errors.forEach(msg => toast.error(`Errore dati: ${msg}`, { id: msg }));
  }, [errors]);

  const processedData = useMemo(() => {
    const enriched = enrichFacilitiesData(data.facilities, data.surveys, data.kpiRecords, year, data.udos);
    const stats    = calculateDashboardStats(enriched, 'all');
    return { list: enriched, ...stats };
  }, [data.facilities, data.surveys, data.kpiRecords, data.udos, year]);

  const filteredFacilities = useMemo(() => {
    return processedData.list.filter(f => {
      if (!showSuspended && f.is_suspended) { return false; }
      if (!f.name.toLowerCase().includes(searchQuery.toLowerCase())) { return false; }
      if (filterUdo !== 'all' && String(f.udo_id) !== String(filterUdo)) { return false; }
      if (filterStatus === 'completed' && !f.isGreen)  { return false; }
      if (filterStatus === 'progress'  && !f.isYellow) { return false; }
      if (filterStatus === 'todo'      && !f.isRed)    { return false; }
      return true;
    });
  }, [processedData.list, filterUdo, filterStatus, searchQuery, showSuspended]);

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

  const handleFacilitySave = async (d) => {
    try {
      // Restituisce il record salvato con l'ID (necessario per il provisioning direttore)
      const saved = await facilityService.save(d);
      await invalidate.facilities();
      close('facility');
      setSelectedFacility(null);
      toast.success('Struttura salvata');
      return saved; // FacilityModal usa l'ID per creare l'account direttore
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

  const handleUdoSave = async (d) => {
    try {
      await udoService.save(d);
      await invalidate.udos();
    } catch (err) {
      toast.error(`Errore salvataggio UDO: ${err.message}`);
    }
  };

  const handleUdoDelete = async (id) => {
    if (!window.confirm('Eliminare questa UDO?')) { return; }
    try {
      await udoService.delete(id);
      await invalidate.udos();
    } catch (err) {
      toast.error(`Errore eliminazione UDO: ${err.message}`);
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

      <header className="bg-white border-b border-slate-200 px-6 py-3 sticky top-0 z-30 shadow-md">

        {/* ── RIGA 1: verde emerald ── */}
        <div className="flex justify-between items-center mb-3">

          <div className="flex items-center gap-3">
            <div className="bg-emerald-600 p-2 rounded-xl text-white">
              <PawPrint size={22} />
            </div>
            <h1 className="text-lg font-black tracking-tighter text-slate-900 italic">
              QualiCAVA <span className="text-emerald-600 italic">GRUPPO OVER</span>
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => open('globalReport')}
              className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase shadow hover:bg-emerald-700 transition-colors flex items-center gap-2"
            >
              <FileSignature size={14} /> Report
            </button>

            <button
              onClick={() => open('qualityDashboard')}
              className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase shadow hover:bg-emerald-700 transition-colors flex items-center gap-2"
            >
              <ShieldCheck size={14} /> Qualità
            </button>

            <button
              onClick={() => open('kpiHub')}
              className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase shadow hover:bg-emerald-700 transition-colors flex items-center gap-2"
            >
              <BarChart2 size={14} /> KPI
            </button>

            {isAdmin && (
              <button
                onClick={() => { setSelectedFacility(null); open('facility'); }}
                className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase shadow hover:bg-emerald-700 transition-colors flex items-center gap-2"
              >
                + Struttura
              </button>
            )}

            {isAdmin && (
              <button
                onClick={() => open('udo')}
                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                title="Gestione UDO"
              >
                <Settings size={20} />
              </button>
            )}

            {/* Nome utente loggato */}
            {profile?.full_name && (
              <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                <div className="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center text-white font-black text-[10px]">
                  {profile.full_name[0].toUpperCase()}
                </div>
                <span className="text-xs font-bold text-slate-700 max-w-[120px] truncate">
                  {profile.full_name}
                </span>
              </div>
            )}

            <button
              onClick={signOut}
              className="flex items-center gap-1.5 text-rose-500 hover:text-rose-700 px-3 py-2 hover:bg-rose-50 rounded-xl transition-colors text-xs font-black uppercase"
              title="Esci"
            >
              <LogOut size={16} /> Esci
            </button>
          </div>
        </div>

        {/* ── RIGA 2: blu/slate ── */}
        <div className="flex justify-between items-center bg-slate-900 rounded-2xl px-5 py-3">
          <div className="flex items-center gap-6 grow max-w-6xl">
            <div className="relative flex-1">
              <Search size={20} className="absolute left-4 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Cerca struttura..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full text-[16px] font-bold bg-slate-800 text-white pl-14 pr-4 py-3 rounded-2xl border-2 border-slate-700 outline-none focus:border-indigo-400 transition-all placeholder-slate-400"
              />
            </div>
            <select
              value={filterUdo}
              onChange={e => setFilterUdo(e.target.value)}
              className="text-sm font-black bg-slate-800 text-white px-4 py-3 rounded-2xl border-2 border-slate-700 uppercase outline-none cursor-pointer"
            >
              <option value="all">Tutte le UDO</option>
              {data.udos.map(u => (
                <option key={u.id} value={String(u.id)}>{u.name}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="text-sm font-black bg-slate-800 text-white px-4 py-3 rounded-2xl border-2 border-slate-700 uppercase outline-none cursor-pointer"
            >
              <option value="all">Tutti ({processedData.counts.all})</option>
              <option value="todo">⚪ Da iniziare ({processedData.counts.todo})</option>
              <option value="progress">🟣 In corso ({processedData.counts.progress})</option>
              <option value="completed">🟢 Completati ({processedData.counts.completed})</option>
            </select>
          </div>

          {/* Progress bar report — ora nella barra filtri, responsive */}
          <div className="flex items-center gap-4 px-2">
            {[
              { label: 'Clienti', pct: processedData.clientPct },
              { label: 'Staff',   pct: processedData.staffPct  },
            ].map(({ label, pct }) => (
              <div key={label} className="flex flex-col items-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{label}</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${pct || 0}%` }} />
                  </div>
                  <span className="text-xs font-black text-white">{pct || 0}%</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 bg-slate-800 border border-slate-700 px-4 py-3 rounded-2xl ml-2">
            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest leading-tight text-right">
              Posti Letto<br />Attivi
            </span>
            <span className="text-3xl font-black text-white">{processedData.totalBeds}</span>
          </div>

          {/* Checkbox sospese — seconda riga dopo posti letto */}
          <label className="flex items-center gap-2 bg-slate-800 border border-slate-700 px-4 py-3 rounded-2xl ml-2 cursor-pointer hover:bg-slate-700 transition-colors">
            <input
              type="checkbox"
              checked={showSuspended}
              onChange={e => setShowSuspended(e.target.checked)}
              className="accent-emerald-500 w-4 h-4 cursor-pointer"
            />
            <span className="text-xs font-black text-slate-300 uppercase tracking-widest">Sospese</span>
          </label>

          <div className="flex items-center gap-2 bg-slate-800 p-2 rounded-2xl ml-2">
            {[
              { cols: 'lg:grid-cols-4', Icon: Grid2X2    },
              { cols: 'lg:grid-cols-6', Icon: Grid3X3    },
              { cols: 'lg:grid-cols-8', Icon: LayoutGrid },
            ].map(({ cols, Icon }) => (
              <button
                key={cols}
                onClick={() => setGridCols(cols)}
                className={`p-2 rounded-xl transition-all ${gridCols === cols ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
              >
                <Icon size={24} />
              </button>
            ))}
          </div>
        </div>{/* fine riga 2 */}
      </header>

      <main className="px-10 py-12">
        {dataLoading ? (
          <div className="flex items-center justify-center py-32 text-slate-400 font-black uppercase tracking-widest">
            Caricamento strutture...
          </div>
        ) : (
          <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 ${gridCols} gap-10`}>
            {filteredFacilities.map(f => (
              <FacilityCard
                key={f.id}
                f={f}
                gridCols={gridCols}
                onEdit={() => {
                  // Legge sempre dalla lista aggiornata per evitare dati stale
                  const fresh = data.facilities.find(x => x.id === f.id) || f;
                  setSelectedFacility(fresh);
                  open('facility');
                }}
                onDirectorView={isAdmin ? handleDirectorView : undefined}
                onSuspendToggle={handleSuspendToggle}
                onKpiClick={(facility) => { setSelectedFacility(facility); open('kpiManager'); }}
                onDataClick={handleDataClick}
              />
            ))}
          </div>
        )}
      </main>

      <UdoManagerModal
        isOpen={modals.udo}
        onClose={() => close('udo')}
        udos={data.udos}
        onSave={handleUdoSave}
        onDelete={handleUdoDelete}
      />
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
    </div>
  );
}
