// src/services/haccpManualeService.js
// Genera manuale HACCP .docx direttamente nel browser usando la libreria docx
// Loghi embedded come base64 — nessuna dipendenza da Edge Function o Storage

import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, Header, Footer, AlignmentType, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageBreak, TabStopType, SimpleField,
} from 'docx';

import { LOGO_A_BASE64, LOGO_B_BASE64 } from './logoBase64';

// ── Colori OVER ───────────────────────────────────────────────
const VERDE        = '1D6F42';
const VERDE_LIGHT  = 'E8F5EE';
const GRIGIO_TESTO = '4A4A4A';
const NERO         = '1A1A1A';

// ── Misure A4 (DXA) ───────────────────────────────────────────
const PAGE_W    = 11906;
const PAGE_H    = 16838;
const MARGIN    = 1134;
const CONTENT_W = PAGE_W - MARGIN * 2;

// ── Loghi: base64 → Uint8Array ────────────────────────────────
function b64ToUint8Array(b64) {
  const binary = atob(b64);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const LOGOS = {
  A: { data: () => b64ToUint8Array(LOGO_A_BASE64), type: 'jpg', w: 150, h: 75  },
  B: { data: () => b64ToUint8Array(LOGO_B_BASE64), type: 'jpg', w: 75,  h: 75  },
};

// ── Helper bordi ──────────────────────────────────────────────
const B  = (color = 'CCCCCC') => ({ style: BorderStyle.SINGLE, size: 1, color });
const BS = (c = 'CCCCCC')     => ({ top: B(c), bottom: B(c), left: B(c), right: B(c) });

// ── Helper celle ──────────────────────────────────────────────
function cell(text, w, opts = {}) {
  const { bold = false, size = 20, color = NERO, fill = 'FFFFFF',
          align = AlignmentType.LEFT, colspan = 1, italic = false, bc = 'DDDDDD' } = opts;
  return new TableCell({
    columnSpan: colspan,
    width:      { size: w, type: WidthType.DXA },
    borders:    BS(bc),
    shading:    { fill, type: ShadingType.CLEAR },
    margins:    { top: 80, bottom: 80, left: 120, right: 120 },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      alignment: align,
      children:  [new TextRun({ text: String(text || ''), bold, size, color, font: 'Arial', italic })],
    })],
  });
}

const hCell = (t, w, cs = 1) => cell(t, w, { bold: true, size: 18, color: 'FFFFFF', fill: VERDE, align: AlignmentType.CENTER, colspan: cs, bc: VERDE });
const lCell = (t, w)         => cell(t, w, { bold: true, size: 20, color: VERDE, fill: VERDE_LIGHT });

// ── Elementi paragrafo ────────────────────────────────────────
const run = (text, o = {}) => new TextRun({ text, font: 'Arial', size: o.size || 22, bold: o.bold || false, italic: o.italic || false, color: o.color || NERO });
const spacer = (n = 1)     => Array.from({ length: n }, () => new Paragraph({ children: [run('')] }));

function paragrafo(runs, o = {}) {
  return new Paragraph({
    alignment:       o.align || AlignmentType.LEFT,
    spacing:         { before: o.before || 0, after: o.after || 140, line: o.line || 276 },
    pageBreakBefore: o.pageBreak || false,
    border: o.borderBottom
      ? { bottom: { style: BorderStyle.SINGLE, size: o.borderSize || 6, color: VERDE, space: 4 } }
      : undefined,
    indent: o.indent || undefined,
    children: Array.isArray(runs) ? runs : [runs],
  });
}

const h1  = (t, pb = true) => paragrafo(run(t, { size: 32, bold: true, color: VERDE }), { pageBreak: pb, borderBottom: true, borderSize: 8, before: 200, after: 200 });
const h2  = (t)            => paragrafo(run(t, { size: 26, bold: true, color: VERDE }), { before: 240, after: 120, borderBottom: true, borderSize: 3 });
const h3  = (t)            => paragrafo(run(t, { size: 22, bold: true, color: VERDE }), { before: 160, after: 80 });
const txt = (t)            => paragrafo(run(t, { color: GRIGIO_TESTO }), { after: 140, line: 300 });

function bulletItem(t) {
  return new Paragraph({
    spacing: { before: 0, after: 80, line: 280 },
    indent:  { left: 360, hanging: 240 },
    children: [run('• ', { color: VERDE, bold: true }), run(t, { color: GRIGIO_TESTO })],
  });
}

// ── Converte testo con **bold** inline in array di TextRun ────
function parseInline(text) {
  // Caso speciale: **Label:** valore → label verde + valore normale
  const labelMatch = text.match(/^\*\*([^*]+)\*\*[:：]\s*(.*)$/);
  if (labelMatch) {
    return [
      new TextRun({ text: labelMatch[1] + ': ', font: 'Arial', size: 22, bold: true, color: VERDE }),
      new TextRun({ text: labelMatch[2], font: 'Arial', size: 22, color: GRIGIO_TESTO }),
    ];
  }
  // Caso generale: split su **...**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map(p => {
    if (p.startsWith('**') && p.endsWith('**')) {
      return new TextRun({ text: p.slice(2, -2), font: 'Arial', size: 22, bold: true, color: NERO });
    }
    return new TextRun({ text: p, font: 'Arial', size: 22, color: GRIGIO_TESTO });
  });
}

// ── Parser tabella markdown → Table docx ─────────────────────
function parseTabellaMd(lineeTabella) {
  // Filtra riga separatore |---|---| e righe vuote
  const righe = lineeTabella
    .filter(r => r.trim() && !r.match(/^\|[\s|:-]+\|$/));

  if (righe.length === 0) return null;

  // Estrai celle da ogni riga
  const parsedRows = righe.map(r =>
    r.trim().replace(/^\||\|$/g, '').split('|').map(c =>
      c.trim().replace(/^\*\*|\*\*$/g, '') // rimuovi bold markdown
    )
  );

  const numCols  = Math.max(...parsedRows.map(r => r.length));
  const colW     = Math.floor(CONTENT_W / numCols);
  const colWidths = Array.from({ length: numCols }, (_, i) =>
    i === numCols - 1 ? CONTENT_W - colW * (numCols - 1) : colW
  );


  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: parsedRows.map((cols, ri) => new TableRow({
      children: cols.map((c, ci) =>
        ri === 0 && lineeTabella[1]?.match(/^\|[\s|:-]+\|$/)
          ? hCell(c, colWidths[ci] || colW)
          : cell(c, colWidths[ci] || colW)
      ),
    })),
  });
}

