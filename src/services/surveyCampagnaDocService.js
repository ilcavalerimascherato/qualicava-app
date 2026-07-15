import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, ShadingType, PageBreak,
  ImageRun, VerticalAlign
} from 'docx';

const LABEL_MAP = {
  soddisfazione_generale: 'Soddisfazione generale',
  nps_consiglio: 'Propensione raccomandazione',
  info_ingresso: 'Accoglienza ingresso',
  info_prenotazione: 'Informazioni prenotazione',
  voto_assistenza: 'Personale assistenza',
  rispetto_dignita: 'Riservatezza e dignità',
  assistenza_medica: 'Assistenza medica',
  assistenza_notturna: 'Assistenza infermieristica',
  soddisfazione_pulizia: 'Igiene e pulizia',
  voto_animazione: 'Attività ricreative',
  soddisfazione_servizi: 'Servizi offerti',
  fisioterapia: 'Fisioterapia',
  voto_alloggio: 'Comfort alloggio',
  voto_ristorazione_qualita: 'Qualità ristorazione',
  soddisfazione_tempo: 'Tempo dedicato',
  voto_pulizie: 'Personale pulizie',
  voto_bagno: 'Bagno',
  voto_spazio_esterno: 'Spazio esterno',
  info_cura: 'Informazioni sul progetto di cura',
  ascolto: 'Modo in cui viene ascoltato',
  contatto_struttura: 'Facilità di contatto',
  relazione_equipe: 'Relazione con equipe',
  cura_bisogni: 'Bisogni presi in considerazione',
  appagamento_vita: 'Appagamento vita quotidiana',
  coinvolgimento_cure: 'Coinvolgimento nelle cure',
  assistenza_diurna: 'Assistenza diurna',
  sicurezza_ambiente: 'Ambiente di lavoro sicuro',
  riconoscimento: 'Riconoscimento del lavoro',
  supporto_leadership: 'Supporto dal responsabile',
  etica_assistenza: 'Etica e rispetto degli ospiti',
  chiarezza_ruolo: 'Chiarezza di ruolo',
  qualita_tecnica: 'Qualità delle cure erogate',
  reputazione_lavoro: 'Consiglieresti come posto di lavoro',
  reputazione_servizio: 'Consiglieresti per assistenza',
};

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
const AMBER = '92400E';

function semaforo(val) {
  if (val >= 80) return { symbol: '●', label: 'OTTIMO', color: '0CA30C' };
  if (val >= 75) return { symbol: '◐', label: 'BUONO', color: '2a78d6' };
  if (val >= 70) return { symbol: '○', label: 'ATTENZIONE', color: AMBER };
  return { symbol: '▼', label: 'CRITICO', color: RED };
}

function starsText(val) {
  const stars = Math.round((val / 100) * 5);
  return '★'.repeat(stars) + '☆'.repeat(5 - stars);
}

function categoryAvg(keys, scores) {
  const vals = keys.map(k => scores?.[k]).filter(v => v != null);
  return vals.length ? Math.round(vals.reduce((a,b) => a+b,0)/vals.length) : null;
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
  for (const [catLabel, keys] of Object.entries(cats)) {
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

function tabellaCommentiSintesi(suntoCommenti, commenti, nRisposte) {
  const n = commenti?.length ?? 0;
  const perc = nRisposte > 0 ? Math.round(n / nRisposte * 100) : 0;
  const children = [];

  children.push(new Paragraph({
    children: [new TextRun({ text: `${n} commenti su ${nRisposte} questionari (${perc}%). Ogni commento rappresenta un'opinione individuale.`, size: 18, italics: true, color: GRAY })],
    spacing: { after: 160 },
  }));

  if (suntoCommenti) {
    children.push(new Paragraph({
      children: [new TextRun({ text: 'SINTESI TEMI', bold: true, size: 20, color: BLU })],
      spacing: { before: 80, after: 80 },
    }));
    children.push(new Paragraph({
      children: [new TextRun({ text: suntoCommenti, size: 18 })],
      spacing: { after: 200 },
    }));
  }

  if (commenti?.length) {
    children.push(new Paragraph({
      children: [new TextRun({ text: 'COMMENTI ORIGINALI', bold: true, size: 20, color: GRAY })],
      spacing: { before: 80, after: 80 },
    }));
    commenti.forEach((c, i) => {
      children.push(new Paragraph({
        children: [new TextRun({ text: `[${i+1}] ${c.note?.trim() ?? ''}${c.formazione_12mesi?.trim() ? ` | Formazione: ${c.formazione_12mesi.trim()}` : ''}`, size: 18 })],
        spacing: { after: 60 },
      }));
    });
  }

  return children;
}

function tabellaCategorieStar(avgScores, surveyType) {
  const cats = surveyType === 'operator' ? CATEGORIE_OPERATOR : CATEGORIE_CLIENT;
  const W = 9360;
  const cols = [Math.round(W*0.35), Math.round(W*0.30), Math.round(W*0.20), Math.round(W*0.15)];
  const rows = [];

  rows.push(new TableRow({ tableHeader: true, children: [
    hCell('Area', cols[0]),
    hCell('Stelline', cols[1]),
    hCell('Punteggio', cols[2]),
    hCell('Giudizio', cols[3]),
  ]}));

  let rowIdx = 0;
  for (const [catLabel, keys] of Object.entries(cats)) {
    const avg = categoryAvg(keys, avgScores);
    if (avg == null) continue;
    const shade = rowIdx % 2 === 0;
    const sem = semaforo(avg);
    const stars = starsText(avg);
    rows.push(new TableRow({ children: [
      dCell(catLabel, cols[0], { shade, bold: true }),
      dCell(stars, cols[1], { shade, color: avg >= 70 ? 'FBBF24' : 'E34948' }),
      dCell(`${avg}/100`, cols[2], { shade, bold: true, color: sem.color }),
      dCell(sem.label, cols[3], { shade, color: sem.color }),
    ]}));
    rowIdx++;
  }

  return new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: cols, rows });
}

