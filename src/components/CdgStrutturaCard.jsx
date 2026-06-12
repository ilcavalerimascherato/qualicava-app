// src/components/CdgStrutturaCard.jsx
import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { aggregateCdgRecords, calcCdgSummary } from '../hooks/useCdgData';

function cdgSemaforo(summary) {
  if (!summary || summary.deltaVsBudget == null) return 'grigio';
  if (summary.deltaVsBudget >= -2) return 'verde';
  if (summary.deltaVsBudget >= -5) return 'giallo';
  return 'rosso';
}

const ST = {
  verde:  { ring: 'ring-green-300',  bg: 'bg-green-50',  dot: 'bg-green-500',  label: 'text-green-700'  },
  giallo: { ring: 'ring-yellow-300', bg: 'bg-yellow-50', dot: 'bg-yellow-400', label: 'text-yellow-700' },
  rosso:  { ring: 'ring-red-300',    bg: 'bg-red-50',    dot: 'bg-red-500',    label: 'text-red-700'    },
  grigio: { ring: 'ring-gray-200',   bg: 'bg-white',     dot: 'bg-gray-300',   label: 'text-gray-400'   },
};

function MiniSparkline({ trend12 }) {
  if (!trend12?.length) return null;
  const pts = trend12.map(t => t.saturazione).filter(v => v != null);
  if (pts.length < 2) return null;
  const min = Math.min(...pts) - 2;
  const max = Math.max(...pts) + 2;
  const range = max - min || 1;
  const W = 72, H = 28, pad = 2;
  const coords = pts.map((v, i) => {
    const x = pad + (i / (pts.length - 1)) * (W - pad * 2);
    const y = H - pad - ((v - min) / range) * (H - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg width={W} height={H}>
      <polyline points={coords.join(' ')} fill="none"
        stroke="#3b82f6" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function Delta({ value, unit = '%', digits = 1 }) {
  if (value == null) return <span className="text-gray-300">—</span>;
  const color = value > 0 ? 'text-green-600' : value < 0 ? 'text-red-500' : 'text-gray-400';
  const Icon  = value > 0 ? TrendingUp : value < 0 ? TrendingDown : Minus;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${color}`}>
      <Icon size={10} />
      {Math.abs(value).toFixed(digits)}{unit}
    </span>
  );
}

export default function CdgStrutturaCard({ facility, cdgRecords }) {
  const aggregated = useMemo(() => aggregateCdgRecords(cdgRecords), [cdgRecords]);
  const summary    = useMemo(
    () => calcCdgSummary(aggregated, facility.bed_count || 0),
    [aggregated, facility.bed_count]
  );

  const semaforo = cdgSemaforo(summary);
  const s = ST[semaforo];
  const meseLabel = summary ? `al 31/${String(summary.mese).padStart(2,'0')}/${summary.anno}` : null;

  return (
    <div className={`rounded-xl border ring-1 ${s.ring} ${s.bg} p-4 flex flex-col gap-3`}>

      {/* Header nome + semaforo */}
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0">
          <p className="text-xs font-bold text-gray-700 truncate leading-tight">{facility.name}</p>
          {meseLabel && <p className="text-[10px] text-gray-400 mt-0.5">{meseLabel}</p>}
        </div>
        <span className={`w-2.5 h-2.5 rounded-full mt-0.5 flex-shrink-0 ${s.dot}`} />
      </div>

      {!summary ? (
        <p className="text-[11px] text-gray-400 italic">Nessun dato CDG</p>
      ) : (
        <>
          {/* Saturazione + Budget */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/80 rounded-lg p-2.5">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">Saturazione</p>
              <p className="text-xl font-bold text-gray-800 leading-none">
                {summary.saturazione != null ? `${summary.saturazione.toFixed(1)}%` : '—'}
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                <Delta value={summary.deltaMom} unit="pp" digits={1} />
                <span className="text-[10px] text-gray-400">MoM</span>
              </div>
              {summary.mediaSat12 != null && (
                <p className="text-[10px] text-gray-400 mt-1">
                  Media 12m: <span className="font-medium text-gray-600">
                    {summary.mediaSat12.toFixed(1)}%
                  </span>
                </p>
              )}
            </div>

            <div className="bg-white/80 rounded-lg p-2.5">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">Budget</p>
              <p className="text-xl font-bold text-gray-800 leading-none">
                {summary.budgetSat != null ? `${summary.budgetSat.toFixed(1)}%` : '—'}
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                <Delta value={summary.pctVsBudget} unit="%" digits={1} />
                <span className="text-[10px] text-gray-400">vs bdg</span>
              </div>
              {summary.mediaBdg12 != null && (
                <p className="text-[10px] text-gray-400 mt-1">
                  Media 12m: <span className="font-medium text-gray-600">
                    {summary.mediaBdg12.toFixed(1)}%
                  </span>
                </p>
              )}
            </div>
          </div>

          {/* Ingressi / Dimissioni */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/80 rounded-lg px-2.5 py-2">
              <p className="text-[10px] text-gray-500 mb-0.5">Ingressi 12m</p>
              <p className="text-base font-bold text-gray-800">{summary.ingressi12}</p>
              <p className="text-[10px] text-gray-400">
                ultimo mese: <span className="font-medium">{summary.ingressiMese}</span>
              </p>
            </div>
            <div className="bg-white/80 rounded-lg px-2.5 py-2">
              <p className="text-[10px] text-gray-500 mb-0.5">Dimissioni 12m</p>
              <p className="text-base font-bold text-gray-800">{summary.dimissioni12}</p>
              <p className="text-[10px] text-gray-400">
                ultimo mese: <span className="font-medium">{summary.dimissioniMese}</span>
              </p>
            </div>
          </div>

          {/* Trend sparkline */}
          <div className="flex items-center justify-between pt-1 border-t border-gray-100">
            <span className="text-[10px] text-gray-400">
              Trend sat. {summary.mesiDisponibili}m
            </span>
            <MiniSparkline trend12={summary.trend12} />
          </div>
        </>
      )}
    </div>
  );
}
