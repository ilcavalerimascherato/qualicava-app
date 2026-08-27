// src/components/soddisfazione/WordCloudCommenti.jsx
// Word cloud dai commenti liberi, aggregabile per regione/società/tipo UDO
// (documento redesign /report, §3 Soddisfazione) tramite le strutture già
// filtrate da UniversalFilterBar. Costruita in-house: tag cloud CSS
// (font-size proporzionale alla frequenza), nessuna libreria esterna.
import React, { useEffect, useMemo, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { fetchCommentsForFacilities } from '../../services/surveyCommentsService';
import { computeWordFrequencies } from '../../utils/wordFrequency';

const MIN_FONT = 11;
const MAX_FONT = 30;
const PALETTE = ['#0ea5e9', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#3b82f6'];

export default function WordCloudCommenti({ facilityIds, fromDate, toDate }) {
  const [surveyType, setSurveyType] = useState('both');
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!facilityIds?.length) { setComments([]); return; }
    let cancelled = false;
    setLoading(true);
    fetchCommentsForFacilities(facilityIds, { fromDate, toDate, surveyType })
      .then(rows => { if (!cancelled) setComments(rows); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [facilityIds, fromDate, toDate, surveyType]);

  const words = useMemo(
    () => computeWordFrequencies(comments.map(c => c.note)),
    [comments]
  );

  const maxCount = words[0]?.count ?? 1;
  const fontSize = (count) => MIN_FONT + (count / maxCount) * (MAX_FONT - MIN_FONT);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-1 gap-3">
        <div className="flex items-center gap-2">
          <MessageSquare size={14} className="text-slate-400" />
          <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Commenti liberi</h3>
        </div>
        <div className="flex bg-slate-50 border border-slate-200 rounded-lg p-0.5">
          {[['both', 'Tutti'], ['client', 'Ospiti'], ['operator', 'Operatori']].map(([v, label]) => (
            <button key={v} onClick={() => setSurveyType(v)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                surveyType === v ? 'bg-white shadow text-emerald-700' : 'text-slate-500'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-slate-400 mb-3">{comments.length} commenti nel periodo selezionato</p>

      {loading ? (
        <p className="text-sm text-slate-400 text-center py-12 animate-pulse">Caricamento commenti...</p>
      ) : words.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-12">Nessun commento disponibile per i filtri selezionati.</p>
      ) : (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5 justify-center py-4">
          {words.map((w, i) => (
            <span
              key={w.word}
              title={`${w.word} · ${w.count} occorrenze`}
              style={{ fontSize: `${fontSize(w.count)}px`, color: PALETTE[i % PALETTE.length] }}
              className="font-bold leading-none"
            >
              {w.word}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
