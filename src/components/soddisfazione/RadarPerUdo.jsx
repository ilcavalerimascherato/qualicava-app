// src/components/soddisfazione/RadarPerUdo.jsx
// Sostituisce BenchmarkDimensioni.jsx: niente più selettore di singola
// struttura (quella la si guarda dalla dash del Direttore, /facility/:id) —
// griglia di radar, uno per UDO (le "diverse realtà" del gruppo) + uno per
// ogni rilevazione a livello società in ambito (es. OASI, Il Gabbiano),
// ciascuno confrontato con la media dell'intero gruppo filtrato.
import React, { useMemo, useState } from 'react';
import { RadarCategorie } from '../AnalisiCampagnaPanel';
import { computeWeightedAvgScores } from '../../utils/surveyAggregation';
import { buildSoddisfazioneGroups } from '../../utils/soddisfazioneGroups';

export default function RadarPerUdo({ facilities, udos, companies, campaignsClient, campaignsOperator }) {
  const [surveyType, setSurveyType] = useState('client');
  const campaigns = surveyType === 'operator' ? campaignsOperator : campaignsClient;

  const groups = useMemo(
    () => buildSoddisfazioneGroups(facilities, udos, companies, campaignsClient, campaignsOperator),
    [facilities, udos, companies, campaignsClient, campaignsOperator]
  );

  const allFacilityIds = useMemo(
    () => (facilities ?? []).filter(f => !f.is_suspended).map(f => f.id),
    [facilities]
  );
  const allCompanyIds = useMemo(
    () => groups.filter(g => g.kind === 'company').flatMap(g => g.companyIds),
    [groups]
  );
  const groupAvgScores = useMemo(
    () => computeWeightedAvgScores(campaigns, allFacilityIds, allCompanyIds),
    [campaigns, allFacilityIds, allCompanyIds]
  );

  const cards = useMemo(
    () => groups
      .map(g => ({ ...g, avgScores: computeWeightedAvgScores(campaigns, g.facilityIds, g.companyIds) }))
      .filter(g => Object.keys(g.avgScores).length > 0),
    [groups, campaigns]
  );

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <div>
          <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Mappa dimensionale per UDO</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">Ogni profilo confrontato con la media dell'intero gruppo filtrato</p>
        </div>
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
      </div>

      {cards.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-12">
          Nessuna campagna {surveyType === 'operator' ? 'operatori' : 'ospiti'} disponibile per questo filtro.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {cards.map(g => (
            <div key={g.id} className="border border-slate-100 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: g.color }} />
                <p className="text-xs font-bold text-slate-700">{g.label}</p>
                {g.kind === 'company' && (
                  <span className="text-[9px] font-semibold text-violet-600 bg-violet-50 border border-violet-200 rounded px-1.5 py-0.5">
                    rilevazione societaria
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1.5 mb-1">
                <span className="text-2xl font-black text-slate-800">{g.avgScores.nps_consiglio ?? '–'}</span>
                <span className="text-[10px] text-slate-400">NPS /100</span>
              </div>
              <RadarCategorie
                avgScores={g.avgScores}
                udoAvgScores={groupAvgScores}
                surveyType={surveyType}
                primaryLabel={g.label}
                compareLabel="Media gruppo"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
