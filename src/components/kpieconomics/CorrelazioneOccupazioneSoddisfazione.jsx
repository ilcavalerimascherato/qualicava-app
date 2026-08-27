// src/components/kpieconomics/CorrelazioneOccupazioneSoddisfazione.jsx
// Scatter plot occupazione ↔ soddisfazione (documento redesign /report, §2
// KPI & Economics — "se chi ha più ospiti ha anche punteggi più bassi, è un
// segnale gestionale, non casuale"). Primo uso di ScatterChart nell'app.
import React, { useMemo } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { aggregateCdgRecords, calcCdgSummary } from '../../hooks/useCdgData';

export default function CorrelazioneOccupazioneSoddisfazione({ facilities, cdgByFacility, campaignsClient }) {
  const points = useMemo(() => {
    const active = (facilities ?? []).filter(f => !f.is_suspended && f.bed_count);
    return active.map(facility => {
      const records = cdgByFacility?.[facility.id];
      const summary = records?.length ? calcCdgSummary(aggregateCdgRecords(records), facility.bed_count) : null;
      const occupazione = summary?.saturazione ?? null;

      const npsValues = (campaignsClient ?? [])
        .filter(c => String(c.facility_id) === String(facility.id))
        .map(c => c.avg_scores?.nps_consiglio)
        .filter(v => v != null);
      const nps = npsValues.length > 0 ? npsValues.reduce((s, v) => s + v, 0) / npsValues.length : null;

      if (occupazione == null || nps == null) return null;
      return { name: facility.name, occupazione: Math.round(occupazione), nps: Math.round(nps) };
    }).filter(Boolean);
  }, [facilities, cdgByFacility, campaignsClient]);

  const avgNps = points.length > 0 ? points.reduce((s, p) => s + p.nps, 0) / points.length : null;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">Occupazione ↔ Soddisfazione</h3>
      <p className="text-[11px] text-slate-400 mb-3">Ogni punto è una struttura. Occupazione alta + NPS basso è un segnale gestionale.</p>

      {points.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-12">
          Nessuna struttura con entrambi i dati (occupazione e survey ospiti) disponibili.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis type="number" dataKey="occupazione" name="Occupazione" unit="%" domain={[0, 100]}
              tick={{ fontSize: 11, fill: '#64748b' }} label={{ value: 'Occupazione %', position: 'insideBottom', offset: -5, fontSize: 11, fill: '#94a3b8' }} />
            <YAxis type="number" dataKey="nps" name="NPS" domain={[0, 100]}
              tick={{ fontSize: 11, fill: '#64748b' }} label={{ value: 'NPS', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#94a3b8' }} />
            <ZAxis range={[80, 80]} />
            {avgNps != null && <ReferenceLine y={avgNps} stroke="#cbd5e1" strokeDasharray="4 4" />}
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              formatter={(value, name) => [name === 'occupazione' ? `${value}%` : value, name === 'occupazione' ? 'Occupazione' : 'NPS']}
              labelFormatter={() => ''}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload;
                return (
                  <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs">
                    <p className="font-bold text-slate-700 mb-1">{p.name}</p>
                    <p className="text-slate-500">Occupazione: <span className="font-semibold text-slate-700">{p.occupazione}%</span></p>
                    <p className="text-slate-500">NPS: <span className="font-semibold text-slate-700">{p.nps}</span></p>
                  </div>
                );
              }}
            />
            <Scatter data={points} fill="#3b82f6" fillOpacity={0.7} />
          </ScatterChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
