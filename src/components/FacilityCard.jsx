// src/components/FacilityCard.jsx
import React, { memo } from 'react';
import { Settings, Database, BarChart3, Activity, Archive, ArchiveRestore, CheckCircle2 } from 'lucide-react';

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
}) {
  const isCompact      = gridCols?.includes('6') || gridCols?.includes('8');
  const isUltraCompact = gridCols?.includes('8');

  // Riga descrittiva: usa udo_name (da enrichFacilitiesData) e region (colonna DB)
  // Non usiamo f.type o f.city che non esistono nel DB
  const subtitle = [f.udo_name, f.region].filter(Boolean).join(' • ');

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
          onClick={onEdit}
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

        {/* UDO • Regione */}
        {subtitle && (
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
            {subtitle}
          </p>
        )}

        <div className="mt-2 text-[11px] font-medium text-slate-500 space-y-0.5">
          {/* Indirizzo: nascosto in modalità ultra-compatta */}
          {!isUltraCompact && f.address && (
            <p className="truncate">{f.address}</p>
          )}
          {/* Referente qualità: visibile solo in modalità larga */}
          {!isCompact && f.referent && (
            <p className="truncate text-slate-400">Ref: {f.referent}</p>
          )}
          {/* Direttore: visibile solo in modalità larga */}
          {!isCompact && f.director && (
            <p className="truncate text-slate-400">Dir: {f.director}</p>
          )}
        </div>
      </div>

      {/* Footer: KPI + Survey */}
      <div className="mt-2 flex justify-between items-center pt-3 border-t border-slate-50">

        <button
          onClick={() => onKpiClick(f)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border transition-all group/kpi shadow-sm ${
            f.isKpiGreen
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
              : 'bg-indigo-50 border-indigo-200 text-indigo-600 hover:bg-indigo-600 hover:text-white'
          }`}
          title={f.isKpiGreen ? 'KPI in regola' : 'Gestione KPI mensili'}
        >
          {f.isKpiGreen
            ? <CheckCircle2 size={13} />
            : <Activity size={13} className="group-hover/kpi:animate-pulse" />
          }
          <span className="text-[10px] font-black uppercase tracking-wider">KPI</span>
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
