import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, ShadingType, PageBreak,
  ImageRun, VerticalAlign, HeightRule
} from 'docx';
import { LABEL_MAP } from '../config/surveyLabels';
import { semaforoColor } from '../utils/surveyColors';
import { ORDINE_FASCE } from '../utils/surveyDistribuzione';

const CATEGORIE_CLIENT = {
  'Personale': ['voto_assistenza','rispetto_dignita','assistenza_medica','assistenza_notturna','soddisfazione_tempo'],
  'Struttura': ['soddisfazione_pulizia','voto_alloggio','voto_bagno','voto_spazio_esterno'],
  'Servizi': ['voto_animazione','soddisfazione_servizi','fisioterapia'],
  'Ristorazione': ['voto_ristorazione_qualita','voto_pulizie'],
  'Accoglienza': ['info_ingresso','info_prenotazione'],
  'Reputazione': ['nps_consiglio','soddisfazione_generale'],
};

const CATEGORIE_OPERATOR = {
  'Clima organizzativo': ['riconoscimento','supporto_leadership','sicurezza_ambiente'],
  'Organizzazione': ['chiarezza_ruolo','qualita_tecnica','etica_assistenza'],
  'Reputazione': ['reputazione_lavoro','reputazione_servizio','soddisfazione_generale'],
};

const BLU = '1E3A5F';
const GRAY = '64748B';
const WHITE = 'FFFFFF';
const GREEN = '166534';
const RED = '991B1B';

// Colore derivato da semaforoColor() (src/utils/surveyColors.js), unica fonte di
// verità per le soglie — evita che questa scala diverga da quella on-screen.
export function semaforo(val) {
  const color = semaforoColor(val).replace('#', '').toUpperCase();
  if (val > 80) return { symbol: '●', label: 'OTTIMO', color };
  if (val >= 75) return { symbol: '◐', label: 'BUONO', color };
  if (val >= 70) return { symbol: '○', label: 'ATTENZIONE', color };
  return { symbol: '▼', label: 'CRITICO', color };
}

// Converte una stringa base64 (senza prefisso data:) in Uint8Array,
// necessario perché docx/JSZip scrive le stringhe come byte binari letterali,
// non come base64 decodificato.
function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// ImageRun dimensionato mantenendo l'aspect ratio del canvas sorgente
// (src/utils/campagnaCharts.js restituisce anche width/height in px), scalato
// a una larghezza di stampa fissa invece di un'altezza indovinata a mano.
function imageRunProporzionale(base64, srcWidth, srcHeight, targetWidth) {
  const targetHeight = Math.round(targetWidth * (srcHeight / srcWidth));
  return new ImageRun({ data: base64ToUint8Array(base64), type: 'png', transformation: { width: targetWidth, height: targetHeight } });
}

// Helper celle tabella
function hCell(text, width, color = BLU) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill: color },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      children: [new TextRun({ text, bold: true, color: WHITE, size: 18 })],
    })],
  });
}

function dCell(text, width, opts = {}) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: opts.shade ? { type: ShadingType.CLEAR, fill: 'F8FAFC' } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      children: [new TextRun({ text: String(text ?? '–'), bold: opts.bold, size: 18, color: opts.color })],
    })],
  });
}

function catCell(text, width) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill: 'E2E8F0' },
    columnSpan: 1,
    children: [new Paragraph({
      children: [new TextRun({ text, bold: true, size: 16, color: '475569' })],
    })],
  });
}

function sectionTitle(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 26, color: BLU })],
    spacing: { before: 240, after: 120 },
    border: { bottom: { color: BLU, size: 6, space: 4, style: 'single' } },
  });
}

function spacer(n = 120) {
  return new Paragraph({ text: '', spacing: { before: n } });
}

function editLine() {
  return new Paragraph({
    children: [new TextRun({ text: '_'.repeat(90), size: 20, color: 'CBD5E1' })],
    spacing: { after: 80 },
  });
}

