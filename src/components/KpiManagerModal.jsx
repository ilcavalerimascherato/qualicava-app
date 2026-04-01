import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, Save, CheckCircle2, AlertCircle, Clock, Ban, Activity } from 'lucide-react';
import { supabase }         from '../supabaseClient';
import { detectAnomalies, maxSeverity } from '../utils/kpiAnomalyEngine';
import { checkAndOpenAutoNcs }         from '../utils/autoNcEngine';

const MONTHS = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

export default function KpiManagerModal({ isOpen, onClose, facility, year, onUpdateSuccess }) {
  const [activeMonth, setActiveMonth] = useState(null);
  const [kpiDefs, setKpiDefs] = useState([]);
  const [kpiData, setKpiData] = useState([]);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !facility) {return;}
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: defs } = await supabase.from('dim_kpis').select('*').order('sort_order', { ascending: true });
        setKpiDefs(defs || []);
        const { data: records } = await supabase.from('fact_kpi_monthly').select('*').eq('facility_id', facility.id).eq('year', year);
        setKpiData(records || []);
      } catch (err) { console.error('Errore fetch KPI', err); }
      setLoading(false);
    };
    fetchData();
  }, [isOpen, facility, year]);

  if (!isOpen) {return null;}

  const handleOpenMonth = (monthIndex) => {
    const month = monthIndex + 1;
    const existingRecord = kpiData.find(d => d.month === month);

    const initialForm = {};
    kpiDefs.forEach(k => {
      const existingValue = existingRecord?.metrics_json?.[k.indicator_name];
      initialForm[k.indicator_name] = existingValue || { value: '', is_na: false };
    });

    setFormData(initialForm);
    setActiveMonth(month);
  };

  const handleInputChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: { value, is_na: false } }));
  };

  const handleNaToggle = (name) => {
    setFormData(prev => {
      const current = prev[name] || { value: '', is_na: false };
      return { ...prev, [name]: { value: !current.is_na ? '' : current.value, is_na: !current.is_na } };
    });
  };

  const handleSave = async (status) => {
    try {
      const payload = {
        facility_id:  facility.id, year, month: activeMonth,
        status, metrics_json: formData,
        updated_at:   new Date().toISOString(),
      };
      const { error } = await supabase
        .from('fact_kpi_monthly')
        .upsert(payload, { onConflict: 'facility_id, year, month' });
      if (error) throw error;

      // Aggiorna stato locale
      setKpiData(prev => [
        ...prev.filter(p => p.month !== activeMonth),
        { ...payload, id: 'temp' },
      ]);
      setActiveMonth(null);

      // Notifica il parent per il refresh (invalidate React Query)
      if (onUpdateSuccess) onUpdateSuccess();

      // Verifica NC automatiche solo al consolidamento definitivo
      if (status === 'completed') {
        const opened = await checkAndOpenAutoNcs(
          facility.id,
          facility.name,
          year,
          activeMonth,
          facility,
        );
        if (opened.length > 0) {
          // Piccolo toast informativo (non bloccante)
          console.info(`[KpiManager] NC aperte automaticamente: ${opened.join(', ')}`);
          // Se il parent ha un handler per NC, notificalo
          if (onUpdateSuccess) onUpdateSuccess();
        }
      }
    } catch (err) { alert('Errore: ' + err.message); }
  };

  const getMonthStatus = (i) => {
    const month = i + 1;
    const record = kpiData.find(d => d.month === month);

    if (record?.status === 'completed') {
      const anomalies = detectAnomalies(record.metrics_json);
      const sev       = maxSeverity(anomalies);
      return {
        color:    sev === 'alta' ? 'bg-red-500' : sev === 'media' ? 'bg-amber-400' : 'bg-emerald-400',
        text:     sev ? `${anomalies.length} anomali${anomalies.length === 1 ? 'a' : 'e'}` : 'Inviato',
        icon:     sev ? AlertCircle : CheckCircle2,
        textCol:  sev === 'alta' ? 'text-red-700' : sev === 'media' ? 'text-amber-700' : 'text-emerald-700',
        bgCol:    sev === 'alta' ? 'bg-red-50'    : sev === 'media' ? 'bg-amber-50'    : 'bg-emerald-50',
        border:   sev === 'alta' ? 'border-red-200' : sev === 'media' ? 'border-amber-200' : 'border-emerald-200',
        anomalies,
      };
    }
    if (record?.status === 'draft') {return { color: 'bg-amber-400', text: 'Bozza', icon: Clock, textCol: 'text-amber-700', bgCol: 'bg-amber-50', border: 'border-amber-200', anomalies: [] };}

    // LOGICA TEMPORALE BLINDATA: Il mese è compilabile SOLO se è interamente trascorso.
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();
    const isActionable = (year < currentYear) || (year === currentYear && month < currentMonth);

    return isActionable
      ? { color: 'bg-rose-500', text: 'Mancante', icon: AlertCircle, textCol: 'text-rose-700', bgCol: 'bg-rose-50', border: 'border-rose-200' }
      : { color: 'bg-slate-200', text: 'Futuro', icon: Ban, textCol: 'text-slate-400', bgCol: 'bg-slate-50', border: 'border-slate-100' };
  };

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-900 font-sans">

        {/* HEADER */}
        <div className="bg-slate-950 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            {activeMonth ? (
              <button onClick={() => setActiveMonth(null)} className="p-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700"><ChevronLeft size={20} /></button>
            ) : (
              <div className="p-2 bg-indigo-600 rounded-lg text-white"><Activity size={20} /></div>
            )}
            <div>
              <h2 className="text-lg font-black text-white uppercase tracking-wider">{activeMonth ? `${MONTHS[activeMonth-1]} ${year}` : 'Inserimento KPI'}</h2>
              <p className="text-xs text-indigo-400 font-bold uppercase tracking-widest">{facility?.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-full"><X size={24} /></button>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
          {loading ? (
            <div className="flex justify-center items-center h-64 text-slate-400 font-black uppercase tracking-widest">Caricamento...</div>
          ) : activeMonth === null ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {MONTHS.map((m, i) => {
                const s = getMonthStatus(i);
                return (
                  <button key={m} disabled={s.text === 'Futuro'} onClick={() => handleOpenMonth(i)} className={`flex flex-col p-4 rounded-xl border-2 transition-all text-left ${s.text !== 'Futuro' ? 'hover:shadow-md cursor-pointer' : 'opacity-50'} ${s.bgCol} ${s.border}`}>
                    <div className="flex justify-between items-start mb-4">
                      <span className={`text-xs font-black uppercase tracking-wider ${s.textCol}`}>{m}</span>
                      <s.icon size={16} className={s.textCol} />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${s.color}`}></div>
                      <span className={`text-[10px] font-black uppercase tracking-widest ${s.textCol}`}>{s.text}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-1">
              {kpiDefs.map((kpi, index) => {
                const field = formData[kpi.indicator_name] || { value: '', is_na: false };
                return (
                  <div key={kpi.indicator_name} className={`flex items-center justify-between p-2 rounded-lg border-b border-slate-200 transition-colors ${field.is_na ? 'bg-slate-100 opacity-60' : 'bg-white hover:bg-indigo-50/30'}`}>
                    <div className="flex-1 flex items-center gap-3">
                      <span className="text-[10px] font-bold text-slate-300 w-6">{index + 1}.</span>
                      <label className="text-[11px] font-black text-slate-700 leading-tight uppercase tracking-tight">{kpi.indicator_name}</label>
                    </div>
                    <div className="flex items-center gap-6">
                      <label className="flex items-center gap-1.5 cursor-pointer p-1 rounded hover:bg-slate-200 transition-colors">
                        <input type="checkbox" checked={field.is_na} onChange={() => handleNaToggle(kpi.indicator_name)} tabIndex="-1" className="w-3.5 h-3.5 accent-slate-600 cursor-pointer" />
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">N/A</span>
                      </label>
                      <input
                        type="number"
                        disabled={field.is_na}
                        value={field.value}
                        onChange={(e) => handleInputChange(kpi.indicator_name, e.target.value)}
                        placeholder="0"
                        className="w-24 bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-black text-slate-800 text-right focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-slate-200 disabled:text-slate-400 transition-all"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ANOMALIE — mostrate sotto la lista KPI se presenti */}
        {activeMonth !== null && (() => {
          const rec = kpiData.find(d => d.month === activeMonth);
          const anomalies = rec ? detectAnomalies(rec.metrics_json) : [];
          if (!anomalies.length) return null;
          return (
            <div className="mx-6 mb-4 bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-xs font-black text-red-700 uppercase tracking-widest mb-2 flex items-center gap-2">
                <AlertCircle size={13} /> {anomalies.length} anomali{anomalies.length === 1 ? 'a' : 'e'} rilevat{anomalies.length === 1 ? 'a' : 'e'}
              </p>
              <ul className="space-y-1">
                {anomalies.map(a => (
                  <li key={a.id} className={`text-xs font-medium flex items-start gap-2 ${a.severity === 'alta' ? 'text-red-700' : 'text-amber-700'}`}>
                    <span className="shrink-0 mt-0.5">{a.severity === 'alta' ? '🔴' : '🟡'}</span>
                    {a.msg}
                  </li>
                ))}
              </ul>
            </div>
          );
        })()}

        {/* FOOTER */}
        {activeMonth !== null && (
          <div className="bg-white border-t p-4 flex justify-between shrink-0">
            <button onClick={() => handleSave('draft')} className="px-5 py-2.5 bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-slate-200 transition-all">Salva Bozza</button>
            <button onClick={() => handleSave('completed')} className="px-8 py-2.5 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-lg hover:bg-indigo-700 flex items-center gap-2 transition-all">
              <Save size={14} /> Consolida Mese
            </button>
          </div>
        )}
      </div>
    </div>
  );
}