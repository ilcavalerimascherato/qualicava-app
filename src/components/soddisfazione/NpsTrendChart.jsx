// src/components/soddisfazione/NpsTrendChart.jsx
// Trend NPS nel tempo per struttura, con banda di gruppo (media ± 1 dev.
// standard delle strutture dello stesso tipo UDO) ed early warning se in
// calo da 2 semestri consecutivi (documento redesign /report, §3
// Soddisfazione).
import React, { useMemo, useState, useEffect } from 'react';
import { ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { AlertTriangle } from 'lucide-react';
import { computeFacilityNpsTrend, computeGroupNpsBySemester, detectNpsDecline } from '../../utils/npsTrendStats';

export default function NpsTrendChart({ facilities, campaignsClient }) {
  const active = useMemo(() => (facilities ?? []).filter(f => !f.is_suspended).sort((a, b) => a.name.localeCompare(b.name)), [facilities]);
  const [selectedId, setSelectedId] = useState('');

  useEffect(() => {
    if (!selectedId && active.length > 0) setSelectedId(String(active[0].id));
  }, [active, selectedId]);

  const selectedFacility = active.find(f => String(f.id) === selectedId);

  const peerIds = useMemo(() => {
    if (!selectedFacility) return [];
    return active.filter(f => f.udo_id === selectedFacility.udo_id).map(f => f.id);
  }, [active, selectedFacility]);

  const trend = useMemo(
    () => selectedFacility ? computeFacilityNpsTrend(campaignsClient, selectedFacility.id) : [],
    [campaignsClient, selectedFacility]
  );
  const groupBySemester = useMemo(
    () => peerIds.length ? computeGroupNpsBySemester(campaignsClient, peerIds) : [],
    [campaignsClient, peerIds]
  );

  const chartData = useMemo(() => {
    const groupByKey = new Map(groupBySemester.map(g => [g.sortKey, g]));
    return trend.map(t => {
      const g = groupByKey.get(t.sortKey);
      const lower = g ? Math.max(0, g.mean - g.std) : null;
      const upper = g ? Math.min(100, g.mean + g.std) : null;
      return {
        label: t.label,
        nps: t.nps,
        groupMean: g?.mean ?? null,
        groupLower: lower,
        groupRange: lower != null && upper != null ? upper - lower : null,
      };
    });
  }, [trend, groupBySemester]);

  const declining = useMemo(() => detectNpsDecline(trend), [trend]);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3 gap-3">
        <div>
          <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Trend NPS nel tempo</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">Per semestre, con banda media ± dev. standard dello stesso tipo UDO</p>
        </div>
        <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] font-medium outline-none focus:border-emerald-400">
          {active.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </div>

      {declining && (
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 mb-3 w-fit">
          <AlertTriangle size={12} /> NPS in calo da 2 semestri consecutivi — early warning
        </div>
      )}

      {chartData.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-12">Nessuna campagna con NPS disponibile per questa struttura.</p>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} />
            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Area dataKey="groupLower" stackId="band" stroke="none" fill="transparent" legendType="none" />
            <Area dataKey="groupRange" stackId="band" stroke="none" fill="#94a3b8" fillOpacity={0.18} name="Banda gruppo (±1σ)" />
            <Line dataKey="groupMean" stroke="#94a3b8" strokeDasharray="4 2" strokeWidth={1.5} dot={false} name="Media gruppo" connectNulls />
            <Line dataKey="nps" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3 }} name={selectedFacility?.name ?? 'Struttura'} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