// ── Helper bordi celle invisibili ────────────────────────────
const NOBORDER = {
  top:    { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left:   { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right:  { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
};

// ── Cella vuota invisibile ────────────────────────────────────
function emptyCell(w) {
  return new TableCell({
    width: { size: w, type: WidthType.DXA },
    borders: NOBORDER,
    children: [new Paragraph({ children: [] })],
  });
}

// ── Box singolo centrato (per diagrammi flusso) ───────────────
// fill: colore sfondo, borderColor: colore bordo, textColor: colore testo
// label: testo principale, sub: testo secondario (opzionale)
function flowBox(label, sub, { fill = VERDE_LIGHT, borderColor = VERDE, textColor = VERDE, bold = true, widthPct = 0.65 } = {}) {
  const W   = CONTENT_W;
  const bW  = Math.round(W * widthPct);
  const pad = Math.floor((W - bW) / 2);
  const rem = W - bW - pad;
  const children = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: sub ? 80 : 120, after: sub ? 40 : 120 },
      children: [new TextRun({ text: label, font: 'Arial', size: 20, bold, color: textColor })],
    }),
    ...(sub ? [new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 100 },
      children: [new TextRun({ text: sub, font: 'Arial', size: 17, bold: false, color: textColor, italic: true })],
    })] : []),
  ];
  return new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [pad, bW, rem],
    rows: [new TableRow({
      children: [
        emptyCell(pad),
        new TableCell({
          width: { size: bW, type: WidthType.DXA },
          borders: { top: B(borderColor), bottom: B(borderColor), left: B(borderColor), right: B(borderColor) },
          shading: { fill, type: ShadingType.CLEAR },
          margins: { top: 60, bottom: 60, left: 200, right: 200 },
          children,
        }),
        emptyCell(rem),
      ],
    })],
  });
}

// ── Freccia verticale centrata ────────────────────────────────
function arrowDown(label = '') {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 30, after: 30 },
    children: [
      ...(label ? [new TextRun({ text: label + '  ', font: 'Arial', size: 17, color: '888888', italic: true })] : []),
      new TextRun({ text: '▼', font: 'Arial', size: 22, color: VERDE, bold: true }),
    ],
  });
}

// ── Riga biforcazione (2 colonne) ────────────────────────────
// items: [{ label, sub, fill, borderColor, textColor }]
function flowRow(items) {
  const W   = CONTENT_W;
  const gap = 200;
  const bW  = Math.floor((W - gap * (items.length - 1)) / items.length);
  const cols = [];
  items.forEach((item, i) => {
    const children = [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 80, after: item.sub ? 40 : 80 },
        children: [new TextRun({ text: item.label, font: 'Arial', size: 19, bold: true, color: item.textColor || VERDE })],
      }),
      ...(item.sub ? [new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 80 },
        children: [new TextRun({ text: item.sub, font: 'Arial', size: 16, color: item.textColor || VERDE, italic: true })],
      })] : []),
    ];
    cols.push(new TableCell({
      width: { size: bW, type: WidthType.DXA },
      borders: { top: B(item.borderColor || VERDE), bottom: B(item.borderColor || VERDE), left: B(item.borderColor || VERDE), right: B(item.borderColor || VERDE) },
      shading: { fill: item.fill || VERDE_LIGHT, type: ShadingType.CLEAR },
      margins: { top: 60, bottom: 60, left: 160, right: 160 },
      children,
    }));
    if (i < items.length - 1) cols.push(emptyCell(gap));
  });
  return new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: items.map((_, i) => i < items.length - 1 ? [bW, gap] : [bW]).flat(),
    rows: [new TableRow({ children: cols })],
  });
}

// ── Frecce multiple affiancate ────────────────────────────────
function arrowRowDouble() {
  const W  = CONTENT_W;
  const cW = Math.floor(W / 2);
  return new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [cW, W - cW],
    rows: [new TableRow({
      children: [cW, W - cW].map(w => new TableCell({
        width: { size: w, type: WidthType.DXA },
        borders: NOBORDER,
        children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 30, after: 30 }, children: [new TextRun({ text: '▼', font: 'Arial', size: 22, color: VERDE, bold: true })] })],
      })),
    })],
  });
}

// ── Sezione 5: Diagrammi di flusso fissi ─────────────────────

// 5.1 Flusso generale veicolato
function diagrammaFlussoGenerale() {
  const TEAL   = { fill: 'E1F5EE', borderColor: '0F6E56', textColor: '0F6E56' };
  const AMBER  = { fill: 'FAEEDA', borderColor: '854F0B', textColor: '854F0B' };
  const BLUE   = { fill: 'E6F1FB', borderColor: '185FA5', textColor: '185FA5' };
  const CORAL  = { fill: 'FAECE7', borderColor: '993C1D', textColor: '993C1D' };
  const GRAY   = { fill: 'F1EFE8', borderColor: '5F5E5A', textColor: '5F5E5A' };

  return [
    h2('5.1 Diagramma Generale del Flusso Alimentare'),
    ...spacer(1),
    // Box esterno tratteggiato (centro cottura)
    new Table({
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
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Centro cottura esterno (Sodexo SpA)', font: 'Arial', size: 20, bold: true, color: '888888' })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Non gestito da struttura · SCIA esterna · Reg. CE 852/2004', font: 'Arial', size: 17, italic: true, color: 'AAAAAA' })] }),
          ],
        })],
      })],
    }),
    arrowDown('Contenitori isotermici'),
    flowBox('Ricevimento pasti (CCP1)', 'Verifica T° · Integrità imballaggi · Controllo allergeni · Registrazione', TEAL),
    arrowDown(),
    // Etichette biforcazione
    new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      columnWidths: [Math.floor(CONTENT_W / 2), Math.ceil(CONTENT_W / 2)],
      rows: [new TableRow({
        children: [
          new TableCell({ width: { size: Math.floor(CONTENT_W / 2), type: WidthType.DXA }, borders: NOBORDER, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Pranzo — caldo ≥65°C', font: 'Arial', size: 17, italic: true, color: '888888' })] })] }),
          new TableCell({ width: { size: Math.ceil(CONTENT_W / 2), type: WidthType.DXA }, borders: NOBORDER, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Cena — abbattuto ≤4°C', font: 'Arial', size: 17, italic: true, color: '888888' })] })] }),
        ],
      })],
    }),
    flowRow([
      { label: 'Stoccaggio breve', sub: 'Scaldavivande · ≥60°C · max 15 min', ...AMBER },
      { label: 'Stoccaggio frigorifero', sub: 'FR1-4 / FD · ≤4°C · fino a cena', ...BLUE },
    ]),
    arrowRowDouble(),
    flowBox('Riattivazione (CCP2)', 'Forno/microonde · ≥75°C al cuore · gastronorm separata per disfagici', CORAL),
    arrowDown(),
    flowBox('Porzionamento', 'Gastronorm · Etichetta nominale e tipologia dieta', GRAY),
    arrowDown(),
    flowBox('Distribuzione carrello termico', '≥65°C / ≤10°C · trasporto ≤20 min', TEAL),
    arrowDown(),
    flowBox('Somministrazione', 'Verifica nominativo · Doppio controllo dieta', { fill: 'EAF3DE', borderColor: '3B6D11', textColor: '3B6D11' }),
    arrowDown(),
    flowBox('Raccolta vassoi e rifiuti', 'Umido in gastronorm → bidone a pedale cucinetta', GRAY),
    arrowDown(),
    flowBox('Lavaggio e sanificazione', 'Stoviglie ≥60°C · Locali: settimanale', GRAY),
    ...spacer(1),
  ];
}

