// src/components/economico/EconomicoDirettoreTab.jsx
// Tab "Economico" della dash Direttore (subito dopo "Panoramica", solo
// ruolo 'director' in senso stretto — gate applicato dal chiamante
// DirectorFacility.jsx). Sostituisce EconomicoTab (livello società): qui i
// dati sono la chiusura mensile P&L della singola struttura, importata da
// Impostazioni → Dati (vedi chiusuraMensileService.js).
//
// L'occupazione (box 3 e 4) NON viene dalla chiusura importata ma da
// cdg_mensile/v_cdg_mensile (calcCdgSummary, stessa fonte di Saturazione) —
// è il dato gestito nel tempo, mese per mese, mentre la chiusura P&L riporta
// solo giornate/occupazione del mese chiuso.
import { useMemo } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Wallet, Loader2 } from 'lucide-react';
import { useChiusuraMensile } from '../../hooks/useChiusuraMensile';
import { aggregateCdgRecords, calcCdgSummary } from '../../hooks/useCdgData';

const MESI = ['', 'Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

const PL_ROWS = [
  { key: 'ricavi',               label: '01. Ricavi',                  isCost: false },
  { key: 'global_service',       label: '06. Global Service',          isCost: true },
  { key: 'costi_personale',      label: '07. Costi del personale',     isCost: true },
  { key: 'consulenze',           label: '08. Consulenze',              isCost: true },
  { key: 'servizi_manutenzioni', label: '10. Servizi e manutenzioni',  isCost: true },
  { key: 'utenze',               label: '11. Utenze',                  isCost: true },
  { key: 'locazioni',            label: '17. Locazioni',               isCost: true },
  { key: 'ebitda',               label: 'EBITDA',                      isCost: false, total: true },
];

function fmtEuro(n) {
  if (n == null) return '—';
  const neg = n < 0;
  return (neg ? '-' : '') + Math.round(Math.abs(n)).toLocaleString('it-IT') + ' €';
}
function fmtNum(n) {
  return n == null ? '—' : Math.round(n).toLocaleString('it-IT');
}
function fmtPct(n, digits = 1) {
  return n == null ? '—' : n.toFixed(digits).replace('.', ',') + '%';
}

function deltaInfo(delta, base, isCost) {
  if (delta == null || base == null) return { cls: 'flat', arrow: '·', pctVal: null };
  const favorable = isCost ? delta < 0 : delta > 0;
  const flat = Math.abs(delta) < (Math.abs(base) * 0.001 || 1);
  const pctVal = base ? Math.abs(delta / base) * 100 : null;
  return {
    cls: flat ? 'flat' : (favorable ? 'good' : 'bad'),
    arrow: flat ? '·' : (delta > 0 ? '▲' : '▼'),
    pctVal,
  };
}

function DeltaChip({ delta, base, isCost, label }) {
  const d = deltaInfo(delta, base, isCost);
  const styles = {
    good: 'text-emerald-700 bg-emerald-50',
    bad:  'text-red-600 bg-red-50',
    flat: 'text-slate-400 bg-slate-50',
  };
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg ${styles[d.cls]}`}>
      {d.arrow} {fmtEuro(delta != null ? Math.abs(delta) : null)}
      {d.pctVal != null && <span className="font-medium opacity-70">({fmtPct(d.pctVal)} {label})</span>}
    </span>
  );
}

// Delta in punti percentuali (es. occupazione media) invece che in EUR —
// qui "favorevole" è sempre "maggiore è meglio" (occupazione più alta).
function PctDeltaChip({ value, label }) {
  if (value == null) return <span className="text-slate-400 text-xs">—</span>;
  const favorable = value >= 0;
  const styles = favorable ? 'text-emerald-700 bg-emerald-50' : 'text-red-600 bg-red-50';
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg ${styles}`}>
      {favorable ? '▲' : '▼'} {fmtPct(Math.abs(value))}
      <span className="font-medium opacity-70">{label}</span>
    </span>
  );
}

