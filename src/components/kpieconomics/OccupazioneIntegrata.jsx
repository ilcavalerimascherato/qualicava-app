// src/components/kpieconomics/OccupazioneIntegrata.jsx
// Occupazione per struttura con trend storico e proiezione a 3 mesi
// (documento redesign /report, §2 KPI & Economics — "vista economica
// integrata"). Riusa aggregateCdgRecords/calcCdgSummary (useCdgData.js) e
// la nuova projectOccupancy (occupancyProjection.js).
import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { aggregateCdgRecords, calcCdgSummary } from '../../hooks/useCdgData';
import { projectOccupancy } from '../../utils/occupancyProjection';

function TrendArrow({ delta }) {
  if (delta == null || Math.abs(delta) < 0.5) return <Minus size={12} className="text-slate-400" />;
  return delta > 0
    ? <TrendingUp size={12} className="text-emerald-600" />
    : <TrendingDown size={12} className="text-red-600" />;
}

function MiniTrendline({ trend12 }) {
  const points = (trend12 ?? []).filter(t => t.saturazione != null).slice(-6);
  if (points.length < 2) return <span className="text-[10px] text-slate-300">—</span>;

  const values = points.map(p => p.saturazione);
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const w = 60, h = 20;
  const path = points.map((p, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - ((p.saturazione - min) / range) * h;
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <svg width={w} height={h} className="flex-shrink-0">
      <path d={path} fill="none" stroke="#3b82f6" strokeWidth="1.5" />
    </svg>
  );
}

export default function OccupazioneIntegrata({ facilities, cdgByFacility, year }) {
  const rows = useMemo(() => {
    const active = (facilities ?? []).filter(f => !f.is_suspended && f.bed_count);
    return active
      .map(facility => {
        const records = cdgByFacility?.[facility.id];
        if (!records?.length) return null;
        const aggregated = aggregateCdgRecords(records);
        const summary = calcCdgSummary(aggregated, facility.bed_count);
        if (!summary) return null;
        const projection = projectOccupancy(facility, aggregated, 3);
        return { facility, summary, projection };
      })
      .filter(Boolean)
      .sort((a, b) => (a.summary.saturazione ?? 0) - (b.summary.saturazione ?? 0)); // più critiche in alto
  }, [facilities, cdgByFacility]);

  if (rows.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-8">Nessun dato di occupazione disponibile per le strutture filtrate.</p>;
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100">
        <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Occupazione per struttura</h3>
        <p className="text-[11px] text-slate-400 mt-0.5">Trend ultimi 6 mesi e proiezione a 3 mesi (media mobile pesata su ingressi/dimissioni)</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-slate-100 text-left text-slate-400 uppercase text-[10px]">
              <th className="px-4 py-2 font-semibold">Struttura</th>
              <th className="px-3 py-2 font-semibold text-right">Occupazione</th>
              <th className="px-3 py-2 font-semibold text-right">Δ mese prec.</th>
              <th className="px-3 py-2 font-semibold">Trend 6m</th>
              <th className="px-3 py-2 font-semibold text-right">Proiezione +3 mesi</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ facility, summary, projection }) => {
              const proj3 = projection?.projection?.[2];
              return (
                <tr key={facility.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-2 font-medium text-slate-700 whitespace-nowrap">{facility.name}</td>
                  <td className="px-3 py-2 text-right font-semibold text-slate-900">
                    {summary.saturazione != null ? `${summary.saturazione.toFixed(0)}%` : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className="inline-flex items-center gap-1 justify-end">
                      <TrendArrow delta={summary.deltaMom} />
                      {summary.deltaMom != null ? `${summary.deltaMom > 0 ? '+' : ''}${summary.deltaMom.toFixed(1)}pp` : '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2"><MiniTrendline trend12={summary.trend12} /></td>
                  <td className="px-3 py-2 text-right text-slate-600">
                    {proj3 ? `${proj3.occupazioneProiettata.toFixed(0)}%` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
