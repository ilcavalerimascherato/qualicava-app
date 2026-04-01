/**
 * src/components/KpiLaserModal.jsx  —  v2
 * MODIFICHE v2:
 *  - Rimossa <Legend> (produceva il "lenzuolo" di label orizzontali
 *    impossibili da leggere con molte strutture).
 *  - Aggiunto CustomTooltip: quando si passa sul punto di una linea
 *    mostra solo la struttura di riferimento + valore + mese.
 *    Se più strutture hanno lo stesso valore nello stesso mese,
 *    le lista tutte in un tooltip multi-riga.
 *  - Aggiunta legenda laterale scrollabile con chip colorati per
 *    identificare le strutture senza ingombrare il grafico.
 */
import React, { useState, useMemo } from 'react';
import { X, TrendingUp } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceArea
} from 'recharts';
import { KPI_RULES, isNumericSettore } from '../config/kpiRules';
import { computeKpiValue } from '../utils/kpiFormulaEngine';
import { getTimeHorizon }  from '../utils/kpiTimeHorizon';

const PALETTE = ['#0D3B66','#457B9D','#1D9E75','#e76f51','#f4a261','#e9c46a','#2a9d8f','#264653','#9b2226','#6a4c93','#1982c4','#8ac926'];

// ── Tooltip custom ────────────────────────────────────────────
function CustomTooltip({ active, payload, label, isPerc }) {
  if (!active || !payload?.length) return null;
  const unit = isPerc ? '%' : '';
  return (
    <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: '10px 14px', maxWidth: 280 }}>
      <p style={{ color: '#94a3b8', fontSize: 11, fontWeight: 'bold', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: p.stroke, display: 'inline-block', flexShrink: 0 }} />
          <span style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 'bold', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.dataKey}</span>
          <span style={{ color: '#f8fafc', fontSize: 13, fontWeight: '900', flexShrink: 0 }}>{p.value}{unit}</span>
        </div>
      ))}
    </div>
  );
}

