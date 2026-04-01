/**
 * src/components/GlobalReportModal.jsx  —  v2
 *
 * NOVITÀ v2: sistema a due tab
 *   - Tab SURVEY: identico all'originale (nessuna modifica)
 *   - Tab KPI: analisi KPI con perimetro (struttura / UDO / gruppo)
 *              e orizzonte temporale (mese singolo / intervallo di mesi)
 *
 * Prop aggiunta: kpiRecords (già passata da App.js v3)
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  X, FileSignature, BrainCircuit, FileDown,
  Layers, Building2, BarChart2, Calendar, TrendingUp
} from 'lucide-react';
import { GoogleGenerativeAI }       from '@google/generative-ai';
import { buildPromptGlobaleBoard, buildPromptKpiMensile, buildPromptKpiPeriodo } from '../config/aiPrompts';
import { KPI_RULES, getKpiStatus }  from '../config/kpiRules';
import { evaluateKpiFormula }       from '../utils/kpiFormulaEngine';
import { MONTHS }                   from '../config/constants';
import { exportPDF }                from '../utils/pdfExport';

// ── Costanti survey (identiche all'originale) ────────────────
const metricNames = {
  soddisfazione_generale: 'Soddisfazione Globale', info_cura: 'Chiarezza Progetto di Cura',
  ascolto: "Qualità dell'Ascolto", contatto_struttura: 'Reperibilità Struttura',
  relazione_equipe: "Relazione con l'Equipe", voto_assistenza: 'Assistenza Personale',
  voto_alloggio: 'Comfort Alloggio', soddisfazione_pulizia: 'Igiene e Pulizia',
  voto_animazione: 'Attività Ricreative', cura_bisogni: 'Attenzione ai Bisogni',
  nps_consiglio: 'Propensione Raccomandazione (NPS)', info_prenotazione: 'Info in Prenotazione',
  info_ingresso: 'Accoglienza Ingresso', voto_bagno: 'Servizi Igienici',
  voto_spazio_esterno: 'Spazi Esterni', voto_pulizie: 'Personale Pulizie',
  voto_ristorazione_qualita: 'Qualità Ristorazione', soddisfazione_tempo: "Tempo Dedicato all'Ospite",
  appagamento_vita: 'Appagamento Quotidiano', assistenza_diurna: 'Assistenza Diurna',
  assistenza_notturna: 'Assistenza Notturna', rispetto_dignita: 'Rispetto della Dignità',
  coinvolgimento_cure: 'Coinvolgimento nelle Cure',
};


// ── Helpers KPI ───────────────────────────────────────────────
const TRAFFIC_COLOR = { green: '#22c55e', yellow: '#f59e0b', red: '#ef4444', neutral: '#94a3b8' };
const STATUS_LABEL  = { green: 'Verde', yellow: 'Giallo', red: 'Rosso', neutral: '—' };

const now = new Date();
const CUR_YEAR  = now.getFullYear();
const CUR_MONTH = now.getMonth() + 1;

/** Calcola il valore di un KPI e il suo stato semaforo */
function computeKpiEntry(rule, metricsJson, facility) {
  const { result } = evaluateKpiFormula(rule.calcolo, metricsJson, facility);
  if (result === null) return null;
  const isPerc  = !['NUMERI','ISPEZIONI'].includes(rule.settore);
  const display = isPerc ? Math.round(result * 1000) / 10 : Math.round(result * 10) / 10;
  const status  = getKpiStatus(rule, isPerc ? result : result);
  return { display, status, unit: isPerc ? '%' : '' };
}

/**
 * Aggrega i record KPI di un insieme di strutture per un mese specifico.
 * Ritorna: [ { rule, entries: [ { facilityName, value, status } ], avg, statusCounts } ]
 */
function aggregateKpiForMonth(rules, facilities, kpiRecords, year, month) {
  return rules.map(rule => {
    const entries = [];
    facilities.forEach(f => {
      const rec = kpiRecords.find(k =>
        String(k.facility_id) === String(f.id) &&
        Number(k.year) === year && Number(k.month) === month &&
        k.status === 'completed'
      );
      if (!rec?.metrics_json) return;
      const entry = computeKpiEntry(rule, rec.metrics_json, f);
      if (entry) entries.push({ facilityName: f.name, ...entry });
    });

    const statusCounts = { green: 0, yellow: 0, red: 0, neutral: 0 };
    entries.forEach(e => { statusCounts[e.status] = (statusCounts[e.status] || 0) + 1; });

    const vals = entries.map(e => e.display).filter(v => v !== null);
    const avg  = vals.length ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10 : null;

    // Stato aggregato: il più critico
    const aggStatus = entries.length === 0 ? 'neutral'
      : statusCounts.red    > 0 ? 'red'
      : statusCounts.yellow > 0 ? 'yellow'
      : 'green';

    return { rule, entries, avg, statusCounts, aggStatus };
  }); // tutti i 37 KPI, anche quelli senza dati (entries vuote)
}

