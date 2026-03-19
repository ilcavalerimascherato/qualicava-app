import React, { useState, useMemo, useEffect } from 'react';
import { X, FileSignature, BrainCircuit, FileDown, Layers, Building2 } from 'lucide-react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildPromptGlobaleBoard } from '../config/aiPrompts';
import html2pdf from 'html2pdf.js';

const metricNames = {
  soddisfazione_generale: 'Soddisfazione Globale', info_cura: 'Chiarezza Progetto di Cura', ascolto: "Qualità dell'Ascolto", contatto_struttura: 'Reperibilità Struttura', relazione_equipe: "Relazione con l'Equipe", voto_assistenza: 'Assistenza Personale', voto_alloggio: 'Comfort Alloggio', soddisfazione_pulizia: 'Igiene e Pulizia', voto_animazione: 'Attività Ricreative', cura_bisogni: 'Attenzione ai Bisogni', nps_consiglio: 'Propensione Raccomandazione (NPS)', info_prenotazione: 'Info in Prenotazione', info_ingresso: 'Accoglienza Ingresso', voto_bagno: 'Servizi Igienici', voto_spazio_esterno: 'Spazi Esterni', voto_pulizie: 'Personale Pulizie', voto_ristorazione_qualita: 'Qualità Ristorazione', soddisfazione_tempo: "Tempo Dedicato all'Ospite", appagamento_vita: 'Appagamento Quotidiano', assistenza_diurna: 'Assistenza Diurna', assistenza_notturna: 'Assistenza Notturna', rispetto_dignita: 'Rispetto della Dignità', coinvolgimento_cure: 'Coinvolgimento nelle Cure'
};

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

