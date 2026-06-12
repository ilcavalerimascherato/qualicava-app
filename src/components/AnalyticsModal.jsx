/**
 * src/components/AnalyticsModal.jsx  —  v3
 * MODIFICHE v3:
 *  - Per questionari OPERATORI: il "target audience" non è più bed_count
 *    ma il valore di "Numero totale dipendenti soggetti a formazione sicurezza"
 *    letto dall'ultimo record KPI completato del mese del survey.
 *    Se il dato KPI non è disponibile, mostra "N/D" senza falsare la redemption.
 *  - PDF: include ENTRAMBI i grafici (radar e istogramma) nella stampa,
 *    non solo l'istogramma top-10.
 *  - Testo indicatori numerici centrato verticalmente nel box PDF.
 *  - kpiRecords aggiunto come prop per leggere lo staff_count.
 */
import React, { useMemo, useState, useEffect } from 'react';
import {
  X, UploadCloud, BrainCircuit, BarChart3, Target, Users,
  Layers, Activity, FileDown, Percent, Edit3, Bed, AlertTriangle
} from 'lucide-react';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, Legend
} from 'recharts';
// Google Generative AI rimosso — si usa Claude API via fetch
import { exportPDF }       from '../utils/pdfExport';
import { supabase }       from '../supabaseClient';
import { getPromptAnalytics } from '../config/aiPrompts';

const metricNames = {
  // ── Senior Living / generici ─────────────────────────────
  soddisfazione_generale:       'Soddisfazione Globale',
  nps_consiglio:                'Propensione Raccomandazione (NPS)',
  voto_assistenza:              'Assistenza Personale',
  voto_animazione:              'Attività Ricreative',
  voto_alloggio:                'Comfort Alloggio',
  voto_bagno:                   'Servizi Igienici',
  voto_spazio_esterno:          'Spazi Esterni',
  voto_pulizie:                 'Personale Pulizie',
  voto_ristorazione_qualita:    'Qualità Ristorazione',
  soddisfazione_pulizia:        'Igiene e Pulizia',
  soddisfazione_tempo:          "Tempo Dedicato all'Ospite",
  info_prenotazione:            'Informazioni Prenotazione',
  info_ingresso:                'Accoglienza Ingresso',
  // ── RSA ──────────────────────────────────────────────────
  assistenza_medica:            'Assistenza Medica',
  assistenza_notturna:          'Assistenza Infermieristica',
  rispetto_dignita:             'Riservatezza e Dignità',
  soddisfazione_servizi:        'Servizi Offerti',
  fisioterapia:                 'Fisioterapia',
  // ── Disabilità ───────────────────────────────────────────
  ascolto:                      'Modo in cui viene Ascoltato',
  relazione_equipe:             "Relazione con l'Equipe",
  contatto_struttura:           'Facilità di Contatto',
  info_cura:                    'Informazioni sul Progetto di Cura',
  cura_bisogni:                 'Bisogni Presi in Considerazione',
  // ── Psichiatria ──────────────────────────────────────────
  appagamento_vita:             'Appagamento Vita Quotidiana',
  coinvolgimento_cure:          'Coinvolgimento nelle Cure',
  assistenza_diurna:            'Assistenza Diurna',
  voto_ristorazione:            'Servizio Ristorazione',
  // ── Personale / Staff ────────────────────────────────────
  sicurezza_ambiente:           'Ambiente di Lavoro Sicuro',
  riconoscimento:               'Riconoscimento del Lavoro',
  supporto_leadership:          'Supporto dal Responsabile',
  etica_assistenza:             'Trattamento degli Ospiti',
  chiarezza_ruolo:              'Chiarezza di Ruolo',
  qualita_tecnica:              'Qualità delle Cure agli Ospiti',
  reputazione_lavoro:           'Consiglio come Posto di Lavoro',
  reputazione_servizio:         'Consiglio per Assistenza',
};

