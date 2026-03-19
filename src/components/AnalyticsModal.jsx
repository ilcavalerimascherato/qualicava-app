import React, { useMemo, useState, useEffect } from 'react';
import { X, UploadCloud, BrainCircuit, BarChart3, Target, Users, Layers, Activity, FileDown, Percent, Edit3, Bed, AlertTriangle } from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { GoogleGenerativeAI } from '@google/generative-ai';
import html2pdf from 'html2pdf.js';
import { supabase }          from '../supabaseClient';
import { getPromptAnalytics } from '../config/aiPrompts';

const metricNames = {
  soddisfazione_generale: 'Soddisfazione Globale', info_cura: 'Chiarezza Progetto di Cura', ascolto: "Qualità dell'Ascolto", contatto_struttura: 'Reperibilità Struttura', relazione_equipe: "Relazione con l'Equipe", voto_assistenza: 'Assistenza Personale', voto_alloggio: 'Comfort Alloggio', soddisfazione_pulizia: 'Igiene e Pulizia', voto_animazione: 'Attività Ricreative', cura_bisogni: 'Attenzione ai Bisogni', nps_consiglio: 'Propensione Raccomandazione (NPS)', info_prenotazione: 'Info in Prenotazione', info_ingresso: 'Accoglienza Ingresso', voto_bagno: 'Servizi Igienici', voto_spazio_esterno: 'Spazi Esterni', voto_pulizie: 'Personale Pulizie', voto_ristorazione_qualita: 'Qualità Ristorazione', soddisfazione_tempo: "Tempo Dedicato all'Ospite", appagamento_vita: 'Appagamento Quotidiano', assistenza_diurna: 'Assistenza Diurna', assistenza_notturna: 'Assistenza Notturna', rispetto_dignita: 'Rispetto della Dignità', coinvolgimento_cure: 'Coinvolgimento nelle Cure'
};

// Funzione esterna per il convertitore
const imageToBase64 = (url) => new Promise((resolve, reject) => {
  const img = new Image();
  img.crossOrigin = 'Anonymous';
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    resolve(canvas.toDataURL('image/png'));
  };
  img.onerror = reject;
  img.src = url;
});

