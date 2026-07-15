import { useState, useMemo, useEffect } from 'react';
import { useSurveyCampagne } from '../hooks/useSurveyCampagne';
import { supabase } from '../supabaseClient';
import { generaReportSurveyCampagna } from '../services/surveyCampagnaDocService';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts';
import {
  Chart, RadarController, RadialLinearScale, PointElement, LineElement, Filler,
  BarController, BarElement, LinearScale, CategoryScale,
  DoughnutController, ArcElement,
  Tooltip as ChartTooltip, Legend as ChartLegend,
} from 'chart.js';

Chart.register(
  RadarController, RadialLinearScale, PointElement, LineElement, Filler,
  BarController, BarElement, LinearScale, CategoryScale,
  DoughnutController, ArcElement,
  ChartTooltip, ChartLegend,
);

// Label leggibili per ogni chiave normalizzata
const LABEL_MAP = {
  soddisfazione_generale:    'Soddisfazione generale',
  nps_consiglio:             'Propensione raccomandazione',
  info_ingresso:             'Accoglienza ingresso',
  info_prenotazione:         'Informazioni prenotazione',
  voto_assistenza:           'Personale assistenza',
  rispetto_dignita:          'Riservatezza e dignità',
  assistenza_medica:         'Assistenza medica',
  assistenza_notturna:       'Assistenza infermieristica',
  soddisfazione_pulizia:     'Igiene e pulizia',
  voto_animazione:           'Attività ricreative',
  soddisfazione_servizi:     'Servizi offerti',
  fisioterapia:              'Fisioterapia',
  voto_alloggio:             'Comfort alloggio',
  voto_ristorazione_qualita: 'Qualità ristorazione',
  soddisfazione_tempo:       'Tempo dedicato',
  voto_pulizie:              'Personale pulizie',
  voto_bagno:                'Bagno',
  voto_spazio_esterno:       'Spazio esterno',
  info_cura:                 'Informazioni cura',
  ascolto:                   'Modo in cui viene ascoltato',
  contatto_struttura:        'Facilità contatto',
  relazione_equipe:          'Relazione con equipe',
  cura_bisogni:              'Bisogni presi in considerazione',
  appagamento_vita:          'Appagamento vita quotidiana',
  coinvolgimento_cure:       'Coinvolgimento nelle cure',
  assistenza_diurna:         'Assistenza diurna',
  // operator
  sicurezza_ambiente:        'Ambiente di lavoro',
  riconoscimento:            'Riconoscimento lavoro',
  supporto_leadership:       'Supporto responsabile',
  etica_assistenza:          'Etica e rispetto ospiti',
  chiarezza_ruolo:           'Chiarezza ruolo',
  qualita_tecnica:           'Qualità cure erogate',
  reputazione_lavoro:        'Consiglieresti come posto di lavoro',
  reputazione_servizio:      'Consiglieresti per assistenza',
};

// Categorie per il radar
const CATEGORIE_CLIENT = {
  personale:    ['voto_assistenza', 'rispetto_dignita', 'assistenza_medica', 'assistenza_notturna', 'soddisfazione_tempo'],
  struttura:    ['soddisfazione_pulizia', 'voto_alloggio', 'voto_bagno', 'voto_spazio_esterno'],
  servizi:      ['voto_animazione', 'soddisfazione_servizi', 'fisioterapia'],
  ristorazione: ['voto_ristorazione_qualita', 'voto_pulizie'],
  accoglienza:  ['info_ingresso', 'info_prenotazione'],
  reputazione:  ['nps_consiglio', 'soddisfazione_generale'],
};

const CATEGORIE_OPERATOR = {
  clima:        ['riconoscimento', 'supporto_leadership', 'sicurezza_ambiente'],
  organizzazione: ['chiarezza_ruolo', 'qualita_tecnica', 'etica_assistenza'],
  reputazione:  ['reputazione_lavoro', 'reputazione_servizio', 'soddisfazione_generale'],
};

function semaforoColor(val) {
  if (val >= 80) return '#0ca30c';
  if (val >= 75) return '#2a78d6';
  if (val >= 70) return '#eda100';
  return '#e34948';
}

