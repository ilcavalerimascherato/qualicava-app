// src/components/CdgKpiPanel.jsx
// Pannello gestionale CDG per DirectorFacility — saturazione % con trend 12 mesi

import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { aggregateCdgRecords, calcCdgSummary } from '../hooks/useCdgData';

const MESI = ['','Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];

function DeltaBadge({ value, unit = '', digits = 1 }) {
  if (value == null) return <span className="text-gray-400">—</span>;
  const color = value > 0 ? 'text-green-600' : value < 0 ? 'text-red-500' : 'text-gray-400';
  const arrow = value > 0 ? '▲' : value < 0 ? '▼' : '●';
  return (
    <span className={`font-semibold text-sm ${color}`}>
      {arrow} {Math.abs(value).toFixed(digits)}{unit}
    </span>
  );
}

function KpiCard({ label, main, sub, badge, badge2 }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-1">
      <span className="text-xs text-gray-500 uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold text-gray-800">{main ?? '—'}</span>
      {sub    && <span className="text-xs text-gray-400">{sub}</span>}
      {badge}
      {badge2 && <span className="text-xs text-gray-500 mt-1">{badge2}</span>}
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const [anno, mese] = label.split('-');
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow p-3 text-sm">
      <p className="font-semibold text-gray-700 mb-1">{MESI[parseInt(mese)]} {anno}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: <strong>{p.value != null ? `${p.value.toFixed(1)}%` : '—'}</strong>
        </p>
      ))}
    </div>
  );
}

/**
 * @param {object[]} cdgRecords  - righe grezze v_cdg_mensile
 * @param {number}   year        - anno corrente
 * @param {number}   bedCount    - posti letto struttura (da facility.bed_count)
 */
export default function CdgKpiPanel({ cdgRecords, year, bedCount = 0 }) {
  const aggregated = useMemo(() => aggregateCdgRecords(cdgRecords), [cdgRecords]);
  const summary    = useMemo(() => calcCdgSummary(aggregated, bedCount), [aggregated, bedCount]);

  if (!summary) {
    return (
      <div className="text-sm text-gray-400 italic py-2">
        Dati CDG non disponibili per questa struttura.
      </div>
    );
  }

  const mesLabel = `al 31/${String(summary.mese).padStart(2,'0')}/${summary.anno}`;

  return (
    <div className="bg-gray-50 rounded-2xl border border-gray-200 p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Andamento Gestionale
          </h3>
          <p className="text-xs text-gray-400">{mesLabel}</p>
        </div>
        <span className="text-xs text-gray-400">Fonte: BI Controllo di Gestione</span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          label="Saturazione"
          main={summary.saturazione != null ? `${summary.saturazione.toFixed(1)}%` : null}
          sub={`Media 12m: ${summary.mediaSat12 != null ? summary.mediaSat12.toFixed(1)+'%' : '—'}`}
          badge={<DeltaBadge value={summary.deltaMom} unit="pp vs mese prec." />}
        />
        <KpiCard
          label="Budget"
          main={summary.budgetSat != null ? `${summary.budgetSat.toFixed(1)}%` : null}
          sub={`Media 12m: ${summary.mediaBdg12 != null ? summary.mediaBdg12.toFixed(1)+'%' : '—'}`}
          badge={<DeltaBadge value={summary.pctVsBudget} unit="% vs budget" />}
        />
        <KpiCard
          label="Ingressi 12m"
          main={summary.ingressi12}
          sub={`Ultimo mese: ${summary.ingressiMese}`}
        />
        <KpiCard
          label="Dimissioni 12m"
          main={summary.dimissioni12}
          sub={`Ultimo mese: ${summary.dimissioniMese}`}
        />
      </div>

      {/* Grafico trend saturazione */}
      {summary.trend12.length > 1 && (
        <div>
          <p className="text-xs text-gray-500 mb-2">
            Saturazione % — ultimi {summary.mesiDisponibili} mesi disponibili
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={summary.trend12} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="label"
                tickFormatter={l => { const [,m] = l.split('-'); return MESI[parseInt(m)]; }}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                domain={['auto', 'auto']}
                tickFormatter={v => `${v}%`}
                tick={{ fontSize: 11 }}
                width={40}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="line" wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone" dataKey="saturazione" name="Saturazione Reale"
                stroke="#3b82f6" strokeWidth={2.5} dot={false} connectNulls
              />
              <Line
                type="monotone" dataKey="budget" name="Budget"
                stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5 4"
                dot={false} connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
