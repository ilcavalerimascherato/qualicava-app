// src/components/soddisfazione/OspitiVsOperatoriPanel.jsx
// Confronto soddisfazione ospiti vs operatori sulla stessa struttura
// (documento redesign /report, §3 Soddisfazione: "se la soddisfazione degli
// ospiti è alta ma quella degli operatori è bassa, c'è un rischio di
// turnover che i soli numeri ospiti non mostrano"). Stesso pattern
// ScatterChart di CorrelazioneOccupazioneSoddisfazione.jsx (Fase 2).
import React, { useMemo } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { computeWeightedAvgScores } from '../../utils/surveyAggregation';

// 'soddisfazione_generale' è l'unica chiave presente sia in CATEGORIE_CLIENT
// che in CATEGORIE_OPERATOR — l'unico asse realmente confrontabile tra i due
// questionari (le altre domande sono specifiche per tipo).
const METRIC_KEY = 'soddisfazione_generale';
const GAP_THRESHOLD = 15; // punti su 100: sopra questa soglia segnaliamo il gap

export default function OspitiVsOperatoriPanel({ facilities, campaignsClient, campaignsOperator }) {
  const points = useMemo(() => {
    const active = (facilities ?? []).filter(f => !f.is_suspended);
    return active.map(facility => {
      const client = computeWeightedAvgScores(campaignsClient, [facility.id])[METRIC_KEY];
      const operator = computeWeightedAvgScores(campaignsOperator, [facility.id])[METRIC_KEY];
      if (client == null || operator == null) return null;
      return { name: facility.name, ospiti: client, operatori: operator, gap: client - operator };
    }).filter(Boolean);
  }, [facilities, campaignsClient, campaignsOperator]);

  const atRisk = points.filter(p => p.gap >= GAP_THRESHOLD);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Ospiti vs Operatori</h3>
        {atRisk.length > 0 && (
          <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg">
            {atRisk.length} struttur{atRisk.length === 1 ? 'a' : 'e'} con gap &gt;{GAP_THRESHOLD}pt
          </span>
        )}
      </div>
      <p className="text-[11px] text-slate-400 mb-3">
        Soddisfazione generale ospiti vs operatori. Sotto la diagonale = ospiti soddisfatti, operatori meno — possibile segnale di turnover.
      </p>

      {points.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-12">
          Nessuna struttura con entrambi i dati (survey ospiti e operatori) disponibili nel periodo.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis type="number" dataKey="ospiti" name="Ospiti" domain={[0, 100]}
              tick={{ fontSize: 11, fill: '#64748b' }} label={{ value: 'Soddisfazione ospiti', position: 'insideBottom', offset: -5, fontSize: 11, fill: '#94a3b8' }} />
            <YAxis type="number" dataKey="operatori" name="Operatori" domain={[0, 100]}
              tick={{ fontSize: 11, fill: '#64748b' }} label={{ value: 'Soddisfazione operatori', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#94a3b8' }} />
            <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 100, y: 100 }]} stroke="#cbd5e1" strokeDasharray="4 4" />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload;
                return (
                  <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs">
                    <p className="font-bold text-slate-700 mb-1">{p.name}</p>
                    <p className="text-slate-500">Ospiti: <span className="font-semibold text-slate-700">{p.ospiti}</span></p>
                    <p className="text-slate-500">Operatori: <span className="font-semibold text-slate-700">{p.operatori}</span></p>
                    {p.gap >= GAP_THRESHOLD && <p className="text-amber-600 font-semibold mt-1">Gap {p.gap}pt</p>}
                  </div>
                );
              }}
            />
            <Scatter data={points} fill="#8b5cf6" fillOpacity={0.7} />
          </ScatterChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