// Genera radar come immagine per il documento Word
async function generaRadarBase64(avgScores, udoAvgScores, surveyType) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;
    document.body.appendChild(canvas);

    const cats = surveyType === 'operator'
      ? { 'Clima': ['riconoscimento','supporto_leadership','sicurezza_ambiente'], 'Organizzazione': ['chiarezza_ruolo','qualita_tecnica','etica_assistenza'], 'Reputazione': ['reputazione_lavoro','reputazione_servizio','soddisfazione_generale'] }
      : { 'Personale': ['voto_assistenza','rispetto_dignita','assistenza_medica','assistenza_notturna','soddisfazione_tempo'], 'Struttura': ['soddisfazione_pulizia','voto_alloggio'], 'Servizi': ['voto_animazione','soddisfazione_servizi','fisioterapia'], 'Ristorazione': ['voto_ristorazione_qualita'], 'Accoglienza': ['info_ingresso'], 'Reputazione': ['nps_consiglio','soddisfazione_generale'] };

    const labels = Object.keys(cats);
    const strutturaData = labels.map(cat => {
      const keys = cats[cat];
      const vals = keys.map(k => avgScores?.[k]).filter(v => v != null);
      return vals.length ? Math.round(vals.reduce((a,b) => a+b,0)/vals.length) : 0;
    });
    const udoData = labels.map(cat => {
      const keys = cats[cat];
      const vals = keys.map(k => udoAvgScores?.[k]).filter(v => v != null);
      return vals.length ? Math.round(vals.reduce((a,b) => a+b,0)/vals.length) : null;
    });

    const chart = new Chart(canvas, {
      type: 'radar',
      data: {
        labels,
        datasets: [
          { label: 'Struttura', data: strutturaData, borderColor: '#2a78d6', backgroundColor: 'rgba(42,120,214,0.15)', borderWidth: 2, pointRadius: 4 },
          { label: 'Media UDO', data: udoData, borderColor: '#94A3B8', backgroundColor: 'transparent', borderWidth: 1.5, borderDash: [5,3], pointRadius: 3 }
        ]
      },
      options: {
        responsive: false,
        animation: false,
        scales: { r: { min: 50, max: 100, ticks: { stepSize: 10, font: { size: 11 } }, pointLabels: { font: { size: 12 } } } },
        plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } }
      }
    });

    setTimeout(() => {
      const base64 = canvas.toDataURL('image/png').split(',')[1];
      chart.destroy();
      document.body.removeChild(canvas);
      resolve(base64);
    }, 300);
  });
}

async function generaBarreBase64(avgScores, surveyType) {
  return new Promise((resolve) => {
    const CATEGORIE = surveyType === 'operator'
      ? { 'Clima organizzativo': ['riconoscimento','supporto_leadership','sicurezza_ambiente'], 'Organizzazione': ['chiarezza_ruolo','qualita_tecnica','etica_assistenza'], 'Reputazione': ['reputazione_lavoro','reputazione_servizio','soddisfazione_generale'] }
      : { 'Personale': ['voto_assistenza','rispetto_dignita','assistenza_medica','assistenza_notturna','soddisfazione_tempo'], 'Struttura': ['soddisfazione_pulizia','voto_alloggio'], 'Servizi': ['voto_animazione','soddisfazione_servizi','fisioterapia'], 'Ristorazione': ['voto_ristorazione_qualita'], 'Accoglienza': ['info_ingresso'], 'Reputazione': ['nps_consiglio','soddisfazione_generale'] };

    const labels = [];
    const data = [];
    const colors = [];

    for (const [cat, keys] of Object.entries(CATEGORIE)) {
      const vals = keys.map(k => avgScores?.[k]).filter(v => v != null);
      if (!vals.length) continue;
      const avg = Math.round(vals.reduce((a,b) => a+b,0)/vals.length);
      labels.push(cat);
      data.push(avg);
      colors.push(avg >= 80 ? '#0ca30c' : avg >= 75 ? '#2a78d6' : avg >= 70 ? '#eda100' : '#e34948');
    }

    const canvas = document.createElement('canvas');
    canvas.width = 500;
    canvas.height = labels.length * 50 + 60;
    document.body.appendChild(canvas);

    const chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{ data, backgroundColor: colors, borderRadius: 4 }]
      },
      options: {
        indexAxis: 'y',
        responsive: false,
        animation: false,
        scales: {
          x: { min: 0, max: 100, ticks: { font: { size: 12 } } },
          y: { ticks: { font: { size: 13 } } }
        },
        plugins: { legend: { display: false } }
      }
    });

    setTimeout(() => {
      const base64 = canvas.toDataURL('image/png').split(',')[1];
      chart.destroy();
      document.body.removeChild(canvas);
      resolve(base64);
    }, 300);
  });
}

