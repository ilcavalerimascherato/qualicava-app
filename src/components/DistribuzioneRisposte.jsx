// src/components/DistribuzioneRisposte.jsx
import { useMemo } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { buildDistribuzione, FASCIA_COLORS, ORDINE_FASCE } from '../utils/surveyDistribuzione';

// Fallback per eventuali chiavi non appartenenti alle 4 fasce standard
// (non dovrebbe mai servire con l'input di buildDistribuzione, ma il
// componente resta comunque generico su qualunque dizionario chiave→conteggio).
const FALLBACK_COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16'];

export default function DistribuzioneRisposte({ responsesJson, excludeKeys = [] }) {
  const questions = useMemo(
    () => buildDistribuzione(responsesJson).filter(q => !excludeKeys.includes(q.key)),
    [responsesJson, excludeKeys]
  );

  if (questions.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
        <p className="text-slate-400 text-sm font-medium">Nessun dato di risposta disponibile per questo periodo.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Distribuzione risposte per domanda</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {questions.map(q => {
          const entries = Object.entries(q.answers).filter(([, v]) => v > 0)
            .sort(([a], [b]) => ORDINE_FASCE.indexOf(a) - ORDINE_FASCE.indexOf(b));
          const total   = entries.reduce((s, [, v]) => s + v, 0);
          const pieData = entries.map(([name, value]) => ({ name, value }));
          return (
            <div key={q.key} className="border border-slate-100 rounded-xl p-4">
              <p className="text-sm font-black text-slate-700 mb-3 leading-tight">{q.question}</p>
              {pieData.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">Nessuna risposta</p>
              ) : (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width={140} height={140} minWidth={0}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={35} outerRadius={65} dataKey="value" paddingAngle={2} startAngle={90} endAngle={-270}>
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={FASCIA_COLORS[entry.name] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => [`${v} (${Math.round(v / total * 100)}%)`, '']} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-1.5">
                    {entries.map(([name, value], i) => (
                      <div key={name} className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: FASCIA_COLORS[name] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length] }}
                        />
                        <span className="text-xs text-slate-600 flex-1 truncate" title={name}>{name}</span>
                        <span className="text-xs font-black text-slate-700">{Math.round(value / total * 100)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
