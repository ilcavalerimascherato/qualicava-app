// src/components/EconomicoTab.jsx
// Dettaglio economico di una società: usato sia nel tab "Economico" di
// DirectorFacility (solo ruolo 'director' in senso stretto, gestito dal
// chiamante) sia nella sessione /report "Economico" (EconomicoView, per
// sede/board/admin). Mostra Actual vs Budget mensile, trend annuale, costo
// del personale (assoluto e % sui ricavi) e struttura dei costi principali.
// Nessun dato di organico/turni: le chiusure mensili sono un P&L, non
// contengono un numero di persone.
import { useMemo } from 'react';
import { Wallet } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useEconomicoData } from '../hooks/useEconomicoData';

const MESI = ['', 'Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

function fmtEuro(n) {
  if (n === null || n === undefined) return '—';
  const neg = n < 0;
  return (neg ? '-' : '') + Math.round(Math.abs(n)).toLocaleString('it-IT') + ' €';
}
function fmtPct(n, digits = 1) {
  if (n === null || n === undefined) return '—';
  return n.toFixed(digits).replace('.', ',') + '%';
}

function DeltaBadge({ actual, budget, unit = '€' }) {
  if (actual == null || budget == null) return <span className="text-gray-400">—</span>;
  const delta = actual - budget;
  const color = delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-500' : 'text-gray-400';
  const arrow = delta > 0 ? '▲' : delta < 0 ? '▼' : '●';
  return (
    <span className={`font-semibold text-sm ${color}`}>
      {arrow} {unit === '€' ? fmtEuro(Math.abs(delta)) : fmtPct(Math.abs(delta))} vs budget
    </span>
  );
}

function KpiCard({ label, main, sub, badge }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-1">
      <span className="text-xs text-gray-500 uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold text-gray-800">{main ?? '—'}</span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
      {badge}
    </div>
  );
}

