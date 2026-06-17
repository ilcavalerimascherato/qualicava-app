// src/views/ReportPage.jsx
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { FileText, Trophy, BarChart2, TrendingUp, Building2, Search } from 'lucide-react';
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

const CURRENT_YEAR = new Date().getFullYear();

function ReportCard({ icon, iconBg, iconColor, title, desc, onClick, accent, badge }) {
  return (
    <div
      onClick={onClick}
      className={`bg-white border rounded-lg p-3 flex items-start gap-2.5 cursor-pointer hover:border-emerald-400 transition-colors ${
        accent ? 'border-blue-300' : 'border-slate-200'
      }`}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: iconBg }}
      >
        <span style={{ color: iconColor }}>{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <p className="text-xs font-semibold text-slate-900">{title}</p>
          {badge && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium leading-none">
              {badge}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

export default function ReportPage() {
  const navigate                         = useNavigate();
  const { isAdmin, profile, signOut }    = useAuth();
  const [year]                           = useState(CURRENT_YEAR);
  const { data }                         = useDashboardData(year);
  const [activeModal, setActiveModal]    = useState(null);
  const [dateRange, setDateRange]        = useState({
    from: `${CURRENT_YEAR - 1}-01`,
    to:   `${CURRENT_YEAR}-12`,
  });

  const allIds = useMemo(
    () => (data.facilities ?? []).filter(f => !f.is_suspended).map(f => f.id),
    [data.facilities],
  );
  const { totals: badgeTotals } = useBadgeCounts(allIds, year, isAdmin);

  const headerFacilities = useMemo(
    () => (data.facilities ?? []).map(f => ({ ...f, riskLevel: 'unknown' })),
    [data.facilities],
  );

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
      nc:           '/admin',
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

      {/* ── Context bar ── */}
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-slate-100">
        <div>
          <h1 className="text-base font-semibold text-slate-900">Centro report e analisi</h1>
          <p className="text-xs text-slate-400 mt-0.5">Seleziona l'area di analisi</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Intervallo:</span>
          <input
            type="month"
            value={dateRange.from}
            onChange={e => setDateRange(prev => ({ ...prev, from: e.target.value }))}
            className="border border-slate-200 rounded px-2 py-1 text-xs outline-none focus:border-emerald-400"
          />
          <span className="text-xs text-slate-400">→</span>
          <input
            type="month"
            value={dateRange.to}
            onChange={e => setDateRange(prev => ({ ...prev, to: e.target.value }))}
            className="border border-slate-200 rounded px-2 py-1 text-xs outline-none focus:border-emerald-400"
          />
        </div>
      </div>

      {/* ── Body ── */}
      <main className="px-6 py-4 max-w-3xl">

        <AiBriefing
          facilities={enrichedFacilities}
          kpiRecords={data.kpiRecords ?? []}
        />

        <section className="mb-6">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
            Reportistica di gruppo
          </p>
          <div className="grid grid-cols-2 gap-3">
            <ReportCard
              icon={<FileText size={16} />}
              iconBg="#F0FDF4" iconColor="#059669"
              title="Relazioni globali"
              desc="Report di gruppo, soddisfazione ospiti e KPI per periodo. Export PDF."
              onClick={() => setActiveModal('globalReport')}
            />
            <ReportCard
              icon={<Trophy size={16} />}
              iconBg="#FFFBEB" iconColor="#D97706"
              title="Ranking strutture"
              desc="Classifica comparativa tra strutture per KPI clinici e qualità percepita."
              onClick={() => setActiveModal('ranking')}
            />
          </div>
        </section>

        <section>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
            Centro analisi direzionale
          </p>
          <div className="grid grid-cols-2 gap-3">
            <ReportCard
              icon={<BarChart2 size={16} />}
              iconBg="#EFF6FF" iconColor="#3B82F6"
              title="Benchmark di gruppo"
              desc="Confronto KPI tra strutture su medie di gruppo e soglie."
              onClick={() => setActiveModal('kpiCharts')}
            />
            <ReportCard
              icon={<TrendingUp size={16} />}
              iconBg="#EFF6FF" iconColor="#3B82F6"
              title="Vista Laser"
              desc="Un KPI monitorato su tutte le strutture nel tempo."
              onClick={() => setActiveModal('kpiLaser')}
            />
            <ReportCard
              icon={<Building2 size={16} />}
              iconBg="#EFF6FF" iconColor="#3B82F6"
              title="Vista Raggi X"
              desc="Tutti i KPI di una struttura a confronto."
              onClick={() => setActiveModal('kpiXray')}
            />
            <ReportCard
              icon={<Search size={16} />}
              iconBg="#F5F3FF" iconColor="#7C3AED"
              title="Analisi comparativa"
              desc="Anomaly scanner, dati puntuali e analisi AI narrativa."
              onClick={() => setActiveModal('kpiAnalisi')}
              accent
              badge="Nuovo"
            />
          </div>
        </section>
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
