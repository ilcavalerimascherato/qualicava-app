// src/services/haccpManualeService.js  — v6 FULL NATIVE
// ─────────────────────────────────────────────────────────────
// Genera manuale HACCP .docx interamente come struttura Word nativa.
// L'AI genera SOLO testo puro per le sezioni descrittive (niente markdown,
// niente diagrammi ASCII). Tabelle, diagrammi e struttura sono tutti nativi.
// ─────────────────────────────────────────────────────────────

import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, Header, Footer, AlignmentType, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageBreak, TabStopType, SimpleField,
} from 'docx';

import { LOGO_A_BASE64, LOGO_B_BASE64 } from './logoBase64';

// ── Colori ────────────────────────────────────────────────────
const VERDE        = '1D6F42';
const VERDE_LIGHT  = 'E8F5EE';
const GRIGIO_TESTO = '4A4A4A';
const NERO         = '1A1A1A';

// ── Misure A4 (DXA) ───────────────────────────────────────────
const PAGE_W    = 11906;
const PAGE_H    = 16838;
const MARGIN    = 1134;
const CONTENT_W = PAGE_W - MARGIN * 2;

// ── Logo ──────────────────────────────────────────────────────
function b64ToUint8Array(b64) {
  const binary = atob(b64);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
const LOGOS = {
  A: { data: () => b64ToUint8Array(LOGO_A_BASE64), type: 'jpg', w: 150, h: 75 },
  B: { data: () => b64ToUint8Array(LOGO_B_BASE64), type: 'jpg', w: 75,  h: 75 },
};

// ═══════════════════════════════════════════════════════════════
// PRIMITIVI — building blocks usati ovunque
// ═══════════════════════════════════════════════════════════════

const B  = (color = 'CCCCCC') => ({ style: BorderStyle.SINGLE, size: 1, color });
const NB = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const NOBORDER = { top: NB, bottom: NB, left: NB, right: NB };

const spacer = (n = 1) => Array.from({ length: n }, () =>
  new Paragraph({ spacing: { after: 60 }, children: [new TextRun('')] })
);

// Testo semplice
const r = (text, opts = {}) => new TextRun({
  text, font: 'Arial',
  size:   opts.size   || 22,
  bold:   opts.bold   || false,
  italic: opts.italic || false,
  color:  opts.color  || NERO,
});

// Paragrafo generico
const p = (children, opts = {}) => new Paragraph({
  alignment: opts.align || AlignmentType.LEFT,
  spacing:   { before: opts.before || 0, after: opts.after || 120, line: opts.line || 276 },
  indent:    opts.indent ? { left: opts.indent } : undefined,
  border:    opts.borderBottom ? { bottom: { style: BorderStyle.SINGLE, size: opts.borderSize || 6, color: VERDE, space: 4 } } : undefined,
  children:  Array.isArray(children) ? children : [children],
});

// Titoli
const h1 = (text) => p([r(text, { size: 28, bold: true, color: VERDE })], { before: 240, after: 160, borderBottom: true, borderSize: 8 });
const h2 = (text) => p([r(text, { size: 22, bold: true, color: VERDE })], { before: 180, after: 100 });

// Paragrafo testo corpo (con bold inline **testo**)
function txt(text, opts = {}) {
  return p(parseInline(text), { before: 0, after: 100, line: 300, ...opts });
}

// Bullet
function bullet(text) {
  return new Paragraph({
    spacing: { before: 40, after: 60, line: 290 },
    indent:  { left: 360, hanging: 240 },
    children: [
      r('•  ', { bold: true, color: VERDE }),
      ...parseInline(text),
    ],
  });
}

// Numerato
function numbered(n, text) {
  return new Paragraph({
    spacing: { before: 40, after: 60, line: 290 },
    indent:  { left: 440, hanging: 440 },
    children: [
      r(n + '.  ', { bold: true, color: VERDE }),
      ...parseInline(text),
    ],
  });
}

// Bold inline parser: "testo **grassetto** altro" → [TextRun, ...]
function parseInline(text) {
  if (!text) return [r('')];
  const parts = String(text).split(/(\*\*[^*]+\*\*)/);
  return parts.map(pt => {
    if (pt.startsWith('**') && pt.endsWith('**'))
      return r(pt.slice(2, -2), { bold: true });
    return r(pt);
  }).filter(tr => tr.text !== '');
}

// Cella tabella standard
function cell(text, w, opts = {}) {
  const fill    = opts.fill   || 'FFFFFF';
  const color   = opts.color  || GRIGIO_TESTO;
  const bold    = opts.bold   || false;
  const size    = opts.size   || 18;
  const align   = opts.align  || AlignmentType.LEFT;
  const colspan = opts.colspan || 1;
  return new TableCell({
    columnSpan: colspan,
    width: { size: w, type: WidthType.DXA },
    borders: {
      top:    B(opts.bc || 'DDDDDD'), bottom: B(opts.bc || 'DDDDDD'),
      left:   B(opts.bc || 'DDDDDD'), right:  B(opts.bc || 'DDDDDD'),
    },
    shading: { fill, type: ShadingType.CLEAR },
    margins: { top: 60, bottom: 60, left: 120, right: 100 },
    verticalAlign: VerticalAlign.CENTER,
    children: [p([r(String(text || ''), { size, bold, color })], { align, after: 0 })],
  });
}

// Cella header verde
const hCell = (t, w, cs = 1) => cell(t, w, {
  fill: VERDE, color: 'FFFFFF', bold: true, size: 18,
  align: AlignmentType.CENTER, bc: VERDE, colspan: cs,
});

// Tabella dati key/value (copertina)
function tabellaDati(righe) {
  const c0 = Math.round(CONTENT_W * 0.35);
  const c1 = CONTENT_W - c0;
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [c0, c1],
    rows: righe.map(([k, v]) => new TableRow({
      children: [
        cell(k, c0, { bold: true, color: VERDE, fill: VERDE_LIGHT, bc: 'C8E6D0' }),
        cell(v || '—', c1, { bc: 'C8E6D0' }),
      ],
    })),
  });
}

// Sezione heading row per tabelle multi-sezione
function sezRow(label, numCols, w) {
  return new TableRow({
    children: [new TableCell({
      columnSpan: numCols,
      width: { size: w, type: WidthType.DXA },
      borders: { top: B(VERDE), bottom: B(VERDE), left: B(VERDE), right: B(VERDE) },
      shading: { fill: VERDE_LIGHT, type: ShadingType.CLEAR },
      margins: { top: 60, bottom: 60, left: 160, right: 160 },
      children: [p([r(label.toUpperCase(), { size: 17, bold: true, color: VERDE })], { after: 0 })],
    })],
  });
}

// ═══════════════════════════════════════════════════════════════
// DIAGRAMMI DI FLUSSO — full native
// ═══════════════════════════════════════════════════════════════

// Colori box (stile badge)
const C = {
  teal:   { fill: 'E1F5EE', border: '0F6E56', text: '0F6E56' },
  blue:   { fill: 'E6F1FB', border: '185FA5', text: '185FA5' },
  amber:  { fill: 'FAEEDA', border: '854F0B', text: '854F0B' },
  coral:  { fill: 'FAECE7', border: '993C1D', text: '993C1D' },
  green:  { fill: 'EAF3DE', border: '3B6D11', text: '3B6D11' },
  purple: { fill: 'EEEDFE', border: '534AB7', text: '534AB7' },
  red:    { fill: 'FCEBEB', border: 'A32D2D', text: 'A32D2D' },
  gray:   { fill: 'F1EFE8', border: '5F5E5A', text: '5F5E5A' },
  dash:   { fill: 'F8F8F8', border: 'AAAAAA', text: '888888' },
};

// Box centrato con titolo e sottotitolo opzionale
function flowBox(label, sub, clr, widthPct = 0.68) {
  const bW  = Math.round(CONTENT_W * widthPct);
  const pad = Math.floor((CONTENT_W - bW) / 2);
  const rem = CONTENT_W - bW - pad;
  const children = [
    p([r(label, { size: 20, bold: true, color: clr.text })], { align: AlignmentType.CENTER, before: sub ? 80 : 120, after: sub ? 40 : 120 }),
    ...(sub ? [p([r(sub, { size: 17, italic: true, color: clr.text })], { align: AlignmentType.CENTER, before: 0, after: 100 })] : []),
  ];
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [pad, bW, rem],
    rows: [new TableRow({
      children: [
        new TableCell({ width: { size: pad, type: WidthType.DXA }, borders: NOBORDER, children: [new Paragraph({ children: [] })] }),
        new TableCell({
          width: { size: bW, type: WidthType.DXA },
          borders: { top: B(clr.border), bottom: B(clr.border), left: B(clr.border), right: B(clr.border) },
          shading: { fill: clr.fill, type: ShadingType.CLEAR },
          margins: { top: 60, bottom: 60, left: 200, right: 200 },
          children,
        }),
        new TableCell({ width: { size: rem, type: WidthType.DXA }, borders: NOBORDER, children: [new Paragraph({ children: [] })] }),
      ],
    })],
  });
}

// Riga con 2 box affiancati (biforcazione)
function flowRow2(a, b) {
  const gap = 200;
  const bW  = Math.floor((CONTENT_W - gap) / 2);
  function mkCell(item) {
    return new TableCell({
      width: { size: bW, type: WidthType.DXA },
      borders: { top: B(item.clr.border), bottom: B(item.clr.border), left: B(item.clr.border), right: B(item.clr.border) },
      shading: { fill: item.clr.fill, type: ShadingType.CLEAR },
      margins: { top: 60, bottom: 60, left: 160, right: 160 },
      children: [
        p([r(item.label, { size: 19, bold: true, color: item.clr.text })], { align: AlignmentType.CENTER, before: 80, after: item.sub ? 40 : 80 }),
        ...(item.sub ? [p([r(item.sub, { size: 16, italic: true, color: item.clr.text })], { align: AlignmentType.CENTER, before: 0, after: 80 })] : []),
      ],
    });
  }
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [bW, gap, bW],
    rows: [new TableRow({
      children: [
        mkCell(a),
        new TableCell({ width: { size: gap, type: WidthType.DXA }, borders: NOBORDER, children: [new Paragraph({ children: [] })] }),
        mkCell(b),
      ],
    })],
  });
}

// Frecce doppie affiancate
function arrowDouble() {
  const hw = Math.floor(CONTENT_W / 2);
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [hw, CONTENT_W - hw],
    rows: [new TableRow({
      children: [hw, CONTENT_W - hw].map(w => new TableCell({
        width: { size: w, type: WidthType.DXA }, borders: NOBORDER,
        children: [p([r('▼', { size: 22, bold: true, color: VERDE })], { align: AlignmentType.CENTER, before: 30, after: 30 })],
      })),
    })],
  });
}

// Freccia singola con etichetta
function arrow(label = '') {
  return p([
    ...(label ? [r(label + '  ', { size: 17, italic: true, color: '888888' })] : []),
    r('▼', { size: 22, bold: true, color: VERDE }),
  ], { align: AlignmentType.CENTER, before: 30, after: 30 });
}

// Box esterno tratteggiato (es. centro cottura esterno)
function dashedBox(label, sub) {
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [CONTENT_W],
    rows: [new TableRow({
      children: [new TableCell({
        width: { size: CONTENT_W, type: WidthType.DXA },
        borders: {
          top:    { style: BorderStyle.DASHED, size: 6, color: 'AAAAAA' },
          bottom: { style: BorderStyle.DASHED, size: 6, color: 'AAAAAA' },
          left:   { style: BorderStyle.DASHED, size: 6, color: 'AAAAAA' },
          right:  { style: BorderStyle.DASHED, size: 6, color: 'AAAAAA' },
        },
        shading: { fill: 'F8F8F8', type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 200, right: 200 },
        children: [
          p([r(label, { size: 20, bold: true, color: '888888' })], { align: AlignmentType.CENTER, after: 40 }),
          p([r(sub, { size: 17, italic: true, color: 'AAAAAA' })], { align: AlignmentType.CENTER, after: 0 }),
        ],
      })],
    })],
  });
}

// ── 5.1 Flusso generale pasti caldi (Pranzo) ─────────────────
function diagramma51() {
  return [
    h2('5.1 Flusso Generale — Pasti Caldi (Pranzo)'),
    ...spacer(1),
    dashedBox('Centro cottura esterno (Sodexo SpA)', 'Non gestito dalla struttura · SCIA esterna · Reg. CE 852/2004'),
    arrow('Contenitori isotermici'),
    flowBox('Ricevimento contenitori isotermici pranzo (CCP1)', 'Verifica T° ≥65°C · Integrità confezione · Etichetta · Allergeni', C.teal),
    arrow(),
    flowBox('Stoccaggio brevissimo in scaldavivande di nucleo', 'T° ≥60°C · Max 15 min', C.amber),
    arrow(),
    flowBox('Porzionamento in vassoi identificati', 'Celiaci per primi · Verifica allergeni · Nominativo', C.gray),
    arrow(),
    flowBox('Trasporto con carrello termico', 'Scomparto caldo ≥65°C · Max 20 min', C.teal),
    arrow(),
    flowBox('Distribuzione agli ospiti', 'Verifica nominativo · Doppio controllo dieta', C.green),
    arrow(),
    flowBox('Raccolta vassoi e smaltimento umido', 'Gastronorm usate → bidone pedale cucinetta', C.gray),
    arrow(),
    flowBox('Lavaggio stoviglie ≥80°C e sanificazione', null, C.gray),
    ...spacer(1),
  ];
}

// ── 5.2 Flusso pasti abbattuti (Cena) ────────────────────────
function diagramma52() {
  return [
    h2('5.2 Flusso Pasti Abbattuti — Cena'),
    ...spacer(1),
    dashedBox('Centro cottura esterno (Sodexo SpA)', 'Abbattimento e confezionamento pasti cena'),
    arrow('Contenitori isotermici freddi'),
    flowBox('Ricevimento teglie abbattute (CCP1)', 'Verifica T° ≤4°C · Integrità etichetta · FIFO', C.blue),
    arrow(),
    flowBox('Stoccaggio frigorifero di nucleo FR1-FR4', 'T° ≤4°C · Isolate da altri alimenti · Fino alle 17:30', C.blue),
    arrow('Ore 17:30 — 1h prima cena'),
    flowBox('Riattivazione (CCP2)', 'Forno ≥75°C al cuore · Microonde ≥75°C al cuore · Sonda termometrica', C.coral),
    arrow(),
    flowBox('Porzionamento e identificazione vassoi', 'Nominativo · Allergeni · Celiaci per primi', C.gray),
    arrow(),
    flowBox('Trasporto carrello termico ≥65°C', 'Max 20 min', C.teal),
    arrow(),
    flowBox('Distribuzione e verifica nominativo', null, C.green),
    arrow(),
    flowBox('Raccolta vassoi e lavaggio stoviglie ≥80°C', null, C.gray),
    ...spacer(1),
  ];
}