async function generaTortaNPSBase64(nps) {
  return new Promise((resolve) => {
    if (nps == null) { resolve(null); return; }
    const promotori = Math.round(nps * 0.62);
    const passivi = Math.round(nps * 0.25);
    const detrattori = 100 - promotori - passivi;

    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 300;
    document.body.appendChild(canvas);

    const chart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: [`Certamente ${promotori}%`, `Forse ${passivi}%`, `No ${detrattori}%`],
        datasets: [{ data: [promotori, passivi, detrattori], backgroundColor: ['#0ca30c','#eda100','#e34948'], borderWidth: 2 }]
      },
      options: {
        responsive: false,
        animation: false,
        plugins: { legend: { position: 'bottom', labels: { font: { size: 12 } } } }
      }
    });

    setTimeout(() => {
      const base64 = canvas.toDataURL('image/png').split(',')[1];
      chart.destroy();
      document.body.removeChild(canvas);
      resolve(base64);
    }, 300);
  });
}

function NpsGauge({ nps }) {
  if (nps == null) return null;
  // NPS da avg_scores è già normalizzato 0-100
  // Promotori: >=90, Passivi: 70-89, Detrattori: <70 (scala 0-100)
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">NPS — Propensione raccomandazione</p>
      <div className="text-center mb-3">
        <span className="text-5xl font-black text-blue-600">{nps}</span>
        <span className="text-slate-400 text-sm">/100</span>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden gap-0.5 mb-2">
        <div style={{ flex: Math.max(nps, 5), background: '#0ca30c' }} className="rounded-l-full" />
        <div style={{ flex: Math.max(100 - nps - 10, 5), background: '#eda100' }} />
        <div style={{ flex: 10, background: '#e34948' }} className="rounded-r-full" />
      </div>
    </div>
  );
}

function RadarCategorie({ avgScores, udoAvgScores, surveyType }) {
  const cats = surveyType === 'operator' ? CATEGORIE_OPERATOR : CATEGORIE_CLIENT;
  const data = Object.entries(cats).map(([cat, keys]) => {
    const vals = keys.map(k => avgScores?.[k]).filter(v => v != null);
    const udoVals = keys.map(k => udoAvgScores?.[k]).filter(v => v != null);
    return {
      cat: cat.charAt(0).toUpperCase() + cat.slice(1),
      struttura: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null,
      udo: udoVals.length ? Math.round(udoVals.reduce((a, b) => a + b, 0) / udoVals.length) : null,
    };
  }).filter(d => d.struttura != null);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Mappa dimensionale</p>
      <ResponsiveContainer width="100%" height={260}>
        <RadarChart data={data}>
          <PolarGrid stroke="#e2e8f0" />
          <PolarAngleAxis dataKey="cat" tick={{ fontSize: 11, fill: '#64748b' }} />
          <Radar name="Struttura" dataKey="struttura" stroke="#2a78d6" fill="#2a78d6" fillOpacity={0.25} strokeWidth={2} />
          <Radar name="Media UDO" dataKey="udo" stroke="#94a3b8" fill="none" strokeWidth={1.5} strokeDasharray="4 2" />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const cat = payload[0]?.payload?.cat?.toLowerCase();
              const keys = Object.entries(cats).find(([k]) => k === cat)?.[1] ?? [];
              return (
                <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs max-w-[200px]">
                  <p className="font-bold text-slate-700 mb-2">{payload[0]?.payload?.cat}</p>
                  <p className="text-blue-600 font-medium mb-1">Struttura: {payload[0]?.value}/100</p>
                  {payload[1] && <p className="text-slate-400 mb-2">Media UDO: {payload[1]?.value}/100</p>}
                  {keys.length > 0 && (
                    <>
                      <p className="text-slate-400 text-[10px] uppercase tracking-wide mb-1">Domande incluse:</p>
                      {keys.map(k => (
                        <p key={k} className="text-slate-500 text-[10px] flex justify-between gap-2">
                          <span>{LABEL_MAP[k] ?? k}</span>
                          <span className="font-medium text-slate-700">{avgScores?.[k] ?? '–'}</span>
                        </p>
                      ))}
                    </>
                  )}
                </div>
              );
            }}
          />
        </RadarChart>
      </ResponsiveContainer>
      <div className="flex gap-4 justify-center text-[10px] text-slate-500 mt-1">
        <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-blue-500 inline-block"></span>Struttura</span>
        <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-slate-400 inline-block" style={{borderTop:'2px dashed #94a3b8'}}></span>Media UDO</span>
      </div>
    </div>
  );
}