// ── DOCUMENTO DIREZIONE ────────────────────────────────────────
function buildDirezione({ facilityName, campagnaNome, dataInizio, dataFine, nRisposte, surveyType, avgScores, minScores, maxScores, udoAvgScores, commenti, suntoCommenti, radarBase64, logoImageData, logoType }) {
  const tipoLabel = surveyType === 'client' ? 'Clienti / Ospiti' : 'Staff / Operatori';
  const score = avgScores ? Math.round(Object.values(avgScores).filter(v=>v!=null).reduce((a,b)=>a+b,0)/Object.values(avgScores).filter(v=>v!=null).length) : null;
  const nSottoSoglia = avgScores ? Object.values(avgScores).filter(v => v != null && v < 75).length : 0;

  return [
    // ── PAGINA 1: FRONTESPIZIO + VALUTAZIONE ──
    ...(logoImageData ? [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new ImageRun({ data: logoImageData, type: logoType, transformation: { width: 160, height: 80 } })],
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
      { label: 'SOTTO SOGLIA', value: String(nSottoSoglia), sub: 'Domande <75' },
    ]),

    spacer(280),
    sectionTitle('Valutazione direzionale'),

    new Paragraph({ children: [new TextRun({ text: 'PUNTI DI FORZA', bold: true, size: 22, color: GREEN })], spacing: { before: 160, after: 80 } }),
    new Paragraph({ children: [new TextRun({ text: '1. ', size: 20 })], spacing: { after: 60 } }),
    editLine(),
    new Paragraph({ children: [new TextRun({ text: '2. ', size: 20 })], spacing: { after: 60 } }),
    editLine(),
    new Paragraph({ children: [new TextRun({ text: '3. ', size: 20 })], spacing: { after: 60 } }),
    editLine(),

    new Paragraph({ children: [new TextRun({ text: 'PUNTI DI DEBOLEZZA', bold: true, size: 22, color: RED })], spacing: { before: 200, after: 80 } }),
    new Paragraph({ children: [new TextRun({ text: '1. ', size: 20 })], spacing: { after: 60 } }),
    editLine(),
    new Paragraph({ children: [new TextRun({ text: '2. ', size: 20 })], spacing: { after: 60 } }),
    editLine(),
    new Paragraph({ children: [new TextRun({ text: '3. ', size: 20 })], spacing: { after: 60 } }),
    editLine(),

    new Paragraph({ children: [new TextRun({ text: 'OBIETTIVI E AZIONI PER IL PROSSIMO SEMESTRE', bold: true, size: 22, color: BLU })], spacing: { before: 200, after: 80 } }),
    editLine(), editLine(), editLine(),

    // ── PAGINA 2: RADAR + TABELLA + COMMENTI ──
    new Paragraph({ children: [new PageBreak()] }),
    sectionTitle('Mappa dimensionale e risultati per area'),

    ...(radarBase64 ? [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new ImageRun({ data: base64ToUint8Array(radarBase64), type: 'png', transformation: { width: 360, height: 280 } })],
      spacing: { before: 120, after: 200 },
    })] : []),

    tabellaRisultati(avgScores, minScores, maxScores, udoAvgScores, surveyType),

    spacer(280),
    sectionTitle('Commenti liberi'),
    ...tabellaCommentiSintesi(suntoCommenti, commenti, nRisposte),
  ];
}