// 5.2 Diagramma CCP1 Ricevimento
function diagrammaCCP1() {
  const TEAL  = { fill: 'E1F5EE', borderColor: '0F6E56', textColor: '0F6E56' };
  const RED   = { fill: 'FCEBEB', borderColor: 'A32D2D', textColor: 'A32D2D' };
  const AMBER = { fill: 'FAEEDA', borderColor: '854F0B', textColor: '854F0B' };
  const BLUE  = { fill: 'E6F1FB', borderColor: '185FA5', textColor: '185FA5' };

  return [
    h2('5.2 Diagramma Dettagliato: Ricevimento e Controllo (CCP1)'),
    ...spacer(1),
    flowBox('Arrivo contenitore da Sodexo SpA', null, { fill: 'F1EFE8', borderColor: '5F5E5A', textColor: '5F5E5A' }),
    arrowDown(),
    flowBox('Ispezione visiva contenitore', 'Integrità · Assenza danni · Etichetta leggibile · Coperchio integro', TEAL),
    arrowDown('Non conforme?'),
    flowRow([
      { label: 'Non conforme → RIFIUTO', sub: 'Documentare · Contattare Sodexo · Modulo anomalia', ...RED },
      { label: 'Conforme → Misurazione T°', sub: 'Sonda nel punto più caldo · Lettura digitale (2 punti)', ...TEAL },
    ]),
    arrowDown(),
    flowRow([
      { label: 'Pranzo caldo ≥65°C', sub: 'OK → Stoccaggio scaldavivande ≤15 min', ...AMBER },
      { label: 'Cena abbattuto ≤4°C', sub: 'OK → Stoccaggio frigo FR1-4 o FD', ...BLUE },
    ]),
    new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      columnWidths: [Math.floor(CONTENT_W / 2), Math.ceil(CONTENT_W / 2)],
      rows: [new TableRow({
        children: [
          new TableCell({ width: { size: Math.floor(CONTENT_W / 2), type: WidthType.DXA }, borders: NOBORDER, children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 20, after: 20 }, children: [new TextRun({ text: 'Se <65°C → RIFIUTO + Modulo NC', font: 'Arial', size: 16, italic: true, color: 'A32D2D' })] })] }),
          new TableCell({ width: { size: Math.ceil(CONTENT_W / 2), type: WidthType.DXA }, borders: NOBORDER, children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 20, after: 20 }, children: [new TextRun({ text: 'Se >4°C → RIFIUTO + Modulo NC', font: 'Arial', size: 16, italic: true, color: 'A32D2D' })] })] }),
        ],
      })],
    }),
    ...spacer(1),
  ];
}

// 5.3 Diagramma CCP2 Riattivazione
function diagrammaCCP2() {
  const CORAL = { fill: 'FAECE7', borderColor: '993C1D', textColor: '993C1D' };
  const GREEN = { fill: 'EAF3DE', borderColor: '3B6D11', textColor: '3B6D11' };
  const RED   = { fill: 'FCEBEB', borderColor: 'A32D2D', textColor: 'A32D2D' };
  const AMBER = { fill: 'FAEEDA', borderColor: '854F0B', textColor: '854F0B' };

  return [
    h2('5.3 Diagramma Dettagliato: Riattivazione Pasti Abbattuti (CCP2)'),
    ...spacer(1),
    flowBox('Pasto abbattuto prelevato da FR1-4 o FD', 'Temperatura ≤4°C verificata', { fill: 'E6F1FB', borderColor: '185FA5', textColor: '185FA5' }),
    arrowDown(),
    flowBox('Identificazione dieta', 'Etichetta ospite · Tipologia (celiaco, disfagico…) · Data ricezione', AMBER),
    arrowDown(),
    flowBox('Piazzamento in gastronorm', 'Cibo in recipiente aperto o coperchiato · Identificazione mantenuta', CORAL),
    arrowDown('Modalità riattivazione'),
    flowRow([
      { label: 'Forno (Nuclei B, D)', sub: '180°C · 20-30 minuti', ...CORAL },
      { label: 'Microonde (Nuclei AS, C)', sub: 'Potenza 100% · 3-5 minuti', ...CORAL },
    ]),
    arrowRowDouble(),
    flowBox('Verifica temperatura ≥75°C al cuore', 'Sonda nel punto più caldo (centro gastronorm)', AMBER),
    arrowDown(),
    flowRow([
      { label: 'SÌ ≥75°C → Idoneo', sub: 'Servizio entro 30 min · ≥65°C in carrello', ...GREEN },
      { label: 'NO <75°C → Riscaldamento supplementare', sub: 'Reiterare · Se ancora NC → smaltire · Modulo CCP2', ...RED },
    ]),
    arrowDown(),
    flowBox('Servizio e distribuzione ospite', 'Trasporto ≤20 min · Registrazione Modulo CCP2 (T° e ora)', GREEN),
    ...spacer(1),
  ];
}

// 5.4 Diagramma pasti disfagici
function diagrammaDisfagici() {
  const BLUE   = { fill: 'E6F1FB', borderColor: '185FA5', textColor: '185FA5' };
  const PURPLE = { fill: 'EEEDFE', borderColor: '534AB7', textColor: '534AB7' };
  const CORAL  = { fill: 'FAECE7', borderColor: '993C1D', textColor: '993C1D' };
  const AMBER  = { fill: 'FAEEDA', borderColor: '854F0B', textColor: '854F0B' };
  const GREEN  = { fill: 'EAF3DE', borderColor: '3B6D11', textColor: '3B6D11' };
  const GRAY   = { fill: 'F1EFE8', borderColor: '5F5E5A', textColor: '5F5E5A' };

  return [
    h2('5.4 Diagramma Dettagliato: Pasti Disfagici (Nucleo AS)'),
    ...spacer(1),
    flowBox('Ricevimento pasto disfagico abbattuto Sodexo', 'Frigorifero FD · Piano interrato · ≤4°C (Nucleo AS)', BLUE),
    arrowDown(),
    flowBox('Identificazione nominativa ospite', 'Nome · Data ricezione · Consistenza IDDSI (L2/L3/L4) · Scadenza', PURPLE),
    arrowDown(),
    flowBox('Stoccaggio FD', 'Ripiani dedicati · ≤4°C · Separazione da altri alimenti', BLUE),
    arrowDown(),
    flowBox('Riattivazione (CCP2) — cucinetta nucleo AS', 'Microonde · Gastronorm dedicata e identificata · Contestuale ai pasti Sodexo', CORAL),
    arrowDown(),
    flowBox('Verifica temperatura ≥75°C al cuore (CCP2)', 'Sonda · Se <75°C → riscaldamento supplementare', AMBER),
    arrowDown(),
    flowBox('Somministrazione — doppio controllo', 'Verifica nominativo ospite · Solo operatore OSA autorizzato', GREEN),
    arrowDown(),
    flowBox('Registrazione distribuzione', 'Nome · Data/ora · Consistenza IDDSI erogata · Firma operatore', GRAY),
    ...spacer(1),
  ];
}