// KPI che contiene il numero di dipendenti totali (fonte per staff_count operatori)
const STAFF_KPI_KEY = 'Numero totale dipendenti soggetti a formazione sicurezza';



/** Legge staff_count dall'ultimo record KPI completato per la struttura/survey */
function getStaffCount(kpiRecords, facilityId, calendarId) {
  if (!kpiRecords?.length || !calendarId) return null;

  // Il calendar_id del survey è nel formato "YYYY-MM"
  const [year, month] = calendarId.split('-').map(Number);

  // Cerca prima il mese esatto, poi scorre a ritroso fino a 6 mesi
  for (let offset = 0; offset <= 5; offset++) {
    const d = new Date(year, month - 1 - offset, 1);
    const rec = kpiRecords.find(k =>
      String(k.facility_id) === String(facilityId) &&
      Number(k.year)  === d.getFullYear() &&
      Number(k.month) === d.getMonth() + 1 &&
      k.status === 'completed'
    );
    if (rec?.metrics_json) {
      const entry = rec.metrics_json[STAFF_KPI_KEY];
      if (entry && !entry.is_na) {
        const v = parseFloat(entry.value);
        if (!isNaN(v) && v > 0) return Math.round(v);
      }
    }
  }
  return null;
}

export default function AnalyticsModal({
  isOpen, onClose, facility, type, surveys, facilities = [],
  onOpenImport, onUpdateSuccess, kpiRecords = [],
}) {
  const [showUdoCompare, setShowUdoCompare] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiReport, setAiReport]             = useState('');
  const [reportTarget, setReportTarget]     = useState(null);
  const [companyLogoUrl, setCompanyLogoUrl] = useState(null);

  useEffect(() => {
    if (!facility?.company_id) return;
    supabase
      .from('companies')
      .select('logo_url')
      .eq('id', facility.company_id)
      .single()
      .then(({ data }) => setCompanyLogoUrl(data?.logo_url ?? null));
  }, [facility?.company_id]);


  const targetSurveys = surveys.filter(s =>
    s.type === type &&
    (s.facility_id === facility.id || (!s.facility_id && s.company_id === facility.company_id))
  );
  const latestSurvey  = targetSurveys.sort((a, b) => b.calendar_id.localeCompare(a.calendar_id))[0];
  const isCompanyWide = latestSurvey && !latestSurvey.facility_id && latestSurvey.company_id;
  const isOperator    = type === 'operator';

  // ── Target audience ──────────────────────────────────────────
  const targetAudience = useMemo(() => {
    if (isOperator) {
      // Per operatori: usa staff_count da KPI
      if (isCompanyWide) {
        // Somma operatori di tutte le strutture della società
        const compFacilities = facilities.filter(f => f.company_id === latestSurvey?.company_id && !f.is_suspended);
        const total = compFacilities.reduce((sum, f) => {
          const sc = getStaffCount(kpiRecords, f.id, latestSurvey?.calendar_id);
          return sum + (sc ?? 0);
        }, 0);
        return total > 0 ? total : null;
      }
      return getStaffCount(kpiRecords, facility.id, latestSurvey?.calendar_id);
    }
    // Per clienti: usa bed_count come prima
    if (isCompanyWide) {
      return facilities
        .filter(f => f.company_id === latestSurvey?.company_id && !f.is_suspended)
        .reduce((sum, f) => sum + (f.bed_count || 0), 0);
    }
    return facility.bed_count || 0;
  }, [isOperator, isCompanyWide, facility, facilities, latestSurvey, kpiRecords]);

  const audienceLabel = isOperator
    ? (isCompanyWide ? 'Operatori Totali' : 'Operatori')
    : (isCompanyWide ? 'Posti Totali'     : 'Posti Letto');

  // ── Chart data ───────────────────────────────────────────────
  const chartData = useMemo(() => {
    if (!latestSurvey?.responses_json) return [];

    const parseRows = (raw) => {
      try {
        const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return Array.isArray(arr) ? arr : [];
      } catch { return []; }
    };

    const rows = parseRows(latestSurvey.responses_json);
    const facilityAgg = {};
    rows.forEach(row => {
      Object.keys(row).forEach(key => {
        if (!facilityAgg[key]) facilityAgg[key] = { sum: 0, count: 0 };
        facilityAgg[key].sum   += row[key];
        facilityAgg[key].count += 1;
      });
    });

    const udoAgg = {};
    if (showUdoCompare && facility.udo_id) {
      const udoFacilities   = facilities.filter(f => f.udo_id === facility.udo_id);
      const udoFacilityIds  = udoFacilities.map(f => f.id);
      const udoCompanyIds   = [...new Set(udoFacilities.map(f => f.company_id).filter(Boolean))];
      const latestPerTarget = {};

      surveys.forEach(s => {
        if (s.type !== type) return;
        let k = null;
        if (s.facility_id && udoFacilityIds.includes(s.facility_id)) k = `fac_${s.facility_id}`;
        else if (!s.facility_id && s.company_id && udoCompanyIds.includes(s.company_id)) k = `comp_${s.company_id}`;
        if (k && (!latestPerTarget[k] || s.calendar_id > latestPerTarget[k].calendar_id)) {
          latestPerTarget[k] = s;
        }
      });

      Object.values(latestPerTarget).forEach(sv => {
        parseRows(sv.responses_json).forEach(row => {
          Object.keys(row).forEach(key => {
            if (!udoAgg[key]) udoAgg[key] = { sum: 0, count: 0 };
            udoAgg[key].sum   += row[key];
            udoAgg[key].count += 1;
          });
        });
      });
    }

    return Object.keys(facilityAgg).map(key => ({
      key,
      subject:  metricNames[key] || key.replace(/_/g, ' ').toUpperCase(),
      score:    Math.round(facilityAgg[key].sum / facilityAgg[key].count),
      udoScore: showUdoCompare && udoAgg[key]
        ? Math.round(udoAgg[key].sum / udoAgg[key].count)
        : null,
      fullMark: 100,
    })).sort((a, b) => b.score - a.score);
  }, [latestSurvey, showUdoCompare, facility, facilities, surveys, type]);

  const averageScore   = chartData.length > 0 ? Math.round(chartData.reduce((s, d) => s + d.score, 0) / chartData.length) : 0;
  const totalResponses = latestSurvey?.summary_stats?.total_responses || 0;
  const redemptionRate = targetAudience && targetAudience > 0
    ? Math.round((totalResponses / targetAudience) * 100)
    : null;

  useEffect(() => { setAiReport(''); setReportTarget(null); }, [latestSurvey]);

  if (!isOpen) return null;

  const handleAction = async (target) => {
    setReportTarget(target);
    if (target === 'ospiti'    && latestSurvey.ai_report_ospiti)    { setAiReport(latestSurvey.ai_report_ospiti);    return; }
    if (target === 'direzione' && latestSurvey.ai_report_direzione) { setAiReport(latestSurvey.ai_report_direzione); return; }
    if (!process.env.REACT_APP_ANTHROPIC_API_KEY) { alert('Manca la chiave API di Anthropic'); return; }

    setIsGeneratingAI(true);
    try {
      const dataPayload = chartData.map(d => `${d.subject}: ${d.score}/100`).join('\n');
      const prompt      = getPromptAnalytics({ type, target, facilityName: facility.name, dataPayload });

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method:  'POST',
        headers: {
          'Content-Type':                            'application/json',
          'x-api-key':                               process.env.REACT_APP_ANTHROPIC_API_KEY,
          'anthropic-version':                       '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model:      'claude-sonnet-4-20250514',
          max_tokens: 2048,
          messages:   [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error?.message || response.statusText);
      }

      const json = await response.json();
      setAiReport(json.content[0].text);
    } catch (error) { alert('Errore AI: ' + error.message); }
    finally { setIsGeneratingAI(false); }
  };

  const handleRegenerate = async () => {
    try {
      const sourceTable = latestSurvey.summary_stats?.source ?? 'survey_seniorliving';
      const upd = {
        facility_id:  facility.id,
        calendar_id:  latestSurvey.calendar_id,
        source_table: sourceTable,
      };
      if (reportTarget === 'ospiti')    upd.ai_report_ospiti    = null;
      if (reportTarget === 'direzione') upd.ai_report_direzione = null;
      await supabase
        .from('survey_ai_reports')
        .upsert(upd, { onConflict: 'facility_id,calendar_id,source_table' });
      latestSurvey[`ai_report_${reportTarget}`] = null;
      handleAction(reportTarget);
    } catch (err) { alert('Errore ripristino: ' + err.message); }
  };

  const handleSaveAndPDF = async () => {
    try {
      const sourceTable = latestSurvey.summary_stats?.source ?? 'survey_seniorliving';
      const upd = {
        facility_id:  facility.id,
        calendar_id:  latestSurvey.calendar_id,
        source_table: sourceTable,
      };
      if (reportTarget === 'ospiti')    upd.ai_report_ospiti    = aiReport;
      if (reportTarget === 'direzione') upd.ai_report_direzione = aiReport;
      await supabase
        .from('survey_ai_reports')
        .upsert(upd, { onConflict: 'facility_id,calendar_id,source_table' });
      if (onUpdateSuccess) onUpdateSuccess();
    } catch (err) { alert('Errore DB: ' + err.message); return; }

    await exportPDF({
      sections: ['pdf-section-text', 'pdf-section-charts'],
      filename: `Relazione_${reportTarget === 'ospiti' ? 'Ospiti' : 'Direzione'}_${facility.name}_${latestSurvey.calendar_id}.pdf`,
      logoSrc:  companyLogoUrl,
      onDone:   () => setTimeout(onClose, 500),
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900 z-50 flex flex-col overflow-hidden animate-in fade-in duration-200">

      {/* ── SEZIONE PDF 1: testo (fotografata separatamente) ── */}
      <div style={{ position: 'absolute', left: '-15000px', top: 0 }}>
        <div id="pdf-section-text" className="bg-white text-black font-sans"
          style={{ width: '182mm', padding: '0', display: 'none' }}>

          {/* Avviso società aggregata */}
          {isCompanyWide && (
            <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fcd34d', color: '#b45309', padding: '8px 12px', borderRadius: '6px', marginBottom: '14px', fontSize: '10px', fontWeight: 'bold' }}>
              ⚠ Report aggregato a livello di Società.
            </div>
          )}

          {/* Titolo documento */}
          <p style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '3px', textAlign: 'center' }}>
            {facility.name} · {type === 'client' ? 'Clienti' : 'Operatori'} · {latestSurvey?.calendar_id}
          </p>
          <h1 style={{ textAlign: 'center', fontSize: '17px', fontWeight: '900', textTransform: 'uppercase', color: '#1e293b', borderBottom: '2px solid #e2e8f0', paddingBottom: '10px', marginBottom: '16px' }}>
            {reportTarget === 'ospiti' ? 'Risultati Questionario di Gradimento' : 'Relazione Direzionale'}
          </h1>

          {/* Box indicatori KPI */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 18px', marginBottom: '20px' }}>
            {[
              { label: 'Score Globale', value: `${averageScore}/100`, color: '#312e81' },
              { label: audienceLabel,   value: targetAudience ?? 'N/D', color: '#334155' },
              { label: 'Risposte',      value: totalResponses,          color: '#334155' },
              { label: 'Redemption',    value: redemptionRate !== null ? `${redemptionRate}%` : 'N/D', color: '#059669' },
            ].map((item, i, arr) => (
              <React.Fragment key={item.label}>
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <p style={{ fontSize: '8px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>{item.label}</p>
                  <p style={{ fontSize: '21px', fontWeight: '900', color: item.color }}>{item.value}</p>
                </div>
                {i < arr.length - 1 && <div style={{ width: '1px', height: '36px', backgroundColor: '#e2e8f0', flexShrink: 0 }} />}
              </React.Fragment>
            ))}
          </div>

          {/* Testo relazione AI — occupa tutto lo spazio che serve, nessun troncamento */}
          <div style={{ fontSize: '11px', lineHeight: '1.7', color: '#1e293b', whiteSpace: 'pre-wrap', fontWeight: '400' }}>
            {aiReport}
          </div>

        </div>
      </div>

      {/* ── SEZIONE PDF 2: grafici radar + istogramma insieme ── */}
      <div style={{ position: 'absolute', left: '-15000px', top: 0 }}>
        <div id="pdf-section-charts" className="bg-white text-black font-sans"
          style={{ width: '182mm', padding: '0', display: 'none' }}>

          {/* Titolo sezione grafici */}
          <p style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '14px', textAlign: 'center' }}>
            {facility.name} · Analisi grafica · {latestSurvey?.calendar_id}
          </p>

          {/* RADAR */}
          <h2 style={{ fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', color: '#475569', borderBottom: '1px solid #e2e8f0', paddingBottom: '5px', marginBottom: '8px' }}>
            Mappa Dimensionale
          </h2>
          <div style={{ width: '100%', height: '240px', marginBottom: '24px' }}>
            <RadarChart cx="50%" cy="50%" outerRadius="60%" data={chartData} width={580} height={240}>
              <PolarGrid stroke="#e2e8f0" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: '#475569', fontSize: 8, fontWeight: 'bold' }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 7 }} />
              <Radar name={facility.name} dataKey="score" stroke="#4f46e5" strokeWidth={2} fill="#4f46e5" fillOpacity={0.3} />
              {showUdoCompare && (
                <Radar name="Media UDO" dataKey="udoScore" stroke="#0ea5e9" strokeWidth={1.5} strokeDasharray="4 4" fill="#0ea5e9" fillOpacity={0.1} />
              )}
            </RadarChart>
          </div>

          {/* ISTOGRAMMA — sotto il radar, stessa pagina */}
          <h2 style={{ fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', color: '#475569', borderBottom: '1px solid #e2e8f0', paddingBottom: '5px', marginBottom: '8px' }}>
            Ranking Metriche
          </h2>
          <div style={{ width: '100%', height: Math.max(180, chartData.length * 16) + 'px' }}>
            <BarChart
              width={580}
              height={Math.max(180, chartData.length * 16)}
              data={chartData}
              layout="vertical"
              margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={true} vertical={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 8 }} />
              <YAxis dataKey="subject" type="category" width={185} tick={{ fontSize: 8, fill: '#334155', fontWeight: 'bold' }} />
              <Bar dataKey="score" fill="#1e3a8a" radius={[0, 3, 3, 0]} barSize={showUdoCompare ? 7 : 11} />
              {showUdoCompare && <Bar dataKey="udoScore" fill="#0284c7" radius={[0, 3, 3, 0]} barSize={7} />}
            </BarChart>
          </div>

        </div>
      </div>

      {/* ── HEADER MODALE ── */}
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
            <button onClick={() => setShowUdoCompare(!showUdoCompare)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold border ${showUdoCompare ? 'bg-sky-500/20 text-sky-400 border-sky-500/30' : 'bg-slate-800 text-slate-400 border-white/5'}`}>
              <Layers size={16} /> Benchmark UDO
            </button>
          )}
          <div className="w-px h-6 bg-white/10 mx-2" />
          <button onClick={onOpenImport}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold rounded-lg transition-colors border border-white/5">
            <UploadCloud size={16} /> Nuovi Dati
          </button>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-full"><X size={24} /></button>
        </div>
      </div>

      {/* ── BODY ── */}
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
                  <p className="text-xs font-medium opacity-80">
                    Questionario archiviato a livello di Società.
                    {isOperator ? ' Il conteggio operatori somma i dati KPI di tutte le strutture attive.' : ' Posti letto e Redemption includono la somma di tutte le strutture attive.'}
                  </p>
                </div>
              </div>
            )}

            {/* ── KPI BOX ── */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="bg-slate-800/50 border border-white/5 p-5 rounded-2xl flex flex-col justify-center items-center text-center">
                <Target size={24} className="text-emerald-400 mb-2" />
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Score</p>
                <p className="text-2xl font-black text-white">{averageScore}<span className="text-sm text-slate-500">/100</span></p>
              </div>

              <div className="bg-slate-800/50 border border-white/5 p-5 rounded-2xl flex flex-col justify-center items-center text-center">
                {isOperator ? <Users size={24} className="text-purple-400 mb-2" /> : <Bed size={24} className="text-amber-400 mb-2" />}
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{audienceLabel}</p>
                <p className="text-2xl font-black text-white">
                  {targetAudience ?? <span className="text-sm text-slate-500">N/D</span>}
                </p>
                {isOperator && !targetAudience && (
                  <p className="text-[9px] text-amber-400 mt-1">Inserisci KPI formazione</p>
                )}
              </div>

              <div className="bg-slate-800/50 border border-white/5 p-5 rounded-2xl flex flex-col justify-center items-center text-center">
                <Users size={24} className="text-blue-400 mb-2" />
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Risposte</p>
                <p className="text-2xl font-black text-white">{totalResponses}</p>
              </div>

              <div className="bg-slate-800/50 border border-white/5 p-5 rounded-2xl flex flex-col justify-center items-center text-center">
                <Percent size={24} className="text-pink-400 mb-2" />
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Redemption</p>
                <p className="text-2xl font-black text-white">
                  {redemptionRate !== null ? `${redemptionRate}%` : <span className="text-sm text-slate-500">N/D</span>}
                </p>
              </div>

              <div className="bg-slate-800/50 border border-white/5 p-3 rounded-2xl flex flex-col justify-center gap-2">
                {['ospiti', 'direzione'].map(target => (
                  <button key={target} onClick={() => handleAction(target)} disabled={isGeneratingAI}
                    className={`w-full py-2 text-[10px] font-black uppercase tracking-widest rounded-lg flex items-center justify-center gap-2 transition-all ${
                      reportTarget === target
                        ? 'bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)]'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}>
                    <BrainCircuit size={14} />
                    {isGeneratingAI && reportTarget === target
                      ? 'Elaborazione...'
                      : latestSurvey[`ai_report_${target}`]
                        ? `Report ${target === 'ospiti' ? 'Ospiti' : 'Direzione'}`
                        : `Genera ${target === 'ospiti' ? 'Ospiti' : 'Direzione'}`
                    }
                  </button>
                ))}
              </div>
            </div>

            {/* ── GRAFICI ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-slate-800/50 border border-white/5 p-6 rounded-2xl flex flex-col">
                <h3 className="text-sm font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                  <Activity size={16} className="text-indigo-400" /> Mappa Dimensionale
                </h3>
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

            {/* ── REPORT AI ── */}
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
                <textarea value={aiReport} onChange={e => setAiReport(e.target.value)}
                  className="w-full bg-slate-900/50 border border-indigo-500/30 rounded-xl p-6 text-slate-300 text-[13px] leading-relaxed font-medium mb-8 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                  rows={20} />
                <button onClick={handleSaveAndPDF}
                  className="w-full font-black py-4 rounded-xl shadow-lg transition-all flex items-center justify-center uppercase tracking-widest bg-emerald-500 hover:bg-emerald-600 text-white">
                  <FileDown size={20} className="inline mr-2" />
                  Salva e Genera PDF {reportTarget === 'ospiti' ? 'Ospiti' : 'Direzione'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