// ── DOCUMENTO UTENZA ───────────────────────────────────────────
function buildUtenza({ facilityName, campagnaNome, dataInizio, dataFine, nRisposte, surveyType, avgScores, commenti, suntoCommenti, logoImageData, logoType, barreBase64, tortaNPSBase64 }) {
  const tipoLabel = surveyType === 'client' ? 'Ospiti e Famiglie' : 'Personale e Operatori';
  const nps = avgScores?.nps_consiglio;

  return [
    // ── PAGINA 1: FRONTESPIZIO + MESSAGGIO ──
    ...(logoImageData ? [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new ImageRun({ data: logoImageData, type: logoType, transformation: { width: 160, height: 80 } })],
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

    sectionTitle('I nostri punti di forza'),
    spacer(80),
    new Paragraph({ children: [new TextRun({ text: '', size: 20 })], spacing: { after: 200 } }),
    editLine(), editLine(),

    sectionTitle('Dove vogliamo migliorare'),
    spacer(80),
    new Paragraph({ children: [new TextRun({ text: '', size: 20 })], spacing: { after: 200 } }),
    editLine(), editLine(),

    sectionTitle('Le nostre azioni per il prossimo anno'),
    spacer(80),
    new Paragraph({ children: [new TextRun({ text: '', size: 20 })], spacing: { after: 200 } }),
    editLine(), editLine(),

    sectionTitle('Il nostro impegno'),
    spacer(80),
    new Paragraph({ children: [new TextRun({ text: '', size: 20 })], spacing: { after: 200 } }),
    editLine(),

    // ── PAGINA 2: GRAFICI + COMMENTI ──
    new Paragraph({ children: [new PageBreak()] }),
    sectionTitle('Come ci avete valutato'),
    spacer(120),

    new Paragraph({ children: [new TextRun({ text: 'SODDISFAZIONE PER AREA', bold: true, size: 20, color: GRAY })], spacing: { before: 80, after: 80 } }),
    ...(barreBase64 ? [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new ImageRun({ data: base64ToUint8Array(barreBase64), type: 'png', transformation: { width: 420, height: Math.max(200, Object.keys(surveyType === 'operator' ? CATEGORIE_OPERATOR : CATEGORIE_CLIENT).length * 42 + 60) } })],
      spacing: { after: 200 },
    })] : [tabellaCategorieStar(avgScores, surveyType)]),

    ...(tortaNPSBase64 ? [
      new Paragraph({ children: [new TextRun({ text: 'LA CONSIGLIERESTE?', bold: true, size: 20, color: GRAY })], spacing: { before: 80, after: 80 } }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new ImageRun({ data: base64ToUint8Array(tortaNPSBase64), type: 'png', transformation: { width: 260, height: 260 } })],
        spacing: { after: 200 },
      }),
    ] : (nps != null ? [
      new Paragraph({ children: [new TextRun({ text: 'LA CONSIGLIERESTE?', bold: true, size: 20, color: GRAY })], spacing: { before: 80, after: 80 } }),
      new Paragraph({
        children: [new TextRun({ text: `${starsText(nps)}  ${nps}/100`, size: 32, bold: true, color: nps >= 75 ? '0CA30C' : RED })],
        spacing: { after: 200 },
      }),
    ] : [])),

    sectionTitle('Cosa ci avete scritto'),
    ...tabellaCommentiSintesi(suntoCommenti, commenti, nRisposte),
  ];
}

// ── EXPORT PRINCIPALE ──────────────────────────────────────────
export async function generaReportSurveyCampagna({
  facility, supabase,
  facilityName, campagnaNome, dataInizio, dataFine, nRisposte,
  surveyType, avgScores, minScores, maxScores, udoAvgScores,
  commenti, suntoCommenti, radarBase64, barreBase64, tortaNPSBase64, target,
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

  const params = { facilityName, campagnaNome, dataInizio, dataFine, nRisposte, surveyType, avgScores, minScores, maxScores, udoAvgScores, commenti, suntoCommenti, radarBase64, barreBase64, tortaNPSBase64, logoImageData, logoType };

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
