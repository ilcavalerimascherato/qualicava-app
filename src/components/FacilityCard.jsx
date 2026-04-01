/**
 * src/components/FacilityCard.jsx  —  v2
 * MODIFICHE v2:
 *  - Anno futuro: badge KPI grigio "N/D" invece di verde ingannevole.
 *    isKpiGreen=true su anni futuri è tecnicamente corretto ma visivamente
 *    fuorviante — ora mostriamo uno stato neutro distinto.
 *  - Icona "Vista Direttore" visibile solo per admin (prop onDirectorView).
 *    Cliccando naviga a /facility/:id per vedere la struttura come la
 *    vedrebbe il direttore. Se la prop non è passata, il tasto non appare.
 */
import React, { memo, useMemo } from 'react';
import {
  Settings, Database, BarChart3, Activity, Archive,
  ArchiveRestore, CheckCircle2, ExternalLink
} from 'lucide-react';
import { calcFacilityRiskScore, RISK_BADGE } from '../utils/riskScoreEngine';

const ICON_STYLES = {
  empty:     'bg-slate-50 text-slate-400 hover:bg-slate-200 hover:text-slate-600 border-slate-200',
  pending:   'bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white border-indigo-200 shadow-sm',
  completed: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 border-emerald-200 shadow-sm',
};

const STATUS_LABELS = {
  empty:     'Carica dati',
  pending:   'Da elaborare',
  completed: 'Relazione OK',
};

function SurveyButton({ status, icon: Icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center w-8 h-7 rounded-md border transition-all ${ICON_STYLES[status]}`}
      title={`${label} — ${STATUS_LABELS[status]}`}
    >
      <Icon size={14} className={status === 'empty' ? 'opacity-50' : ''} />
    </button>
  );
}

const FacilityCard = memo(function FacilityCard({
  f,
  gridCols,
  onEdit,
  onDataClick,
  onSuspendToggle,
  onKpiClick,
  onDirectorView,
  kpiRecords = [],
  isAdmin = false,
}) {
  const isCompact      = gridCols?.includes('6') || gridCols?.includes('8');
  const isUltraCompact = gridCols?.includes('8');
  // In configurazione 4 colonne (default) mostra anche i PL
  const plLabel        = (!isCompact && f.bed_count > 0) ? `${f.bed_count} PL` : null;

  // Risk score — solo admin, solo 4 colonne, solo se ha dati KPI
  const riskScore = useMemo(() => {
    if (!isAdmin || isCompact || !kpiRecords.length) return null;
    return calcFacilityRiskScore(f, kpiRecords);
  }, [f, kpiRecords, isAdmin, isCompact]);

  const riskCfg = riskScore?.score !== null && riskScore?.score !== undefined
    ? RISK_BADGE[riskScore.level]
    : null;
  const subtitle       = [f.udo_name, f.region, plLabel].filter(Boolean).join(' • ');

  // Stato KPI: distingue verde, futuro (grigio N/D) e da fare (rosso)
  const kpiState = f._kpiFuture
    ? 'future'
    : f.isKpiGreen
    ? 'ok'
    : 'todo';

  const kpiCfg = {
    ok:     { cls: 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100', Icon: CheckCircle2, label: 'KPI' },
    future: { cls: 'bg-slate-100 border-slate-200 text-slate-400 cursor-default',            Icon: Activity,     label: 'KPI N/D' },
    todo:   { cls: 'bg-indigo-50 border-indigo-200 text-indigo-600 hover:bg-indigo-600 hover:text-white', Icon: Activity, label: 'KPI' },
  }[kpiState];

  return (
    <div
      className={`
        bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex flex-col relative
        group hover:shadow-md transition-all duration-200
        ${f.is_suspended ? 'opacity-50 grayscale' : ''}
      `}
      style={{ borderTopWidth: '5px', borderTopColor: f.is_suspended ? '#94a3b8' : (f.udo_color || '#cbd5e1') }}
    >
      {/* Azioni hover */}
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Icona vista direttore — solo se admin e prop passata */}
        {onDirectorView && (
          <button
            onClick={() => onDirectorView(f)}
            className="p-1.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
            title="Vista direttore"
          >
            <ExternalLink size={13} />
          </button>
        )}
        <button
          onClick={() => onSuspendToggle(f)}
          className={`p-1.5 rounded-lg transition-all ${
            f.is_suspended
              ? 'text-amber-500 hover:bg-amber-50'
              : 'text-slate-400 hover:text-red-500 hover:bg-red-50'
          }`}
          title={f.is_suspended ? 'Riattiva struttura' : 'Sospendi struttura'}
        >
          {f.is_suspended ? <ArchiveRestore size={14} /> : <Archive size={14} />}
        </button>
        <button
          onClick={() => onEdit(f)}
          className="p-1.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
          title="Modifica struttura"
        >
          <Settings size={14} />
        </button>
      </div>

      {/* Contenuto principale */}
      <div className="mb-2 pr-12 flex-1">
        <h3 className={`text-sm font-black leading-tight line-clamp-2 ${
          f.is_suspended ? 'text-slate-500 line-through' : 'text-slate-800'
        }`}>
          {f.name}
        </h3>

        {subtitle && (
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
            {subtitle}
          </p>
        )}

        {/* Badge rischio — solo admin, solo 4 colonne */}
        {riskCfg && riskScore.score !== null && (
          <div
            className={`inline-flex items-center gap-1.5 mt-1.5 px-2 py-0.5 rounded-lg border text-[10px] font-black ${riskCfg.bg} ${riskCfg.border} ${riskCfg.text}`}
            title={riskScore.detail.slice(0, 3).map(d => `${d.kpi}: ${d.status}`).join(' · ')}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${riskCfg.dot}`} />
            Rischio {riskCfg.label} · {riskScore.score}
            <span className="text-[9px] opacity-60">/{riskScore.months}m</span>
          </div>
        )}

        <div className="mt-2 text-[11px] font-medium text-slate-500 space-y-0.5">
          {!isUltraCompact && f.address && (
            <p className="truncate">{f.address}</p>
          )}
          {!isCompact && f.referent && (
            <p className="truncate text-slate-400">Ref: {f.referent}</p>
          )}
          {!isCompact && f.director && (
            <p className="truncate text-slate-400">Dir: {f.director}</p>
          )}
        </div>
      </div>

      {/* Footer: KPI + Survey */}
      <div className="mt-2 flex justify-between items-center pt-3 border-t border-slate-50">
        <button
          onClick={() => kpiState !== 'future' && onKpiClick(f)}
          disabled={kpiState === 'future'}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border transition-all group/kpi shadow-sm ${kpiCfg.cls}`}
          title={kpiState === 'future' ? 'Nessun mese rendicontabile per questo anno' : kpiState === 'ok' ? 'KPI in regola' : 'Gestione KPI mensili'}
        >
          <kpiCfg.Icon size={13} className={kpiState === 'todo' ? 'group-hover/kpi:animate-pulse' : ''} />
          <span className="text-[10px] font-black uppercase tracking-wider">{kpiCfg.label}</span>
        </button>

        <div className="flex gap-1.5">
          <SurveyButton
            status={f.clientStatus}
            icon={BarChart3}
            label="Clienti"
            onClick={() => onDataClick(f, 'client')}
          />
          <SurveyButton
            status={f.staffStatus}
            icon={Database}
            label="Operatori"
            onClick={() => onDataClick(f, 'operator')}
          />
        </div>
      </div>
    </div>
  );
});

export default FacilityCard;
