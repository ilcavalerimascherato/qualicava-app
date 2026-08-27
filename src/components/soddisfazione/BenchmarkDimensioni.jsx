// src/components/soddisfazione/BenchmarkDimensioni.jsx
// Benchmark per dimensione: media della struttura nel periodo vs media del
// suo tipo UDO (documento redesign /report, §3 Soddisfazione). Riusa
// RadarCategorie/NpsGauge/CATEGORIE_* già esistenti in AnalisiCampagnaPanel.jsx
// (usati oggi solo per una singola campagna) su un'aggregazione multi-campagna.
import React, { useMemo, useState, useEffect } from 'react';
import { RadarCategorie, NpsGauge } from '../AnalisiCampagnaPanel';
import { computeWeightedAvgScores } from '../../utils/surveyAggregation';

export default function BenchmarkDimensioni({ facilities, campaignsClient, campaignsOperator }) {
  const active = useMemo(() => (facilities ?? []).filter(f => !f.is_suspended).sort((a, b) => a.name.localeCompare(b.name)), [facilities]);
  const [selectedId, setSelectedId] = useState('');
  const [surveyType, setSurveyType] = useState('client');

  useEffect(() => {
    if (!selectedId && active.length > 0) setSelectedId(String(active[0].id));
  }, [active, selectedId]);

  const selectedFacility = active.find(f => String(f.id) === selectedId);
  const campaigns = surveyType === 'operator' ? campaignsOperator : campaignsClient;

  const peerIds = useMemo(() => {
    if (!selectedFacility) return [];
    return active.filter(f => f.udo_id === selectedFacility.udo_id).map(f => f.id);
  }, [active, selectedFacility]);

  const avgScores = useMemo(
    () => selectedFacility ? computeWeightedAvgScores(campaigns, [selectedFacility.id]) : {},
    [campaigns, selectedFacility]
  );
  const udoAvgScores = useMemo(
    () => peerIds.length ? computeWeightedAvgScores(campaigns, peerIds) : {},
    [campaigns, peerIds]
  );

  const hasData = Object.keys(avgScores).length > 0;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Benchmark per dimensione</h3>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-50 border border-slate-200 rounded-lg p-0.5">
            {[['client', 'Ospiti'], ['operator', 'Operatori']].map(([v, label]) => (
              <button key={v} onClick={() => setSurveyType(v)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                  surveyType === v ? 'bg-white shadow text-emerald-700' : 'text-slate-500'
                }`}>
                {label}
              </button>
            ))}
          </div>
          <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] font-medium outline-none focus:border-emerald-400">
            {active.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
      </div>

      {!hasData ? (
        <p className="text-sm text-slate-400 text-center py-12">
          Nessuna campagna {surveyType === 'operator' ? 'operatori' : 'ospiti'} disponibile per questa struttura.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-1">
            <NpsGauge nps={avgScores.nps_consiglio} />
          </div>
          <div className="col-span-2">
            <RadarCategorie avgScores={avgScores} udoAvgScores={udoAvgScores} surveyType={surveyType} />
          </div>
        </div>
      )}
    </div>
  );
}