export default function GlobalReportModal({ isOpen, onClose, facilities, udos, surveys }) {
  const [reportType, setReportType] = useState('client'); // 'client' o 'operator'
  const [reportScope, setReportScope] = useState('all'); // 'all' o udo_id
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiReport, setAiReport] = useState('');

  const [headerBase64, setHeaderBase64] = useState('');
  const [footerBase64, setFooterBase64] = useState('');

  useEffect(() => {
    if (isOpen) {
      imageToBase64('/intestazione.png').then(setHeaderBase64).catch(e => console.error('Errore Header', e));
      imageToBase64('/down.png').then(setFooterBase64).catch(e => console.error('Errore Footer', e));
    }
  }, [isOpen]);

  // MOTORE DI AGGREGAZIONE MATEMATICA
  const aggregatedData = useMemo(() => {
    let targetFacilities = facilities.filter(f => !f.is_suspended);
    if (reportScope !== 'all') {
      targetFacilities = targetFacilities.filter(f => String(f.udo_id) === String(reportScope));
    }

    let allResponses = [];
    let facilitiesIncluded = 0;
    let totalBeds = 0;

    targetFacilities.forEach(f => {
      const fSurveys = surveys.filter(s => s.type === reportType && (s.facility_id === f.id || (!s.facility_id && s.company_id === f.company_id)));
      if (fSurveys.length > 0) {
        const latest = fSurveys.sort((a, b) => b.calendar_id.localeCompare(a.calendar_id))[0];
        if (latest.responses_json) {
          allResponses = allResponses.concat(latest.responses_json);
          facilitiesIncluded++;
          totalBeds += (f.bed_count || f.posti_letto || 0);
        }
      }
    });

    if (allResponses.length === 0) {return { chartData: [], averageScore: 0, totalResponses: 0, facilitiesIncluded: 0, totalBeds: 0 };}

    const aggregates = {};
    allResponses.forEach(row => {
      Object.keys(row).forEach(key => {
        if (!aggregates[key]) {aggregates[key] = { sum: 0, count: 0 };}
        aggregates[key].sum += row[key];
        aggregates[key].count += 1;
      });
    });

    const chartData = Object.keys(aggregates).map(key => {
      return {
        key: key,
        subject: metricNames[key] || key.replace(/_/g, ' ').toUpperCase(),
        score: Math.round(aggregates[key].sum / aggregates[key].count)
      };
    }).sort((a, b) => b.score - a.score);

    const averageScore = chartData.length > 0 ? Math.round(chartData.reduce((acc, curr) => acc + curr.score, 0) / chartData.length) : 0;

    return { chartData, averageScore, totalResponses: allResponses.length, facilitiesIncluded, totalBeds };
  }, [facilities, surveys, reportScope, reportType]);

  if (!isOpen) {return null;}

  const scopeName = reportScope === 'all' ? 'Tutto il Gruppo' : (udos.find(u => String(u.id) === String(reportScope))?.name || 'UDO');
  const typeName = reportType === 'client' ? 'Clienti / Ospiti' : 'Staff / Operatori';

  const generateReport = async () => {
    if (!process.env.REACT_APP_GEMINI_API_KEY) { alert('Manca la chiave API Gemini'); return; }
    if (aggregatedData.chartData.length === 0) { alert('Nessun dato disponibile per questa selezione.'); return; }

    setIsGenerating(true);
    try {
      const genAI = new GoogleGenerativeAI(process.env.REACT_APP_GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const dataPayload = aggregatedData.chartData.map(d => `${d.subject}: ${d.score}/100`).join('\n');

      // Prompt centralizzato — modifica in src/config/aiPrompts.js
      const prompt = buildPromptGlobaleBoard({
        scopeName,
        typeName,
        facilitiesIncluded: aggregatedData.facilitiesIncluded,
        totalResponses:     aggregatedData.totalResponses,
        averageScore:       aggregatedData.averageScore,
        dataPayload,
      });

      const result = await model.generateContent(prompt);
      setAiReport(result.response.text());
    } catch (error) {
      alert('Errore generazione: ' + error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const exportPDF = () => {
    const element = document.getElementById('global-pdf-template');
    const opt = {
      margin: [20, 15, 20, 15],
      filename: `Relazione_Globale_${scopeName.replace(/ /g, '_')}_${reportType}.pdf`,
      image: { type: 'jpeg', quality: 1 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    element.style.display = 'block';
    html2pdf().set(opt).from(element).save().then(() => {
      element.style.display = 'none';
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">

      {/* TEMPLATE PDF NASCOSTO */}
      <div style={{ position: 'absolute', left: '-15000px', top: 0 }}>
        <div id="global-pdf-template" className="bg-white text-black font-sans relative" style={{ width: '180mm', display: 'none' }}>
          {headerBase64 && <img src={headerBase64} alt="Header" style={{ width: '100%', height: 'auto', marginBottom: '25px' }} />}

          <p className="text-xl font-bold text-indigo-600 mb-2 uppercase tracking-widest text-center">
            {scopeName} • Analisi {typeName}
          </p>
          <h1 className="text-3xl font-black uppercase text-slate-800 border-b-2 border-slate-300 pb-3 mb-8 text-center">
            REPORT DIREZIONALE AGGREGATO
          </h1>

          <div className="flex justify-between items-center mb-10 bg-slate-50 border border-slate-200 rounded-xl p-6">
            <div className="flex flex-col items-center justify-center w-1/4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 text-center">Score Medio</p>
              <p className="text-3xl font-black text-indigo-900 text-center">{aggregatedData.averageScore}<span className="text-lg text-slate-400">/100</span></p>
            </div>
            <div className="w-px h-12 bg-slate-200"></div>
            <div className="flex flex-col items-center justify-center w-1/4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 text-center">Strutture Incluse</p>
              <p className="text-3xl font-black text-slate-700 text-center">{aggregatedData.facilitiesIncluded}</p>
            </div>
            <div className="w-px h-12 bg-slate-200"></div>
            <div className="flex flex-col items-center justify-center w-1/4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 text-center">Posti Letto</p>
              <p className="text-3xl font-black text-slate-700 text-center">{aggregatedData.totalBeds}</p>
            </div>
            <div className="w-px h-12 bg-slate-200"></div>
            <div className="flex flex-col items-center justify-center w-1/4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 text-center">Risposte Elaborate</p>
              <p className="text-3xl font-black text-emerald-600 text-center">{aggregatedData.totalResponses}</p>
            </div>
          </div>

          <div className="text-[13px] leading-relaxed text-slate-800 whitespace-pre-wrap font-medium mb-12">
            {aiReport}
          </div>

          {footerBase64 && <img src={footerBase64} alt="Footer" style={{ width: '100%', height: 'auto', marginTop: '40px' }} />}
        </div>
      </div>

      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">

        {/* HEADER MODALE */}
        <div className="bg-slate-950 px-8 py-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/30"><FileSignature size={24} /></div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-wider">Centro Elaborazione Relazioni Globali</h2>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Analisi matriciale aggregata di Gruppo / UDO</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-full transition-colors"><X size={26} /></button>
        </div>

        {/* CONTROLS */}
        <div className="bg-slate-50 border-b border-slate-200 p-6 flex items-center gap-6 shrink-0">
          <div className="flex-1 flex items-center gap-4 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
            <Layers className="text-slate-400 ml-2" size={20} />
            <select value={reportType} onChange={(e) => setReportType(e.target.value)} className="bg-transparent font-black text-slate-700 outline-none w-full cursor-pointer uppercase text-sm">
              <option value="client">Analisi Gradimento (Clienti/Ospiti)</option>
              <option value="operator">Analisi Clima (Staff/Operatori)</option>
            </select>
          </div>

          <div className="flex-1 flex items-center gap-4 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
            <Building2 className="text-slate-400 ml-2" size={20} />
            <select value={reportScope} onChange={(e) => setReportScope(e.target.value)} className="bg-transparent font-black text-slate-700 outline-none w-full cursor-pointer uppercase text-sm">
              <option value="all">Perimetro: Tutto il Gruppo</option>
              {udos.map(u => <option key={u.id} value={u.id}>Perimetro: {u.name}</option>)}
            </select>
          </div>

          <button
            onClick={generateReport}
            disabled={isGenerating || aggregatedData.totalResponses === 0}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white px-8 py-4 rounded-xl font-black uppercase tracking-widest shadow-md transition-all flex items-center gap-3 shrink-0"
          >
            <BrainCircuit size={20} />
            {isGenerating ? 'Elaborazione Matrice...' : 'Genera Relazione IA'}
          </button>
        </div>

        {/* METRICS PREVIEW & REPORT AREA */}
        <div className="flex-1 overflow-y-auto bg-slate-100 p-8 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <div className="flex gap-8">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Strutture Lette</p>
                <p className="text-2xl font-black text-slate-800">{aggregatedData.facilitiesIncluded}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Risposte Fusi</p>
                <p className="text-2xl font-black text-slate-800">{aggregatedData.totalResponses}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Score Medio Gruppo</p>
                <p className="text-2xl font-black text-indigo-600">{aggregatedData.averageScore}/100</p>
              </div>
            </div>
            {aggregatedData.totalResponses === 0 && (
              <span className="bg-rose-100 text-rose-600 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest">
                Dati Insufficienti nel perimetro
              </span>
            )}
          </div>

          {aiReport ? (
             <div className="flex-1 flex flex-col">
                <textarea
                  value={aiReport}
                  onChange={(e) => setAiReport(e.target.value)}
                  className="w-full flex-1 bg-white border border-slate-300 rounded-xl p-8 text-slate-800 text-[14px] leading-relaxed font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none shadow-inner"
                />
                <button onClick={exportPDF} className="mt-6 w-full font-black py-4 rounded-xl shadow-lg uppercase tracking-widest bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center gap-2">
                  <FileDown size={20} /> Esporta Relazione Direzionale in PDF
                </button>
             </div>
          ) : (
            <div className="flex-1 flex items-center justify-center border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50">
              <div className="text-center text-slate-400">
                <FileSignature size={64} className="mx-auto mb-4 opacity-50" />
                <p className="font-bold uppercase tracking-widest">Configura i parametri ed avvia la generazione</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}