// 5.5 Diagramma isolamento infettivo
function diagrammaIsolamento() {
  const RED   = { fill: 'FCEBEB', borderColor: 'A32D2D', textColor: 'A32D2D' };
  const AMBER = { fill: 'FAEEDA', borderColor: '854F0B', textColor: '854F0B' };
  const GRAY  = { fill: 'F1EFE8', borderColor: '5F5E5A', textColor: '5F5E5A' };

  return [
    h2('5.5 Diagramma Dettagliato: Isolamento Infettivo'),
    ...spacer(1),
    flowBox('Ospite in isolamento infettivo', 'R-HACCP informa OSA: tipo isolamento e durata', RED),
    arrowDown(),
    flowBox('Preparazione vassoio monouso', 'Piatto, bicchiere, posate monouso biodegradabili · Etichetta ospite', AMBER),
    arrowDown(),
    flowBox('Distribuzione con DPI', 'Guanti monouso · Mascherina FFP2/N95 · Cambio DPI per ospite', RED),
    arrowDown(),
    flowBox('Raccolta vassoio (stesso operatore, DPI)', 'Inserimento in sacchetto separato etichettato "BIOHAZARD ISOLAMENTO"', RED),
    arrowDown(),
    flowBox('Smaltimento rifiuti speciali (RM)', 'Conferimento giornaliero a ditta autorizzata · Registrazione modulo tracciamento', AMBER),
    arrowDown(),
    flowBox('Sanificazione locale', 'Detergente + disinfettante · Cloro 0,5% o equiv. · Contatto 10 min · Asciugatura', GRAY),
    ...spacer(1),
  ];
}

// 5.4 Flusso colazioni e merende
function diagrammaColazioni() {
  const AMBER = { fill: 'FAEEDA', borderColor: '854F0B', textColor: '854F0B' };
  const GRAY  = { fill: 'F1EFE8', borderColor: '5F5E5A', textColor: '5F5E5A' };
  const GREEN = { fill: 'EAF3DE', borderColor: '3B6D11', textColor: '3B6D11' };
  return [
    h2('5.4 Flusso Colazioni e Merende'),
    ...spacer(1),
    flowBox('Prodotti da magazzino derrate e frigoriferi di nucleo', null, AMBER),
    arrowDown(),
    flowBox('Controllo visivo scadenze e integrità confezioni', null, GRAY),
    arrowDown(),
    flowBox('Preparazione in cucinetta', 'Igiene mani + DPI · Piano lavoro pulito', GRAY),
    arrowDown(),
    flowBox('Distribuzione ospiti', 'Erogatore bevande calde · Prodotti confezionati · Separazione diete speciali', GREEN),
    arrowDown(),
    flowBox('Raccolta stoviglie e lavaggio', null, GRAY),
    ...spacer(1),
  ];
}

// 5.5 Flusso celiaci e allergeni
function diagrammaCeliaci() {
  const TEAL  = { fill: 'E1F5EE', borderColor: '0F6E56', textColor: '0F6E56' };
  const AMBER = { fill: 'FAEEDA', borderColor: '854F0B', textColor: '854F0B' };
  const GREEN = { fill: 'EAF3DE', borderColor: '3B6D11', textColor: '3B6D11' };
  const GRAY  = { fill: 'F1EFE8', borderColor: '5F5E5A', textColor: '5F5E5A' };
  return [
    h2('5.5 Flusso Gestione Celiaci e Allergeni'),
    ...spacer(1),
    flowBox('Ricevimento pasto Gluten-Free da Sodexo SpA', 'Contenitore con etichetta "GLUTEN-FREE" + nominativo ospite', TEAL),
    arrowDown(),
    flowBox('Verifica e stoccaggio separato', 'Frigorifero di nucleo · Ripiano superiore · Separato da altri pasti', TEAL),
    arrowDown(),
    flowBox('Riattivazione (se abbattuto)', 'Gastronorm dedicata "GF" · ≥75°C al cuore · Scaldavivande separato', AMBER),
    arrowDown(),
    flowBox('Porzionamento su stoviglie dedicate "GF"', 'Piano lavoro sanificato con alcol 70° · Utensili esclusivi GF', AMBER),
    arrowDown(),
    flowBox('Somministrazione PER PRIMO (prima degli altri ospiti)', 'Previene contaminazione da briciole e cross-contaminazione', GREEN),
    arrowDown(),
    flowBox('Raccolta e lavaggio separato stoviglie GF', 'Cesto dedicato · Ciclo lavastoviglie separato · Armadio "STOVIGLIE GF"', GRAY),
    ...spacer(1),
  ];
}

// 5.6 Flusso sanificazione stoviglie
function diagrammaStoviglie() {
  const BLUE = { fill: 'E6F1FB', borderColor: '185FA5', textColor: '185FA5' };
  const GRAY = { fill: 'F1EFE8', borderColor: '5F5E5A', textColor: '5F5E5A' };
  const GREEN = { fill: 'EAF3DE', borderColor: '3B6D11', textColor: '3B6D11' };
  return [
    h2('5.6 Flusso Pulizia e Sanificazione Stoviglie'),
    ...spacer(1),
    flowBox('Raccolta vassoi sporchi dalla distribuzione', 'Smistamento per tipo dieta · Celiaci separati', GRAY),
    arrowDown(),
    flowBox('Risciacquo sotto acqua corrente fredda', null, BLUE),
    arrowDown(),
    flowBox('Prelavaggio manuale', 'Detergente + spazzola', BLUE),
    arrowDown(),
    flowBox('Lavaggio', 'Lavastoviglie 70-80°C ciclo 45 min · Oppure manuale acqua calda + disinfettante', BLUE),
    arrowDown(),
    flowBox('Risciacquo con acqua calda + asciugatura', 'Rack dedicato o aria calda', BLUE),
    arrowDown(),
    flowBox('Stoccaggio in armadi chiusi', 'Stoviglie GF in armadio dedicato etichettato', GREEN),
    ...spacer(1),
  ];
}

