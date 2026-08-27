// src/components/conformita/NcDistribuzione.jsx
// Distribuzione NC per tipologia, gravità, stato (documento redesign
// /report, §4 Conformità & Rischio).
import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { computeNcDistribution } from '../../utils/ncStats';

const GRAVITA_COLOR = { Bassa: '#94a3b8', Media: '#f59e0b', Alta: '#ef4444' };
const STATO_COLOR = { Aperto: '#ef4444', Pending: '#f59e0b', Chiuso: '#10b981' };

function DistChart({ title, data, colorMap, defaultColor = '#3b82f6' }) {
  const chartData = useMemo(
    () => Object.entries(data).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    [data]
  );

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-3">{title}</h4>
      {chartData.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">Nessun dato</p>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(120, chartData.length * 32)}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
            <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11, fill: '#475569' }} />
            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {chartData.map(d => <Cell key={d.name} fill={colorMap?.[d.name] ?? defaultColor} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default function NcDistribuzione({ nonConformities }) {
  const byTipologia = useMemo(() => computeNcDistribution(nonConformities, 'classificazione'), [nonConformities]);
  const byGravita   = useMemo(() => computeNcDistribution(nonConformities, 'gravita'), [nonConformities]);
  const byStato     = useMemo(() => computeNcDistribution(nonConformities, 'stato'), [nonConformities]);

  return (
    <div className="grid grid-cols-3 gap-4">
      <DistChart title="Per tipologia" data={byTipologia} />
      <DistChart title="Per gravità" data={byGravita} colorMap={GRAVITA_COLOR} />
      <DistChart title="Per stato" data={byStato} colorMap={STATO_COLOR} />
    </div>
  );
}