function Spark({ values, color = '#4f46e5', width = 84, height = 26 }) {
  if (!values?.length) return null;
  const max = Math.max(...values), min = Math.min(...values);
  const span = max === min ? 1 : max - min;
  const pad = 3;
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1 || 1)) * (width - pad * 2);
    const y = height - pad - ((v - min) / span) * (height - pad * 2);
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function KpiCard({ label, value, unit, delta, children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">{label}</p>
      {value !== undefined && (
        <p className="text-2xl font-black text-slate-800">{value}{unit && <span className="text-sm font-bold text-slate-400 ml-1">{unit}</span>}</p>
      )}
      {delta}
      {children}
    </div>
  );
}

export default function EconomicoDirettoreTab({ facility, year, cdgRecords }) {
  const { data, isLoading } = useChiusuraMensile(facility.id, year);

  const cdgAggregated = useMemo(() => aggregateCdgRecords(cdgRecords), [cdgRecords]);
  const cdgSummary = useMemo(
    () => calcCdgSummary(cdgAggregated, facility.bed_count),
    [cdgAggregated, facility.bed_count]
  );

  const actual = data?.actual ?? [];
  const budget = data?.budget ?? [];

  const lastMese = actual.at(-1)?.mese;

  const rows = useMemo(() => {
    if (!lastMese) return [];
    const budgetYtd = data.budget.filter(b => b.mese <= lastMese);
    const pyYtd = data.actualPrevYear.filter(p => p.mese <= lastMese);
    const sum = (list, key) => list.reduce((s, r) => s + (r[key] ?? 0), 0);
    return PL_ROWS.map(def => ({
      ...def,
      cy:  sum(data.actual, def.key),
      bdg: sum(budgetYtd, def.key),
      py:  sum(pyYtd, def.key),
      monthly: data.actual.map(r => r[def.key] ?? 0),
    }));
  }, [data, lastMese]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        <Loader2 size={20} className="animate-spin mr-2" /> Caricamento economico…
      </div>
    );
  }

  if (!actual.length) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
        <Wallet size={28} className="mx-auto text-slate-300 mb-3" />
        <p className="text-sm font-bold text-slate-600">Nessuna chiusura mensile importata per questa struttura</p>
        <p className="text-xs text-slate-400 mt-1">Chiedi all'amministrazione di caricarla da Impostazioni → Dati.</p>
      </div>
    );
  }

  const ricavi = rows.find(r => r.key === 'ricavi');
  const ebitda = rows.find(r => r.key === 'ebitda');
  const ultimo = actual.at(-1);

  const plOccupatoChart = actual.map(r => ({
    label: `${year}-${String(r.mese).padStart(2, '0')}`,
    ricavi: r.ricavi_pl_occupato,
    costoLocazione: r.costo_locazione_pl_occupato,
  }));

  const laundrySeries = actual.map(r => r.costo_medio_lavanderia ?? 0);
  const laundryCy = ultimo?.costo_medio_lavanderia;
  const laundryBdg = budget.find(b => b.mese === lastMese)?.costo_medio_lavanderia;

  const cateringSeries = actual.map(r => r.costo_medio_ristorazione ?? 0);
  const cateringCy = ultimo?.costo_medio_ristorazione;
  const cateringBdg = budget.find(b => b.mese === lastMese)?.costo_medio_ristorazione;
  const giornateErogateYtd = actual.reduce((s, r) => s + (r.giornata_alimentare ?? 0), 0);
  const giornateErogateBdgYtd = budget.filter(b => b.mese <= lastMese).reduce((s, r) => s + (r.giornata_alimentare ?? 0), 0);

  return (
    <div className="space-y-5">

      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-black text-slate-800 text-lg">Economico</h2>
        <span className="text-xs text-slate-400">
          Chiusura al {MESI[lastMese]} {year} · fonte: chiusura mensile CDG
        </span>
      </div>

      {/* Hero: Ricavi + EBITDA */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[ricavi, ebitda].map(r => (
          <div key={r.key} className="bg-white rounded-2xl border border-slate-200 p-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">{r.label} — YTD Gen–{MESI[lastMese]}</p>
            <p className="text-2xl font-black text-slate-800">{fmtEuro(r.cy)}</p>
            <div className="flex flex-wrap gap-2 mt-2.5">
              <DeltaChip delta={r.cy - r.bdg} base={r.bdg} isCost={r.isCost} label="vs Budget" />
              <DeltaChip delta={r.cy - r.py} base={r.py} isCost={r.isCost} label={`vs ${year - 1}`} />
            </div>
          </div>
        ))}
      </div>

      {/* Tabella conto economico */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-4 pt-4 pb-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Conto economico — YTD Gen–{MESI[lastMese]}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                <th className="text-left px-4 py-2">Voce</th>
                <th className="text-left px-2 py-2">Trend</th>
                <th className="text-right px-2 py-2">Actual</th>
                <th className="text-right px-4 py-2">Δ Budget</th>
                <th className="text-right px-4 py-2">Δ {year - 1}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(r => (
                <tr key={r.key} className={r.total ? 'bg-slate-50 font-bold' : ''}>
                  <td className="px-4 py-2 font-semibold text-slate-700">{r.label}</td>
                  <td className="px-2 py-2"><Spark values={r.monthly} color={r.total ? '#059669' : '#4f46e5'} /></td>
                  <td className="px-2 py-2 text-right font-bold text-slate-800">{fmtEuro(r.cy)}</td>
                  <td className="px-4 py-2 text-right"><DeltaChip delta={r.cy - r.bdg} base={r.bdg} isCost={r.isCost} label="Bdg" /></td>
                  <td className="px-4 py-2 text-right"><DeltaChip delta={r.cy - r.py} base={r.py} isCost={r.isCost} label={`'${String(year - 1).slice(2)}`} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Occupazione — 2 tile semplici + 2 card con valore e contesto accanto al grafico */}
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Occupazione — YTD Gen–{MESI[lastMese]}</p>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <KpiCard label="Totale giornate" value={fmtNum(actual.reduce((s, r) => s + (r.totale_giornate ?? 0), 0))} />
          <KpiCard label="Giornate occupate" value={fmtNum(actual.reduce((s, r) => s + (r.giornate_occupate ?? 0), 0))} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Occupazione media</p>
            <div className="flex items-end justify-between mb-2">
              <div>
                <p className="text-2xl font-black text-slate-800">{fmtPct(cdgSummary?.saturazione)}</p>
                <p className="text-[11px] text-slate-400">{cdgSummary ? `${MESI[cdgSummary.mese]} ${cdgSummary.anno}` : '—'}</p>
              </div>
              <PctDeltaChip value={cdgSummary?.deltaVsBudget} label="vs Budget" />
            </div>
            {cdgSummary?.trend12?.length > 1 ? (
              <ResponsiveContainer width="100%" height={130}>
                <LineChart data={cdgSummary.trend12} margin={{ top: 4, right: 8, left: -6, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" tickFormatter={l => MESI[parseInt(l.split('-')[1], 10)]} tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} width={38} />
                  <Tooltip formatter={v => v != null ? `${v}%` : '—'} labelFormatter={l => `${MESI[parseInt(l.split('-')[1], 10)]} ${l.split('-')[0]}`} />
                  <Legend iconType="line" wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="saturazione" name="Reale" stroke="#4f46e5" strokeWidth={2} dot={false} connectNulls />
                  <Line type="monotone" dataKey="budget" name="Budget" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 3" dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-slate-400 italic py-6 text-center">Dati insufficienti</p>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Ingressi e dimissioni</p>
            <div className="grid grid-cols-2 gap-3 mb-2">
              <div>
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide mb-0.5">Ingressi</p>
                <p className="text-2xl font-black text-slate-800">{cdgSummary?.ingressi12 ?? '—'}</p>
                <p className="text-[11px] text-slate-400">Ultimo mese: {cdgSummary?.ingressiMese ?? '—'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-red-600 uppercase tracking-wide mb-0.5">Dimissioni</p>
                <p className="text-2xl font-black text-slate-800">{cdgSummary?.dimissioni12 ?? '—'}</p>
                <p className="text-[11px] text-slate-400">Ultimo mese: {cdgSummary?.dimissioniMese ?? '—'}</p>
              </div>
            </div>
            {cdgSummary?.movimentiTrend12?.length > 1 ? (
              <ResponsiveContainer width="100%" height={130}>
                <BarChart data={cdgSummary.movimentiTrend12} margin={{ top: 4, right: 8, left: -6, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" tickFormatter={l => MESI[parseInt(l.split('-')[1], 10)]} tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} width={30} allowDecimals={false} />
                  <Tooltip labelFormatter={l => `${MESI[parseInt(l.split('-')[1], 10)]} ${l.split('-')[0]}`} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="ingressi" name="Ingressi" fill="#059669" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="dimissioni" name="Dimissioni" fill="#dc2626" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-slate-400 italic py-6 text-center">Dati insufficienti</p>
            )}
          </div>
        </div>
      </div>

      {/* Ricavi vs costo locazione per PL occupato */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Ricavi vs costo locazione, per posto letto occupato (€/mese)</p>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={plOccupatoChart} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tickFormatter={l => MESI[parseInt(l.split('-')[1], 10)]} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} width={50} tickFormatter={v => v.toLocaleString('it-IT')} />
            <Tooltip formatter={v => fmtEuro(v)} labelFormatter={l => `${MESI[parseInt(l.split('-')[1], 10)]} ${l.split('-')[0]}`} />
            <Legend iconType="line" wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="ricavi" name="Ricavi per PL occupato" stroke="#4f46e5" strokeWidth={2.5} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="costoLocazione" name="Costo locazione per PL occupato" stroke="#d97706" strokeWidth={2.5} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Altri indicatori di servizio */}
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Altri indicatori di servizio</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Costo medio servizio lavanderia</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black text-slate-800">{laundryCy != null ? laundryCy.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}</span>
              <span className="text-xs text-slate-400">€ / giornata</span>
            </div>
            <Spark values={laundrySeries} color="#4f46e5" width={160} height={32} />
            <p className="text-[11px] text-slate-400 mt-1">
              Budget {laundryBdg != null ? laundryBdg.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
              {' · '}
              <DeltaChip delta={laundryCy != null && laundryBdg != null ? laundryCy - laundryBdg : null} base={laundryBdg} isCost label="vs Budget" />
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">Costo medio gg alimentare</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-black text-slate-800">{cateringCy != null ? cateringCy.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}</span>
                  <span className="text-xs text-slate-400">€ / gg</span>
                </div>
                <p className="text-[11px] text-slate-400">{lastMese ? `${MESI[lastMese]} ${year}` : '—'}</p>
                <Spark values={cateringSeries} color="#d97706" width={140} height={32} />
                <p className="text-[11px] text-slate-400 mt-1">
                  Budget {cateringBdg != null ? cateringBdg.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                </p>
                <DeltaChip delta={cateringCy != null && cateringBdg != null ? cateringCy - cateringBdg : null} base={cateringBdg} isCost label="vs Bdg" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Giornate erogate {year}</p>
                <p className="text-xl font-black text-slate-800">{fmtNum(giornateErogateYtd)}</p>
                <DeltaChip delta={giornateErogateYtd - giornateErogateBdgYtd} base={giornateErogateBdgYtd} isCost={false} label="vs Bdg" />
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
