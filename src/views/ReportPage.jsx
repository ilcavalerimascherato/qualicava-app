// src/views/ReportPage.jsx
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { FileText, Trophy, BarChart2, TrendingUp, Building2, Search, ChevronRight, LayoutGrid, LineChart, Smile, ShieldAlert, Wallet } from 'lucide-react';
import { useAuth }                from '../contexts/AuthContext';
import { useDashboardData }      from '../hooks/useDashboardData';
import { useBadgeCounts }        from '../hooks/useBadgeCounts';
import { enrichFacilitiesData }  from '../utils/statusCalculator';
import { calcFacilityRiskScore } from '../utils/riskScoreEngine';
import AppHeader                 from '../components/AppHeader';
import AiBriefing                from '../components/AiBriefing';
import GlobalReportModal         from '../components/GlobalReportModal';
import RankingModal              from '../components/RankingModal';
import KpiChartsModal            from '../components/KpiChartsModal';
import KpiLaserModal             from '../components/KpiLaserModal';
import KpiXrayModal              from '../components/KpiXrayModal';
import KpiAnalisiComparativa     from '../components/KpiAnalisiComparativa';
import CruscottoView             from '../components/cruscotto/CruscottoView';
import KpiEconomicsView          from '../components/kpieconomics/KpiEconomicsView';
import EconomicoView             from '../components/economico/EconomicoView';
import SoddisfazioneView         from '../components/soddisfazione/SoddisfazioneView';
import ConformitaRischioView     from '../components/conformita/ConformitaRischioView';

const CURRENT_YEAR = new Date().getFullYear();