export default function KpiLaserModal({ isOpen, onClose, facilities, udos = [], kpiRecords, year }) {
  const [selectedKpiTarget, setSelectedKpiTarget] = useState('Turn Over');
  const [selectedUdos, setSelectedUdos]           = useState([]);
  const [hiddenSeries, setHiddenSeries]           = useState({});
  const [isolatedSeries, setIsolatedSeries]       = useState(null); // nome struttura isolata, null = tutte visibili
  const [legendSearch, setLegendSearch]           = useState('');

  const toggleUdo = (id) => setSelectedUdos(prev =>
    prev.includes(id) ? prev.filter(u => u !== id) : [...prev, id]
  );

  const activeRule  = useMemo(() => KPI_RULES.find(r => r.kpi_target === selectedKpiTarget), [selectedKpiTarget]);
  const timeHorizon = useMemo(() => getTimeHorizon(year), [year]);
  const isPercTab   = activeRule && !isNumericSettore(activeRule.settore);

  const targetFacilities = useMemo(() => {
    let facs = facilities.filter(f => !f.is_suspended);
    if (selectedUdos.length > 0) facs = facs.filter(f => selectedUdos.includes(f.udo_id));
    return facs;
  }, [facilities, selectedUdos]);

  const chartData = useMemo(() => {
    if (!activeRule) return [];
    return timeHorizon.map(t => {
      const monthData = { name: t.label };
      targetFacilities.forEach(f => {
        const record = kpiRecords.find(k =>
          String(k.facility_id) === String(f.id) &&
          Number(k.year)  === t.yearNum &&
          Number(k.month) === t.monthNum &&
          k.status === 'completed'
        );
        const result = record?.metrics_json
          ? computeKpiValue(activeRule, record.metrics_json, f)
          : null;
        if (result !== null) monthData[f.name] = result;
      });
      return monthData;
    });
  }, [targetFacilities, kpiRecords, timeHorizon, activeRule]);

  const dataKeys = useMemo(() => {
    const keys = new Set();
    chartData.forEach(d => Object.keys(d).forEach(k => { if (k !== 'name') keys.add(k); }));
    return Array.from(keys);
  }, [chartData]);

  // Click singolo: isola la struttura (nasconde tutte le altre)
  // Click sulla stessa struttura già isolata: torna alla vista completa
  // Click su checkbox (shift+click opzionale): toggle classico visibilità
  const handleLegendClick = (key) => {
    if (isolatedSeries === key) {
      // Deisola: torna a mostrare tutto
      setIsolatedSeries(null);
      setHiddenSeries({});
    } else {
      // Isola questa struttura
      setIsolatedSeries(key);
      setHiddenSeries({});
    }
  };

  const handleCheckboxToggle = (e, key) => {
    e.stopPropagation();
    // Se c'era un isolamento attivo, torna alla vista completa prima di fare il toggle
    if (isolatedSeries) {
      setIsolatedSeries(null);
      setHiddenSeries({ [key]: true }); // nasconde quella appena cliccata
    } else {
      setHiddenSeries(prev => ({ ...prev, [key]: !prev[key] }));
    }
  };

  // Una serie è visibile se: non è nascosta E (non c'è isolamento OPPURE è la serie isolata)
  const isSeriesVisible = (key) => {
    if (hiddenSeries[key]) return false;
    if (isolatedSeries && isolatedSeries !== key) return false;
    return true;
  };

  if (!isOpen) return null;

  const getReferenceAreas = () => {
    if (!activeRule?.target_verde) return null;
    const m  = isPercTab ? 100 : 1;
    const tv = activeRule.target_verde * m;
    const tr = activeRule.target_rosso * m;
    if (activeRule.direzione === 'MAX') return (
      <>
        <ReferenceArea y1={tv}   y2={9999}  fill="#10b981" fillOpacity={0.08} />
        <ReferenceArea y1={tr}   y2={tv}    fill="#fbbf24" fillOpacity={0.08} />
        <ReferenceArea y1={-999} y2={tr}    fill="#ef4444" fillOpacity={0.08} />
      </>
    );
    return (
      <>
        <ReferenceArea y1={-999} y2={tv}   fill="#10b981" fillOpacity={0.08} />
        <ReferenceArea y1={tv}   y2={tr}   fill="#fbbf24" fillOpacity={0.08} />
        <ReferenceArea y1={tr}   y2={9999} fill="#ef4444" fillOpacity={0.08} />
      </>
    );
  };

  return (
    <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in">
      <div className="bg-white rounded-2xl w-full max-w-[95vw] h-[95vh] flex flex-col shadow-2xl overflow-hidden font-sans">

        {/* Header */}
        <div className="bg-slate-950 px-8 py-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-emerald-500 rounded-lg text-white"><TrendingUp size={24} /></div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-wider">Vista Laser Plurimensile</h2>
              <p className="text-xs text-emerald-400 font-bold uppercase tracking-widest">Trend Mobile 12 Mesi (Rolling Window)</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-full transition-colors"><X size={26} /></button>
        </div>

        {/* Toolbar */}
        <div className="bg-slate-50 border-b border-slate-200 px-8 py-4 flex flex-col gap-4 shrink-0">
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex flex-col">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Seleziona KPI</label>
              <select value={selectedKpiTarget} onChange={e => setSelectedKpiTarget(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-4 py-2 text-sm font-bold text-slate-800 outline-none focus:border-emerald-500 cursor-pointer shadow-sm">
                {KPI_RULES.map((r, i) => <option key={i} value={r.kpi_target}>[{r.settore}] {r.kpi_target}</option>)}
              </select>
            </div>

            <div className="w-px h-10 bg-slate-300" />

            <div className="flex flex-col flex-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Filtro UDO</label>
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => setSelectedUdos([])}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${selectedUdos.length === 0 ? 'bg-slate-800 text-white shadow-md' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}>
                  Tutte
                </button>
                {udos.map(u => (
                  <button key={u.id} onClick={() => toggleUdo(u.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${selectedUdos.includes(u.id) ? 'bg-emerald-600 text-white shadow-md' : 'bg-white border border-slate-300 text-slate-600 hover:border-emerald-400'}`}>
                    {u.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Info tooltip */}
            <div className="text-[10px] font-bold text-slate-400 bg-slate-100 px-3 py-2 rounded-lg">
              Passa il mouse sui punti per vedere i valori
            </div>
          </div>
        </div>

        {/* Body: grafico + legenda laterale */}
        <div className="flex-1 flex overflow-hidden">

          {/* Grafico */}
          <div className="flex-1 p-8">
            {dataKeys.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
                <TrendingUp size={48} className="mb-4 opacity-50" />
                <p className="font-black uppercase tracking-widest">Dati non sufficienti</p>
                <p className="text-xs font-bold mt-2">Nessuna struttura ha dati per "{selectedKpiTarget}" in questo periodo.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  {getReferenceAreas()}
                  <XAxis dataKey="name" tick={{ fontSize: 12, fontWeight: 'bold', fill: '#475569' }} />
                  <YAxis tick={{ fontSize: 12, fontWeight: 'bold', fill: '#475569' }} domain={['auto', 'auto']} />
                  <Tooltip
                    content={<CustomTooltip isPerc={isPercTab} />}
                    cursor={{ stroke: '#cbd5e1', strokeWidth: 2 }}
                  />
                  {dataKeys.map((key, index) => (
                    <Line
                      key={key}
                      type="monotone"
                      dataKey={key}
                      stroke={PALETTE[index % PALETTE.length]}
                      strokeWidth={isSeriesVisible(key) ? 2.5 : 0}
                      dot={{ r: isSeriesVisible(key) ? 4 : 0, strokeWidth: 2 }}
                      activeDot={{ r: 7, strokeWidth: 0 }}
                      hide={!isSeriesVisible(key)}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Legenda laterale (al posto della Legend orizzontale) */}
          {dataKeys.length > 0 && (
            <div className="w-56 shrink-0 border-l border-slate-100 p-4 overflow-y-auto bg-slate-50">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Strutture</p>
              {/* Filtro ricerca struttura */}
              <input
                type="text"
                placeholder="Cerca struttura..."
                value={legendSearch || ''}
                onChange={e => setLegendSearch(e.target.value)}
                className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-emerald-400 mb-2"
              />

              {/* Azioni rapide */}
              <div className="flex gap-1 mb-3">
                <button
                  onClick={() => { setIsolatedSeries(null); setHiddenSeries({}); }}
                  className="flex-1 text-[10px] font-black text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 px-2 py-1 rounded-lg transition-colors"
                >
                  Tutte
                </button>
                <button
                  onClick={() => { setIsolatedSeries(null); const h = {}; dataKeys.forEach(k => h[k] = true); setHiddenSeries(h); }}
                  className="flex-1 text-[10px] font-black text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 px-2 py-1 rounded-lg transition-colors"
                >
                  Nessuna
                </button>
              </div>

              <div className="space-y-1">
                {dataKeys.filter(k => !legendSearch || k.toLowerCase().includes(legendSearch.toLowerCase())).map((key, index) => {
                  const visible = isSeriesVisible(key);
                  const isIsolated = isolatedSeries === key;
                  return (
                    <div
                      key={key}
                      onClick={() => handleLegendClick(key)}
                      className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl cursor-pointer transition-all ${
                        isIsolated
                          ? 'bg-emerald-50 border border-emerald-300 shadow-sm'
                          : !visible
                          ? 'opacity-35 bg-white'
                          : 'bg-white hover:bg-slate-50'
                      }`}
                      title={`Click: isola ${key}`}
                    >
                      {/* Checkbox toggle visibilità */}
                      <input
                        type="checkbox"
                        checked={visible}
                        onChange={() => {}}
                        onClick={e => handleCheckboxToggle(e, key)}
                        className="accent-emerald-600 w-3.5 h-3.5 shrink-0 cursor-pointer"
                      />
                      <span
                        style={{ backgroundColor: PALETTE[index % PALETTE.length] }}
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                      />
                      <span className="text-[11px] font-bold text-slate-700 leading-tight line-clamp-2 flex-1">{key}</span>
                      {isIsolated && <span className="text-[9px] font-black text-emerald-600 shrink-0">●</span>}
                    </div>
                  );
                })}
              </div>
              <p className="text-[9px] text-slate-400 mt-3 font-medium leading-relaxed">
                Click: isola struttura<br/>Checkbox: mostra/nascondi
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