// Spezza una riga in TextRun alternando testo normale e **grassetto**,
// così il markdown grezzo restituito dall'AI diventa formattazione docx reale.
function parseInlineRuns(text, opts = {}) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(p => p !== '');
  const runs = parts.map(part =>
    part.startsWith('**') && part.endsWith('**')
      ? new TextRun({ text: part.slice(2, -2), bold: true, ...opts })
      : new TextRun({ text: part, ...opts })
  );
  return runs.length ? runs : [new TextRun({ text: '', ...opts })];
}

// Converte il markdown grezzo che l'AI a volte restituisce (#/##/### titoli,
// **grassetto**, elenchi puntati "- ", separatori "---", riferimenti "[1][2]")
// in Paragraph docx veri invece di stamparlo come testo letterale.
function markdownToParagraphs(rawText, opts = { size: 20 }) {
  const cleaned = (rawText ?? '').replace(/\[\d+\]/g, '').trim();
  if (!cleaned) return [];

  const paragraphs = [];
  for (const rawLine of cleaned.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^-{3,}\s*$/.test(line)) continue; // separatore "---": nessun elemento docx equivalente, si scarta

    const heading = line.match(/^(#{1,3})\s+(.*)/);
    if (heading) {
      const level = heading[1].length;
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: heading[2].replace(/\*\*/g, ''), bold: true, size: level === 1 ? 24 : level === 2 ? 22 : 20, color: BLU })],
        spacing: { before: 160, after: 100 },
      }));
      continue;
    }

    const bullet = line.match(/^[-*]\s+(.*)/);
    if (bullet) {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: '•  ', ...opts }), ...parseInlineRuns(bullet[1], opts)],
        indent: { left: 240 },
        spacing: { after: 80 },
      }));
      continue;
    }

    paragraphs.push(new Paragraph({ children: parseInlineRuns(line, opts), spacing: { after: 120 } }));
  }
  return paragraphs;
}

// Testo AI-approvato dal direttore se presente (convertito da markdown a
// elementi docx), altrimenti righe vuote da riempire a mano — stesso
// trattamento placeholder usato in tutto il resto del documento per i
// contenuti non ancora generati/rivisti.
function testoOPlaceholder(text, righeVuote = 3) {
  if (text?.trim()) {
    return markdownToParagraphs(text, { size: 20 });
  }
  return Array.from({ length: righeVuote }, () => editLine());
}

function kpiTable(items) {
  const W = 9360;
  const cw = Math.round(W / items.length);
  return new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: items.map(() => cw),
    rows: [
      new TableRow({ children: items.map(it => new TableCell({
        width: { size: cw, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: 'F1F5F9' },
        children: [
          new Paragraph({ children: [new TextRun({ text: it.label, size: 16, color: GRAY, bold: true })], spacing: { after: 40 } }),
          new Paragraph({ children: [new TextRun({ text: it.value, size: 36, bold: true, color: BLU })], spacing: { after: 40 } }),
          new Paragraph({ children: [new TextRun({ text: it.sub ?? '', size: 16, color: '94A3B8' })] }),
        ],
      })) }),
    ],
  });
}

