import React, { useState, useMemo, useEffect } from 'react';
import { X, ActivitySquare } from 'lucide-react';
import { LineChart, Line, YAxis, ResponsiveContainer, Tooltip, ReferenceArea } from 'recharts';
import { KPI_RULES, isNumericSettore } from '../config/kpiRules';
import { computeKpiValue } from '../utils/kpiFormulaEngine';
import { getTimeHorizon } from '../utils/kpiTimeHorizon';

export default function KpiXrayModal({ isOpen, onClose, facilities, kpiRecords, year }) {
  const [selectedFacilityId, setSelectedFacilityId] = useState('');

  const activeFacilities = useMemo(() => facilities.filter(f => !f.is_suspended).sort((a,b) => a.name.localeCompare(b.name)), [facilities]);

  useEffect(() => {
    if (isOpen && !selectedFacilityId && activeFacilities.length > 0) {
      setSelectedFacilityId(activeFacilities[0].id);
    }
  }, [isOpen, selectedFacilityId, activeFacilities]);

  const selectedFacility = useMemo(() => activeFacilities.find(f => String(f.id) === String(selectedFacilityId)), [activeFacilities, selectedFacilityId]);

  const timeHorizon = useMemo(() => getTimeHorizon(year), [year]);

  // CALCOLO DI TUTTI I 36 KPI PER LA SINGOLA STRUTTURA SUI 12 MESI
  const xrayData = useMemo(() => {
    if (!selectedFacility) {return [];}

    return KPI_RULES.map(rule => {
      const isPerc = !isNumericSettore(rule.settore);
      let hasData = false;

      const trend = timeHorizon.map(t => {
        const record = kpiRecords.find(k => String(k.facility_id) === String(selectedFacility.id) && Number(k.year) === t.yearNum && Number(k.month) === t.monthNum && k.status === 'completed');

        let result = null;
        if (record && record.metrics_json) {
          result = computeKpiValue(rule, record.metrics_json, selectedFacility);
          if (result !== null) { hasData = true; }
        }
        return { name: t.label, value: result };
      });

      return { rule, trend, hasData, isPerc };
    });
  }, [selectedFacility, kpiRecords, timeHorizon]);

  if (!isOpen) {return null;}

  // Render per il singolo Mini-Grafico (Sparkline)
  const renderSparkline = (item) => {
    const { rule, trend, hasData, isPerc } = item;

    // Se non c'è mai stato un dato in 12 mesi, mostriamo un placeholder
    if (!hasData) {
      return (
        <div key={rule.kpi_target} className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col h-32 opacity-60">
          <div className="flex justify-between items-start mb-2">
            <h4 className="text-[11px] font-black text-slate-700 uppercase leading-tight line-clamp-2">{rule.kpi_target}</h4>
            <span className="text-[8px] font-black px-2 py-0.5 bg-slate-200 text-slate-500 rounded uppercase tracking-widest">{rule.settore}</span>
          </div>
          <div className="flex-1 flex items-center justify-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nessun Dato</div>
        </div>
      );
    }

    const m = isPerc ? 100 : 1;
    const tv = rule.target_verde !== null ? rule.target_verde * m : null;
    const tr = rule.target_rosso !== null ? rule.target_rosso * m : null;

    return (
      <div key={rule.kpi_target} className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col h-32 shadow-sm hover:shadow-md transition-shadow relative group">
        <div className="flex justify-between items-start mb-2 z-10">
          <h4 className="text-[11px] font-black text-slate-800 uppercase leading-tight line-clamp-2 pr-2" title={rule.indicatore}>{rule.kpi_target}</h4>
          <span className="text-[8px] font-black px-2 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded uppercase tracking-widest shrink-0">{rule.settore}</span>
        </div>

        <div className="flex-1 w-full min-h-0 relative -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <YAxis domain={['auto', 'auto']} hide />
              <Tooltip
                formatter={(val) => [isPerc ? `${val}%` : val, 'Valore']}
                labelStyle={{fontSize: '10px', fontWeight: 'bold', color: '#64748b'}}
                contentStyle={{padding: '4px 8px', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '11px', fontWeight: 'black'}}
              />

              {/* Sfondo di Tolleranza */}
              {tv !== null && tr !== null && rule.direzione === 'MAX' && (
                <>
                  <ReferenceArea y1={tv} y2={9999} fill="#10b981" fillOpacity={0.15} />
                  <ReferenceArea y1={tr} y2={tv} fill="#fbbf24" fillOpacity={0.15} />
                  <ReferenceArea y1={-999} y2={tr} fill="#ef4444" fillOpacity={0.15} />
                </>
              )}
              {tv !== null && tr !== null && rule.direzione === 'MIN' && (
                <>
                  <ReferenceArea y1={-999} y2={tv} fill="#10b981" fillOpacity={0.15} />
                  <ReferenceArea y1={tv} y2={tr} fill="#fbbf24" fillOpacity={0.15} />
                  <ReferenceArea y1={tr} y2={9999} fill="#ef4444" fillOpacity={0.15} />
                </>
              )}

              <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={{ r: 2, fill: '#3b82f6', strokeWidth: 0 }} activeDot={{ r: 4 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in">
      <div className="bg-white rounded-2xl w-full max-w-[95vw] h-[95vh] flex flex-col shadow-2xl overflow-hidden font-sans">

        {/* HEADER */}
        <div className="bg-slate-950 px-8 py-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-indigo-600 rounded-lg text-white"><ActivitySquare size={24} /></div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-wider">Audit Raggi X</h2>
              <p className="text-xs text-indigo-400 font-bold uppercase tracking-widest">Elettrocardiogramma Struttura (Trend 12 Mesi)</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-full transition-colors"><X size={26} /></button>
        </div>

        {/* TOOLBAR */}
        <div className="bg-slate-50 border-b border-slate-200 px-8 py-4 flex flex-col gap-4 shrink-0">
          <div className="flex items-center gap-6">
            <div className="flex flex-col flex-1 max-w-md">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Seleziona Struttura per l'Ispezione</label>
              <select value={selectedFacilityId} onChange={(e) => setSelectedFacilityId(e.target.value)} className="bg-white border border-slate-300 rounded-lg px-4 py-2 text-sm font-bold text-slate-800 outline-none focus:border-indigo-500 cursor-pointer shadow-sm">
                {activeFacilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>

            <div className="ml-auto flex gap-4 bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm items-center">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">Legenda Sfondi:</span>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-600"><div className="w-3 h-3 rounded-sm bg-emerald-500/30 border border-emerald-500"></div> OK</div>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-600"><div className="w-3 h-3 rounded-sm bg-amber-400/30 border border-amber-400"></div> Allerta</div>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-600"><div className="w-3 h-3 rounded-sm bg-rose-500/30 border border-rose-500"></div> Critico</div>
            </div>
          </div>
        </div>

        {/* GRIGLIA SPARKLINES */}
        <div className="flex-1 overflow-y-auto bg-slate-100 p-6 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {xrayData.map(renderSparkline)}
          </div>
        </div>

      </div>
    </div>
  );
}