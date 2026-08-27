// src/components/cruscotto/SocietaCard.jsx
// Vista di default raggruppata per società (nota di Claudio in calce al
// documento di redesign): una card per società, con semaforo aggregato ed
// espansione verso le strutture. Il campo economico è un placeholder — la
// fonte e la visibilità per ruolo restano decisioni della Presidente.
import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Building2 } from 'lucide-react';
import { calcCompanyRiskScore, calcFacilityRiskScore, RISK_BADGE } from '../../utils/riskScoreEngine';

function FacilityRow({ facility, kpiRecords }) {
  const risk = calcFacilityRiskScore(facility, kpiRecords);
  const badge = RISK_BADGE[risk.level] ?? RISK_BADGE.unknown;
  return (
    <div className="flex items-center justify-between py-2 px-3 hover:bg-slate-50 rounded-lg">
      <div className="flex items-center gap-2 min-w-0">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${badge.dot}`} />
        <span className="text-xs font-medium text-slate-700 truncate">{facility.name}</span>
        {facility.region && <span className="text-[10px] text-slate-400 flex-shrink-0">· {facility.region}</span>}
      </div>
      <span className={`text-[11px] font-semibold flex-shrink-0 ${badge.text}`}>
        {risk.score != null ? `${risk.score}/100` : '—'}
      </span>
    </div>
  );
}

export default function SocietaCard({ company, facilities, kpiRecords }) {
  const [expanded, setExpanded] = useState(false);

  const companyFacilities = useMemo(
    () => facilities.filter(f => String(f.company_id) === String(company.id) && !f.is_suspended),
    [facilities, company.id]
  );

  const risk = useMemo(
    () => calcCompanyRiskScore(company.id, facilities, kpiRecords),
    [company.id, facilities, kpiRecords]
  );
  const badge = RISK_BADGE[risk.level] ?? RISK_BADGE.unknown;

  if (companyFacilities.length === 0) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-50 transition-colors"
      >
        <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
          <Building2 size={16} className="text-indigo-600" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-900 truncate">{company.name}</p>
          <p className="text-[11px] text-slate-400">{companyFacilities.length} strutture</p>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="flex items-center gap-1.5 justify-end">
            <span className={`w-2 h-2 rounded-full ${badge.dot}`} />
            <span className={`text-xs font-bold ${badge.text}`}>{risk.score != null ? `${risk.score}/100` : '—'}</span>
          </div>
          <p className="text-[10px] text-slate-400">Fatturato/margine: dato non disponibile</p>
        </div>
        {expanded ? <ChevronDown size={16} className="text-slate-400 flex-shrink-0" /> : <ChevronRight size={16} className="text-slate-400 flex-shrink-0" />}
      </button>

      {expanded && (
        <div className="border-t border-slate-100 p-2">
          {companyFacilities
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(f => <FacilityRow key={f.id} facility={f} kpiRecords={kpiRecords} />)}
        </div>
      )}
    </div>
  );
}
