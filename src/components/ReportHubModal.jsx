import React, { useState } from 'react';
import { X, BarChart2, FileText, Trophy, TrendingUp, Building2, Search } from 'lucide-react';
import GlobalReportModal      from './GlobalReportModal';
import RankingModal           from './RankingModal';
import KpiChartsModal         from './KpiChartsModal';
import KpiLaserModal          from './KpiLaserModal';
import KpiXrayModal           from './KpiXrayModal';
import KpiAnalisiComparativa  from './KpiAnalisiComparativa';

const YEAR = new Date().getFullYear();

// ── Card ──────────────────────────────────────────────────────

const COLOR_MAP = {
  emerald: { iconBg: 'bg-emerald-50', iconText: 'text-emerald-700' },
  amber:   { iconBg: 'bg-amber-50',   iconText: 'text-amber-700'   },
  blue:    { iconBg: 'bg-blue-50',    iconText: 'text-blue-700'    },
  purple:  { iconBg: 'bg-purple-50',  iconText: 'text-purple-700'  },
};

function Card({ icon, color, title, desc, onClick, accent = false, badge }) {
  const { iconBg, iconText } = COLOR_MAP[color] ?? COLOR_MAP.blue;
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col gap-3 p-4 bg-white rounded-xl cursor-pointer text-left transition-all duration-150 hover:shadow-sm ${
        accent
          ? 'border-2 border-blue-500 hover:border-blue-600'
          : 'border border-gray-200 hover:border-gray-300'
      }`}
    >
      {badge && (
        <span className="absolute top-3 right-3 text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">
          {badge}
        </span>
      )}
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg} ${iconText}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-gray-900">{title}</p>
        <p className="text-xs text-gray-500 leading-relaxed mt-0.5">{desc}</p>
      </div>
    </button>
  );
}

// ── Component ─────────────────────────────────────────────────

export default function ReportHubModal({ isOpen, onClose, facilities, udos, surveys, kpiRecords }) {
  const [activeModal, setActiveModal] = useState(null);

  if (!isOpen) return null;

  const back = () => setActiveModal(null);

  return (
    <>
      {/* ── Sub-modali (montati solo quando attivi) ── */}
      {activeModal === 'globalReport' && (
        <GlobalReportModal
          isOpen onClose={onClose} onBack={back}
          facilities={facilities} udos={udos} surveys={surveys} kpiRecords={kpiRecords}
        />
      )}
      {activeModal === 'ranking' && (
        <RankingModal
          isOpen onClose={onClose} onBack={back}
          facilities={facilities} kpiRecords={kpiRecords}
        />
      )}
      {activeModal === 'kpiCharts' && (
        <KpiChartsModal
          isOpen onClose={onClose} onBack={back}
          facilities={facilities} udos={udos} kpiRecords={kpiRecords} year={YEAR}
        />
      )}
      {activeModal === 'kpiLaser' && (
        <KpiLaserModal
          isOpen onClose={onClose} onBack={back}
          facilities={facilities} udos={udos} kpiRecords={kpiRecords} year={YEAR}
        />
      )}
      {activeModal === 'kpiXray' && (
        <KpiXrayModal
          isOpen onClose={onClose} onBack={back}
          facilities={facilities} kpiRecords={kpiRecords} year={YEAR}
        />
      )}
      {activeModal === 'kpiAnalisi' && (
        <KpiAnalisiComparativa
          isOpen onClose={onClose} onBack={back}
          facilities={facilities} kpiRecords={kpiRecords}
        />
      )}

      {/* ── Hub (nascosto quando un sotto-modale è attivo) ── */}
      <div className={activeModal !== null ? 'hidden' : 'fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4'}>
        <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="flex items-start justify-between p-6 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center text-gray-700">
                <BarChart2 size={18} />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">Centro report e analisi</h2>
                <p className="text-xs text-gray-500 mt-0.5">Seleziona l'area di analisi</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-5">

            {/* Sezione 1 — Report e Ranking */}
            <div className="grid grid-cols-2 gap-3">
              <Card
                icon={<FileText size={18} />}
                color="emerald"
                title="Relazioni globali"
                desc="Report di gruppo, soddisfazione ospiti e KPI per periodo. Export PDF."
                onClick={() => setActiveModal('globalReport')}
              />
              <Card
                icon={<Trophy size={18} />}
                color="amber"
                title="Ranking strutture"
                desc="Classifica comparativa tra strutture per KPI clinici e qualità percepita."
                onClick={() => setActiveModal('ranking')}
              />
            </div>

            {/* Separatore */}
            <div className="border-t border-gray-100 pt-1">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-3">
                Centro analisi direzionale
              </p>

              {/* Sezione 2 — Analisi KPI */}
              <div className="grid grid-cols-2 gap-3">
                <Card
                  icon={<BarChart2 size={18} />}
                  color="blue"
                  title="Benchmark di gruppo"
                  desc="Confronto KPI tra strutture su medie di gruppo e soglie."
                  onClick={() => setActiveModal('kpiCharts')}
                />
                <Card
                  icon={<TrendingUp size={18} />}
                  color="blue"
                  title="Vista Laser"
                  desc="Un KPI monitorato su tutte le strutture nel tempo"
                  onClick={() => setActiveModal('kpiLaser')}
                />
                <Card
                  icon={<Building2 size={18} />}
                  color="blue"
                  title="Vista Raggi X"
                  desc="Tutti i KPI di una struttura a confronto"
                  onClick={() => setActiveModal('kpiXray')}
                />
                <Card
                  icon={<Search size={18} />}
                  color="purple"
                  title="Analisi comparativa"
                  desc="Anomaly scanner, dati puntuali e analisi AI narrativa."
                  onClick={() => setActiveModal('kpiAnalisi')}
                  accent
                  badge="Nuovo"
                />
              </div>
            </div>

          </div>

          {/* Footer */}
          <div className="px-6 pb-5 flex justify-end border-t border-gray-50 pt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Chiudi
            </button>
          </div>

        </div>
      </div>
    </>
  );
}