function tabellaRisultati(avgScores, minScores, maxScores, udoAvgScores, surveyType) {
  const cats = surveyType === 'operator' ? CATEGORIE_OPERATOR : CATEGORIE_CLIENT;
  // Domande presenti nei dati ma non mappate su nessuna delle aree standard
  // (es. survey_centri_disabilita: Informazioni cura, Assistenza diurna...):
  // vanno in un gruppo "Altro" a fine tabella invece di sparire silenziosamente,
  // pur comparendo regolarmente come torta nel documento utenza.
  const mappedKeys = new Set(Object.values(cats).flat());
  const altroKeys = Object.keys(avgScores ?? {}).filter(k => avgScores[k] != null && !mappedKeys.has(k));
  const catsConAltro = altroKeys.length ? { ...cats, 'Altro': altroKeys } : cats;
  const W = 9360;
  const cols = [Math.round(W*0.40), Math.round(W*0.11), Math.round(W*0.10), Math.round(W*0.10), Math.round(W*0.12), Math.round(W*0.17)];
  const rows = [];

  rows.push(new TableRow({ tableHeader: true, children: [
    hCell('Domanda', cols[0]),
    hCell('Media', cols[1]),
    hCell('Min', cols[2]),
    hCell('Max', cols[3]),
    hCell('⌀ UDO', cols[4]),
    hCell('Esito', cols[5]),
  ]}));

  let rowIdx = 0;
  for (const [catLabel, keys] of Object.entries(catsConAltro)) {
    rows.push(new TableRow({ children: [
      catCell(catLabel.toUpperCase(), cols[0]),
      catCell('', cols[1]), catCell('', cols[2]),
      catCell('', cols[3]), catCell('', cols[4]), catCell('', cols[5]),
    ]}));

    for (const key of keys) {
      const avg = avgScores?.[key];
      if (avg == null) continue;
      const shade = rowIdx % 2 === 0;
      const sem = semaforo(avg);
      rows.push(new TableRow({ children: [
        dCell(LABEL_MAP[key] ?? key, cols[0], { shade }),
        dCell(String(avg), cols[1], { shade, bold: true }),
        dCell(String(minScores?.[key] ?? '–'), cols[2], { shade }),
        dCell(String(maxScores?.[key] ?? '–'), cols[3], { shade }),
        dCell(String(udoAvgScores?.[key] ?? '–'), cols[4], { shade }),
        dCell(`${sem.symbol} ${sem.label}`, cols[5], { shade, color: sem.color }),
      ]}));
      rowIdx++;
    }
  }

  return new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: cols, rows });
}

// Widget NPS: numero grande + barra segmentata verde/arancio/rosso, primitive
// docx native (no canvas) — stessi rapporti di NpsGauge in AnalisiCampagnaPanel.jsx
// (verde=max(nps,5), arancio=max(100-nps-10,5), rosso=10 fisso).
function npsWidget(nps) {
  if (nps == null) return [];
  const green = Math.max(nps, 5);
  const amber = Math.max(100 - nps - 10, 5);
  const red = 10;
  const total = green + amber + red;
  const W = 4500;
  const cw = frac => Math.round(W * frac / total);
  const barCell = (frac, color) => new TableCell({
    width: { size: cw(frac), type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill: color },
    children: [new Paragraph({ text: '' })],
  });

  return [
    new Paragraph({ children: [new TextRun({ text: 'NPS — PROPENSIONE RACCOMANDAZIONE', bold: true, size: 20, color: GRAY })], spacing: { before: 80, after: 80 } }),
    new Paragraph({
      children: [
        new TextRun({ text: String(nps), bold: true, size: 56, color: BLU }),
        new TextRun({ text: '/100', size: 22, color: '94A3B8' }),
      ],
      spacing: { after: 100 },
    }),
    new Table({
      width: { size: W, type: WidthType.DXA },
      columnWidths: [cw(green), cw(amber), cw(red)],
      rows: [new TableRow({
        height: { value: 160, rule: HeightRule.EXACT },
        children: [
          barCell(green, '0CA30C'),
          barCell(amber, 'EDA100'),
          barCell(red, 'E34948'),
        ],
      })],
    }),
    spacer(220),
  ];
}

