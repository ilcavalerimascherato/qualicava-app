// src/components/economico/EconomicoView.jsx
// Sezione /report ③ "Economico" per sede/board/admin/superadmin (permesso
// 'viewReportSections', gate applicato dal chiamante ReportPage). Vista
// portfolio: tutte le strutture con almeno una chiusura mensile importata
// (chiusura_mensile_struttura), messe insieme invece di guardate una alla
// volta per società — l'obiettivo è la visione d'insieme da sottoporre al
// Board, non il dettaglio di una singola struttura (quello vive nel tab
// "Economico" della dash Direttore, EconomicoDirettoreTab.jsx).
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer } from 'recharts';
import { Wallet, Loader2 } from 'lucide-react';
import { useChiusuraPortfolio } from '../../hooks/useChiusuraPortfolio';

const BAR_COLORS = ['#4f46e5', '#059669', '#d97706', '#0891b2', '#db2777', '#7c3aed'];

function fmtEuro(n) {
  if (n == null) return '—';
  return Math.round(n).toLocaleString('it-IT') + ' €';
}
function fmtPct(n, digits = 1) {
  return n == null ? '—' : (n * 100).toFixed(digits).replace('.', ',') + '%';
}

function DeltaChip({ delta, base }) {
  if (delta == null || base == null) return <span className="text-slate-400 text-xs">—</span>;
  const favorable = delta >= 0;
  const pct = base ? Math.abs(delta / base) * 100 : null;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg ${favorable ? 'text-emerald-700 bg-emerald-50' : 'text-red-600 bg-red-50'}`}>
      {favorable ? '▲' : '▼'} {fmtEuro(Math.abs(delta))}
      {pct != null && <span className="font-medium opacity-70">({fmtPct(pct / 100)})</span>}
    </span>
  );
}

export default function EconomicoView({ year }) {
  const { data: portfolio, isLoading } = useChiusuraPortfolio(year);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <Loader2 size={20} className="animate-spin mr-2" /> Caricamento portfolio…
      </div>
    );
  }

  if (!portfolio || portfolio.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
        <Wallet size={28} className="mx-auto text-gray-300 mb-3" />
        <p className="text-sm font-bold text-gray-600">Nessuna chiusura mensile importata</p>
        <p className="text-xs text-gray-400 mt-1">
          Le strutture compariranno qui man mano che verranno caricate da Impostazioni → Dati.
        </p>
      </div>
    );
  }

  const totRicavi = portfolio.reduce((s, p) => s + p.ricaviYtd, 0);
  const totEbitda = portfolio.reduce((s, p) => s + p.ebitdaYtd, 0);
  const occValues = portfolio.map(p => p.occupazioneMedia).filter(v => v != null);
  const avgOcc = occValues.length ? occValues.reduce((a, b) => a + b, 0) / occValues.length : null;

  const chartData = portfolio.slice().sort((a, b) => b.ebitdaYtd - a.ebitdaYtd);

  return (
    <div className="space-y-5">

      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-black text-gray-800 text-lg">Economico — Portfolio strutture</h2>
        <span className="text-xs text-gray-400">{portfolio.length} strutture con chiusura importata · anno {year}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Ricavi portfolio — YTD</p>
          <p className="text-2xl font-black text-gray-800">{fmtEuro(totRicavi)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">EBITDA portfolio — YTD</p>
          <p className="text-2xl font-black text-gray-800">{fmtEuro(totEbitda)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Occupazione media portfolio</p>
          <p className="text-2xl font-black text-gray-800">{fmtPct(avgOcc)}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">EBITDA per struttura — YTD</p>
        <ResponsiveContainer width="100%" height={Math.max(120, chartData.length * 46)}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => v.toLocaleString('it-IT')} />
            <YAxis type="category" dataKey="facilityName" tick={{ fontSize: 12, fontWeight: 600 }} width={220} />
            <Tooltip formatter={v => fmtEuro(v)} />
            <Bar dataKey="ebitdaYtd" name="EBITDA YTD" radius={[0, 6, 6, 0]} barSize={22}>
              {chartData.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-4 pt-4 pb-2">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Dettaglio per struttura</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                <th className="text-left px-4 py-2">Struttura</th>
                <th className="text-right px-3 py-2">Ricavi YTD</th>
                <th className="text-right px-3 py-2">EBITDA YTD</th>
                <th className="text-right px-3 py-2">Occupazione</th>
                <th className="text-right px-4 py-2">Δ EBITDA vs Budget</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {chartData.map((p, i) => (
                <tr key={p.facilityId}>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-2 font-semibold text-gray-700">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: BAR_COLORS[i % BAR_COLORS.length] }} />
                      {p.facilityName}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold text-gray-700">{fmtEuro(p.ricaviYtd)}</td>
                  <td className="px-3 py-2.5 text-right font-bold text-gray-700">{fmtEuro(p.ebitdaYtd)}</td>
                  <td className="px-3 py-2.5 text-right text-gray-600">{fmtPct(p.occupazioneMedia)}</td>
                  <td className="px-4 py-2.5 text-right"><DeltaChip delta={p.ebitdaYtd - p.ebitdaBudgetYtd} base={p.ebitdaBudgetYtd} /></td>
                </tr>
              ))}
              <tr className="bg-gray-50 font-bold">
                <td className="px-4 py-2.5 text-gray-700">Totale portfolio</td>
                <td className="px-3 py-2.5 text-right text-gray-800">{fmtEuro(totRicavi)}</td>
                <td className="px-3 py-2.5 text-right text-gray-800">{fmtEuro(totEbitda)}</td>
                <td className="px-3 py-2.5 text-right text-gray-800">{fmtPct(avgOcc)}</td>
                <td className="px-4 py-2.5 text-right text-gray-400">—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
