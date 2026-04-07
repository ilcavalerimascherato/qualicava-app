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

// ── Diagramma di flusso — box con frecce ─────────────────────
function parseDiagramma(testo) {
  // Riconosce righe tipo: "RICEZIONE MERCI → VERIFICA TEMPERATURA → STOCCAGGIO"
  // o step separati da →, ↓, su righe consecutive
  const steps = testo
    .split(/→|↓|\n/)
    .map(s => s.trim())
    .filter(Boolean);

  if (steps.length === 0) return null;

  const W   = CONTENT_W;
  const bW  = Math.min(Math.floor(W * 0.7), 5500);  // larghezza box
  const pad = Math.floor((W - bW) / 2);              // margine sx per centrare

  const elements = [];
  steps.forEach((step, idx) => {
    // Box step
    elements.push(new Table({
      width: { size: W, type: WidthType.DXA },
      columnWidths: [pad, bW, W - pad - bW],
      rows: [new TableRow({
        children: [
          new TableCell({ width:{size:pad,type:WidthType.DXA}, borders:{top:{style:BorderStyle.NONE,size:0,color:'FFFFFF'},bottom:{style:BorderStyle.NONE,size:0,color:'FFFFFF'},left:{style:BorderStyle.NONE,size:0,color:'FFFFFF'},right:{style:BorderStyle.NONE,size:0,color:'FFFFFF'}}, children:[new Paragraph({children:[]})] }),
          new TableCell({
            width: { size:bW, type:WidthType.DXA },
            borders: { top:B(VERDE), bottom:B(VERDE), left:B(VERDE), right:B(VERDE) },
            shading: { fill: step.includes('CCP') ? 'FFF3CD' : VERDE_LIGHT, type: ShadingType.CLEAR },
            margins: { top:100, bottom:100, left:200, right:200 },
            children: [new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: step, font:'Arial', size:20, bold:true, color: step.includes('CCP') ? '856404' : VERDE })],
            })],
          }),
          new TableCell({ width:{size:W-pad-bW,type:WidthType.DXA}, borders:{top:{style:BorderStyle.NONE,size:0,color:'FFFFFF'},bottom:{style:BorderStyle.NONE,size:0,color:'FFFFFF'},left:{style:BorderStyle.NONE,size:0,color:'FFFFFF'},right:{style:BorderStyle.NONE,size:0,color:'FFFFFF'}}, children:[new Paragraph({children:[]})] }),
        ],
      })],
    }));
    // Freccia tra step (non dopo l'ultimo)
    if (idx < steps.length - 1) {
      elements.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before:40, after:40 },
        children: [new TextRun({ text: '▼', font:'Arial', size:24, color:VERDE, bold:true })],
      }));
    }
  });
  return elements;
}

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

    // Diagramma di flusso — riga con → e step in MAIUSCOLO
    const hasFreccia = t.includes('→') || t.includes('↓');
    const isMaiuscolo = t.replace(/[→↓\s\-–—().,]/g, '').length > 3;
    const isFlowLine = t.match(/^[A-ZÀÈÌÒÙ\s]+→/) !== null;
    if ((hasFreccia && isMaiuscolo) || isFlowLine) {
      const diag = parseDiagramma(t);
      if (diag) { result.push(...spacer(1)); result.push(...diag); result.push(...spacer(1)); i++; continue; }
    }

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
    modello        = 'Cucina interna',
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
      ['Redatto da',              redattore],
    ]),
    ...spacer(1),
    paragrafo(run('I dati personali raccolti verranno trattati ai sensi del Reg. UE 679/2016 (GDPR).', { size: 16, italic: true, color: '999999' })),
    new Paragraph({ children: [new PageBreak()] }),

    // ── PAG 2: Indice generale ──────────────────────────────────
    paragrafo(run('INDICE DEL MANUALE', { size: 28, bold: true, color: VERDE }), { borderBottom: true, borderSize: 8, after: 200 }),
    ...(() => {
      // Estrae h1 e h2 dal testo per costruire indice
      const voci = [];
      let numSez = 0;
      for (const line of testoManuale.split('\n')) {
        const t = line.trim();
        if (t.startsWith('# ')) {
          numSez++;
          voci.push({ livello: 1, titolo: t.replace(/^#\s+/, ''), num: String(numSez) });
        } else if (t.startsWith('## ')) {
          voci.push({ livello: 2, titolo: t.replace(/^##\s+/, ''), num: '' });
        }
      }
      return voci.map(v => new Paragraph({
        spacing: { before: v.livello === 1 ? 140 : 60, after: v.livello === 1 ? 60 : 40 },
        indent: v.livello === 2 ? { left: 360 } : undefined,
        tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W }],
        children: [
          new TextRun({ text: v.num ? v.num + '.  ' : '      ', font: 'Arial', size: v.livello === 1 ? 22 : 20, bold: v.livello === 1, color: v.livello === 1 ? VERDE : GRIGIO_TESTO }),
          new TextRun({ text: v.titolo, font: 'Arial', size: v.livello === 1 ? 22 : 20, bold: v.livello === 1, color: v.livello === 1 ? NERO : GRIGIO_TESTO }),
        ],
      }));
    })(),

    new Paragraph({ children: [new PageBreak()] }),
  ];

  // ── CORPO ───────────────────────────────────────────────────
  const corpo = [
    ...parseMarkdown(testoManuale),
    // Registro revisioni in fondo al corpo
    new Paragraph({ children: [new PageBreak()] }),
    paragrafo(run('REGISTRO DELLE REVISIONI', { size: 24, bold: true, color: VERDE }), { borderBottom: true, borderSize: 6, after: 160 }),
    tabellaRevisioni(numRev, dataRev, redattore, noteRevisione, lr),
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
      ? 'Colonne: ' + frigoCucina.map((r,i)=>`${i+1} = ${r}`).join(' | ')
      : 'Colonna 1 = Frigorifero cucina';
    return {
      properties: { page: pLand },
      children: [
        intestazione('Autoc 2A','TEMPERATURE FRIGORIFERI CUCINA', W, true),
        sp(),
        new Paragraph({children:[new TextRun({text:`LOCALE: Cucina — ${nF} frigorifero${nF>1?'i':''}`, bold:true, size:20, color:VERDE, font:'Arial'})]}),
        new Paragraph({children:[new TextRun({text:noteApp, size:15, italic:true, color:'555555', font:'Arial'})]}),
        sp(),
        new Table({
          width:{size:W,type:WidthType.DXA}, columnWidths:colWidths,
          rows:[
            new TableRow({children:[hC('Data',700),hC('Ore',700),hC(`Temperature rilevate (°C)`,tW*nF,nF),hC('Guasto/Disattivato',1400),hC('Firma',1600)]}),
            new TableRow({children:[sC('',700),sC('',700),...tCols.map((w,i)=>sC(String(i+1),w)),sC('',1400),sC('',1600)]}),
            ...tabella31(colWidths, W, true).rows,
          ],
        }),
        sp(),
        legenda(W),
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
              new TableRow({children:[hC('Data',700),hC('Ore',700),hC('Temperatura rilevata (°C)',colWidths[2]),hC('Guasto/Disattivato',1400),hC('Firma',1700)]}),
              ...tabella31(colWidths, W, false).rows,
            ],
          }),
          sp(),
          legenda(W),
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
      ? 'Colonne: ' + congelatori.map((r,i)=>`${i+1} = ${r}`).join(' | ')
      : 'Colonna 1 = Congelatore cucina';
    return {
      properties: { page: pLand },
      children: [
        intestazione('Autoc 2B','TEMPERATURE CONGELATORI CUCINA', W, true),
        sp(),
        new Paragraph({children:[new TextRun({text:`LOCALE: Cucina — ${nC} congelatore${nC>1?'i':''}`, bold:true, size:20, color:VERDE, font:'Arial'})]}),
        new Paragraph({children:[new TextRun({text:noteApp, size:15, italic:true, color:'555555', font:'Arial'})]}),
        sp(),
        new Table({
          width:{size:W,type:WidthType.DXA}, columnWidths:colWidths,
          rows:[
            new TableRow({children:[hC('Data',700),hC('Ore',700),hC('Temperature rilevate (°C)',tW*nC,nC),hC('Guasto/Disattivato',1400),hC('Firma',1600)]}),
            new TableRow({children:[sC('',700),sC('',700),...tCols.map((w,i)=>sC(String(i+1),w)),sC('',1400),sC('',1600)]}),
            ...tabella31(colWidths, W, true).rows,
          ],
        }),
        sp(),
        legenda(W, true),
      ],
    };
  }

  // ── Autoc 2C — Monitoraggio igiene cucina/lavaggio (Portrait)
  function scheda2C() {
    const W = W_P;
    const VOCI = [
      'Piano di lavoro cucina — superfici','Taglieri','Coltelli e utensili','Abbattitore / forno / attrezzature grandi',
      'Pavimento cucina','Lavello / vasche','Frigoriferi (interno/guarnizioni)','Area lavaggio stoviglie',
      'Cappe e filtri','Carrelli distribuzione',
    ];
    const cW = [Math.floor(W*0.38), Math.floor(W*0.12), Math.floor(W*0.12), Math.floor(W*0.12), W-Math.floor(W*0.38)-Math.floor(W*0.12)*3];
    return {
      properties: { page: pPort },
      children: [
        intestazione('Autoc 2C','MONITORAGGIO IGIENE — CUCINA E LAVAGGIO', W),
        sp(),
        new Table({
          width:{size:W,type:WidthType.DXA}, columnWidths:cW,
          rows:[
            new TableRow({children:[hC('Area / Attrezzatura',cW[0]),hC('Pulizia OK ☐',cW[1]),hC('Igiene OK ☐',cW[2]),hC('Azione correttiva',cW[3]),hC('Firma',cW[4])]}),
            ...VOCI.map(v=>new TableRow({height:{value:500,rule:'exact'},children:[cell(v,cW[0],{size:16}),eC(cW[1]),eC(cW[2]),eC(cW[3]),eC(cW[4])]})),
          ],
        }),
        sp(),
        new Paragraph({children:[new TextRun({text:'DATA: ___________________   RESPONSABILE: ___________________', bold:true, size:18, font:'Arial'})]}),
        sp(),
        new Paragraph({children:[new TextRun({text:'Compilare giornalmente (pre-operativo). Riportare NC nel Registro Generale (Autoc 6).', size:15, italic:true, color:'555555', font:'Arial'})]}),
      ],
    };
  }

  // ── Autoc 2D — Monitoraggio sala da pranzo (Portrait) ─────
  function scheda2D() {
    const W = W_P;
    const VOCI = [
      'Tavoli — superficie','Sedie / carrozzine','Tovaglie / tovagliette monouso','Posateria e bicchieri',
      'Carrelli distribuzione in sala','Pavimento sala','Aria / ventilazione','Illuminazione adeguata',
    ];
    const cW = [Math.floor(W*0.38), Math.floor(W*0.12), Math.floor(W*0.12), Math.floor(W*0.12), W-Math.floor(W*0.38)-Math.floor(W*0.12)*3];
    return {
      properties: { page: pPort },
      children: [
        intestazione('Autoc 2D','MONITORAGGIO IGIENE — SALA DA PRANZO', W),
        sp(),
        new Table({
          width:{size:W,type:WidthType.DXA}, columnWidths:cW,
          rows:[
            new TableRow({children:[hC('Area / Elemento',cW[0]),hC('Pulizia OK ☐',cW[1]),hC('Ordine OK ☐',cW[2]),hC('Azione correttiva',cW[3]),hC('Firma',cW[4])]}),
            ...VOCI.map(v=>new TableRow({height:{value:500,rule:'exact'},children:[cell(v,cW[0],{size:16}),eC(cW[1]),eC(cW[2]),eC(cW[3]),eC(cW[4])]})),
          ],
        }),
        sp(),
        new Paragraph({children:[new TextRun({text:'DATA: ___________________   RESPONSABILE: ___________________', bold:true, size:18, font:'Arial'})]}),
      ],
    };
  }

  // ── Autoc 2E — Servizi igienici / spogliatoio (Portrait) ──
  function scheda2E() {
    const W = W_P;
    const VOCI = [
      'WC personale — tazze e sanitari','Lavandini e rubinetteria','Pavimento bagno','Specchi / suppellettili',
      'Spogliatoio — armadietti','Pavimento spogliatoio','Docce (se presenti)','Distributori sapone/carta',
    ];
    const cW = [Math.floor(W*0.38), Math.floor(W*0.12), Math.floor(W*0.12), Math.floor(W*0.12), W-Math.floor(W*0.38)-Math.floor(W*0.12)*3];
    return {
      properties: { page: pPort },
      children: [
        intestazione('Autoc 2E','MONITORAGGIO SERVIZI IGIENICI / SPOGLIATOIO', W),
        sp(),
        new Table({
          width:{size:W,type:WidthType.DXA}, columnWidths:cW,
          rows:[
            new TableRow({children:[hC('Area',cW[0]),hC('Pulizia OK ☐',cW[1]),hC('Igiene OK ☐',cW[2]),hC('Azione correttiva',cW[3]),hC('Firma',cW[4])]}),
            ...VOCI.map(v=>new TableRow({height:{value:500,rule:'exact'},children:[cell(v,cW[0],{size:16}),eC(cW[1]),eC(cW[2]),eC(cW[3]),eC(cW[4])]})),
          ],
        }),
        sp(),
        new Paragraph({children:[new TextRun({text:'DATA: ___________________   RESPONSABILE: ___________________', bold:true, size:18, font:'Arial'})]}),
      ],
    };
  }

  // ── Autoc 2F — Igiene personale cucina (Portrait) ─────────
  function scheda2F() {
    const W = W_P;
    const cW = [Math.floor(W*0.2), Math.floor(W*0.08), Math.floor(W*0.08), Math.floor(W*0.08), Math.floor(W*0.08), Math.floor(W*0.08), W-Math.floor(W*0.2)-Math.floor(W*0.08)*5];
    return {
      properties: { page: pPort },
      children: [
        intestazione('Autoc 2F','MONITORAGGIO IGIENE PERSONALE DI CUCINA', W),
        sp(),
        new Table({
          width:{size:W,type:WidthType.DXA}, columnWidths:cW,
          rows:[
            new TableRow({children:[hC('Operatore',cW[0]),hC('Mani pulite',cW[1]),hC('Divisa OK',cW[2]),hC('Capigliatura coperta',cW[3]),hC('Guanti',cW[4]),hC('Assenza sintomi',cW[5]),hC('Firma',cW[6])]}),
            ...Array.from({length:15},()=>new TableRow({height:{value:440,rule:'exact'},children:cW.map(w=>eC(w))})),
          ],
        }),
        sp(),
        new Paragraph({children:[new TextRun({text:'DATA: ___________________   RESPONSABILE: ___________________', bold:true, size:18, font:'Arial'})]}),
        sp(),
        new Paragraph({children:[new TextRun({text:'In caso di sintomi influenzali/gastrointestinali comunicare al Responsabile HACCP.', size:15, italic:true, color:'555555', font:'Arial'})]}),
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

  // ── Autoc 3D — Riattivazione teglie abbattute (Portrait) ──
  function scheda3D() {
    const W = W_P;
    const cW = [700, 2200, 1400, 1400, 1400, W-700-2200-1400*3];
    return {
      properties: { page: pPort },
      children: [
        intestazione('Autoc 3D','MONITORAGGIO TEMPERATURE — RIATTIVAZIONE', W),
        sp(),
        new Paragraph({children:[new TextRun({text:'RIATTIVAZIONE — Ad ogni riscaldamento di alimenti precedentemente abbattuti', bold:true, size:18, color:VERDE, font:'Arial'})]}),
        sp(),
        new Table({
          width:{size:W,type:WidthType.DXA}, columnWidths:cW,
          rows:[
            new TableRow({children:[hC('Data',700),hC('Tipo prodotto',2200),hC('T° ricezione (max 4°C)',1400),hC('T° al cuore raggiunta (min 75°C)',1400),hC('Ora fine riattivazione',1400),hC('Firma',cW[5])]}),
            ...Array.from({length:20},()=>new TableRow({height:{value:440,rule:'exact'},children:cW.map(w=>eC(w))})),
          ],
        }),
        sp(),
        new Paragraph({children:[new TextRun({text:'Temperatura minima al cuore: ≥ 75°C. Temperatura ricezione teglie: ≤ 4°C. Non riattivare due volte.', size:15, italic:true, color:'555555', font:'Arial'})]}),
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

  // ── Autoc 5A — Macchinetta acqua (Portrait) ───────────────
  function scheda5A(nota = '') {
    const W = W_P;
    const cW = [700, 1800, 1400, 1400, 1600, W-700-1800-1400*2-1600];
    return {
      properties: { page: pPort },
      children: [
        intestazione('Autoc 5A',`CONTROLLO DISTRIBUTORE ACQUA${nota ? ' — ' + nota : ''}`, W),
        sp(),
        new Table({
          width:{size:W,type:WidthType.DXA}, columnWidths:cW,
          rows:[
            new TableRow({children:[hC('Data',700),hC('Pulizia erogatore OK',1800),hC('Filtro verificato',1400),hC('Scadenza filtro',1400),hC('Qualità acqua OK',1600),hC('Firma',cW[5])]}),
            ...Array.from({length:25},()=>new TableRow({height:{value:430,rule:'exact'},children:cW.map(w=>eC(w))})),
          ],
        }),
        sp(),
        new Paragraph({children:[new TextRun({text:'Ubicazione: ' + (nota || '___________________'), size:16, bold:true, font:'Arial'})]}),
        new Paragraph({children:[new TextRun({text:'Sostituire filtro secondo indicazioni del fabbricante. Registrare manutenzioni straordinarie nel Registro NC.', size:15, italic:true, color:'555555', font:'Arial'})]}),
      ],
    };
  }

  // ── Autoc 5B — Macchinetta caffè/colazioni (Portrait) ─────
  function scheda5B(nota = '') {
    const W = W_P;
    const cW = [700, 1600, 1600, 1600, 1600, W-700-1600*4];
    return {
      properties: { page: pPort },
      children: [
        intestazione('Autoc 5B',`CONTROLLO MACCHINETTA CAFFÈ${nota ? ' — ' + nota : ''}`, W),
        sp(),
        new Table({
          width:{size:W,type:WidthType.DXA}, columnWidths:cW,
          rows:[
            new TableRow({children:[hC('Data',700),hC('Pulizia esterna OK',1600),hC('Vaschetta scarico svuotata',1600),hC('Rifornimento prodotti OK',1600),hC('Temperatura erogazione OK',1600),hC('Firma',cW[5])]}),
            ...Array.from({length:25},()=>new TableRow({height:{value:430,rule:'exact'},children:cW.map(w=>eC(w))})),
          ],
        }),
        sp(),
        new Paragraph({children:[new TextRun({text:'Ubicazione: ' + (nota || '___________________'), size:16, bold:true, font:'Arial'})]}),
        new Paragraph({children:[new TextRun({text:'Pulizia giornaliera obbligatoria. Manutenzione periodica secondo contratto con fornitore.', size:15, italic:true, color:'555555', font:'Arial'})]}),
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

  // 1 — Ricevimento merci: cucina interna + appalto
  if (isCucinaInterna || isAppalto) sections.push(scheda1());

  // 2A cucina — solo cucina interna
  if (isCucinaInterna) sections.push(scheda2ACucina());

  // 2A reparti — solo cucina interna (una per FR/FD)
  if (isCucinaInterna) sections.push(...schede2AReparto());

  // 2B congelatori — solo cucina interna
  if (isCucinaInterna) sections.push(scheda2B());

  // 2C igiene cucina/lavaggio — solo cucina interna
  if (isCucinaInterna) sections.push(scheda2C());

  // 2D sala da pranzo — cucina interna + appalto + distribuzione
  sections.push(scheda2D());

  // 2E servizi igienici/spogliatoio — cucina interna + appalto + distribuzione
  sections.push(scheda2E());

  // 2F igiene personale — solo cucina interna
  if (isCucinaInterna) sections.push(scheda2F());

  // 3A/B/C — solo cucina interna
  if (isCucinaInterna) {
    sections.push(scheda3A());
    sections.push(scheda3B());
    sections.push(scheda3C());
  }

  // 3D riattivazione — solo se cena abbattuta
  if (isCucinaInterna && op_cena_abbattuta) sections.push(scheda3D());

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

  // 7 fornitori — sempre
  sections.push(scheda7());

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Arial', size: 18 } } } },
    sections,
  });

  const blob = await Packer.toBlob(doc);
  return await blob.arrayBuffer();
}