// Widget numero+stelle per le domande con Esito CRITICO — porting nativo
// docx (nessun canvas) di StarsCard in RestituzioneModal.jsx: media pesata
// posizionale sulle fasce (5 punti la migliore, 1 la peggiore, come in
// StarsCard), 0-5 stelle con eventuale mezza stella.
function stelleWidget(answers) {
  const fasce = ORDINE_FASCE
    .filter(label => (answers?.[label] ?? 0) > 0)
    .map(label => ({ count: answers[label] }));
  if (!fasce.length) return [];

  let sum = 0, count = 0;
  fasce.forEach((f, i) => {
    const peso = [5, 4, 3, 2, 1][i] ?? 1;
    sum += f.count * peso;
    count += f.count;
  });
  const stars = count > 0 ? sum / count : 0;
  const fullStars = Math.floor(stars);
  const halfStar = stars - fullStars >= 0.4;
  const emptyStars = Math.max(0, 5 - fullStars - (halfStar ? 1 : 0));
  const starText = '★'.repeat(fullStars) + (halfStar ? '½' : '') + '☆'.repeat(emptyStars);

  return [
    new Paragraph({
      children: [
        new TextRun({ text: stars.toFixed(1), bold: true, size: 40, color: BLU }),
        new TextRun({ text: '/5', size: 20, color: '94A3B8' }),
      ],
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [new TextRun({ text: starText, size: 32, color: 'EF9F27' })],
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `${stars.toFixed(1)}/5 · ${count} risposte`, size: 16, color: GRAY })],
      spacing: { after: 200 },
    }),
  ];
}

// ── DOCUMENTO DIREZIONE ────────────────────────────────────────
function buildDirezione({ facilityName, campagnaNome, dataInizio, dataFine, nRisposte, surveyType, avgScores, minScores, maxScores, udoAvgScores, redemptionRate, radarBase64, puntiForza, puntiDebolezza, obiettiviDirezione, temiCommenti, nCommenti, logoImageData, logoType }) {
  const tipoLabel = surveyType === 'client' ? 'Clienti / Ospiti' : 'Staff / Operatori';
  const score = avgScores ? Math.round(Object.values(avgScores).filter(v=>v!=null).reduce((a,b)=>a+b,0)/Object.values(avgScores).filter(v=>v!=null).length) : null;

  return [
    // ── PAGINA 1: FRONTESPIZIO + VALUTAZIONE ──
    ...(logoImageData ? [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new ImageRun({ data: logoImageData, type: logoType, transformation: { width: 200, height: 100 } })],
      spacing: { before: 200, after: 200 },
    })] : [spacer(400)]),

    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: facilityName, bold: true, size: 52, color: BLU })],
      spacing: { after: 80 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: `${campagnaNome} · ${tipoLabel} · Report Direzione`, size: 26, color: GRAY })],
      spacing: { after: 60 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: `Periodo: ${dataInizio} → ${dataFine}`, size: 22, color: '94A3B8' })],
      spacing: { after: 300 },
    }),

    kpiTable([
      { label: 'SCORE MEDIO', value: score ? `${score}/100` : '–', sub: 'Normalizzato' },
      { label: 'RISPOSTE', value: String(nRisposte), sub: 'Questionari' },
      { label: 'NPS', value: avgScores?.nps_consiglio ? `${avgScores.nps_consiglio}` : '–', sub: 'Propensione' },
      { label: 'REDEMPTION', value: redemptionRate != null ? `${redemptionRate}%` : 'N/D', sub: 'Risposte / target' },
    ]),

    // Niente PageBreak forzato qui (round 6): radar+tabella risalgono
    // naturalmente sotto la valutazione direzionale quando c'è spazio in
    // pagina 1, invece di lasciarla quasi vuota con uno stacco di pagina fisso.
    spacer(280),
    sectionTitle('Valutazione direzionale'),

    new Paragraph({ children: [new TextRun({ text: 'PUNTI DI FORZA', bold: true, size: 22, color: GREEN })], spacing: { before: 160, after: 80 } }),
    ...testoOPlaceholder(puntiForza),

    new Paragraph({ children: [new TextRun({ text: 'PUNTI DI DEBOLEZZA', bold: true, size: 22, color: RED })], spacing: { before: 200, after: 80 } }),
    ...testoOPlaceholder(puntiDebolezza),

    new Paragraph({ children: [new TextRun({ text: 'OBIETTIVI E AZIONI PER IL PROSSIMO SEMESTRE', bold: true, size: 22, color: BLU })], spacing: { before: 200, after: 80 } }),
    ...testoOPlaceholder(obiettiviDirezione),

    spacer(280),
    sectionTitle('Mappa dimensionale e risultati per area'),

    ...(radarBase64 ? [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new ImageRun({ data: base64ToUint8Array(radarBase64), type: 'png', transformation: { width: 360, height: 280 } })],
      spacing: { before: 120, after: 200 },
    })] : []),

    tabellaRisultati(avgScores, minScores, maxScores, udoAvgScores, surveyType),

    // Sezione omessa del tutto se non c'è nessun commento libero nel periodo
    // (nCommenti === 0) — nessun testo vuoto/inventato da mostrare.
    ...(nCommenti > 0 ? [
      spacer(280),
      sectionTitle('Temi emersi dai commenti'),
      ...testoOPlaceholder(temiCommenti),
    ] : []),
  ];
}

