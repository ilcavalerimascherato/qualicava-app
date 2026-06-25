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

// ── Variabili modulo (iniettate da generaManualeHaccp) ─────────
let _forn   = 'Fornitore esterno';
let _params = {};

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
const h3 = (text) => p([r(text, { size: 20, bold: true, color: GRIGIO_TESTO })], { before: 120, after: 80 });

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

// ── Sezione 5 — Diagrammi di flusso condizionali per modello ─
function buildSezione5() {
  const modello                = _params.modello                || 'distribuzione_veicolata';
  const cucinaObj              = _params.cucina               || {};
  const opDisfagici            = _params.opDisfagici           || false;
  const opDisfagiciMod         = _params.opDisfagiciModalita   || 'interna';
  const opCenaAbbattuta        = _params.opCenaAbbattuta       || false;
  const opMonousoInfetti       = _params.opMonousoInfetti      || false;
  const opDistribuzioneModalita = _params.opDistribuzioneModalita || 'gastronorm';

  const bx = (t, d, tipo = 'normal') => {
    if (tipo === 'esterno') return [dashedBox(t, d || 'Fase esterna'), arrow()];
    const clr = tipo === 'ccp' ? C.teal : tipo === 'warning' ? C.coral : C.gray;
    return [flowBox(t, d || null, clr), arrow()];
  };
  const bxL = (t, d, tipo = 'normal') => {
    const clr = tipo === 'ccp' ? C.teal : tipo === 'warning' ? C.coral : C.gray;
    return [flowBox(t, d || null, clr)];
  };

  const distribComune = () => [
    ...bx('Distribuzione agli ospiti — Verifica nominativo · Controllo dieta'),
    ...bx('Raccolta stoviglie · Smaltimento umido'),
    ...bxL('Lavaggio stoviglie ≥80°C e sanificazione'),
  ];

  const distribVarianti = (label) => [
    h2(label),
    ...spacer(1),
    ...(opDistribuzioneModalita === 'gastronorm'
      ? bx('Carico gastronorm su carrello caldo ≥65°C · Servizio in sala/reparto · Max 20 min')
      : bx('Porzionamento in vassoi identificati', 'Celiaci per primi · Verifica allergeni · Nominativo · Carrello caldo ≥65°C · Max 20 min')
    ),
    ...distribComune(),
    ...spacer(1),
  ];

  const sezCeliaci = (label) => [
    h2(label),
    ...spacer(1),
    ...bx('Materie prime certificate gluten-free'),
    ...bx('Preparazione in zona dedicata — PER PRIMA', 'Utensili dedicati · Piano lavoro sanificato · Guanti nuovi', 'warning'),
    ...bx('Cottura separata', 'T° al cuore ≥75°C', 'ccp'),
    ...bx('Identificazione vassoio "CELIACO — [NOME OSPITE]"'),
    ...bxL('Distribuzione per prima — Verifica nominativo tripla', 'Nessun contatto con alimenti glutinosi'),
    ...spacer(1),
  ];

  const sezDisfagici = (label) => [
    h2(label),
    ...spacer(1),
    ...(opDisfagiciMod === 'interna'
      ? bx('Frullatura/texturizzazione secondo livello IDDSI', 'Frullatore dedicato · Utensili igienizzati')
      : bx('Prodotto disfagico preconfezionato da fornitore', 'Verifica etichetta: livello IDDSI · Scadenza · Allergeni')
    ),
    ...bx('Identificazione contenitore [IDDSI level] — [NOME OSPITE]'),
    ...bx('Stoccaggio separato FD · Riattivazione ≥75°C'),
    ...bxL('Distribuzione identificata — Verifica nominativo + livello IDDSI'),
    ...spacer(1),
  ];

  const sezIsolamento = (label) => [
    h2(label),
    ...spacer(1),
    ...bx('Porzionamento ULTIMO — DPI: guanti nitrile + mascherina + grembiule monouso', null, 'warning'),
    ...bx('Vassoio monouso identificato "ISOLAMENTO — [NOME] — [STANZA]"'),
    ...bx('Consegna diretta in stanza · Cambio guanti all\'ingresso'),
    ...bx('Raccolta con DPI → sacchetto "BIOHAZARD"'),
    ...bx('Smaltimento rifiuti speciali · Sanificazione cloro 0,5%'),
    ...bxL('Registrazione modulo isolamento · Firma R-HACCP'),
    ...spacer(1),
  ];

  const PB = () => new Paragraph({ children: [new PageBreak()] });
  const result = [];

  if (modello === 'cucina_interna') {
    result.push(
      h2('5.1 Ricevimento materie prime (CCP1)'),
      ...spacer(1),
      ...bx('Fornitore / DDT', 'Fase esterna — non gestita dall\'OSA', 'esterno'),
      ...bx('Ricevimento materie prime (CCP1)', 'Verifica T° ingresso · Scadenze a campione · Integrità imballaggi · DDT', 'ccp'),
      ...bxL('Stoccaggio per categoria', 'Carni/pesce: 0–4°C · Latticini/verdure: 4°C · Surgelati: -18°C · Secco: t.a.'),
      ...spacer(1),
    );
    result.push(
      PB(),
      h2('5.2 Preparazione e cottura (CCP2)'),
      ...spacer(1),
      ...bx('Preparazione a freddo', 'Pulizia · Taglio · Porzionamento · Utensili dedicati per allergeni'),
      ...bxL('Cottura (CCP2)', 'T° al cuore ≥75°C · Verifica con sonda', 'ccp'),
      ...spacer(1),
    );
    const hasAbbattitore = (cucinaObj.zone || []).includes('abbattitore');
    let n = 3;
    if (hasAbbattitore) {
      result.push(
        PB(),
        h2('5.3 Abbattimento e rigenerazione'),
        ...spacer(1),
        ...bx('Abbattimento rapido (Modulo 3C)', 'Da >65°C a <10°C in ≤90 min · Etichetta: prodotto, data, ora'),
        ...bx('Stoccaggio in frigorifero dedicato', 'T° ≤4°C · Max 72h'),
        ...bxL('Rigenerazione', 'T° al cuore ≥75°C · Max 1h prima del servizio', 'ccp'),
        ...spacer(1),
      );
      n = 4;
    }
    result.push(PB(), ...distribVarianti('5.' + n + ' Distribuzione'));
    n++;
    result.push(PB(), ...sezCeliaci('5.' + n + ' Pasti celiaci'));
    n++;
    if (opDisfagici) { result.push(PB(), ...sezDisfagici('5.' + n + ' Pasti disfagici')); n++; }
    if (opMonousoInfetti) { result.push(PB(), ...sezIsolamento('5.' + n + ' Isolamento infettivo')); }

  } else if (modello === 'appalto_fresco_caldo') {
    result.push(
      h2('5.1 Ricevimento (CCP1)'),
      ...spacer(1),
      ...bx('Centro cottura esterno (Fornitore — SCIA esterna)', 'Non gestito dalla struttura OSA', 'esterno'),
      ...bxL('Ricevimento contenitori isotermici (CCP1)', 'Verifica T° ≥65°C · Integrità confezione · Etichetta · Allergeni · DDT', 'ccp'),
      ...spacer(1),
    );
    result.push(
      PB(),
      h2('5.2 Stoccaggio temporaneo'),
      ...spacer(1),
      ...bxL('Stoccaggio in scaldavivande di nucleo', 'T° ≥60°C · Max 30 min'),
      ...spacer(1),
    );
    result.push(PB(), ...distribVarianti('5.3 Distribuzione'));
    result.push(PB(), ...sezCeliaci('5.4 Pasti celiaci'));
    let na = 5;
    if (opDisfagici) { result.push(PB(), ...sezDisfagici('5.' + na + ' Pasti disfagici')); na++; }
    if (opMonousoInfetti) { result.push(PB(), ...sezIsolamento('5.' + na + ' Isolamento infettivo')); }

  } else {
    // distribuzione_veicolata
    result.push(
      h2('5.1 Ricevimento (CCP1)'),
      ...spacer(1),
      ...bx('Centro cottura esterno (Fornitore — SCIA esterna)', 'Non gestito dalla struttura OSA', 'esterno'),
      ...bxL('Ricevimento contenitori termici (CCP1)', 'Verifica T° caldo ≥65°C / freddo ≤4°C · Integrità · Etichetta · Allergeni', 'ccp'),
      ...spacer(1),
    );
    result.push(
      PB(),
      h2('5.2 Stoccaggio temporaneo'),
      ...spacer(1),
      ...bxL('Stoccaggio in frigoriferi di nucleo ≤4°C', 'Oppure scaldavivande ≥60°C per pasti caldi'),
      ...spacer(1),
    );
    let nv = 3;
    if (opCenaAbbattuta) {
      result.push(
        PB(),
        h2('5.3 Riattivazione'),
        ...spacer(1),
        ...bxL('Riattivazione a microonde/forno', 'T° al cuore ≥75°C · Verifica con sonda', 'ccp'),
        ...spacer(1),
      );
      nv = 4;
    }
    result.push(PB(), ...distribVarianti('5.' + nv + ' Distribuzione'));
    nv++;
    result.push(PB(), ...sezCeliaci('5.' + nv + ' Pasti celiaci'));
    nv++;
    if (opDisfagici) { result.push(PB(), ...sezDisfagici('5.' + nv + ' Pasti disfagici')); nv++; }
    if (opMonousoInfetti) { result.push(PB(), ...sezIsolamento('5.' + nv + ' Isolamento infettivo')); }
  }

  return result;
}

