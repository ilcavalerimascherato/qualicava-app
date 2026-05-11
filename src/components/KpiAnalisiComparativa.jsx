import React, { useState, useMemo, useCallback } from 'react';
import { X, ChevronLeft, AlertTriangle, BarChart2, BrainCircuit, Copy, Check, Download } from 'lucide-react';
import { kpiAnalisiComparativa as aiPresets } from '../config/aiPrompts';
import { KPI_RULES } from '../config/kpiRules';
import { evaluateKpiFormula } from '../utils/kpiFormulaEngine';
// ── Helpers ───────────────────────────────────────────────────

function getVal(metricsJson, upperKey) {
  const entry = metricsJson?.[upperKey];
  if (!entry) return null;
  const v = entry.value;
  if (v === '' || v === null || v === undefined) return null;
  return Number(v);
}

function computeStats(values) {
  if (values.length < 3) return null;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const std = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
  return { mean, std };
}


const PIVOT_MONTHS = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

function exportPivotCsv(pivotRows, facilityName, year) {
  const headers = ['KPI', 'Settore', ...PIVOT_MONTHS, 'Media'];
  const csv = [
    headers.join(','),
    ...pivotRows.map(row => [
      `"${String(row.rule.kpi_target).replace(/"/g, '""')}"`,
      row.rule.settore,
      ...row.months.map(m => m.displayValue),
      row.avgDisplay,
    ].join(',')),
  ].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `kpi_${facilityName}_${year}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Hook ──────────────────────────────────────────────────────

function useKpiAnomalies(kpiRecords, facilities) {
  return useMemo(() => {
    const anomalies = [];
    const facilityMap = new Map(facilities.map(f => [String(f.id), f]));
    const completedRecords = kpiRecords.filter(r => r.status === 'completed' && r.metrics_json);

    const add = (rec, fname, kpi, type, severity, message, value, groupAvg) =>
      anomalies.push({ facilityId: String(rec.facility_id), facilityName: fname, year: rec.year, month: rec.month, kpi, type, severity, message, value, groupAvg });

    // Precompute computed KPI values per (year, month, kpi_target) for z-score
    const kpiValuesByPeriod = {};
    completedRecords.forEach(rec => {
      const f = facilityMap.get(String(rec.facility_id));
      if (!f) return;
      KPI_RULES.forEach(rule => {
        const { result } = evaluateKpiFormula(rule.calcolo, rec.metrics_json, f);
        if (result === null) return;
        const k = `${rec.year}_${rec.month}_${rule.kpi_target}`;
        if (!kpiValuesByPeriod[k]) kpiValuesByPeriod[k] = [];
        kpiValuesByPeriod[k].push(result);
      });
    });

    completedRecords.forEach(rec => {
      const m = rec.metrics_json;
      const f = facilityMap.get(String(rec.facility_id));
      if (!f) return;
      const fname = f.name;
      const ospiti = getVal(m, 'OSPITI ASSISTITI NEL MESE') ?? 0;

      // 1. DATO MANCANTE
      const checkedVars = new Set();
      KPI_RULES.forEach(rule => {
        const numerator = (rule.calcolo.match(/\[([^\]]+)\]/)?.[1]) ?? null;
        if (!numerator || checkedVars.has(numerator)) return;
        checkedVars.add(numerator);
        const entry = m[numerator];
        if (!entry) return;
        const v = entry.value;
        if ((v === '' || v === null || v === undefined) && entry.is_na !== true)
          add(rec, fname, rule.indicatore, 'DATO_MANCANTE', 'warn', 'Dato non inserito per questo KPI', v, null);
      });

      // 2. ZERO IMPOSSIBILE
      const farmaci = getVal(m, 'NUMERO FARMACI MEDIAMENTE ASSUNTI IN UNA GIORNATA CAMPIONE');
      if (farmaci === 0 && ospiti > 0)
        add(rec, fname, 'numero farmaci mediamente assunti in una giornata campione', 'ZERO_IMPOSSIBILE', 'critical',
          `Zero farmaci con ${ospiti} ospiti presenti: dato impossibile`, 0, null);

      const incont = getVal(m, 'NUMERO OSPITI CON INCONTINENZA (SINGOLA O DOPPIA)');
      if (incont === 0 && ospiti >= 20)
        add(rec, fname, 'Numero ospiti con incontinenza (singola o doppia)', 'ZERO_IMPOSSIBILE', 'critical',
          `Zero incontinenza con ${ospiti} ospiti: statisticamente impossibile`, 0, null);

      const parametri = getVal(m, 'RILEVAZIONE PARAMETRI QUINDICINALE');
      if (parametri === 0 && ospiti > 0)
        add(rec, fname, 'Rilevazione parametri quindicinale', 'ZERO_IMPOSSIBILE', 'critical',
          `Zero rilevazioni parametri con ${ospiti} ospiti presenti`, 0, null);

      // 3. ZERO CLINICO SOSPETTO
      const dolore = getVal(m, 'VALUTAZIONE DEL DOLORE');
      if (dolore === 0 && ospiti > 0)
        add(rec, fname, 'Valutazione del dolore', 'ZERO_CLINICO', 'critical',
          `Zero valutazioni del dolore con ${ospiti} ospiti: probabile under-reporting`, 0, null);

      const paiAgg = getVal(m, 'OSPITI CON PI PAI AGGIORNATO ENTRO 180 GG');
      if (paiAgg === 0 && ospiti >= 10)
        add(rec, fname, 'Ospiti con PI PAI aggiornato entro 180 gg', 'ZERO_CLINICO', 'critical',
          `Zero PI/PAI aggiornati con ${ospiti} ospiti: clinicamente sospetto`, 0, null);

      // 4. UNDER-REPORTING
      const ir = getVal(m, 'NUMERO INCIDENT REPORTING INTERNI E NEAR MISS');
      if (ir === 0)
        add(rec, fname, 'numero incident reporting interni e near miss', 'UNDER_REPORTING', 'warn',
          'Zero incident report: assenza totale segnalazioni è sospetta', 0, null);

      const haccpTot = getVal(m, 'NUMERO TOTALE DIPENDENTI SOGGETTI A FORMAZIONE HACCP');
      if (haccpTot === 0 && ospiti >= 10)
        add(rec, fname, 'Numero totale dipendenti soggetti a formazione HACCP', 'UNDER_REPORTING', 'warn',
          `Zero dipendenti HACCP con ${ospiti} ospiti: dato mancante`, 0, null);

      // 5. OUTLIER STATISTICO
      KPI_RULES.forEach(rule => {
        const { result } = evaluateKpiFormula(rule.calcolo, m, f);
        if (result === null) return;
        const stats = computeStats(kpiValuesByPeriod[`${rec.year}_${rec.month}_${rule.kpi_target}`] ?? []);
        if (!stats || stats.std === 0) return;
        const z = Math.abs((result - stats.mean) / stats.std);
        if (z >= 2) {
          const isPerc = !['NUMERI', 'ISPEZIONI'].includes(rule.settore);
          const fmt = v => isPerc ? `${(v * 100).toFixed(1)}%` : v.toFixed(2);
          add(rec, fname, rule.indicatore, 'OUTLIER', z >= 3 ? 'critical' : 'warn',
            `Outlier statistico (z=${z.toFixed(1)}): ${fmt(result)} vs media ${fmt(stats.mean)}`,
            result, stats.mean);
        }
      });

      // 6. COMPLIANCE BASSA
      const haccpVal = getVal(m, 'NUMERO DIPENDENTI CON FORMAZIONE HACCP VALIDA');
      if (haccpVal !== null && haccpTot !== null && haccpTot > 0 && haccpVal / haccpTot < 0.8)
        add(rec, fname, 'Numero dipendenti con formazione HACCP valida', 'COMPLIANCE_BASSA', 'warn',
          `Formazione HACCP al ${((haccpVal / haccpTot) * 100).toFixed(0)}% (soglia 80%)`, haccpVal / haccpTot, 0.8);

      const sicTot = getVal(m, 'NUMERO TOTALE DIPENDENTI SOGGETTI A FORMAZIONE SICUREZZA');
      const sicVal = getVal(m, 'NUMERO DIPENDENTI CON FORMAZIONE SICUREZZA VALIDA');
      if (sicVal !== null && sicTot !== null && sicTot > 0 && sicVal / sicTot < 0.8)
        add(rec, fname, 'Numero dipendenti con formazione sicurezza valida', 'COMPLIANCE_BASSA', 'warn',
          `Formazione sicurezza al ${((sicVal / sicTot) * 100).toFixed(0)}% (soglia 80%)`, sicVal / sicTot, 0.8);

      const paiRed = getVal(m, 'OSPITI CON PI PAI REDATTO ENTRO 30 GG DALL INGRESSO');
      if (paiRed !== null && ospiti > 0 && paiRed / ospiti < 0.5)
        add(rec, fname, 'Ospiti con PI PAI redatto entro 30 gg dall ingresso', 'COMPLIANCE_BASSA', 'warn',
          `PI/PAI entro 30gg al ${((paiRed / ospiti) * 100).toFixed(0)}% (soglia 50%)`, paiRed / ospiti, 0.5);
    });

    return { anomalies, kpiValuesByPeriod };
  }, [kpiRecords, facilities]);
}

// ── Component ─────────────────────────────────────────────────

export default function KpiAnalisiComparativa({ isOpen, onClose, onBack, facilities, kpiRecords }) {
  const [activeTab, setActiveTab] = useState('anomalie');

  // Tab 1
  const [anomalyFilter, setAnomalyFilter] = useState('all');

  // Tab 2
  const [tab2FacilityId, setTab2FacilityId] = useState('');
  const [tab2Year, setTab2Year] = useState(null);

  // Tab 3
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const { anomalies } = useKpiAnomalies(kpiRecords, facilities);

  const activeFacilities = useMemo(() => facilities.filter(f => !f.is_suspended), [facilities]);

  const pivotYears = useMemo(() => {
    const years = [...new Set(kpiRecords.filter(r => r.status === 'completed').map(r => r.year))].sort((a, b) => b - a);
    return years;
  }, [kpiRecords]);

  const effectiveFacilityId = tab2FacilityId || (activeFacilities[0] ? String(activeFacilities[0].id) : '');
  const thisYear = new Date().getFullYear();
  const effectivePivotYear = tab2Year || pivotYears.find(y => y === thisYear) || pivotYears[0] || thisYear;

  // Tab 1 — filtered anomalies
  const filteredAnomalies = useMemo(() => {
    if (anomalyFilter === 'all') return anomalies;
    if (anomalyFilter === 'critical') return anomalies.filter(a => a.severity === 'critical');
    if (anomalyFilter === 'warn') return anomalies.filter(a => a.severity === 'warn');
    if (anomalyFilter.startsWith('fac_')) {
      const fname = anomalyFilter.slice(4);
      return anomalies.filter(a => a.facilityName === fname);
    }
    return anomalies;
  }, [anomalies, anomalyFilter]);

  const criticalCount = useMemo(() => anomalies.filter(a => a.severity === 'critical').length, [anomalies]);
  const warnCount = useMemo(() => anomalies.filter(a => a.severity === 'warn').length, [anomalies]);
  const uniqueFacilityNames = useMemo(() => [...new Set(anomalies.map(a => a.facilityName))].sort(), [anomalies]);

  // Tab 2 — pivot (righe=KPI, colonne=12 mesi)
  const pivotData = useMemo(() => {
    if (!effectiveFacilityId) return [];
    const f = facilities.find(fac => String(fac.id) === effectiveFacilityId);
    if (!f) return [];
    return KPI_RULES.map(rule => {
      const isPerc = !['NUMERI', 'ISPEZIONI'].includes(rule.settore);
      const months = PIVOT_MONTHS.map((mName, mIdx) => {
        const monthNum = mIdx + 1;
        const rec = kpiRecords.find(r =>
          String(r.facility_id) === effectiveFacilityId &&
          Number(r.year) === effectivePivotYear && Number(r.month) === monthNum &&
          r.status === 'completed'
        );
        let displayValue = '—';
        let numericValue = null;
        if (rec?.metrics_json) {
          const { result } = evaluateKpiFormula(rule.calcolo, rec.metrics_json, f);
          if (result === null) {
            displayValue = 'n.d.';
          } else {
            numericValue = result;
            displayValue = isPerc ? `${(result * 100).toFixed(1)}%` : result.toFixed(2);
          }
        }
        const anomaly = anomalies.find(a =>
          a.facilityId === effectiveFacilityId &&
          a.year === effectivePivotYear && a.month === monthNum &&
          a.kpi === rule.indicatore
        );
        return { monthNum, mName, displayValue, numericValue, anomaly };
      });
      const validValues = months.map(m => m.numericValue).filter(v => v !== null);
      const avg = validValues.length > 0 ? validValues.reduce((s, v) => s + v, 0) / validValues.length : null;
      const avgDisplay = avg !== null ? (isPerc ? `${(avg * 100).toFixed(1)}%` : avg.toFixed(1)) : '—';
      return { rule, months, avgDisplay };
    });
  }, [effectiveFacilityId, effectivePivotYear, facilities, kpiRecords, anomalies]);

  // Tab 3 — AI data summary
  const aiData = useMemo(() => {
    const completedRecs = kpiRecords.filter(r => r.status === 'completed' && r.metrics_json);
    const fMap = new Map(facilities.map(f => [String(f.id), f]));
    const summary = {};
    completedRecs.forEach(rec => {
      const f = fMap.get(String(rec.facility_id));
      if (!f) return;
      const label = `${f.name} ${rec.year}/${rec.month}`;
      summary[label] = {};
      KPI_RULES.forEach(rule => {
        const { result } = evaluateKpiFormula(rule.calcolo, rec.metrics_json, f);
        if (result !== null) summary[label][rule.kpi_target] = Math.round(result * 1000) / 1000;
      });
    });
    return { count: facilities.length, critical: criticalCount, warnings: warnCount, summary };
  }, [kpiRecords, facilities, criticalCount, warnCount]);

  const runAiAnalysis = useCallback(async (preset) => {
    setAiLoading(true);
    setAiResult('');
    try {
      const prompt = aiPresets[preset](aiData);
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.REACT_APP_ANTHROPIC_API_KEY ?? '',
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2048,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (!res.ok) throw new Error(`Errore API: ${res.status}`);
      const data = await res.json();
      setAiResult(data.content[0].text);
    } catch (err) {
      setAiResult(`Errore: ${err.message}`);
    } finally {
      setAiLoading(false);
    }
  }, [aiData]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(aiResult).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [aiResult]);

  if (!isOpen) return null;

  const TABS = [
    { id: 'anomalie', label: 'Anomalie', icon: AlertTriangle },
    { id: 'dati', label: 'Dati puntuali', icon: BarChart2 },
    { id: 'ai', label: 'Analisi AI', icon: BrainCircuit },
  ];

  const SEV_BADGE = {
    critical: 'bg-rose-100 text-rose-700 border border-rose-200',
    warn: 'bg-amber-100 text-amber-700 border border-amber-200',
  };

  return (
    <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in">
      <div className="bg-white rounded-2xl w-full max-w-7xl h-[92vh] flex flex-col shadow-2xl overflow-hidden font-sans">

        {/* Header */}
        <div className="bg-slate-950 px-6 py-4 flex items-center gap-4 shrink-0">
          <button onClick={onBack}
            className="flex items-center gap-1.5 text-slate-400 hover:text-white text-xs font-black uppercase tracking-widest transition-colors px-3 py-2 rounded-lg hover:bg-slate-800">
            <ChevronLeft size={14} /> Hub
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-lg text-white"><AlertTriangle size={20} /></div>
            <div>
              <h2 className="text-lg font-black text-white uppercase tracking-tight">Analisi comparativa KPI</h2>
              <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">Rilevazione anomalie e benchmark di gruppo</p>
            </div>
          </div>
          <button onClick={onClose} className="ml-auto p-2 text-slate-400 hover:text-white rounded-full transition-colors">
            <X size={22} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 shrink-0 bg-white">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-6 py-3.5 text-xs font-black uppercase tracking-widest transition-colors ${
                activeTab === id
                  ? 'border-b-2 border-indigo-600 text-indigo-600'
                  : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50'
              }`}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto bg-slate-50">

          {/* ── TAB 1: ANOMALIE ── */}
          {activeTab === 'anomalie' && (
            <div className="p-6">
              {/* Metric cards */}
              <div className="grid grid-cols-4 gap-4 mb-5">
                {[
                  { label: 'Strutture analizzate', value: activeFacilities.length, color: 'text-slate-800', bg: 'bg-white' },
                  { label: 'KPI analizzati', value: KPI_RULES.length, color: 'text-slate-800', bg: 'bg-white' },
                  { label: 'Anomalie critiche', value: criticalCount, color: 'text-rose-600', bg: 'bg-rose-50' },
                  { label: 'Avvisi', value: warnCount, color: 'text-amber-600', bg: 'bg-amber-50' },
                ].map(({ label, value, color, bg }) => (
                  <div key={label} className={`${bg} rounded-xl p-4 border border-slate-200 shadow-sm`}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{label}</p>
                    <p className={`text-3xl font-black ${color}`}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Filter */}
              <div className="flex items-center gap-3 mb-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Filtro</label>
                <select value={anomalyFilter} onChange={e => setAnomalyFilter(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500">
                  <option value="all">Tutte le anomalie ({anomalies.length})</option>
                  <option value="critical">Solo critiche ({criticalCount})</option>
                  <option value="warn">Solo avvisi ({warnCount})</option>
                  {uniqueFacilityNames.length > 0 && (
                    <optgroup label="Per struttura">
                      {uniqueFacilityNames.map(name => (
                        <option key={name} value={`fac_${name}`}>{name}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <span className="text-xs text-slate-400 font-bold">{filteredAnomalies.length} risultati</span>
              </div>

              {/* Table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      {['Struttura', 'KPI', 'Valore', 'Media gruppo', 'Descrizione', 'Severità'].map(h => (
                        <th key={h} className="text-left py-3 px-4 font-black text-slate-500 uppercase tracking-widest text-[10px]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAnomalies.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400 font-bold text-sm">
                          Nessuna anomalia rilevata con i filtri correnti
                        </td>
                      </tr>
                    ) : filteredAnomalies.map((a, i) => (
                      <tr key={i}
                        className={`border-b border-slate-100 hover:bg-slate-50 transition-colors border-l-4 ${
                          a.severity === 'critical' ? 'border-l-rose-500' : 'border-l-amber-400'
                        }`}>
                        <td className="py-2.5 px-4 font-bold text-slate-700 whitespace-nowrap">{a.facilityName}</td>
                        <td className="py-2.5 px-4 max-w-[180px]">
                          <span className="block truncate text-slate-600" title={a.kpi}>{a.kpi}</span>
                          <span className="text-[10px] text-slate-400">{a.year}/{a.month}</span>
                        </td>
                        <td className="py-2.5 px-4 font-mono text-slate-700">
                          {a.value !== null && a.value !== undefined ? String(a.value) : '—'}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-slate-500">
                          {a.groupAvg !== null ? (typeof a.groupAvg === 'number' ? a.groupAvg.toFixed(3) : a.groupAvg) : '—'}
                        </td>
                        <td className="py-2.5 px-4 text-slate-600 max-w-[260px]">{a.message}</td>
                        <td className="py-2.5 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${SEV_BADGE[a.severity]}`}>
                            {a.severity === 'critical' ? 'Critico' : 'Avviso'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── TAB 2: DATI PUNTUALI ── */}
          {activeTab === 'dati' && (
            <div className="p-4">
              {/* Filtri */}
              <div className="flex items-end gap-4 mb-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Struttura</label>
                  <select value={effectiveFacilityId} onChange={e => setTab2FacilityId(e.target.value)}
                    className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 min-w-[220px]">
                    {activeFacilities.map(f => (
                      <option key={f.id} value={String(f.id)}>{f.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Anno</label>
                  <select value={effectivePivotYear} onChange={e => setTab2Year(Number(e.target.value))}
                    className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500">
                    {pivotYears.length > 0
                      ? pivotYears.map(y => <option key={y} value={y}>{y}</option>)
                      : <option value={effectivePivotYear}>{effectivePivotYear}</option>
                    }
                  </select>
                </div>
                <button
                  onClick={() => {
                    const f = activeFacilities.find(fac => String(fac.id) === effectiveFacilityId);
                    exportPivotCsv(pivotData, f?.name ?? effectiveFacilityId, effectivePivotYear);
                  }}
                  className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg text-xs font-black uppercase hover:bg-slate-700 transition-colors">
                  <Download size={13} /> Export CSV
                </button>
              </div>

              {/* Tabella pivot */}
              <div className="overflow-auto rounded-xl border border-slate-200 shadow-sm bg-white" style={{ maxHeight: 'calc(92vh - 280px)' }}>
                <table className="text-xs border-collapse" style={{ minWidth: 'max-content' }}>
                  <thead>
                    <tr className="sticky top-0 bg-white z-10 border-b-2 border-slate-200">
                      <th
                        className="text-left py-2.5 px-3 font-black text-slate-500 uppercase tracking-widest text-[10px] border-r border-slate-200 bg-white"
                        style={{ width: 200, minWidth: 200, position: 'sticky', left: 0, zIndex: 20 }}
                      >
                        KPI
                      </th>
                      {PIVOT_MONTHS.map(m => (
                        <th key={m} className="py-2.5 px-2 font-black text-slate-500 uppercase tracking-widest text-[10px] text-center border-r border-slate-100 bg-white whitespace-nowrap" style={{ minWidth: 60 }}>
                          {m}
                        </th>
                      ))}
                      <th className="py-2.5 px-3 font-black text-slate-400 uppercase tracking-widest text-[10px] text-center bg-slate-50 whitespace-nowrap" style={{ minWidth: 70 }}>
                        Media
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pivotData.map((row, i) => (
                      <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td
                          className="py-1.5 px-3 font-medium text-slate-700 border-r border-slate-200 bg-white"
                          style={{ width: 200, minWidth: 200, maxWidth: 200, position: 'sticky', left: 0, zIndex: 5 }}
                        >
                          <span className="block truncate text-xs" title={row.rule.kpi_target}>
                            {row.rule.kpi_target.length > 36
                              ? row.rule.kpi_target.slice(0, 36) + '…'
                              : row.rule.kpi_target}
                          </span>
                        </td>
                        {row.months.map((m, mi) => {
                          const cellCls =
                            m.anomaly?.severity === 'critical' ? 'bg-red-50 text-red-700' :
                            m.anomaly?.severity === 'warn'     ? 'bg-amber-50 text-amber-700' :
                            m.displayValue === 'n.d.'          ? 'text-slate-400' :
                            m.displayValue === '—'             ? 'text-slate-300' :
                            'text-slate-700';
                          return (
                            <td key={mi} className={`py-1.5 px-2 text-center font-mono border-r border-slate-100 ${cellCls}`}
                              style={{ minWidth: 60 }}>
                              {m.displayValue}
                            </td>
                          );
                        })}
                        <td className="py-1.5 px-3 text-center font-mono text-slate-400 bg-slate-50 font-bold" style={{ minWidth: 70 }}>
                          {row.avgDisplay}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── TAB 3: ANALISI AI ── */}
          {activeTab === 'ai' && (
            <div className="p-6 flex flex-col gap-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { id: 'completa', label: 'Analisi completa', desc: 'Pattern clinici e raccomandazioni prioritarie', color: 'indigo' },
                  { id: 'cadute', label: 'Focus cadute e sicurezza', desc: 'Rischio cadute, contenzioni, invii PS', color: 'rose' },
                  { id: 'formazione', label: 'Focus formazione', desc: 'Compliance HACCP e sicurezza D.Lgs 81/2008', color: 'amber' },
                  { id: 'outlier', label: 'Strutture outlier', desc: 'Identifica strutture anomale nel gruppo', color: 'emerald' },
                ].map(({ id, label, desc, color }) => (
                  <button key={id} onClick={() => runAiAnalysis(id)} disabled={aiLoading}
                    className={`flex flex-col items-start p-4 rounded-xl border-2 border-${color}-100 bg-${color}-50 hover:border-${color}-400 hover:bg-${color}-100 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed`}>
                    <BrainCircuit size={18} className={`text-${color}-600 mb-2`} />
                    <span className={`text-xs font-black text-${color}-800 uppercase tracking-tight mb-1`}>{label}</span>
                    <span className="text-[10px] text-slate-500 leading-relaxed">{desc}</span>
                  </button>
                ))}
              </div>

              {(aiLoading || aiResult) && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
                  <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      {aiLoading ? 'Elaborazione in corso...' : 'Risultato analisi'}
                    </span>
                    {aiResult && !aiLoading && (
                      <button onClick={handleCopy}
                        className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors">
                        {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                        {copied ? 'Copiato' : 'Copia testo'}
                      </button>
                    )}
                  </div>
                  <div className="p-5 min-h-[200px]">
                    {aiLoading ? (
                      <div className="flex items-center gap-3 text-slate-400">
                        <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm font-medium">Analisi in corso con Claude AI...</span>
                      </div>
                    ) : (
                      <pre className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed font-sans">{aiResult}</pre>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
