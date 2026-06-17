/**
 * src/components/FacilityCard.jsx  —  v3
 * Card compatta: ~30% meno altezza, border-top colorato per riskLevel.
 * Tutta la logica onClick invariata.
 */
import React, { memo, useMemo } from 'react';
import {
  Settings, Database, BarChart3, Archive,
  ArchiveRestore, ExternalLink, ChefHat
} from 'lucide-react';
import { calcFacilityRiskScore } from '../utils/riskScoreEngine';

const BORDER_COLOR = {
  low:       '#10b981',  // emerald-500
  medium:    '#fbbf24',  // amber-400
  high:      '#ef4444',  // red-500
  suspended: '#94a3b8',  // slate-400
};

const SCORE_COLOR = {
  low:    'text-emerald-600',
  medium: 'text-amber-500',
  high:   'text-red-600',
};

const UDO_COLORS = {
  RSA: { bg: 'bg-blue-100',   text: 'text-blue-700'   },
  CDI: { bg: 'bg-violet-100', text: 'text-violet-700' },
  RSD: { bg: 'bg-pink-100',   text: 'text-pink-700'   },
  SL:  { bg: 'bg-teal-100',   text: 'text-teal-700'   },
  PSI: { bg: 'bg-orange-100', text: 'text-orange-700' },
  CDD: { bg: 'bg-cyan-100',   text: 'text-cyan-700'   },
  DIS: { bg: 'bg-rose-100',   text: 'text-rose-700'   },
  NPI: { bg: 'bg-lime-100',   text: 'text-lime-700'   },
};
const DEFAULT_UDO = { bg: 'bg-slate-100', text: 'text-slate-600' };

