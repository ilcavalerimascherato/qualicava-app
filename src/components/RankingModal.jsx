import React, { useMemo } from 'react';
import { X, Trophy, Users, Briefcase, BarChart2, ChefHat } from 'lucide-react';

function computeScore(f) {
  let score = 0;
  if (f.clientCompleted) score += 25;
  if (f.staffCompleted)  score += 25;
  if (f.isKpiGreen)      score += 30;
  if (f.haccp_semaforo === 'verde')  score += 20;
  else if (f.haccp_semaforo === 'giallo') score += 10;
  return score;
}

function getBand(score) {
  if (score >= 67) return { label: 'In regola',  bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', bar: 'bg-emerald-500' };
  if (score >= 34) return { label: 'Attenzione', bg: 'bg-amber-100',   text: 'text-amber-700',   border: 'border-amber-200',   bar: 'bg-amber-500'   };
  return              { label: 'Critico',     bg: 'bg-rose-100',   text: 'text-rose-700',   border: 'border-rose-200',   bar: 'bg-rose-500'   };
}

function HaccpDot({ semaforo }) {
  const map = {
    verde:  'bg-emerald-500',
    giallo: 'bg-amber-400',
    rosso:  'bg-rose-500',
    grigio: 'bg-slate-400',
  };
  if (!semaforo) return null;
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${map[semaforo] ?? 'bg-slate-300'} flex-shrink-0`} title={`HACCP: ${semaforo}`} />;
}

export default function RankingModal({ isOpen, onClose, facilities = [] }) {
  const ranked = useMemo(() => {
    return facilities
      .filter(f => !f.is_suspended)
      .map(f => ({ ...f, score: computeScore(f) }))
      .sort((a, b) => a.score - b.score);
  }, [facilities]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-50 flex items-center justify-center p-6 animate-in fade-in">
      <div className="bg-white rounded-3xl w-full max-w-3xl flex flex-col shadow-2xl overflow-hidden font-sans" style={{ maxHeight: '88vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-7 pb-5 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-600 rounded-2xl text-white shadow">
              <Trophy size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-none">Ranking Strutture</h2>
              <p className="text-xs text-slate-400 font-bold mt-0.5">Ordinate dal punteggio più basso al più alto · {ranked.length} strutture</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-800 rounded-full transition-colors bg-slate-100 hover:bg-slate-200">
            <X size={20} />
          </button>
        </div>

        {/* Legend */}
        <div className="px-8 py-3 bg-slate-50 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Punteggio:</span>
            {[
              { Icon: Users,     label: 'Clienti',   pts: '+25', color: 'text-indigo-600' },
              { Icon: Briefcase, label: 'Staff',      pts: '+25', color: 'text-indigo-600' },
              { Icon: BarChart2, label: 'KPI',        pts: '+30', color: 'text-indigo-600' },
              { Icon: ChefHat,   label: 'HACCP verde',pts: '+20', color: 'text-emerald-600' },
              { Icon: ChefHat,   label: 'HACCP giallo',pts: '+10', color: 'text-amber-500' },
            ].map(({ Icon, label, pts, color }) => (
              <span key={label} className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                <Icon size={10} className={color} /> {label} <span className={`font-black ${color}`}>{pts}</span>
              </span>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-2">
          {ranked.length === 0 ? (
            <div className="text-center py-16 text-slate-400 font-bold">Nessuna struttura attiva.</div>
          ) : (
            ranked.map((f, i) => {
              const band = getBand(f.score);
              return (
                <div
                  key={f.id}
                  className={`flex items-center gap-4 px-4 py-3 rounded-2xl border ${band.border} ${band.bg} transition-all`}
                >
                  {/* Position */}
                  <div className="flex-shrink-0 w-8 text-center">
                    <span className={`text-sm font-black ${band.text}`}>#{i + 1}</span>
                  </div>

                  {/* Name + meta */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <HaccpDot semaforo={f.haccp_semaforo} />
                      <span className="text-sm font-black text-slate-800 truncate">{f.name}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5">
                      {f.udo_name || '—'}{f.region ? ` · ${f.region}` : ''}
                    </p>
                  </div>

                  {/* Score breakdown chips */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Chip active={f.clientCompleted} label="CLI" activeColor="bg-indigo-600" />
                    <Chip active={f.staffCompleted}  label="STA" activeColor="bg-indigo-600" />
                    <Chip active={f.isKpiGreen}      label="KPI" activeColor="bg-indigo-600" />
                    <Chip
                      active={f.haccp_semaforo === 'verde' || f.haccp_semaforo === 'giallo'}
                      label="HAC"
                      activeColor={f.haccp_semaforo === 'verde' ? 'bg-emerald-600' : 'bg-amber-500'}
                    />
                  </div>

                  {/* Score bar + number */}
                  <div className="flex items-center gap-2 flex-shrink-0 w-28">
                    <div className="flex-1 h-2 bg-white/70 rounded-full overflow-hidden border border-slate-200">
                      <div
                        className={`h-full ${band.bar} transition-all duration-500`}
                        style={{ width: `${f.score}%` }}
                      />
                    </div>
                    <span className={`text-sm font-black w-8 text-right ${band.text}`}>{f.score}</span>
                  </div>

                  {/* Status chip */}
                  <div className="flex-shrink-0 w-24 text-right">
                    <span className={`inline-block px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide border ${band.bg} ${band.text} ${band.border}`}>
                      {band.label}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function Chip({ active, label, activeColor }) {
  return (
    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wide ${
      active ? `${activeColor} text-white` : 'bg-white/60 text-slate-400 border border-slate-200'
    }`}>
      {label}
    </span>
  );
}
