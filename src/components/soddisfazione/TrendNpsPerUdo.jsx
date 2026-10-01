// src/components/soddisfazione/TrendNpsPerUdo.jsx
// Sostituisce NpsTrendChart.jsx: multi-serie, una linea per UDO + una per
// ogni rilevazione a livello società in ambito, sullo stesso asse
// semestrale — invece di una struttura alla volta con banda UDO di sfondo.
import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { AlertTriangle } from 'lucide-react';
import { computeGroupNpsBySemester } from '../../utils/npsTrendStats';
import { buildSoddisfazioneGroups } from '../../utils/soddisfazioneGroups';

export default function TrendNpsPerUdo({ facilities, udos, companies, campaignsClient }) {
  const groups = useMemo(
    () => buildSoddisfazioneGroups(facilities, udos, companies, campaignsClient, []),
    [facilities, udos, companies, campaignsClient]
  );

  const series = useMemo(
    () => groups
      .map(g => ({ ...g, trend: computeGroupNpsBySemester(campaignsClient, g.facilityIds, g.companyIds) }))
      .filter(g => g.trend.length > 0),
    [groups, campaignsClient]
  );

  const chartData = useMemo(() => {
    const bySortKey = new Map();
    series.forEach(s => {
      s.trend.forEach(point => {
        if (!bySortKey.has(point.sortKey)) bySortKey.set(point.sortKey, { label: point.label, sortKey: point.sortKey });
        bySortKey.get(point.sortKey)[s.id] = point.mean;
      });
    });
    return [...bySortKey.values()].sort((a, b) => a.sortKey - b.sortKey);
  }, [series]);

  // Stesso criterio di detectNpsDecline (npsTrendStats.js), applicato per
  // gruppo invece che per singola struttura: 3 punti in calo consecutivo.
  const declining = useMemo(() => series.filter(s => {
    const t = s.trend;
    const n = t.length;
    return n >= 3 && t[n - 1].mean < t[n - 2].mean && t[n - 2].mean < t[n - 3].mean;
  }), [series]);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <div className="mb-3">
        <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Trend NPS per UDO</h3>
        <p className="text-[11px] text-slate-400 mt-0.5">Media per semestre — una linea per tipo UDO e per rilevazione societaria</p>
      </div>

      {declining.length > 0 && (
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 mb-3 w-fit flex-wrap">
          <AlertTriangle size={12} />
          {declining.map(s => s.label).join(', ')} in calo da 2 semestri consecutivi
        </div>
      )}

      {chartData.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-12">Nessuna campagna con NPS disponibile per questo filtro.</p>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} />
            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {series.map(s => (
              <Line
                key={s.id}
                dataKey={s.id}
                name={s.label}
                stroke={s.color}
                strokeWidth={2}
                strokeDasharray={s.kind === 'company' ? '5 3' : undefined}
                dot={{ r: 3 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