// 5.7 Flusso sanificazione locali
function diagrammaSanificazione() {
  const TEAL  = { fill: 'E1F5EE', borderColor: '0F6E56', textColor: '0F6E56' };
  const AMBER = { fill: 'FAEEDA', borderColor: '854F0B', textColor: '854F0B' };
  const GRAY  = { fill: 'F1EFE8', borderColor: '5F5E5A', textColor: '5F5E5A' };
  return [
    h2('5.7 Flusso Sanificazione Locali'),
    ...spacer(1),
    flowRow([
      { label: 'Cucinette nucleo — giornaliera', sub: 'Superfici · Scaldavivande · Erogatore · Pavimento', ...TEAL },
      { label: 'Locale piano interrato — settimanale', sub: 'Superfici · Frigo FD · Pavimento', ...AMBER },
      { label: 'Magazzino derrate — mensile', sub: 'Scaffali · Verifica zanzariera · Parassiti', ...GRAY },
    ]),
    arrowDown(),
    flowBox('Rimozione rifiuti e residui alimentari', null, GRAY),
    arrowDown(),
    flowBox('Pulizia superfici con detergente neutro + acqua', 'Piano lavoro · Attrezzature · Frigoriferi', TEAL),
    arrowDown(),
    flowBox('Disinfezione con spray disinfettante autorizzato', 'Contatto minimo 10 min · Risciacquo se necessario', AMBER),
    arrowDown(),
    flowBox('Pulizia pavimento con mop + disinfettante', 'Senso porta → interno · Cambio acqua ogni locale', GRAY),
    arrowDown(),
    flowBox('Verifica visiva e registrazione su modulo sanificazione', null, { fill: 'EAF3DE', borderColor: '3B6D11', textColor: '3B6D11' }),
    ...spacer(1),
  ];
}
function tabellaCCP() {
  const W  = CONTENT_W;
  const c0 = Math.round(W * 0.13); // Fase
  const c1 = Math.round(W * 0.20); // Pericolo
  const c2 = Math.round(W * 0.05); // Tipo
  const c3 = Math.round(W * 0.21); // Misure preventive
  const c4 = Math.round(W * 0.21); // Monitoraggio
  const c5 = W - c0 - c1 - c2 - c3 - c4; // Esito

  const header = new TableRow({
    tableHeader: true,
    children: [
      hCell('Fase', c0),
      hCell('Pericolo identificato', c1),
      hCell('Tipo', c2),
      hCell('Misure preventive', c3),
      hCell('Monitoraggio', c4),
      hCell('Esito', c5),
    ],
  });

  const FILL_CCP  = 'E1F5EE'; // teal chiaro
  const FILL_PCC  = 'FAEEDA'; // amber chiaro
  const FILL_B    = 'FCEBEB'; // rosso chiaro
  const FILL_C    = 'E6F1FB'; // blu chiaro
  const FILL_F    = 'F1EFE8'; // grigio chiaro
  const FILL_FASE = 'F0F4F0'; // grigio-verde sezione

  const COL_CCP  = '0F6E56';
  const COL_PCC  = '854F0B';
  const COL_B    = 'A32D2D';
  const COL_C    = '185FA5';
  const COL_F    = '5F5E5A';

  function badgeCell(text, fillColor, textColor, w) {
    return new TableCell({
      width: { size: w, type: WidthType.DXA },
      borders: BS('DDDDDD'),
      shading: { fill: fillColor, type: ShadingType.CLEAR },
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text, font: 'Arial', size: 17, bold: true, color: textColor })],
      })],
    });
  }

  function dataCell(text, w, opts = {}) {
    return new TableCell({
      width: { size: w, type: WidthType.DXA },
      borders: BS('DDDDDD'),
      shading: { fill: opts.fill || 'FFFFFF', type: ShadingType.CLEAR },
      margins: { top: 60, bottom: 60, left: 120, right: 100 },
      verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({
        children: [new TextRun({ text: String(text || ''), font: 'Arial', size: 17, color: opts.color || GRIGIO_TESTO, bold: opts.bold || false })],
      })],
    });
  }

  function faseRow(label) {
    return new TableRow({
      children: [new TableCell({
        columnSpan: 6,
        width: { size: W, type: WidthType.DXA },
        borders: { top: B('AAAAAA'), bottom: B('AAAAAA'), left: B('AAAAAA'), right: B('AAAAAA') },
        shading: { fill: FILL_FASE, type: ShadingType.CLEAR },
        margins: { top: 60, bottom: 60, left: 160, right: 160 },
        children: [new Paragraph({
          children: [new TextRun({ text: label.toUpperCase(), font: 'Arial', size: 17, bold: true, color: VERDE })],
        })],
      })],
    });
  }

  function row(fase, pericolo, tipo, misure, monitoraggio, esito) {
    const tipoFill  = tipo === 'B' ? FILL_B : tipo === 'C' ? FILL_C : FILL_F;
    const tipoColor = tipo === 'B' ? COL_B  : tipo === 'C' ? COL_C  : COL_F;
    const esitoCcp  = esito.startsWith('CCP');
    const esitoFill = esitoCcp ? FILL_CCP : FILL_PCC;
    const esitoCol  = esitoCcp ? COL_CCP  : COL_PCC;
    return new TableRow({
      children: [
        dataCell(fase, c0),
        dataCell(pericolo, c1),
        badgeCell(tipo, tipoFill, tipoColor, c2),
        dataCell(misure, c3),
        dataCell(monitoraggio, c4),
        badgeCell(esito, esitoFill, esitoCol, c5),
      ],
    });
  }

  const rows = [
    header,
    faseRow('Ricevimento pasti caldi (pranzo)'),
    row('Ricevimento caldo', 'Temperatura inadeguata <65°C', 'B', 'Fornitura min ≥65°C; ispezione visiva contenitore', 'Misurazione T° (2 punti); Modulo CCP1', 'CCP1'),
    row('', 'Allergeni non dichiarati', 'C', 'SCIA Sodexo con dichiarazione allergeni; verifica etichetta', 'Controllo etichetta 100% pasti celiaci; registrazione', 'PCC'),
    row('', 'Contaminazione biologica contenitore', 'B', 'Fornitore certificato; ispezione contenitore', 'Ispezione visiva; segnalazione anomalie', 'PCC'),
    row('', 'Danni/perdite contenitori', 'F', 'Controllo integrità imballaggio; reso merce danneggiata', 'Ispezione visiva 100%; modulo anomalia', 'PCC'),
    faseRow('Ricevimento pasti abbattuti (cena)'),
    row('Ricevimento abbattuto', 'Temperatura inadeguata >4°C', 'B', 'Fornitura max ≤4°C; verifica T° al ricevimento', 'Misurazione T° (2 punti); Modulo CCP1', 'CCP1'),
    row('', 'Rottura catena freddo', 'B', 'Ispezione confezione; trasporto ≤40 min', 'Controllo visivo sigilli; orario ricezione', 'PCC'),
    faseRow('Stoccaggio'),
    row('Stoccaggio caldo', 'Abbassamento T° <60°C', 'B', 'Manutenzione scaldavivande; max 15 min', 'Verifica T° scaldavivande ogni mattina', 'PCC'),
    row('Stoccaggio freddo', 'Innalzamento T° >4°C', 'B', 'Taratura termometro annuale; manutenzione semestrale', 'Lettura 2×/giorno (8:00, 18:00); Modulo Frigo', 'PCC'),
    row('', 'Cross-contaminazione celiaci/disfagici', 'C', 'Ripiani dedicati; etichette; sanificazione settimanale', 'Ispezione visiva settimanale ripiani', 'PCC'),
    faseRow('Riattivazione pasti abbattuti'),
    row('Riattivazione', 'T° insufficiente <75°C al cuore', 'B', 'Forni calibrati; istruzioni per tipo gastronorm', 'Sonda al cuore 100% riattivazioni; Modulo CCP2', 'CCP2'),
    row('', 'Tempo riscaldamento >30 min', 'B', 'Procedure scritte; coordinamento con distribuzione', 'Registrazione ora fine cottura / inizio distribuzione', 'PCC'),
    row('', 'Riattivazione multipla (>1)', 'B', 'Max 1 riattivazione; istruzioni operative', 'Registrazione n° riattivazioni; smaltimento se >1', 'PCC'),
    faseRow('Porzionamento'),
    row('Porzionamento', 'Identificazione errata dieta/ospite', 'C', 'Etichette chiare; identificazione nominativa gastronorm', 'Verifica etichetta 100%; registrazione distribuzione', 'PCC'),
    row('', 'Contaminazione crociata allergeni', 'C', 'Utensili dedicati celiaci; lavaggio mani tra alimenti', 'Ispezione aree porzionamento; formazione operatori', 'PCC'),
    faseRow('Distribuzione e somministrazione'),
    row('Distribuzione', 'T° non mantenuta: caldo <65°C', 'B', 'Carrello isolamento efficiente; trasporto max 20 min', 'T° al caricamento/scaricamento; Modulo Carrello', 'PCC'),
    row('', 'T° non mantenuta: freddo >10°C', 'B', 'Manutenzione semestrale; controllo T° prima uso', 'Misurazione scomparto freddo; registrazione', 'PCC'),
    row('Somministrazione', 'Pasto allergizzante a ospite celiaco', 'C', 'Verifica nominativo + tipologia dieta; doppio controllo', 'Registrazione con firma operatore', 'PCC'),
    row('Isolamento', 'Trasmissione patogeno infettivo', 'B', 'DPI obbligatori (guanti, FFP2); vassoio monouso', 'Verifica DPI; registrazione distribuzioni isolamento', 'PCC'),
    faseRow('Raccolta vassoi e lavaggio'),
    row('Raccolta vassoi', 'Contaminazione operatore da rifiuti', 'B', 'DPI (guanti, grembiule); lavaggio mani immediato', 'Controllo uso DPI; formazione continua', 'PCC'),
    row('Isolamento', 'Rifiuti speciali non separati', 'B', 'Sacchetti separati "BIOHAZARD"; smaltimento giornaliero', 'Ispezione sacchetti; registrazione smaltimento', 'PCC'),
  ];

  return new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [c0, c1, c2, c3, c4, c5],
    rows,
  });
}