export default function AnalyticsModal({ isOpen, onClose, facility, type, surveys, facilities = [], onOpenImport, onUpdateSuccess }) {
  const [showUdoCompare, setShowUdoCompare] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiReport, setAiReport] = useState('');
  const [reportTarget, setReportTarget] = useState(null);

  // STATI PER IL PRE-CARICAMENTO DELLA CARTA INTESTATA
  const [headerBase64, setHeaderBase64] = useState('');
  const [footerBase64, setFooterBase64] = useState('');

  const targetSurveys = surveys.filter(s => s.type === type && (s.facility_id === facility.id || (!s.facility_id && s.company_id === facility.company_id)));
  const latestSurvey = targetSurveys.sort((a, b) => b.calendar_id.localeCompare(a.calendar_id))[0];
  const isCompanyWide = latestSurvey && !latestSurvey.facility_id && latestSurvey.company_id;

  // Pre-caricamento brutale delle immagini all'apertura del componente
  useEffect(() => {
    if (isOpen) {
      imageToBase64('/intestazione.png').then(setHeaderBase64).catch(e => console.error('Errore Header', e));
      imageToBase64('/down.png').then(setFooterBase64).catch(e => console.error('Errore Footer', e));
    }
  }, [isOpen]);

  const chartData = useMemo(() => {
    if (!latestSurvey || !latestSurvey.responses_json) {return [];}
    const facilityAggregates = {};
    latestSurvey.responses_json.forEach(row => {
      Object.keys(row).forEach(key => {
        if (!facilityAggregates[key]) {facilityAggregates[key] = { sum: 0, count: 0 };}
        facilityAggregates[key].sum += row[key];
        facilityAggregates[key].count += 1;
      });
    });

    const udoAggregates = {};
    if (showUdoCompare && facility.udo_id) {
      const udoFacilities = facilities.filter(f => f.udo_id === facility.udo_id);
      const udoFacilityIds = udoFacilities.map(f => f.id);
      const udoCompanyIds = [...new Set(udoFacilities.map(f => f.company_id).filter(Boolean))];
      const latestSurveysPerTarget = {};

      surveys.forEach(s => {
        if (s.type !== type) {return;}
        let targetKey = null;
        if (s.facility_id && udoFacilityIds.includes(s.facility_id)) {targetKey = `fac_${s.facility_id}`;}
        else if (!s.facility_id && s.company_id && udoCompanyIds.includes(s.company_id)) {targetKey = `comp_${s.company_id}`;}
        if (targetKey) {
          if (!latestSurveysPerTarget[targetKey] || s.calendar_id > latestSurveysPerTarget[targetKey].calendar_id) {
            latestSurveysPerTarget[targetKey] = s;
          }
        }
      });

      Object.values(latestSurveysPerTarget).forEach(survey => {
        if(survey.responses_json) {
          survey.responses_json.forEach(row => {
            Object.keys(row).forEach(key => {
              if (!udoAggregates[key]) {udoAggregates[key] = { sum: 0, count: 0 };}
              udoAggregates[key].sum += row[key];
              udoAggregates[key].count += 1;
            });
          });
        }
      });
    }

    return Object.keys(facilityAggregates).map(key => {
      const facilityScore = Math.round(facilityAggregates[key].sum / facilityAggregates[key].count);
      const udoScore = showUdoCompare && udoAggregates[key] ? Math.round(udoAggregates[key].sum / udoAggregates[key].count) : null;
      return { key: key, subject: metricNames[key] || key.replace(/_/g, ' ').toUpperCase(), score: facilityScore, udoScore: udoScore, fullMark: 100 };
    }).sort((a, b) => b.score - a.score);
  }, [latestSurvey, showUdoCompare, facility.udo_id, facilities, surveys, type]);

  const averageScore = chartData.length > 0 ? Math.round(chartData.reduce((acc, curr) => acc + curr.score, 0) / chartData.length) : 0;
  const totalResponses = latestSurvey?.summary_stats?.total_responses || 0;

  let targetAudience = 0;
  if (isCompanyWide) {
    const companyFacilities = facilities.filter(f => f.company_id === latestSurvey.company_id && !f.is_suspended);
    targetAudience = companyFacilities.reduce((sum, f) => sum + (f.bed_count || f.posti_letto || 0), 0);
  } else {
    targetAudience = facility.bed_count || facility.posti_letto || 0;
  }

  const redemptionRate = targetAudience > 0 ? Math.round((totalResponses / targetAudience) * 100) : null;

  useEffect(() => {
    setAiReport('');
    setReportTarget(null);
  }, [latestSurvey]);

  if (!isOpen) {return null;}

  const handleAction = async (target) => {
    setReportTarget(target);

    if (target === 'ospiti' && latestSurvey.ai_report_ospiti) {
      setAiReport(latestSurvey.ai_report_ospiti); return;
    }
    if (target === 'direzione' && latestSurvey.ai_report_direzione) {
      setAiReport(latestSurvey.ai_report_direzione); return;
    }

    if (!process.env.REACT_APP_GEMINI_API_KEY) { alert('Manca la chiave API di Gemini'); return; }
    setIsGeneratingAI(true);

    try {
      const genAI = new GoogleGenerativeAI(process.env.REACT_APP_GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const dataPayload = chartData.map(d => `${d.subject}: ${d.score}/100`).join('\n');

      // Prompt centralizzato — modifica in src/config/aiPrompts.js
      const prompt = getPromptAnalytics({
        type,
        target,
        facilityName: facility.name,
        dataPayload,
      });

      const result = await model.generateContent(prompt);
      setAiReport(result.response.text());
    } catch (error) { alert('Errore AI: ' + error.message); } finally { setIsGeneratingAI(false); }
  };

  const handleRegenerate = async () => {
    try {
      const updateData = {};
      if (reportTarget === 'ospiti') {updateData.ai_report_ospiti = null;}
      if (reportTarget === 'direzione') {updateData.ai_report_direzione = null;}
      await supabase.from('survey_data').update(updateData).eq('id', latestSurvey.id);
      latestSurvey[`ai_report_${reportTarget}`] = null;
      handleAction(reportTarget);
    } catch (err) { alert('Errore ripristino: ' + err.message); }
  };

  const handleSaveAndPDF = async () => {
    try {
      const updateData = {};
      if (reportTarget === 'ospiti') {updateData.ai_report_ospiti = aiReport;}
      if (reportTarget === 'direzione') {updateData.ai_report_direzione = aiReport;}
      await supabase.from('survey_data').update(updateData).eq('id', latestSurvey.id);
      if (onUpdateSuccess) {onUpdateSuccess();}
    } catch (err) { alert('Errore DB: ' + err.message); return; }

    const element = document.getElementById('pdf-clean-template');

    const opt = {
      margin:       [20, 15, 20, 15],
      filename:     `Relazione_${reportTarget === 'ospiti' ? 'Ospiti' : 'Direzione'}_${facility.name}_${latestSurvey.calendar_id}.pdf`,
      image:        { type: 'jpeg', quality: 1 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    element.style.display = 'block';
    html2pdf().set(opt).from(element).save().then(() => {
      element.style.display = 'none';
      setTimeout(onClose, 1000);
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900 z-50 flex flex-col overflow-hidden animate-in fade-in duration-200">

      {/* ------------------------------------------------------------- */}
      {/* DOCUMENTO OMBRA: Struttura A4 dinamica per stampa PDF         */}
      {/* ------------------------------------------------------------- */}
      <div style={{ position: 'absolute', left: '-15000px', top: 0 }}>
        <div id="pdf-clean-template" className="bg-white text-black font-sans relative" style={{ width: '180mm', display: 'none' }}>

          {/* CARTA INTESTATA PRE-CARICATA */}
          {headerBase64 && <img src={headerBase64} alt="Header" style={{ width: '100%', height: 'auto', marginBottom: '25px' }} />}

          {isCompanyWide && (
            <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fcd34d', color: '#b45309', padding: '10px 15px', borderRadius: '8px', marginBottom: '20px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}>
              ⚠ ATTENZIONE: Questo è un report aggregato a livello di Società. I dati e i posti letto includono tutte le strutture ad essa collegate.
            </div>
          )}

          <p className="text-xl font-bold text-slate-500 mb-2 uppercase tracking-widest text-center">
            {facility.name} • {type === 'client' ? 'Clienti' : 'Operatori'} • {latestSurvey?.calendar_id}
          </p>
          <h1 className="text-3xl font-black uppercase text-slate-800 border-b-2 border-slate-300 pb-3 mb-8 text-center">
            {reportTarget === 'ospiti' ? 'Risultati Questionario di Gradimento' : 'RELAZIONE DIREZIONALE'}
          </h1>

          {/* BOX DATI NUMERICI PDF - PERFETTAMENTE CENTRATO */}
          <div className="flex justify-between items-center mb-10 bg-slate-50 border border-slate-200 rounded-xl p-6">
            <div className="flex flex-col items-center justify-center w-1/4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 text-center">Score Globale</p>
              <p className="text-3xl font-black text-indigo-900 text-center">{averageScore}<span className="text-lg text-slate-400">/100</span></p>
            </div>
            <div className="w-px h-12 bg-slate-200"></div>
            <div className="flex flex-col items-center justify-center w-1/4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 text-center">{isCompanyWide ? 'Posti Totali' : 'Posti Letto'}</p>
              <p className="text-3xl font-black text-slate-700 text-center">{targetAudience}</p>
            </div>
            <div className="w-px h-12 bg-slate-200"></div>
            <div className="flex flex-col items-center justify-center w-1/4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 text-center">Risposte</p>
              <p className="text-3xl font-black text-slate-700 text-center">{totalResponses}</p>
            </div>
            <div className="w-px h-12 bg-slate-200"></div>
            <div className="flex flex-col items-center justify-center w-1/4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 text-center">Redemption</p>
              <p className="text-3xl font-black text-emerald-600 text-center">{redemptionRate !== null ? `${redemptionRate}%` : 'N/D'}</p>
            </div>
          </div>

          <div className="text-[13px] leading-relaxed text-slate-800 whitespace-pre-wrap font-medium mb-12">
            {aiReport}
          </div>

          <div className="html2pdf__page-break"></div>

          <h2 className="text-lg font-black uppercase text-slate-800 border-b border-slate-200 pb-2 mb-6 mt-8">Ranking Metriche (Top 10)</h2>
          <div style={{ width: '100%', height: '300px' }}>
            <BarChart width={650} height={300} data={chartData.slice(0, 10)} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={true} vertical={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
              <YAxis dataKey="subject" type="category" width={200} tick={{ fontSize: 10, fill: '#334155', fontWeight: 'bold' }} />
              <Bar dataKey="score" fill="#1e3a8a" radius={[0, 4, 4, 0]} barSize={15} />
            </BarChart>
          </div>

          {/* PIÈ DI PAGINA PRE-CARICATO */}
          {footerBase64 && <img src={footerBase64} alt="Footer" style={{ width: '100%', height: 'auto', marginTop: '40px' }} />}
        </div>
      </div>
      {/* ------------------------------------------------------------- */}

      {/* HEADER DASHBOARD */}
      <div className="h-16 bg-slate-950 border-b border-white/10 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-500 p-2 rounded-lg"><BarChart3 size={20} className="text-white" /></div>
          <div>
            <h2 className="text-lg font-black text-white uppercase tracking-wider">Business Intelligence</h2>
            <p className="text-xs text-indigo-400 font-bold uppercase tracking-widest">{facility.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {facility.udo_id && (
            <button onClick={() => setShowUdoCompare(!showUdoCompare)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold border ${showUdoCompare ? 'bg-sky-500/20 text-sky-400 border-sky-500/30' : 'bg-slate-800 text-slate-400 border-white/5'}`}>
              <Layers size={16} /> Benchmark UDO
            </button>
          )}
          <div className="w-px h-6 bg-white/10 mx-2"></div>
          <button onClick={onOpenImport} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold rounded-lg transition-colors border border-white/5">
            <UploadCloud size={16} /> Nuovi Dati
          </button>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-full"><X size={24} /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-slate-900 p-8">
        {!latestSurvey ? (
          <div className="h-full flex items-center justify-center text-slate-500">Nessun dato.</div>
        ) : (
          <div className="max-w-7xl mx-auto space-y-8">

            {isCompanyWide && (
              <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-xl flex items-center gap-4 text-amber-200">
                <AlertTriangle size={24} className="shrink-0 text-amber-400" />
                <div>
                  <h4 className="text-sm font-black uppercase tracking-widest mb-1">Dato Aggregato Societario</h4>
                  <p className="text-xs font-medium opacity-80">Questo questionario è stato archiviato a livello di Società. I posti letto e il calcolo della Redemption includono la somma di tutte le strutture attive ad essa collegate.</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="bg-slate-800/50 border border-white/5 p-5 rounded-2xl flex flex-col justify-center items-center text-center">
                <Target size={24} className="text-emerald-400 mb-2" />
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 text-center">Score</p>
                <p className="text-2xl font-black text-white text-center">{averageScore}<span className="text-sm text-slate-500">/100</span></p>
              </div>
              <div className="bg-slate-800/50 border border-white/5 p-5 rounded-2xl flex flex-col justify-center items-center text-center">
                <Bed size={24} className="text-amber-400 mb-2" />
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 text-center">{isCompanyWide ? 'Posti Totali' : 'Posti Letto'}</p>
                <p className="text-2xl font-black text-white text-center">{targetAudience}</p>
              </div>
              <div className="bg-slate-800/50 border border-white/5 p-5 rounded-2xl flex flex-col justify-center items-center text-center">
                <Users size={24} className="text-blue-400 mb-2" />
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 text-center">Risposte</p>
                <p className="text-2xl font-black text-white text-center">{totalResponses}</p>
              </div>
              <div className="bg-slate-800/50 border border-white/5 p-5 rounded-2xl flex flex-col justify-center items-center text-center">
                <Percent size={24} className="text-pink-400 mb-2" />
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 text-center">Redemption</p>
                <p className="text-2xl font-black text-white text-center">{redemptionRate !== null ? `${redemptionRate}%` : <span className="text-sm text-slate-500">N/D</span>}</p>
              </div>

              <div className="bg-slate-800/50 border border-white/5 p-3 rounded-2xl flex flex-col justify-center gap-2">
                 <button
                   onClick={() => handleAction('ospiti')}
                   disabled={isGeneratingAI}
                   className={`w-full py-2 text-[10px] font-black uppercase tracking-widest rounded-lg flex items-center justify-center gap-2 transition-all ${reportTarget === 'ospiti' ? 'bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)]' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                 >
                   <BrainCircuit size={14} /> {isGeneratingAI && reportTarget === 'ospiti' ? 'Elaborazione...' : (latestSurvey.ai_report_ospiti ? 'Report Ospiti' : 'Genera Ospiti')}
                 </button>
                 <button
                   onClick={() => handleAction('direzione')}
                   disabled={isGeneratingAI}
                   className={`w-full py-2 text-[10px] font-black uppercase tracking-widest rounded-lg flex items-center justify-center gap-2 transition-all ${reportTarget === 'direzione' ? 'bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)]' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                 >
                   <BrainCircuit size={14} /> {isGeneratingAI && reportTarget === 'direzione' ? 'Elaborazione...' : (latestSurvey.ai_report_direzione ? 'Report Direzione' : 'Genera Direzione')}
                 </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-slate-800/50 border border-white/5 p-6 rounded-2xl flex flex-col">
                <h3 className="text-sm font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2"><Activity size={16} className="text-indigo-400"/> Mappa Dimensionale</h3>
                <div className="flex-1 min-h-[450px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="65%" data={chartData}>
                      <PolarGrid stroke="#334155" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: '#cbd5e1', fontSize: 10, fontWeight: 'bold' }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#475569' }} />
                      <Radar name={facility.name} dataKey="score" stroke="#6366f1" strokeWidth={3} fill="#6366f1" fillOpacity={showUdoCompare ? 0.2 : 0.4} />
                      {showUdoCompare && <Radar name="Media UDO" dataKey="udoScore" stroke="#0ea5e9" strokeWidth={2} strokeDasharray="5 5" fill="#0ea5e9" fillOpacity={0.1} />}
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px' }} />
                      <Legend />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-slate-800/50 border border-white/5 p-6 rounded-2xl flex flex-col">
                <h3 className="text-sm font-black text-white uppercase tracking-widest mb-6">Ranking Metriche</h3>
                <div className="flex-1 min-h-[450px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={true} vertical={false} />
                      <XAxis type="number" domain={[0, 100]} stroke="#475569" tick={{ fill: '#94a3b8' }} />
                      <YAxis dataKey="subject" type="category" stroke="#475569" tick={{ fill: '#e2e8f0', fontSize: 11 }} width={160} />
                      <Tooltip cursor={{ fill: '#1e293b' }} contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px' }} />
                      <Bar name={facility.name} dataKey="score" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={showUdoCompare ? 12 : 24} />
                      {showUdoCompare && <Bar name="Media UDO" dataKey="udoScore" fill="#0ea5e9" radius={[0, 4, 4, 0]} barSize={12} />}
                      <Legend />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {aiReport !== '' && reportTarget && (
              <div className="bg-indigo-950/50 border border-indigo-500/30 p-8 rounded-2xl relative mt-6 animate-in slide-in-from-bottom-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-sm font-black text-indigo-300 uppercase tracking-widest flex items-center gap-2">
                    <Edit3 size={18} /> Modifica Relazione {reportTarget === 'ospiti' ? 'Ospiti' : 'Direzione'}
                  </h3>
                  <button onClick={handleRegenerate} className="text-xs font-bold text-pink-400 hover:text-pink-300 px-3 py-1 bg-pink-500/10 rounded-lg transition-colors">
                    Rigenera con IA
                  </button>
                </div>

                <textarea
                  value={aiReport}
                  onChange={(e) => setAiReport(e.target.value)}
                  className="w-full bg-slate-900/50 border border-indigo-500/30 rounded-xl p-6 text-slate-300 text-[13px] leading-relaxed font-medium mb-8 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                  rows={20}
                />

                <button
                  onClick={handleSaveAndPDF}
                  className="w-full font-black py-4 rounded-xl shadow-lg transition-all flex items-center justify-center uppercase tracking-widest bg-emerald-500 hover:bg-emerald-600 text-white"
                >
                  <FileDown size={20} className="inline mr-2" />
                  Salva Modifiche e Genera PDF {reportTarget === 'ospiti' ? 'Ospiti' : 'Direzione'}
                </button>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}