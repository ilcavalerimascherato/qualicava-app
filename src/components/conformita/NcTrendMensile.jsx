// src/components/conformita/NcTrendMensile.jsx
// Trend mensile di apertura NC (documento redesign /report, §4 Conformità &
// Rischio).
import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { computeNcMonthlyTrend } from '../../utils/ncStats';

export default function NcTrendMensile({ nonConformities }) {
  const trend = useMemo(() => computeNcMonthlyTrend(nonConformities, 12), [nonConformities]);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-3">Trend mensile NC (ultimi 12 mesi)</h3>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={trend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(v) => [v, 'NC aperte']} />
          <Line dataKey="count" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