export default function EconomicoTab({ companyId, year }) {
  const { data, isLoading } = useEconomicoData(companyId, year);
  const companyName = data?.companyName;

  const merged = useMemo(() => {
    if (!data) return [];
    const byMese = {};
    data.actual.forEach(r => { byMese[r.mese] = { mese: r.mese, actual: r }; });
    data.budget.forEach(r => { byMese[r.mese] = { ...(byMese[r.mese] || { mese: r.mese }), budget: r }; });
    return Object.values(byMese).sort((a, b) => a.mese - b.mese);
  }, [data]);

  const chartData = useMemo(() => merged.map(m => ({
    mese: MESI[m.mese],
    ricaviActual: m.actual?.ricavi_totali ?? null,
    ricaviBudget: m.budget?.ricavi_totali ?? null,
    ebitdaActual: m.actual?.ebitda ?? null,
    ebitdaBudget: m.budget?.ebitda ?? null,
  })), [merged]);

  if (isLoading) {
    return <div className="text-sm text-gray-400 italic py-2">Caricamento dati economici…</div>;
  }

  if (!merged.length) {
    return (
      <div className="bg-gray-50 rounded-2xl border border-gray-200 p-5 flex items-start gap-3">
        <Wallet size={18} className="text-gray-400 shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Economico</h3>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed">
            Dato non disponibile — {companyName ? `"${companyName}"` : 'questa società'} non ha ancora una
            chiusura mensile caricata in QualiCAVA. Copertura oggi limitata a un sottoinsieme delle società
            del gruppo.
          </p>
        </div>
      </div>
    );
  }

  const last = merged.filter(m => m.actual).at(-1);
  const ricaviA = last?.actual?.ricavi_totali, ricaviB = last?.budget?.ricavi_totali;
  const ebitdaA = last?.actual?.ebitda, ebitdaB = last?.budget?.ebitda;
  const margA = ricaviA ? (ebitdaA / ricaviA * 100) : null;
  const occA = last?.actual?.occupazione_media_pct;
  const personaleA = last?.actual?.costi_personale, personaleB = last?.budget?.costi_personale;
  const personalePctA = ricaviA && personaleA != null ? (personaleA / ricaviA * 100) : null;

  // Voci di costo principali dell'ultimo mese actual — dato disponibile
  // dalle chiusure mensili (P&L), NON un dato di organico/turni: non c'è
  // un numero di persone in questa fonte.
  const VOCI_COSTO = [
    { key: 'costi_personale', label: 'Personale' },
    { key: 'costi_variabili_totali', label: 'Costi variabili' },
    { key: 'locazioni', label: 'Locazioni' },
    { key: 'utenze', label: 'Utenze' },
    { key: 'consulenze', label: 'Consulenze' },
    { key: 'costi_servizi_manutenzioni', label: 'Manutenzioni' },
    { key: 'altri_costi_gestione', label: 'Altri costi gestione' },
  ];
  const vociCosto = VOCI_COSTO
    .map(v => ({ ...v, actual: last?.actual?.[v.key], budget: last?.budget?.[v.key] }))
    .filter(v => v.actual != null || v.budget != null);
  const margineContribA = last?.actual?.margine_contribuzione;
  const ebitdarA = last?.actual?.ebitdar_pre_overhead;

  return (
    <div className="bg-gray-50 rounded-2xl border border-gray-200 p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Economico</h3>
          <p className="text-xs text-gray-400">{MESI[last?.mese]} {year} · {companyName}</p>
        </div>
        <span className="text-xs text-gray-400">Fonte: chiusura mensile Amministrazione</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="Ricavi" main={fmtEuro(ricaviA)} badge={<DeltaBadge actual={ricaviA} budget={ricaviB} />} />
        <KpiCard label="Costo personale" main={fmtEuro(personaleA)}
          sub={personalePctA != null ? `${fmtPct(personalePctA)} sui ricavi` : undefined}
          badge={<DeltaBadge actual={personaleA} budget={personaleB} />} />
        <KpiCard label="EBITDA" main={fmtEuro(ebitdaA)} badge={<DeltaBadge actual={ebitdaA} budget={ebitdaB} />} />
        <KpiCard label="Margine EBITDA" main={fmtPct(margA)} />
        <KpiCard label="Occupazione media" main={fmtPct(occA, 0)} />
        <KpiCard label="Margine di contribuzione" main={fmtEuro(margineContribA)}
          sub={ebitdarA != null ? `EBITDAR pre-overhead: ${fmtEuro(ebitdarA)}` : undefined} />
      </div>

      {vociCosto.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Struttura dei costi — {MESI[last?.mese]} {year}, actual vs budget
          </p>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-400 uppercase tracking-wide">
                <th className="py-1.5 pr-3 font-medium">Voce</th>
                <th className="py-1.5 pr-3 font-medium text-right">Actual</th>
                <th className="py-1.5 pr-3 font-medium text-right">% su ricavi</th>
                <th className="py-1.5 font-medium text-right">Budget</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {vociCosto.map(v => (
                <tr key={v.key}>
                  <td className="py-1.5 pr-3 text-gray-600">{v.label}</td>
                  <td className="py-1.5 pr-3 text-right text-gray-700">{fmtEuro(v.actual)}</td>
                  <td className="py-1.5 pr-3 text-right text-gray-400">
                    {ricaviA && v.actual != null ? fmtPct(v.actual / ricaviA * 100) : '—'}
                  </td>
                  <td className="py-1.5 text-right text-gray-400">{fmtEuro(v.budget)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {chartData.length > 1 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-3">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Ricavi — Actual vs Budget</p>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="mese" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                  tickFormatter={v => `${Math.round(v / 1000)}k`} width={34} />
                <Tooltip formatter={v => fmtEuro(v)} labelStyle={{ fontSize: '11px', fontWeight: 600 }}
                  contentStyle={{ fontSize: '11px', borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line name="Actual" dataKey="ricaviActual" stroke="#2563eb" strokeWidth={2} dot={{ r: 2 }} connectNulls />
                <Line name="Budget" dataKey="ricaviBudget" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 3" dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-3">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">EBITDA — Actual vs Budget</p>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="mese" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                  tickFormatter={v => `${Math.round(v / 1000)}k`} width={34} />
                <Tooltip formatter={v => fmtEuro(v)} labelStyle={{ fontSize: '11px', fontWeight: 600 }}
                  contentStyle={{ fontSize: '11px', borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line name="Actual" dataKey="ebitdaActual" stroke="#059669" strokeWidth={2} dot={{ r: 2 }} connectNulls />
                <Line name="Budget" dataKey="ebitdaBudget" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 3" dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-gray-400 uppercase tracking-wide">
              <th className="py-1.5 pr-3 font-medium">Mese</th>
              <th className="py-1.5 pr-3 font-medium text-right">Ricavi act.</th>
              <th className="py-1.5 pr-3 font-medium text-right">Ricavi bdg.</th>
              <th className="py-1.5 pr-3 font-medium text-right">EBITDA act.</th>
              <th className="py-1.5 pr-3 font-medium text-right">EBITDA bdg.</th>
              <th className="py-1.5 font-medium text-right">Occ. %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {merged.map(m => (
              <tr key={m.mese}>
                <td className="py-1.5 pr-3 text-gray-600">{MESI[m.mese]}</td>
                <td className="py-1.5 pr-3 text-right text-gray-700">{fmtEuro(m.actual?.ricavi_totali)}</td>
                <td className="py-1.5 pr-3 text-right text-gray-400">{fmtEuro(m.budget?.ricavi_totali)}</td>
                <td className={`py-1.5 pr-3 text-right ${m.actual?.ebitda < 0 ? 'text-red-500' : 'text-gray-700'}`}>{fmtEuro(m.actual?.ebitda)}</td>
                <td className="py-1.5 pr-3 text-right text-gray-400">{fmtEuro(m.budget?.ebitda)}</td>
                <td className="py-1.5 text-right text-gray-700">{fmtPct(m.actual?.occupazione_media_pct, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
