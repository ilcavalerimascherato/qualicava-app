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
  Settings, Database, BarChart3, Archive,
  ArchiveRestore, ExternalLink, ChefHat
} from 'lucide-react';
import { calcFacilityRiskScore, RISK_BADGE } from '../utils/riskScoreEngine';

const FacilityCard = memo(function FacilityCard({
  f,
  gridCols,
  onEdit,
  onDataClick,
  onSuspendToggle,
  onKpiClick,
  onDirectorView,
  onHaccpClick,
  kpiRecords = [],
  isAdmin = false,
}) {
  const isCompact      = gridCols?.includes('6') || gridCols?.includes('8');
  const isUltraCompact = gridCols?.includes('8');
  // In configurazione 4 colonne (default) mostra anche i PL
  const plLabel        = (!isCompact && f.bed_count > 0) ? `${f.bed_count} PL` : null;

  // Risk score — solo 4 colonne, solo se ha dati KPI
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

  // Semaforo HACCP — colore cappello da chef
  const haccpCfg = !f.haccp_obbligatorio
    ? { color: 'text-slate-300', bg: 'hover:bg-slate-50', title: 'Non soggetta a HACCP' }
    : f.haccp_semaforo === 'verde'
    ? { color: 'text-emerald-500', bg: 'hover:bg-emerald-50', title: 'HACCP in regola' }
    : f.haccp_semaforo === 'giallo'
    ? { color: 'text-amber-400',   bg: 'hover:bg-amber-50',   title: 'HACCP — attenzione scadenze' }
    : f.haccp_semaforo === 'rosso'
    ? { color: 'text-red-500',     bg: 'hover:bg-red-50',     title: 'HACCP — situazione critica' }
    : { color: 'text-slate-300',   bg: 'hover:bg-slate-50',   title: 'HACCP non censito' };

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

        {/* Badge rischio rimosso dal corpo — spostato nel footer */}

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

      {/* Footer: badge rischio + icone allineate a destra */}
      <div className="mt-2 pt-3 border-t border-slate-50">

        {/* Icone + badge rischio sulla stessa riga */}
        <div className="flex justify-between items-center">

          {/* Sx: badge rischio — solo se disponibile */}
          {riskCfg && riskScore?.score !== null ? (
            <div
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[11px] font-black ${riskCfg.text}`}
              title={riskScore.detail?.slice(0, 3).map(d => `${d.kpi}: ${d.status}`).join(' · ')}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${riskCfg.dot}`} />
              {riskScore.score}<span className="text-[9px] font-bold opacity-60">/{riskScore.months}m</span>
            </div>
          ) : <span />}

          {/* Dx: icone */}
          <div className="flex items-center gap-2">
        <button
          onClick={() => onHaccpClick && onHaccpClick(f)}
          disabled={!f.haccp_obbligatorio}
          className={`flex items-center justify-center w-7 h-7 rounded-lg transition-all
            ${f.haccp_obbligatorio ? `${haccpCfg.bg} cursor-pointer` : 'cursor-default'}`}
          title={haccpCfg.title}
        >
          <ChefHat size={15} className={haccpCfg.color} />
        </button>

        {/* KPI — scritta colorata */}
        <button
          onClick={() => kpiState !== 'future' && onKpiClick(f)}
          disabled={kpiState === 'future'}
          className={`flex items-center justify-center h-7 px-1.5 rounded-lg transition-all ${
            kpiState === 'ok'     ? 'hover:bg-emerald-50' :
            kpiState === 'future' ? 'cursor-default'       :
                                   'hover:bg-indigo-50'
          }`}
          title={kpiState === 'future' ? 'Nessun mese rendicontabile' : kpiState === 'ok' ? 'KPI in regola' : 'KPI da completare'}
        >
          <span className={`text-[11px] font-black tracking-wider ${
            kpiState === 'ok'     ? 'text-emerald-500' :
            kpiState === 'future' ? 'text-slate-300'   :
                                   'text-indigo-500'
          }`}>KPI</span>
        </button>

        {/* Clienti */}
        <button
          onClick={() => onDataClick(f, 'client')}
          className={`flex items-center justify-center w-7 h-7 rounded-lg transition-all ${
            f.clientStatus === 'completed' ? 'hover:bg-emerald-50' :
            f.clientStatus === 'pending'   ? 'hover:bg-indigo-50'  :
                                            'hover:bg-slate-100'
          }`}
          title={`Clienti — ${f.clientStatus === 'completed' ? 'Relazione OK' : f.clientStatus === 'pending' ? 'Da elaborare' : 'Carica dati'}`}
        >
          <BarChart3 size={14} className={
            f.clientStatus === 'completed' ? 'text-emerald-500' :
            f.clientStatus === 'pending'   ? 'text-indigo-500'  :
                                            'text-slate-300'
          } />
        </button>

        {/* Operatori */}
        <button
          onClick={() => onDataClick(f, 'operator')}
          className={`flex items-center justify-center w-7 h-7 rounded-lg transition-all ${
            f.staffStatus === 'completed' ? 'hover:bg-emerald-50' :
            f.staffStatus === 'pending'   ? 'hover:bg-indigo-50'  :
                                           'hover:bg-slate-100'
          }`}
          title={`Operatori — ${f.staffStatus === 'completed' ? 'Relazione OK' : f.staffStatus === 'pending' ? 'Da elaborare' : 'Carica dati'}`}
        >
          <Database size={14} className={
            f.staffStatus === 'completed' ? 'text-emerald-500' :
            f.staffStatus === 'pending'   ? 'text-indigo-500'  :
                                           'text-slate-300'
          } />
        </button>
        </div> {/* fine flex icone dx */}
        </div> {/* fine riga badge+icone */}
      </div>  {/* fine footer */}
    </div>
  );
});

export default FacilityCard;