const FacilityCard = memo(function FacilityCard({
  f,
  onEdit,
  onDataClick,
  onSuspendToggle,
  onKpiClick,
  onDirectorView,
  onHaccpClick,
  kpiRecords = [],
  isAdmin = false,
}) {
  const scoreColor = SCORE_COLOR[f.riskLevel] ?? 'text-slate-400';

  const riskScore = useMemo(() => {
    if (!isAdmin || !kpiRecords.length) return null;
    return calcFacilityRiskScore(f, kpiRecords);
  }, [f, kpiRecords, isAdmin]);

  const kpiState = f._kpiFuture ? 'future' : f.isKpiGreen ? 'ok' : 'todo';

  const haccpCfg = !f.haccp_obbligatorio
    ? { color: 'text-slate-300', bg: 'hover:bg-slate-50', title: 'Non soggetta a HACCP' }
    : f.haccp_semaforo === 'verde'
    ? { color: 'text-emerald-500', bg: 'hover:bg-emerald-50', title: 'HACCP in regola' }
    : f.haccp_semaforo === 'giallo'
    ? { color: 'text-amber-400',   bg: 'hover:bg-amber-50',   title: 'HACCP — attenzione scadenze' }
    : f.haccp_semaforo === 'rosso'
    ? { color: 'text-red-500',     bg: 'hover:bg-red-50',     title: 'HACCP — situazione critica' }
    : { color: 'text-slate-300',   bg: 'hover:bg-slate-50',   title: 'HACCP non censito' };

  const metaLine = [
    f.region,
    f.bed_count > 0 ? `${f.bed_count} pl` : null,
    f.director || null,
  ].filter(Boolean).join(' · ');

  return (
    <div
      className={`
        bg-white border border-slate-200 rounded-lg border-t-[3px]
        group relative cursor-pointer hover:shadow-sm transition-all
        ${f.is_suspended ? 'opacity-60 grayscale' : ''}
      `}
      style={{ borderTopColor: BORDER_COLOR[f.riskLevel] ?? '#e2e8f0' }}
      onClick={() => onDirectorView && onDirectorView(f)}
    >

      {/* ── Hover actions ── */}
      <div
        className="absolute top-1.5 right-1.5 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10"
        onClick={e => e.stopPropagation()}
      >
        {onDirectorView && (
          <button
            onClick={() => onDirectorView(f)}
            className="p-1 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all"
            title="Vista direttore"
          >
            <ExternalLink size={12} />
          </button>
        )}
        <button
          onClick={() => onSuspendToggle(f)}
          className={`p-1 rounded transition-all ${
            f.is_suspended
              ? 'text-amber-500 hover:bg-amber-50'
              : 'text-slate-300 hover:text-red-500 hover:bg-red-50'
          }`}
          title={f.is_suspended ? 'Riattiva struttura' : 'Sospendi struttura'}
        >
          {f.is_suspended ? <ArchiveRestore size={12} /> : <Archive size={12} />}
        </button>
        <button
          onClick={() => onEdit(f)}
          className="p-1 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all"
          title="Modifica struttura"
        >
          <Settings size={12} />
        </button>
      </div>

      {/* ── Riga 1: UDO + nome + badge sospesa ── */}
      <div className="px-3 pt-2.5 pb-0">
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0 pr-16">
            <span className={`inline-block text-[10px] font-bold tracking-wide uppercase px-1.5 py-0.5 rounded ${
              (UDO_COLORS[f.udo_name] ?? DEFAULT_UDO).bg
            } ${
              (UDO_COLORS[f.udo_name] ?? DEFAULT_UDO).text
            }`}>
              {f.udo_name}
            </span>
            <h3 className="text-sm font-semibold text-slate-900 leading-tight truncate mt-0.5">
              {f.name}
            </h3>
          </div>
          {f.is_suspended && (
            <span className="text-[9px] font-bold bg-slate-100 text-slate-500 rounded px-1.5 py-0.5 flex-shrink-0 mt-0.5">
              SOSP.
            </span>
          )}
        </div>
      </div>

      {/* ── Riga 2: regione · posti letto · direttore ── */}
      <div className="px-3 pt-0.5 pb-0">
        <p className="text-[11px] text-slate-400 truncate">{metaLine}</p>
      </div>

      {/* ── Riga 3: score + icone azione ── */}
      <div
        className="flex items-center justify-between px-3 pt-2 pb-2.5 mt-1 border-t border-slate-50"
        onClick={e => e.stopPropagation()}
      >
        {/* Score */}
        {riskScore != null ? (
          <span className={`text-xs font-semibold ${scoreColor}`}>
            {riskScore.score > 0 ? `● ${riskScore.score}/${riskScore.months}m` : '● ok'}
          </span>
        ) : (
          <span className="text-xs font-semibold text-slate-300">● –</span>
        )}

        {/* Icone azione */}
        <div className="flex items-center gap-1.5">
          {/* HACCP */}
          <button
            onClick={() => onHaccpClick && onHaccpClick(f)}
            disabled={!f.haccp_obbligatorio}
            className={`flex items-center justify-center w-6 h-6 rounded transition-all
              ${f.haccp_obbligatorio ? `${haccpCfg.bg} cursor-pointer` : 'cursor-default'}`}
            title={haccpCfg.title}
          >
            <ChefHat size={13} className={haccpCfg.color} />
          </button>

          {/* KPI */}
          <button
            onClick={() => kpiState !== 'future' && onKpiClick(f)}
            disabled={kpiState === 'future'}
            className={`flex items-center justify-center h-6 px-1 rounded transition-all ${
              kpiState === 'ok'     ? 'hover:bg-emerald-50' :
              kpiState === 'future' ? 'cursor-default'      :
                                     'hover:bg-indigo-50'
            }`}
            title={
              kpiState === 'future' ? 'Nessun mese rendicontabile' :
              kpiState === 'ok'     ? 'KPI in regola' :
                                     'KPI da completare'
            }
          >
            <span className={`text-[11px] font-black tracking-wider ${
              kpiState === 'ok'     ? 'text-emerald-500' :
              kpiState === 'future' ? 'text-slate-300'   :
                                     'text-indigo-500'
            }`}>KPI</span>
          </button>

          {/* Dati clienti */}
          <button
            onClick={() => onDataClick(f, 'client')}
            className={`flex items-center justify-center w-6 h-6 rounded transition-all ${
              f.clientStatus === 'completed' ? 'hover:bg-emerald-50' :
              f.clientStatus === 'pending'   ? 'hover:bg-indigo-50'  :
                                              'hover:bg-slate-100'
            }`}
            title={`Clienti — ${
              f.clientStatus === 'completed' ? 'Relazione OK' :
              f.clientStatus === 'pending'   ? 'Da elaborare' :
                                              'Carica dati'
            }`}
          >
            <BarChart3 size={13} className={
              f.clientStatus === 'completed' ? 'text-emerald-500' :
              f.clientStatus === 'pending'   ? 'text-indigo-500'  :
                                              'text-slate-300'
            } />
          </button>

          {/* Dati operatori */}
          <button
            onClick={() => onDataClick(f, 'operator')}
            className={`flex items-center justify-center w-6 h-6 rounded transition-all ${
              f.staffStatus === 'completed' ? 'hover:bg-emerald-50' :
              f.staffStatus === 'pending'   ? 'hover:bg-indigo-50'  :
                                             'hover:bg-slate-100'
            }`}
            title={`Operatori — ${
              f.staffStatus === 'completed' ? 'Relazione OK' :
              f.staffStatus === 'pending'   ? 'Da elaborare' :
                                             'Carica dati'
            }`}
          >
            <Database size={13} className={
              f.staffStatus === 'completed' ? 'text-emerald-500' :
              f.staffStatus === 'pending'   ? 'text-indigo-500'  :
                                             'text-slate-300'
            } />
          </button>
        </div>
      </div>

    </div>
  );
});

export default FacilityCard;