// ── parseDiagramma: rimossa — ora i diagrammi sono fissi ─────
// Il parser markdown continua a funzionare ma salta le righe con →/↓
// che prima generavano i diagrammi testuali brutti.

// ── Parser markdown → elementi docx ──────────────────────────
function parseMarkdown(rawText) {
  const lines  = rawText.split('\n');
  const result = [];
  let firstH1  = true;
  let i        = 0;

  while (i < lines.length) {
    const t = lines[i].trim();

    // Tabella markdown
    if (t.startsWith('|')) {
      const tableLines = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      const tbl = parseTabellaMd(tableLines);
      if (tbl) { result.push(...spacer(1)); result.push(tbl); result.push(...spacer(1)); }
      continue;
    }

    // Separatore ---
    if (t.match(/^-{3,}$/) || t.match(/^\*{3,}$/)) {
      result.push(paragrafo(run(''), { borderBottom: true, borderSize: 4, after: 80 }));
      i++; continue;
    }

    if (!t) { result.push(new Paragraph({ children: [run('')] })); i++; continue; }

    // Righe con frecce ASCII (→ ↓) o box testuali (┌ └ │) — saltate:
    // i diagrammi di flusso sono ora generati come elementi fissi nativi docx
    const hasFreccia  = t.includes('→') || t.includes('↓');
    const hasBoxChars = t.includes('┌') || t.includes('└') || t.includes('│') || t.includes('├') || t.includes('┘') || t.includes('┐');
    if (hasFreccia || hasBoxChars) { i++; continue; }
    // Blocchi ``` (delimitatori codice usati per i vecchi diagrammi ASCII) — saltati
    if (t === '```') { i++; continue; }

    // Titoli — rimuovi eventuale numerazione tipo "13." davanti
    if (t.startsWith('# ')) {
      result.push(h1(t.replace(/^#\s+/, ''), !firstH1));
      firstH1 = false;
    }
    else if (t.startsWith('## ')) { result.push(h2(t.replace(/^##\s+/, ''))); }
    else if (t.startsWith('### '))  { result.push(h3(t.replace(/^###\s+/, ''))); }
    else if (t.startsWith('#### ') || t.startsWith('##### ')) {
      result.push(paragrafo(run(t.replace(/^#{4,6}\s+/, ''), { size: 22, bold: true, color: VERDE }), { before: 120, after: 60 }));
    }
    else if (t.match(/^[-•*]\s+/))  { result.push(bulletItem(t.replace(/^[-•*]\s+/, ''))); }
    // Numerazione tipo "1.", "1.1", "13." — testo normale con lieve indent
    else if (t.match(/^\d+(\.\d+)*\.\s+/) && !t.match(/^#{1,6}\s/)) {
      result.push(new Paragraph({
        spacing: { before: 60, after: 100, line: 300 },
        indent: { left: 240 },
        children: parseInline(t),
      }));
    }
    else if (t.match(/\*\*/)) {
      result.push(new Paragraph({
        spacing: { before: 40, after: 100, line: 300 },
        children: parseInline(t),
      }));
    }
    else { result.push(txt(t)); }

    i++;
  }
  return result;
}

// ── Tabelle ───────────────────────────────────────────────────
function tabellaDati(righe) {
  const c1 = Math.floor(CONTENT_W * 0.38);
  const c2 = CONTENT_W - c1;
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [c1, c2],
    rows: righe.map(([label, valore]) => new TableRow({
      children: [lCell(label, c1), cell(valore || '—', c2)],
    })),
  });
}

function tabellaRevisioni(numRev, dataRev, redattore, noteRev, lr) {
  const cR = 580, cD = 1200, cRed = 1900, cApp = 1600;
  const cDesc = CONTENT_W - cR - cD - cRed - cApp;
  const cols  = [cR, cD, cRed, cDesc, cApp];
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: cols,
    rows: [
      new TableRow({ children: [hCell('Rev.', cR), hCell('Data', cD), hCell('Redatto da', cRed), hCell('Descrizione variazioni', cDesc), hCell('Approvato da', cApp)] }),
      new TableRow({ height: { value: 480, rule: 'exact' }, children: [cell(numRev, cR, { align: AlignmentType.CENTER }), cell(dataRev, cD), cell(redattore, cRed), cell(noteRev || 'Prima emissione', cDesc), cell(lr || '—', cApp)] }),
      ...Array.from({ length: 4 }, () => new TableRow({ height: { value: 480, rule: 'exact' }, children: cols.map(w => cell('', w)) })),
    ],
  });
}

// ── Funzione principale ───────────────────────────────────────
export async function generaManualeHaccp(params) {
  const {
    nomestruttura  = '[STRUTTURA]',
    osa            = '[OSA]',
    pivaOsa        = '—',
    modello        = 'distribuzione_veicolata',
    lr             = '—',
    rHaccp         = '—',
    teamHaccp      = [],
    numRev         = '1',
    dataRev        = new Date().toLocaleDateString('it-IT'),
    redattore      = 'Ufficio Qualità OVER',
    noteRevisione  = 'Prima emissione',
    testoManuale   = '',
    logoVariante   = 'A',
  } = params;

  const logoCfg  = LOGOS[logoVariante] || LOGOS.A;
  const logoData = logoCfg.data();

  // ── HEADER ──────────────────────────────────────────────────
  const header = new Header({
    children: [
      new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: VERDE, space: 4 } },
        spacing: { after: 100 },
        children: [
          new ImageRun({ data: logoData, transformation: { width: Math.round(logoCfg.w * 0.6), height: Math.round(logoCfg.h * 0.6) }, type: logoCfg.type }),
          run('   MANUALE HACCP — ' + nomestruttura.toUpperCase(), { size: 16, color: VERDE, bold: true }),
        ],
      }),
    ],
  });

  // ── FOOTER ──────────────────────────────────────────────────
  const footer = new Footer({
    children: [
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W }],
        border:   { top: { style: BorderStyle.SINGLE, size: 4, color: VERDE, space: 4 } },
        spacing:  { before: 80 },
        children: [
          run(nomestruttura, { size: 18, color: GRIGIO_TESTO }),
          new TextRun({ text: '\t', size: 18 }),
          run('Pagina ', { size: 18, color: GRIGIO_TESTO }),
          new SimpleField('PAGE',     run('', { size: 18, color: GRIGIO_TESTO })),
          run(' di ',   { size: 18, color: GRIGIO_TESTO }),
          new SimpleField('NUMPAGES', run('', { size: 18, color: GRIGIO_TESTO })),
        ],
      }),
    ],
  });

  // ── COPERTINA ───────────────────────────────────────────────
  const teamRighe = (teamHaccp || []).filter(m => m.ruolo).map(m => [m.ruolo, m.nome || '—']);

  const copertina = [
    new Paragraph({ spacing: { after: 0 }, children: [new ImageRun({ data: logoData, transformation: { width: logoCfg.w, height: logoCfg.h }, type: logoCfg.type })] }),
    ...spacer(2),
    paragrafo(run(''), { borderBottom: true, borderSize: 14, after: 80 }),
    ...spacer(1),
    paragrafo(run('MANUALE HACCP', { size: 56, bold: true, color: VERDE }), { after: 60 }),
    paragrafo(run('Sistema di Autocontrollo Alimentare', { size: 28, italic: true, color: VERDE }), { after: 40 }),
    paragrafo(run('Reg. CE 852/2004 — D.Lgs 27/2021 — Reg. UE 2021/382', { size: 18, color: '888888' }), { after: 0 }),
    ...spacer(2),
    tabellaDati([
      ['Struttura',               nomestruttura],
      ['Ragione sociale OSA',     osa],
      ['P.IVA OSA',               pivaOsa],
      ['Modello ristorazione',    modello],
      ['Legale Rappresentante',   lr],
      ['Responsabile HACCP',      rHaccp],
      ...teamRighe,
      ['N° Revisione',            numRev],
      ['Data emissione',          dataRev],
      ['Prossima revisione',      (() => {
        try {
          const parts = dataRev.split('/');
          if (parts.length === 3) {
            return parts[0] + '/' + parts[1] + '/' + (parseInt(parts[2]) + 3);
          }
          const d = new Date(dataRev);
          d.setFullYear(d.getFullYear() + 3);
          return d.toLocaleDateString('it-IT');
        } catch { return '—'; }
      })()],
      ['Redatto da',              redattore],
    ]),
    ...spacer(1),
    paragrafo(run('I dati personali raccolti verranno trattati ai sensi del Reg. UE 679/2016 (GDPR).', { size: 16, italic: true, color: '999999' })),
    new Paragraph({ children: [new PageBreak()] }),

    // ── PAG 2: Registro revisioni ───────────────────────────────
    paragrafo(run('REGISTRO DELLE REVISIONI', { size: 24, bold: true, color: VERDE }), { borderBottom: true, borderSize: 6, after: 160 }),
    tabellaRevisioni(numRev, dataRev, redattore, noteRevisione, lr),
    new Paragraph({ children: [new PageBreak()] }),

    // ── PAG 3: Indice generale ──────────────────────────────────
    paragrafo(run('INDICE DEL MANUALE', { size: 28, bold: true, color: VERDE }), { borderBottom: true, borderSize: 8, after: 240 }),
    ...(() => {
      const voci = [];
      let numH1 = 0;
      let numH2 = 0;
      for (const line of testoManuale.split('\n')) {
        const t = line.trim();
        if (t.startsWith('### ')) {
          voci.push({ livello: 3, titolo: t.replace(/^###\s+/, '') });
        } else if (t.startsWith('## ')) {
          numH2++;
          voci.push({ livello: 2, titolo: t.replace(/^##\s+/, ''), sub: numH2 });
        } else if (t.startsWith('# ')) {
          numH1++;
          numH2 = 0;
          voci.push({ livello: 1, titolo: t.replace(/^#\s+/, ''), num: numH1 });
        }
      }
      // Aggiunge anche le sezioni fisse (5 e 6) all'indice
      const risultati = [];
      for (const v of voci) {
        if (v.livello === 1) {
          // Riga h1: numero verde bold grande + titolo + puntini + PAGE
          risultati.push(new Paragraph({
            spacing: { before: 200, after: 60, line: 280 },
            tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W }],
            children: [
              new TextRun({ text: String(v.num) + '.  ', font: 'Arial', size: 22, bold: true, color: VERDE }),
              new TextRun({ text: v.titolo.replace(/^\d+[.\s]+/, ''), font: 'Arial', size: 22, bold: true, color: NERO }),
              new TextRun({ text: '\t', font: 'Arial', size: 20 }),
            ],
          }));
        } else if (v.livello === 2) {
          risultati.push(new Paragraph({
            spacing: { before: 40, after: 30, line: 260 },
            indent: { left: 320 },
            tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W }],
            children: [
              new TextRun({ text: '— ', font: 'Arial', size: 19, color: VERDE }),
              new TextRun({ text: v.titolo.replace(/^\d+[.\s]+/, ''), font: 'Arial', size: 19, color: GRIGIO_TESTO }),
              new TextRun({ text: '\t', font: 'Arial', size: 18 }),
            ],
          }));
        } else if (v.livello === 3) {
          risultati.push(new Paragraph({
            spacing: { before: 20, after: 20, line: 240 },
            indent: { left: 600 },
            children: [
              new TextRun({ text: '· ', font: 'Arial', size: 17, color: '999999' }),
              new TextRun({ text: v.titolo.replace(/^\d+[.\s]+/, ''), font: 'Arial', size: 17, color: '999999' }),
            ],
          }));
        }
      }
      return risultati;
    })(),

    new Paragraph({ children: [new PageBreak()] }),
  ];

  // ── CORPO ───────────────────────────────────────────────────
  // Separa il testo manuale in sezioni per iniettare i diagrammi fissi
  // al posto del testo ASCII generato dall'AI per le sezioni 5 e 6
  const righe = testoManuale.split('\n');
  const blocchi = { pre5: [], sez6: [], post6: [] };
  let zona = 'pre5';
  let inSez6 = false;
  for (const riga of righe) {
    const t = riga.trim();
    if (t.match(/^#\s+.*[Ss][Ee][Zz][Ii][Oo][Nn][Ee]\s*5/) || t.match(/^#\s+5[.\s].*[Dd]iagramm/i)) {
      zona = 'sez5'; continue;
    }
    if (t.match(/^#\s+.*[Ss][Ee][Zz][Ii][Oo][Nn][Ee]\s*6/) || t.match(/^#\s+6[.\s].*[Pp]ericol/i)) {
      zona = 'sez6'; inSez6 = true; continue;
    }
    if (inSez6 && t.match(/^#\s+[^6\s]/) && !t.match(/^#\s+6/)) {
      zona = 'post6'; inSez6 = false;
    }
    if (zona === 'pre5')  blocchi.pre5.push(riga);
    if (zona === 'sez6')  blocchi.sez6.push(riga);
    if (zona === 'post6') blocchi.post6.push(riga);
  }

  const corpo = [
    // Testo prima della sezione 5
    ...parseMarkdown(blocchi.pre5.join('\n')),

    // ── SEZIONE 5: Diagrammi fissi ───────────────────────────
    new Paragraph({ children: [new PageBreak()] }),
    h1('SEZIONE 5: DIAGRAMMI DI FLUSSO', false),
    txt('I seguenti diagrammi illustrano i flussi operativi di competenza dell\'OSA per ciascuna tipologia di processo. I punti CCP sono evidenziati in colore.'),
    ...spacer(1),
    ...diagrammaFlussoGenerale(),
    new Paragraph({ children: [new PageBreak()] }),
    ...diagrammaCCP1(),
    new Paragraph({ children: [new PageBreak()] }),
    ...diagrammaCCP2(),
    new Paragraph({ children: [new PageBreak()] }),
    ...diagrammaColazioni(),
    new Paragraph({ children: [new PageBreak()] }),
    ...diagrammaCeliaci(),
    new Paragraph({ children: [new PageBreak()] }),
    ...diagrammaDisfagici(),
    new Paragraph({ children: [new PageBreak()] }),
    ...diagrammaIsolamento(),
    new Paragraph({ children: [new PageBreak()] }),
    ...diagrammaStoviglie(),
    new Paragraph({ children: [new PageBreak()] }),
    ...diagrammaSanificazione(),

    // ── SEZIONE 6: Tabella CCP + testo AI ───────────────────
    new Paragraph({ children: [new PageBreak()] }),
    h1('SEZIONE 6: ANALISI PERICOLI E PUNTI CRITICI DI CONTROLLO (CCP)', false),
    h2('6.1 Metodologia di Valutazione Pericoli'),
    txt('Per ciascuna fase identificata nel diagramma di flusso, è stata effettuata una valutazione qualitativa del rischio secondo la formula: Rischio = Probabilità × Severità. Probabilità: Alta (A), Media (M), Bassa (B). Severità: Critica (C), Alta (A), Media (M). CCP se Control Critical Point, PCC se misura preventiva senza limite critico formale.'),
    ...spacer(1),
    h2('6.2 Matrice di Analisi Pericoli per Fase di Competenza OSA'),
    ...spacer(1),
    tabellaCCP(),
    ...spacer(1),
    // Testo AI dalla sezione 6 (6.3 in poi)
    ...parseMarkdown(blocchi.sez6.join('\n')),

    // Testo sezioni 7, 8 e seguenti
    ...parseMarkdown(blocchi.post6.join('\n')),
  ];

  // ── DOCUMENTO ───────────────────────────────────────────────
  const doc = new Document({
    styles: { default: { document: { run: { font: 'Arial', size: 22, color: NERO } } } },
    sections: [
      {
        properties: { page: { size: { width: PAGE_W, height: PAGE_H }, margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } } },
        children: copertina,
      },
      {
        properties: { page: { size: { width: PAGE_W, height: PAGE_H }, margin: { top: 1000, right: MARGIN, bottom: 1000, left: MARGIN } } },
        headers: { default: header },
        footers: { default: footer },
        children: corpo,
      },
    ],
  });

  // Restituisce ArrayBuffer — compatibile con supabase.storage.upload nel browser
  const blob = await Packer.toBlob(doc);
  return await blob.arrayBuffer();
}


// ── Genera modulistica HACCP completa ────────────────────────
// Logica selezione schede per modello ristorazione:
// cucina_interna:        1,2A,2A-rep,2B,2C,2D,2E,2F,3A,3B,3C,3D*,4,5A*,5B*,7
// appalto_fresco_caldo:  1,2D,2E,4,5A*,5B*,7
// distribuzione_veicolata: 2D,2E,5A*,5B*,7
// (*) = solo se flag attivo nel profilo

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