// ── DOCUMENTO UTENZA ───────────────────────────────────────────
function buildUtenza({ facilityName, campagnaNome, dataInizio, dataFine, nRisposte, surveyType, avgScores, logoImageData, logoType, perQuestionCharts, attivita, sintesiPeriodo, puntiForzaUtenza, doveMigliorareUtenza, azioniUtenza, impegnoUtenza }) {
  const tipoLabel = surveyType === 'client' ? 'Ospiti e Famiglie' : 'Personale e Operatori';
  const nps = avgScores?.nps_consiglio;

  return [
    // ── PAGINA 1: FRONTESPIZIO + MESSAGGIO ──
    ...(logoImageData ? [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new ImageRun({ data: logoImageData, type: logoType, transformation: { width: 200, height: 100 } })],
      spacing: { before: 200, after: 200 },
    })] : [spacer(400)]),

    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: facilityName, bold: true, size: 52, color: BLU })],
      spacing: { after: 80 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: `Risultati rilevazione di soddisfazione · ${tipoLabel}`, size: 26, color: GRAY })],
      spacing: { after: 60 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: `${dataInizio} → ${dataFine} · ${nRisposte} risposte`, size: 22, color: '94A3B8' })],
      spacing: { after: 80 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'La vostra opinione è il nostro strumento di miglioramento più importante.', size: 22, italics: true, color: GRAY })],
      spacing: { after: 320 },
    }),

    // Sintesi del periodo — in apertura del documento, seguita dai 4 campi di
    // dettaglio (punti di forza/dove migliorare/azioni/impegno) prima dei
    // grafici per domanda in pagina 2.
    sectionTitle('Sintesi del periodo'),
    ...testoOPlaceholder(sintesiPeriodo),

    sectionTitle('I nostri punti di forza'),
    ...testoOPlaceholder(puntiForzaUtenza),

    sectionTitle('Dove vogliamo migliorare'),
    ...testoOPlaceholder(doveMigliorareUtenza),

    sectionTitle('Le nostre azioni per il prossimo anno'),
    ...testoOPlaceholder(azioniUtenza),

    sectionTitle('Il nostro impegno'),
    ...testoOPlaceholder(impegnoUtenza),

    // ── PAGINA 2: NPS + GRAFICI PER DOMANDA ──
    new Paragraph({ children: [new PageBreak()] }),
    sectionTitle('Come ci avete valutato'),
    spacer(120),

    ...npsWidget(nps),

    // Un grafico per ogni domanda della campagna, con il nome della domanda
    // come intestazione: torta di norma, widget numero+stelle per le domande
    // con Esito CRITICO (vedi generaDocumenti() in AnalisiCampagnaPanel.jsx).
    // Titolo allineato a sinistra (il grafico sotto resta centrato), con
    // keepNext così il titolo non resta mai orfano a fine pagina separato
    // dal proprio grafico. Spaziatura e larghezza immagine ridotte per farne
    // stare 3 per pagina invece di 2 (era 300px/spacing 160-80/160).
    ...(perQuestionCharts ?? []).flatMap(c => [
      new Paragraph({
        keepNext: true,
        children: [new TextRun({ text: (LABEL_MAP[c.key] ?? c.key).toUpperCase(), bold: true, size: 20, color: GRAY })],
        spacing: { before: 120, after: 30 },
      }),
      ...(c.isCritico
        ? stelleWidget(c.answers)
        : [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [imageRunProporzionale(c.base64, c.width, c.height, 225)],
            spacing: { after: 100 },
          })]),
    ]),

    // Attività — confronto partecipazione: solo se la struttura ha domande
    // di questo tipo nel periodo (oggi solo survey_seniorliving), altrimenti
    // sezione omessa del tutto.
    ...(attivita ? [
      spacer(120),
      new Paragraph({
        children: [new TextRun({ text: 'ATTIVITÀ — CONFRONTO PARTECIPAZIONE', bold: true, size: 20, color: GRAY })],
        spacing: { before: 80, after: 80 },
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [imageRunProporzionale(attivita.base64, attivita.width, attivita.height, 380)],
        spacing: { after: 160 },
      }),
    ] : []),

    // Ringraziamento finale — testo statico fisso, nessuna generazione AI.
    spacer(240),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'Grazie per aver dedicato tempo a raccontarci la vostra esperienza.', size: 22, italics: true, color: GRAY })],
      spacing: { before: 120, after: 40 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'Il vostro contributo ci aiuta a migliorare ogni giorno.', size: 20, color: '94A3B8' })],
    }),
  ];
}