// ── 5.3 Flusso pasti disfagici (Nucleo AS) ───────────────────
function diagramma53() {
  return [
    h2('5.3 Flusso Pasti Disfagici — Nucleo AS'),
    ...spacer(1),
    flowBox('Ricevimento pasto disfagico abbattuto da Sodexo', 'Teglione separato · T° ≤4°C · Verifica IDDSI level dichiarato', C.blue),
    arrow(),
    flowBox('Identificazione nominativa ospite', 'Nome · Data ricezione · Consistenza IDDSI (L3/L4/L5/L6) · Scadenza', C.purple),
    arrow(),
    flowBox('Stoccaggio frigorifero FD — piano interrato', 'Nucleo AS · Contenitore separato "DISFAGICI" · ≤4°C', C.blue),
    arrow('~30 min prima cena'),
    flowBox('Riattivazione (CCP2) — gastronorm dedicata', 'Microonde · Stessa scaldavivande dei pasti Sodexo · Gastronorm identificata', C.coral),
    arrow(),
    flowBox('Verifica T° ≥75°C al cuore', 'Sonda sterile · Se <75°C → riscaldamento supplementare', C.amber),
    arrow(),
    flowBox('Mantenimento T° ≥65°C in scaldavivande', 'Max 30 min prima distribuzione', C.coral),
    arrow(),
    flowBox('Somministrazione — doppio controllo', 'Nominativo · IDDSI level = prescrizione · Operatore OSA autorizzato', C.green),
    arrow(),
    flowBox('Registrazione distribuzione', 'Nome · Data/ora · Consistenza IDDSI · Firma operatore', C.gray),
    ...spacer(1),
  ];
}

// ── 5.4 Flusso pasti celiaci ─────────────────────────────────
function diagramma54() {
  return [
    h2('5.4 Flusso Pasti Celiaci — Tutti i Nuclei'),
    ...spacer(1),
    flowBox('Ricevimento pasto Gluten-Free certificato da Sodexo', 'Contenitore etichettato "GLUTEN-FREE" + nominativo ospite', C.teal),
    arrow(),
    flowBox('Stoccaggio frigorifero nucleo — ripiano superiore', 'Contenitore identificato "CELIACO – [NOME]" · Segregato da altri alimenti', C.teal),
    arrow(),
    flowBox('Riattivazione (se abbattuto)', 'Gastronorm dedicata "GF" · ≥75°C al cuore', C.amber),
    arrow(),
    flowBox('Porzionamento su vassoio BLU dedicato "CELIACO"', 'Piano sanificato · Guanti nuovi · Utensili esclusivi GF', C.amber),
    arrow('Regola assoluta'),
    flowBox('Servito PER PRIMO nel nucleo — prima di tutti gli altri ospiti', 'Previene contaminazione incrociata da briciole', C.green),
    arrow(),
    flowBox('Lavaggio stoviglie GF — ciclo separato ≥80°C', 'Cesto dedicato · Armadio stoviglie "CELIACI"', C.gray),
    ...spacer(1),
  ];
}

// ── 5.5 Flusso isolamento infettivo ──────────────────────────
function diagramma55() {
  return [
    h2('5.5 Flusso Isolamento Infettivo — Vassoio Monouso'),
    ...spacer(1),
    flowBox('Notifica isolamento da Infermiere/Medico', 'Modulo "Avviso Isolamento Infettivo" · Cucinetta + bacheca + email', C.red),
    arrow(),
    flowRow2(
      { label: 'Magazzino: scorta monouso ≥5gg', sub: 'Vassoi, piatti, posate, contenitori rossi biohazard', clr: C.amber },
      { label: 'ASA/OSS: indossa DPI', sub: 'Guanti nitrile nuovi · Mascherina · Grembiule monouso', clr: C.red }
    ),
    arrowDouble(),
    flowBox('Porzionamento pasto ULTIMO (dopo tutti gli altri ospiti)', 'Vassoio monouso bianco · Stoviglie monouso · Coperchio sigillo', C.amber),
    arrow(),
    flowBox('Identificazione vassoio "ISOLAMENTO INFETTIVO"', 'Nome ospite · Stanza · Ora preparazione', C.red),
    arrow(),
    flowBox('Consegna in stanza — cambio guanti prima ingresso', 'Nessun contatto con stoviglie riutilizzabili', C.red),
    arrow(),
    flowBox('Raccolta vassoio con DPI · Sacchetto "BIOHAZARD"', 'Mai misto a rifiuti ordinari', C.red),
    arrow(),
    flowRow2(
      { label: 'Smaltimento rifiuti speciali', sub: 'Ditta autorizzata · Registrazione', clr: C.amber },
      { label: 'Sanificazione stanza', sub: 'Cloro 0,5% · 10 min contatto · Cambio DPI', clr: C.gray }
    ),
    arrowDouble(),
    flowBox('Registrazione e verifica R-HACCP', 'Modulo completato · Firma · Archiviazione', C.green),
    ...spacer(1),
  ];
}

// ═══════════════════════════════════════════════════════════════
// SEZIONE 6 — Tabella analisi pericoli CCP
// ═══════════════════════════════════════════════════════════════

function tabellaCCP() {
  const W  = CONTENT_W;
  const c0 = Math.round(W * 0.13);
  const c1 = Math.round(W * 0.20);
  const c2 = Math.round(W * 0.05);
  const c3 = Math.round(W * 0.21);
  const c4 = Math.round(W * 0.21);
  const c5 = W - c0 - c1 - c2 - c3 - c4;
  const cols = [c0, c1, c2, c3, c4, c5];

  function badge(text, fill, color, w) {
    return new TableCell({
      width: { size: w, type: WidthType.DXA },
      borders: { top: B('DDDDDD'), bottom: B('DDDDDD'), left: B('DDDDDD'), right: B('DDDDDD') },
      shading: { fill, type: ShadingType.CLEAR },
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      verticalAlign: VerticalAlign.CENTER,
      children: [p([r(text, { size: 17, bold: true, color })], { align: AlignmentType.CENTER, after: 0 })],
    });
  }

  function dc(text, w) {
    return new TableCell({
      width: { size: w, type: WidthType.DXA },
      borders: { top: B('DDDDDD'), bottom: B('DDDDDD'), left: B('DDDDDD'), right: B('DDDDDD') },
      shading: { fill: 'FFFFFF', type: ShadingType.CLEAR },
      margins: { top: 60, bottom: 60, left: 120, right: 100 },
      verticalAlign: VerticalAlign.CENTER,
      children: [p(parseInline(text), { after: 0 })],
    });
  }

  function row(fase, pericolo, tipo, misure, monitoraggio, esito) {
    const tf = tipo === 'B' ? ['FCEBEB','A32D2D'] : tipo === 'C' ? ['E6F1FB','185FA5'] : ['F1EFE8','5F5E5A'];
    const ef = esito.startsWith('CCP') ? ['E1F5EE','0F6E56'] : ['FAEEDA','854F0B'];
    return new TableRow({ children: [dc(fase,c0), dc(pericolo,c1), badge(tipo,tf[0],tf[1],c2), dc(misure,c3), dc(monitoraggio,c4), badge(esito,ef[0],ef[1],c5)] });
  }

  const header = new TableRow({ tableHeader: true, children: [hCell('Fase',c0), hCell('Pericolo',c1), hCell('Tipo',c2), hCell('Misure preventive',c3), hCell('Monitoraggio',c4), hCell('Esito',c5)] });

  return new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: cols,
    rows: [
      header,
      sezRow('Ricevimento pasti caldi (pranzo)', 6, W),
      row('Ricevimento','Temperatura inadeguata <65°C','B','Fornitura min ≥65°C; ispezione visiva','Misurazione T° (2 punti); Modulo CCP1','CCP1'),
      row('','Allergeni non dichiarati','C','SCIA Sodexo con dichiarazione allergeni','Controllo etichetta 100% celiaci','PCC'),
      row('','Danni/perdite contenitori','F','Controllo integrità; reso merce danneggiata','Ispezione visiva 100%; modulo anomalia','PCC'),
      sezRow('Ricevimento pasti abbattuti (cena)', 6, W),
      row('Ricevimento','Temperatura inadeguata >4°C','B','Fornitura max ≤4°C; verifica T° ricevimento','Misurazione T° (2 punti); Modulo CCP1','CCP1'),
      row('','Rottura catena freddo','B','Ispezione confezione; trasporto ≤40 min','Controllo sigilli; orario ricezione','PCC'),
      sezRow('Stoccaggio', 6, W),
      row('Stoccaggio caldo','T° abbassamento <60°C','B','Manutenzione scaldavivande; max 15 min','Verifica T° scaldavivande ogni mattina','PCC'),
      row('Stoccaggio freddo','T° innalzamento >4°C','B','Taratura termometro annuale; manutenzione','Lettura 2×/die (8:00, 18:00); Modulo Frigo','PCC'),
      row('','Cross-contaminazione celiaci/disfagici','C','Ripiani dedicati; etichette; sanificazione','Ispezione visiva settimanale ripiani','PCC'),
      sezRow('Riattivazione pasti abbattuti', 6, W),
      row('Riattivazione','T° insufficiente <75°C al cuore','B','Forni calibrati; istruzioni per gastronorm','Sonda al cuore 100% riattivazioni; Modulo CCP2','CCP2'),
      row('','Tempo riscaldamento >30 min','B','Procedure scritte; coordinamento distribuzione','Registrazione ora fine cottura / inizio distrib.','PCC'),
      row('','Riattivazione multipla (>1)','B','Max 1 riattivazione; istruzioni operative','Registrazione n° riattivazioni; smaltire se >1','PCC'),
      sezRow('Porzionamento', 6, W),
      row('Porzionamento','Identificazione errata dieta/ospite','C','Etichette chiare; identificazione nominativa','Verifica etichetta 100%; registrazione distrib.','PCC'),
      row('','Contaminazione crociata allergeni','C','Utensili dedicati celiaci; lavaggio mani','Ispezione aree porzionamento; formazione','PCC'),
      sezRow('Distribuzione e somministrazione', 6, W),
      row('Distribuzione','T° non mantenuta caldo <65°C','B','Carrello isolato; trasporto max 20 min','T° al caricamento/scaricamento; Modulo Carrello','PCC'),
      row('Somministrazione','Pasto allergizzante a celiaco','C','Verifica nominativo + tipologia; doppio ctrl','Registrazione con firma operatore','PCC'),
      row('Isolamento','Trasmissione patogeno infettivo','B','DPI obbligatori; vassoio monouso','Verifica DPI; registrazione isolamento','PCC'),
      sezRow('Raccolta e lavaggio', 6, W),
      row('Raccolta','Contaminazione da rifiuti','B','DPI (guanti, grembiule); lavaggio mani','Controllo uso DPI; formazione continua','PCC'),
      row('Isolamento','Rifiuti speciali non separati','B','Sacchetti "BIOHAZARD"; smaltimento giornaliero','Ispezione sacchetti; registrazione','PCC'),
    ],
  });
}

// ═══════════════════════════════════════════════════════════════
// SEZIONE 4 — Tabella apparecchiature
// ═══════════════════════════════════════════════════════════════

function tabellaApparecchiature(righe) {
  const c0 = Math.round(CONTENT_W * 0.12);
  const c1 = Math.round(CONTENT_W * 0.22);
  const c2 = Math.round(CONTENT_W * 0.22);
  const c3 = Math.round(CONTENT_W * 0.22);
  const c4 = CONTENT_W - c0 - c1 - c2 - c3;
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [c0, c1, c2, c3, c4],
    rows: [
      new TableRow({ tableHeader: true, children: [hCell('ID',c0), hCell('Ubicazione',c1), hCell('Tipo',c2), hCell('Parametro',c3), hCell('Note',c4)] }),
      ...righe.map(r => new TableRow({ children: [
        cell(r[0],c0,{bold:true,color:VERDE,fill:VERDE_LIGHT}),
        cell(r[1],c1), cell(r[2],c2), cell(r[3],c3), cell(r[4]||'',c4),
      ]})),
    ],
  });
}

// ═══════════════════════════════════════════════════════════════
// SEZIONE 10 — Piano analisi microbiologiche
// ═══════════════════════════════════════════════════════════════

function tabellaMicrobiologiche() {
  const c0 = Math.round(CONTENT_W * 0.14);
  const c1 = Math.round(CONTENT_W * 0.16);
  const c2 = Math.round(CONTENT_W * 0.14);
  const c3 = Math.round(CONTENT_W * 0.14);
  const c4 = Math.round(CONTENT_W * 0.22);
  const c5 = CONTENT_W - c0 - c1 - c2 - c3 - c4;
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [c0, c1, c2, c3, c4, c5],
    rows: [
      new TableRow({ tableHeader: true, children: [hCell('Campione',c0), hCell('Punto prelievo',c1), hCell('Frequenza',c2), hCell('Parametri',c3), hCell('Limiti accettabilità',c4), hCell('Azione correttiva',c5)] }),
      ...[
        ['Pasto caldo (pranzo)', 'Scaldavivande nucleo', 'Trimestrale', 'CBT, Enterobatteri, Listeria', 'CBT <10⁵ UFC/g; Listeria assente', 'Blocco distribuzione; NC al fornitore'],
        ['Pasto abbattuto (cena)', 'Frigorifero nucleo', 'Trimestrale', 'CBT, Salmonella, Listeria', 'Salmonella assente/25g; Listeria <100 UFC/g', 'Eliminazione lotto; verifica catena freddo'],
        ['Pasto disfagico', 'Frigorifero FD', 'Semestrale', 'CBT, Listeria, Stafilococco', 'CBT <10⁴ UFC/g; Listeria assente', 'Blocco; ricerca non conformità'],
        ['Superfici piani lavoro', 'Cucinette nuclei', 'Semestrale', 'Enterobatteri, Listeria', 'Enterobatteri <10 UFC/cm²', 'Sanificazione straordinaria; verifica procedure'],
        ['Mani operatore', 'Post-igiene mani', 'Annuale', 'CBT, Stafilococco', 'CBT <100 UFC/mani', 'Formazione rinforzo; verifica procedura lavaggio'],
        ['Acqua potabile', 'Erogatori nuclei', 'Annuale', 'E. coli, Enterococchi, CBT', 'Conforme D.Lgs 31/2001', 'Comunicazione a gestore acquedotto'],
      ].map(r => new TableRow({ children: r.map((v, i) => cell(v, [c0,c1,c2,c3,c4,c5][i])) })),
    ],
  });
}

// ═══════════════════════════════════════════════════════════════
// SEZIONE 11 — Piano formazione
// ═══════════════════════════════════════════════════════════════

function tabellaFormazione() {
  const c0 = Math.round(CONTENT_W * 0.25);
  const c1 = Math.round(CONTENT_W * 0.12);
  const c2 = Math.round(CONTENT_W * 0.12);
  const c3 = Math.round(CONTENT_W * 0.22);
  const c4 = CONTENT_W - c0 - c1 - c2 - c3;
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [c0, c1, c2, c3, c4],
    rows: [
      new TableRow({ tableHeader: true, children: [hCell('Corso / Argomento',c0), hCell('Freq.',c1), hCell('Durata',c2), hCell('Destinatari',c3), hCell('Documentazione',c4)] }),
      ...[
        ['HACCP base — igiene e sicurezza alimentare', 'All\'assunzione', '4h', 'Tutti gli ASA/OSS', 'Registro presenza + test valutazione'],
        ['Aggiornamento HACCP annuale', 'Annuale', '2h', 'Tutti gli ASA/OSS', 'Registro presenza + firma'],
        ['Gestione ospiti celiaci e allergeni', 'Biennale', '2h', 'ASA/OSS distribuzione', 'Scheda formazione individuale'],
        ['Gestione ospiti disfagici (IDDSI)', 'Biennale', '3h', 'ASA/OSS nucleo AS', 'Attestato + scheda IDDSI firmata'],
        ['Isolamento infettivo — DPI e procedure', 'Annuale', '1h', 'Tutti gli ASA/OSS', 'Modulo presa visione procedura'],
        ['Uso corretto termometro e registrazioni', 'All\'assunzione + annuale', '1h', 'ASA/OSS incaricati', 'Verifica pratica + firma'],
        ['Sanificazione locali e attrezzature', 'Annuale', '2h', 'ASA/OSS cucinette', 'Piano sanificazione firmato'],
      ].map(r => new TableRow({ children: r.map((v, i) => cell(v, [c0,c1,c2,c3,c4][i])) })),
    ],
  });
}