/**
 * Aggrega su un intervallo di mesi: per ogni KPI calcola il trend mese per mese.
 */
function aggregateKpiForPeriod(rules, facilities, kpiRecords, months) {
  return rules.map(rule => {
    const trend = months.map(({ year, month }) => {
      const entries = [];
      facilities.forEach(f => {
        const rec = kpiRecords.find(k =>
          String(k.facility_id) === String(f.id) &&
          Number(k.year) === year && Number(k.month) === month &&
          k.status === 'completed'
        );
        if (!rec?.metrics_json) return;
        const entry = computeKpiEntry(rule, rec.metrics_json, f);
        if (entry) entries.push(entry.display);
      });
      const avg = entries.length ? Math.round((entries.reduce((s,v) => s+v,0) / entries.length) * 10) / 10 : null;
      const mn  = MONTHS.find(m => m.id === month);
      return { label: `${mn?.short || month}/${String(year).slice(2)}`, avg };
    }).filter(t => t.avg !== null);

    if (trend.length === 0) return null;

    const vals      = trend.map(t => t.avg);
    const first     = vals[0];
    const last      = vals[vals.length - 1];
    const delta     = last - first;
    const trend_dir = delta > 0.5 ? 'crescita' : delta < -0.5 ? 'calo' : 'stabile';

    return { rule, trend, delta: delta ?? 0, trend_dir: trend_dir ?? 'n/d' };
  }); // tutti i KPI inclusi quelli senza dati
}

