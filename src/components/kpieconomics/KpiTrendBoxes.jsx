// src/components/kpieconomics/KpiTrendBoxes.jsx
// Box per KPI: media di gruppo mese corrente, delta vs mese precedente,
// sparkline 6 mesi (documento redesign /report, §2 KPI & Economics).
// Adatta il pattern sparkline di KpiXrayModal.jsx alla media di gruppo
// invece che alla singola struttura, e riusa computeGroupKpiSeries
// (groupKpiStats.js) che già esclude le strutture sotto soglia completezza.
import React, { useMemo, useState } from 'react';
import { LineChart, Line, YAxis, ResponsiveContainer, Tooltip, ReferenceArea } from 'recharts';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { KPI_RULES, KPI_SECTORS, getKpisBySettore, getKpiLabel, isNumericSettore, formatKpiValue } from '../../config/kpiRules';
import { getTimeHorizon } from '../../utils/kpiTimeHorizon';
import { computeGroupKpiSeries } from '../../utils/groupKpiStats';

function formatGroupValue(rule, value) {
  if (value === null || value === undefined) return '—';
  return isNumericSettore(rule.settore) ? value.toFixed(1) : formatKpiValue(value / 100);
}

function DeltaBadge({ rule, delta }) {
  if (delta === null) return <span className="text-[10px] text-slate-300">—</span>;
  // Per direzione MAX salire è positivo, per MIN scendere è positivo; senza target resta neutro
  const improving = rule.direzione === 'MAX' ? delta > 0 : rule.direzione === 'MIN' ? delta < 0 : null;
  const color = improving === null ? 'text-slate-400' : improving ? 'text-emerald-600' : 'text-red-600';
  const Icon = Math.abs(delta) < 1e-9 ? Minus : delta > 0 ? ArrowUp : ArrowDown;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${color}`}>
      <Icon size={11} /> {isNumericSettore(rule.settore) ? Math.abs(delta).toFixed(1) : `${Math.abs(delta).toFixed(1)}pp`}
    </span>
  );
}

function KpiBox({ rule, facilities, kpiRecords, months }) {
  const series = useMemo(
    () => computeGroupKpiSeries(rule, facilities, kpiRecords, months),
    [rule, facilities, kpiRecords, months]
  );

  const current = series[series.length - 1];
  const previous = series[series.length - 2];
  const delta = current?.avg != null && previous?.avg != null ? current.avg - previous.avg : null;

  const m = isNumericSettore(rule.settore) ? 1 : 100;
  const tv = rule.target_verde !== null ? rule.target_verde * m : null;
  const tr = rule.target_rosso !== null ? rule.target_rosso * m : null;
  const hasData = series.some(s => s.avg !== null);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col h-28">
      <div className="flex items-start justify-between gap-2 mb-1">
        <h4 className="text-[11px] font-bold text-slate-700 leading-tight line-clamp-2" title={rule.indicatore}>{getKpiLabel(rule)}</h4>
        <span className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded uppercase tracking-wide shrink-0">{rule.settore}</span>
      </div>

      {!hasData ? (
        <div className="flex-1 flex items-center justify-center text-[10px] font-semibold text-slate-300 uppercase">Nessun dato</div>
      ) : (
        <>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-sm font-bold text-slate-900">{formatGroupValue(rule, current?.avg)}</span>
            <DeltaBadge rule={rule} delta={delta} />
          </div>
          <div className="flex-1 min-h-0 -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ top: 2, right: 6, left: 6, bottom: 0 }}>
                <YAxis domain={['auto', 'auto']} hide />
                <Tooltip
                  formatter={(val) => [formatGroupValue(rule, val), 'Media gruppo']}
                  labelStyle={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b' }}
                  contentStyle={{ padding: '4px 8px', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '11px' }}
                />
                {tv !== null && tr !== null && rule.direzione === 'MAX' && (
                  <>
                    <ReferenceArea y1={tv} y2={999999} fill="#10b981" fillOpacity={0.12} />
                    <ReferenceArea y1={tr} y2={tv} fill="#fbbf24" fillOpacity={0.12} />
                    <ReferenceArea y1={-999999} y2={tr} fill="#ef4444" fillOpacity={0.12} />
                  </>
                )}
                {tv !== null && tr !== null && rule.direzione === 'MIN' && (
                  <>
                    <ReferenceArea y1={-999999} y2={tv} fill="#10b981" fillOpacity={0.12} />
                    <ReferenceArea y1={tv} y2={tr} fill="#fbbf24" fillOpacity={0.12} />
                    <ReferenceArea y1={tr} y2={999999} fill="#ef4444" fillOpacity={0.12} />
                  </>
                )}
                <Line dataKey="avg" type="monotone" stroke="#3b82f6" strokeWidth={2} dot={{ r: 1.5 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}

export default function KpiTrendBoxes({ facilities, kpiRecords, year }) {
  const [settore, setSettore] = useState('all');
  const months = useMemo(() => getTimeHorizon(year).slice(-6), [year]);

  const rules = useMemo(
    () => settore === 'all' ? KPI_RULES : getKpisBySettore(settore),
    [settore]
  );

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Trend KPI di gruppo — ultimi 6 mesi</h3>
        <select value={settore} onChange={e => setSettore(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-medium outline-none focus:border-emerald-400">
          <option value="all">Tutti i settori</option>
          {KPI_SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-[420px] overflow-y-auto custom-scrollbar pr-1">
        {rules.map(rule => (
          <KpiBox key={rule.kpi_target} rule={rule} facilities={facilities} kpiRecords={kpiRecords} months={months} />
        ))}
      </div>
    </div>
  );
}
