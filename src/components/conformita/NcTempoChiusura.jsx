// src/components/conformita/NcTempoChiusura.jsx
// Tempo medio di chiusura, complessivo e per gravità (documento redesign
// /report, §4 Conformità & Rischio).
import React, { useMemo } from 'react';
import { Clock } from 'lucide-react';
import { computeAvgClosureTime } from '../../utils/ncStats';

const GRAVITA_ORDER = ['Alta', 'Media', 'Bassa'];
const GRAVITA_COLOR = { Bassa: 'text-slate-500', Media: 'text-amber-600', Alta: 'text-red-600' };

export default function NcTempoChiusura({ nonConformities }) {
  const { overall, byGravita, count } = useMemo(() => computeAvgClosureTime(nonConformities), [nonConformities]);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Clock size={14} className="text-slate-400" />
        <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Tempo medio di chiusura</h3>
      </div>

      {count === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">Nessuna NC chiusa nel periodo selezionato.</p>
      ) : (
        <>
          <div className="text-center mb-4">
            <span className="text-3xl font-bold text-slate-900">{overall}</span>
            <span className="text-sm text-slate-400 ml-1">giorni</span>
            <p className="text-[11px] text-slate-400 mt-0.5">Media su {count} NC chiuse</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {GRAVITA_ORDER.filter(g => byGravita[g] != null).map(g => (
              <div key={g} className="text-center bg-slate-50 rounded-xl py-2">
                <p className={`text-lg font-bold ${GRAVITA_COLOR[g]}`}>{byGravita[g]}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide">{g}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