function ReportCard({ icon, iconBg, iconColor, title, desc, onClick, accent, badge, footerLabel, compact = false }) {
  return (
    <div
      onClick={onClick}
      className={`bg-white border rounded-2xl ${compact ? 'p-4' : 'p-6'} flex flex-col gap-3 cursor-pointer hover:border-slate-300 transition-colors ${
        accent ? 'border-blue-300' : 'border-slate-200'
      }`}
    >
      <div
        className={`${compact ? 'w-10 h-10 rounded-xl' : 'w-14 h-14 rounded-2xl'} flex items-center justify-center flex-shrink-0`}
        style={{ background: iconBg }}
      >
        <span style={{ color: iconColor }}>{icon}</span>
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          {badge && (
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-medium">
              {badge}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
      </div>
      <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-100">
        <span className="text-xs text-slate-400">{footerLabel ?? ''}</span>
        <ChevronRight size={14} className="text-slate-300" />
      </div>
    </div>
  );
}

export default function ReportPage() {
  const navigate                         = useNavigate();
  const { isAdmin, can, profile, signOut } = useAuth();
  const [year]                           = useState(CURRENT_YEAR);
  const { data }                         = useDashboardData(year);
  const [activeModal, setActiveModal]    = useState(null);
  const [dateRange, setDateRange]        = useState({
    from: `${CURRENT_YEAR - 1}-01`,
    to:   `${CURRENT_YEAR}-12`,
  });

  const [activeTab, setActiveTab] = useState('cruscotto');

  // Tutte le sezioni di /report (non solo il Cruscotto): sede/admin/superadmin
  // e ora anche 'board' (permesso dedicato 'viewReportSections', separato da
  // 'manageStructures' che resta solo per le route HQ vere e proprie — board
  // non deve ottenere accidentalmente altri permessi di gestione struttura).
  const hasAnalisiDettagliata = can('viewReportSections');

  const allIds = useMemo(
    () => (data.facilities ?? []).filter(f => !f.is_suspended).map(f => f.id),
    [data.facilities],
  );
  // Board non mostra badge nella nav (vede solo "Report") — evita query inutili.
  const { totals: badgeTotals } = useBadgeCounts(hasAnalisiDettagliata ? allIds : [], year, isAdmin);

  const enrichedFacilities = useMemo(() => {
    const enriched = enrichFacilitiesData(
      data.facilities ?? [],
      data.surveys    ?? [],
      data.kpiRecords ?? [],
      year,
      data.udos       ?? [],
    );
    return enriched.map(f => {
      const risk = calcFacilityRiskScore(f, data.kpiRecords ?? []);
      return { ...f, riskScore: risk, riskLevel: risk.level };
    });
  }, [data.facilities, data.surveys, data.kpiRecords, data.udos, year]);

  const handleNavigate = (page) => {
    const routes = {
      dashboard:    '/admin',
      saturazione:  '/occupazione',
      haccp:        '/master',
      documenti:    '/documenti',
      nc:           '/non-conformita',
      verifiche:    '/verifiche',
      verbali:      '/verbali-ispettivi',
      impostazioni: '/impostazioni',
    };
    navigate(routes[page] ?? '/admin');
  };

  const closeModal = () => setActiveModal(null);

  return (
    <div className="min-h-screen bg-slate-100 pb-10 text-slate-900 font-sans">
      <Toaster position="top-right" />

      <AppHeader
        activePage="report"
        badgeCounts={badgeTotals}
        user={profile}
        onSignOut={signOut}
        onNavigate={handleNavigate}
      />

      {/* ── Tab bar ── */}
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-slate-100">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('cruscotto')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'cruscotto' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <LayoutGrid size={14} /> Cruscotto
          </button>
          {hasAnalisiDettagliata && (
            <button
              onClick={() => setActiveTab('kpiEconomics')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'kpiEconomics' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <LineChart size={14} /> KPI & Economics
            </button>
          )}
          {hasAnalisiDettagliata && (
            <button
              onClick={() => setActiveTab('economico')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'economico' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <Wallet size={14} /> Economico
            </button>
          )}
          {hasAnalisiDettagliata && (
            <button
              onClick={() => setActiveTab('soddisfazione')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'soddisfazione' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <Smile size={14} /> Soddisfazione
            </button>
          )}
          {hasAnalisiDettagliata && (
            <button
              onClick={() => setActiveTab('conformita')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'conformita' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <ShieldAlert size={14} /> Conformità & Rischio
            </button>
          )}
          {hasAnalisiDettagliata && (
            <button
              onClick={() => setActiveTab('analisi')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'analisi' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <Search size={14} /> Analisi dettagliata
            </button>
          )}
        </div>
        {activeTab === 'analisi' && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Intervallo:</span>
            <input
              type="month"
              value={dateRange.from}
              onChange={e => setDateRange(prev => ({ ...prev, from: e.target.value }))}
              className="border border-slate-200 rounded px-2 py-1 text-xs outline-none focus:border-emerald-400"
            />
            <span className="text-xs text-slate-500">→</span>
            <input
              type="month"
              value={dateRange.to}
              onChange={e => setDateRange(prev => ({ ...prev, to: e.target.value }))}
              className="border border-slate-200 rounded px-2 py-1 text-xs outline-none focus:border-emerald-400"
            />
          </div>
        )}
      </div>

      {/* ── Body ── */}
      <main className="px-6 py-6 max-w-6xl mx-auto">

        {activeTab === 'cruscotto' && (
          <CruscottoView
            facilities={data.facilities}
            companies={data.companies}
            udos={data.udos}
            surveys={data.surveys}
            kpiRecords={data.kpiRecords}
            nonConformities={data.nonConformities}
            campaignsClient={data.campaignsClient}
            year={year}
            // Le destinazioni di drill-down (/admin, /non-conformita, /occupazione)
            // sono vere route HQ protette da manageStructures (non da
            // viewReportSections): board le vede nel Cruscotto ma non deve
            // ottenere link che poi la guardia di route rimbalza indietro.
            onNavigate={can('manageStructures') ? handleNavigate : undefined}
          />
        )}

        {activeTab === 'kpiEconomics' && hasAnalisiDettagliata && (
          <KpiEconomicsView
            facilities={data.facilities}
            companies={data.companies}
            udos={data.udos}
            kpiRecords={data.kpiRecords}
            campaignsClient={data.campaignsClient}
            year={year}
          />
        )}

        {activeTab === 'economico' && hasAnalisiDettagliata && (
          <EconomicoView year={year} />
        )}

        {activeTab === 'soddisfazione' && hasAnalisiDettagliata && (
          <SoddisfazioneView
            facilities={data.facilities}
            companies={data.companies}
            udos={data.udos}
            campaignsClient={data.campaignsClient}
            campaignsOperator={data.campaignsOperator}
          />
        )}

        {activeTab === 'conformita' && hasAnalisiDettagliata && (
          <ConformitaRischioView
            facilities={data.facilities}
            companies={data.companies}
            udos={data.udos}
            nonConformities={data.nonConformities}
          />
        )}

        {activeTab === 'analisi' && hasAnalisiDettagliata && (
        <>
        <AiBriefing
          facilities={enrichedFacilities}
          kpiRecords={data.kpiRecords ?? []}
        />

        <section className="mb-8">
          <p className="text-[11px] font-medium text-slate-400 uppercase tracking-widest mb-3">
            Reportistica di gruppo
          </p>
          <div className="grid grid-cols-2 gap-4">
            <ReportCard
              icon={<FileText size={28} />}
              iconBg="#F0FDF4" iconColor="#059669"
              title="Relazioni globali"
              desc="Report di gruppo, soddisfazione ospiti e KPI per periodo. Export PDF."
              footerLabel="Export PDF"
              onClick={() => setActiveModal('globalReport')}
            />
            <ReportCard
              icon={<Trophy size={28} />}
              iconBg="#FFFBEB" iconColor="#D97706"
              title="Ranking strutture"
              desc="Classifica comparativa tra strutture per KPI clinici e qualità percepita."
              footerLabel="Comparativo"
              onClick={() => setActiveModal('ranking')}
            />
          </div>
        </section>

        <section>
          <p className="text-[11px] font-medium text-slate-400 uppercase tracking-widest mb-3">
            Centro analisi direzionale
          </p>
          <div className="grid grid-cols-4 gap-3">
            <ReportCard
              compact
              icon={<BarChart2 size={22} />}
              iconBg="#EFF6FF" iconColor="#3B82F6"
              title="Benchmark di gruppo"
              desc="Confronto KPI tra strutture su medie di gruppo e soglie."
              footerLabel="Multistrut."
              onClick={() => setActiveModal('kpiCharts')}
            />
            <ReportCard
              compact
              icon={<TrendingUp size={22} />}
              iconBg="#EFF6FF" iconColor="#3B82F6"
              title="Vista Laser"
              desc="Un KPI monitorato su tutte le strutture nel tempo."
              footerLabel="Temporale"
              onClick={() => setActiveModal('kpiLaser')}
            />
            <ReportCard
              compact
              icon={<Building2 size={22} />}
              iconBg="#EFF6FF" iconColor="#3B82F6"
              title="Vista Raggi X"
              desc="Tutti i KPI di una struttura a confronto."
              footerLabel="Per struttura"
              onClick={() => setActiveModal('kpiXray')}
            />
            <ReportCard
              compact
              icon={<Search size={22} />}
              iconBg="#F5F3FF" iconColor="#7C3AED"
              title="Analisi comparativa"
              desc="Anomaly scanner, dati puntuali e analisi AI narrativa."
              footerLabel=""
              onClick={() => setActiveModal('kpiAnalisi')}
              accent
              badge="Nuovo"
            />
          </div>
        </section>
        </>
        )}

      </main>

      {/* ── Modals — invariati ── */}
      {activeModal === 'globalReport' && (
        <GlobalReportModal
          isOpen onClose={closeModal} onBack={closeModal}
          facilities={data.facilities} udos={data.udos}
          surveys={data.surveys} kpiRecords={data.kpiRecords}
          year={year}
        />
      )}
      {activeModal === 'ranking' && (
        <RankingModal
          isOpen onClose={closeModal} onBack={closeModal}
          facilities={data.facilities} kpiRecords={data.kpiRecords}
        />
      )}
      {activeModal === 'kpiCharts' && (
        <KpiChartsModal
          isOpen onClose={closeModal} onBack={closeModal}
          facilities={data.facilities} udos={data.udos}
          kpiRecords={data.kpiRecords} year={year}
        />
      )}
      {activeModal === 'kpiLaser' && (
        <KpiLaserModal
          isOpen onClose={closeModal} onBack={closeModal}
          facilities={data.facilities} udos={data.udos}
          kpiRecords={data.kpiRecords} year={year}
        />
      )}
      {activeModal === 'kpiXray' && (
        <KpiXrayModal
          isOpen onClose={closeModal} onBack={closeModal}
          facilities={data.facilities} kpiRecords={data.kpiRecords} year={year}
        />
      )}
      {activeModal === 'kpiAnalisi' && (
        <KpiAnalisiComparativa
          isOpen onClose={closeModal} onBack={closeModal}
          facilities={data.facilities} kpiRecords={data.kpiRecords}
        />
      )}
    </div>
  );
}