// ── EXPORT PRINCIPALE ──────────────────────────────────────────
export async function generaReportSurveyCampagna({
  facility, supabase,
  facilityName, campagnaNome, dataInizio, dataFine, nRisposte,
  surveyType, avgScores, minScores, maxScores, udoAvgScores, redemptionRate,
  radarBase64, perQuestionCharts, attivita,
  sintesiPeriodo, puntiForza, puntiDebolezza, obiettiviDirezione, temiCommenti, nCommenti,
  puntiForzaUtenza, doveMigliorareUtenza, azioniUtenza, impegnoUtenza, target,
}) {
  let logoImageData = null;
  let logoType = 'png';

  if (facility?.company_id && supabase) {
    try {
      const { data: company } = await supabase
        .from('companies').select('logo_url').eq('id', facility.company_id).single();
      if (company?.logo_url) {
        const ext = company.logo_url.split('.').pop().toLowerCase().split('?')[0];
        logoType = ['jpg','jpeg'].includes(ext) ? 'jpg' : ext === 'png' ? 'png' : 'png';
        const res = await fetch(company.logo_url);
        logoImageData = new Uint8Array(await res.arrayBuffer());
      }
    } catch (e) { console.warn('Logo non disponibile', e); }
  }

  const params = {
    facilityName, campagnaNome, dataInizio, dataFine, nRisposte, surveyType,
    avgScores, minScores, maxScores, udoAvgScores, redemptionRate,
    radarBase64, perQuestionCharts, attivita, sintesiPeriodo, puntiForza, puntiDebolezza,
    obiettiviDirezione, temiCommenti, nCommenti, puntiForzaUtenza, doveMigliorareUtenza,
    azioniUtenza, impegnoUtenza, logoImageData, logoType,
  };

  const children = target === 'direzione'
    ? buildDirezione(params)
    : buildUtenza(params);

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
    sections: [{ children }],
  });

  const blob = await Packer.toBlob(doc);
  const filename = `${facilityName}_${campagnaNome}_${target}_${new Date().toISOString().slice(0,10)}.docx`
    .replace(/[^a-zA-Z0-9_.-]/g, '_');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