// ── PLACEHOLDER — kept for reference; replaced by buildSezione5 ──
// eslint-disable-next-line no-unused-vars
function _diagramma51() {
  return [
    h2('5.1 Flusso Generale — Pasti Caldi (Pranzo)'),
    ...spacer(1),
    dashedBox('Centro cottura esterno (' + _forn + ')', 'Non gestito dalla struttura · SCIA esterna · Reg. CE 852/2004'),
    arrow('Contenitori isotermici'),
    flowBox('Ricevimento contenitori isotermici pranzo (CCP1)', 'Verifica T° ≥65°C · Integrità confezione · Etichetta · Allergeni', C.teal),
    arrow(),
    flowBox('Stoccaggio brevissimo in scaldavivande di nucleo', 'T° ≥60°C · Max 15 min', C.amber),
    arrow(),
    flowBox('Porzionamento in vassoi identificati', 'Celiaci per primi · Verifica allergeni · Nominativo', C.gray),
    arrow(),
    flowBox('Trasporto con carrello e servizio immediato', 'Scomparto caldo ≥65°C · Max 20 min', C.teal),
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
// eslint-disable-next-line no-unused-vars
function _diagramma52() {
  return [
    h2('5.2 Flusso Pasti Abbattuti — Cena'),
    ...spacer(1),
    dashedBox('Centro cottura esterno (' + _forn + ')', 'Abbattimento e confezionamento pasti cena'),
    arrow('Contenitori isotermici freddi'),
    flowBox('Ricevimento teglie abbattute (CCP1)', 'Verifica T° ≤4°C · Integrità etichetta · FIFO', C.blue),
    arrow(),
    ...((() => {
      const appRaw = _params?.apparecchiatureFrigorifere || '';
      const frReparti = appRaw.split('\n').map(r=>r.trim()).filter(r=>/^FR\d+/i.test(r.split(/[\u2013\-:]/)[0].trim()));
      const label = frReparti.length > 0
        ? frReparti.map(r=>r.split(/[\u2013\-:]/)[0].trim()).join(', ')
        : 'FR1-FR4';
      return [flowBox('Stoccaggio frigorifero di nucleo — ' + label, 'T° ≤4°C · Isolate da altri alimenti · Fino alle 17:30', C.blue)];
    })()),
    arrow('Ore 17:30 — 1h prima cena'),
    flowBox('Riattivazione (CCP2)', 'Forno ≥75°C al cuore · Microonde ≥75°C al cuore · Sonda termometrica', C.coral),
    arrow(),
    flowBox('Porzionamento e identificazione vassoi', 'Nominativo · Allergeni · Celiaci per primi', C.gray),
    arrow(),
    flowBox('Trasporto con carrello e servizio immediato', '≥65°C · Max 20 min', C.teal),
    arrow(),
    flowBox('Distribuzione e verifica nominativo', null, C.green),
    arrow(),
    flowBox('Raccolta vassoi e lavaggio stoviglie ≥80°C', null, C.gray),
    ...spacer(1),
  ];
}

// ── 5.3 Flusso pasti disfagici (Nucleo AS) ───────────────────
// eslint-disable-next-line no-unused-vars
function _diagramma53() {
  return [
    h2('5.3 Flusso Pasti Disfagici — Nucleo AS'),
    ...spacer(1),
    flowBox('Ricevimento pasto disfagico abbattuto da ' + _forn, 'Teglione separato · T° ≤4°C · Verifica IDDSI level dichiarato', C.blue),
    arrow(),
    flowBox('Identificazione nominativa ospite', 'Nome · Data ricezione · Consistenza IDDSI (L3/L4/L5/L6) · Scadenza', C.purple),
    arrow(),
    flowBox('Stoccaggio frigorifero FD — piano interrato', 'Nucleo AS · Contenitore separato "DISFAGICI" · ≤4°C', C.blue),
    arrow('~30 min prima cena'),
    flowBox('Riattivazione (CCP2) — gastronorm dedicata', 'Microonde · Stessa scaldavivande dei pasti ' + _forn + ' · Gastronorm identificata', C.coral),
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
// eslint-disable-next-line no-unused-vars
function _diagramma54() {
  return [
    h2('5.4 Flusso Pasti Celiaci — Tutti i Nuclei'),
    ...spacer(1),
    flowBox('Ricevimento pasto Gluten-Free certificato da ' + _forn, 'Contenitore etichettato "GLUTEN-FREE" + nominativo ospite', C.teal),
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
// eslint-disable-next-line no-unused-vars
function _diagramma55() {
  return [
    h2('5.5 Flusso Isolamento Infettivo — Vassoio Monouso'),
    ...spacer(1),
    flowBox('Notifica isolamento da Infermiere/Medico', 'Modulo "Avviso Isolamento Infettivo" · Cucinetta + bacheca + email', C.red),
    arrow(),
    flowRow2(
      { label: 'Magazzino: scorta monouso ≥5gg', sub: 'Vassoi, piatti, posate, contenitori rifiuti infetti', clr: C.amber },
      { label: 'ASA/OSS: indossa DPI', sub: 'Guanti nitrile nuovi · Mascherina · Grembiule monouso', clr: C.red }
    ),
    arrowDouble(),
    flowBox('Porzionamento pasto ULTIMO (dopo tutti gli altri ospiti)', 'Vassoio monouso bianco · Stoviglie monouso · Coperchio sigillo', C.amber),
    arrow(),
    flowBox('Identificazione vassoio "ISOLAMENTO INFETTIVO"', 'Nome ospite · Stanza · Ora preparazione', C.red),
    arrow(),
    flowBox('Consegna in stanza — cambio guanti prima ingresso', 'Nessun contatto con stoviglie riutilizzabili', C.red),
    arrow(),
    flowBox('Raccolta vassoio con DPI · Sacchetto "RIFIUTI INFETTI"', 'Mai misto a rifiuti ordinari', C.red),
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

function tabellaCCP(modello, sa) {
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

  const hasAbbattitore = (sa?.cucina?.zone || []).includes('abbattitore');

  const righePerModello = {
    cucina_interna: [
      sezRow('RICEVIMENTO MATERIE PRIME', 6, W),
      row('Ricevimento', 'Temperatura inadeguata T° ingresso', 'B', 'Fornitura certificata; verifica T° per categoria', 'Misurazione T° (Modulo Autoc 1); ispezione visiva', 'CCP1'),
      row('', 'Allergeni non dichiarati', 'C', 'Schede tecniche fornitore; dichiarazione allergeni', 'Controllo etichetta 100% celiaci', 'PCC'),
      row('', 'Danni/perdite imballaggi', 'F', 'Controllo integrità; reso merce danneggiata', 'Ispezione visiva 100%; modulo anomalia', 'PCC'),
      sezRow('STOCCAGGIO', 6, W),
      row('Stoccaggio', 'T° inadeguata celle frigo', 'B', 'Separazione per categoria; celle verificate', 'Verifica T° giornaliera (Modulo 2A/2B)', 'CCP'),
      row('', 'Contaminazione crociata', 'B', 'Separazione per categoria merceologica', 'Ispezione visiva; etichettatura FIFO', 'PCC'),
      sezRow('PREPARAZIONE', 6, W),
      row('Preparazione', 'Contaminazione crociata allergeni', 'C', 'Utensili dedicati; zona celiaci separata; pulizia', 'Ispezione visiva; procedura scritta', 'PCC'),
      row('', 'Contaminazione biologica', 'B', 'Igiene personale; sanificazione piani di lavoro', 'Verifica visiva; piano sanificazione', 'PCC'),
      sezRow('COTTURA', 6, W),
      row('Cottura', 'T° insufficiente al cuore <75°C', 'B', 'Cottura completa; verifica con sonda calibrata', 'Misurazione T° al cuore ≥75°C (Modulo 3A)', 'CCP2'),
      ...(hasAbbattitore ? [
        sezRow('ABBATTIMENTO E RIGENERAZIONE', 6, W),
        row('Abbattimento', 'Raffreddamento insufficiente', 'B', 'Abbattitore dedicato; etichettatura data/ora', 'Da >65°C a <10°C in ≤90 min (Modulo 3C)', 'CCP'),
        row('Rigenerazione', 'T° insufficiente al cuore', 'B', 'Riattivazione completa prima del servizio', 'T° al cuore ≥75°C; sonda calibrata', 'CCP'),
      ] : []),
      sezRow('DISTRIBUZIONE', 6, W),
      row('Distribuzione', 'T° inadeguata carrello <65°C', 'B', 'Carrello caldo precondizionato; max 20 min', 'T° scomparto ≥65°C al carico/scarico', 'CCP'),
      row('', 'Errore dieta / allergene', 'C', 'Identificazione vassoio; doppio controllo nominativo', 'Verifica nominativo + tipologia dieta 100%', 'PCC'),
      row('', 'Contaminazione celiaci', 'C', 'Procedura celiaci; pasto servito per primo', 'Verifica separazione 100%; firma operatore', 'PCC'),
      sezRow('RACCOLTA E LAVAGGIO', 6, W),
      row('Lavaggio', 'Lavaggio stoviglie insufficiente', 'B', 'Ciclo lavastoviglie ≥80°C; verifica ugelli', 'Verifica T° ciclo mensile (Modulo 4)', 'PCC'),
      row('Rifiuti', 'Contaminazione incrociata rifiuti', 'B', 'DPI obbligatori; raccolta separata infetti', 'Ispezione visiva; modulo isolamento', 'PCC'),
    ],

    appalto_fresco_caldo: [
      sezRow('RICEVIMENTO PASTI CALDI', 6, W),
      row('Ricevimento', 'T° pasti caldi <65°C', 'B', 'Fornitura min ≥65°C; ispezione visiva', 'Misurazione T° (2 punti); Modulo CCP1', 'CCP1'),
      row('', 'Allergeni non dichiarati', 'C', 'SCIA ' + _forn + '; dichiarazione allergeni scritta', 'Controllo etichetta 100% celiaci', 'PCC'),
      row('', 'Danni / perdite contenitori', 'F', 'Controllo integrità; reso merce danneggiata', 'Ispezione visiva 100%; modulo anomalia', 'PCC'),
      sezRow('STOCCAGGIO TEMPORANEO', 6, W),
      row('Stoccaggio caldo', 'T° scaldavivande <60°C', 'B', 'Preriscaldo scaldavivande; max 30 min in stoccaggio', 'Verifica T° (Modulo 2A); controllo visivo', 'CCP'),
      row('Stoccaggio freddo', 'T° frigo >4°C', 'B', 'Frigoriferi cucinetta verificati giornalmente', 'Verifica T° giornaliera (Modulo 2A/2B)', 'PCC'),
      sezRow('DISTRIBUZIONE', 6, W),
      row('Distribuzione', 'T° carrello <65°C', 'B', 'Carrello caldo precondizionato; max 20 min', 'T° ≥65°C al carico/scarico; Modulo Carrello', 'CCP'),
      row('', 'Errore dieta / allergene', 'C', 'Identificazione vassoio; doppio controllo', 'Verifica nominativo + tipologia dieta 100%', 'PCC'),
      row('', 'Contaminazione celiaci', 'C', 'Procedura celiaci; pasto servito per primo', 'Verifica separazione 100%; firma operatore', 'PCC'),
      sezRow('RACCOLTA E LAVAGGIO', 6, W),
      row('Lavaggio', 'Lavaggio stoviglie insufficiente', 'B', 'Ciclo lavastoviglie ≥80°C', 'Verifica T° ciclo mensile', 'PCC'),
      row('Rifiuti', 'Contaminazione infetti', 'B', 'DPI obbligatori; raccolta separata', 'Ispezione visiva; modulo isolamento', 'PCC'),
    ],

    distribuzione_veicolata: [
      sezRow('RICEVIMENTO PASTI PRONTI', 6, W),
      row('Ricevimento', 'T° caldo <65°C / freddo >4°C', 'B', 'Fornitura certificata; verifica T° bimodale', 'Misurazione T° (2 punti); Modulo CCP1', 'CCP1'),
      row('', 'Allergeni non dichiarati', 'C', 'SCIA ' + _forn + '; dichiarazione allergeni scritta', 'Controllo etichetta 100% celiaci', 'PCC'),
      row('', 'Danni / perdite contenitori', 'F', 'Controllo integrità sigilli; reso merce', 'Ispezione visiva 100%; modulo anomalia', 'PCC'),
      sezRow('STOCCAGGIO TEMPORANEO', 6, W),
      row('Stoccaggio freddo', 'T° frigo >4°C', 'B', 'Frigoriferi nucleo verificati giornalmente', 'Verifica T° giornaliera (Modulo 2A/2B)', 'CCP'),
      row('Stoccaggio caldo', 'T° scaldavivande <60°C', 'B', 'Scaldavivande precondizionato; max 30 min', 'Controllo visivo; verifica T°', 'PCC'),
      ...(sa?.op_cena_abbattuta ? [
        sezRow('RIATTIVAZIONE PASTI ABBATTUTI', 6, W),
        row('Riattivazione', 'T° insufficiente al cuore <75°C', 'B', 'Riattivazione completa a microonde/forno', 'T° al cuore ≥75°C; sonda (Modulo 3A)', 'CCP2'),
        row('', 'Riattivazione multipla (>1)', 'B', 'Max 1 riattivazione; istruzioni operative', 'Registrazione n° riattivazioni; smaltire se >1', 'PCC'),
      ] : []),
      sezRow('DISTRIBUZIONE', 6, W),
      row('Distribuzione', 'T° carrello <65°C', 'B', 'Carrello caldo precondizionato; max 20 min', 'T° ≥65°C al carico/scarico; Modulo Carrello', 'CCP'),
      row('', 'Errore dieta / allergene', 'C', 'Identificazione vassoio; controllo nominativo', 'Verifica nominativo + tipologia dieta 100%', 'PCC'),
      row('', 'Contaminazione celiaci', 'C', 'Procedura celiaci; pasto servito per primo', 'Verifica separazione 100%; firma operatore', 'PCC'),
      sezRow('RACCOLTA E LAVAGGIO', 6, W),
      row('Lavaggio', 'Lavaggio stoviglie insufficiente', 'B', 'Ciclo lavastoviglie ≥80°C', 'Verifica T° ciclo mensile', 'PCC'),
      row('Rifiuti', 'Contaminazione infetti', 'B', 'DPI obbligatori; raccolta separata', 'Ispezione visiva; modulo isolamento', 'PCC'),
    ],
  };

  const righe = righePerModello[modello] || righePerModello.distribuzione_veicolata;

  return new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: cols,
    rows: [header, ...righe],
  });
}

// ═══════════════════════════════════════════════════════════════
// SEZIONE 4 — Parser e tabella apparecchiature da profilo
// ═══════════════════════════════════════════════════════════════

// Parsa il campo apparecchiature_frigorifere dal profilo
// Formato: "FR1 – Frigorifero cucinetta nucleo AS" (una per riga)
// Convenzione codici: F=frigo cucina, C=congelatore cucina,
//   FR=frigo reparto, FD=frigo disfagici, CR=congelatore reparto
function parseApparecchiature(raw) {
  if (!raw || !raw.trim()) return [];
  return raw.split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => {
      // Separa codice e descrizione su separatori – - :
      const m = l.match(/^([A-Z][A-Z0-9]*)\s*[–\-:]\s*(.+)$/);
      if (!m) return { id: '?', desc: l, tipo: 'Attrezzatura', parametro: '—', note: '' };
      const id   = m[1].trim();
      const desc = m[2].trim();
      // Tipo e parametro dal codice
      let tipo, parametro, note = '';
      if (/^F\d*$/.test(id))       { tipo = 'Frigorifero cucina';    parametro = '≤4°C';  note = 'Scheda 2A unica'; }
      else if (/^C\d*$/.test(id))  { tipo = 'Congelatore cucina';   parametro = '≤-18°C'; note = 'Scheda 2B unica'; }
      else if (/^FR\d+$/.test(id)) { tipo = 'Frigorifero reparto';  parametro = '≤4°C';  note = 'Scheda 2A dedicata'; }
      else if (/^FD$/.test(id))     { tipo = 'Frigo disfagici';      parametro = '≤4°C';  note = 'Scheda 2A dedicata'; }
      else if (/^CR\d+$/.test(id)) { tipo = 'Congelatore reparto';  parametro = '≤-18°C'; note = 'Scheda 2B dedicata'; }
      else if (/scaldavivande/i.test(desc)) { tipo = 'Scaldavivande'; parametro = '≥60°C'; note = ''; }
      else if (/carrello/i.test(desc))      { tipo = 'Carrello termico'; parametro = '≥65°C / ≤10°C'; note = ''; }
      else if (/forno/i.test(desc))         { tipo = 'Forno';          parametro = '≤250°C'; note = ''; }
      else { tipo = 'Attrezzatura'; parametro = '—'; note = ''; }
      return { id, desc, tipo, parametro, note };
    });
}

function tabellaApparecchiature(rawApparecchiature) {
  const righe = parseApparecchiature(rawApparecchiature);
  const c0 = Math.round(CONTENT_W * 0.10);
  const c1 = Math.round(CONTENT_W * 0.28);
  const c2 = Math.round(CONTENT_W * 0.20);
  const c3 = Math.round(CONTENT_W * 0.18);
  const c4 = CONTENT_W - c0 - c1 - c2 - c3;
  
  if (righe.length === 0) {
    return p([r('Nessuna apparecchiatura frigorifica in gestione OSA.', { italic: true, color: '888888' })]);
  }

  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [c0, c1, c2, c3, c4],
    rows: [
      new TableRow({ tableHeader: true, children: [
        hCell('Cod.',c0), hCell('Descrizione',c1), hCell('Tipo',c2), hCell('T° controllo',c3), hCell('Monitoraggio',c4)
      ]}),
      ...righe.map(row => new TableRow({ children: [
        cell(row.id,   c0, { bold: true, color: VERDE, fill: VERDE_LIGHT }),
        cell(row.desc, c1),
        cell(row.tipo, c2),
        cell(row.parametro, c3, { align: AlignmentType.CENTER }),
        cell(row.note, c4),
      ]})),
    ],
  });
}

// ═══════════════════════════════════════════════════════════════
// SEZIONE 10 — Piano analisi microbiologiche
// ═══════════════════════════════════════════════════════════════



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
        ['HACCP base — igiene e sicurezza alimentare', 'All\'assunzione', '4h', 'Tutto il personale che manipola alimenti', 'Registro presenza + test valutazione + attestato'],
        ['Aggiornamento HACCP', 'Triennale', '4h', 'Tutto il personale che manipola alimenti', 'Registro presenza + firma + attestato'],
        ['Gestione ospiti celiaci e allergeni', 'Biennale', '2h', 'ASA/OSS distribuzione', 'Scheda formazione individuale'],
        ['Uso corretto termometro e registrazioni (incluso in formazione base)', 'Triennale', '1h', 'Tutto il personale che manipola alimenti', 'Verifica pratica'],
        ['Corso R-HACCP', 'Alla nomina', '8h', 'R-HACCP', 'Registro + Attestato'],
        ['Corso R-HACCP aggiornamento', 'Triennale', '4h', 'R-HACCP', 'Registro + Attestato'],
      ].map(r => new TableRow({ children: r.map((v, i) => cell(v, [c0,c1,c2,c3,c4][i])) })),
    ],
  });
}

// ═══════════════════════════════════════════════════════════════
// SEZIONE 12 — Manutenzione e taratura
// ═══════════════════════════════════════════════════════════════

