// src/components/RestituzioneModal.jsx
// Modal restituzione survey — selezione domande + grafici + PDF
// Props: { isOpen, onClose, facility, surveys, type, year, month }

import { useState, useMemo, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { exportPDF } from '../utils/pdfExport';
import { buildPrompt } from '../config/aiPrompts';
import {
  ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

// ── Configurazione scale ─────────────────────────────────────
const SCALE_STANDARD = [
  { label: 'Molto soddisfatto/e', color: '#3B6D11' },
  { label: 'Soddisfatto/e',       color: '#639922' },
  { label: 'Sufficiente',         color: '#EF9F27' },
  { label: 'Insufficiente/Poco',  color: '#E24B4A' },
  { label: 'Insoddisfatto/e',     color: '#A32D2D' },
];

const SCALE_PARTECIPAZIONE = [
  { label: 'Interessante',        color: '#3B6D11' },
  { label: 'Non interessante',    color: '#EF9F27' },
  { label: 'Non ho partecipato',  color: '#94a3b8' },
];

const SCALE_SINON = [
  { label: 'Sì', color: '#3B6D11' },  // matcha sia 'Sì' che 'Si'
  { label: 'No', color: '#E24B4A' },
];

const SCALE_NUMERIC_10 = [
  { label: 'Eccellente (9-10)', color: '#3B6D11', min: 9, max: 10 },
  { label: 'Buono (7-8)',       color: '#639922', min: 7, max: 8  },
  { label: 'Sufficiente (5-6)', color: '#EF9F27', min: 5, max: 6  },
  { label: 'Insufficiente (3-4)', color: '#E24B4A', min: 3, max: 4 },
  { label: 'Scarso (0-2)',      color: '#A32D2D', min: 0, max: 2  },
];

const SCALE_NPS_TEXT = [
  { label: 'Certamente',       color: '#3B6D11', score: 2  },
  { label: 'Sì',               color: '#639922', score: 1  },
  { label: 'Gliene parlo',     color: '#EF9F27', score: 0  },
  { label: 'Probabilmente no', color: '#E24B4A', score: -1 },
  { label: 'No',               color: '#A32D2D', score: -2 },
];

const CATEGORY_ORDER_CLIENT = [
  'accoglienza',
  'struttura',
  'etica',
  'personale',
  'servizi',
  'ristorazione',
  'organizzazione',
  'qualita',
  'generale',
  'reputazione',
];

const CATEGORY_ORDER_OPERATOR = [
  'generale',
  'ambiente',
  'clima',
  'management',
  'organizzazione',
  'qualita',
  'etica',
  'reputazione',
];

function detectScale(values) {
  const vals = values.filter(Boolean).map(v => String(v).trim());
  if (vals.some(v => ['Certamente', 'Gliene parlo', 'Probabilmente no'].includes(v)))
    return 'nps_text';
  if (vals.some(v => ['Interessante', 'Non ho partecipato'].includes(v)))
    return 'partecipazione';
  if (vals.every(v => ['Sì', 'Si', 'SÌ', 'SI', 'No', 'NO', ''].includes(v)))
    return 'sinon';
  if (vals.some(v => ['Molto soddisfatto', 'Molto soddisfatte', 'Soddisfatto',
                       'Soddisfatte', 'Insoddisfatto'].includes(v)))
    return 'standard';
  if (vals.some(v => !isNaN(parseFloat(v)) && parseFloat(v) >= 0 && parseFloat(v) <= 10))
    return 'numeric_10';
  return 'standard';
}

function calcDistribuzione(righe, colonna, scale) {
  if (scale === SCALE_NUMERIC_10) {
    const values = righe.map(r => parseFloat(r[colonna])).filter(n => !isNaN(n));
    const total = values.length;
    return scale.map(bucket => {
      const count = values.filter(n => n >= bucket.min && n <= bucket.max).length;
      return {
        label: bucket.label,
        color: bucket.color,
        count,
        pct: total > 0 ? Math.round((count / total) * 100) : 0,
      };
    });
  }

  const counts = {};
  for (const row of righe) {
    const v = String(row[colonna] || '').trim();
    if (!v) continue;
    counts[v] = (counts[v] || 0) + 1;
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const SINONIMI = {
    'Molto soddisfatto/e': ['Molto soddisfatto', 'Molto soddisfatte', 'Molto soddisfatto/e'],
    'Soddisfatto/e':       ['Soddisfatto', 'Soddisfatte', 'Soddisfatto/e'],
    'Sufficiente':         ['Sufficiente'],
    'Insufficiente/Poco':  ['Insufficiente', 'Poco soddisfatto', 'Poco soddisfatta', 'Insufficiente/Poco'],
    'Insoddisfatto/e':     ['Insoddisfatto', 'Insoddisfatte', 'Insoddisfatto/e'],
    'Certamente':          ['Certamente'],
    'Sì':                  ['Sì', 'Si'],
    'Gliene parlo':        ['Gliene parlo'],
    'Probabilmente no':    ['Probabilmente no'],
    'No':                  ['No', 'NO'],
    'Interessante':        ['Interessante'],
    'Non interessante':    ['Non interessante'],
    'Non ho partecipato':  ['Non ho partecipato', 'Non ha partecipato'],
  };

  const norm = s => s.toLowerCase().trim()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');

  return scale.map(s => {
    const varianti = SINONIMI[s.label] || [s.label];
    const normVarianti = varianti.map(norm);

    const count = Object.entries(counts).reduce((acc, [key, val]) => {
      return normVarianti.includes(norm(key)) ? acc + val : acc;
    }, 0);

    return {
      label: s.label,
      color: s.color,
      count,
      pct: total > 0 ? Math.round((count / total) * 100) : 0,
    };
  });
}

// ── Bar chart ────────────────────────────────────────────────
function BarChartCard({ title, distribuzione, total }) {
  const max = Math.max(...distribuzione.map(d => d.count), 1);
  return (
    <div className="bg-gray-50 rounded-xl p-4">
      <p className="text-xs font-semibold text-gray-700 mb-3 leading-tight">{title}</p>
      <div className="space-y-2">
        {distribuzione.map(d => (
          <div key={d.label} className="flex items-center gap-2">
            <div className="w-28 text-[10px] text-gray-500 text-right flex-shrink-0 truncate">
              {d.label}
            </div>
            <div className="flex-1 h-4 bg-gray-200 rounded overflow-hidden">
              <div
                className="h-full rounded transition-all duration-500"
                style={{ width: `${(d.count / max) * 100}%`, background: d.color }}
              />
            </div>
            <div className="w-8 text-[10px] font-medium text-gray-600 text-right">
              {d.count}
            </div>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-gray-400 mt-2">{total} risposte totali</p>
    </div>
  );
}

// ── NPS gauge ────────────────────────────────────────────────
function NpsGauge({ title, distribuzione, total }) {
  const promotori  = distribuzione
    .filter(d => ['Certamente', 'Sì', 'Si'].includes(d.label))
    .reduce((a, b) => a + b.count, 0);
  const detrattori = distribuzione
    .filter(d => ['Probabilmente no', 'No'].includes(d.label))
    .reduce((a, b) => a + b.count, 0);
  const nps = total > 0 ? Math.round(((promotori - detrattori) / total) * 100) : 0;
  const needleLeft = Math.min(Math.max(((nps + 100) / 200) * 100, 2), 98);

  return (
    <div className="bg-gray-50 rounded-xl p-4">
      <p className="text-xs font-semibold text-gray-700 mb-3 leading-tight">{title}</p>
      <div className="flex flex-col items-center gap-2">
        <div className="text-3xl font-bold text-indigo-600">
          {nps > 0 ? '+' : ''}{nps}
        </div>
        <div className="text-[10px] text-gray-400">NPS Score</div>
        <div className="w-full relative mt-2">
          <div className="h-2 rounded-full"
            style={{ background: 'linear-gradient(to right,#E24B4A,#EF9F27,#639922,#3B6D11)' }} />
          <div className="absolute top-[-3px] w-4 h-4 rounded-full bg-white border-2 border-indigo-600"
            style={{ left: `calc(${needleLeft}% - 8px)` }} />
        </div>
        <div className="flex gap-4 mt-2 text-[10px]">
          <span style={{ color: '#3B6D11' }}>
            ▪ Promotori {total > 0 ? Math.round(promotori / total * 100) : 0}%
          </span>
          <span style={{ color: '#E24B4A' }}>
            ▪ Detrattori {total > 0 ? Math.round(detrattori / total * 100) : 0}%
          </span>
        </div>
      </div>
      <p className="text-[10px] text-gray-400 mt-2">{total} risposte totali</p>
    </div>
  );
}

// ── Stars card ───────────────────────────────────────────────
function StarsCard({ title, distribuzione, total }) {
  let sum = 0, count = 0;
  distribuzione.forEach((d, i) => {
    const peso = [5, 4, 3, 2, 1][i] ?? 1;
    sum   += d.count * peso;
    count += d.count;
  });
  const stars = count > 0 ? sum / count : 0;

  const fullStars  = Math.floor(stars);
  const halfStar   = stars - fullStars >= 0.4;
  const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);

  return (
    <div className="bg-gray-50 rounded-xl p-4">
      <p className="text-xs font-semibold text-gray-700 mb-3">{title}</p>
      <div className="flex flex-col items-center gap-2">
        <div className="text-4xl font-bold text-gray-800">
          {stars.toFixed(1)}
          <span className="text-lg text-gray-400">/5</span>
        </div>
        <div className="flex gap-1 text-2xl">
          {Array(fullStars).fill('★').map((s, i) =>
            <span key={i} style={{ color: '#EF9F27' }}>{s}</span>)}
          {halfStar && <span style={{ color: '#EF9F27' }}>½</span>}
          {Array(emptyStars).fill('☆').map((s, i) =>
            <span key={i} style={{ color: '#d1d5db' }}>{s}</span>)}
        </div>
        <div className="text-[10px] text-gray-400 mt-1">
          {stars.toFixed(1)}/5 · {total} risposte
        </div>
      </div>
    </div>
  );
}

// ── Stacked bar partecipazione ───────────────────────────────
function StackedCard({ domande, rawData, nRisposte }) {
  const data = domande.map(d => {
    const counts = { Interessante: 0, 'Non interessante': 0, 'Non ho partecipato': 0 };
    rawData.forEach(row => {
      const v = String(row[d.col] || '').trim();
      if (counts[v] !== undefined) counts[v]++;
    });
    const tot = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
    return {
      name: d.label.length > 14 ? d.label.slice(0, 13) + '…' : d.label,
      Interessante:          Math.round(counts['Interessante'] / tot * 100),
      'Non interessante':    Math.round(counts['Non interessante'] / tot * 100),
      'Non ha partecipato':  Math.round(counts['Non ho partecipato'] / tot * 100),
    };
  });

  return (
    <div className="col-span-2 bg-gray-50 rounded-xl p-4">
      <p className="text-xs font-semibold text-gray-700 mb-3">
        Attività — confronto partecipazione
      </p>
      <ResponsiveContainer width="100%" height={Math.max(120, domande.length * 32)}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`}
                 tick={{ fontSize: 10 }} />
          <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10 }} />
          <Tooltip formatter={(v, n) => [`${v}%`, n]} contentStyle={{ fontSize: 11 }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="Interessante"        stackId="a" fill="#3B6D11" />
          <Bar dataKey="Non interessante"    stackId="a" fill="#EF9F27" />
          <Bar dataKey="Non ha partecipato"  stackId="a" fill="#94a3b8"
               radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <p className="text-[10px] text-gray-400 mt-1">{nRisposte} risposte · % per domanda</p>
    </div>
  );
}

// ── Bar statica per PDF (no Recharts) ───────────────────────
function SimplePdfBar({ data }) {
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div>
      {data.map(d => (
        <div key={d.label} style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ width: 160, fontSize: 11, color: '#374151', flexShrink: 0 }}>{d.label}</span>
          <div style={{ flex: 1, background: '#f3f4f6', borderRadius: 4, height: 14, marginRight: 8 }}>
            <div style={{
              width: `${(d.count / max) * 100}%`,
              background: d.color ?? '#6b7280',
              height: '100%', borderRadius: 4,
            }} />
          </div>
          <span style={{ fontSize: 11, color: '#374151', width: 30, textAlign: 'right' }}>
            {d.count}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Componente principale ────────────────────────────────────
export default function RestituzioneModal({
  isOpen, onClose, facility, surveys, type, year, month,
}) {
  const [rawData,        setRawData]        = useState([]);
  const [loading,        setLoading]        = useState(false);
  const [domande,        setDomande]        = useState([]);
  const [selected,       setSelected]       = useState({});
  const [dateStart,      setDateStart]      = useState('');
  const [dateEnd,        setDateEnd]        = useState('');
  const [showCharts,     setShowCharts]     = useState(false);
  const [chartTypes,     setChartTypes]     = useState({});
  const [companyLogoUrl, setCompanyLogoUrl] = useState(null);
  const [aperturaText,    setAperturaText]    = useState('');
  const [aperturaLoading, setAperturaLoading] = useState(false);
  const [sourceTable,     setSourceTable]     = useState(null);
  const [colCategory,     setColCategory]     = useState({});

  const survey = useMemo(
    () => surveys?.find(s => s.type === type) || null,
    [surveys, type]
  );

  // Risolve sourceTable: prima da summary_stats.source (già persistito),
  // poi tramite lookup su survey_source_configs.
  useEffect(() => {
    console.log('[restituzione] isOpen:', isOpen, 'type:', type, 'survey:', survey?.type);
    console.log('[restituzione] direct source:', survey?.summary_stats?.source);
    if (!isOpen) { setSourceTable(null); return; }
    const direct = survey?.summary_stats?.source;
    if (direct) { setSourceTable(direct); return; }
    supabase
      .from('survey_source_configs')
      .select('source_table')
      .eq('survey_type', type)
      .single()
      .then(({ data, error }) => {
        console.log('[source_configs] data:', data, 'error:', error);
        setSourceTable(data?.source_table ?? null);
      });
  }, [isOpen, survey, type]);

  const toggleChartType = (col) => {
    setChartTypes(prev => {
      const current = prev[col] || 'bar';
      const dom = domande.find(d => d.col === col);
      if (dom?.scale === 'standard' || dom?.scale === 'numeric_10') {
        const opts = ['bar', 'stars'];
        return { ...prev, [col]: opts[(opts.indexOf(current) + 1) % opts.length] };
      }
      return prev;
    });
  };

  useEffect(() => {
    if (!isOpen) return;
    if (year && month) {
      const first = new Date(year, month - 1, 1);
      const last  = new Date(year, month, 0);
      setDateStart(first.toISOString().split('T')[0]);
      setDateEnd(last.toISOString().split('T')[0]);
    } else {
      setDateStart('');
      setDateEnd('');
    }
    setShowCharts(false);
    setSelected({});
    setChartTypes({});
    setAperturaText('');
  }, [isOpen, year, month]);

  useEffect(() => {
    console.log('[restituzione fetch] sourceTable:', sourceTable, 'facilityId:', facility?.id, 'dateStart:', dateStart, 'dateEnd:', dateEnd);
    if (!isOpen || !sourceTable || !facility?.id || !dateStart || !dateEnd) return;
    setLoading(true);

    const META = [
      'id', 'created_at', 'struttura', 'nome_cognome', 'chi_compila',
      'sesso', 'anno_nascita', 'quanto_tempo', 'soggiorno',
      'secondo_soggiorno', 'tempo_indeterminato', 'note', 'Note',
      'eta', 'professione', 'tempo_lavoro', 'formazione_12mesi',
      // Sì/No tecnologici — non valutazioni
      'bracciale', 'fascia_letto', 'domotica', 'sensori_ambientali',
      'presenza_animale', 'pet_friendly', 'sos',
    ];

    if (facility?.company_id) {
      supabase
        .from('companies')
        .select('logo_url')
        .eq('id', facility.company_id)
        .single()
        .then(({ data }) => setCompanyLogoUrl(data?.logo_url || null));
    }

    supabase
      .from('survey_source_configs')
      .select('field_map')
      .eq('source_table', sourceTable)
      .single()
      .then(({ data: cfg }) => {
        const fieldMap = cfg?.field_map || {};
        const map = {};
        Object.entries(fieldMap).forEach(([col, def]) => {
          map[col] = def.category || 'generale';
        });
        setColCategory(map);
      });

    supabase
      .from('survey_facility_mapping')
      .select('nome_survey')
      .eq('facility_id', facility.id)
      .then(({ data: mappings }) => {
        const nomi = mappings?.map(m => m.nome_survey) || [];
        if (!nomi.length) { setLoading(false); return; }

        supabase
          .from(sourceTable)
          .select('*')
          .in('struttura', nomi)
          .gte('created_at', dateStart)
          .lte('created_at', dateEnd + 'T23:59:59')
          .then(({ data }) => {
            setRawData(data || []);
            console.log('[RestituzioneModal] rawData.length:', (data || []).length, '| sourceTable:', sourceTable, '| nomi:', nomi, '| primo elemento:', data?.[0] ?? null);
            if (data?.length) {
              const cols = Object.keys(data[0]).filter(k => !META.includes(k));
              const newDomande = cols.map(col => ({
                col,
                label: col.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                scale: detectScale(data.map(r => r[col])),
              }));
              setDomande(newDomande);
              const sel = {};
              cols.forEach(c => { sel[c] = true; });
              setSelected(sel);
              setChartTypes({});
            }
            setLoading(false);
          });
      });
  }, [isOpen, sourceTable, facility?.id, facility?.company_id, dateStart, dateEnd]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedDomande = domande.filter(d => selected[d.col]);
  const nRisposte = rawData.length;

  const categoryOrder = type === 'operator' ? CATEGORY_ORDER_OPERATOR : CATEGORY_ORDER_CLIENT;
  const sortedSelected = [...selectedDomande].sort((a, b) => {
    const ia = categoryOrder.indexOf(colCategory[a.col] || 'generale');
    const ib = categoryOrder.indexOf(colCategory[b.col] || 'generale');
    if (ia === -1 && ib === -1) return 0;
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  const MONTH_NAMES = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                       'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
  const periodoStr = month ? `${MONTH_NAMES[month - 1]} ${year}` : `${year ?? ''}`;

  const toggleAll = () => {
    const allSelected = domande.every(d => selected[d.col]);
    const next = {};
    domande.forEach(d => { next[d.col] = !allSelected; });
    setSelected(next);
  };

  const generateApertura = async () => {
    setAperturaLoading(true);
    try {
      const SCORE_MAP = {
        'Molto soddisfatto/e': 5, 'Soddisfatto/e': 4, 'Sufficiente': 3,
        'Insufficiente/Poco': 2, 'Insoddisfatto/e': 1,
      };
      const scores = selectedDomande
        .filter(d => d.scale === 'standard')
        .map(d => {
          const dist = calcDistribuzione(rawData, d.col, SCALE_STANDARD);
          const tot = dist.reduce((a, b) => a + b.count, 0);
          if (tot === 0) return null;
          const sum = dist.reduce((a, b) => a + (SCORE_MAP[b.label] ?? 3) * b.count, 0);
          return { label: d.label, score: sum / tot };
        })
        .filter(Boolean);

      const sorted = [...scores].sort((a, b) => b.score - a.score);
      const topForza = sorted[0]?.label ?? 'la qualità dei nostri servizi';
      const areaAttenzione = sorted[sorted.length - 1]?.label ?? 'alcune aree di miglioramento';
      const npsScore = survey?.summary_stats?.nps_score ?? null;

      const promptId = type === 'operator'
        ? 'restituzioneAperturaOperatori'
        : 'restituzioneAperturaClienti';
      const prompt = buildPrompt(promptId, {
        facilityName: facility?.nome_struttura ?? facility?.name ?? '',
        periodo: periodoStr,
        npsScore,
        topForza,
        areaAttenzione,
      });

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.REACT_APP_ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 300,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const data = await response.json();
      setAperturaText(data.content?.[0]?.text ?? '');
    } catch (err) {
      console.error('Errore generazione apertura:', err);
    } finally {
      setAperturaLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh]
                      flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4
                        border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-800">
              Restituzione {type === 'client' ? 'Clienti / Ospiti' : 'Staff / Operatori'}
              {' — '}{facility?.name}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Seleziona domande e periodo · {nRisposte} risposte disponibili
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center
                       text-gray-500 hover:bg-gray-200 transition-colors text-sm"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">

          {/* Pannello sinistro — configurazione */}
          <div className="w-56 border-r border-gray-200 flex flex-col flex-shrink-0">

            {/* Periodo */}
            <div className="p-3 border-b border-gray-100">
              <p className="text-[10px] font-semibold text-gray-400 uppercase
                            tracking-wider mb-2">Periodo</p>
              <input type="date" value={dateStart}
                onChange={e => { setDateStart(e.target.value); setShowCharts(false); }}
                className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5
                           mb-1.5 focus:outline-none focus:border-indigo-400" />
              <input type="date" value={dateEnd}
                onChange={e => { setDateEnd(e.target.value); setShowCharts(false); }}
                className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5
                           focus:outline-none focus:border-indigo-400" />
              <p className="text-[10px] text-indigo-600 mt-1.5 text-center">
                {nRisposte} risposte nel periodo
              </p>
            </div>

            {/* Header domande */}
            <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                Domande
              </p>
              <button onClick={toggleAll} className="text-[10px] text-indigo-600 cursor-pointer">
                {domande.every(d => selected[d.col]) ? 'deseleziona' : 'tutte'}
              </button>
            </div>

            {/* Lista domande */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <p className="text-xs text-gray-400 text-center py-4">Caricamento…</p>
              ) : domande.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4 italic">
                  Nessun dato nel periodo
                </p>
              ) : (
                domande.map(d => (
                  <div
                    key={d.col}
                    onClick={() => setSelected(s => ({ ...s, [d.col]: !s[d.col] }))}
                    className={`flex items-start gap-2 px-3 py-2 cursor-pointer
                                border-b border-gray-50 hover:bg-gray-50 transition-colors
                                ${selected[d.col] ? 'bg-indigo-50' : ''}`}
                  >
                    <div className={`w-3.5 h-3.5 rounded flex-shrink-0 mt-0.5 flex items-center
                                    justify-center border text-white text-[8px]
                                    ${selected[d.col]
                                      ? 'bg-indigo-600 border-indigo-600'
                                      : 'border-gray-300'}`}>
                      {selected[d.col] && '✓'}
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-700 leading-tight">{d.label}</p>
                      <p className="text-[9px] text-gray-400 mt-0.5">
                        {d.scale === 'nps_text'          ? 'NPS'
                          : d.scale === 'partecipazione' ? 'Partecipazione'
                          : d.scale === 'sinon'          ? 'Sì/No'
                          : d.scale === 'numeric_10'     ? 'Scala 0-10'
                          : 'Scala 1-5'}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-gray-200 flex gap-2">
              <button
                onClick={() => setShowCharts(false)}
                className="text-xs px-3 py-2 rounded-lg border border-gray-200
                           text-gray-500 hover:bg-gray-50"
              >
                ↺
              </button>
              <button
                onClick={() => setShowCharts(true)}
                disabled={selectedDomande.length === 0 || nRisposte === 0}
                className="flex-1 text-xs py-2 rounded-lg bg-indigo-600 text-white
                           font-medium hover:bg-indigo-700 disabled:opacity-40
                           disabled:cursor-not-allowed transition-colors"
              >
                Genera grafici
              </button>
            </div>
          </div>

          {/* Pannello destro — grafici */}
          <div className="flex-1 overflow-y-auto p-4">
            {!showCharts ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="text-4xl mb-3">📊</div>
                <p className="text-sm font-medium text-gray-600 mb-1">
                  {selectedDomande.length} domande selezionate
                </p>
                <p className="text-xs text-gray-400">
                  Clicca "Genera grafici" per visualizzare i risultati
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">
                      {selectedDomande.length} domande · {nRisposte} risposte
                    </p>
                    <p className="text-xs text-gray-400">
                      {dateStart} → {dateEnd}
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      await exportPDF({
                        elementId: 'restituzione-pdf-content',
                        filename: `Restituzione_${type === 'operator' ? 'Staff' : 'Clienti'}_${(facility?.nome_struttura ?? facility?.name ?? '').replace(/ /g, '_')}_${year}.pdf`,
                        logoSrc: companyLogoUrl || undefined,
                      });
                    }}
                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-200
                               text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-1.5"
                  >
                    ⬇ PDF restituzione
                  </button>
                </div>

                {/* ── APERTURA DIRETTORE ── */}
                <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {type === 'operator' ? 'Messaggio agli Operatori' : 'Messaggio agli Ospiti'}
                    </span>
                    <button
                      onClick={generateApertura}
                      disabled={aperturaLoading}
                      className="text-[11px] px-3 py-1 rounded-lg bg-indigo-600 text-white
                                 hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                      {aperturaLoading ? '⏳ Generazione…' : aperturaText ? '🔄 Rigenera' : '✨ Genera testo apertura'}
                    </button>
                  </div>
                  {aperturaText ? (
                    <p className="text-sm text-gray-700 leading-relaxed italic">{aperturaText}</p>
                  ) : (
                    <p className="text-xs text-gray-400 italic">
                      Genera un breve messaggio del direttore da inserire in apertura del PDF.
                    </p>
                  )}
                </div>

                {/* Griglia grafici */}
                {(() => {
                  const partDomande  = sortedSelected.filter(d => d.scale === 'partecipazione');
                  const altreDomande = sortedSelected.filter(d => d.scale !== 'partecipazione');
                  const showStacked  = partDomande.length >= 3;

                  return (
                    <div id="restituzione-grafici" className="grid grid-cols-2 gap-3">

                      {/* StackedCard — solo se ≥3 partecipazione */}
                      {showStacked && (
                        <StackedCard
                          domande={partDomande}
                          rawData={rawData}
                          nRisposte={nRisposte}
                        />
                      )}

                      {/* Domande non-partecipazione */}
                      {altreDomande.map(d => {
                        const scale =
                          d.scale === 'nps_text'   ? SCALE_NPS_TEXT  :
                          d.scale === 'sinon'       ? SCALE_SINON     :
                          d.scale === 'numeric_10'  ? SCALE_NUMERIC_10 :
                                                      SCALE_STANDARD;

                        const dist      = calcDistribuzione(rawData, d.col, scale);
                        const chartType = chartTypes[d.col] || 'bar';

                        if (d.scale === 'nps_text') {
                          return (
                            <NpsGauge key={d.col} title={d.label}
                                      distribuzione={dist} total={nRisposte} />
                          );
                        }

                        if (d.scale === 'sinon') {
                          return (
                            <BarChartCard key={d.col} title={d.label}
                                          distribuzione={dist} total={nRisposte} />
                          );
                        }

                        // standard / numeric_10 — toggle bar ↔ stars
                        const nextType   = chartType === 'bar' ? 'stars' : 'bar';
                        const toggleLabel = nextType === 'stars' ? '⭐ Stelle' : '📊 Barre';

                        return (
                          <div key={d.col} className="relative">
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleChartType(d.col); }}
                              className="absolute top-3 right-3 z-10 text-[9px] font-medium
                                         px-2 py-1 rounded-full bg-white border border-gray-200
                                         text-gray-500 hover:border-indigo-400 hover:text-indigo-600
                                         transition-colors shadow-sm"
                            >
                              {toggleLabel}
                            </button>
                            {chartType === 'bar'
                              ? <BarChartCard title={d.label} distribuzione={dist} total={nRisposte} />
                              : <StarsCard    title={d.label} distribuzione={dist} total={nRisposte} />
                            }
                          </div>
                        );
                      })}

                      {/* Domande partecipazione individuali (solo se < 3) — già in partDomande da sortedSelected */}
                      {!showStacked && partDomande.map(d => {
                        const dist = calcDistribuzione(rawData, d.col, SCALE_PARTECIPAZIONE);
                        return (
                          <BarChartCard key={d.col} title={d.label}
                                        distribuzione={dist} total={nRisposte} />
                        );
                      })}

                    </div>
                  );
                })()}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Hidden PDF template — catturato da exportPDF ── */}
      <div
        id="restituzione-pdf-content"
        style={{ display: 'none', padding: '20px', fontFamily: 'sans-serif', background: '#fff' }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e3a5f', marginBottom: 8 }}>
          {type === 'operator'
            ? 'Restituzione Staff — Risultati Questionario'
            : 'Restituzione Ospiti — Risultati Questionario'}
        </h2>
        <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 20 }}>
          {facility?.nome_struttura ?? facility?.name} · {periodoStr} · {sortedSelected.length} domande · {nRisposte} risposte
        </p>

        {aperturaText && (
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, marginBottom: 24 }}>
            <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, fontStyle: 'italic' }}>
              {aperturaText}
            </p>
          </div>
        )}

        {/* Loop PDF spezzato: before animazione / blocco partecipazione / after animazione */}
        {(() => {
          const animIdx = sortedSelected.findIndex(d =>
            d.col === 'animazione' || d.col === 'voto_animazione'
          );
          const beforeAnim = (animIdx >= 0
            ? sortedSelected.slice(0, animIdx + 1)
            : sortedSelected
          ).filter(d => d.scale !== 'partecipazione');
          const afterAnim = animIdx >= 0
            ? sortedSelected.slice(animIdx + 1).filter(d => d.scale !== 'partecipazione')
            : [];
          const partecipazione = sortedSelected.filter(d => d.scale === 'partecipazione');

          const renderDomanda = d => {
            const scale =
              d.scale === 'nps_text'   ? SCALE_NPS_TEXT   :
              d.scale === 'sinon'      ? SCALE_SINON       :
              d.scale === 'numeric_10' ? SCALE_NUMERIC_10  :
                                         SCALE_STANDARD;
            const dist = calcDistribuzione(rawData, d.col, scale);
            return (
              <div key={d.col} style={{ marginBottom: 20, pageBreakInside: 'avoid' }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: '#1f2937', marginBottom: 8 }}>
                  {d.label}
                </h3>
                <SimplePdfBar data={dist} />
              </div>
            );
          };

          const renderPartecipazione = () => {
            if (!partecipazione.length) return null;
            return (
              <div style={{ marginBottom: 24, pageBreakInside: 'avoid' }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: '#1f2937', marginBottom: 12 }}>
                  Attività — confronto partecipazione
                </h3>
                {partecipazione.map(d => {
                  const dist = calcDistribuzione(rawData, d.col, SCALE_PARTECIPAZIONE);
                  const tot = dist.reduce((s, x) => s + x.count, 0) || 1;
                  return (
                    <div key={d.col} style={{ marginBottom: 8, pageBreakInside: 'avoid' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                        {d.label}
                      </div>
                      <div style={{ display: 'flex', gap: 4, height: 14 }}>
                        {dist.map(item => (
                          <div key={item.label} style={{
                            width: `${(item.count / tot) * 100}%`,
                            background: item.color ?? '#6b7280',
                            borderRadius: 2,
                          }} />
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 10, color: '#6b7280' }}>
                        {dist.map(item => (
                          <span key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <span style={{ width: 8, height: 8, borderRadius: 2, background: item.color, display: 'inline-block' }} />
                            {item.label}: {Math.round((item.count / tot) * 100)}%
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          };

          return (
            <>
              {beforeAnim.map(renderDomanda)}
              {renderPartecipazione()}
              {afterAnim.map(renderDomanda)}
            </>
          );
        })()}
      </div>
    </div>
  );
}
