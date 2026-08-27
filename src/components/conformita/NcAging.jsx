// src/components/conformita/NcAging.jsx
// Aging delle NC aperte per fasce d'età (documento redesign /report, §4
// Conformità & Rischio: "le NC aperte da più di 90 giorni sono un
// indicatore di gestione, non di qualità").
import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { AlertTriangle } from 'lucide-react';
import { computeNcAging } from '../../utils/ncStats';

const BUCKET_COLOR = { '0-30gg': '#10b981', '30-60gg': '#f59e0b', '60-90gg': '#f97316', '>90gg': '#ef4444' };

export default function NcAging({ nonConformities }) {
  const { buckets, over90 } = useMemo(() => computeNcAging(nonConformities), [nonConformities]);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">Aging NC aperte</h3>
      <p className="text-[11px] text-slate-400 mb-3">Un'NC aperta da oltre 90 giorni segnala che il processo correttivo non funziona</p>

      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={buckets} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {buckets.map(b => <Cell key={b.label} fill={BUCKET_COLOR[b.label]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {over90.length > 0 && (
        <div className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5 w-fit">
          <AlertTriangle size={12} /> {over90.length} NC aperte da oltre 90 giorni
        </div>
      )}
    </div>
  );
}