function tabellaManutenzione(apparecchiatureFrigorifere) {
  const c0 = Math.round(CONTENT_W * 0.20);
  const c1 = Math.round(CONTENT_W * 0.14);
  const c2 = Math.round(CONTENT_W * 0.12);
  const c3 = Math.round(CONTENT_W * 0.14);
  const c4 = Math.round(CONTENT_W * 0.20);
  const c5 = CONTENT_W - c0 - c1 - c2 - c3 - c4;

  // Ricava lista frigo reali da profilo
  const appRaw = apparecchiatureFrigorifere || '';
  const frigoList = appRaw.split('\n').map(r => r.trim()).filter(Boolean)
    .map(r => r.split(/[\u2013\-:]/)[0].trim()).join(', ') || 'Frigoriferi in gestione';

  const righe = [
    [frigoList, 'Verifica T° con sonda esterna', 'Giornaliera', 'ASA incaricato', 'Modulo temperatura frigo', '±1°C vs display'],
    [frigoList, 'Pulizia interna + guarnizioni', 'Mensile', 'ASA incaricato', 'Piano sanificazione', '—'],
    ['Termometri a sonda', 'Taratura vs riferimento', 'Annuale', 'R-HACCP', 'Certificato taratura', '±0,5°C'],
    ['Zona riattivazione (microonde/forno)', 'Verifica corretto funzionamento', 'Settimanale', 'ASA incaricato', 'Piano sanificazione', '—'],
    ['Zona riattivazione (microonde/forno)', 'Pulizia interna', 'Giornaliera', 'ASA incaricato', 'Piano sanificazione', '—'],
    ['Forno riattivazione (se presente)', 'Verifica funzionamento + pulizia', 'Settimanale', 'ASA incaricato', 'Piano sanificazione', '—'],
    ['Forno riattivazione (se presente)', 'Taratura temperatura', 'Annuale', 'Ditta esterna', 'Rapporto tecnico', '±5°C'],
    ['Lavastoviglie', 'Verifica T° ciclo lavaggio', 'Mensile', 'ASA incaricato', 'Piano sanificazione', 'Min 80°C'],
  ];

  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [c0, c1, c2, c3, c4, c5],
    rows: [
      new TableRow({ tableHeader: true, children: [hCell('Attrezzatura',c0), hCell('Attività',c1), hCell('Freq.',c2), hCell('Responsabile',c3), hCell('Registrazione',c4), hCell('Tolleranza',c5)] }),
      ...righe.map((r, i) => new TableRow({ children: r.map((v, j) => cell(v, [c0,c1,c2,c3,c4,c5][j], { fill: i%2===0?VERDE_LIGHT:'FFFFFF', bc:'DDDDDD' })) })),
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
      new TableRow({ children: [cell('Legale Rappresentante',c0,{fill:VERDE_LIGHT}), cell(lr||'—',c1), cell('Responsabilità legale del sistema HACCP; approvazione manuale; decisioni di alto livello',c2)] }),
      new TableRow({ children: [cell('Responsabile HACCP',c0,{fill:VERDE_LIGHT}), cell(rHaccp||'—',c1), cell('Redazione e aggiornamento manuale; formazione personale; gestione non conformità; verifiche periodiche; rapporti con ASL',c2)] }),
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

function indice(sezioniManuale = null) {
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
    ...(!sezioniManuale || sezioniManuale.includes('microbio') ? [{ l:1, n:'10', t:'Piano Analisi Microbiologiche' }] : []),
    ...(!sezioniManuale || sezioniManuale.includes('formazione') ? [{ l:1, n:'', t:'Piano di Formazione del Personale' }] : []),
    ...(!sezioniManuale || sezioniManuale.includes('manutenzione') ? [{ l:1, n:'', t:'Manutenzione e Taratura Attrezzature' }] : []),
    { l:1, n:'', t:'M.O.C.A. — Materiali e Oggetti a Contatto con Alimenti' },
    { l:2, n:'', t:'Obblighi operativi' },
    { l:2, n:'', t:'Carta di alluminio — precauzioni specifiche' },
    { l:1, n:'', t:'Acrilammide — Misure di Attenuazione' },
    { l:2, n:'', t:'Prodotti da forno e cereali' },
    { l:2, n:'', t:'Frittura e prodotti fritti' },
  ];

  return voci.map(v => {
    if (v.l === 1) {
      return new Paragraph({
        spacing: { before: 180, after: 60 },
        children: [
          ...(v.n ? [r(v.n + '.  ', { size: 22, bold: true, color: VERDE })] : [r('◆  ', { size: 18, bold: true, color: VERDE })]),
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
    if (/^#{1,3}\s/.test(t))        { continue; } // salta titoli markdown residui
    if (/^===SEZ_/.test(t))           { break;    } // fermati al prossimo marcatore SEZ
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
    dataRev          = new Date().toLocaleDateString('it-IT'),
    redattore        = 'Ufficio Qualità OVER',
    noteRevisione    = 'Prima emissione',
    revStorico       = [],
    testoManuale     = '',   // testo AI puro, senza markdown strutturale
    logoVariante     = 'B',
    // Dati dal profilo HACCP
    fornitoreNome              = '',  // haccp_profili.fornitore_nome
    fornitorePiva              = '',  // haccp_profili.fornitore_piva
    apparecchiatureFrigorifere = '',  // haccp_profili.apparecchiature_frigorifere
    orariServizio              = '',  // sa.op_orari_distribuzione
    layoutStruttura            = '',  // sa.op_nuclei_note
    opDisfagici                = false,
    opDisfagiciModalita        = 'interna',
    opCenaAbbattuta            = false,
    opMonousoInfetti           = false,
    opCeliaciaNote             = '',
    descrizioneAmbienti        = '',  // sa.descrizione_ambienti
    opMocaNote                 = '',  // sa.op_moca_note
    // Cucina interna only
    opFrittura                 = false,
    // Piano analisi microbiologiche
    analisiProblemiRecenti     = false,
    analisiAcquaBottiglia      = null,
    analisiFrequenze           = { superfici:'annuale', mani:'annuale', stoviglie:'annuale', acqua:'annuale' },
    // Sezioni manuale attive (array di chiavi da profilo)
    sezioniManuale             = null,
    // Normativa regionale dal DB (array di { riferimento, oggetto, prescrizione, note })
    normativaRegionale         = null,
    // Configurazione cucina interna
    cucina                     = {},
  } = params;

  // Inietta variabili modulo per funzioni top-level
  _forn          = fornitoreNome || 'Fornitore esterno';
  _params        = params;
  const isCucinaInterna = modello === 'cucina_interna';
  const MODELLO_LABEL = {
    cucina_interna:          'Cucina interna',
    appalto_fresco_caldo:    'Appalto fresco-caldo in struttura',
    distribuzione_veicolata: 'Distribuzione veicolata (pasti da esterno)',
  };
  const modelloLabel = MODELLO_LABEL[modello] || modello;

  const logoCfg  = LOGOS[logoVariante] || LOGOS.B;
  const logoData = logoCfg.data();
  const revLabel = numRev;

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
        r(numRev, { size: 18, color: VERDE, bold: true }),  // footer: solo rev ufficiale, no suffisso interno
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
    ...indice(sezioniManuale),
    new Paragraph({ children: [new PageBreak()] }),
  ];

  // ── Estrai blocchi testo AI per sezione ───────────────────────
  // Il testo AI è diviso da marcatori "===SEZ_N===" oppure usiamo fallback generico
  function extractSez(testo, n) {
    const re = new RegExp(`===SEZ_${n}===([\\s\\S]*?)(?:===SEZ_[\\w]+===|$)`, 'i');
    const m  = String(testo).match(re);
    return m ? m[1].trim() : '';
  }


  // ── Normativa regionale per §10.4 — viene dal DB (array righe) o null ──
  // normativaRegionale: array di { riferimento, oggetto, prescrizione, note } dal DB
  // normReg alias per compatibilità con il corpo del documento
  const normReg = (normativaRegionale && normativaRegionale.length > 0) ? normativaRegionale : null;

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
      '• Ricevimento pasti pronti e/o abbattuti da centro cottura esterno (' + fornitoreNome + ')',
      '• Stoccaggio brevissimo in frigoriferi di cucinetta (FR1–FR4, FD)',
      '• Riattivazione a caldo di teglie abbattute per la cena (≥75°C al cuore)',
      '• Porzionamento e confezionamento in vassoi',
      '• Distribuzione ai reparti tramite carrello e cucinette di nucleo',
      '• Raccolta e smaltimento rifiuti · Lavaggio stoviglie · Sanificazione locali',
      '',
      'NON rientrano nel campo di applicazione:',
      '• Fasi di produzione, preparazione e cottura presso il centro cottura ' + fornitoreNome,
      '• Monitoraggio dei frigoriferi del fornitore',
      '• Fasi di trasporto termico esterno (competenza logistica fornitore)',
    ].join('\n')),
    h2('1.3 Normativa di Riferimento'),
    ...textToParagraphs([
      '• **Reg. CE 852/2004**: Igiene dei prodotti alimentari — obbligo procedure HACCP per tutti gli operatori del settore alimentare',
      '• **Reg. CE 853/2004**: Norme specifiche igiene alimenti di origine animale',
      '• **Reg. UE 2021/382**: Modifica allegati Reg. CE 852/2004 — cultura della sicurezza alimentare',
      '• **Reg. CE 178/2002**: Principi generali della legislazione alimentare — tracciabilità',
      '• **Reg. UE 1169/2011**: Informazioni sugli alimenti ai consumatori — gestione allergeni',
      '• **Reg. CE 2073/2005** (mod. Reg. UE 2020/1475): Criteri microbiologici applicabili ai prodotti alimentari',
      '• **D.Lgs 27/2021**: Adeguamento normativa nazionale ai regolamenti UE',
      '• **D.Lgs 18/2023**: Attuazione Dir. UE 2020/2184 — qualità delle acque destinate al consumo umano (abroga D.Lgs. 31/2001)',
      '• **D.Lgs 81/2008**: Sicurezza nei luoghi di lavoro — idoneità sanitaria personale a contatto con alimenti',
    ].join('\n')),
    // Box rimando normativa regionale
    new Table({
      width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: [CONTENT_W],
      rows: [new TableRow({ children: [new TableCell({
        width: { size: CONTENT_W, type: WidthType.DXA },
        borders: { top: B(VERDE), bottom: B(VERDE), left: B(VERDE), right: B(VERDE) },
        shading: { fill: VERDE_LIGHT, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 200, right: 200 },
        children: [
          p([r('Normativa regionale applicabile', { bold: true, color: VERDE, size: 20 })], { after: 60 }),
          p([r("La normativa regionale specifica applicabile alla struttura " + nomestruttura + " — inclusi i criteri microbiologici ambientali per le strutture socio-sanitarie, i piani di sorveglianza Legionella e i protocolli di campionamento definiti dall'autorità sanitaria locale — è riportata in dettaglio al § 10.4 del presente manuale.", { size: 18, color: GRIGIO_TESTO })]),
        ],
      })] })],
    }),
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
      '• Divieto di gioielli, anelli, bracciali e orologi durante il servizio',
      '• Se presenti unghie finte, ricostruite o presenza di smalto deve essere indossato il guanto monouso',
      '• Capelli raccolti e coperti con copricapo',
      '• Segnalazione immediata di ferite, infezioni, sintomi gastrointestinali al R-HACCP',
    ].join('\n')),
    h2('2.2 Pulizia e Sanificazione Locali'),
    txt('La sanificazione si effettua secondo le seguenti fasi operative: rimozione grossolana dello sporco; risciacquo con acqua calda (>40°C); detersione con prodotto indicato nel piano di sanificazione; risciacquo; disinfezione con prodotto sgrassante disinfettante idoneo uso HACCP; asciugatura; verifica visiva.'),
    txt('Le spugne e i panni per la sanificazione vengono igienizzati dopo ogni utilizzo (ammollo in soluzione disinfettante o lavaggio in lavatrice a 60°C). Non miscelare mai prodotti detergenti e disinfettanti.'),
    h3('Pavimenti'),
    ...textToParagraphs([
      "• Sgombrare l'area; scopare e rimuovere lo sporco grossolano",
      '• Preparare soluzione detergente in acqua calda; lavare con mop per sezioni di 20-25 mq',
      '• Strizzare bene e asciugare con mop asciutto',
      '• Ripetere con prodotto disinfettante',
      '• Punti critici: pilette di scarico; residui resistenti',
    ].join('\n')),
    h3('Piani di lavoro e taglieri'),
    ...textToParagraphs([
      '• Rimuovere residui; risciacquare con acqua calda',
      '• Prima pulizia di fondo con disinfettante; risciacquare',
      '• Pulizia/disinfezione con soluzione disinfettante + spugna; lasciare agire 5 min',
      '• Risciacquare abbondantemente con acqua calda; asciugare con carta monouso',
      '• Punti critici: residui resistenti alle operazioni di pulizia',
    ].join('\n')),
    h3('Interno frigoriferi e congelatori'),
    ...textToParagraphs([
      '• Disinserire impianto; svuotare completamente trasferendo alimenti in altro apparecchio',
      '• Eventualmente sbrinare; asportare residui grossolani',
      '• Detergere con idoneo prodotto; risciacquare con acqua calda',
      '• Disinfettare; lasciare agire 5 min; risciacquare; asciugare accuratamente',
      '• Punti critici: non interrompere catena del freddo; punti di difficile accesso',
    ].join('\n')),
    h3('Scaffalature, arredi, tavoli e sedie'),
    ...textToParagraphs([
      "• Allontanare alimenti dall'area; rimuovere sporco con straccio umido",
      '• Risciacquare con acqua calda; spruzzare prodotto detergente; lasciare agire',
      '• Passare con carta monouso; ripetere con prodotto disinfettante',
    ].join('\n')),
    h3('Vetri, plafoniere e pareti lavabili'),
    ...textToParagraphs([
      "• Allontanare alimenti dall'area circostante; rimuovere sporco grossolano",
      '• Spruzzare prodotto detergente/disinfettante; lasciare agire; passare con carta monouso; risciacquare',
      '• Punti critici: sollevamento polvere durante la pulizia; allontanamento preventivo alimenti',
    ].join('\n')),
    h3('Lavastoviglie'),
    ...textToParagraphs([
      '• Disincrostare dal calcare formatosi nei precedenti lavaggi',
      '• Verificare che gli ugelli di espulsione acqua siano liberi da incrostazioni e residui',
      "• Procedere come da manuale di manutenzione dell'apparecchiatura",
      '• Frequenza: pulizia filtri giornaliera; pulizia completa settimanale',
    ].join('\n')),
    h3('Contenitori rifiuti'),
    ...textToParagraphs([
      '• Svuotare il contenitore; sciacquare con acqua corrente',
      '• Pulizia e disinfezione con prodotto combinato; lavare e spazzolare accuratamente; risciacquare con acqua calda',
      '• Frequenza: giornaliera',
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
    h2('3.2 Ruoli e Responsabilità'),
    ...textToParagraphs([
      '• Il Responsabile HACCP organizza riunioni trimestrali per revisione non conformità e aggiornamento procedure',
      '• Bacheca informativa in ogni cucinetta di nucleo con contatti R-HACCP e procedure di emergenza',
      '• Ogni non conformità rilevata viene registrata sul supporto cartaceo e sul software aziendale e gestita entro 24h',
    ].join('\n')),
    new Paragraph({ children: [new PageBreak()] }),

    // ── SEZ 4: Struttura e Locali ────────────────────────────
    h1('4. DESCRIZIONE DELLA STRUTTURA E LOCALI'),
    h2('4.1 Anagrafica'),
    tabellaDati([
      ['Struttura',            nomestruttura],
      ['Ragione sociale OSA',  osa],
      ['P.IVA',                pivaOsa],
      ['Modello ristorazione', modelloLabel],
      ...(modello !== 'cucina_interna' ? [
        ['Fornitore pasti',    fornitoreNome || '—'],
        ['P.IVA fornitore',    fornitorePiva || '—'],
      ] : []),
      ['Referente HACCP',      rHaccp],
    ]),
    ...spacer(1),
    h2('4.2 Layout Nuclei e Locali'),
    ...textToParagraphs(layoutStruttura || descrizioneAmbienti || 'Struttura organizzata in nuclei residenziali dotati di cucinetta attrezzata.'),
    h2('4.3 Apparecchiature in Gestione OSA'),
    tabellaApparecchiature(apparecchiatureFrigorifere),
    ...spacer(1),
    h2('4.4 Orari di Servizio e Distribuzione'),
    ...textToParagraphs(orariServizio || 'Orari di distribuzione definiti dalla struttura.'),
    new Paragraph({ children: [new PageBreak()] }),

    // ── SEZ 5: Diagrammi di flusso (condizionali per modello) ──
    h1('5. DIAGRAMMI DI FLUSSO'),
    txt('I seguenti diagrammi illustrano i flussi operativi di competenza dell\'OSA ' + nomestruttura + '. I CCP (Punti Critici di Controllo) sono evidenziati in verde acqua.'),
    ...spacer(1),
    ...buildSezione5(),
    new Paragraph({ children: [new PageBreak()] }),

    // ── SEZ 6: Analisi pericoli CCP ──────────────────────────
    h1('6. ANALISI PERICOLI E IDENTIFICAZIONE CCP'),
    h2('6.1 Metodologia HACCP'),
    txt('Per ciascuna fase identificata nei diagrammi di flusso, è stata effettuata un\'analisi qualitativa del rischio secondo la formula Rischio = Probabilità × Severità. Sono stati identificati i pericoli biologici (B), chimici (C) e fisici (F). Le misure di controllo sono state classificate come CCP (Punto Critico di Controllo — limite misurabile con azione correttiva immediata) o PCC (misura preventiva senza limite critico formale).'),
    h2('6.2 CCP Identificati'),
    ...(isCucinaInterna ? [
      txt('**CCP1 — Ricevimento materie prime:** verifica temperatura T° ingresso per categoria (carni/pesce 0–4°C, latticini 4°C, surgelati ≤-18°C, secco t.a.). Azione correttiva: rifiuto fornitore + modulo non conformità.'),
      txt('**CCP2 — Cottura:** raggiungimento T° al cuore ≥75°C verificato con sonda calibrata. Azione correttiva: prolungamento cottura; se non raggiungibile → smaltimento e segnalazione R-HACCP.'),
      ...((cucina?.zone || []).includes('abbattitore') ? [
        txt('**CCP Abbattimento:** raffreddamento da >65°C a <10°C in ≤90 min (Modulo 3C). **CCP Rigenerazione:** T° al cuore ≥75°C verificato con sonda. Azione correttiva: smaltimento se tempi o temperature non rispettati.'),
      ] : []),
    ] : modello === 'appalto_fresco_caldo' ? [
      txt('**CCP1 — Ricevimento pasti caldi:** verifica temperatura ≥65°C al ricevimento (2 punti di misurazione). Azione correttiva: rifiuto e restituzione al fornitore con compilazione Modulo CCP1.'),
    ] : [
      txt('**CCP1 — Ricevimento pasti:** verifica temperatura bimodale — caldo ≥65°C / freddo ≤4°C al ricevimento (2 punti di misurazione). Azione correttiva: rifiuto e restituzione al fornitore con compilazione Modulo CCP1.'),
      ...(opCenaAbbattuta ? [
        txt('**CCP2 — Riattivazione pasti abbattuti:** raggiungimento T° al cuore ≥75°C a microonde o forno. Azione correttiva: riscaldamento supplementare; se non raggiungibile dopo 2 cicli → smaltimento e segnalazione R-HACCP.'),
      ] : []),
    ]),
    h2('6.3 Matrice Analisi Pericoli per Fase'),
    ...spacer(1),
    tabellaCCP(modello, { cucina, op_cena_abbattuta: opCenaAbbattuta }),
    ...spacer(1),
    new Paragraph({ children: [new PageBreak()] }),

    // ── SEZ 7: Celiachia e allergeni ─────────────────────────
    h1('7. GESTIONE CELIACHIA E ALLERGENI'),
    txt('La struttura applica il Reg. UE 1169/2011 garantendo la tracciabilità degli alimenti per celiaci e allergici dal fornitore all\'ospite. La gestione allergeni è un prerequisito HACCP fondamentale per la tutela degli ospiti con patologie alimentari certificate.'),
    ...(opCeliaciaNote ? [txt('Specificità della struttura: ' + opCeliaciaNote)] : []),
    h2('7.1 Normativa e Responsabilità'),
    ...textToParagraphs([
      '• **Tracciabilità** da fornitore a ospite per tutti gli alimenti con allergeni dichiarati',
      '• **Prevenzione contaminazione incrociata** durante manipolazione, porzionamento, distribuzione',
      '• **Documentazione** ricezione pasti celiaci e lista ospiti allergici aggiornata',
    ].join('\n')),
    h2('7.2 Registro Ospiti Celiaci e Allergici'),
    ...textToParagraphs([
      'All\'ammissione il Responsabile raccoglie: nome e cognome, data di nascita, allergia certificata, livello di reazione, istruzioni dietetiche specifiche.',
      '',
      'Il registro è conservato in formato cartaceo (fascicolo paziente) e digitale per l\'intero periodo di ospitalità più 2 anni dalla dimissione. Accesso limitato a R-HACCP, Responsabile di struttura e medico.',
    ].join('\n')),
    h2('7.3 ' + (modello === 'cucina_interna'
      ? 'Preparazione Pasti Celiaci in Zona Dedicata'
      : 'Ricezione Pasti Celiaci e Stoccaggio')),
    ...(modello === 'cucina_interna' ? [
      bullet('Piano lavoro sanificato con detergente neutro + carta monouso prima dell\'uso'),
      bullet('Utensili e teglie dedicati con etichetta verde "CELIACO"'),
      bullet('Preparazione sempre per prima, prima di qualsiasi altro alimento'),
      bullet('Guanti nuovi dopo lavaggio mani'),
    ] : [
      bullet('Al ricevimento: verifica etichetta e dichiarazione allergeni del fornitore ' + fornitoreNome),
      bullet('Stoccaggio: contenitore etichettato "CELIACO – [NOME OSPITE]" nel ripiano SUPERIORE del frigorifero di nucleo; segregazione da pane, pasta e cereali'),
      bullet('Distribuzione: vassoio identificato con nome e allergeni; verifica tripla nominativo prima della consegna'),
    ]),
    h2('7.4 Procedura d\'Oro — Servizio Celiaci'),
    ...textToParagraphs([
      'REGOLA ASSOLUTA: il pasto celiaco deve essere servito PER PRIMO nel nucleo, prima di qualsiasi altro ospite.',
      '',
      '1. Identificare il pasto celiaco — da frigorifero dedicato o direttamente dalla cucina — verificando etichetta nominativo e livello IDDSI se applicabile.',
      '2. Guanti monouso nuovi',
      '3. Porzionamento su vassoio BLU dedicato etichettato "CELIACO"',
      '4. Distribuzione: consegna diretta all\'ospite con vassoio identificato; l\'ospite può consumare il pasto in sala insieme agli altri — verificare che non avvenga scambio di alimenti con altri commensali.',
      '5. Cambio guanti + igiene mani prima di servire altri ospiti',
    ].join('\n')),
    h2('7.5 Gestione Contaminazione Incrociata'),
    ...textToParagraphs([
      'In caso di contatto accidentale tra pasto celiaco e alimenti con glutine:',
      '1. Scartare immediatamente il pasto celiaco',
      '2. Contattare il Responsabile di struttura per monitoraggio ospite',
      '3. Registrare su modulo "Non Conformità Celiachia"',
      '4. Sanificare piano di lavoro con detergente neutro + panno monouso',
    ].join('\n')),
    h2('7.6 Allergeni Diversi da Celiachia'),
    txt('Per i 14 allergeni obbligatori Reg. UE 1169/2011, le informazioni relative ad allergie degli ospiti vengono raccolte al momento dell\'ammissione e comunicate al fornitore dei pasti per la predisposizione di menu personalizzati.'),
    ...textToParagraphs([
      '• Al ricevimento: verifica etichetta e dichiarazione allergeni del fornitore',
      '• Stoccaggio: contenitore etichettato "ALLERGIA – [NOME OSPITE] – [ALLERGENE]" in ripiano dedicato',
      '• Distribuzione: vassoio identificato con nome e allergeni; verifica tripla nominativo prima della consegna',
      '• Elenco 14 allergeni obbligatori (Reg. UE 1169/2011): cereali con glutine, crostacei, uova, pesce, arachidi, soia, latte, frutta a guscio, sedano, senape, sesamo, anidride solforosa/solfiti, lupino, molluschi',
    ].join('\n')),
    h2('7.7 Procedura operativa per ospite allergico'),
    ...textToParagraphs([
      "1. Controllo incrociato tra allergeni dell'ospite e ingredienti del pasto — verificare etichette prodotti preconfezionati (salse, dolci ecc.)",
      "2. Se l'ingrediente allergenico è presente: contattare il fornitore per pasto alternativo privo dell'allergene",
      '3. Lavorazione/riscaldamento pasto allergico: sempre per primo, con utensili puliti o dedicati, mani lavate con acqua e sapone (i guanti da soli non bastano)',
      '4. Distribuzione: pasto consegnato per primo, con vassoio identificato, verifica nominativo + allergene da parte dell\'addetto',
      '5. In caso di reazione allergica: interrompere immediatamente somministrazione, contattare medico/infermiere, registrare l\'evento come NC grave',
    ].join('\n')),
    new Paragraph({ children: [new PageBreak()] }),

    // ── SEZ 8: Disfagici ──────────────────────────────────────
    h1('8. GESTIONE OSPITI DISFAGICI'),
    ...(opDisfagici ? [
      h2('8.1 Classificazione IDDSI'),
      txt('La struttura adotta la classificazione internazionale IDDSI (International Dysphagia Diet Standardisation Initiative) per la gestione dei pasti texturizzati. I livelli applicabili in struttura sono definiti dal medico responsabile per ogni ospite.'),
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
      h2('8.2 ' + (modello === 'cucina_interna' && opDisfagiciModalita === 'interna'
        ? 'Preparazione e Texturizzazione Pasti Disfagici'
        : 'Ricezione e Stoccaggio Pasti Disfagici')),
      ...(modello === 'cucina_interna' && opDisfagiciModalita === 'interna' ? [
        bullet('Frullatura/texturizzazione eseguita dopo cottura standard con frullatore dedicato'),
        bullet('Utensili igienizzati prima e dopo ogni utilizzo'),
        bullet('Texturizzazione secondo livello IDDSI prescritto — verificare consistenza prima del servizio'),
        bullet('Etichettatura immediata: contenitore con nome ospite, livello IDDSI, data e ora preparazione'),
        bullet('Stoccaggio in frigorifero dedicato FD a ≤4°C se non servito immediatamente'),
      ] : [
        bullet('Al ricevimento: verifica etichetta con livello IDDSI, nominativo ospite, scadenza e allergeni'),
        bullet('Verifica integrità confezione e temperatura di consegna'),
        bullet('Stoccaggio in frigorifero dedicato FD a ≤4°C'),
        bullet('Separazione fisica dai pasti standard — ripiano o contenitore dedicato'),
      ]),
      h2('8.3 ' + (modello === 'cucina_interna' && opDisfagiciModalita === 'interna'
        ? 'Identificazione e Stoccaggio'
        : 'Riattivazione e Identificazione')),
      ...(modello === 'cucina_interna' && opDisfagiciModalita === 'interna' ? [
        bullet('Ogni contenitore etichettato con: nome ospite · livello IDDSI · data e ora preparazione'),
        bullet('Verifica visiva consistenza prima del servizio'),
        bullet('Se non conforme: rifacimento immediato — non servire mai prodotto di consistenza dubbia'),
      ] : [
        bullet('Riattivazione a microonde o forno: T° al cuore ≥75°C verificata con sonda'),
        bullet('Verifica consistenza post-riattivazione — la textura non deve modificarsi con il calore'),
        bullet('Etichetta nominativo verificata prima del servizio: nome ospite · livello IDDSI'),
      ]),
      h2('8.4 Distribuzione e Somministrazione'),
      bullet('Distribuzione sempre identificata: vassoio/contenitore con nome ospite e livello IDDSI visibile'),
      bullet('Consegna diretta all\'operatore o all\'infermiere responsabile — mai lasciato incustodito'),
      bullet('Verifica nominativo + livello IDDSI prima della somministrazione'),
      bullet('In caso di dubbio sulla consistenza: non somministrare, avvisare il R-HACCP'),
      bullet('Modifiche al livello IDDSI: solo su prescrizione medica — aggiornare immediatamente scheda ospite'),
      h2('8.5 Documentazione e Modifiche IDDSI Level'),
      bullet('Registro ospiti disfagici aggiornato dal R-HACCP con: nome · livello IDDSI · data prescrizione · medico'),
      bullet('Ogni modifica di livello documentata su scheda individuale e comunicata al fornitore (se appalto/veicolata)'),
      bullet('Registrazione NC su modulo dedicato in caso di errore di livello o consistenza non conforme'),
      new Paragraph({ children: [new PageBreak()] }),
    ] : [
      txt('La struttura non accoglie al momento ospiti con disfagia. In caso di ammissione di ospiti con necessità di dieta texturizzata, il R-HACCP provvederà ad attivare le procedure specifiche e ad aggiornare il presente manuale.'),
      new Paragraph({ children: [new PageBreak()] }),
    ]),

    // ── SEZ 9: Isolamento infettivo ───────────────────────────
    h1('9. GESTIONE ISOLAMENTO INFETTIVO'),
    ...(opMonousoInfetti ? [
      h2('9.1 Protocollo e Notifica'),
      txt('Quando un ospite è in isolamento infettivo (C. difficile, SARS-CoV-2, Norovirus, VRE ecc.), il Medico curante o il Responsabile di struttura emette il modulo "Avviso Isolamento Infettivo" affisso in cucinetta nucleo, bacheca portineria e inviato via email al team HACCP.'),
      h2('9.2 Approvvigionamento Monouso'),
      txt('Il magazzino mantiene scorta per almeno 5 giorni di: vassoi monouso bianchi (cartone + PE), piatti piani e fondi monouso, bicchieri, posate, contenitori rossi "RIFIUTI BIOLOGICI".'),
      h2('9.3 Preparazione e Consegna Pasto'),
      numbered(1, 'Porzionamento pasto ULTIMO dopo tutti gli altri ospiti'),
      numbered(2, 'DPI obbligatori: guanti nitrile nuovi per ogni pasto, mascherina chirurgica, grembiule monouso'),
      numbered(3, 'Vassoio monouso bianco con stoviglie monouso e coperchio sigillo'),
      numbered(4, 'Identificazione vassoio "ISOLAMENTO INFETTIVO" con nome ospite, stanza, ora preparazione'),
      numbered(5, 'Cambio guanti prima ingresso stanza; consegna diretta; nessun contatto con stoviglie riutilizzabili'),
      h2('9.4 Smaltimento e Sanificazione'),
      bullet('Raccolta vassoio con DPI da parte dello stesso operatore'),
      bullet('Inserimento in sacchetto separato etichettato "BIOHAZARD ISOLAMENTO"'),
      bullet('Conferimento giornaliero a ditta smaltimento rifiuti speciali autorizzata'),
      bullet('Sanificazione stanza con cloro 0,5% o equivalente, contatto minimo 10 min, asciugatura'),
      bullet('Registrazione su modulo isolamento; firma R-HACCP; archiviazione'),
      new Paragraph({ children: [new PageBreak()] }),
    ] : [
      txt('La struttura non gestisce al momento situazioni di isolamento infettivo con protocollo pasti dedicato. In caso di attivazione di isolamento infettivo, il R-HACCP provvederà ad attivare le procedure specifiche e ad aggiornare il presente manuale.'),
      new Paragraph({ children: [new PageBreak()] }),
    ]),

    // ── SEZ 10: Piano analisi microbiologiche ────────────────────
    h1('10. PIANO ANALISI MICROBIOLOGICHE'),
    ...(!sezioniManuale || sezioniManuale.includes('microbio') ? [
    h2('10.1 Responsabilità e perimetri'),
    ...(() => {
      const c0 = Math.round(CONTENT_W * 0.22);
      const c1 = CONTENT_W - c0;
      return [new Table({
        width:{size:CONTENT_W,type:WidthType.DXA}, columnWidths:[c0,c1],
        rows:[
          new TableRow({ children:[
            new TableCell({width:{size:c0,type:WidthType.DXA},borders:{top:B(VERDE),bottom:B(VERDE),left:B(VERDE),right:B(VERDE)},shading:{fill:VERDE,type:ShadingType.CLEAR},margins:{top:80,bottom:80,left:160,right:160},children:[
              p([r('R-HACCP',{bold:true,color:'FFFFFF',size:20})],{after:40}),
              p([r('Responsabile Autocontrollo',{color:'FFFFFF',size:17,italic:true})],{after:0}),
            ]}),
            new TableCell({width:{size:c1,type:WidthType.DXA},borders:{top:B(VERDE),bottom:B(VERDE),left:B(VERDE),right:B(VERDE)},shading:{fill:VERDE_LIGHT,type:ShadingType.CLEAR},margins:{top:80,bottom:80,left:200,right:200},children:[
              txt('Campionamenti su superfici, attrezzature, mani operatori e acqua utilizzata come ingrediente o per pulizia attrezzature cucina. Base normativa: Reg. CE 852/2004 All. II Cap. VII + Reg. CE 2073/2005 (mod. Reg. UE 2020/1475).'),
            ]}),
          ]}),
          new TableRow({ children:[
            new TableCell({width:{size:c0,type:WidthType.DXA},borders:{top:B(VERDE),bottom:B(VERDE),left:B(VERDE),right:B(VERDE)},shading:{fill:VERDE,type:ShadingType.CLEAR},margins:{top:80,bottom:80,left:160,right:160},children:[
              p([r('GIDI / RSPP',{bold:true,color:'FFFFFF',size:20})],{after:40}),
              p([r('Gestore Interno Distribuzione Idrica',{color:'FFFFFF',size:17,italic:true})],{after:0}),
            ]}),
            new TableCell({width:{size:c1,type:WidthType.DXA},borders:{top:B(VERDE),bottom:B(VERDE),left:B(VERDE),right:B(VERDE)},shading:{fill:'F8F8F8',type:ShadingType.CLEAR},margins:{top:80,bottom:80,left:200,right:200},children:[
              txt('Monitoraggio intera rete idrica edificio nell\'ambito del Piano di Valutazione e Gestione del Rischio (PVGR). Base normativa: D.Lgs. 18/2023 Art. 9. Il controllo Legionella è di competenza esclusiva del GIDI/RSPP — non incluso nel presente piano HACCP.'),
            ]}),
          ]}),
        ],
      })];
    })(),
    ...spacer(1),
    h2('10.2 Piano campionamenti R-HACCP'),
    ...(() => {
      const freq = analisiFrequenze || { superfici:'annuale', mani:'annuale', stoviglie:'annuale', acqua:'annuale' };
      const appRaw = params.apparecchiatureFrigorifere || '';
      const nCucinette = Math.max(1, appRaw.split('\n').filter(r => /^FR\d+/i.test(r.trim().split(/[\u2013\-:]/)[0].trim())).length || 1);
      const notaAcqua = params.opDistributoreAcqua
        ? 'Potabilità garantita dal fornitore del microfiltratore (certificato annuale). Campionamento interno: rubinetto cucina/cucinetta.'
        : analisiAcquaBottiglia
          ? 'Ospiti consumano acqua in bottiglia. Campionamento: rubinetto cucina/cucinetta.'
          : 'Acqua di rete erogata agli ospiti. Campionamento: rubinetto cucina/cucinetta + punto/i rete distribuzione ospiti (D.Lgs. 18/2023).';
      const campionamenti = [
        {tipo:'Superfici e piani di lavoro',punto:'Cucinette nucleo (post sanificazione)',freq:freq.superfici,n:nCucinette+' camp.',param:'Enterobatteri, Listeria, CBT',limiti:'Enterobatteri <10 UFC/cm² · Listeria assente',az:'Sanificazione straordinaria; verifica procedura'},
        {tipo:'Mani operatore',punto:'Post lavaggio mani (addetto in servizio)',freq:freq.mani,n:'1 camp.',param:'CBT, Stafilococco aureo',limiti:'CBT <100 UFC/mani',az:'Formazione rinforzo; verifica lavaggio mani'},
        {tipo:'Stoviglie / attrezzature',punto:'A campione a rotazione',freq:freq.stoviglie,n:'1 camp.',param:'CBT, Enterobatteri, Listeria',limiti:'CBT <1 UFC/cm² · Enterobatteri assenti',az:'Revisione ciclo lavaggio; verifica T° ≥80°C'},
        {tipo:'Acqua potabile',punto:params.opDistributoreAcqua?'Rubinetto cucina':analisiAcquaBottiglia?'Rubinetto cucina':'Rubinetto cucina + punto rete',freq:freq.acqua,n:'1-2 camp.',param:'E. coli, Coliformi, Enterococchi, CBT',limiti:'E. coli 0/100ml · Coliformi 0/100ml (D.Lgs. 18/2023)',az:'Comunicazione gestore acquedotto'},
      ];
      const c0=Math.round(CONTENT_W*0.15),c1=Math.round(CONTENT_W*0.15),c2=Math.round(CONTENT_W*0.08);
      const c3=Math.round(CONTENT_W*0.09),c4=Math.round(CONTENT_W*0.18),c5=Math.round(CONTENT_W*0.20);
      const c6=CONTENT_W-c0-c1-c2-c3-c4-c5;
      return [
        ...(analisiProblemiRecenti?[p([r('⚠️ Piano di sorveglianza rafforzato a seguito di non conformità rilevate negli ultimi 12 mesi.',{bold:true,color:'A32D2D',size:18})],{after:100})]:[]),
        new Table({
          width:{size:CONTENT_W,type:WidthType.DXA},columnWidths:[c0,c1,c2,c3,c4,c5,c6],
          rows:[
            new TableRow({tableHeader:true,children:[hCell('Campione',c0),hCell('Punto prelievo',c1),hCell('Freq.',c2),hCell('N°',c3),hCell('Parametri',c4),hCell('Limiti',c5),hCell('Azione correttiva',c6)]}),
            ...campionamenti.map((c,i)=>new TableRow({children:[
              cell(c.tipo,c0,{fill:i%2===0?VERDE_LIGHT:'FFFFFF',bc:'DDDDDD'}),
              cell(c.punto,c1,{fill:i%2===0?VERDE_LIGHT:'FFFFFF',bc:'DDDDDD',size:16}),
              cell(c.freq.charAt(0).toUpperCase()+c.freq.slice(1),c2,{fill:i%2===0?VERDE_LIGHT:'FFFFFF',bc:'DDDDDD',align:AlignmentType.CENTER,bold:true,color:VERDE}),
              cell(String(c.n),c3,{fill:i%2===0?VERDE_LIGHT:'FFFFFF',bc:'DDDDDD',align:AlignmentType.CENTER,size:16}),
              cell(c.param,c4,{fill:i%2===0?VERDE_LIGHT:'FFFFFF',bc:'DDDDDD',size:16}),
              cell(c.limiti,c5,{fill:i%2===0?VERDE_LIGHT:'FFFFFF',bc:'DDDDDD',size:16}),
              cell(c.az,c6,{fill:i%2===0?VERDE_LIGHT:'FFFFFF',bc:'DDDDDD',size:16}),
            ]})),
          ],
        }),
        ...spacer(1),
        p(parseInline('**Acqua potabile:** '+notaAcqua),{after:100}),
        p(parseInline('**Laboratorio:** Campionamenti eseguiti da laboratorio accreditato ACCREDIA su incarico R-HACCP. Risultati archiviati con conservazione minima 3 anni.'),{after:100}),
      ];
    })(),
    ...spacer(1),
    h2('10.3 Gestione non conformità analitiche'),
    ...textToParagraphs([
      'In caso di esito non conforme il R-HACCP:',
      '1. Apre immediatamente un modulo NC (Autoc 6) e lo registra in QualiCAVA',
      '2. Avvia le azioni correttive indicate in tabella',
      '3. Dispone campionamento di verifica entro 30 giorni',
      '4. Se NC riguarda patogeno pericoloso (Listeria, Salmonella, E. coli O157): notifica immediata al Dipartimento di Prevenzione ASL',
      '5. Archivia i rapporti analitici per almeno 5 anni',
    ].join('\n')),
    ...spacer(1),
    h2('10.4 Normativa regionale applicabile'),
    ...(() => {
      if (!normReg || normReg.length === 0) {
        return [
          txt('Fare riferimento al Dipartimento di Prevenzione ATS/ASL competente per territorio per la normativa regionale applicabile.'),
        ];
      }
      const c0=Math.round(CONTENT_W*0.22);
      const c1=Math.round(CONTENT_W*0.22);
      const c2=Math.round(CONTENT_W*0.28);
      const c3=CONTENT_W-c0-c1-c2;
      return [
        new Table({
          width:{size:CONTENT_W,type:WidthType.DXA},columnWidths:[c0,c1,c2,c3],
          rows:[
            new TableRow({children:[
              hCell('Riferimento normativo',c0),
              hCell('Oggetto',c1),
              hCell('Prescrizione specifica RSA',c2),
              hCell('Note / Applicabilità',c3),
            ]}),
            ...normReg.map((nr, i) => new TableRow({children:[
              cell(nr.riferimento||'—', c0, {fill: i%2===0?VERDE_LIGHT:'FFFFFF', bold:true, color:VERDE, bc:'C8E6D0'}),
              cell(nr.oggetto||'—',    c1, {fill: i%2===0?VERDE_LIGHT:'FFFFFF', bc:'C8E6D0'}),
              cell(nr.prescrizione||'—',c2,{fill: i%2===0?VERDE_LIGHT:'FFFFFF', bc:'C8E6D0'}),
              cell(nr.note||'—',       c3, {fill: i%2===0?VERDE_LIGHT:'FFFFFF', bc:'C8E6D0', size:16}),
            ]})),
          ],
        }),
        ...spacer(0.5),
        p([r('Per aggiornamenti locali fare riferimento al Dipartimento di Prevenzione ATS/ASL competente per territorio.',{size:17,italic:true,color:'888888'})]),
      ];
    })(),
    new Paragraph({ children: [new PageBreak()] }),
    ] : [
      txt('La struttura ha valutato che al momento non è necessario ricorrere a piani di analisi microbiologiche periodiche. In caso di variazione delle condizioni operative o su indicazione dell\'autorità sanitaria competente, il R-HACCP provvederà ad attivare il piano e ad aggiornare il presente manuale.'),
      new Paragraph({ children: [new PageBreak()] }),
    ]),  // fine SEZ 10 condizionale (microbio)

    // ── SEZ 11: Piano formazione ─────────────────────────────
    ...(!sezioniManuale || sezioniManuale.includes('formazione') ? [
    h1('11. PIANO DI FORMAZIONE DEL PERSONALE'),
    txt('La formazione continua del personale ASA/OSS è requisito fondamentale del sistema HACCP. Il R-HACCP pianifica e documenta tutte le attività formative secondo il seguente schema:'),
    ...spacer(1),
    // TODO SPRINT FUTURO: frequenze e durate formazione variano per regione.
    // Integrare haccp_normative_regionali con categoria 'formazione' e
    // aggiornare la tabella dinamicamente per regione struttura.
    tabellaFormazione(),
    ...spacer(1),
    txt('La documentazione di ogni corso (registro presenze, attestati, test di valutazione) è archiviata nel fascicolo formazione individuale conservato presso il R-HACCP. L\'idoneità sanitaria del personale a contatto con alimenti è verificata annualmente secondo D.Lgs 81/2008.'),
    new Paragraph({ children: [new PageBreak()] }),
    ] : []),  // fine SEZ 11 condizionale (formazione)

    // ── SEZ 12: Manutenzione e taratura ─────────────────────
    ...(!sezioniManuale || sezioniManuale.includes('manutenzione') ? [
    h1('12. MANUTENZIONE E TARATURA ATTREZZATURE'),
    txt('La manutenzione preventiva e la taratura periodica delle attrezzature è essenziale per garantire l\'efficacia del sistema HACCP, in particolare per le attrezzature che influenzano direttamente i CCP (frigoriferi, termometri a sonda, forni, scaldavivande).'),
    ...spacer(1),
    txt('Le attività di verifica e manutenzione sono affidate all\'ASA incaricato (Addetto Servizio Alimentare) nominato dal R-HACCP, salvo dove indicato diversamente nella tabella seguente.'),
    tabellaManutenzione(apparecchiatureFrigorifere),
    ...spacer(1),
    txt('I rapporti di manutenzione e i certificati di taratura sono conservati dal R-HACCP per almeno 5 anni. Le attrezzature fuori tolleranza vengono messe fuori servizio fino a riparazione/sostituzione e sostituite con attrezzature di riserva documentate.'),
    new Paragraph({ children: [new PageBreak()] }),
    ] : []),  // fine SEZ 12 condizionale (manutenzione)

    // ── SEZ 13: Gestione Fornitori (placeholder) ─────────────
    h1('13. GESTIONE FORNITORI'),
    txt('La struttura ha valutato che al momento non è necessario attivare procedure specifiche di qualifica fornitori nell\'ambito del presente manuale HACCP. I fornitori vengono selezionati sulla base della disponibilità di SCIA o equivalente documentazione di autocontrollo.'),
    new Paragraph({ children: [new PageBreak()] }),

    // ── SEZ 14: Gestione NC alimentari (placeholder) ─────────
    h1('14. GESTIONE NON CONFORMITÀ ALIMENTARI'),
    txt('La struttura gestisce le non conformità alimentari attraverso il Registro Generale NC (Autoc 6). In caso di non conformità rilevante il R-HACCP attiva le azioni correttive previste, documenta l\'evento e comunica all\'autorità sanitaria competente nei tempi prescritti.'),
    new Paragraph({ children: [new PageBreak()] }),

    // ── SEZ 15: Rintracciabilità (placeholder) ───────────────
    h1('15. RINTRACCIABILITÀ'),
    txt('La rintracciabilità degli alimenti è garantita attraverso: conservazione delle bolle di consegna del fornitore per almeno 2 anni; registrazione sui moduli di autocontrollo delle partite in ingresso; applicazione della procedura FIFO in stoccaggio.'),
    new Paragraph({ children: [new PageBreak()] }),

    // ── MOCA ─────────────────────────────────────────────────
    h1('M.O.C.A. — MATERIALI E OGGETTI A CONTATTO CON ALIMENTI'),
    txt('I materiali e oggetti a contatto con gli alimenti (MOCA) sono regolamentati dal Reg. CE 1935/2004 e dai regolamenti specifici per ogni tipologia di materiale. Scopo: garantire che i MOCA non trasferiscano sostanze agli alimenti in quantità tali da rappresentare un pericolo per la salute umana.'),
    h2('Obblighi operativi'),
    ...textToParagraphs([
      "• Tutti i materiali e oggetti a contatto con alimenti devono essere dichiarati idonei — verificare la presenza della dicitura -idoneo al contatto con alimenti- o simbolo calice+forchetta sull'etichetta o scheda tecnica",
      '• Non solo gli imballaggi ma anche tutti gli utensili e le attrezzature usate per preparare, cuocere e servire gli alimenti rientrano nella previsione normativa',
      "• In caso di acquisto al dettaglio: verificare sull'etichetta o su cartellino espositivo la conformità alimentare",
      "• Durante l'attività: verificare il buono stato di conservazione dei MOCA — non utilizzare utensili scheggiati, graffiati o deteriorati",
      '• Eventuali anomalie → registrare sul modulo Non Conformità',
    ].join('\n')),
    h2('Carta di alluminio — precauzioni specifiche'),
    txt('La carta di alluminio a contatto con determinati cibi può cedere ioni di alluminio agli alimenti. I fattori che influiscono: tempo di conservazione, temperatura, composizione dell\'alimento.'),
    ...textToParagraphs([
      '• **NON idonea** al contatto con alimenti fortemente acidi (succo di limone, aceto) o fortemente salati (alici salate, capperi sotto sale)',
      '• Idonea per alimenti a temperature refrigerate; per alimenti a temperatura ambiente max 24h',
      '• Idonea per alimenti a temperatura ambiente anche oltre 24h solo per: cioccolato, caffè, spezie, cereali, paste non fresche, prodotti da forno, legumi secchi, frutta secca, funghi/ortaggi secchi, prodotti della confetteria',
      '• Non riutilizzare mai contenitori monouso (teglie e vaschette)',
      '• Può essere utilizzata per oltre 24h solo a temperatura di refrigerazione',
    ].join('\n')),
    ...(opMocaNote ? [h2('Note specifiche della struttura'), txt(opMocaNote)] : []),

    // ── SEZ 14: ACRILAMMIDE ───────────────────────────────────
    new Paragraph({ children: [new PageBreak()] }),
    h1('ACRILAMMIDE — MISURE DI ATTENUAZIONE'),
    txt("L'acrilammide è una sostanza chimica che si forma naturalmente negli alimenti amidacei durante cotture ad alte temperature (frittura, forno, tostatura) attraverso la reazione di Maillard tra zuccheri e amminoacidi. È classificata come probabile cancerogena. Il Reg. UE 2017/2158 ha istituito misure di attenuazione obbligatorie."),
    h2('Prodotti da forno e cereali'),
    ...textToParagraphs([
      '• Cuocere i prodotti da forno fino a una colorazione finale più chiara — evitare la doratura eccessiva',
      '• Utilizzare le guide cromatiche elaborate per i prodotti specifici — esposte in modo visibile nei locali di preparazione',
      '• Per il pane tostato: preferire tostatura leggera (colore dorato chiaro, non bruno)',
      '• Qualora si utilizzi pane preconfezionato o prodotti da forno da ultimare in cottura: osservare le istruzioni del produttore incluse le indicazioni cromatiche',
    ].join('\n')),
    ...(isCucinaInterna && opFrittura ? [
      h2('Frittura di patate e prodotti fritti'),
      ...textToParagraphs([
        '• Conservare le patate a temperatura superiore a 6°C — mai in frigorifero (aumenta gli zuccheri)',
        "• Prima della frittura: lavare e lasciare in ammollo in acqua fredda 30-120 min; asciugare bene",
        '• Temperatura di frittura: massimo 175°C — più bassa possibile compatibilmente con i requisiti di sicurezza',
        '• Utilizzare oli con alto punto di fumo (olio di oliva raffinato, olio di arachidi)',
        "• Non aggiungere mai olio fresco all'olio usato",
        '• Schiumare frequentemente per eliminare briciole e residui che accelerano la formazione di acrilammide',
        '• Guida cromatica per il colore finale: dorato chiaro è il limite accettabile',
        '• Sale e spezie: aggiungere sempre DOPO la frittura, mai prima',
      ].join('\n')),
    ] : [
      h2('Nota per il modello ' + modello),
      txt('Il presente manuale riguarda un servizio di ' + (modello === 'distribuzione_veicolata' ? 'distribuzione veicolata' : 'appalto a fornitore esterno') + '. Le fasi di cottura e frittura sono di competenza del centro cottura esterno (' + fornitoreNome + '). Le misure di attenuazione dell\'acrilammide per tostatura pane e prodotti da forno riscaldati rimangono applicabili al personale OSA nelle cucinette di nucleo.'),
    ]),

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
  op_macchina_colazioni       = false,
  op_macchina_colazioni_note  = '',
  op_cena_abbattuta           = false,
  op_disfagici                = false,
  op_monouso_infetti          = false,
  op_srtr                     = false,
  op_riabilitazione           = false,
  opDistribuzioneModalita     = 'gastronorm',
  logoUrl                     = null,
  logoVariante                = 'B',
}) {
  // Logo: usa URL aziendale se disponibile, altrimenti fallback base64
  let logoData = null;
  if (logoUrl) {
    try {
      const resp        = await fetch(logoUrl);
      const blob        = await resp.blob();
      const arrayBuffer = await blob.arrayBuffer();
      logoData = {
        data: new Uint8Array(arrayBuffer),
        type: logoUrl.split('.').pop().toLowerCase().replace('jpg', 'jpeg'),
        w: 150,
        h: 75,
      };
    } catch {
      logoData = null;
    }
  }
  if (!logoData) {
    const cfg = LOGOS[logoVariante] || LOGOS.B;
    logoData = { data: cfg.data(), type: cfg.type, w: cfg.w, h: cfg.h };
  }

  const isCucinaInterna = modello === 'cucina_interna';
  const isAppalto       = modello === 'appalto_fresco_caldo';
  const isVeicolata     = modello === 'distribuzione_veicolata';

  // ── Parse apparecchiature dal profilo ───────────────────────
  const righeApp = (apparecchiature_frigorifere || '').split('\n').map(r => r.trim()).filter(Boolean);
  const getCodice = r => r.split(/[–\-:]/)[0].trim().toUpperCase();
  const getDesc   = r => { const p = r.split(/[–\-:]/); return p.slice(1).join('–').trim() || getCodice(r); };

  const frigoCucina  = righeApp.filter(r => /^F\d*$/.test(getCodice(r)));
  const congelatori  = righeApp.filter(r => /^C\d*$/.test(getCodice(r)));
  const frigoReparti = righeApp.filter(r => /^FR\d+$/.test(getCodice(r)) || /^FD$/.test(getCodice(r)));
  const congelatoriR = righeApp.filter(r => /^CR\d+$/.test(getCodice(r)));

  // ── Parse apparecchi 5A (distributori acqua) e 5B (macchinette) ──
  // Stessa logica frigoriferi: una riga per apparecchio nel campo note
  // Se il campo è valorizzato con righe → una sezione per apparecchio
  // Se il campo è una nota generica (nessun codice) → un apparecchio senza codice
  function parseApparecchiSemplici(testoNote, flagAttivo) {
    if (!flagAttivo) return [];
    if (!testoNote || !testoNote.trim()) return [{ codice: '', desc: '' }];
    const righe = testoNote.split('\n').map(r => r.trim()).filter(Boolean);
    // Se c'è almeno una riga che assomiglia a "CODICE – descrizione", usa il parser
    const hasCodice = righe.some(r => /^[A-Z]{1,4}\d*\s*[–\-:]/.test(r));
    if (hasCodice) {
      return righe.map(r => ({ codice: getCodice(r), desc: getDesc(r) }));
    }
    // Altrimenti: tratta ogni riga come una descrizione senza codice
    if (righe.length > 1) {
      return righe.map(r => ({ codice: '', desc: r }));
    }
    // Singola riga generica → un apparecchio con nota
    return [{ codice: '', desc: righe[0] }];
  }

  const distributoriAcqua  = parseApparecchiSemplici(op_distributore_acqua_note, op_distributore_acqua);
  const macchinetteCaffe   = parseApparecchiSemplici(op_macchinetta_caffe_note,  op_macchinetta_caffe);
  const macchineColazioni  = parseApparecchiSemplici(op_macchina_colazioni_note, op_macchina_colazioni);

  // ── Dimensioni pagina ────────────────────────────────────────
  const W_P  = 9638;   // Portrait content width  (A4: 11906 - 1134*2)
  const W_L  = 15718;  // Landscape content width (A4: 16838 - 560*2)
  const pPort  = { size: { width: 11906, height: 16838 }, margin: { top: 720, right: 720, bottom: 720, left: 720 } };
  const pLand  = { size: { width: 16838, height: 11906 }, margin: { top: 560, right: 560, bottom: 560, left: 560 } };

  // ── Colori ───────────────────────────────────────────────────
  const V     = '1D6F42';  // verde OVER
  const VL    = 'E8F5EE';  // verde chiarissimo (righe alternate)
  const VM    = 'C8E6D0';  // verde medio (bordi header)
  const GR    = 'F4F4F4';  // grigio chiarissimo (note footer)
  const W_    = 'FFFFFF';
  const NR    = '1A1A1A';
  const GS    = '666666';

  // ── Primitivi ────────────────────────────────────────────────
  const BS  = (c = 'CCCCCC') => ({ style: BorderStyle.SINGLE, size: 1, color: c });
  const BDS = (c = 'CCCCCC') => ({ top: BS(c), bottom: BS(c), left: BS(c), right: BS(c) });

  function cell(text, w, opts = {}) {
    const {
      bold = false, size = 18, color = NR, fill = W_,
      align = AlignmentType.LEFT, colspan = 1, italic = false, bc = 'CCCCCC',
      rowspan = 1, before = 60, after = 60,
    } = opts;
    return new TableCell({
      columnSpan: colspan, rowSpan: rowspan,
      width: { size: w, type: WidthType.DXA },
      borders: BDS(bc),
      shading: { fill, type: ShadingType.CLEAR },
      margins: { top: before, bottom: after, left: 100, right: 100 },
      verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({
        alignment: align,
        children: [new TextRun({ text: String(text || ''), bold, size, color, font: 'Arial', italic })],
      })],
    });
  }

  // Header cella verde scuro / testo bianco
  const hC = (t, w, cs = 1) => cell(t, w, { fill: V, color: W_, bold: true, size: 17, align: AlignmentType.CENTER, bc: V, colspan: cs });
  // Cella vuota
  const eC = (w, fill = W_) => cell('', w, { fill, bc: 'DDDDDD' });
  // Cella verde chiaro (alternata)
  // Paragrafo semplice
  const sp = (n = 1) => new Paragraph({ spacing: { after: n * 80 }, children: [new TextRun('')] });

  // ── INTESTAZIONE SCHEDA ──────────────────────────────────────
  // Header professionale: logo + struttura + codice + titolo + campo mese
  function intestazione(autoc, titolo, W, landscape = false) {
    const cLogo = 1400;
    const cCode = 900;
    const cMese = 1600;
    const cTit  = W - cLogo - cCode - cMese;

    // Riga 1: logo | struttura + titolo | codice | mese
    const riga1 = new TableRow({
      children: [
        // Logo
        new TableCell({
          width: { size: cLogo, type: WidthType.DXA },
          borders: BDS(V),
          shading: { fill: W_, type: ShadingType.CLEAR },
          margins: { top: 40, bottom: 40, left: 80, right: 80 },
          verticalAlign: VerticalAlign.CENTER,
          rowSpan: 1,
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: logoData ? [new ImageRun({
              data: logoData.data, type: logoData.type,
              transformation: { width: Math.round(logoData.w * 0.55), height: Math.round(logoData.h * 0.55) },
            })] : [new TextRun({ text: 'LOGO', font: 'Arial', size: 16, color: GS })],
          })],
        }),
        // Struttura + titolo
        new TableCell({
          width: { size: cTit, type: WidthType.DXA },
          borders: BDS(V),
          shading: { fill: V, type: ShadingType.CLEAR },
          margins: { top: 60, bottom: 60, left: 160, right: 120 },
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({ alignment: AlignmentType.LEFT, children: [new TextRun({ text: nomestruttura.toUpperCase(), font: 'Arial', size: 17, bold: true, color: W_ })] }),
            new Paragraph({ alignment: AlignmentType.LEFT, children: [new TextRun({ text: titolo, font: 'Arial', size: landscape ? 22 : 24, bold: true, color: W_ })] }),
          ],
        }),
        // Codice autoc
        new TableCell({
          width: { size: cCode, type: WidthType.DXA },
          borders: BDS(V),
          shading: { fill: VL, type: ShadingType.CLEAR },
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: autoc.toUpperCase(), font: 'Arial', size: 28, bold: true, color: V })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Autocontrollo', font: 'Arial', size: 14, italic: true, color: GS })] }),
          ],
        }),
        // Campo mese/anno
        new TableCell({
          width: { size: cMese, type: WidthType.DXA },
          borders: BDS(V),
          shading: { fill: W_, type: ShadingType.CLEAR },
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Periodo', font: 'Arial', size: 15, italic: true, color: GS })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Da _____________ a _____________', font: 'Arial', size: 16, bold: true, color: NR })] }),
          ],
        }),
      ],
    });

    return new Table({
      width: { size: W, type: WidthType.DXA },
      columnWidths: [cLogo, cTit, cCode, cMese],
      rows: [riga1],
    });
  }

  // ── NOTE FOOTER ──────────────────────────────────────────────
  function noteFooter(testo, W) {
    return new Table({
      width: { size: W, type: WidthType.DXA },
      columnWidths: [W],
      rows: [new TableRow({ children: [
        new TableCell({
          width: { size: W, type: WidthType.DXA },
          borders: { top: BS(VM), bottom: BS(VM), left: BS(VM), right: BS(VM) },
          shading: { fill: GR, type: ShadingType.CLEAR },
          margins: { top: 60, bottom: 60, left: 120, right: 120 },
          children: [new Paragraph({
            children: [new TextRun({ text: '📋 ' + testo, font: 'Arial', size: 14, italic: true, color: GS })],
          })],
        }),
      ] })],
    });
  }

  // ── RIGA DATA / RILEVATORE / FIRMA ───────────────────────────
  function rigaFirma(W) {
    const c = Math.floor(W / 3);
    return new Table({
      width: { size: W, type: WidthType.DXA },
      columnWidths: [c, c, W - c * 2],
      rows: [new TableRow({ children: [
        cell('Data: ___________________', c, { bold: true, size: 16, fill: VL, bc: VM }),
        cell('Rilevatore: ____________________________', c, { bold: true, size: 16, fill: VL, bc: VM }),
        cell('Firma: ____________________________', W - c * 2, { bold: true, size: 16, fill: VL, bc: VM }),
      ] })],
    });
  }

  // ── RIGHE MENSILI (31 righe con alternanza colore) ───────────
  function righeGiornaliere(colWidths, W, landscape) {
    const spazio    = landscape ? 5800 : 10500;
    const altezza   = Math.max(Math.floor((spazio - 2000) / 31), 270);
    return Array.from({ length: 31 }, (_, i) => {
      const fill = i % 2 === 0 ? W_ : VL;
      return new TableRow({
        height: { value: altezza, rule: 'exact' },
        children: [
          cell(String(i + 1), colWidths[0], { bold: true, align: AlignmentType.CENTER, size: 16, fill, bc: 'DDDDDD' }),
          ...colWidths.slice(1).map(w => eC(w, fill)),
        ],
      });
    });
  }

  // ── COPERTINA MODULISTICA ────────────────────────────────────
  function copertina() {
    const W = W_P;
    const children = [
      // Banda verde top
      new Table({
        width: { size: W, type: WidthType.DXA }, columnWidths: [W],
        rows: [new TableRow({ height: { value: 400, rule: 'exact' }, children: [
          new TableCell({ width: { size: W, type: WidthType.DXA }, borders: BDS(V), shading: { fill: V, type: ShadingType.CLEAR }, children: [new Paragraph({ children: [] })] }),
        ]})]
      }),
      sp(2),
      // Logo
      ...(logoData ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new ImageRun({ data: logoData.data, type: logoData.type, transformation: { width: logoData.w, height: logoData.h } })] })] : []),
      sp(1),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: nomestruttura.toUpperCase(), font: 'Arial', size: 28, bold: true, color: V })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text: 'SISTEMA DI AUTOCONTROLLO ALIMENTARE', font: 'Arial', size: 36, bold: true, color: NR })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: 'Reg. CE 852/2004 — D.Lgs 27/2021', font: 'Arial', size: 20, italic: true, color: GS })] }),
      sp(2),
      // Linea verde
      new Table({
        width: { size: W, type: WidthType.DXA }, columnWidths: [W],
        rows: [new TableRow({ height: { value: 120, rule: 'exact' }, children: [
          new TableCell({ width: { size: W, type: WidthType.DXA }, borders: BDS(V), shading: { fill: V, type: ShadingType.CLEAR }, children: [new Paragraph({ children: [] })] }),
        ]})]
      }),
      sp(1),
      // Box titolo modulistica
      new Table({
        width: { size: W, type: WidthType.DXA }, columnWidths: [W],
        rows: [new TableRow({ children: [
          new TableCell({
            width: { size: W, type: WidthType.DXA }, borders: BDS(V),
            shading: { fill: VL, type: ShadingType.CLEAR },
            margins: { top: 200, bottom: 200, left: 300, right: 300 },
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'MODULISTICA DI AUTOCONTROLLO', font: 'Arial', size: 40, bold: true, color: V })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80 }, children: [new TextRun({ text: 'Schede di monitoraggio e registrazione', font: 'Arial', size: 22, italic: true, color: GS })] }),
            ],
          }),
        ]})]
      }),
      sp(3),
      // Elenco schede
      ...(() => {
        const schede = [
          ['Autoc 1',  'Controllo ricevimento merci'],
          ...(frigoCucina.length > 0  ? [['Autoc 2A', 'Temperature frigoriferi cucina']] : []),
          ...(frigoReparti.length > 0 ? [['Autoc 2A', 'Temperature frigoriferi reparti (una per apparecchio)']] : []),
          ...(congelatori.length > 0  ? [['Autoc 2B', 'Temperature congelatori']] : []),
          ...(congelatoriR.length > 0 ? [['Autoc 2B', 'Temperature congelatori reparti']] : []),
          ...(isCucinaInterna || isAppalto ? [['Autoc 2C', 'Monitoraggio igiene cucina e lavaggio']] : []),
          ['Autoc 2D', 'Monitoraggio igiene sala da pranzo / refettori'],
          ['Autoc 2E', 'Monitoraggio igiene servizi igienici / spogliatoi'],
          ...(isCucinaInterna || isAppalto ? [['Autoc 2F', 'Monitoraggio igiene personale di cucina']] : []),
          ...(isCucinaInterna ? [['Autoc 3A', 'Temperature di cottura (CCP)']] : []),
          ...(isCucinaInterna ? [['Autoc 3B', 'Conservazione a caldo']] : []),
          ...(isCucinaInterna ? [['Autoc 3C', 'Raffreddamento e abbattimento']] : []),
          ...(op_cena_abbattuta || isAppalto ? [['Autoc 3D', 'Riattivazione pasti abbattuti (CCP2)']] : []),
          ...(isVeicolata || isAppalto ? [['Autoc 8',  'Controlli ricevimento pasti veicolati (CCP1)']] : []),
          ...(op_disfagici ? [['Autoc 8D', 'Registro distribuzione pasti disfagici']] : []),
          ...(op_monouso_infetti ? [['Autoc 9',  'Registro isolamento infettivo']] : []),
          ...(op_distributore_acqua ? [['Autoc 5A', 'Manutenzione distributore acqua potabile']] : []),
          ...(op_macchinetta_caffe ? [['Autoc 5B', 'Manutenzione macchinetta bevande calde']] : []),
          ...(op_macchina_colazioni ? [['Autoc 5C', 'Manutenzione macchina colazioni']] : []),
          ['Autoc 4',  'Comunicazione variazioni menù'],
          ['Autoc 7',  'Elenco fornitori qualificati'],
          ['Autoc 6',  'Registro generale non conformità'],
          ['Autoc 6M', 'Registro manutenzione e taratura attrezzature'],
        ];
        const c0 = Math.round(W * 0.18);
        const c1 = W - c0;
        return [
          new Table({
            width: { size: W, type: WidthType.DXA }, columnWidths: [c0, c1],
            rows: [
              new TableRow({ children: [hC('Codice', c0), hC('Descrizione scheda', c1)] }),
              ...schede.map(([cod, desc], i) => new TableRow({ children: [
                cell(cod, c0, { fill: i % 2 === 0 ? VL : W_, bold: true, color: V, bc: 'DDDDDD' }),
                cell(desc, c1, { fill: i % 2 === 0 ? VL : W_, bc: 'DDDDDD' }),
              ]})),
            ],
          }),
        ];
      })(),
      sp(2),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Anno: ____________________', font: 'Arial', size: 20, bold: true, color: V })] }),
    ];
    return { properties: { page: pPort }, children };
  }

  // ═══════════════════════════════════════════════════════════════
  // SCHEDE
  // ═══════════════════════════════════════════════════════════════

  // ── Autoc 1 — Ricevimento merci ───────────────────────────────
  function autoc1() {
    const W = W_P;
    const c0 = 500; const c1 = Math.floor(W * 0.42); const c2 = Math.floor(W * 0.12);
    const c3 = Math.floor(W * 0.12); const c4 = W - c0 - c1 - c2 - c3;
    return { properties: { page: pPort }, children: [
      intestazione('Autoc 1', 'CONTROLLO RICEVIMENTO MERCI', W),
      sp(),
      new Paragraph({ children: [new TextRun({ text: 'Fornitore: _______________________________________   N° DDT/Fattura: ______________________', font: 'Arial', size: 17, bold: true })] }),
      sp(),
      new Table({
        width: { size: W, type: WidthType.DXA }, columnWidths: [c0, c1, c2, c3, c4],
        rows: [
          new TableRow({ children: [hC('N°', c0), hC('Prodotto / Partita', c1), hC('T° (°C)', c2), hC('Scad.', c3), hC('Esito ✓/✗', c4)] }),
          ...Array.from({ length: 18 }, (_, i) => new TableRow({
            height: { value: 380, rule: 'exact' },
            children: [
              cell(String(i + 1), c0, { bold: true, align: AlignmentType.CENTER, size: 16, fill: i % 2 === 0 ? W_ : VL, bc: 'DDDDDD' }),
              eC(c1, i % 2 === 0 ? W_ : VL),
              eC(c2, i % 2 === 0 ? W_ : VL),
              eC(c3, i % 2 === 0 ? W_ : VL),
              eC(c4, i % 2 === 0 ? W_ : VL),
            ],
          })),
        ],
      }),
      sp(),
      // Box NC
      new Table({
        width: { size: W, type: WidthType.DXA }, columnWidths: [W],
        rows: [new TableRow({ children: [cell('TUTTI I CONTROLLI CONFORMI?     ☐ SÌ     ☐ NO  →  se NO compilare sotto e aprire Autoc 6', W, { bold: true, size: 17, fill: VL, align: AlignmentType.CENTER, bc: VM })] })],
      }),
      sp(0.5),
      new Table({
        width: { size: W, type: WidthType.DXA }, columnWidths: [Math.floor(W * 0.5), Math.floor(W * 0.5)],
        rows: [
          new TableRow({ children: [hC('Prodotto non conforme', Math.floor(W * 0.5)), hC('Azione correttiva', Math.floor(W * 0.5))] }),
          ...Array.from({ length: 3 }, (_, i) => new TableRow({ height: { value: 420, rule: 'exact' }, children: [eC(Math.floor(W * 0.5), i % 2 === 0 ? W_ : VL), eC(Math.floor(W * 0.5), i % 2 === 0 ? W_ : VL)] })),
        ],
      }),
      sp(),
      rigaFirma(W),
      sp(0.5),
      noteFooter('Riportare le non conformità nel Registro Generale NC (Autoc 6). T° limite: carne +7°C, pesce +2°C, surgelati -15°C.', W),
    ]};
  }

  // ── Autoc 2A cucina — Frigoriferi cucina (Landscape) ──────────
  function autoc2ACucina() {
    const W   = W_P;
    const nF  = Math.max(frigoCucina.length, 1);
    const cFix = 700 + 700 + 1500 + 1600;
    const tW  = Math.max(Math.floor((W - cFix) / nF), 500);
    const tCols = Array.from({ length: nF }, (_, i) => i === nF - 1 ? W - cFix - tW * (nF - 1) : tW);
    const colWidths = [700, 700, ...tCols, 1500, 1600];
    const noteApp = frigoCucina.length ? frigoCucina.map((r, i) => `${i + 1} = ${getCodice(r)} (${getDesc(r)})`).join(' | ') : '1 = Frigorifero cucina';
    return { properties: { page: pPort }, children: [
      intestazione('Autoc 2A', 'TEMPERATURE FRIGORIFERI CUCINA', W),
      sp(0.5),
      new Paragraph({ children: [new TextRun({ text: `Apparecchiature: ${noteApp}`, font: 'Arial', size: 17, bold: true, color: V })] }),
      sp(0.5),
      new Table({
        width: { size: W, type: WidthType.DXA }, columnWidths: colWidths,
        rows: [
          new TableRow({ children: [hC('Giorno', 700), hC('Ora', 700), hC('Temperatura (°C)', tW * nF, nF), hC('Anomalia / Guasto', 1500), hC('Firma', 1600)] }),
          new TableRow({ height: { value: 260, rule: 'exact' }, children: [eC(700), eC(700), ...tCols.map((w, i) => cell(frigoCucina[i] ? getCodice(frigoCucina[i]) : String(i + 1), w, { bold: true, align: AlignmentType.CENTER, size: 16, fill: VL, bc: 'DDDDDD' })), eC(1500), cell('Apporre firma →', 1600, { size: 14, italic: true, color: GS })] }),
          ...righeGiornaliere(colWidths, W, false),
        ],
      }),
      sp(),
      noteFooter('Limite: ≤ +4°C. Se T° > 4°C: spostare gli alimenti, segnalare anomalia, aprire Autoc 6. Taratura termometro: annuale.', W),
    ]};
  }

  // ── Autoc 2A reparto — un frigo per scheda (Portrait) ─────────
  function autoc2AReparti() {
    return frigoReparti.map(r => {
      const W = W_P;
      const cod = getCodice(r); const dsc = getDesc(r);
      const colWidths = [700, 700, W - 700 - 700 - 1500 - 1700, 1500, 1700];
      return { properties: { page: pPort }, children: [
        intestazione('Autoc 2A', `TEMPERATURA — ${cod}: ${dsc}`, W),
        sp(0.5),
        new Table({
          width: { size: W, type: WidthType.DXA }, columnWidths: colWidths,
          rows: [
            new TableRow({ children: [hC('Giorno', 700), hC('Ora', 700), hC(`T° ${cod} (°C)`, colWidths[2]), hC('Anomalia / Guasto', 1500), hC('Firma', 1700)] }),
            new TableRow({ children: [eC(700), eC(700), cell('Limite ≤ 4°C', colWidths[2], { size: 15, italic: true, color: GS, fill: VL }), eC(1500), cell('Apporre firma →', 1700, { size: 14, italic: true, color: GS })] }),
            ...righeGiornaliere(colWidths, W, false),
          ],
        }),
        sp(),
        noteFooter(`${cod} — ${dsc}. Limite: ≤ +4°C. Disfagici (FD): verificare separazione pasti etichettati. NC → Autoc 6.`, W),
      ]};
    });
  }

  // ── Autoc 2B — Congelatori cucina (Landscape) ─────────────────
  function autoc2B() {
    if (congelatori.length === 0 && congelatoriR.length === 0) return null;
    const all = [...congelatori, ...congelatoriR];
    const W   = W_P;
    const nC  = Math.max(all.length, 1);
    const cFix = 700 + 700 + 1500 + 1600;
    const tW  = Math.max(Math.floor((W - cFix) / nC), 500);
    const tCols = Array.from({ length: nC }, (_, i) => i === nC - 1 ? W - cFix - tW * (nC - 1) : tW);
    const colWidths = [700, 700, ...tCols, 1500, 1600];
    const noteApp = all.length ? all.map((r, i) => `${i + 1} = ${getCodice(r)} (${getDesc(r)})`).join(' | ') : '1 = Congelatore';
    return { properties: { page: pLand }, children: [
      intestazione('Autoc 2B', 'TEMPERATURE CONGELATORI / SURGELATORI', W),
      sp(0.5),
      new Paragraph({ children: [new TextRun({ text: `Apparecchiature: ${noteApp}`, font: 'Arial', size: 17, bold: true, color: V })] }),
      sp(0.5),
      new Table({
        width: { size: W, type: WidthType.DXA }, columnWidths: colWidths,
        rows: [
          new TableRow({ children: [hC('Giorno', 700), hC('Ora', 700), hC('Temperatura (°C)', tW * nC, nC), hC('Anomalia / Guasto', 1500), hC('Firma', 1600)] }),
          new TableRow({ children: [eC(700), eC(700), ...tCols.map((w, i) => cell(all[i] ? getCodice(all[i]) : String(i + 1), w, { bold: true, align: AlignmentType.CENTER, size: 16, fill: VL, bc: 'DDDDDD' })), eC(1500), cell('Apporre firma →', 1600, { size: 14, italic: true, color: GS })] }),
          ...righeGiornaliere(colWidths, W, false),
        ],
      }),
      sp(),
      noteFooter('Limite: ≤ -18°C. Se T° > -15°C: valutare spostamento merce, segnalare anomalia, aprire Autoc 6.', W),
    ]};
  }

  // ── Autoc 2C — Cucina e lavaggio (Landscape, 31 giorni) ────────
  function autoc2C() {
    const W = W_L;
    const c0 = 2800;
    const cG = Math.floor((W - c0) / 31);
    const c31 = W - c0 - cG * 30;
    const colWidths = [c0, ...Array.from({ length: 31 }, (_, i) => i === 30 ? c31 : cG)];

    const voci = [
      'Pavimenti e pareti lavabili idonei',
      'Porte e maniglie idonee',
      'Esterno arredi e apparecchiature idoneo (frigo, forno…)',
      'Interni apparecchiature e arredi idonei',
      'Lavastoviglie idonea',
      'Posateria, pentolame e stoviglie idonei',
      'Lavelli e piani di lavoro idonei',
      'Bicchieri, taglieri e coltelleria idonei',
      'Carrelli acciaio idonei',
      'Portarifiuti idoneo',
      'Vetri e plafoniere idonei',
      'Corretta separazione alimenti stoccati',
      'Assenza materiale non inerente nei locali',
      'Presenza termometro sonda funzionante',
      'Assenza confezioni alterate o prodotti scaduti',
      'Assenza visiva tracce animali/insetti',
    ];

    function headerGiorni() {
      return new TableRow({ children: [
        hC('Voce di controllo', c0),
        ...Array.from({ length: 31 }, (_, i) => hC(String(i + 1), i === 30 ? c31 : cG)),
      ]});
    }
    function rigaFirmaGiorni() {
      return new TableRow({ height: { value: 560, rule: 'exact' }, children: [
        cell('Firma giornaliera (la firma conferma tutti i controlli conformi)', c0, { bold: true, size: 15, fill: VL, bc: VM }),
        ...Array.from({ length: 31 }, (_, i) => eC(i === 30 ? c31 : cG, VL)),
      ]});
    }
    function rigaVoce(v, i) {
      return new TableRow({ height: { value: 360, rule: 'exact' }, children: [
        cell(v, c0, { size: 15, fill: i % 2 === 0 ? W_ : VL, bc: 'DDDDDD' }),
        ...Array.from({ length: 31 }, (_, j) => eC(j === 30 ? c31 : cG, i % 2 === 0 ? W_ : VL)),
      ]});
    }

    return { properties: { page: pLand }, children: [
      intestazione('Autoc 2C', 'MONITORAGGIO PRE-OPERATIVO — CUCINA, LAVAGGIO, DISPENSA', W, true),
      sp(0.5),
      new Table({
        width: { size: W, type: WidthType.DXA }, columnWidths: colWidths,
        rows: [
          headerGiorni(),
          rigaFirmaGiorni(),
          ...voci.map((v, i) => rigaVoce(v, i)),
        ],
      }),
      sp(),
      noteFooter('La firma in prima riga conferma tutti i controlli conformi. Segnalare il numero della voce NC solo se non conforme. Non conformità → Autoc 6.', W),
    ]};
  }

  // ── Autoc 2D — Sala pranzo + Servizi igienici (Landscape, 31 giorni) ──
  function autoc2D() {
    const W = W_L;
    // c0 = colonna voce (larga), poi 31 colonne giorno uguali
    const c0 = 2800;
    const cG = Math.floor((W - c0) / 31);
    const c31 = W - c0 - cG * 30; // ultima colonna prende il resto
    const colWidths = [c0, ...Array.from({ length: 31 }, (_, i) => i === 30 ? c31 : cG)];

    const vociSala = [
      'Pavimenti e pareti idonei',
      'Esterni e interni arredi idonei',
      'Tavoli e sedie idonei',
      'Posateria e stoviglie idonei',
      'Assenza prodotti scaduti',
      'Porte e maniglie idonee',
      'Vetri e plafoniere idonei',
      'Assenza materiale non inerente i locali',
      'Alimenti stoccati correttamente',
      'Assenza visiva tracce animali/insetti',
    ];
    const vociSI = [
      'Pavimenti e pareti lavabili idonei',
      'Sanitari, accessori e rubinetteria idonei',
      'Interno/esterno armadietti idonei',
      'Assenza materiali non inerenti i locali',
      'Indumenti riposti negli armadietti',
      'Assenza visiva tracce animali/insetti',
    ];

    function headerGiorni() {
      return new TableRow({ children: [
        hC('Voce di controllo', c0),
        ...Array.from({ length: 31 }, (_, i) => hC(String(i + 1), i === 30 ? c31 : cG)),
      ]});
    }
    function rigaFirmaGiorni(label) {
      return new TableRow({ height: { value: 560, rule: 'exact' }, children: [
        cell(label, c0, { bold: true, size: 15, fill: VL, bc: VM }),
        ...Array.from({ length: 31 }, (_, i) => eC(i === 30 ? c31 : cG, VL)),
      ]});
    }
    function rigaVoce(v, i) {
      return new TableRow({ height: { value: 380, rule: 'exact' }, children: [
        cell(v, c0, { size: 15, fill: i % 2 === 0 ? W_ : VL, bc: 'DDDDDD' }),
        ...Array.from({ length: 31 }, (_, j) => eC(j === 30 ? c31 : cG, i % 2 === 0 ? W_ : VL)),
      ]});
    }
    function sezioneHeader(titolo) {
      return new TableRow({ children: [
        new TableCell({
          columnSpan: 32,
          width: { size: W, type: WidthType.DXA },
          borders: BDS(V),
          shading: { fill: V, type: ShadingType.CLEAR },
          margins: { top: 60, bottom: 60, left: 160, right: 160 },
          children: [new Paragraph({ children: [new TextRun({ text: titolo, font: 'Arial', size: 18, bold: true, color: W_ })] })],
        }),
      ]});
    }

    return { properties: { page: pLand }, children: [
      intestazione('Autoc 2D', 'MONITORAGGIO PRE-OPERATIVO — SALA DA PRANZO E SERVIZI IGIENICI', W, true),
      sp(0.5),
      new Table({
        width: { size: W, type: WidthType.DXA }, columnWidths: colWidths,
        rows: [
          headerGiorni(),
          rigaFirmaGiorni('Firma giornaliera (la firma conferma tutti i controlli conformi)'),
          sezioneHeader('AREA: SALA DA PRANZO / REFETTORI'),
          ...vociSala.map((v, i) => rigaVoce(v, i)),
          sezioneHeader('AREA: SERVIZI IGIENICI E SPOGLIATOI'),
          ...vociSI.map((v, i) => rigaVoce(v, i)),
        ],
      }),
      sp(),
      noteFooter('La firma in prima riga conferma che tutti i controlli sono conformi. Indicare il problema solo se non conforme: scrivere il numero della voce NC nella cella del giorno e aprire Autoc 6.', W),
    ]};
  }

  // ── Autoc 2E — ora inglobata in Autoc 2D (landscape) ───────────
  function autoc2E() { return null; }

  // ── Autoc 2F — Igiene personale cucina (Portrait) ─────────────
  function autoc2F() {
    const W = W_P;
    const c0 = 280; const c1 = 1600; const cRest = Math.floor((W - c0 - c1) / 7);
    const voci = ['Divisa da lavoro indossata e pulita', 'Capelli raccolti e coperti', 'Mani lavate (prima del servizio)', 'Assenza gioielli/anelli/orologio', 'Assenza unghie finte o smalto', 'Assenza sintomi gastro/febbre', 'Ferite/tagli coperti con cerotto colorato'];
    return { properties: { page: pPort }, children: [
      intestazione('Autoc 2F', 'MONITORAGGIO IGIENE PERSONALE', W),
      sp(0.5),
      new Paragraph({ children: [new TextRun({ text: 'Compilare: ✓ conforme · ✗ NC (segnalare a R-HACCP) · / assente', font: 'Arial', size: 16, italic: true, color: GS })] }),
      sp(0.5),
      new Table({
        width: { size: W, type: WidthType.DXA }, columnWidths: [c0, ...Array.from({ length: 7 }, (_, i) => i === 6 ? W - c0 - cRest * 6 : cRest), c1],
        rows: [
          new TableRow({ children: [hC('N°', c0), ...Array.from({ length: 6 }, (_, i) => hC(String(i + 1), cRest)), hC(String(7), W - c0 - cRest * 6), hC('Voce di controllo', c1)] }),
          ...voci.map((v, i) => new TableRow({
            height: { value: 520, rule: 'exact' },
            children: [
              cell(String(i + 1), c0, { bold: true, align: AlignmentType.CENTER, size: 16, fill: i % 2 === 0 ? VL : W_, bc: 'DDDDDD' }),
              ...Array.from({ length: 7 }, (_, j) => eC(j === 6 ? W - c0 - cRest * 6 : cRest, i % 2 === 0 ? VL : W_)),
              cell(v, c1, { size: 15, fill: i % 2 === 0 ? VL : W_, bc: 'DDDDDD' }),
            ],
          })),
          new TableRow({ children: [cell('Firma', c0, { bold: true, fill: VL, align: AlignmentType.CENTER }), ...Array.from({ length: 7 }, (_, j) => eC(j === 6 ? W - c0 - cRest * 6 : cRest, VL)), eC(c1, VL)] }),
        ],
      }),
      sp(),
      noteFooter('Numeri colonna = operatori. Inserire iniziali operatore nella riga intestazione. In caso di sintomi gastro/febbre: comunicare immediatamente a R-HACCP.', W),
    ]};
  }

  // ── Autoc 3A — Cottura (Landscape) ───────────────────────────
  function autoc3A() {
    if (!isCucinaInterna) return null;
    const W = W_L;
    const c0 = 700; const c1 = 2200; const c2 = 1200; const c3 = 1200; const c4 = 1600; const c5 = W - c0 - c1 - c2 - c3 - c4;
    return { properties: { page: pLand }, children: [
      intestazione('Autoc 3A', 'MONITORAGGIO TEMPERATURE — COTTURA (CCP)', W, true),
      sp(0.5),
      new Table({
        width: { size: W, type: WidthType.DXA }, columnWidths: [c0, c1, c2, c3, c4, c5],
        rows: [
          new TableRow({ children: [hC('Data', c0), hC('Preparazione', c1), hC('T° cuore (°C)', c2), hC('Ora fine cottura', c3), hC('Esito ✓/✗', c4), hC('Firma', c5)] }),
          ...Array.from({ length: 21 }, (_, i) => new TableRow({
            height: { value: 340, rule: 'exact' },
            children: [c0, c1, c2, c3, c4, c5].map(w => eC(w, i % 2 === 0 ? W_ : VL)),
          })),
        ],
      }),
      sp(),
      noteFooter('Limite CCP: T° al cuore ≥ 75°C per almeno 1 minuto. Se T° < 75°C: prolungare la cottura. Non servire mai alimenti non conformi. NC → Autoc 6.', W),
    ]};
  }

  // ── Autoc 3B — Conservazione a caldo (Landscape) ──────────────
  function autoc3B() {
    if (!isCucinaInterna) return null;
    const W = W_L;
    const c0 = 700; const c1 = 2200; const c2 = 1200; const c3 = 1200; const c4 = 1200; const c5 = W - c0 - c1 - c2 - c3 - c4;
    return { properties: { page: pLand }, children: [
      intestazione('Autoc 3B', 'MONITORAGGIO TEMPERATURE — CONSERVAZIONE A CALDO', W, true),
      sp(0.5),
      new Table({
        width: { size: W, type: WidthType.DXA }, columnWidths: [c0, c1, c2, c3, c4, c5],
        rows: [
          new TableRow({ children: [hC('Data', c0), hC('Preparazione', c1), hC('T° inizio (°C)', c2), hC('T° fine (°C)', c3), hC('Durata (min)', c4), hC('Firma', c5)] }),
          ...Array.from({ length: 21 }, (_, i) => new TableRow({
            height: { value: 340, rule: 'exact' },
            children: [c0, c1, c2, c3, c4, c5].map(w => eC(w, i % 2 === 0 ? W_ : VL)),
          })),
        ],
      }),
      sp(),
      noteFooter('Limite: T° ≥ 65°C. Tempo massimo di conservazione a caldo: 2 ore. Dopo 2 ore: abbattere o smaltire. NC → Autoc 6.', W),
    ]};
  }

  // ── Autoc 3C — Raffreddamento (Portrait) ─────────────────────
  function autoc3C() {
    if (!isCucinaInterna) return null;
    const W = W_P;
    const c0 = 600; const c1 = 1800; const c2 = 1000; const c3 = 1000; const c4 = 1000; const c5 = W - c0 - c1 - c2 - c3 - c4;
    return { properties: { page: pPort }, children: [
      intestazione('Autoc 3C', 'MONITORAGGIO TEMPERATURE — RAFFREDDAMENTO E ABBATTIMENTO', W),
      sp(0.5),
      new Table({
        width: { size: W, type: WidthType.DXA }, columnWidths: [c0, c1, c2, c3, c4, c5],
        rows: [
          new TableRow({ children: [hC('Data', c0), hC('Preparazione', c1), hC('T° inizio (°C)', c2), hC('T° a 90 min (°C)', c3), hC('T° finale (°C)', c4), hC('Firma', c5)] }),
          ...Array.from({ length: 20 }, (_, i) => new TableRow({
            height: { value: 380, rule: 'exact' },
            children: [c0, c1, c2, c3, c4, c5].map(w => eC(w, i % 2 === 0 ? W_ : VL)),
          })),
        ],
      }),
      sp(),
      noteFooter('Limite: da +65°C a +10°C in max 2 ore (abbattitore). Da +10°C a +4°C in max 4 ore. NC → Autoc 6.', W),
    ]};
  }

  // ── Autoc 3D — Riattivazione pasti abbattuti (CCP2) ───────────
  function autoc3D() {
    if (!op_cena_abbattuta && !isAppalto) return null;
    const W = W_P;
    const c0 = 600; const c1 = 600; const c2 = Math.floor(W * 0.22); const c3 = 1100; const c4 = 1000; const c5 = W - c0 - c1 - c2 - c3 - c4;
    return { properties: { page: pPort }, children: [
      intestazione('Autoc 3D', 'MONITORAGGIO RIATTIVAZIONE PASTI ABBATTUTI (CCP2)', W),
      sp(0.5),
      new Table({
        width: { size: W, type: WidthType.DXA }, columnWidths: [c0, c1, c2, c3, c4, c5],
        rows: [
          new TableRow({ children: [hC('Data', c0), hC('Ora', c1), hC('Preparazione / Teglia', c2), hC('T° cuore ≥75°C', c3), hC('Esito ✓/✗', c4), hC('Firma', c5)] }),
          ...Array.from({ length: 28 }, (_, i) => new TableRow({
            height: { value: 310, rule: 'exact' },
            children: [c0, c1, c2, c3, c4, c5].map(w => eC(w, i % 2 === 0 ? W_ : VL)),
          })),
        ],
      }),
      sp(),
      noteFooter('CCP2 — Limite critico: T° al cuore ≥ 75°C. Se T° < 75°C: riscaldare ancora. Se dopo 2 cicli ancora NC: smaltire e aprire Autoc 6. Max 1 riattivazione per lotto.', W),
    ]};
  }

  // ── Autoc 8 — Ricevimento pasti veicolati (Portrait, settimana) ─
  function autoc8() {
    if (!isVeicolata && !isAppalto) return null;
    const W = W_P;
    const giorni = ['Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato','Domenica'];
    const voci = [
      ['Igiene mezzo di trasporto', ''],
      ['Integrità e igiene contenitori isotermici', ''],
      ['Quantità pasti corretta', ''],
      ['Aspetto merceologico pasti', ''],
      ['Conformità pasti (celiaci, disfagici, ecc.)', ''],
      ['Temperatura alimenti caldi', 'Accettabile: 60-65°C (CCP1)'],
      ['Temperatura alimenti freddi / abbattuti', 'Accettabile: ≤ 10°C (CCP1)'],
    ];
    const c0 = Math.floor(W * 0.46);
    const c1 = Math.floor(W * 0.17);
    const c2 = Math.floor(W * 0.17);
    const c3 = W - c0 - c1 - c2;

    // Un blocco per giorno
    function bloccoGiorno(giorno) {
      return [
        // Intestazione giorno (banda verde)
        new TableRow({ children: [
          new TableCell({
            columnSpan: 4,
            width: { size: W, type: WidthType.DXA },
            borders: BDS(V), shading: { fill: V, type: ShadingType.CLEAR },
            margins: { top: 80, bottom: 80, left: 160, right: 160 },
            children: [new Paragraph({ children: [
              new TextRun({ text: giorno.toUpperCase(), font: 'Arial', size: 22, bold: true, color: W_ }),
              new TextRun({ text: '   Data: ________________   N. Lotto / Bolla: _____________________', font: 'Arial', size: 17, color: 'CCFFCC' }),
            ]})],
          }),
        ]}),
        // Sotto-header
        new TableRow({ children: [hC('DA VERIFICARE', c0), hC('OK ✓', c1), hC('NON OK ✗', c2), hC('Note / Firma', c3)] }),
        // Voci
        ...voci.map(([v, note], i) => new TableRow({
          height: { value: 400, rule: 'exact' },
          children: [
            cell(v + (note ? ' — ' + note : ''), c0, { size: 16, fill: i % 2 === 0 ? W_ : VL, bc: 'DDDDDD' }),
            eC(c1, i % 2 === 0 ? W_ : VL),
            eC(c2, i % 2 === 0 ? W_ : VL),
            eC(c3, i % 2 === 0 ? W_ : VL),
          ],
        })),
      ];
    }

    return { properties: { page: pPort }, children: [
      intestazione('Autoc 8', 'CONTROLLI RICEVIMENTO PASTI — CCP1', W),
      sp(0.5),
      new Table({
        width: { size: W, type: WidthType.DXA }, columnWidths: [c0, c1, c2, c3],
        rows: giorni.flatMap(g => bloccoGiorno(g)),
      }),
      sp(),
      noteFooter('CCP1 — Limite critico: pasto caldo ≥ 65°C · pasto freddo/abbattuto ≤ 10°C. Se NON OK: rifiutare il pasto, contattare il fornitore, aprire Autoc 6.', W),
    ]};
  }

  // ── Autoc 8D — Registro disfagici (Portrait) ─────────────────
  function autoc8D() {
    if (!op_disfagici) return null;
    const W = W_P;
    const c0 = 560; const c1 = 560; const c2 = 1600; const c3 = 800; const c4 = 900; const c5 = 1000; const c6 = W - c0 - c1 - c2 - c3 - c4 - c5;
    return { properties: { page: pPort }, children: [
      intestazione('Autoc 8D', 'REGISTRO DISTRIBUZIONE PASTI DISFAGICI', W),
      sp(0.5),
      new Table({
        width: { size: W, type: WidthType.DXA }, columnWidths: [c0, c1, c2, c3, c4, c5, c6],
        rows: [
          new TableRow({ children: [hC('Data', c0), hC('Ora', c1), hC('Nome ospite', c2), hC('IDDSI level', c3), hC('T° ≥75°C ✓/✗', c4), hC('Allergie ✓/✗', c5), hC('Firma', c6)] }),
          ...Array.from({ length: 28 }, (_, i) => new TableRow({
            height: { value: 310, rule: 'exact' },
            children: [c0, c1, c2, c3, c4, c5, c6].map(w => eC(w, i % 2 === 0 ? W_ : VL)),
          })),
        ],
      }),
      sp(),
      noteFooter('IDDSI levels: L3 Minced · L4 Puree · L5 Soft · L6 Easy Chew. Verificare nominativo prima di ogni consegna. Anomalie deglutizione → bloccare e chiamare infermiere. NC → Autoc 6.', W),
    ]};
  }

  // ── Autoc 9 — Isolamento infettivo (Portrait) ─────────────────
  function autoc9() {
    if (!op_monouso_infetti) return null;
    const W = W_P;
    const c0 = 560; const c1 = 1600; const c2 = 1200; const c3 = 1000; const c4 = 1000; const c5 = W - c0 - c1 - c2 - c3 - c4;
    return { properties: { page: pPort }, children: [
      intestazione('Autoc 9', 'REGISTRO ISOLAMENTO INFETTIVO — GESTIONE PASTI', W),
      sp(0.5),
      new Table({
        width: { size: W, type: WidthType.DXA }, columnWidths: [c0, c1, c2, c3, c4, c5],
        rows: [
          new TableRow({ children: [hC('Data', c0), hC('Nome ospite / Stanza', c1), hC('Agente infettivo', c2), hC('Vassoio monouso ✓', c3), hC('DPI indossati ✓', c4), hC('Firma', c5)] }),
          ...Array.from({ length: 25 }, (_, i) => new TableRow({
            height: { value: 340, rule: 'exact' },
            children: [c0, c1, c2, c3, c4, c5].map(w => eC(w, i % 2 === 0 ? W_ : VL)),
          })),
        ],
      }),
      sp(),
      noteFooter('DPI obbligatori: guanti nitrile (1 paio per pasto) · mascherina chirurgica · grembiule monouso. Rifiuti in sacchetto "BIOHAZARD". Smaltimento tramite ditta autorizzata. NC → Autoc 6.', W),
    ]};
  }

  // ── Autoc 5A — Distributore acqua — una sezione per apparecchio ──
  function autoc5A({ codice = '', desc = '' } = {}) {
    const W = W_L;
    const etichetta = [codice, desc].filter(Boolean).join(' – ');
    const titoloSez = etichetta ? `MANUTENZIONE DISTRIBUTORE ACQUA POTABILE — ${etichetta}` : 'MANUTENZIONE DISTRIBUTORE ACQUA POTABILE';
    const mesi = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
    const attivita = [
      { att: 'Pulizia esterna erogatori e vassoio raccogligocce', freq: 'Giornaliera' },
      { att: 'Pulizia bocchetta erogazione', freq: 'Giornaliera' },
      { att: 'Far scorrere acqua per 3 minuti', freq: 'Settimanale' },
      { att: 'Sostituzione filtri (secondo scheda tecnica fornitore)', freq: 'Semestrale' },
      { att: 'Disinfezione circuito interno', freq: 'Semestrale' },
      { att: 'Analisi acqua erogata (laboratorio accreditato - fornitore)', freq: 'Annuale' },
      { att: 'Manutenzione tecnica completa (assistenza fornitore)', freq: 'Annuale' },
    ];

    // Tabella annuale: P = programmato, V = verificato — una colonna per mese
    const cAtt = Math.floor(W * 0.35);
    const cFreq = Math.floor(W * 0.12);
    const cM = Math.floor((W - cAtt - cFreq) / 12);
    const cLast = W - cAtt - cFreq - cM * 11;
    const colsAnn = [cAtt, cFreq, ...Array.from({length:12},(_,i) => i===11?cLast:cM)];

    // Tabella mensile: 31 giorni — righe per attività giornaliere e settimanali
    const attivitaGiorn = attivita.filter(a => a.freq === 'Giornaliera');
    const attivitaSet   = attivita.filter(a => a.freq === 'Settimanale');
    const attivitaMens  = [...attivitaGiorn, ...attivitaSet];
    const c0m = Math.floor(W * 0.35);
    const cGm = Math.floor((W - c0m) / 31);
    const cLm = W - c0m - cGm * 30;
    const colsMens = [c0m, ...Array.from({length:31},(_,i) => i===30?cLm:cGm)];

    return { properties: { page: pLand }, children: [
      intestazione('Autoc 5A', titoloSez, W, true),
      sp(0.5),
      // Tabella annuale P/V
      p([r('PIANO ANNUALE — P = Programmato · V = Verificato (apporre firma)', {bold:true, size:17, color:V})], {after:60}),
      new Table({
        width:{size:W,type:WidthType.DXA}, columnWidths:colsAnn,
        rows:[
          new TableRow({children:[hC('Attività',cAtt), hC('Frequenza',cFreq), ...mesi.map((m,i)=>hC(m,i===11?cLast:cM))]}),
          ...attivita.map(({att,freq},i)=>new TableRow({
            height:{value:500,rule:'exact'},
            children:[
              cell(att,cAtt,{size:15,fill:i%2===0?W_:VL,bc:'DDDDDD'}),
              cell(freq,cFreq,{size:14,italic:true,color:GS,fill:i%2===0?W_:VL,bc:'DDDDDD',align:AlignmentType.CENTER}),
              ...Array.from({length:12},(_,j)=>eC(j===11?cLast:cM,i%2===0?W_:VL)),
            ],
          })),
        ],
      }),
      sp(1),
      // Tabella mensile per attività settimanali
      p([r('MONITORAGGIO MENSILE — attività giornaliere e settimanali (firma per conferma)', {bold:true, size:17, color:V})], {after:60}),
      new Table({
        width:{size:W,type:WidthType.DXA}, columnWidths:colsMens,
        rows:[
          new TableRow({children:[hC('Attività',c0m), ...Array.from({length:31},(_,i)=>hC(String(i+1),i===30?cLm:cGm))]}),
          ...attivitaMens.map(({att,freq},i)=>new TableRow({
            height:{value:480,rule:'exact'},
            children:[
              cell(att+' ('+freq+')',c0m,{size:14,fill:i%2===0?W_:VL,bc:'DDDDDD'}),
              ...Array.from({length:31},(_,j)=>eC(j===30?cLm:cGm,i%2===0?W_:VL)),
            ],
          })),
        ],
      }),
      sp(),
      noteFooter('Conservare rapporti analisi acqua per 5 anni. NC → Autoc 6. Manutenzione tecnica: richiedere rapporto scritto al fornitore.', W),
    ]};
  }

  // ── Autoc 5B — Macchinetta bevande — una sezione per apparecchio ─
  function autoc5B({ codice = '', desc = '' } = {}) {
    const W = W_L;
    const etichetta = [codice, desc].filter(Boolean).join(' – ');
    const titoloSez = etichetta ? `MANUTENZIONE MACCHINETTA BEVANDE CALDE — ${etichetta}` : 'MANUTENZIONE MACCHINETTA BEVANDE CALDE';
    const mesi = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
    const attivita = [
      { att: 'Pulizia esterna macchina e vassoio raccogligocce', freq: 'Giornaliera' },
      { att: 'Premere tasto WASHING', freq: 'Giornaliera' },
      { att: 'Estrarre contenitori prodotti, pulizia, pulizia piano appoggio, pulizia bicchierini', freq: 'Settimanale' },
      { att: 'Decalcificazione circuito (o secondo display macchina)', freq: 'Mensile' },
      { att: 'Sostituzione filtro acqua', freq: 'Semestrale' },
    ];

    const attivitaGiorn = attivita.filter(a => a.freq === 'Giornaliera');
    const attivitaSet   = attivita.filter(a => a.freq === 'Settimanale');

    // Tabella annuale
    const cAtt = Math.floor(W * 0.35);
    const cFreq = Math.floor(W * 0.12);
    const cM = Math.floor((W - cAtt - cFreq) / 12);
    const cLast = W - cAtt - cFreq - cM * 11;
    const colsAnn = [cAtt, cFreq, ...Array.from({length:12},(_,i)=>i===11?cLast:cM)];

    // Tabella mensile giorni (per attività giornaliere e settimanali)
    const attivitaMens = [...attivitaGiorn, ...attivitaSet];
    const c0m = Math.floor(W * 0.35);
    const cGm = Math.floor((W - c0m) / 31);
    const cLm = W - c0m - cGm * 30;
    const colsMens = [c0m, ...Array.from({length:31},(_,i)=>i===30?cLm:cGm)];

    return { properties: { page: pLand }, children: [
      intestazione('Autoc 5B', titoloSez, W, true),
      sp(0.5),
      p([r('PIANO ANNUALE — P = Programmato · V = Verificato (apporre firma)', {bold:true, size:17, color:V})], {after:60}),
      new Table({
        width:{size:W,type:WidthType.DXA}, columnWidths:colsAnn,
        rows:[
          new TableRow({children:[hC('Attività',cAtt), hC('Frequenza',cFreq), ...mesi.map((m,i)=>hC(m,i===11?cLast:cM))]}),
          ...attivita.map(({att,freq},i)=>new TableRow({
            height:{value:500,rule:'exact'},
            children:[
              cell(att,cAtt,{size:15,fill:i%2===0?W_:VL,bc:'DDDDDD'}),
              cell(freq,cFreq,{size:14,italic:true,color:GS,fill:i%2===0?W_:VL,bc:'DDDDDD',align:AlignmentType.CENTER}),
              ...Array.from({length:12},(_,j)=>eC(j===11?cLast:cM,i%2===0?W_:VL)),
            ],
          })),
        ],
      }),
      sp(1),
      p([r('MONITORAGGIO MENSILE — attività giornaliere e settimanali (firma per conferma)', {bold:true, size:17, color:V})], {after:60}),
      new Table({
        width:{size:W,type:WidthType.DXA}, columnWidths:colsMens,
        rows:[
          new TableRow({children:[hC('Attività',c0m), ...Array.from({length:31},(_,i)=>hC(String(i+1),i===30?cLm:cGm))]}),
          ...attivitaMens.map(({att,freq},i)=>new TableRow({
            height:{value:480,rule:'exact'},
            children:[
              cell(att+' ('+freq+')',c0m,{size:14,fill:i%2===0?W_:VL,bc:'DDDDDD'}),
              ...Array.from({length:31},(_,j)=>eC(j===30?cLm:cGm,i%2===0?W_:VL)),
            ],
          })),
        ],
      }),
      sp(),
      noteFooter('Acqua con calcare elevato: aumentare frequenza decalcificazione. Conservare rapporti manutenzione. NC → Autoc 6.', W),
    ]};
  }

  // ── Autoc 5C — Macchina colazioni — una sezione per apparecchio ──
  function autoc5C({ codice = '', desc = '' } = {}) {
    const W = W_L;
    const etichetta = [codice, desc].filter(Boolean).join(' – ');
    const titoloSez = etichetta ? `MANUTENZIONE MACCHINA COLAZIONI — ${etichetta}` : 'MANUTENZIONE MACCHINA COLAZIONI';
    const mesi = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
    const attivita = [
      { att: 'Pulizia esterna macchina e vassoio raccogligocce',          freq: 'Giornaliera' },
      { att: 'Svuotamento e pulizia cassetto fondi caffè / cialde usate',  freq: 'Giornaliera' },
      { att: 'Pulizia ugelli erogazione caffè / latte / bevande calde',    freq: 'Settimanale' },
      { att: 'Risciacquo circuito interno (programma auto-pulizia)',       freq: 'Settimanale' },
      { att: 'Decalcificazione circuito (o su indicazione display)',       freq: 'Mensile' },
      { att: 'Sostituzione filtro acqua',                                  freq: 'Semestrale' },
      { att: 'Verifica data scadenza e rotazione ingredienti (latte, zucchero, polveri)', freq: 'Settimanale' },
      { att: 'Manutenzione tecnica completa (assistenza fornitore)',       freq: 'Annuale' },
    ];

    const attivitaGiorn = attivita.filter(a => a.freq === 'Giornaliera');
    const attivitaSet   = attivita.filter(a => a.freq === 'Settimanale');

    const cAtt  = Math.floor(W * 0.35);
    const cFreq = Math.floor(W * 0.12);
    const cM    = Math.floor((W - cAtt - cFreq) / 12);
    const cLast = W - cAtt - cFreq - cM * 11;
    const colsAnn = [cAtt, cFreq, ...Array.from({length:12},(_,i) => i===11?cLast:cM)];

    const attivitaMens = [...attivitaGiorn, ...attivitaSet];
    const c0m = Math.floor(W * 0.35);
    const cGm = Math.floor((W - c0m) / 31);
    const cLm = W - c0m - cGm * 30;
    const colsMens = [c0m, ...Array.from({length:31},(_,i) => i===30?cLm:cGm)];

    return { properties: { page: pLand }, children: [
      intestazione('Autoc 5C', titoloSez, W, true),
      sp(0.5),
      p([r('PIANO ANNUALE — P = Programmato · V = Verificato (apporre firma)', {bold:true, size:17, color:V})], {after:60}),
      new Table({
        width:{size:W,type:WidthType.DXA}, columnWidths:colsAnn,
        rows:[
          new TableRow({children:[hC('Attività',cAtt), hC('Frequenza',cFreq), ...mesi.map((m,i)=>hC(m,i===11?cLast:cM))]}),
          ...attivita.map(({att,freq},i)=>new TableRow({
            height:{value:500,rule:'exact'},
            children:[
              cell(att,cAtt,{size:15,fill:i%2===0?W_:VL,bc:'DDDDDD'}),
              cell(freq,cFreq,{size:14,italic:true,color:GS,fill:i%2===0?W_:VL,bc:'DDDDDD',align:AlignmentType.CENTER}),
              ...Array.from({length:12},(_,j)=>eC(j===11?cLast:cM,i%2===0?W_:VL)),
            ],
          })),
        ],
      }),
      sp(1),
      p([r('MONITORAGGIO MENSILE — attività giornaliere e settimanali (firma per conferma)', {bold:true, size:17, color:V})], {after:60}),
      new Table({
        width:{size:W,type:WidthType.DXA}, columnWidths:colsMens,
        rows:[
          new TableRow({children:[hC('Attività',c0m), ...Array.from({length:31},(_,i)=>hC(String(i+1),i===30?cLm:cGm))]}),
          ...attivitaMens.map(({att,freq},i)=>new TableRow({
            height:{value:480,rule:'exact'},
            children:[
              cell(att+' ('+freq+')',c0m,{size:14,fill:i%2===0?W_:VL,bc:'DDDDDD'}),
              ...Array.from({length:31},(_,j)=>eC(j===30?cLm:cGm,i%2===0?W_:VL)),
            ],
          })),
        ],
      }),
      sp(),
      noteFooter('Verificare scadenze ingredienti prima di ogni utilizzo. Acqua con calcare elevato: aumentare frequenza decalcificazione. NC → Autoc 6.', W),
    ]};
  }

  // ── Autoc 4 — Variazioni menù (Portrait) ─────────────────────
  function autoc4() {
    const W = W_P;
    const c0 = 600; const c1 = 600; const c2 = 1200; const c3 = Math.floor(W * 0.28); const c4 = W - c0 - c1 - c2 - c3;
    return { properties: { page: pPort }, children: [
      intestazione('Autoc 4', 'COMUNICAZIONE VARIAZIONI MENÙ', W),
      sp(0.5),
      new Table({
        width: { size: W, type: WidthType.DXA }, columnWidths: [c0, c1, c2, c3, c4],
        rows: [
          new TableRow({ children: [hC('Data', c0), hC('Pasto', c1), hC('Piatto sostituito', c2), hC('Piatto sostitutivo', c3), hC('Motivazione / Firma', c4)] }),
          ...Array.from({ length: 28 }, (_, i) => new TableRow({
            height: { value: 310, rule: 'exact' },
            children: [c0, c1, c2, c3, c4].map(w => eC(w, i % 2 === 0 ? W_ : VL)),
          })),
        ],
      }),
      sp(),
      noteFooter('Comunicare variazioni al responsabile di struttura entro l\'orario di servizio. Verificare assenza allergeni nel piatto sostitutivo prima della distribuzione.', W),
    ]};
  }

  // ── Autoc 7 — Elenco fornitori (Landscape) ───────────────────
  // ── Autoc 7 — Elenco fornitori (Portrait, 5 col Quinzano) ──────
  function autoc7() {
    const W = W_P;
    const c0 = Math.floor(W * 0.26);
    const c1 = Math.floor(W * 0.26);
    const c2 = Math.floor(W * 0.16);
    const c3 = Math.floor(W * 0.18);
    const c4 = W - c0 - c1 - c2 - c3;
    return { properties: { page: pPort }, children: [
      intestazione('Autoc 7', 'ELENCO FORNITORI QUALIFICATI', W),
      sp(0.5),
      new Table({
        width: { size: W, type: WidthType.DXA }, columnWidths: [c0, c1, c2, c3, c4],
        rows: [
          new TableRow({ children: [hC('Derrate / Prodotto', c0), hC('Fornitore', c1), hC('Telefono', c2), hC('Referente', c3), hC('Note', c4)] }),
          ...Array.from({ length: 16 }, (_, i) => new TableRow({
            height: { value: 480, rule: 'exact' },
            children: [c0, c1, c2, c3, c4].map(w => eC(w, i % 2 === 0 ? W_ : VL)),
          })),
        ],
      }),
      sp(),
      noteFooter('Aggiornare ad ogni cambio fornitore. Conservare SCIA e certificati nel fascicolo HACCP.', W),
    ]};
  }

  // ── Autoc 6 — Registro NC (Landscape, 14 righe ampie) ──────────
  function autoc6() {
    const W = W_L;
    const c0 = 500;
    const c1 = 800;
    const c2 = 800;
    const c3 = Math.floor((W - c0 - c1 - c2) * 0.45);
    const c4 = Math.floor((W - c0 - c1 - c2) * 0.40);
    const c5 = W - c0 - c1 - c2 - c3 - c4;
    return { properties: { page: pLand }, children: [
      intestazione('Autoc 6', 'REGISTRO GENERALE NON CONFORMITÀ', W, true),
      sp(0.5),
      new Paragraph({ children: [new TextRun({ text: 'Anno: _______________________', font: 'Arial', size: 20, bold: true, color: V })] }),
      sp(0.5),
      new Table({
        width: { size: W, type: WidthType.DXA }, columnWidths: [c0, c1, c2, c3, c4, c5],
        rows: [
          new TableRow({ children: [hC('N°', c0), hC('Scheda\nAutoc', c1), hC('Data', c2), hC('Identificazione Non Conformità', c3), hC('Azioni Correttive Attuate', c4), hC('Firma', c5)] }),
          ...Array.from({ length: 10 }, (_, i) => new TableRow({
            height: { value: 720, rule: 'exact' },
            children: [
              cell(String(i + 1), c0, { bold: true, align: AlignmentType.CENTER, size: 18, fill: i % 2 === 0 ? VL : W_, bc: 'DDDDDD' }),
              ...[c1, c2, c3, c4, c5].map(w => eC(w, i % 2 === 0 ? VL : W_)),
            ],
          })),
        ],
      }),
      sp(),
      noteFooter('Le NC vanno riportate anche in QualiCAVA (registro digitale). Conservare questo registro fisico per almeno 5 anni. NC gravi → notifica R-HACCP / ASL.', W),
    ]};
  }

  // ── Autoc 6M — Registro Manutenzione e Taratura (Portrait) ────
  function autoc6M() {
    const W  = W_P;
    const c0 = 900;
    const c1 = Math.floor(W * 0.28);
    const c2 = Math.floor(W * 0.25);
    const c3 = 900;
    const c4 = Math.floor(W * 0.10);
    const c5 = 950;
    const c6 = W - c0 - c1 - c2 - c3 - c4 - c5;

    const appRighe = righeApp.length > 0
      ? righeApp.map(r => [getCodice(r) + ' — ' + getDesc(r), 'Verifica T° con sonda esterna'])
      : [['Frigoriferi in gestione', 'Verifica T° con sonda esterna']];

    const righeFixed = [
      ...appRighe,
      ['Termometri a sonda', 'Taratura vs riferimento certificato'],
      ['Forno / Microonde riattivazione', 'Verifica funzionamento + pulizia interna'],
      ['Lavastoviglie', 'Verifica T° ciclo lavaggio ≥80°C'],
    ];
    const righeVuote = Array.from({ length: 6 }, () => ['', '']);
    const tutteRighe = [...righeFixed, ...righeVuote];

    return { properties: { page: pPort }, children: [
      intestazione('Autoc 6M', 'REGISTRO MANUTENZIONE E TARATURA ATTREZZATURE', W),
      sp(0.5),
      new Table({
        width: { size: W, type: WidthType.DXA }, columnWidths: [c0, c1, c2, c3, c4, c5, c6],
        rows: [
          new TableRow({ children: [hC('Data', c0), hC('Attrezzatura', c1), hC('Attività svolta', c2), hC('Esito OK/NC', c3), hC('Note', c4), hC('Firma ASA', c5), hC('Firma R-HACCP', c6)] }),
          ...tutteRighe.map(([att, attSvolta], i) => new TableRow({
            height: { value: 480, rule: 'exact' },
            children: [
              eC(c0, i % 2 === 0 ? VL : W_),
              cell(att       || '', c1, { size: 15, fill: i % 2 === 0 ? VL : W_, bc: 'DDDDDD', bold: !!att }),
              cell(attSvolta || '', c2, { size: 15, fill: i % 2 === 0 ? VL : W_, bc: 'DDDDDD' }),
              eC(c3, i % 2 === 0 ? VL : W_),
              eC(c4, i % 2 === 0 ? VL : W_),
              eC(c5, i % 2 === 0 ? VL : W_),
              eC(c6, i % 2 === 0 ? VL : W_),
            ],
          })),
        ],
      }),
      sp(),
      noteFooter('NC = Non Conforme. In caso di NC mettere attrezzatura fuori servizio fino a riparazione. Conservare rapporti di taratura per almeno 5 anni.', W),
    ]};
  }

  // ═══════════════════════════════════════════════════════════════
  // ASSEMBLAGGIO DOCUMENTO
  // ═══════════════════════════════════════════════════════════════

  const sezioni = [
    copertina(),
    autoc1(),
    ...(frigoCucina.length > 0 ? [autoc2ACucina()] : []),
    ...autoc2AReparti(),
    autoc2B(),
    ...(isCucinaInterna || isAppalto ? [autoc2C()] : []),
    autoc2D(),
    autoc2E(),
    ...(isCucinaInterna || isAppalto ? [autoc2F()] : []),
    autoc3A(),
    autoc3B(),
    autoc3C(),
    autoc3D(),
    autoc8(),
    autoc8D(),
    autoc9(),
    ...distributoriAcqua.map(app => autoc5A(app)),
    ...macchinetteCaffe.map(app  => autoc5B(app)),
    ...macchineColazioni.map(app => autoc5C(app)),
    autoc4(),
    autoc7(),
    autoc6(),
    autoc6M(),
  ].filter(Boolean);

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Arial', size: 20, color: NR } } } },
    sections: sezioni,
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
      op_distributore_acqua:       params.opDistributoreAcqua       || false,
      op_distributore_acqua_note:  params.opDistributoreNote        || '',
      op_macchinetta_caffe:        params.opMacchinettaCaffe        || false,
      op_macchinetta_caffe_note:   params.opMacchinettaCaffeNote    || '',
      op_macchina_colazioni:       params.opMacchinaColazioni       || false,
      op_macchina_colazioni_note:  params.opMacchinaColazioniNote   || '',
      op_disfagici:                params.opDisfagici               || false,
      op_cena_abbattuta:           params.opCenaAbbattuta           || false,
      op_srtr:                     params.opSrtr                    || false,
      op_monouso_infetti:          params.opMonousoInfetti          || false,
      op_riabilitazione:           params.opRiabilitazione          || false,
      logoVariante:                params.logoVariante              || 'B',
    }),
  ]);
  return { manuale, modulistica };
}