function BarreMinMax({ avgScores, minScores, maxScores, udoAvgScores }) {
  if (!avgScores) return null;
  const entries = Object.entries(avgScores)
    .filter(([k]) => k !== 'nps_consiglio')
    .sort((a, b) => b[1] - a[1]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tutte le domande — /100</p>
        <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-lg font-bold">
          {entries.filter(([,v]) => v < 75).length} sotto soglia (75)
        </span>
      </div>

      <div className="flex gap-3 text-[10px] text-slate-400 mb-3">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block bg-green-600"></span>&gt;80</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block bg-blue-600"></span>75–80</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block bg-amber-500"></span>70–75</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block bg-red-500"></span>&lt;70</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 inline-block bg-slate-400 opacity-50"></span>Media UDO</span>
      </div>

      <div className="flex text-[10px] text-slate-400 mb-2 gap-2">
        <span style={{width:148}}>Domanda</span>
        <span className="flex-1">Range risposte</span>
        <span style={{width:28}} className="text-right">Med.</span>
        <span style={{width:44}} className="text-right">Min–Max</span>
        <span style={{width:28}} className="text-right">⌀UDO</span>
      </div>

      <div className="space-y-2">
        {entries.map(([key, avg]) => {
          const min = minScores?.[key] ?? 0;
          const max = maxScores?.[key] ?? 100;
          const udo = udoAvgScores?.[key];
          const color = semaforoColor(avg);
          const label = LABEL_MAP[key] ?? key;
          return (
            <div key={key} className="flex items-center gap-2">
              <span className="text-[11px] text-slate-600 truncate" style={{width:148}}>{label}</span>
              <div
                className="flex-1 relative h-2.5 bg-slate-100 rounded-full overflow-visible"
                title={`Media: ${avg}/100 | Min: ${min} | Max: ${max}${udo != null ? ` | Media UDO: ${udo}` : ''}`}
              >
                <div
                  className="absolute h-full rounded-full"
                  style={{
                    left: `${min}%`,
                    width: `${max - min}%`,
                    background: color,
                    opacity: 0.85,
                  }}
                />
                {udo != null && (
                  <div
                    title={`Media UDO: ${udo}/100`}
                    className="absolute cursor-help"
                    style={{
                      left: `${udo}%`,
                      top: -4,
                      width: 3,
                      height: 20,
                      background: '#1e40af',
                      opacity: 0.7,
                      borderRadius: 2,
                      transform: 'translateX(-50%)',
                    }}
                  />
                )}
              </div>
              <span className="text-[11px] font-medium text-slate-700" style={{width:28, textAlign:'right'}}>{avg}</span>
              <span className="text-[10px] text-slate-400" style={{width:44, textAlign:'right'}}>{min}–{max}</span>
              <span className="text-[10px] text-blue-600 font-medium" style={{width:28, textAlign:'right'}} title="Media UDO">
                {udo != null ? `⌀${udo}` : '–'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AnalisiCampagnaPanel({ facility }) {
  const { data: campagne = [], isLoading } = useSurveyCampagne(facility?.id, facility?.company_id);
  const [selectedId, setSelectedId] = useState(null);
  const [surveyType, setSurveyType] = useState('client');

  const campagneFiltrate = useMemo(
    () => campagne.filter(c => c.survey_type === surveyType),
    [campagne, surveyType]
  );

  const selected = useMemo(
    () => campagneFiltrate.find(c => c.campagna_id === selectedId) ?? campagneFiltrate[0] ?? null,
    [campagneFiltrate, selectedId]
  );

  const score = useMemo(() => {
    if (!selected?.avg_scores) return null;
    const vals = Object.values(selected.avg_scores).filter(v => v != null);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  }, [selected]);

  const [commenti, setCommenti]   = useState(null);
  const [suntoCommenti, setSuntoCommenti] = useState('');
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiError, setAiError]     = useState(null);
  const [docGenerating, setDocGenerating] = useState(false);

  const showCommenti = commenti !== null; // sempre visibile se il fetch è partito

  useEffect(() => {
    setCommenti(null);
    setSuntoCommenti('');
    setAiError(null);
    if (!selected) return;

    async function fetchCommenti() {
      const { data: nomiData } = await supabase
        .from('survey_campagna_nomi')
        .select('nome_survey')
        .eq('campagna_id', selected.campagna_id)
        .eq(selected.is_company_wide ? 'company_id' : 'facility_id',
            selected.is_company_wide ? facility.company_id : facility.id);

      const nomi = (nomiData ?? []).map(r => r.nome_survey);

      if (!nomi.length) { setCommenti([]); return; }

      if (selected.survey_type === 'operator') {
        const { data } = await supabase
          .from('survey_personale')
          .select('formazione_12mesi, note, struttura')
          .in('struttura', nomi)
          .gte('created_at', selected.data_inizio)
          .lte('created_at', selected.data_fine + 'T23:59:59');
        setCommenti((data ?? []).filter(r => r.formazione_12mesi?.trim() || r.note?.trim()));
      } else {
        // Client — aggrega da tutte le tabelle raw
        const [rsa, sl, psi] = await Promise.all([
          supabase.from('survey_rsa').select('note, struttura')
            .in('struttura', nomi)
            .gte('created_at', selected.data_inizio)
            .lte('created_at', selected.data_fine + 'T23:59:59'),
          supabase.from('survey_seniorliving').select('"Note", struttura')
            .in('struttura', nomi)
            .gte('created_at', selected.data_inizio)
            .lte('created_at', selected.data_fine + 'T23:59:59'),
          supabase.from('survey_centri_psichiatria').select('note, struttura')
            .in('struttura', nomi)
            .gte('created_at', selected.data_inizio)
            .lte('created_at', selected.data_fine + 'T23:59:59'),
        ]);
        const tutti = [
          ...(rsa.data ?? []).map(r => ({ note: r.note, struttura: r.struttura })),
          ...(sl.data ?? []).map(r => ({ note: r.Note, struttura: r.struttura })),
          ...(psi.data ?? []).map(r => ({ note: r.note, struttura: r.struttura })),
        ].filter(r => r.note?.trim());
        setCommenti(tutti);
      }
    }

    fetchCommenti();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.campagna_id]);

  async function generaSunto() {
    if (!commenti?.length) return;
    if (!process.env.REACT_APP_ANTHROPIC_API_KEY) {
      setAiError('Chiave API Anthropic non configurata.');
      return;
    }
    setLoadingAI(true);
    setSuntoCommenti('');
    setAiError(null);

    const totaleQuestionari = selected.n_risposte;
    const nCommenti = commenti.length;
    const percRisposta = totaleQuestionari > 0 ? Math.round(nCommenti / totaleQuestionari * 100) : 0;

    const testiFormattati = commenti.map((r, i) =>
      `[${i+1}] ${r.note?.trim() ?? ''}${r.formazione_12mesi?.trim() ? ` | Formazione: ${r.formazione_12mesi.trim()}` : ''}`
    ).join('\n');

    const prompt = `Sei un esperto di qualità nel settore socio-sanitario italiano.
Hai ricevuto ${nCommenti} commenti liberi su un totale di ${totaleQuestionari} questionari compilati (${percRisposta}% di risposta ai campi aperti).

COMMENTI:
${testiFormattati}

Produci una sintesi strutturata così:
1. PARTECIPAZIONE AI COMMENTI: una riga con il dato numerico (${nCommenti}/${totaleQuestionari}).
2. TEMI EMERSI: elenca i temi principali con indicazione di quante persone li hanno citato (es. "Qualità del cibo — citato da 4 persone"). Raggruppa commenti simili. Non citare commenti singoli come se fossero opinioni diffuse.
3. SEGNALI POSITIVI: max 3 punti con conteggio.
4. AREE DI ATTENZIONE: max 3 punti con conteggio.

Regola importante: se un tema è citato da 1 sola persona, indicalo esplicitamente come "segnalazione individuale". Non generalizzare mai.
Rispondi in italiano, tono professionale.`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type':                              'application/json',
          'x-api-key':                                 process.env.REACT_APP_ANTHROPIC_API_KEY,
          'anthropic-version':                         '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      setSuntoCommenti(data.content?.[0]?.text ?? '');
    } catch (err) {
      setAiError('Impossibile generare il sunto. Riprova.');
    } finally {
      setLoadingAI(false);
    }
  }

  async function generaDocumenti() {
    if (!selected) return;
    setDocGenerating(true);
    try {
      // Fetch commenti freschi invece di usare lo state
      let commentiDoc = [];

      const { data: nomiData } = await supabase
        .from('survey_campagna_nomi')
        .select('nome_survey')
        .eq('campagna_id', selected.campagna_id)
        .eq(selected.is_company_wide ? 'company_id' : 'facility_id',
            selected.is_company_wide ? facility.company_id : facility.id);

      const nomi = (nomiData ?? []).map(r => r.nome_survey);

      if (nomi.length) {
        if (selected.survey_type === 'operator') {
          const { data } = await supabase
            .from('survey_personale')
            .select('formazione_12mesi, note, struttura')
            .in('struttura', nomi)
            .gte('created_at', selected.data_inizio)
            .lte('created_at', selected.data_fine + 'T23:59:59');
          commentiDoc = (data ?? []).filter(r => r.formazione_12mesi?.trim() || r.note?.trim());
        } else {
          const [rsa, sl, psi] = await Promise.all([
            supabase.from('survey_rsa').select('note, struttura')
              .in('struttura', nomi)
              .gte('created_at', selected.data_inizio)
              .lte('created_at', selected.data_fine + 'T23:59:59'),
            supabase.from('survey_seniorliving').select('"Note", struttura')
              .in('struttura', nomi)
              .gte('created_at', selected.data_inizio)
              .lte('created_at', selected.data_fine + 'T23:59:59'),
            supabase.from('survey_centri_psichiatria').select('note, struttura')
              .in('struttura', nomi)
              .gte('created_at', selected.data_inizio)
              .lte('created_at', selected.data_fine + 'T23:59:59'),
          ]);
          commentiDoc = [
            ...(rsa.data ?? []).map(r => ({ note: r.note, struttura: r.struttura })),
            ...(sl.data ?? []).map(r => ({ note: r.Note, struttura: r.struttura })),
            ...(psi.data ?? []).map(r => ({ note: r.note, struttura: r.struttura })),
          ].filter(r => r.note?.trim());
        }
      }

      // Genera radar come immagine per il documento Word
      const radarBase64 = await generaRadarBase64(selected.avg_scores, selected.udo_avg_scores, selected.survey_type);
      const barreBase64 = await generaBarreBase64(selected.avg_scores, selected.survey_type);
      const tortaNPSBase64 = await generaTortaNPSBase64(selected.avg_scores?.nps_consiglio);

      const params = {
        facility, supabase,
        facilityName: facility.name,
        campagnaNome: selected.campagna_nome,
        dataInizio: selected.data_inizio,
        dataFine: selected.data_fine,
        nRisposte: selected.n_risposte,
        surveyType: selected.survey_type,
        avgScores: selected.avg_scores,
        minScores: selected.min_scores,
        maxScores: selected.max_scores,
        udoAvgScores: selected.udo_avg_scores,
        commenti: commentiDoc,
        suntoCommenti,
        radarBase64,
        barreBase64,
        tortaNPSBase64,
      };

      await generaReportSurveyCampagna({ ...params, target: 'direzione' });
      await generaReportSurveyCampagna({ ...params, target: 'utenza' });

      // Storicizza in survey_ai_reports
      await supabase.from('survey_ai_reports').upsert({
        facility_id: facility.id,
        calendar_id: selected.data_inizio.slice(0, 7),
        source_table: selected.survey_type === 'client' ? 'survey_rsa' : 'survey_personale',
        campagna_id: selected.campagna_id,
        ai_report_direzione: `Generato il ${new Date().toLocaleDateString('it-IT')} — ${selected.n_risposte} risposte`,
        ai_report_ospiti: `Generato il ${new Date().toLocaleDateString('it-IT')} — ${selected.n_risposte} risposte`,
      }, { onConflict: 'facility_id,campagna_id,source_table' });
    } finally {
      setDocGenerating(false);
    }
  }

  if (isLoading) return <div className="py-12 text-center text-slate-400 text-sm">Caricamento campagne...</div>;

  if (campagne.length === 0) return (
    <div className="py-12 text-center">
      <p className="text-slate-400 text-sm font-medium">Nessuna campagna disponibile per questa struttura</p>
      <p className="text-slate-300 text-xs mt-1">Le campagne si creano da Impostazioni → Campagne Survey</p>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-2">
          {['client', 'operator'].map(t => (
            <button key={t} onClick={() => setSurveyType(t)}
              className={`text-xs font-bold px-4 py-2 rounded-xl transition-all ${
                surveyType === t
                  ? 'bg-indigo-600 text-white shadow'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300'
              }`}>
              {t === 'client' ? '👥 Clienti / Ospiti' : '💼 Staff / Operatori'}
            </button>
          ))}
        </div>

        <select
          value={selected?.campagna_id ?? ''}
          onChange={e => setSelectedId(e.target.value)}
          className="text-sm font-medium border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-700 outline-none focus:border-indigo-400"
        >
          {campagneFiltrate.map(c => (
            <option key={c.campagna_id} value={c.campagna_id}>
              {c.campagna_nome} · {c.n_risposte} risposte{c.is_company_wide ? ' 🏢' : ''}
            </option>
          ))}
        </select>

        {selected && (
          <button
            onClick={generaDocumenti}
            disabled={docGenerating}
            className="flex items-center gap-2 text-xs font-bold bg-emerald-600 text-white px-4 py-2 rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {docGenerating ? 'Generazione...' : '📄 Genera documenti Word'}
          </button>
        )}

        {selected && (
          <span className="text-xs text-slate-400">
            {selected.data_inizio} → {selected.data_fine}
          </span>
        )}

        {score != null && (
          <span className="ml-auto text-sm font-black" style={{color: semaforoColor(score)}}>
            Score {score}/100
          </span>
        )}
      </div>

      {!selected ? (
        <p className="text-slate-400 text-sm text-center py-8">Nessuna campagna per questo tipo</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-5">
            <NpsGauge nps={selected.avg_scores?.nps_consiglio} />
            <RadarCategorie
              avgScores={selected.avg_scores}
              udoAvgScores={selected.udo_avg_scores}
              surveyType={surveyType}
            />
          </div>
          <BarreMinMax
            avgScores={selected.avg_scores}
            minScores={selected.min_scores}
            maxScores={selected.max_scores}
            udoAvgScores={selected.udo_avg_scores}
          />

          {showCommenti && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Commenti liberi — {commenti.length} risposte con testo
                </p>
                <button
                  onClick={generaSunto}
                  disabled={loadingAI || commenti.length === 0}
                  className="flex items-center gap-2 text-xs font-bold bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {loadingAI ? (
                    <><span className="animate-spin">⏳</span> Analisi in corso...</>
                  ) : (
                    <>✨ Analizza commenti con AI</>
                  )}
                </button>
              </div>

              {/* Lista commenti */}
              <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                {commenti.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Nessun commento testuale in questa campagna</p>
                ) : (
                  commenti.map((r, i) => (
                    <div key={i} className="bg-slate-50 rounded-xl p-3 text-xs text-slate-600">
                      {r.struttura && (
                        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">{r.struttura}</p>
                      )}
                      {r.formazione_12mesi?.trim() && (
                        <p><span className="font-medium text-slate-500">Formazione:</span> {r.formazione_12mesi}</p>
                      )}
                      {r.note?.trim() && (
                        <p className="mt-1"><span className="font-medium text-slate-500">Note:</span> {r.note}</p>
                      )}
                    </div>
                  ))
                )}
              </div>

              {aiError && <p className="text-xs text-red-500 mb-2">{aiError}</p>}

              {/* Sunto AI */}
              {suntoCommenti && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                  <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-2">✨ Analisi AI</p>
                  {suntoCommenti}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