// ── Componente principale ─────────────────────────────────────
export default function GlobalReportModal({
  isOpen, onClose, facilities, udos, surveys, kpiRecords = []
}) {
  const [activeTab, setActiveTab] = useState('survey'); // 'survey' | 'kpi'

  // ── Survey state (identico all'originale) ─────────────────
  const [reportType,  setReportType]  = useState('client');
  const [reportScope, setReportScope] = useState('all');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiReport,    setAiReport]    = useState('');

  // ── KPI state (nuovo) ─────────────────────────────────────
  const [kpiMode,      setKpiMode]      = useState('month');   // 'month' | 'period'
  const [kpiScope,     setKpiScope]     = useState('all');     // 'all' | udo_id | facility_id
  const [kpiScopeType, setKpiScopeType] = useState('group');   // 'group' | 'udo' | 'facility'
  const [kpiYear,      setKpiYear]      = useState(CUR_YEAR);
  const [kpiMonth,     setKpiMonth]     = useState(CUR_MONTH > 1 ? CUR_MONTH - 1 : 12);
  const [kpiPeriodStart, setKpiPeriodStart] = useState({ year: CUR_YEAR, month: 1 });
  const [kpiPeriodEnd,   setKpiPeriodEnd]   = useState({ year: CUR_YEAR, month: CUR_MONTH > 1 ? CUR_MONTH - 1 : 12 });
  const [kpiAiReport,  setKpiAiReport]  = useState('');
  const [kpiGenerating, setKpiGenerating] = useState(false);


  // Reset report quando cambiano i parametri
  useEffect(() => { setAiReport(''); }, [reportType, reportScope]);
  useEffect(() => { setKpiAiReport(''); }, [kpiMode, kpiScope, kpiScopeType, kpiYear, kpiMonth, kpiPeriodStart, kpiPeriodEnd]);

  // ── Strutture target per KPI ──────────────────────────────
  const kpiFacilities = useMemo(() => {
    let facs = facilities.filter(f => !f.is_suspended);
    if (kpiScopeType === 'udo')      facs = facs.filter(f => String(f.udo_id) === String(kpiScope));
    if (kpiScopeType === 'facility') facs = facs.filter(f => String(f.id)     === String(kpiScope));
    return facs;
  }, [facilities, kpiScope, kpiScopeType]);

  // ── Mesi del periodo ──────────────────────────────────────
  const periodMonths = useMemo(() => {
    if (kpiMode !== 'period') return [];
    const months = [];
    let { year, month } = kpiPeriodStart;
    const endY = kpiPeriodEnd.year, endM = kpiPeriodEnd.month;
    for (let i = 0; i < 36; i++) {
      months.push({ year, month });
      if (year === endY && month === endM) break;
      month++;
      if (month > 12) { month = 1; year++; }
    }
    return months;
  }, [kpiMode, kpiPeriodStart, kpiPeriodEnd]);

  // ── Aggregazione KPI ──────────────────────────────────────
  const kpiAggregated = useMemo(() => {
    if (kpiMode === 'month') {
      return aggregateKpiForMonth(KPI_RULES, kpiFacilities, kpiRecords, kpiYear, kpiMonth);
    }
    return aggregateKpiForPeriod(KPI_RULES, kpiFacilities, kpiRecords, periodMonths);
  }, [kpiMode, kpiFacilities, kpiRecords, kpiYear, kpiMonth, periodMonths]);

  // ── Survey aggregation (identica all'originale) ───────────
  const aggregatedData = useMemo(() => {
    let targetFacilities = facilities.filter(f => !f.is_suspended);
    if (reportScope !== 'all') targetFacilities = targetFacilities.filter(f => String(f.udo_id) === String(reportScope));

    let allResponses = [], facilitiesIncluded = 0, totalBeds = 0;
    targetFacilities.forEach(f => {
      const fSurveys = surveys.filter(s => s.type === reportType && (s.facility_id === f.id || (!s.facility_id && s.company_id === f.company_id)));
      if (fSurveys.length > 0) {
        const latest = fSurveys.sort((a, b) => b.calendar_id.localeCompare(a.calendar_id))[0];
        if (latest.responses_json) {
          allResponses = allResponses.concat(latest.responses_json);
          facilitiesIncluded++;
          totalBeds += (f.bed_count || 0);
        }
      }
    });
    if (allResponses.length === 0) return { chartData: [], averageScore: 0, totalResponses: 0, facilitiesIncluded: 0, totalBeds: 0 };

    const aggregates = {};
    allResponses.forEach(row => {
      Object.keys(row).forEach(key => {
        if (!aggregates[key]) aggregates[key] = { sum: 0, count: 0 };
        aggregates[key].sum += row[key]; aggregates[key].count += 1;
      });
    });
    const chartData = Object.keys(aggregates).map(key => ({
      key, subject: metricNames[key] || key.replace(/_/g, ' ').toUpperCase(),
      score: Math.round(aggregates[key].sum / aggregates[key].count)
    })).sort((a, b) => b.score - a.score);
    const averageScore = chartData.length > 0 ? Math.round(chartData.reduce((a, c) => a + c.score, 0) / chartData.length) : 0;
    return { chartData, averageScore, totalResponses: allResponses.length, facilitiesIncluded, totalBeds };
  }, [facilities, surveys, reportScope, reportType]);

  if (!isOpen) return null;

  const scopeName = reportScope === 'all' ? 'Tutto il Gruppo' : (udos.find(u => String(u.id) === String(reportScope))?.name || 'UDO');
  const typeName  = reportType === 'client' ? 'Clienti / Ospiti' : 'Staff / Operatori';

  // ── Nomi perimetro KPI ────────────────────────────────────
  const kpiScopeName = kpiScopeType === 'group'    ? 'Tutto il Gruppo'
    : kpiScopeType === 'udo'      ? (udos.find(u => String(u.id) === String(kpiScope))?.name || 'UDO')
    : (facilities.find(f => String(f.id) === String(kpiScope))?.name || 'Struttura');

  const kpiMonthName = MONTHS.find(m => m.id === kpiMonth)?.name || '';

  // ── Survey: genera relazione AI ───────────────────────────
  const generateSurveyReport = async () => {
    if (!process.env.REACT_APP_GEMINI_API_KEY) { alert('Manca la chiave API Gemini'); return; }
    if (aggregatedData.chartData.length === 0) { alert('Nessun dato disponibile per questa selezione.'); return; }
    setIsGenerating(true);
    try {
      const genAI = new GoogleGenerativeAI(process.env.REACT_APP_GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const dataPayload = aggregatedData.chartData.map(d => `${d.subject}: ${d.score}/100`).join('\n');
      const prompt = buildPromptGlobaleBoard({ scopeName, typeName, facilitiesIncluded: aggregatedData.facilitiesIncluded, totalResponses: aggregatedData.totalResponses, averageScore: aggregatedData.averageScore, dataPayload });
      const result = await model.generateContent(prompt);
      setAiReport(result.response.text());
    } catch (error) { alert('Errore generazione: ' + error.message); }
    finally { setIsGenerating(false); }
  };

  // ── KPI: genera relazione AI ──────────────────────────────
  const generateKpiReport = async () => {
    if (!process.env.REACT_APP_GEMINI_API_KEY) { alert('Manca la chiave API Gemini'); return; }
    if (kpiAggregated.length === 0) { alert('Nessun dato KPI disponibile per la selezione corrente.'); return; }
    setKpiGenerating(true);
    try {
      const genAI = new GoogleGenerativeAI(process.env.REACT_APP_GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      let prompt;
      if (kpiMode === 'month') {
        // Payload mensile: Nome KPI | Valore medio | Target verde | Target rosso | Stato aggregato
        const kpiPayload = kpiAggregated.map(r => {
          const tv = r.rule.target_verde !== null ? (r.rule.target_verde * 100).toFixed(1) + '%' : '—';
          const tr = r.rule.target_rosso !== null ? (r.rule.target_rosso * 100).toFixed(1) + '%' : '—';
          const val = r.avg !== null ? `${r.avg}${r.entries[0]?.unit || ''}` : '—';
          return `${r.rule.kpi_target} | ${val} | ${tv} | ${tr} | ${STATUS_LABEL[r.aggStatus]}`;
        }).join('\n');

        // Anomalie logiche semplici (strutture in rosso)
        const anomalie = kpiAggregated
          .filter(r => r.aggStatus === 'red')
          .map(r => `${r.rule.kpi_target} in rosso (${r.statusCounts.red} strutture su ${r.entries.length})`);

        prompt = buildPromptKpiMensile({
          scopeName:  kpiScopeName,
          mese:       kpiMonthName,
          anno:       kpiYear,
          kpiPayload,
          anomalie,
        });
      } else {
        // Payload periodo: per ogni KPI mostra trend mensile
        const kpiTrendPayload = kpiAggregated.map(r => {
          const trendStr = r.trend.map(t => `${t.label}: ${t.avg}${r.trend[0]?.avg ? '%' : ''}`).join(' → ');
          const deltaSign = r.delta > 0 ? '+' : '';
          return `${r.rule.kpi_target} | Trend: ${trendStr} | Var: ${deltaSign}${r.delta?.toFixed(1) || 0} | ${r.trend_dir}`;
        }).join('\n');

        const startMon = MONTHS.find(m => m.id === kpiPeriodStart.month)?.name || '';
        const endMon   = MONTHS.find(m => m.id === kpiPeriodEnd.month)?.name || '';

        prompt = buildPromptKpiPeriodo({
          scopeName:      kpiScopeName,
          periodoStart:   `${startMon} ${kpiPeriodStart.year}`,
          periodoEnd:     `${endMon} ${kpiPeriodEnd.year}`,
          kpiTrendPayload,
        });
      }

      const result = await model.generateContent(prompt);
      setKpiAiReport(result.response.text());
    } catch (error) { alert('Errore generazione KPI: ' + error.message); }
    finally { setKpiGenerating(false); }
  };

  // ── Export PDF survey (identico all'originale) ────────────
  const exportSurveyPDF = () => {
    exportPDF({
      elementId: 'global-pdf-template',
      filename:  `Relazione_Globale_${scopeName.replace(/ /g, '_')}_${reportType}.pdf`,
    });
  };

  // ── Export PDF KPI ────────────────────────────────────────
  const exportKpiPDF = () => {
    const periodo = kpiMode === 'month'
      ? `${kpiMonthName}_${kpiYear}`
      : `${kpiPeriodStart.year}${kpiPeriodStart.month}_${kpiPeriodEnd.year}${kpiPeriodEnd.month}`;
    exportPDF({
      elementId: 'kpi-pdf-template',
      filename:  `Relazione_KPI_${kpiScopeName.replace(/ /g, '_')}_${periodo}.pdf`,
    });
  };

  const years = [CUR_YEAR - 1, CUR_YEAR, CUR_YEAR + 1].filter(y => y >= 2024);

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">

      {/* ── PDF SURVEY (nascosto) ── */}
      <div style={{ position: 'absolute', left: '-15000px', top: 0 }}>
        <div id="global-pdf-template" className="bg-white text-black font-sans" style={{ width: '180mm', display: 'none' }}>
          
          <p style={{ textAlign:'center', fontSize:'14px', fontWeight:'bold', color:'#4f46e5', textTransform:'uppercase', letterSpacing:'2px', marginBottom:'8px' }}>
            {scopeName} · Analisi {typeName}
          </p>
          <h1 style={{ textAlign:'center', fontSize:'22px', fontWeight:'900', textTransform:'uppercase', color:'#1e293b', borderBottom:'2px solid #e2e8f0', paddingBottom:'12px', marginBottom:'24px' }}>
            REPORT DIREZIONALE AGGREGATO
          </h1>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', backgroundColor:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:'12px', padding:'20px 24px', marginBottom:'32px' }}>
            {[
              { label:'Score Medio',        value: `${aggregatedData.averageScore}/100`, color:'#312e81' },
              { label:'Strutture Incluse',  value: aggregatedData.facilitiesIncluded,    color:'#334155' },
              { label:'Posti Letto',        value: aggregatedData.totalBeds,             color:'#334155' },
              { label:'Risposte Elaborate', value: aggregatedData.totalResponses,        color:'#059669' },
            ].map((item, i, arr) => (
              <React.Fragment key={item.label}>
                <div style={{ textAlign:'center', width:'22%' }}>
                  <p style={{ fontSize:'9px', fontWeight:'900', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'6px' }}>{item.label}</p>
                  <p style={{ fontSize:'26px', fontWeight:'900', color: item.color }}>{item.value}</p>
                </div>
                {i < arr.length - 1 && <div style={{ width:'1px', height:'48px', backgroundColor:'#e2e8f0' }} />}
              </React.Fragment>
            ))}
          </div>
          <div style={{ fontSize:'12px', lineHeight:'1.7', color:'#1e293b', whiteSpace:'pre-wrap', fontWeight:'500', marginBottom:'40px' }}>{aiReport}</div>
          
        </div>
      </div>

      {/* ── PDF KPI (nascosto) ── */}
      <div style={{ position: 'absolute', left: '-15000px', top: 0 }}>
        <div id="kpi-pdf-template" className="bg-white text-black font-sans" style={{ width: '180mm', display: 'none' }}>
          
          <p style={{ textAlign:'center', fontSize:'14px', fontWeight:'bold', color:'#4f46e5', textTransform:'uppercase', letterSpacing:'2px', marginBottom:'8px' }}>
            {kpiScopeName} · Analisi KPI · {kpiMode === 'month' ? `${kpiMonthName} ${kpiYear}` : `${MONTHS.find(m => m.id === kpiPeriodStart.month)?.name} ${kpiPeriodStart.year} — ${MONTHS.find(m => m.id === kpiPeriodEnd.month)?.name} ${kpiPeriodEnd.year}`}
          </p>
          <h1 style={{ textAlign:'center', fontSize:'22px', fontWeight:'900', textTransform:'uppercase', color:'#1e293b', borderBottom:'2px solid #e2e8f0', paddingBottom:'12px', marginBottom:'24px' }}>
            RELAZIONE KPI DIREZIONALE
          </h1>
          <div style={{ fontSize:'12px', lineHeight:'1.7', color:'#1e293b', whiteSpace:'pre-wrap', fontWeight:'500', marginBottom:'32px' }}>{kpiAiReport}</div>
          {/* Tabella KPI sintetica nel PDF */}
          <h2 style={{ fontSize:'13px', fontWeight:'900', textTransform:'uppercase', color:'#1e293b', borderBottom:'1px solid #e2e8f0', paddingBottom:'6px', marginBottom:'12px' }}>
            {kpiMode === 'month' ? 'Dettaglio indicatori' : 'Andamento indicatori per periodo'}
          </h2>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'10px' }}>
            <thead>
              <tr style={{ backgroundColor:'#f8fafc' }}>
                <th style={{ textAlign:'left', padding:'6px 8px', borderBottom:'1px solid #e2e8f0', fontWeight:'900', color:'#475569' }}>Indicatore</th>
                {kpiMode === 'month' ? (
                  <>
                    <th style={{ textAlign:'center', padding:'6px 8px', borderBottom:'1px solid #e2e8f0', fontWeight:'900', color:'#475569' }}>Valore</th>
                    <th style={{ textAlign:'center', padding:'6px 8px', borderBottom:'1px solid #e2e8f0', fontWeight:'900', color:'#475569' }}>Stato</th>
                    <th style={{ textAlign:'center', padding:'6px 8px', borderBottom:'1px solid #e2e8f0', fontWeight:'900', color:'#475569' }}>Strutture</th>
                  </>
                ) : (
                  <>
                    <th style={{ textAlign:'center', padding:'6px 8px', borderBottom:'1px solid #e2e8f0', fontWeight:'900', color:'#475569' }}>Trend</th>
                    <th style={{ textAlign:'center', padding:'6px 8px', borderBottom:'1px solid #e2e8f0', fontWeight:'900', color:'#475569' }}>Variazione</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {kpiMode === 'month'
                ? kpiAggregated.map((r, i) => (
                    <tr key={i} style={{ borderBottom:'1px solid #f1f5f9' }}>
                      <td style={{ padding:'5px 8px', color:'#334155', fontWeight:'600' }}>{r.rule.kpi_target}</td>
                      <td style={{ textAlign:'center', padding:'5px 8px', fontWeight:'900', color: TRAFFIC_COLOR[r.aggStatus] }}>{r.avg ?? '—'}{r.entries[0]?.unit || ''}</td>
                      <td style={{ textAlign:'center', padding:'5px 8px' }}>
                        <span style={{ backgroundColor: TRAFFIC_COLOR[r.aggStatus] + '22', color: TRAFFIC_COLOR[r.aggStatus], padding:'2px 8px', borderRadius:'4px', fontWeight:'900', fontSize:'9px' }}>{STATUS_LABEL[r.aggStatus]}</span>
                      </td>
                      <td style={{ textAlign:'center', padding:'5px 8px', color:'#64748b' }}>{r.entries.length}</td>
                    </tr>
                  ))
                : kpiAggregated.map((r, i) => (
                    <tr key={i} style={{ borderBottom:'1px solid #f1f5f9' }}>
                      <td style={{ padding:'5px 8px', color:'#334155', fontWeight:'600' }}>{r.rule.kpi_target}</td>
                      <td style={{ padding:'5px 8px', color:'#64748b', fontSize:'9px' }}>{r.trend.map(t => `${t.label}:${t.avg}`).join(' · ')}</td>
                      <td style={{ textAlign:'center', padding:'5px 8px', fontWeight:'900', color: r.delta >= 0 ? '#22c55e' : '#ef4444' }}>
                        {r.delta >= 0 ? '+' : ''}{r.delta?.toFixed(1)}
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
          
        </div>
      </div>

      {/* ── MODALE ── */}
      <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-slate-950 px-8 py-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/30"><FileSignature size={24} /></div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-wider">Centro Elaborazione Relazioni Globali</h2>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Analisi aggregata Survey e KPI di Gruppo / UDO / Struttura</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-full transition-colors"><X size={26} /></button>
        </div>

        {/* Tab nav */}
        <div className="bg-slate-900 px-8 flex gap-1 shrink-0">
          <button onClick={() => setActiveTab('survey')}
            className={`flex items-center gap-2 px-6 py-3 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${
              activeTab === 'survey' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}>
            <FileSignature size={15} /> Questionari Survey
          </button>
          <button onClick={() => setActiveTab('kpi')}
            className={`flex items-center gap-2 px-6 py-3 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${
              activeTab === 'kpi' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}>
            <BarChart2 size={15} /> Analisi KPI
          </button>
        </div>

        {/* ══════════════ TAB SURVEY (identico all'originale) ══════════════ */}
        {activeTab === 'survey' && (
          <>
            <div className="bg-slate-50 border-b border-slate-200 p-6 flex items-center gap-6 shrink-0">
              <div className="flex-1 flex items-center gap-4 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                <Layers className="text-slate-400 ml-2" size={20} />
                <select value={reportType} onChange={e => setReportType(e.target.value)} className="bg-transparent font-black text-slate-700 outline-none w-full cursor-pointer uppercase text-sm">
                  <option value="client">Analisi Gradimento (Clienti/Ospiti)</option>
                  <option value="operator">Analisi Clima (Staff/Operatori)</option>
                </select>
              </div>
              <div className="flex-1 flex items-center gap-4 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                <Building2 className="text-slate-400 ml-2" size={20} />
                <select value={reportScope} onChange={e => setReportScope(e.target.value)} className="bg-transparent font-black text-slate-700 outline-none w-full cursor-pointer uppercase text-sm">
                  <option value="all">Perimetro: Tutto il Gruppo</option>
                  {udos.map(u => <option key={u.id} value={u.id}>Perimetro: {u.name}</option>)}
                </select>
              </div>
              <button onClick={generateSurveyReport} disabled={isGenerating || aggregatedData.totalResponses === 0}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white px-8 py-4 rounded-xl font-black uppercase tracking-widest shadow-md transition-all flex items-center gap-3 shrink-0">
                <BrainCircuit size={20} />
                {isGenerating ? 'Elaborazione...' : 'Genera Relazione IA'}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-100 p-8 flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <div className="flex gap-8">
                  {[
                    { label:'Strutture Lette', value: aggregatedData.facilitiesIncluded },
                    { label:'Risposte Fuse',   value: aggregatedData.totalResponses },
                    { label:'Score Medio',     value: `${aggregatedData.averageScore}/100`, cls: 'text-indigo-600' },
                  ].map(s => (
                    <div key={s.label}>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{s.label}</p>
                      <p className={`text-2xl font-black ${s.cls || 'text-slate-800'}`}>{s.value}</p>
                    </div>
                  ))}
                </div>
                {aggregatedData.totalResponses === 0 && (
                  <span className="bg-rose-100 text-rose-600 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest">Dati Insufficienti nel perimetro</span>
                )}
              </div>

              {aiReport ? (
                <div className="flex-1 flex flex-col">
                  <textarea value={aiReport} onChange={e => setAiReport(e.target.value)}
                    className="w-full flex-1 bg-white border border-slate-300 rounded-xl p-8 text-slate-800 text-[14px] leading-relaxed font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none shadow-inner" />
                  <button onClick={exportSurveyPDF} className="mt-6 w-full font-black py-4 rounded-xl shadow-lg uppercase tracking-widest bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center gap-2">
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
          </>
        )}

        {/* ══════════════ TAB KPI (nuovo) ══════════════ */}
        {activeTab === 'kpi' && (
          <>
            {/* ── Barra controlli KPI ── */}
            <div className="bg-slate-50 border-b border-slate-200 p-5 shrink-0 space-y-4">

              {/* Riga 1: modalità + perimetro */}
              <div className="flex items-center gap-4 flex-wrap">

                {/* Modalità: mese / periodo */}
                <div className="flex gap-1 bg-white border border-slate-200 p-1 rounded-xl shadow-sm">
                  <button onClick={() => setKpiMode('month')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                      kpiMode === 'month' ? 'bg-emerald-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'
                    }`}>
                    <Calendar size={13} /> Mese singolo
                  </button>
                  <button onClick={() => setKpiMode('period')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                      kpiMode === 'period' ? 'bg-emerald-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'
                    }`}>
                    <TrendingUp size={13} /> Intervallo
                  </button>
                </div>

                {/* Perimetro: gruppo / UDO / struttura */}
                <div className="flex gap-1 bg-white border border-slate-200 p-1 rounded-xl shadow-sm">
                  {[
                    { type:'group',    label:'Tutto il Gruppo' },
                    { type:'udo',      label:'Per UDO'         },
                    { type:'facility', label:'Struttura'       },
                  ].map(({ type, label }) => (
                    <button key={type} onClick={() => { setKpiScopeType(type); setKpiScope('all'); }}
                      className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                        kpiScopeType === type ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:bg-slate-50'
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>

                {/* Selettore UDO o struttura (condizionale) */}
                {kpiScopeType === 'udo' && (
                  <select value={kpiScope} onChange={e => setKpiScope(e.target.value)}
                    className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500 cursor-pointer shadow-sm">
                    {udos.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                )}
                {kpiScopeType === 'facility' && (
                  <select value={kpiScope} onChange={e => setKpiScope(e.target.value)}
                    className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500 cursor-pointer shadow-sm">
                    <option value="all">Seleziona struttura...</option>
                    {facilities.filter(f => !f.is_suspended).sort((a,b) => a.name.localeCompare(b.name)).map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Riga 2: selezione temporale */}
              {kpiMode === 'month' ? (
                <div className="flex items-center gap-3">
                  <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Mese di riferimento:</span>
                  <select value={kpiYear} onChange={e => setKpiYear(Number(e.target.value))}
                    className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500">
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <select value={kpiMonth} onChange={e => setKpiMonth(Number(e.target.value))}
                    className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500">
                    {MONTHS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
              ) : (
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Da:</span>
                  <select value={kpiPeriodStart.year} onChange={e => setKpiPeriodStart(p => ({ ...p, year: Number(e.target.value) }))}
                    className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500">
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <select value={kpiPeriodStart.month} onChange={e => setKpiPeriodStart(p => ({ ...p, month: Number(e.target.value) }))}
                    className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500">
                    {MONTHS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                  <span className="text-xs font-black text-slate-500 uppercase tracking-widest">A:</span>
                  <select value={kpiPeriodEnd.year} onChange={e => setKpiPeriodEnd(p => ({ ...p, year: Number(e.target.value) }))}
                    className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500">
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <select value={kpiPeriodEnd.month} onChange={e => setKpiPeriodEnd(p => ({ ...p, month: Number(e.target.value) }))}
                    className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500">
                    {MONTHS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                  <span className="text-xs text-slate-400 font-bold">({periodMonths.length} mesi)</span>
                </div>
              )}
            </div>

            {/* ── Body KPI ── */}
            <div className="flex-1 overflow-y-auto bg-slate-100 p-6 flex flex-col gap-6">

              {/* Anteprima dati + pulsante genera */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Perimetro</p>
                      <p className="font-black text-slate-800">{kpiScopeName}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Strutture</p>
                      <p className="font-black text-slate-800">{kpiFacilities.length}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Indicatori con dati</p>
                      <p className="font-black text-emerald-600">{kpiAggregated.filter(r => r.entries.length > 0).length} / {kpiAggregated.length}</p>
                    </div>
                    {kpiMode === 'month' && (
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Periodo</p>
                        <p className="font-black text-slate-800">{kpiMonthName} {kpiYear}</p>
                      </div>
                    )}
                  </div>
                  <button onClick={generateKpiReport}
                    disabled={kpiGenerating || kpiAggregated.every(r => r.entries.length === 0) || (kpiScopeType === 'facility' && kpiScope === 'all')}
                    className="flex items-center gap-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white px-6 py-3 rounded-xl font-black uppercase tracking-widest shadow-md transition-all text-sm">
                    <BrainCircuit size={18} />
                    {kpiGenerating ? 'Analisi in corso...' : 'Genera Relazione KPI IA'}
                  </button>
                </div>

                {/* Preview tabella KPI — altezza fissa con scroll */}
                {kpiFacilities.length === 0 ? (
                  <div className="p-12 text-center text-slate-400">
                    <BarChart2 size={48} className="mx-auto mb-4 opacity-40" />
                    <p className="font-bold uppercase tracking-widest">Nessuna struttura nel perimetro selezionato</p>
                  </div>
                ) : kpiMode === 'month' ? (
                  /* Tabella mese singolo */
                  <div className="overflow-x-auto overflow-y-auto max-h-[420px]">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                        <tr>
                          <th className="text-left px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">Indicatore</th>
                          <th className="text-left px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">Settore</th>
                          <th className="text-center px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">Valore Medio</th>
                          <th className="text-center px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">Stato</th>
                          <th className="text-center px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">🟢</th>
                          <th className="text-center px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">🟡</th>
                          <th className="text-center px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">🔴</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {kpiAggregated.map((r, i) => {
                          const hasData = r.entries.length > 0;
                          return (
                          <tr key={i} className={`transition-colors ${hasData ? 'hover:bg-slate-50' : 'opacity-40'}`}>
                            <td className="px-4 py-2 font-bold text-slate-800 text-xs">{r.rule.kpi_target}</td>
                            <td className="px-4 py-2 text-xs text-slate-400 font-bold uppercase">{r.rule.settore}</td>
                            <td className="px-4 py-2 text-center font-black text-sm" style={{ color: hasData ? TRAFFIC_COLOR[r.aggStatus] : '#94a3b8' }}>
                              {hasData && r.avg !== null ? `${r.avg}${r.entries[0]?.unit || ''}` : '—'}
                            </td>
                            <td className="px-4 py-2 text-center">
                              {hasData ? (
                                <span className="inline-block text-[10px] font-black px-2 py-0.5 rounded-lg"
                                  style={{ backgroundColor: TRAFFIC_COLOR[r.aggStatus] + '22', color: TRAFFIC_COLOR[r.aggStatus] }}>
                                  {STATUS_LABEL[r.aggStatus]}
                                </span>
                              ) : <span className="text-[10px] text-slate-300">n/d</span>}
                            </td>
                            <td className="px-4 py-2 text-center text-xs font-black text-emerald-600">{r.statusCounts.green || 0}</td>
                            <td className="px-4 py-2 text-center text-xs font-black text-amber-500">{r.statusCounts.yellow || 0}</td>
                            <td className="px-4 py-2 text-center text-xs font-black text-red-500">{r.statusCounts.red || 0}</td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  /* Tabella periodo */
                  <div className="overflow-x-auto overflow-y-auto max-h-[420px]">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="text-left px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-widest sticky left-0 bg-slate-50">Indicatore</th>
                          {periodMonths.map(({ year, month }) => {
                            const m = MONTHS.find(mo => mo.id === month);
                            return (
                              <th key={`${year}-${month}`} className="text-center px-3 py-3 text-xs font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">
                                {m?.short} {String(year).slice(2)}
                              </th>
                            );
                          })}
                          <th className="text-center px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">Trend</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {kpiAggregated.map((r, i) => (
                          <tr key={i} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-2.5 font-bold text-slate-800 text-xs sticky left-0 bg-white">{r.rule.kpi_target}</td>
                            {periodMonths.map(({ year, month }) => {
                              const t = r.trend.find(tr => tr.label === `${MONTHS.find(m => m.id === month)?.short}/${String(year).slice(2)}`);
                              return (
                                <td key={`${year}-${month}`} className="px-3 py-2.5 text-center text-xs font-black text-slate-600">
                                  {t?.avg ?? <span className="text-slate-300">—</span>}
                                </td>
                              );
                            })}
                            <td className="px-4 py-2.5 text-center">
                              <span className={`text-xs font-black ${r.delta >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                {r.delta >= 0 ? '▲' : '▼'} {Math.abs(r.delta || 0).toFixed(1)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Area relazione KPI generata */}
              {kpiAiReport ? (
                <div className="flex flex-col gap-4">
                  <textarea value={kpiAiReport} onChange={e => setKpiAiReport(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl p-8 text-slate-800 text-[14px] leading-relaxed font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none shadow-inner"
                    rows={18} />
                  <button onClick={exportKpiPDF}
                    className="w-full font-black py-4 rounded-xl shadow-lg uppercase tracking-widest bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center gap-2">
                    <FileDown size={20} /> Esporta Relazione KPI in PDF
                  </button>
                </div>
              ) : kpiAggregated.length > 0 ? (
                <div className="flex items-center justify-center border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50 py-12">
                  <div className="text-center text-slate-400">
                    <BrainCircuit size={48} className="mx-auto mb-4 opacity-50" />
                    <p className="font-bold uppercase tracking-widest">Premi "Genera Relazione KPI IA" per avviare l'analisi</p>
                  </div>
                </div>
              ) : null}

            </div>
          </>
        )}
      </div>
    </div>
  );
}