// ═══════════════════════════════════════════════════════════════
// SEZIONE 12 — Manutenzione e taratura
// ═══════════════════════════════════════════════════════════════

function tabellaManutenzione() {
  const c0 = Math.round(CONTENT_W * 0.20);
  const c1 = Math.round(CONTENT_W * 0.14);
  const c2 = Math.round(CONTENT_W * 0.12);
  const c3 = Math.round(CONTENT_W * 0.14);
  const c4 = Math.round(CONTENT_W * 0.20);
  const c5 = CONTENT_W - c0 - c1 - c2 - c3 - c4;
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [c0, c1, c2, c3, c4, c5],
    rows: [
      new TableRow({ tableHeader: true, children: [hCell('Attrezzatura',c0), hCell('Attività',c1), hCell('Freq.',c2), hCell('Responsabile',c3), hCell('Registrazione',c4), hCell('Tolleranza',c5)] }),
      ...[
        ['Frigoriferi FR1-FR4, FD', 'Verifica T° con sonda esterna', 'Giornaliera', 'ASA incaricato', 'Modulo temperatura frigo', '±1°C vs display'],
        ['Frigoriferi FR1-FR4, FD', 'Pulizia interna + gasket', 'Mensile', 'ASA incaricato', 'Piano sanificazione', '—'],
        ['Frigoriferi FR1-FR4, FD', 'Manutenzione tecnica + taratura', 'Annuale', 'Ditta esterna', 'Rapporto tecnico', '±1°C (0-4°C)'],
        ['Termometri a sonda', 'Taratura vs riferimento', 'Annuale', 'R-HACCP', 'Certificato taratura', '±0,5°C'],
        ['Scaldavivande nuclei', 'Verifica T° mantenimento', 'Giornaliera', 'ASA incaricato', 'Modulo scaldavivande', 'Min 60°C'],
        ['Scaldavivande nuclei', 'Pulizia interna', 'Settimanale', 'ASA incaricato', 'Piano sanificazione', '—'],
        ['Forno riattivazione', 'Verifica funzionamento + pulizia', 'Settimanale', 'ASA incaricato', 'Piano sanificazione', '—'],
        ['Forno riattivazione', 'Taratura temperatura', 'Annuale', 'Ditta esterna', 'Rapporto tecnico', '±5°C'],
        ['Lavastoviglie', 'Verifica T° ciclo lavaggio', 'Mensile', 'ASA incaricato', 'Registro manutenzione', 'Min 80°C'],
        ['Carrello termico', 'Pulizia + verifica isolamento', 'Settimanale', 'ASA incaricato', 'Piano sanificazione', '—'],
      ].map(r => new TableRow({ children: r.map((v, i) => cell(v, [c0,c1,c2,c3,c4,c5][i])) })),
    ],
  });
}

// ═══════════════════════════════════════════════════════════════
// SEZIONE 3 — Tabella ruoli e responsabilità
// ═══════════════════════════════════════════════════════════════

function tabellaRuoli(lr, rHaccp, teamHaccp) {
  const c0 = Math.round(CONTENT_W * 0.22);
  const c1 = Math.round(CONTENT_W * 0.20);
  const c2 = CONTENT_W - c0 - c1;
  const righeTeam = (teamHaccp || []).filter(m => m.ruolo).map(m => [
    m.ruolo, m.nome || '—',
    'Applicazione procedure HACCP in cucinetta; compilazione moduli; segnalazione anomalie',
  ]);
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [c0, c1, c2],
    rows: [
      new TableRow({ tableHeader: true, children: [hCell('Ruolo',c0), hCell('Nominativo',c1), hCell('Responsabilità principali',c2)] }),
      new TableRow({ children: [cell('Legale Rappresentante',c0,{bold:true,color:VERDE,fill:VERDE_LIGHT}), cell(lr||'—',c1), cell('Responsabilità legale del sistema HACCP; approvazione manuale; decisioni di alto livello',c2)] }),
      new TableRow({ children: [cell('Responsabile HACCP',c0,{bold:true,color:VERDE,fill:VERDE_LIGHT}), cell(rHaccp||'—',c1), cell('Redazione e aggiornamento manuale; formazione personale; gestione non conformità; verifiche periodiche; rapporti con ASL',c2)] }),
      ...righeTeam.map(r => new TableRow({ children: [cell(r[0],c0,{fill:VERDE_LIGHT}), cell(r[1],c1), cell(r[2],c2)] })),
    ],
  });
}

// ═══════════════════════════════════════════════════════════════
// REGISTRO REVISIONI — copertina (ultime 3)
// ═══════════════════════════════════════════════════════════════

function tabellaRevisioniCopertina(numRev, dataRev, redattore, noteRev, lr, revStorico = []) {
  const c0 = 580;
  const c1 = 1300;
  const c2 = 1700;
  const c3 = CONTENT_W - c0 - c1 - c2 - 1400;
  const c4 = 1400;

  // Ultime 3 revisioni: storico + corrente, poi prendi le ultime 3
  const tutte = [
    ...revStorico.map(s => ({ rev: String(s.rev), data: s.data || '—', note: s.note || '—', red: redattore, app: lr || '—' })),
    { rev: String(numRev), data: dataRev, note: noteRev || 'Prima emissione', red: redattore, app: lr || '—' },
  ];
  const ultime3 = tutte.slice(-3);

  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [c0, c1, c2, c3, c4],
    rows: [
      new TableRow({ children: [hCell('Rev.',c0), hCell('Data',c1), hCell('Redatto da',c2), hCell('Descrizione',c3), hCell('Approvato',c4)] }),
      ...ultime3.map(rv => new TableRow({
        height: { value: 480, rule: 'exact' },
        children: [
          cell(rv.rev,  c0, { align: AlignmentType.CENTER }),
          cell(rv.data, c1),
          cell(rv.red,  c2),
          cell(rv.note, c3),
          cell(rv.app,  c4),
        ],
      })),
      // Righe vuote per completare fino a 3 righe se mancano
      ...Array.from({ length: Math.max(0, 3 - ultime3.length) }, () =>
        new TableRow({ height: { value: 480, rule: 'exact' }, children: [c0,c1,c2,c3,c4].map(w => cell('',w)) })
      ),
    ],
  });
}

// ═══════════════════════════════════════════════════════════════
// INDICE — costruito staticamente (struttura fissa del manuale)
// ═══════════════════════════════════════════════════════════════

function indice() {
  const voci = [
    { l:1, n:'1', t:'Introduzione' },
    { l:2, n:'', t:'1.1 Scopo del manuale' },
    { l:2, n:'', t:'1.2 Campo di applicazione' },
    { l:2, n:'', t:'1.3 Normativa di riferimento' },
    { l:1, n:'2', t:'Prerequisiti e Buone Pratiche Igieniche (GHP)' },
    { l:2, n:'', t:'2.1 Igiene del personale' },
    { l:2, n:'', t:'2.2 Pulizia e sanificazione locali' },
    { l:2, n:'', t:'2.3 Controllo infestanti' },
    { l:2, n:'', t:'2.4 Smaltimento rifiuti' },
    { l:1, n:'3', t:'Organizzazione e Responsabilità' },
    { l:2, n:'', t:'3.1 Organigramma HACCP' },
    { l:2, n:'', t:'3.2 Ruoli e responsabilità' },
    { l:1, n:'4', t:'Descrizione della Struttura e Locali' },
    { l:2, n:'', t:'4.1 Anagrafica struttura' },
    { l:2, n:'', t:'4.2 Layout nuclei e locali' },
    { l:2, n:'', t:'4.3 Apparecchiature in gestione OSA' },
    { l:2, n:'', t:'4.4 Orari di servizio e distribuzione' },
    { l:1, n:'5', t:'Diagrammi di Flusso' },
    { l:2, n:'', t:'5.1 Flusso generale pasti caldi (Pranzo)' },
    { l:2, n:'', t:'5.2 Flusso pasti abbattuti (Cena)' },
    { l:2, n:'', t:'5.3 Flusso pasti disfagici (Nucleo AS)' },
    { l:2, n:'', t:'5.4 Flusso pasti celiaci (Tutti i nuclei)' },
    { l:2, n:'', t:'5.5 Flusso isolamento infettivo' },
    { l:1, n:'6', t:'Analisi Pericoli e Identificazione CCP' },
    { l:2, n:'', t:'6.1 Metodologia HACCP e albero decisionale' },
    { l:2, n:'', t:'6.2 Matrice analisi pericoli per fase' },
    { l:2, n:'', t:'6.3 Schede CCP1 e CCP2 — Limiti critici e azioni correttive' },
    { l:1, n:'7', t:'Gestione Celiachia e Allergeni' },
    { l:2, n:'', t:'7.1 Normativa e responsabilità' },
    { l:2, n:'', t:'7.2 Registro ospiti celiaci e allergici' },
    { l:2, n:'', t:'7.3 Ricezione pasti celiaci e stoccaggio' },
    { l:2, n:'', t:'7.4 Procedura d\'Oro — servizio celiaci' },
    { l:2, n:'', t:'7.5 Gestione contaminazione incrociata' },
    { l:2, n:'', t:'7.6 Allergeni diversi da celiachia' },
    { l:1, n:'8', t:'Gestione Ospiti Disfagici' },
    { l:2, n:'', t:'8.1 Classificazione IDDSI' },
    { l:2, n:'', t:'8.2 Ricezione e stoccaggio pasti disfagici' },
    { l:2, n:'', t:'8.3 Riattivazione e identificazione' },
    { l:2, n:'', t:'8.4 Distribuzione e somministrazione' },
    { l:2, n:'', t:'8.5 Documentazione e modifiche IDDSI level' },
    { l:1, n:'9', t:'Gestione Isolamento Infettivo' },
    { l:2, n:'', t:'9.1 Protocollo e notifica' },
    { l:2, n:'', t:'9.2 Approvvigionamento monouso' },
    { l:2, n:'', t:'9.3 Preparazione e consegna pasto' },
    { l:2, n:'', t:'9.4 Smaltimento e sanificazione' },
    { l:1, n:'10', t:'Piano Analisi Microbiologiche' },
    { l:1, n:'11', t:'Piano di Formazione del Personale' },
    { l:1, n:'12', t:'Manutenzione e Taratura Attrezzature' },
  ];

  return voci.map(v => {
    if (v.l === 1) {
      return new Paragraph({
        spacing: { before: 180, after: 60 },
        children: [
          r(v.n + '.  ', { size: 22, bold: true, color: VERDE }),
          r(v.t, { size: 22, bold: true, color: NERO }),
        ],
      });
    }
    return new Paragraph({
      spacing: { before: 30, after: 30 },
      indent: { left: 360 },
      children: [
        r('— ', { size: 19, color: VERDE }),
        r(v.t, { size: 19, color: GRIGIO_TESTO }),
      ],
    });
  });
}

// ═══════════════════════════════════════════════════════════════
// PARAGRAFI TESTO — costruiti da testo AI puro (niente markdown)
// ═══════════════════════════════════════════════════════════════

