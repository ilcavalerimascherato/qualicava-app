// Generatori di immagini PNG (base64) per i grafici incorporati nei documenti
// Word di campagna (src/services/surveyCampagnaDocService.js). Pattern comune:
// canvas off-DOM -> Chart.js (responsive:false, animation:false) -> attesa
// render -> canvas.toDataURL('image/png') -> destroy/rimozione canvas.
import {
  Chart, RadarController, RadialLinearScale, PointElement, LineElement, Filler,
  BarController, BarElement, LinearScale, CategoryScale,
  PieController, ArcElement,
  Tooltip as ChartTooltip, Legend as ChartLegend,
} from 'chart.js';
import { ORDINE_FASCE, FASCIA_COLORS } from './surveyDistribuzione';

Chart.register(
  RadarController, RadialLinearScale, PointElement, LineElement, Filler,
  BarController, BarElement, LinearScale, CategoryScale,
  PieController, ArcElement,
  ChartTooltip, ChartLegend,
);

function estraiPngBase64(canvas, chart) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const base64 = canvas.toDataURL('image/png').split(',')[1];
      chart.destroy();
      document.body.removeChild(canvas);
      resolve(base64);
    }, 300);
  });
}

// Come estraiPngBase64, ma include anche le dimensioni pixel del canvas —
// serve a chi incorpora l'immagine (ImageRun) per calcolare un transformation
// width/height proporzionato senza indovinare l'aspect ratio.
function estraiPngConDimensioni(canvas, chart) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const base64 = canvas.toDataURL('image/png').split(',')[1];
      const { width, height } = canvas;
      chart.destroy();
      document.body.removeChild(canvas);
      resolve({ base64, width, height });
    }, 300);
  });
}

// Genera radar come immagine per il documento Word
export async function generaRadarBase64(avgScores, udoAvgScores, surveyType) {
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

  return estraiPngBase64(canvas, chart);
}

// Etichette leggibili per le 4 fasce a soglia (domande numeriche continue) —
// il nome del colore resta SOLO come riempimento fetta/barra, mai come testo
// di legenda. Le etichette a valore esatto (Ottimo…Scarso) sono già testo
// descrittivo e passano invariate (fallback ?? label sotto).
const ETICHETTA_LEGGIBILE = {
  'Verde (>80)':     'Eccellente',
  'Blu (75-80)':     'Buono',
  'Arancio (70-75)': 'Sufficiente',
  'Rosso (<70)':     'Critico',
};

// Ordina/colora le fasce di risposta di una domanda secondo ORDINE_FASCE/FASCIA_COLORS
// (src/utils/surveyDistribuzione.js), scartando le etichette assenti nei dati.
// Il colore resta chiavato sull'etichetta grezza (FASCIA_COLORS), l'etichetta
// esposta è già tradotta in testo leggibile.
function fasceOrdinate(answers) {
  return ORDINE_FASCE
    .filter(label => (answers?.[label] ?? 0) > 0)
    .map(label => ({ label: ETICHETTA_LEGGIBILE[label] ?? label, count: answers[label], color: FASCIA_COLORS[label] }));
}

// Torta per singola domanda — stessa logica/ordine/colori di DistribuzioneRisposte.jsx
// (startAngle=90/endAngle=-270 lì). Equivalente Chart.js per un cerchio COMPLETO
// che parte dalle ore 12 in senso orario: rotation=-90, circumference=360 (o
// omesso — 360 è il default, esplicitato qui per chiarezza dopo il bug del
// circumference:270 che tagliava le torte a 3/4).
export async function generaTortaDomandaBase64(answers) {
  const fasce = fasceOrdinate(answers);
  if (!fasce.length) return null;

  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 320;
  document.body.appendChild(canvas);

  const chart = new Chart(canvas, {
    type: 'pie',
    data: {
      labels: fasce.map(f => f.label),
      datasets: [{ data: fasce.map(f => f.count), backgroundColor: fasce.map(f => f.color), borderWidth: 1, borderColor: '#FFFFFF' }],
    },
    options: {
      responsive: false,
      animation: false,
      rotation: -90,
      circumference: 360,
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 10 }, boxWidth: 10 } },
      },
    },
  });

  return estraiPngConDimensioni(canvas, chart);
}

// "Attività — confronto partecipazione": barre orizzontali impilate in %,
// una riga per attività — stessi colori/etichette di StackedCard in
// RestituzioneModal.jsx. Solo per survey_seniorliving (uniche colonne di
// partecipazione presenti nel dataset — vedi fetchAttivitaCampagna in
// AnalisiCampagnaPanel.jsx).
const SCALE_PARTECIPAZIONE = [
  { label: 'Interessante', color: '#3B6D11' },
  { label: 'Non interessante', color: '#EF9F27' },
  { label: 'Non ho partecipato', color: '#94a3b8' },
];

// domandeLabels: { colonna: etichetta }. rows: righe grezze survey_seniorliving.
export async function generaAttivitaBase64(domandeLabels, rows) {
  const labels = [];
  const serie = SCALE_PARTECIPAZIONE.map(s => ({ ...s, data: [] }));

  for (const [col, label] of Object.entries(domandeLabels)) {
    const counts = { 'Interessante': 0, 'Non interessante': 0, 'Non ho partecipato': 0 };
    rows.forEach(row => {
      const v = String(row[col] || '').trim();
      if (counts[v] !== undefined) counts[v]++;
    });
    const tot = Object.values(counts).reduce((a, b) => a + b, 0);
    if (!tot) continue;
    labels.push(label);
    serie.forEach(s => s.data.push(Math.round(counts[s.label] / tot * 100)));
  }
  if (!labels.length) return null;

  const canvas = document.createElement('canvas');
  canvas.width = 460;
  canvas.height = Math.max(160, labels.length * 34 + 80);
  document.body.appendChild(canvas);

  const chart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: serie.map(s => ({ label: s.label, data: s.data, backgroundColor: s.color })),
    },
    options: {
      indexAxis: 'y',
      responsive: false,
      animation: false,
      scales: {
        x: { stacked: true, min: 0, max: 100, ticks: { font: { size: 10 }, callback: v => `${v}%` } },
        y: { stacked: true, ticks: { font: { size: 11 } } },
      },
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 10 }, boxWidth: 10 } },
      },
    },
  });

  return estraiPngConDimensioni(canvas, chart);
}