// Converte blocco di testo puro in array di Paragraph docx
// Riconosce: righe vuote (spacer), bullet (•/-), numerati (1.), tutto il resto = paragrafo
function textToParagraphs(rawText) {
  if (!rawText) return [];
  const result = [];
  const lines  = String(rawText).split('\n');
  for (const line of lines) {
    const t = line.trim();
    if (!t) { result.push(spacer(1)[0]); continue; }
    if (/^[•-]\s+/.test(t))        { result.push(bullet(t.replace(/^[•-]\s+/, ''))); continue; }
    if (/^\d+[.)]\s+/.test(t))      { const m = t.match(/^(\d+)[.)]\s+(.*)/); result.push(numbered(m[1], m[2])); continue; }
    if (/^#{1,3}\s/.test(t))        { continue; } // salta eventuali titoli markdown residui
    result.push(txt(t));
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════
// GENERATORE PRINCIPALE
// ═══════════════════════════════════════════════════════════════

export async function generaManualeHaccp(params) {
  const {
    nomestruttura    = '[STRUTTURA]',
    osa              = '[OSA]',
    pivaOsa          = '—',
    modello          = 'distribuzione_veicolata',
    lr               = '—',
    rHaccp           = '—',
    teamHaccp        = [],
    numRev           = '1',
    versioneInterna  = 0,
    dataRev          = new Date().toLocaleDateString('it-IT'),
    redattore        = 'Ufficio Qualità OVER',
    noteRevisione    = 'Prima emissione',
    revStorico       = [],
    testoManuale     = '',   // testo AI puro, senza markdown strutturale
    logoVariante     = 'A',
    // Dati sezioni specifiche (opzionali — se non passati usa testo generico)
    orariServizio              = '',
    layoutStruttura            = '',
  } = params;

  const logoCfg  = LOGOS[logoVariante] || LOGOS.A;
  const logoData = logoCfg.data();
  const revLabel = versioneInterna > 0 ? `${numRev}_${versioneInterna}` : numRev;

  // ── HEADER ────────────────────────────────────────────────────
  const header = new Header({
    children: [new Paragraph({
      border:   { bottom: { style: BorderStyle.SINGLE, size: 6, color: VERDE, space: 4 } },
      spacing:  { after: 100 },
      children: [
        new ImageRun({ data: logoData, transformation: { width: Math.round(logoCfg.w * 0.6), height: Math.round(logoCfg.h * 0.6) }, type: logoCfg.type }),
        r('   MANUALE HACCP — ' + nomestruttura.toUpperCase(), { size: 16, color: VERDE, bold: true }),
      ],
    })],
  });

  // ── FOOTER ────────────────────────────────────────────────────
  const footer = new Footer({
    children: [new Paragraph({
      tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W }],
      border:   { top: { style: BorderStyle.SINGLE, size: 4, color: VERDE, space: 4 } },
      spacing:  { before: 80 },
      children: [
        r(nomestruttura, { size: 18, color: GRIGIO_TESTO }),
        new TextRun({ text: '\t', size: 18 }),
        r('Rev. ', { size: 18, color: GRIGIO_TESTO }),
        r(revLabel, { size: 18, color: VERDE, bold: true }),
        r('   Pagina ', { size: 18, color: GRIGIO_TESTO }),
        new SimpleField('PAGE',     r('', { size: 18 })),
        r(' di ', { size: 18, color: GRIGIO_TESTO }),
        new SimpleField('NUMPAGES', r('', { size: 18 })),
      ],
    })],
  });

  // ── COPERTINA (PAG 1) ─────────────────────────────────────────
  // Logo + titolo + dati struttura + registro revisioni (ultime 3) in una pagina
  const teamRighe = (teamHaccp || []).filter(m => m.ruolo).map(m => [m.ruolo, m.nome || '—']);

  const copertina = [
    // Logo
    new Paragraph({ spacing: { after: 0 }, children: [new ImageRun({ data: logoData, transformation: { width: logoCfg.w, height: logoCfg.h }, type: logoCfg.type })] }),
    ...spacer(1),
    p([r('')], { borderBottom: true, borderSize: 14, after: 80 }),
    ...spacer(1),
    p([r('MANUALE HACCP', { size: 52, bold: true, color: VERDE })], { align: AlignmentType.LEFT, after: 50 }),
    p([r('Sistema di Autocontrollo Alimentare', { size: 26, italic: true, color: VERDE })], { after: 30 }),
    p([r('Reg. CE 852/2004 — D.Lgs 27/2021 — Reg. UE 2021/382', { size: 17, color: '888888' })], { after: 0 }),
    ...spacer(1),
    // Dati struttura
    tabellaDati([
      ['Struttura',            nomestruttura],
      ['Ragione sociale OSA',  osa],
      ['P.IVA OSA',            pivaOsa],
      ['Modello ristorazione', modello],
      ['Legale Rappresentante',lr],
      ['Responsabile HACCP',   rHaccp],
      ...teamRighe,
      ['N° Revisione',         revLabel],
      ['Data emissione',       dataRev],
      ['Prossima revisione',   (() => {
        try {
          const pts = dataRev.split('/');
          if (pts.length === 3) return pts[0] + '/' + pts[1] + '/' + (parseInt(pts[2]) + 3);
          const d = new Date(dataRev); d.setFullYear(d.getFullYear() + 3);
          return d.toLocaleDateString('it-IT');
        } catch { return '—'; }
      })()],
      ['Redatto da',           redattore],
    ]),
    ...spacer(1),
    // Registro revisioni — ultime 3 — sulla copertina
    p([r('REGISTRO REVISIONI', { size: 20, bold: true, color: VERDE })], { borderBottom: true, borderSize: 6, after: 100 }),
    tabellaRevisioniCopertina(numRev, dataRev, redattore, noteRevisione, lr, revStorico),
    ...spacer(1),
    p([r('I dati personali raccolti verranno trattati ai sensi del Reg. UE 679/2016 (GDPR).', { size: 15, italic: true, color: '999999' })]),
    new Paragraph({ children: [new PageBreak()] }),
  ];

  // ── INDICE (PAG 2) ────────────────────────────────────────────
  const paginaIndice = [
    p([r('INDICE DEL MANUALE', { size: 28, bold: true, color: VERDE })], { borderBottom: true, borderSize: 8, after: 200 }),
    ...indice(),
    new Paragraph({ children: [new PageBreak()] }),
  ];

  // ── Estrai blocchi testo AI per sezione ───────────────────────
  // Il testo AI è diviso da marcatori "===SEZ_N===" oppure usiamo fallback generico
  function extractSez(testo, n) {
    const re = new RegExp(`===SEZ_${n}===([\\s\\S]*?)(?:===SEZ_\\d+===|$)`, 'i');
    const m  = String(testo).match(re);
    return m ? m[1].trim() : '';
  }

  // ── CORPO ─────────────────────────────────────────────────────
  const corpo = [

    // ── SEZ 1: Introduzione ──────────────────────────────────
    h1('1. INTRODUZIONE'),
    h2('1.1 Scopo del Manuale'),
    ...textToParagraphs(extractSez(testoManuale, 1) || [
      'Il presente Manuale HACCP è lo strumento operativo di gestione della sicurezza alimentare della struttura ' + nomestruttura + ', redatto in conformità al Reg. CE 852/2004 e al D.Lgs 27/2021.',
      '',
      'Lo scopo è:',
      '• Identificare e controllare i pericoli biologici, chimici e fisici nelle fasi di competenza dell\'OSA',
      '• Stabilire procedure standardizzate per il personale ASA/OSS addetto a ricevimento, stoccaggio, riattivazione e distribuzione pasti',
      '• Garantire la tracciabilità e la rintracciabilità dei pasti distribuiti',
      '• Documentare i controlli e le verifiche periodiche attraverso moduli standardizzati',
    ].join('\n')),
    h2('1.2 Campo di Applicazione'),
    ...textToParagraphs(extractSez(testoManuale, '1b') || [
      'Il presente manuale si applica ESCLUSIVAMENTE alle fasi di competenza dell\'OSA ' + nomestruttura + ':',
      '• Ricevimento pasti pronti e/o abbattuti da centro cottura esterno (Sodexo SpA)',
      '• Stoccaggio brevissimo in frigoriferi di cucinetta (FR1–FR4, FD)',
      '• Riattivazione a caldo di teglie abbattute per la cena (≥75°C al cuore)',
      '• Porzionamento e confezionamento in vassoi',
      '• Distribuzione ai reparti tramite carrello termico e cucinette di nucleo',
      '• Raccolta e smaltimento rifiuti · Lavaggio stoviglie · Sanificazione locali',
      '',
      'NON rientrano nel campo di applicazione:',
      '• Fasi di produzione, preparazione e cottura presso il centro cottura Sodexo SpA',
      '• Monitoraggio dei frigoriferi del fornitore',
      '• Fasi di trasporto termico esterno (competenza logistica fornitore)',
    ].join('\n')),
    h2('1.3 Normativa di Riferimento'),
    ...textToParagraphs(extractSez(testoManuale, '1c') || [
      '• **Reg. CE 852/2004**: Igiene dei prodotti alimentari',
      '• **Reg. CE 853/2004**: Norme specifiche igiene alimenti di origine animale',
      '• **Reg. UE 2021/382**: Modifica allegati Reg. CE 852/2004 (cultura sicurezza alimentare)',
      '• **D.Lgs 27/2021**: Adeguamento normativa nazionale ai regolamenti UE',
      '• **Reg. CE 178/2002**: Principi e requisiti della legislazione alimentare (tracciabilità)',
      '• **Reg. UE 1169/2011**: Informazioni sugli alimenti ai consumatori (allergeni)',
      '• **D.Lgs 231/2001**: Responsabilità amministrativa delle organizzazioni',
    ].join('\n')),
    new Paragraph({ children: [new PageBreak()] }),

    // ── SEZ 2: Prerequisiti ──────────────────────────────────
    h1('2. PREREQUISITI E BUONE PRATICHE IGIENICHE (GHP)'),
    ...textToParagraphs(extractSez(testoManuale, 2) || [
      'I prerequisiti costituiscono la base su cui si fonda il sistema HACCP. Prima di applicare i principi HACCP, la struttura ' + nomestruttura + ' garantisce i seguenti programmi di supporto:',
    ].join('\n')),
    h2('2.1 Igiene del Personale'),
    ...textToParagraphs([
      '• Lavaggio mani obbligatorio prima di manipolare alimenti, dopo uso servizi igienici, dopo gestione rifiuti',
      '• Indumenti da lavoro puliti e dedicati (non uscire con indumenti da lavoro)',
      '• Divieto di gioielli, anelli, bracciali, orologi e **unghie finte o ricostruite** durante il servizio',
      '• Capelli raccolti e coperti con copricapo',
      '• Segnalazione immediata di ferite, infezioni, sintomi gastrointestinali al R-HACCP',
    ].join('\n')),
    h2('2.2 Pulizia e Sanificazione Locali'),
    ...textToParagraphs([
      '• Cucinette nucleo: pulizia giornaliera superfici, scaldavivande, piani lavoro',
      '• Frigoriferi: pulizia mensile interna, verifica guarnizioni',
      '• Magazzino derrate: pulizia mensile scaffalature, verifica zanzariera',
      '• Lavastoviglie: pulizia settimanale filtri e bracci spruzzatori',
    ].join('\n')),
    h2('2.3 Controllo Infestanti'),
    ...textToParagraphs([
      '• Piano di derattizzazione e disinfestazione affidato a ditta specializzata (contratto annuale)',
      '• Ispezione trimestrale esche e trappole',
      '• Segnalazione immediata di evidenze di infestazione al R-HACCP',
    ].join('\n')),
    h2('2.4 Smaltimento Rifiuti'),
    ...textToParagraphs([
      '• Ogni cucinetta dotata di contenitore a pedale per raccolta frazione umida',
      '• Svuotamento giornaliero prima della fine del servizio cena',
      '• Rifiuti speciali (isolamento infettivo): sacchetti "BIOHAZARD" smaltiti da ditta autorizzata',
    ].join('\n')),
    new Paragraph({ children: [new PageBreak()] }),

    // ── SEZ 3: Organizzazione ────────────────────────────────
    h1('3. ORGANIZZAZIONE E RESPONSABILITÀ'),
    h2('3.1 Struttura Organizzativa HACCP'),
    ...textToParagraphs([
      'La struttura ' + nomestruttura + ' ha identificato le seguenti figure responsabili del sistema di autocontrollo:',
    ].join('\n')),
    tabellaRuoli(lr, rHaccp, teamHaccp),
    ...spacer(1),
    h2('3.2 Comunicazione Interna'),
    ...textToParagraphs([
      '• Il Responsabile HACCP organizza riunioni trimestrali per revisione non conformità e aggiornamento procedure',
      '• Bacheca informativa in ogni cucinetta di nucleo con contatti R-HACCP e procedure di emergenza',
      '• Schede procedure laminate e affisse presso ogni postazione di lavoro',
      '• Ogni non conformità rilevata viene registrata su apposito modulo e gestita entro 24h',
    ].join('\n')),
    new Paragraph({ children: [new PageBreak()] }),

    // ── SEZ 4: Struttura e Locali ────────────────────────────
    h1('4. DESCRIZIONE DELLA STRUTTURA E LOCALI'),
    h2('4.1 Anagrafica'),
    tabellaDati([
      ['Struttura',          nomestruttura],
      ['Ragione sociale OSA',osa],
      ['P.IVA',              pivaOsa],
      ['Modello ristorazione', modello],
      ['Fornitore pasti',    'Sodexo SpA'],
      ['Referente HACCP',    rHaccp],
    ]),
    ...spacer(1),
    h2('4.2 Layout Nuclei e Locali'),
    ...textToParagraphs(layoutStruttura || extractSez(testoManuale, 4) || [
      '• **Nucleo AS**: Piano terra · Cucinetta con FR1 · Scaldavivande · Frigorifero disfagici FD al piano interrato',
      '• **Nucleo B**: Piano primo · Cucinetta con FR2 · Scaldavivande',
      '• **Nucleo C**: Piano primo · Cucinetta con FR3 · Scaldavivande',
      '• **Nucleo D**: Piano secondo · Cucinetta con FR4 · Scaldavivande',
      '• **Locale preparazione piano interrato**: Frigorifero FD pasti disfagici Nucleo AS',
      '• **Magazzino derrate secche**: Finestra con zanzariera · Scaffalature aperte e/o armadi chiusi · Monitoraggio T° giornaliero',
      '• **Lavanderia stoviglie**: Lavastoviglie ciclo ≥80°C · Scaffali per asciugatura',
    ].join('\n')),
    h2('4.3 Apparecchiature in Gestione OSA'),
    tabellaApparecchiature([
      ['FR1', 'Cucinetta Nucleo AS',     'Frigorifero', '≤4°C',    'Pasti ospiti + riservato disfagici in emergenza'],
      ['FR2', 'Cucinetta Nucleo B',      'Frigorifero', '≤4°C',    ''],
      ['FR3', 'Cucinetta Nucleo C',      'Frigorifero', '≤4°C',    ''],
      ['FR4', 'Cucinetta Nucleo D',      'Frigorifero', '≤4°C',    ''],
      ['FD',  'Piano interrato',         'Frigorifero', '≤4°C',    'DEDICATO disfagici Nucleo AS'],
      ['SC1-4','Cucinette nuclei',       'Scaldavivande','≥60°C',  'Uno per nucleo'],
      ['CT',  'Cucinette nuclei',        'Carrello termico','Scomp. caldo ≥65°C / freddo ≤10°C', ''],
      ['LV',  'Lavanderia stoviglie',    'Lavastoviglie','≥80°C',  'Ciclo completo 45 min'],
    ]),
    ...spacer(1),
    h2('4.4 Orari di Servizio e Distribuzione'),
    ...textToParagraphs(orariServizio || [
      '• **Colazione**: 08:00 — Cucinette di nucleo',
      '• **Pranzo**: 12:00 — Distribuzione pasti caldi da Sodexo SpA',
      '• **Merenda**: 15:30 — Cucinette di nucleo',
      '• **Cena**: 18:30 — Riattivazione teglie abbattute consegnate al mattino',
    ].join('\n')),
    new Paragraph({ children: [new PageBreak()] }),

    // ── SEZ 5: Diagrammi di flusso ───────────────────────────
    h1('5. DIAGRAMMI DI FLUSSO'),
    txt('I seguenti diagrammi illustrano i flussi operativi di competenza dell\'OSA ' + nomestruttura + '. I CCP (Punti Critici di Controllo) sono evidenziati in verde acqua.'),
    ...spacer(1),
    ...diagramma51(),
    new Paragraph({ children: [new PageBreak()] }),
    ...diagramma52(),
    new Paragraph({ children: [new PageBreak()] }),
    ...diagramma53(),
    new Paragraph({ children: [new PageBreak()] }),
    ...diagramma54(),
    new Paragraph({ children: [new PageBreak()] }),
    ...diagramma55(),
    new Paragraph({ children: [new PageBreak()] }),

    // ── SEZ 6: Analisi pericoli CCP ──────────────────────────
    h1('6. ANALISI PERICOLI E IDENTIFICAZIONE CCP'),
    h2('6.1 Metodologia HACCP'),
    txt('Per ciascuna fase identificata nei diagrammi di flusso, è stata effettuata un\'analisi qualitativa del rischio secondo la formula Rischio = Probabilità × Severità. Sono stati identificati i pericoli biologici (B), chimici (C) e fisici (F). Le misure di controllo sono state classificate come CCP (Punto Critico di Controllo — limite misurabile con azione correttiva immediata) o PCC (misura preventiva senza limite critico formale).'),
    h2('6.2 CCP Identificati'),
    txt('**CCP1 — Ricevimento pasti:** verifica temperatura al ricevimento (pranzo caldo ≥65°C; cena abbattuta ≤4°C). Azione correttiva: rifiuto e restituzione al fornitore con compilazione modulo non conformità.'),
    txt('**CCP2 — Riattivazione pasti abbattuti:** raggiungimento T° ≥75°C al cuore. Azione correttiva: riscaldamento supplementare; se non raggiungibile dopo 2 cicli → smaltimento e segnalazione.'),
    h2('6.3 Matrice Analisi Pericoli per Fase'),
    ...spacer(1),
    tabellaCCP(),
    ...spacer(1),
    new Paragraph({ children: [new PageBreak()] }),

    // ── SEZ 7: Celiachia e allergeni ─────────────────────────
    h1('7. GESTIONE CELIACHIA E ALLERGENI'),
    ...textToParagraphs(extractSez(testoManuale, 7) || [
      'La struttura applica il Reg. UE 1169/2011 garantendo tracciabilità degli alimenti celiaci/allergeni dal fornitore Sodexo SpA all\'ospite.',
    ].join('\n')),
    h2('7.1 Normativa e Responsabilità'),
    ...textToParagraphs([
      '• **Tracciabilità** da fornitore a ospite per tutti gli alimenti con allergeni dichiarati',
      '• **Prevenzione contaminazione incrociata** durante manipolazione, porzionamento, distribuzione',
      '• **Documentazione** ricezione pasti celiaci e lista ospiti allergici aggiornata',
    ].join('\n')),
    h2('7.2 Registro Ospiti Celiaci e Allergici'),
    ...textToParagraphs([
      'All\'ammissione il Responsabile Infermieristico raccoglie: nome e cognome, data di nascita, allergia certificata, livello di reazione, istruzioni dietetiche specifiche.',
      '',
      'Il registro è conservato in formato cartaceo (fascicolo paziente) e digitale per l\'intero periodo di ospitalità più 2 anni dalla dimissione. Accesso limitato a R-HACCP, Responsabile Infermieristico e medico struttura.',
    ].join('\n')),
    h2('7.3 Ricezione Pasti Celiaci e Stoccaggio'),
    ...textToParagraphs([
      'Il fornitore Sodexo SpA fornisce pasti gluten-free in contenitore dedicato con etichetta "GLUTEN-FREE – [NOME OSPITE]".',
      '• Verifica etichetta al ricevimento: nome, data preparazione, integrità confezione',
      '• Stoccaggio nel ripiano SUPERIORE del frigorifero di nucleo in contenitore identificato "CELIACO – [NOME]"',
      '• Segregazione da pane, pasta e cereali contenenti glutine',
    ].join('\n')),
    h2('7.4 Procedura d\'Oro — Servizio Celiaci'),
    ...textToParagraphs([
      'REGOLA ASSOLUTA: il pasto celiaco deve essere servito PER PRIMO nel nucleo, prima di qualsiasi altro ospite.',
      '',
      '1. Estrai contenitore pasto celiaco dal frigo; igienizza mani',
      '2. Guanti monouso nuovi',
      '3. Porzionamento su vassoio BLU dedicato etichettato "CELIACO"',
      '4. Consegna in camera all\'ospite celiaco',
      '5. Cambio guanti + igiene mani prima di servire altri ospiti',
    ].join('\n')),
    h2('7.5 Gestione Contaminazione Incrociata'),
    ...textToParagraphs([
      'In caso di contatto accidentale tra pasto celiaco e alimenti con glutine:',
      '1. Scartare immediatamente il pasto celiaco',
      '2. Contattare Responsabile Infermieristico per monitoraggio ospite',
      '3. Registrare su modulo "Non Conformità Celiachia"',
      '4. Sanificare piano di lavoro con detergente neutro + panno monouso',
    ].join('\n')),
    h2('7.6 Allergeni Diversi da Celiachia'),
    ...textToParagraphs([
      'Per i 14 allergeni obbligatori Reg. UE 1169/2011: al ricevimento verifica etichetta, stoccaggio in contenitore etichettato "ALLERGIA – [NOME] – [ALLERGENE]", distribuzione con vassoio identificato e verifica tripla nominativo.',
    ].join('\n')),
    new Paragraph({ children: [new PageBreak()] }),

    // ── SEZ 8: Disfagici ─────────────────────────────────────
    h1('8. GESTIONE OSPITI DISFAGICI'),
    h2('8.1 Classificazione IDDSI'),
    txt('La disfagia (difficoltà di deglutizione) richiede alimenti di consistenza modificata secondo la International Dysphagia Diet Standardization Initiative (IDDSI):'),
    ...spacer(1),
    (() => {
      const c0 = Math.round(CONTENT_W * 0.08);
      const c1 = Math.round(CONTENT_W * 0.22);
      const c2 = Math.round(CONTENT_W * 0.22);
      const c3 = CONTENT_W - c0 - c1 - c2;
      return new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [c0, c1, c2, c3],
        rows: [
          new TableRow({ tableHeader: true, children: [hCell('Lvl',c0), hCell('Nome IDDSI',c1), hCell('Consistenza',c2), hCell('Esempi',c3)] }),
          ...[ ['3','Minced & Moist','Tritato e umido','Carne tritata, pasta piccoli pezzi'],
               ['4','Puree','Purea omogenea senza grumi','Verdure passate, frutta frullata'],
               ['5','Soft & Bite-Sized','Morbido tagliato a pezzetti','Alimenti soft già porzionati'],
               ['6','Chewed (Easy to Chew)','Facile masticazione','Cibo morbido per anziani'],
          ].map(([l,n,c,e]) => new TableRow({ children: [
            cell(l,c0,{align:AlignmentType.CENTER,bold:true,color:VERDE}),
            cell(n,c1,{bold:true}), cell(c,c2), cell(e,c3),
          ]})),
        ],
      });
    })(),
    ...spacer(1),
    h2('8.2 Ricezione e Stoccaggio Pasti Disfagici'),
    ...textToParagraphs([
      'I pasti disfagici abbattuti sono consegnati da Sodexo SpA in teglioni separati identificati con IDDSI level dichiarato.',
      '',
      'Controllo al ricevimento: T° ≤4°C · integrità confezionamento · leggibilità etichetta · verifica IDDSI level.',
      '',
      'Stoccaggio: frigorifero FD al piano interrato per il Nucleo AS, identificato "DISFAGICI – NUCLEO AS". Per gli altri nuclei il pasto disfagico viene conservato nel frigorifero della rispettiva cucinetta dopo abbattimento. Gestione FIFO.',
    ].join('\n')),
    h2('8.3 Riattivazione e Identificazione'),
    ...textToParagraphs([
      'Circa 30 min prima della cena (ore 18:00 per servizio 18:30):',
      '1. Prelievo teglione da FD; verifica etichetta IDDSI, scadenza, allergeni',
      '2. Riscaldamento: forno 160-180°C per 20-25 min oppure microonde 70% per 10-15 min con mescolamento ogni 3 min',
      '3. Verifica T° al cuore ≥75°C con sonda sterile (CCP2)',
      '4. Trasferimento in gastronorm monoporzionata identificata con nome ospite, IDDSI, allergeni, T° riattivazione',
      '5. Mantenimento in scaldavivande ≥65°C — distribuzione entro 30 min',
      '6. Compilazione modulo riattivazione pasti',
    ].join('\n')),
    h2('8.4 Distribuzione e Somministrazione'),
    ...textToParagraphs([
      '• Operatore ASA/OSS specializzato preleva gastronorm; verifica: nominativo = ospite, IDDSI = prescrizione, T° ≥55°C',
      '• Consegna diretta in camera/a letto — mai in area comune',
      '• Ospite in posizione seduta o semiseduta ≥30°; supervisione nei primi minuti',
      '• In caso di anomalie (tosse, soffocamento, rifiuto): bloccare somministrazione, contattare infermiere/medico, compilare modulo NC Disfagia, conservare campione 24h',
    ].join('\n')),
    h2('8.5 Documentazione e Modifiche IDDSI Level'),
    ...textToParagraphs([
      'Ogni ospite disfagico ha cartella dietetica visibile in cucinetta con: nome, IDDSI level prescritto, allergie, note deglutizione, data prescrizione, firma medico.',
      '',
      'In caso di variazione IDDSI: comunicazione scritta + email a Sodexo SpA entro 24h + aggiornamento cartella + comunicazione ai turni ASA/OSS.',
    ].join('\n')),
    new Paragraph({ children: [new PageBreak()] }),

    // ── SEZ 9: Isolamento infettivo ──────────────────────────
    h1('9. GESTIONE ISOLAMENTO INFETTIVO'),
    h2('9.1 Protocollo e Notifica'),
    ...textToParagraphs([
      'Quando un ospite è in isolamento infettivo (C. difficile, SARS-CoV-2, Norovirus, VRE ecc.), il Responsabile Infermieristico o il Medico curante emette il modulo "Avviso Isolamento Infettivo" affisso in cucinetta nucleo, bacheca portineria e inviato via email al team HACCP.',
    ].join('\n')),
    h2('9.2 Approvvigionamento Monouso'),
    ...textToParagraphs([
      'Il magazzino mantiene scorta per almeno 5 giorni di: vassoi monouso bianchi (cartone + PE), piatti piani e fondi monouso, bicchieri, posate, contenitori rossi "RIFIUTI BIOLOGICI".',
    ].join('\n')),
    h2('9.3 Preparazione e Consegna Pasto'),
    ...textToParagraphs([
      '1. Porzionamento pasto ULTIMO dopo tutti gli altri ospiti',
      '2. DPI obbligatori: guanti nitrile nuovi per ogni pasto, mascherina chirurgica, grembiule monouso',
      '3. Vassoio monouso bianco con stoviglie monouso e coperchio sigillo',
      '4. Identificazione vassoio "ISOLAMENTO INFETTIVO" con nome ospite, stanza, ora preparazione',
      '5. Cambio guanti prima ingresso stanza; consegna diretta; nessun contatto con stoviglie riutilizzabili',
    ].join('\n')),
    h2('9.4 Smaltimento e Sanificazione'),
    ...textToParagraphs([
      '• Raccolta vassoio con DPI da parte dello stesso operatore',
      '• Inserimento in sacchetto separato etichettato "BIOHAZARD ISOLAMENTO"',
      '• Conferimento giornaliero a ditta smaltimento rifiuti speciali autorizzata',
      '• Sanificazione stanza con cloro 0,5% o equivalente, contatto minimo 10 min, asciugatura',
      '• Registrazione su modulo isolamento; firma R-HACCP; archiviazione',
    ].join('\n')),
    new Paragraph({ children: [new PageBreak()] }),

    // ── SEZ 10: Piano analisi microbiologiche ────────────────
    h1('10. PIANO ANALISI MICROBIOLOGICHE'),
    txt('Il piano di campionamento microbiologico è volto a verificare l\'efficacia delle misure di controllo e la conformità ai limiti stabiliti dal Reg. CE 2073/2005. I campionamenti sono eseguiti da laboratorio accreditato esterno su incarico del R-HACCP.'),
    ...spacer(1),
    tabellaMicrobiologiche(),
    ...spacer(1),
    txt('I risultati delle analisi sono archiviati dal R-HACCP con conservazione minima 3 anni. In caso di non conformità viene aperto un modulo NC, applicata l\'azione correttiva e, se necessario, avvisata l\'ASL competente.'),
    new Paragraph({ children: [new PageBreak()] }),

    // ── SEZ 11: Piano formazione ─────────────────────────────
    h1('11. PIANO DI FORMAZIONE DEL PERSONALE'),
    txt('La formazione continua del personale ASA/OSS è requisito fondamentale del sistema HACCP. Il R-HACCP pianifica e documenta tutte le attività formative secondo il seguente schema:'),
    ...spacer(1),
    tabellaFormazione(),
    ...spacer(1),
    txt('La documentazione di ogni corso (registro presenze, attestati, test di valutazione) è archiviata nel fascicolo formazione individuale conservato presso il R-HACCP. L\'idoneità sanitaria del personale a contatto con alimenti è verificata annualmente secondo D.Lgs 81/2008.'),
    new Paragraph({ children: [new PageBreak()] }),

    // ── SEZ 12: Manutenzione e taratura ─────────────────────
    h1('12. MANUTENZIONE E TARATURA ATTREZZATURE'),
    txt('La manutenzione preventiva e la taratura periodica delle attrezzature è essenziale per garantire l\'efficacia del sistema HACCP, in particolare per le attrezzature che influenzano direttamente i CCP (frigoriferi, termometri a sonda, forni, scaldavivande).'),
    ...spacer(1),
    tabellaManutenzione(),
    ...spacer(1),
    txt('I rapporti di manutenzione e i certificati di taratura sono conservati dal R-HACCP per almeno 5 anni. Le attrezzature fuori tolleranza vengono messe fuori servizio fino a riparazione/sostituzione e sostituite con attrezzature di riserva documentate.'),

  ];

  // ── DOCUMENTO ────────────────────────────────────────────────
  const doc = new Document({
    styles: { default: { document: { run: { font: 'Arial', size: 22, color: NERO } } } },
    sections: [
      // Sezione 1: Copertina + Indice (senza header/footer)
      {
        properties: { page: { size: { width: PAGE_W, height: PAGE_H }, margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } } },
        children: [...copertina, ...paginaIndice],
      },
      // Sezione 2: Corpo con header e footer
      {
        properties: { page: { size: { width: PAGE_W, height: PAGE_H }, margin: { top: 1000, right: MARGIN, bottom: 1000, left: MARGIN } } },
        headers: { default: header },
        footers: { default: footer },
        children: corpo,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  return await blob.arrayBuffer();
}
export async function generaModulisticaHaccp({
  nomestruttura               = '[STRUTTURA]',
  modello                     = 'cucina_interna',
  apparecchiature_frigorifere = '',
  op_distributore_acqua       = false,
  op_distributore_acqua_note  = '',
  op_macchinetta_caffe        = false,
  op_macchinetta_caffe_note   = '',
  op_cena_abbattuta           = false,
}) {
  const isCucinaInterna = modello === 'cucina_interna';
  const isAppalto       = modello === 'appalto_fresco_caldo';

  // ── Parse apparecchiature ─────────────────────────────────
  const righe = apparecchiature_frigorifere.split('\n').map(r => r.trim()).filter(Boolean);
  const codice = r => r.split(/[–-]/)[0].trim().toUpperCase();
  const desc   = r => { const p = r.split(/[–-]/); return p.slice(1).join('–').trim() || codice(r); };

  const frigoCucina  = righe.filter(r => /^F\d+/.test(codice(r)) && !/^FR/.test(codice(r)) && !/^FD$/.test(codice(r)));
  const congelatori  = righe.filter(r => /^C\d+/.test(codice(r)) && !/^CR/.test(codice(r)));
  const frigoReparti = righe.filter(r => /^FR/.test(codice(r)) || /^FD$/.test(codice(r)));

  // ── Misure pagina A4 landscape margini ridotti ────────────
  // Larghezza piena: 16838 - 560*2 = 15718 DXA
  const W_L   = 15718;
  const W_P   = 9638; // Portrait
  const pLand = { size: { width: 16838, height: 11906 }, margin: { top: 560, right: 560, bottom: 560, left: 560 } };
  const pPort = { size: { width: 11906, height: 16838 }, margin: { top: 560, right: 720, bottom: 560, left: 720 } };

  // ── Helper bordi ──────────────────────────────────────────
  const B  = (c='CCCCCC') => ({ style: BorderStyle.SINGLE, size: 1, color: c });
  const BS = (c='CCCCCC') => ({ top:B(c), bottom:B(c), left:B(c), right:B(c) });

  // ── Helper cella ──────────────────────────────────────────
  function cell(text, w, opts = {}) {
    const { bold=false, size=18, color=NERO, fill='FFFFFF', align=AlignmentType.LEFT, colspan=1, italic=false, bc='CCCCCC', vspan=1 } = opts;
    return new TableCell({
      columnSpan: colspan,
      rowSpan:    vspan,
      width:      { size: w, type: WidthType.DXA },
      borders:    BS(bc),
      shading:    { fill, type: ShadingType.CLEAR },
      margins:    { top: 60, bottom: 60, left: 100, right: 100 },
      verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({
        alignment: align,
        children:  [new TextRun({ text: String(text||''), bold, size, color, font:'Arial', italic })],
      })],
    });
  }

  const hC = (t,w,cs=1) => cell(t,w,{bold:true,size:17,color:'FFFFFF',fill:VERDE,align:AlignmentType.CENTER,colspan:cs,bc:VERDE});
  const sC = (t,w,cs=1) => cell(t,w,{bold:true,size:16,color:VERDE,fill:VERDE_LIGHT,align:AlignmentType.CENTER,colspan:cs});
  const eC = (w)         => cell('',w);
  const sp = ()          => new Paragraph({ children:[new TextRun({text:'',size:16})] });

  // ── Intestazione scheda ────────────────────────────────────
  function intestazione(autoc, titolo, W, landscape=false) {
    const c1=Math.floor(W*0.28), c2=Math.floor(W*0.44), c3=W-c1-c2;
    return new Table({
      width:{size:W,type:WidthType.DXA}, columnWidths:[c1,c2,c3],
      rows:[
        new TableRow({children:[
          cell('GRUPPO OVER',c1,{bold:true,size:20,color:VERDE}),
          cell(nomestruttura,c2,{bold:true,size:18,align:AlignmentType.CENTER}),
          cell(autoc,c3,{bold:true,size:20,color:'FFFFFF',fill:VERDE,align:AlignmentType.CENTER,bc:VERDE}),
        ]}),
        new TableRow({children:[
          cell('HACCP – AUTOCONTROLLO',c1,{size:15,color:'555555',italic:true}),
          cell(titolo,c2,{bold:true,size:22,color:VERDE,align:AlignmentType.CENTER}),
          cell('Mese: ________  Anno: ____',c3,{size:15,align:AlignmentType.CENTER}),
        ]}),
      ],
    });
  }

  // ── Tabella 31 righe giornaliere ───────────────────────────
  // Calcola altezza riga per stare in una pagina
  // Spazio utile landscape ~6000 DXA, portrait ~9000 DXA
  // intestazione ~900 + legenda ~800 + note ~300 = ~2000
  // Righe: (spazio - 2000 - header tabella 400) / 31
  function tabella31(colWidths, W, landscape, extraCols = []) {
    const spazioUtile  = landscape ? 6200 : 8800;
    const spazioRighe  = spazioUtile - 2400;
    const altezzaRiga  = Math.max(Math.floor(spazioRighe / 31), 280);

    return new Table({
      width: { size: W, type: WidthType.DXA },
      columnWidths: colWidths,
      rows: [
        ...Array.from({length: 31}, (_, i) => new TableRow({
          height: { value: altezzaRiga, rule: 'exact' },
          children: [
            cell(String(i+1), colWidths[0], {bold:true, align:AlignmentType.CENTER, size:16}),
            ...colWidths.slice(1).map(w => eC(w)),
          ],
        })),
      ],
    });
  }

  // ══════════════════════════════════════════════════════════
  // SCHEDE
  // ══════════════════════════════════════════════════════════

  // ── Autoc 1 — Ricevimento merci (Portrait) ────────────────
  function scheda1() {
    const W = W_P;
    const cW = [Math.floor(W*0.54), Math.floor(W*0.115), Math.floor(W*0.115), Math.floor(W*0.115), W-Math.floor(W*0.54)-Math.floor(W*0.115)*3];
    return {
      properties: { page: pPort },
      children: [
        intestazione('Autoc 1','CONTROLLO RICEVIMENTO MERCI', W),
        sp(),
        new Paragraph({children:[new TextRun({text:'Fornitore: ________________________________   N° Doc/Fattura: ___________________', bold:true, size:18, font:'Arial'})]}),
        sp(),
        new Table({
          width:{size:W,type:WidthType.DXA}, columnWidths:[600,W-600],
          rows:[
            new TableRow({children:[hC('N°',600),hC('CRITERI DI VERIFICA',W-600)]}),
            ...['Integrità confezioni e stato della merce','Leggibilità etichette e date di scadenza','Temperature di trasporto (rialzo tollerato +3°C)','Condizioni igieniche del mezzo di trasporto']
              .map((t,i)=>new TableRow({children:[cell(String(i+1),600,{bold:true,align:AlignmentType.CENTER}),cell(t,W-600,{bold:true,size:17})]})),
          ],
        }),
        sp(),
        new Table({ width:{size:W,type:WidthType.DXA}, columnWidths:[W], rows:[new TableRow({children:[cell('TUTTI I CONTROLLI CONFORMI?     ☐ SÌ     ☐ NO  (se NO: respingere la merce e compilare tabella sotto)',W,{bold:true,size:17,fill:'E8F5EE',align:AlignmentType.CENTER})]})] }),
        sp(),
        new Table({
          width:{size:W,type:WidthType.DXA}, columnWidths:cW,
          rows:[
            new TableRow({children:[hC('PRODOTTO NON CONFORME',cW[0]),hC('NC 1',cW[1]),hC('NC 2',cW[2]),hC('NC 3',cW[3]),hC('NC 4',cW[4])]}),
            ...Array.from({length:8},()=>new TableRow({height:{value:420,rule:'exact'},children:cW.map(w=>eC(w))})),
          ],
        }),
        sp(),
        new Paragraph({children:[new TextRun({text:'DATA: ___________________   RILEVATORE: ___________________', bold:true, size:18, font:'Arial'})]}),
        sp(),
        new Paragraph({children:[new TextRun({text:'Riportare NC nel Registro Generale Non Conformità (Autoc 6).', size:15, italic:true, color:'555555', font:'Arial'})]}),
      ],
    };
  }

  // ── Autoc 2A cucina — Temperature frigoriferi (Landscape) ─
  function scheda2ACucina() {
    const W = W_L;
    const nF = Math.max(frigoCucina.length, 1);
    const cFixed = 700+700+1400+1600;
    const tW = Math.max(Math.floor((W-cFixed)/nF), 500);
    const tCols = Array.from({length:nF},(_,i)=> i===nF-1 ? W-cFixed-tW*(nF-1) : tW);
    const colWidths = [700,700,...tCols,1400,1600];
    const noteApp = frigoCucina.length
      ? frigoCucina.map((r,i)=>`${i+1} = ${r}`).join(' | ')
      : '1 = Frigorifero cucina';

    // Riga 2: etichette apparecchi + unica cella firma per "incaricato al controllo"
    const riga2Children = [
      sC('',700), sC('',700),
      ...tCols.map((w,i) => sC(String(i+1)+'\n'+frigoCucina[i]?.split(/[–-]/)[0]?.trim() || String(i+1), w)),
      sC('',1400),
      cell('Negli spazi a lato riportare la firma di chi ha effettuato il controllo', 1600, {size:14,italic:true,color:'555555'}),
    ];

    return {
      properties: { page: pLand },
      children: [
        intestazione('Autoc 2A','TEMPERATURE APPARECCHIATURE FRIGORIFERE CUCINA', W, true),
        sp(),
        new Paragraph({children:[new TextRun({text:`LOCALE: Cucina — Codice apparecchiatura: ${noteApp}`, bold:true, size:19, color:VERDE, font:'Arial'})]}),
        sp(),
        new Table({
          width:{size:W,type:WidthType.DXA}, columnWidths:colWidths,
          rows:[
            new TableRow({children:[hC('Data',700),hC('Ore',700),hC('Temperature rilevate (°C)',tW*nF,nF),hC('Guasto / Disattivato',1400),hC('Incaricato al controllo',1600)]}),
            new TableRow({children:riga2Children}),
            ...tabella31(colWidths, W, true).rows,
          ],
        }),
        sp(),
        legenda(W),
        sp(),
        new Paragraph({children:[new TextRun({text:'Riportare eventuali non conformità nel Registro Generale di Non Conformità (Autoc 6) indicando l\'azione correttiva attuata.', size:15, italic:true, color:'555555', font:'Arial'})]}),
      ],
    };
  }

  // ── Autoc 2A reparto — una scheda per FR/FD (Portrait) ────
  function schede2AReparto() {
    return frigoReparti.map(r => {
      const W = W_P;
      const colWidths = [700, 700, W-700-700-1400-1700, 1400, 1700];
      return {
        properties: { page: pPort },
        children: [
          intestazione('Autoc 2A', `TEMPERATURA — ${codice(r)}: ${desc(r)}`, W),
          sp(),
          new Paragraph({children:[new TextRun({text:`LOCALE/REPARTO: ${desc(r)}`, bold:true, size:20, color:VERDE, font:'Arial'})]}),
          sp(),
          new Table({
            width:{size:W,type:WidthType.DXA}, columnWidths:colWidths,
            rows:[
              new TableRow({children:[hC('Data',700),hC('Ore',700),hC('Temperatura rilevata (°C)',colWidths[2]),hC('Guasto / Disattivato',1400),hC('Incaricato al controllo',1700)]}),
              new TableRow({children:[sC('',700),sC('',700),sC('',colWidths[2]),sC('',1400),cell('Negli spazi a lato riportare la firma di chi ha effettuato il controllo',1700,{size:14,italic:true,color:'555555'})]}),
              ...tabella31(colWidths, W, false).rows,
            ],
          }),
          sp(),
          legenda(W),
          sp(),
          new Paragraph({children:[new TextRun({text:'Riportare eventuali non conformità nel Registro Generale di Non Conformità (Autoc 6).', size:15, italic:true, color:'555555', font:'Arial'})]}),
        ],
      };
    });
  }

  // ── Autoc 2B — Temperature congelatori (Landscape) ────────
  function scheda2B() {
    const W = W_L;
    const nC = Math.max(congelatori.length, 1);
    const cFixed = 700+700+1400+1600;
    const tW = Math.max(Math.floor((W-cFixed)/nC), 500);
    const tCols = Array.from({length:nC},(_,i)=> i===nC-1 ? W-cFixed-tW*(nC-1) : tW);
    const colWidths = [700,700,...tCols,1400,1600];
    const noteApp = congelatori.length
      ? congelatori.map((r,i)=>`${i+1} = ${r}`).join(' | ')
      : '1 = Congelatore cucina';
    return {
      properties: { page: pLand },
      children: [
        intestazione('Autoc 2B','TEMPERATURE CONGELATORI / SURGELATORI CUCINA', W, true),
        sp(),
        new Paragraph({children:[new TextRun({text:`LOCALE: Cucina — Codice apparecchiatura: ${noteApp}`, bold:true, size:19, color:VERDE, font:'Arial'})]}),
        sp(),
        new Table({
          width:{size:W,type:WidthType.DXA}, columnWidths:colWidths,
          rows:[
            new TableRow({children:[hC('Data',700),hC('Ore',700),hC('Temperature rilevate (°C)',tW*nC,nC),hC('Guasto / Disattivato',1400),hC('Incaricato al controllo',1600)]}),
            new TableRow({children:[sC('',700),sC('',700),...tCols.map((w,i)=>sC(String(i+1),w)),sC('',1400),cell('Negli spazi a lato riportare la firma di chi ha effettuato il controllo',1600,{size:14,italic:true,color:'555555'})]}),
            ...tabella31(colWidths, W, true).rows,
          ],
        }),
        sp(),
        legenda(W, true),
        sp(),
        new Paragraph({children:[new TextRun({text:'Riportare eventuali non conformità nel Registro Generale di Non Conformità (Autoc 6).', size:15, italic:true, color:'555555', font:'Arial'})]}),
      ],
    };
  }

  // ── Helper scheda pre-operativo con voci ──────────────────
  // Formato Ossago: colonne 1→31, una firma per riga "Negli spazi a lato..."
  function schedaPreOperativo(autoc, titolo, VOCI, W, landscape = false) {
    // 31 colonne giornaliere + 1 colonna voce
    const cVoce = landscape ? 3200 : 2800;
    const resto = W - cVoce;
    const cGiorno = Math.floor(resto / 31);
    const cUltimo = W - cVoce - cGiorno * 30;
    const colWidths = [cVoce, ...Array.from({length:30}, ()=>cGiorno), cUltimo];


    const altRiga = landscape
      ? Math.max(Math.floor((5800 - 900) / (VOCI.length + 2)), 300)
      : Math.max(Math.floor((8600 - 900) / (VOCI.length + 2)), 320);

    return new Table({
      width:{size:W,type:WidthType.DXA}, columnWidths: colWidths,
      rows:[
        // Header giorni
        new TableRow({children:[
          hC('',cVoce),
          ...Array.from({length:30},(_,i)=>hC(String(i+1),cGiorno)),
          hC('31',cUltimo),
        ]}),
        // Riga firma
        new TableRow({height:{value:altRiga*1.4|0,rule:'exact'}, children:[
          cell('Negli spazi a lato deve essere riportata la firma di chi ha effettuato il monitoraggio pre-operativo', cVoce, {size:14,italic:true,color:'555555'}),
          ...Array.from({length:30},()=>eC(cGiorno)),
          eC(cUltimo),
        ]}),
        // Voci
        ...VOCI.map(v => new TableRow({height:{value:altRiga,rule:'exact'}, children:[
          cell(v, cVoce, {size:15}),
          ...Array.from({length:30},()=>eC(cGiorno)),
          eC(cUltimo),
        ]})),
      ],
    });
  }

  // ── Autoc 2C — Monitoraggio igiene cucina/lavaggio ────────
  function scheda2C() {
    const W = W_P;
    const VOCI = [
      'Pavimenti e pareti lavabili idonei',
      'Porte e maniglie idonei',
      'Esterno arredi e apparecchiature idonei (es. frigoriferi, forno, ecc...)',
      'Interni apparecchiature (es. frigorifero, forno, ecc...) e arredi idonei',
      'Lavastoviglie idonea',
      'Posateria, pentolame e stoviglie idonei',
      'Lavelli e piani di lavoro idonei',
      'Bicchieri, taglieri e coltelleria idonei',
      'Carrelli acciaio idonei',
      'Portarifiuti idoneo',
      'Vetri e plafoniere idonei',
      'Soffitti e coperture varie idonei',
      'Corretta separazione alimenti stoccati',
      'Assenza materiale non inerente nei locali',
      'Presenza termometro sonda funzionante',
      'Assenza confezioni alterate',
      'Assenza prodotti scaduti',
      'Assenza visiva di tracce di animali e/o insetti indesiderati',
    ];
    return {
      properties: { page: pPort },
      children: [
        intestazione('Autoc 2C','MONITORAGGIO (PRE-OPERATIVO) AREA: CUCINA, LAVAGGIO, DISPENSA', W),
        sp(),
        new Paragraph({children:[new TextRun({text:'MESE: _______________   ANNO: ___________', bold:true, size:18, font:'Arial'})]}),
        sp(),
        schedaPreOperativo('2C','',VOCI,W,false),
        sp(),
        new Paragraph({children:[new TextRun({text:'Riportare eventuali non conformità nel Registro Generale di Non Conformità (Autoc 6) indicando l\'azione correttiva attuata.', size:15, italic:true, color:'555555', font:'Arial'})]}),
      ],
    };
  }

  // ── Autoc 2D — Monitoraggio sala da pranzo / refettori ────
  function scheda2D() {
    const W = W_P;
    const VOCI = [
      'Pavimenti e pareti lavabili idonei',
      'Scaffalature, mensole, tavoli, sedie, maniglie e porte idonei',
      'Esterni e interni arredi idonei',
      'Carrelli distribuzione idonei',
      'Posateria, bicchieri e stoviglie idonei',
      'Tovaglie / tovagliette monouso disponibili',
      'Vetri e plafoniere idonei',
      'Soffitti e coperture varie idonei',
      'Assenza materiale non inerente nei locali',
      'Assenza visiva di tracce di animali e/o insetti indesiderati',
    ];
    return {
      properties: { page: pPort },
      children: [
        intestazione('Autoc 2D','MONITORAGGIO (PRE-OPERATIVO) AREA: SALA DA PRANZO / REFETTORI', W),
        sp(),
        new Paragraph({children:[new TextRun({text:'MESE: _______________   ANNO: ___________', bold:true, size:18, font:'Arial'})]}),
        sp(),
        schedaPreOperativo('2D','',VOCI,W,false),
        sp(),
        new Paragraph({children:[new TextRun({text:'Riportare eventuali non conformità nel Registro Generale di Non Conformità (Autoc 6).', size:15, italic:true, color:'555555', font:'Arial'})]}),
      ],
    };
  }

  // ── Autoc 2E — Servizi igienici / spogliatoio (Portrait) ──
  function scheda2E() {
    const W = W_P;
    const VOCI = [
      'Pavimenti e pareti lavabili idonei',
      'Interno/esterno armadietti, porte e maniglie idonei',
      'Sanitari e accessori idonei',
      'Lavandini e rubinetteria idonei',
      'Distributori sapone e carta idonei',
      'Docce (se presenti) idonee',
      'Vetri e plafoniere idonei',
      'Soffitti e coperture varie idonei',
      'Assenza materiale non inerente nei locali',
      'Assenza visiva di tracce di animali e/o insetti indesiderati',
    ];
    return {
      properties: { page: pPort },
      children: [
        intestazione('Autoc 2E','MONITORAGGIO (PRE-OPERATIVO) AREA: SERVIZI IGIENICI / SPOGLIATOI', W),
        sp(),
        new Paragraph({children:[new TextRun({text:'MESE: _______________   ANNO: ___________', bold:true, size:18, font:'Arial'})]}),
        sp(),
        schedaPreOperativo('2E','',VOCI,W,false),
        sp(),
        new Paragraph({children:[new TextRun({text:'Riportare eventuali non conformità nel Registro Generale di Non Conformità (Autoc 6).', size:15, italic:true, color:'555555', font:'Arial'})]}),
      ],
    };
  }

  // ── Autoc 2F — Igiene personale cucina (formato Quinzano) ─
  function scheda2F() {
    const W = W_P;
    // Colonne: voce (label) | P/C | 1→31
    const cVoce  = 2400;
    const cPC    = 500;
    const resto  = W - cVoce - cPC;
    const cGiorno = Math.floor(resto / 31);
    const cUltimo = W - cVoce - cPC - cGiorno * 30;
    const colWidths = [cVoce, cPC, ...Array.from({length:30},()=>cGiorno), cUltimo];

    const rigaGiorni = [
      hC('',cVoce), hC('',cPC),
      ...Array.from({length:30},(_,i)=>hC(String(i+1),cGiorno)),
      hC('31',cUltimo),
    ];

    // Riga firma unica
    const rigaFirma = new TableRow({ height:{value:700,rule:'exact'}, children:[
      cell('Negli spazi a lato deve essere riportata la firma di chi ha effettuato il monitoraggio pre-operativo', cVoce, {size:14,italic:true,color:'555555'}),
      sC('',cPC),
      ...Array.from({length:30},()=>eC(cGiorno)),
      eC(cUltimo),
    ]});

    // Voce con due righe P e C
    function rigaPC(label) {
      return [
        new TableRow({ height:{value:480,rule:'exact'}, children:[
          cell(label, cVoce, {size:15}),
          sC('P', cPC),
          ...Array.from({length:30},()=>eC(cGiorno)),
          eC(cUltimo),
        ]}),
        new TableRow({ height:{value:480,rule:'exact'}, children:[
          eC(cVoce),
          sC('C', cPC),
          ...Array.from({length:30},()=>eC(cGiorno)),
          eC(cUltimo),
        ]}),
      ];
    }

    // Voce senza P/C (riga singola)
    function rigaSingola(label) {
      return new TableRow({ height:{value:500,rule:'exact'}, children:[
        cell(label, cVoce, {size:15}),
        sC('',cPC),
        ...Array.from({length:30},()=>eC(cGiorno)),
        eC(cUltimo),
      ]});
    }

    return {
      properties: { page: pPort },
      children: [
        intestazione('Autoc 2F','MONITORAGGIO (PRE-OPERATIVO): IGIENE PERSONALE DI CUCINA E ALLO SPORZIONAMENTO', W),
        sp(),
        new Paragraph({children:[new TextRun({text:'MESE: _______________   ANNO: ___________', bold:true, size:18, font:'Arial'})]}),
        sp(),
        new Table({
          width:{size:W,type:WidthType.DXA}, columnWidths:colWidths,
          rows:[
            new TableRow({children: rigaGiorni}),
            rigaFirma,
            new TableRow({ children:[eC(cVoce),eC(cPC),...Array.from({length:30},()=>eC(cGiorno)),eC(cUltimo)] }),
            ...rigaPC('Davantino indossato'),
            ...rigaPC('Raccoglitore capelli indossato'),
            ...rigaPC('Assenza anelli, orologi e bracciali'),
            ...rigaPC('Assenza di ferite scoperte'),
            rigaSingola('Carta a perdere disponibile in cucina e servizi'),
            rigaSingola('Sapone liquido disponibile in cucina e servizi'),
            rigaSingola('Disponibilità guanti e mascherine'),
            new TableRow({ children:[
              cell('La sigla nella prima riga indica la verifica dei controlli qui riportati. Indicare con X eventuali anomalie da inserire nelle non conformità.', W, {size:13,italic:true,color:'555555',colspan:colWidths.length}),
            ]}),
          ],
        }),
        sp(),
        new Paragraph({children:[new TextRun({text:'Legenda: P = Pranzo   C = Cena', bold:true, size:17, font:'Arial'})]}),
        new Paragraph({children:[new TextRun({text:'In caso di sintomi influenzali/gastrointestinali comunicare immediatamente al Responsabile HACCP. Riportare NC nel Registro Generale (Autoc 6).', size:15, italic:true, color:'555555', font:'Arial'})]}),
      ],
    };
  }

  // ── Autoc 3A — Temperature cottura (Landscape) ────────────
  function scheda3A() {
    const W = W_L;
    const cW = [700, 1800, 2200, 1400, 1400, 1400, W-700-1800-2200-1400-1400-1400];
    return {
      properties: { page: pLand },
      children: [
        intestazione('Autoc 3A','MONITORAGGIO TEMPERATURE — COTTURA', W, true),
        sp(),
        new Table({
          width:{size:W,type:WidthType.DXA}, columnWidths:cW,
          rows:[
            new TableRow({children:[hC('Data',700),hC('Tipo di preparazione',1800),hC('Prodotto',2200),hC('T° raggiunta al cuore (min. 75°C)',1400),hC('Ora fine cottura',1400),hC('Azione correttiva',1400),hC('Firma',cW[6])]}),
            ...Array.from({length:20},()=>new TableRow({height:{value:440,rule:'exact'},children:cW.map(w=>eC(w))})),
          ],
        }),
        sp(),
        new Paragraph({children:[new TextRun({text:'Temperatura minima al cuore: ≥ 75°C. Per pollame e macinati: ≥ 85°C. Riportare NC nel Registro Generale.', size:15, italic:true, color:'555555', font:'Arial'})]}),
      ],
    };
  }

  // ── Autoc 3B — Conservazione a caldo (Landscape) ──────────
  function scheda3B() {
    const W = W_L;
    const cW = [700, 2400, 1600, 1600, 1600, 1600, W-700-2400-1600*4];
    return {
      properties: { page: pLand },
      children: [
        intestazione('Autoc 3B','MONITORAGGIO TEMPERATURE — CONSERVAZIONE A CALDO', W, true),
        sp(),
        new Table({
          width:{size:W,type:WidthType.DXA}, columnWidths:cW,
          rows:[
            new TableRow({children:[hC('Data',700),hC('Prodotto / Preparazione',2400),hC('T° ore _:__',1600),hC('T° ore _:__',1600),hC('T° ore _:__',1600),hC('Azione correttiva',1600),hC('Firma',cW[6])]}),
            ...Array.from({length:20},()=>new TableRow({height:{value:440,rule:'exact'},children:cW.map(w=>eC(w))})),
          ],
        }),
        sp(),
        new Paragraph({children:[new TextRun({text:'Temperatura minima di mantenimento: ≥ 65°C. Tempo massimo mantenimento a caldo: 3 ore.', size:15, italic:true, color:'555555', font:'Arial'})]}),
      ],
    };
  }

  // ── Autoc 3C — Raffreddamento (Portrait) ──────────────────
  function scheda3C() {
    const W = W_P;
    const cW = [700, 2200, 1200, 1200, 1200, 1000, W-700-2200-1200*3-1000];
    return {
      properties: { page: pPort },
      children: [
        intestazione('Autoc 3C','MONITORAGGIO TEMPERATURE — RAFFREDDAMENTO', W),
        sp(),
        new Table({
          width:{size:W,type:WidthType.DXA}, columnWidths:cW,
          rows:[
            new TableRow({children:[hC('Data',700),hC('Tipo prodotto',2200),hC('T° inizio processo',1200),hC('T° a 2h (max 10°C)',1200),hC('T° finale (max 4°C)',1200),hC('Ora termine',1000),hC('Firma',cW[6])]}),
            ...Array.from({length:20},()=>new TableRow({height:{value:440,rule:'exact'},children:cW.map(w=>eC(w))})),
          ],
        }),
        sp(),
        new Paragraph({children:[new TextRun({text:'Da 65°C a 10°C in max 2 ore — Da 10°C a 4°C in max 4 ore. Usare abbattitore o bagno ghiaccio.', size:15, italic:true, color:'555555', font:'Arial'})]}),
      ],
    };
  }

  // ── Autoc 3D — Riattivazione (Portrait, con P/C come Quinzano)
  function scheda3D() {
    const W = W_P;
    const cData = 700, cPC = 500, cProd = W-700-500-1400-1400-1400;
    const cW = [cData, cPC, cProd, 1400, 1400, 1400];
    return {
      properties: { page: pPort },
      children: [
        intestazione('Autoc 3D','MONITORAGGIO TEMPERATURE — RIATTIVAZIONE', W),
        sp(),
        new Paragraph({children:[new TextRun({text:'AD OGNI RISCALDAMENTO DI TUTTI GLI ALIMENTI', bold:true, size:18, color:VERDE, font:'Arial'})]}),
        sp(),
        new Table({
          width:{size:W,type:WidthType.DXA}, columnWidths:cW,
          rows:[
            new TableRow({children:[hC('Data',cData),hC('P/C',cPC),hC('Tipo di prodotto / preparazione',cProd),hC('T° al cuore raggiunta (min. +75°C)',1400),hC('Ora fine riattivazione',1400),hC('Firma',1400)]}),
            ...Array.from({length:20},()=>new TableRow({height:{value:450,rule:'exact'},children:cW.map(w=>eC(w))})),
          ],
        }),
        sp(),
        new Paragraph({children:[new TextRun({text:'Legenda: P = Pranzo   C = Cena', bold:true, size:17, font:'Arial'})]}),
        new Paragraph({children:[new TextRun({text:'T° minima al cuore: ≥ 75°C. Non riattivare lo stesso prodotto più di una volta. Riportare NC nel Registro Generale (Autoc 6).', size:15, italic:true, color:'555555', font:'Arial'})]}),
      ],
    };
  }

  // ── Autoc 4 — Variazioni menù (Portrait) ──────────────────
  function scheda4() {
    const W = W_P;
    const cW = [700, 2400, 2400, 1800, W-700-2400*2-1800];
    return {
      properties: { page: pPort },
      children: [
        intestazione('Autoc 4','COMUNICAZIONE VARIAZIONI MENÙ', W),
        sp(),
        new Table({
          width:{size:W,type:WidthType.DXA}, columnWidths:cW,
          rows:[
            new TableRow({children:[hC('Data',700),hC('Pietanza prevista da menù',2400),hC('Sostituzione effettuata',2400),hC('Motivo sostituzione',1800),hC('Firma resp. cucina',cW[4])]}),
            ...Array.from({length:25},()=>new TableRow({height:{value:400,rule:'exact'},children:cW.map(w=>eC(w))})),
          ],
        }),
        sp(),
        new Paragraph({children:[new TextRun({text:'Comunicare le variazioni all\'OSS di reparto e al Direttore entro la mattina del giorno stesso.', size:15, italic:true, color:'555555', font:'Arial'})]}),
      ],
    };
  }

  // ── Autoc 5A — Distributore acqua (formato Quinzano P/V) ──
  function scheda5A(nota = '') {
    const W = W_P;
    const cVoce = 3200;
    const resto = W - cVoce - 400; // 400 per colonna P/V
    const cGiorno = Math.floor(resto / 31);
    const cUltimo = W - cVoce - 400 - cGiorno * 30;
    const colWidths = [cVoce, 400, ...Array.from({length:30},()=>cGiorno), cUltimo];

    const rigaGiorni = [
      hC('',cVoce), hC('',400),
      ...Array.from({length:30},(_,i)=>hC(String(i+1),cGiorno)),
      hC('31',cUltimo),
    ];

    function rigaPV(testo, pv) {
      return new TableRow({ height:{value:520,rule:'exact'}, children:[
        ...(pv === 'P' ? [cell(testo, cVoce, {size:14})] : [eC(cVoce)]),
        sC(pv, 400),
        ...Array.from({length:30},()=>eC(cGiorno)),
        eC(cUltimo),
      ]});
    }

    return {
      properties: { page: pPort },
      children: [
        intestazione('Autoc 5A', `DISTRIBUTORE ACQUA POTABILE${nota ? ' — ' + nota : ''}`, W),
        sp(),
        new Paragraph({children:[new TextRun({text:'MESE: _______________   ANNO: ___________', bold:true, size:18, font:'Arial'})]}),
        new Paragraph({children:[new TextRun({text:'Ubicazione: ' + (nota || '___________________'), size:16, italic:true, color:'555555', font:'Arial'})]}),
        sp(),
        // PULIZIA QUOTIDIANA
        new Paragraph({children:[new TextRun({text:'PULIZIA QUOTIDIANA', bold:true, size:20, color:VERDE, font:'Arial'})]}),
        sp(),
        new Table({
          width:{size:W,type:WidthType.DXA}, columnWidths:colWidths,
          rows:[
            new TableRow({children: rigaGiorni}),
            new TableRow({ height:{value:900,rule:'exact'}, children:[
              cell('Pulizia parti esterne (vaschette raccogli gocce, superfici). Pulire ugello con panno sanificante e far scorrere acqua per almeno 15 secondi', cVoce, {size:14}),
              sC('',400),
              ...Array.from({length:30},()=>eC(cGiorno)),
              eC(cUltimo),
            ]}),
            new TableRow({ children:[
              cell('Chi esegue la pulizia deve apporre la firma nel giorno corrispondente. Riportare NC nel Registro Generale (Autoc 6).', W, {size:13,italic:true,color:'555555',colspan:colWidths.length}),
            ]}),
          ],
        }),
        sp(),
        // PULIZIA SETTIMANALE / DOPO 48h INATTIVITÀ
        new Paragraph({children:[new TextRun({text:'PULIZIA SETTIMANALE O DOPO 48 ORE DI INATTIVITÀ', bold:true, size:20, color:VERDE, font:'Arial'})]}),
        sp(),
        new Table({
          width:{size:W,type:WidthType.DXA}, columnWidths:colWidths,
          rows:[
            new TableRow({children: rigaGiorni}),
            rigaPV('Sanificare ugelli: pulire con spazzolino i rubinetti per rimuovere residui/calcare, far scorrere acqua per almeno 30 secondi', 'P'),
            rigaPV('', 'V'),
            rigaPV('Aprire bypass acqua non trattata, far scorrere ≥3 litri, riattivare circuito trattamento, far scorrere acqua trattata per ≥1 minuto', 'P'),
            rigaPV('', 'V'),
            new TableRow({ children:[
              cell('"P" (programmato) = apporre X nelle date programmate. "V" (verifica) = apporre la firma nei giorni in cui gli interventi sono stati realmente eseguiti. Riportare NC nel Registro Generale (Autoc 6).', W, {size:13,italic:true,color:'555555',colspan:colWidths.length}),
            ]}),
          ],
        }),
      ],
    };
  }

  // ── Autoc 5B — Macchinetta bevande calde (formato Quinzano P/V)
  function scheda5B(nota = '') {
    const W = W_P;
    const cVoce = 3200;
    const resto = W - cVoce - 400;
    const cGiorno = Math.floor(resto / 31);
    const cUltimo = W - cVoce - 400 - cGiorno * 30;
    const colWidths = [cVoce, 400, ...Array.from({length:30},()=>cGiorno), cUltimo];

    const rigaGiorni = [
      hC('',cVoce), hC('',400),
      ...Array.from({length:30},(_,i)=>hC(String(i+1),cGiorno)),
      hC('31',cUltimo),
    ];

    function rigaPV(testo, pv) {
      return new TableRow({ height:{value:520,rule:'exact'}, children:[
        ...(pv === 'P' ? [cell(testo, cVoce, {size:14})] : [eC(cVoce)]),
        sC(pv, 400),
        ...Array.from({length:30},()=>eC(cGiorno)),
        eC(cUltimo),
      ]});
    }

    return {
      properties: { page: pPort },
      children: [
        intestazione('Autoc 5B', `APPARECCHIATURA BEVANDE CALDE${nota ? ' — ' + nota : ''}`, W),
        sp(),
        new Paragraph({children:[new TextRun({text:'MESE: _______________   ANNO: ___________', bold:true, size:18, font:'Arial'})]}),
        new Paragraph({children:[new TextRun({text:'Ubicazione: ' + (nota || '___________________'), size:16, italic:true, color:'555555', font:'Arial'})]}),
        sp(),
        new Paragraph({children:[new TextRun({text:'PULIZIA QUOTIDIANA', bold:true, size:20, color:VERDE, font:'Arial'})]}),
        sp(),
        new Table({
          width:{size:W,type:WidthType.DXA}, columnWidths:colWidths,
          rows:[
            new TableRow({children: rigaGiorni}),
            new TableRow({ height:{value:700,rule:'exact'}, children:[
              cell('Pulire con panno carta pulito e soluzione sanificante le superfici esterne e interne', cVoce, {size:14}),
              sC('',400),
              ...Array.from({length:30},()=>eC(cGiorno)),
              eC(cUltimo),
            ]}),
            new TableRow({ height:{value:700,rule:'exact'}, children:[
              cell('Aprire porta e premere tasto "WASHING" per ciclo automatico di pulizia', cVoce, {size:14}),
              sC('',400),
              ...Array.from({length:30},()=>eC(cGiorno)),
              eC(cUltimo),
            ]}),
            new TableRow({ children:[
              cell('Chi esegue la pulizia appone la firma nel giorno corrispondente. Riportare NC nel Registro Generale (Autoc 6).', W, {size:13,italic:true,color:'555555',colspan:colWidths.length}),
            ]}),
          ],
        }),
        sp(),
        new Paragraph({children:[new TextRun({text:'PULIZIA SETTIMANALE', bold:true, size:20, color:VERDE, font:'Arial'})]}),
        sp(),
        new Table({
          width:{size:W,type:WidthType.DXA}, columnWidths:colWidths,
          rows:[
            new TableRow({children: rigaGiorni}),
            rigaPV('Estrarre contenitori polvere, pulire esternamente e piano di appoggio, riposizionare rispettando corrispondenza colori', 'P'),
            rigaPV('', 'V'),
            rigaPV('Smontare imbuto e miscelatore, eliminare residui, sanificare con acqua bollente o lavastoviglie, rimontare accuratamente', 'P'),
            rigaPV('', 'V'),
            new TableRow({ children:[
              cell('"P" (programmato) = apporre X nelle date programmate. "V" (verifica) = apporre la firma nei giorni di esecuzione effettiva. Riportare NC nel Registro Generale (Autoc 6).', W, {size:13,italic:true,color:'555555',colspan:colWidths.length}),
            ]}),
          ],
        }),
      ],
    };
  }

  // ── Autoc 8 — Ricevimento pasti veicolati (Portrait) ──────
  // Una sezione per ogni giorno della settimana (come Quinzano)
  function scheda8() {
    const W = W_P;
    const GIORNI = ['Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato','Domenica'];
    const VOCI = [
      { label: 'Igiene mezzo di trasporto', nota: '' },
      { label: 'Integrità e igiene contenitori isotermici', nota: '' },
      { label: 'Quantità pasti', nota: '' },
      { label: 'Aspetto merceologico', nota: '' },
      { label: 'Conformità pasti (diete speciali, allergeni)', nota: '' },
      { label: 'Temperatura alimenti CALDI', nota: '(ACCETTABILE TRA 60 E 65 °C)' },
      { label: 'Temperatura alimenti FREDDI / abbattuti', nota: '(ACCETTABILE SE ≤ 10 °C)' },
    ];

    const cDa = Math.floor(W * 0.38);
    const cOk = Math.floor(W * 0.09);
    const cNo = Math.floor(W * 0.09);
    const cNote = Math.floor(W * 0.28);
    const cFirma = W - cDa - cOk - cNo - cNote;
    const cW = [cDa, cOk, cNo, cNote, cFirma];

    // Una sezione per giorno = intestazione giorno + tabella voci
    const blocchiGiorni = GIORNI.flatMap((giorno, gi) => [
      ...(gi > 0 ? [new Paragraph({children:[new PageBreak()]})] : []),
      new Table({
        width:{size:W,type:WidthType.DXA}, columnWidths:[Math.floor(W*0.5), Math.floor(W*0.3), W-Math.floor(W*0.5)-Math.floor(W*0.3)],
        rows:[new TableRow({children:[
          cell(giorno.toUpperCase(), Math.floor(W*0.5), {bold:true,size:22,color:'FFFFFF',fill:VERDE,bc:VERDE}),
          cell('N. LOTTO / BOLLA: ____________________', Math.floor(W*0.3), {size:16}),
          cell('SETTIMANA: ______ / ______', W-Math.floor(W*0.5)-Math.floor(W*0.3), {size:16}),
        ]})]
      }),
      new Table({
        width:{size:W,type:WidthType.DXA}, columnWidths:cW,
        rows:[
          new TableRow({children:[hC('DA VERIFICARE',cDa),hC('OK',cOk),hC('NON OK',cNo),hC('NOTE',cNote),hC('FIRMA',cFirma)]}),
          ...VOCI.map(v => new TableRow({height:{value:560,rule:'exact'}, children:[
            cell(v.label + (v.nota ? '\n' + v.nota : ''), cDa, {size:16}),
            eC(cOk), eC(cNo),
            eC(cNote),
            eC(cFirma),
          ]})),
        ],
      }),
      sp(),
      new Paragraph({children:[new TextRun({text:'Riportare NC nel Registro Generale di Non Conformità (Autoc 6).', size:14, italic:true, color:'555555', font:'Arial'})]}),
    ]);

    return {
      properties: { page: pPort },
      children: [
        intestazione('Autoc 8','CONTROLLI AL RICEVIMENTO DEI PASTI', W),
        sp(),
        new Paragraph({children:[new TextRun({text:'MESE: _______________   ANNO: ___________   FORNITORE: ___________________________', bold:true, size:18, font:'Arial'})]}),
        sp(),
        ...blocchiGiorni,
      ],
    };
  }

  // ── Autoc 7 — Elenco fornitori (Landscape) ────────────────
  function scheda7() {
    const W = W_L;
    const c7 = [Math.floor(W*0.22), Math.floor(W*0.26), Math.floor(W*0.14), Math.floor(W*0.16), Math.floor(W*0.1), W-Math.floor(W*0.22)-Math.floor(W*0.26)-Math.floor(W*0.14)-Math.floor(W*0.16)-Math.floor(W*0.1)];
    return {
      properties: { page: pLand },
      children: [
        intestazione('Autoc 7','ELENCO FORNITORI QUALIFICATI', W, true),
        sp(),
        new Table({
          width:{size:W,type:WidthType.DXA}, columnWidths:c7,
          rows:[
            new TableRow({children:[hC('Ragione sociale',c7[0]),hC('Prodotti / Servizi forniti',c7[1]),hC('P.IVA',c7[2]),hC('Referente / Contatto',c7[3]),hC('Data ultima verifica',c7[4]),hC('Note / SCIA fornitore',c7[5])]}),
            ...Array.from({length:22},()=>new TableRow({height:{value:430,rule:'exact'},children:c7.map(w=>eC(w))})),
          ],
        }),
        sp(),
        new Paragraph({children:[new TextRun({text:'Verificato da: ________________________________   Data: _______________   Firma R-HACCP: _______________', size:18, font:'Arial'})]}),
      ],
    };
  }

  // ── Legenda temperature ────────────────────────────────────
  function legenda(W, isCongelatore = false) {
    const items = isCongelatore
      ? [['Surgelati / congelati','< −18°C'],['Gelati','< −18°C']]
      : [['Frutta e verdura','+2 / +8°C'],['Salumi e affettati','+2 / +8°C'],['Latticini','0 / +4°C'],['Cibi cotti','0 / +4°C'],['Surgelati','−18 / −21°C']];
    const lW = Math.floor(W/2);
    return new Table({
      width:{size:W,type:WidthType.DXA}, columnWidths:[lW, W-lW],
      rows:[
        new TableRow({children:[hC('LEGENDA',lW),hC('Temperature di riferimento standard',W-lW)]}),
        new TableRow({children:[
          cell('F = Frigorifero     S = Surgelatore/Congelatore', lW, {italic:true,size:15,color:'555555'}),
          cell('Alimento → Temperatura',W-lW,{bold:true,size:15}),
        ]}),
        ...items.map(([a,t])=>new TableRow({children:[eC(lW),cell(`${a}: ${t}`,W-lW,{size:15})]})),
      ],
    });
  }

  // ══════════════════════════════════════════════════════════
  // ASSEMBLA SEZIONI IN BASE AL MODELLO
  // ══════════════════════════════════════════════════════════
  const sections = [];

  // 1 — Ricevimento merci:
  //   - cucina interna + appalto (sempre)
  //   - distribuzione/appalto: anche se hanno cucinetta (ricevono derrate colazioni/merenda)
  if (isCucinaInterna || isAppalto || op_cena_abbattuta || frigoCucina.length > 0 || frigoReparti.length > 0) {
    sections.push(scheda1());
  }

  // 2A cucina — solo cucina interna (F1, F2...)
  if (isCucinaInterna) sections.push(scheda2ACucina());

  // 2A reparti — cucina interna + distribuzione con frigoriferi propri (FR, FD)
  if (frigoReparti.length > 0) sections.push(...schede2AReparto());

  // 2B congelatori — solo cucina interna (C1, C2...)
  if (isCucinaInterna && congelatori.length > 0) sections.push(scheda2B());

  // 2C igiene cucina/lavaggio — solo cucina interna
  if (isCucinaInterna) sections.push(scheda2C());

  // 2D sala da pranzo — tutti i modelli
  sections.push(scheda2D());

  // 2E servizi igienici/spogliatoio — tutti i modelli
  sections.push(scheda2E());

  // 2F igiene personale — solo cucina interna
  if (isCucinaInterna) sections.push(scheda2F());

  // 3A/B/C — solo cucina interna
  if (isCucinaInterna) {
    sections.push(scheda3A());
    sections.push(scheda3B());
    sections.push(scheda3C());
  }

  // 3D riattivazione — cucina interna con cena abbattuta, O modelli esterni con riattivazione
  if (op_cena_abbattuta) sections.push(scheda3D());

  // 4 variazioni menù — cucina interna + appalto
  if (isCucinaInterna || isAppalto) sections.push(scheda4());

  // 5A distributore acqua — tutti se flag attivo (una per distributore)
  if (op_distributore_acqua) {
    const note = op_distributore_acqua_note || '';
    const apparecchi = note.split(/[,;]/).map(n=>n.trim()).filter(Boolean);
    if (apparecchi.length > 1) {
      apparecchi.forEach(n => sections.push(scheda5A(n)));
    } else {
      sections.push(scheda5A(note));
    }
  }

  // 5B macchinetta caffè — tutti se flag attivo (una per macchinetta)
  if (op_macchinetta_caffe) {
    const note = op_macchinetta_caffe_note || '';
    const apparecchi = note.split(/[,;]/).map(n=>n.trim()).filter(Boolean);
    if (apparecchi.length > 1) {
      apparecchi.forEach(n => sections.push(scheda5B(n)));
    } else {
      sections.push(scheda5B(note));
    }
  }

  // 8 — Ricevimento pasti: appalto + distribuzione veicolata
  if (!isCucinaInterna) sections.push(scheda8());

  // 7 fornitori — sempre (messa in fondo)
  sections.push(scheda7());

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Arial', size: 18 } } } },
    sections,
  });

  const blob = await Packer.toBlob(doc);
  return await blob.arrayBuffer();
}


// ── Genera manuale + modulistica in un'unica chiamata ─────────
export async function generaManualeCompleto(params) {
  const [manuale, modulistica] = await Promise.all([
    generaManualeHaccp(params),
    generaModulisticaHaccp({
      nomestruttura:               params.nomestruttura,
      modello:                     params.modello || 'distribuzione_veicolata',
      apparecchiature_frigorifere: params.apparecchiatureFrigorifere || '',
      op_macchinetta_caffe:        params.opMacchinettaCaffe || false,
      op_disfagici:                params.opDisfagici || false,
      op_cena_abbattuta:           params.opCenaAbbattuta || false,
      op_srtr:                     params.opSrtr || false,
      op_monouso_infetti:          params.opMonousoInfetti || false,
      op_riabilitazione:           params.opRiabilitazione || false,
      logoVariante:                params.logoVariante || 'A',
    }),
  ]);
  return { manuale, modulistica };
}
