// src/services/copertinaService.js
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, Footer, AlignmentType, BorderStyle, WidthType,
  ShadingType, VerticalAlign,
} from 'docx';

// ── Colori ────────────────────────────────────────────────────
const VERDE       = '1D6F42';
const VERDE_LIGHT = 'E8F5EE';
const VERDE_BRD   = 'C8E6D0';
const DARK        = '0f172a';
const BIANCO      = 'FFFFFF';

// ── Misure A4 (DXA) ───────────────────────────────────────────
const PAGE_W = 11906;
const PAGE_H = 16838;
const MARGIN = 1134;

// ── Bordi ─────────────────────────────────────────────────────
const NB        = { style: BorderStyle.NONE, size: 0, color: BIANCO };
const GB        = (c = VERDE_BRD) => ({ style: BorderStyle.SINGLE, size: 4, color: c });
const CELL_NONE = { top: NB, bottom: NB, left: NB, right: NB };
const TBL_NONE  = { top: NB, bottom: NB, left: NB, right: NB, insideH: NB, insideV: NB };

// ── Helpers ───────────────────────────────────────────────────

function detectImgType(hint = '') {
  if (hint.includes('jpeg') || hint.includes('jpg') || hint.endsWith('.jpg') || hint.endsWith('.jpeg')) return 'jpg';
  return 'png';
}

async function fetchImageData(url) {
  try {
    const res         = await fetch(url);
    const contentType = res.headers.get('content-type') || '';
    const buffer      = await res.arrayBuffer();
    const forcePng    = url.includes('signatures') || url.toLowerCase().endsWith('.png');
    return { bytes: new Uint8Array(buffer), type: forcePng ? 'png' : detectImgType(contentType) };
  } catch {
    return null;
  }
}

async function fetchLogoOver() {
  const paths = [
    '/Pittogramma Over_DEF.jpg',
    `${window.location.origin}/Pittogramma Over_DEF.jpg`,
  ];
  for (const p of paths) {
    const result = await fetchImageData(p);
    if (result) return result;
  }
  return null;
}

const r = (text, opts = {}) => new TextRun({
  text,
  font:   'Arial',
  size:   opts.size   ?? 22,
  bold:   opts.bold   ?? false,
  italic: opts.italic ?? false,
  color:  opts.color  ?? '000000',
});

const emptyPar = (after = 120) => new Paragraph({
  spacing: { before: 0, after },
  children: [new TextRun('')],
});

// ── Riga tabella metadati ─────────────────────────────────────

function metaRow(label, value, isImage = false) {
  const labelCell = new TableCell({
    width:         { size: 35, type: WidthType.PERCENTAGE },
    shading:       { type: ShadingType.CLEAR, fill: VERDE_LIGHT },
    borders:       { top: GB(), bottom: GB(), left: GB(), right: GB() },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      spacing: { before: 60, after: 60 },
      children: [r(label, { bold: true, color: VERDE, size: 20 })],
    })],
  });

  const valueCell = new TableCell({
    width:         { size: 65, type: WidthType.PERCENTAGE },
    borders:       { top: GB(), bottom: GB(), left: GB(), right: GB() },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      spacing: { before: 60, after: 60 },
      children: isImage ? [value] : [r(typeof value === 'string' ? value : '', { size: 20 })],
    })],
  });

  return new TableRow({ children: [labelCell, valueCell] });
}

// ═════════════════════════════════════════════════════════════
// EXPORT PRINCIPALE
// ═════════════════════════════════════════════════════════════

export async function generaCopertina(params) {
  const {
    codice             = '',
    titolo             = '',
    tipologia          = '',
    revisione          = 0,
    dataRevisione      = '',
    noteRevisione      = '',
    elaborataDa        = '',
    verificataDa       = '',
    approvataDa        = '',
    firmaBase64        = null,
    societaNome        = '',
    udoNome            = '',
    strutturaNome      = '',
    indirizzoStruttura = '',
    dataValidazione    = '',
    storico            = [],
    logoSocietaUrl     = null,
    firmaUrl           = null,
  } = params;

  // Placeholder per campi struttura — compilati alla distribuzione
  const _societaNome        = societaNome        || '{{ragione_sociale}}';
  const _udoNome            = udoNome            || '{{udo_tipo}}';
  const _strutturaNome      = strutturaNome      || '{{nome_struttura}}';
  const _indirizzoStruttura = indirizzoStruttura || '{{indirizzo}}';
  const _dataValidazione    = dataValidazione    || '{{data_approvazione}}';

  // Fetch logo società
  let logoImg = null;
  if (logoSocietaUrl) {
    try {
      const res    = await fetch(logoSocietaUrl);
      const buffer = await res.arrayBuffer();
      logoImg = {
        bytes: new Uint8Array(buffer),
        type:  detectImgType(res.headers.get('content-type') || logoSocietaUrl),
      };
    } catch { logoImg = null; }
  }

  let logoOverImg = await fetchLogoOver();

  let firmaImg = null;
  if (firmaUrl) {
    firmaImg = await fetchImageData(firmaUrl);
  }

  // Firma image run
  let firmaRun = null;
  if (firmaBase64) {
    try {
      const clean  = firmaBase64.includes(',') ? firmaBase64.split(',')[1] : firmaBase64;
      const binary = atob(clean);
      const bytes  = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      firmaRun = new ImageRun({
        data:           bytes,
        transformation: { width: 80, height: 40 },
        type:           detectImgType(firmaBase64),
      });
    } catch { /* usa testo fallback */ }
  }

  // ── 1. HEADER ──────────────────────────────────────────────
  // Cella sx: logo se disponibile, altrimenti ragione sociale come testo
  const logoSxChildren = logoImg
    ? [new ImageRun({ data: logoImg.bytes, transformation: { width: 220, height: 80 }, type: logoImg.type })]
    : [r(_societaNome, { bold: true, color: VERDE, size: 24 })];

  const headerTable = new Table({
    width:   { size: 100, type: WidthType.PERCENTAGE },
    borders: TBL_NONE,
    rows: [new TableRow({
      height: { value: 1000, rule: 'atLeast' },
      children: [
        new TableCell({
          width:         { size: 50, type: WidthType.PERCENTAGE },
          borders:       CELL_NONE,
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({
            spacing: { before: 60, after: 60 },
            children: logoSxChildren,
          })],
        }),
        new TableCell({
          width:         { size: 50, type: WidthType.PERCENTAGE },
          borders:       CELL_NONE,
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing:   { before: 60, after: 60 },
            children: [logoOverImg
              ? new ImageRun({ data: logoOverImg.bytes, transformation: { width: 80, height: 80 }, type: logoOverImg.type })
              : r('GRUPPO OVER', { bold: true, color: VERDE, size: 24 })
            ],
          })],
        }),
      ],
    })],
  });

  const lineaVerde = new Paragraph({
    spacing: { before: 80, after: 80 },
    border:  { bottom: { style: BorderStyle.SINGLE, size: 24, color: VERDE, space: 4 } },
    children: [],
  });

  // ── 2. TIPOLOGIA ───────────────────────────────────────────
  const tipologiaPar = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing:   { before: 200, after: 100 },
    children:  [r(tipologia.toUpperCase(), { size: 18, color: VERDE })],
  });

  // ── 3. TITOLO ──────────────────────────────────────────────
  const titoloPar = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing:   { before: 160, after: 200 },
    border:    { left: { style: BorderStyle.SINGLE, size: 18, color: VERDE, space: 10 } },
    children:  [r(titolo.toUpperCase(), { bold: true, size: 26, color: DARK })],
  });

  // ── 4. TABELLA METADATI ────────────────────────────────────
  const metadataTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      metaRow('Codice documento', (codice || '—').toUpperCase()),
      metaRow('Revisione',        `Rev. ${revisione}`),
      metaRow('Data revisione',   dataRevisione),
      metaRow('Note revisione',   noteRevisione),
      metaRow('Elaborata da',     elaborataDa.toUpperCase()),
      metaRow('Verificata da',    verificataDa.toUpperCase()),
      firmaImg
        ? metaRow('Approvata da', new ImageRun({
            data:           firmaImg.bytes,
            transformation: { width: 180, height: 90 },
            type:           'png',
          }), true)
        : firmaBase64 && firmaRun
          ? metaRow('Approvata da', firmaRun, true)
          : metaRow('Approvata da', approvataDa.toUpperCase()),
    ],
  });

  // ── 5. LABEL APPLICABILE A ─────────────────────────────────
  const applicabileLabel = new Paragraph({
    spacing: { before: 240, after: 100 },
    children: [r('APPLICABILE A', { bold: true, color: VERDE, size: 22 })],
  });

  // ── 6. TABELLA APPLICABILITÀ ───────────────────────────────
  const applicabilitaTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      metaRow('Società',                    _societaNome),
      metaRow('UDO — Struttura',            `${_udoNome} — ${_strutturaNome}`),
      metaRow('Indirizzo',                  _indirizzoStruttura),
      metaRow('Data validazione struttura', _dataValidazione),
    ],
  });

  // ── 7. TESTO DISTRIBUZIONE ─────────────────────────────────
  const distribuzionePar = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing:   { before: 200, after: 200 },
    shading:   { type: ShadingType.CLEAR, fill: 'f8fafc' },
    border: {
      top:    { style: BorderStyle.SINGLE, size: 4, color: 'e2e8f0', space: 4 },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: 'e2e8f0', space: 4 },
      left:   { style: BorderStyle.SINGLE, size: 4, color: 'e2e8f0', space: 8 },
      right:  { style: BorderStyle.SINGLE, size: 4, color: 'e2e8f0', space: 8 },
    },
    children: [r(
      'Da distribuire, a cura della Struttura, a tutto il personale operante nella struttura e coinvolto nel processo.',
      { italic: true, size: 18 }
    )],
  });

  // ── 8. BOX VALIDAZIONE — sempre presente ───────────────────
  const valTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [new TableCell({
          shading: { type: ShadingType.CLEAR, fill: VERDE },
          borders: { top: GB(VERDE), bottom: GB(VERDE), left: GB(VERDE), right: GB(VERDE) },
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing:   { before: 80, after: 80 },
            children:  [r('VALIDAZIONE REGIONALE', { bold: true, color: BIANCO, size: 20 })],
          })],
        })],
      }),
      new TableRow({
        height: { value: 1700, rule: 'atLeast' },
        children: [new TableCell({
          borders: { top: GB(VERDE), bottom: GB(VERDE), left: GB(VERDE), right: GB(VERDE) },
          children: [
            new Paragraph({
              spacing: { before: 160, after: 80 },
              children: [r('Compilare se richiesto dalla normativa regionale', { color: VERDE, size: 20, italic: true })],
            }),
            new Paragraph({
              spacing: { before: 0, after: 400 },
              children: [r('Direttore / Responsabile Sanitario', { bold: true, color: VERDE, size: 20 })],
            }),
            new Table({
              width:   { size: 100, type: WidthType.PERCENTAGE },
              borders: TBL_NONE,
              rows: [new TableRow({
                children: [
                  new TableCell({
                    width:   { size: 60, type: WidthType.PERCENTAGE },
                    borders: CELL_NONE,
                    children: [new Paragraph({ children: [] })],
                  }),
                  new TableCell({
                    width:   { size: 40, type: WidthType.PERCENTAGE },
                    borders: { top: NB, bottom: GB(VERDE), left: GB(VERDE), right: GB(VERDE) },
                    children: [new Paragraph({
                      alignment: AlignmentType.CENTER,
                      spacing:   { before: 60, after: 60 },
                      children:  [r('Timbro e firma', { color: VERDE, size: 18 })],
                    })],
                  }),
                ],
              })],
            }),
          ],
        })],
      }),
    ],
  });

  // ── 9. STORICO REVISIONI ───────────────────────────────────
  const hdrCell = (text) => new TableCell({
    shading: { type: ShadingType.CLEAR, fill: VERDE },
    borders: { top: GB(), bottom: GB(), left: GB(), right: GB() },
    children: [new Paragraph({
      spacing: { before: 60, after: 60 },
      children: [r(text, { bold: true, color: BIANCO, size: 18 })],
    })],
  });

  const dataCell = (val, bg) => new TableCell({
    shading: { type: ShadingType.CLEAR, fill: bg },
    borders: { top: GB(), bottom: GB(), left: GB(), right: GB() },
    children: [new Paragraph({
      spacing: { before: 40, after: 40 },
      children: [r(val || '', { size: 18 })],
    })],
  });

  const storicoTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: [hdrCell('Revisione'), hdrCell('Data'), hdrCell('Note modifiche')] }),
      ...[0, 1, 2].map(i => {
        const e  = storico[i] ?? {};
        const bg = i % 2 === 0 ? VERDE_LIGHT : BIANCO;
        return new TableRow({ children: [dataCell(e.rev, bg), dataCell(e.data, bg), dataCell(e.note, bg)] });
      }),
    ],
  });

  // ── 10. PIÈ DI PAGINA ──────────────────────────────────────
  const footerTxt = `${codice} — Rev. ${revisione} — ${dataRevisione} — Pag. 1 di 1`;
  const footer = new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children:  [r(footerTxt, { size: 16, color: VERDE })],
    })],
  });

  // ── DOCUMENT ───────────────────────────────────────────────
  const doc = new Document({
    styles: { default: { document: { run: { font: 'Arial', size: 22 } } } },
    sections: [{
      properties: {
        page: {
          size:   { width: PAGE_W, height: PAGE_H },
          margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
        },
      },
      footers: { default: footer },
      children: [
        headerTable,
        lineaVerde,
        tipologiaPar,
        titoloPar,
        emptyPar(80),
        metadataTable,
        applicabileLabel,
        applicabilitaTable,
        distribuzionePar,
        emptyPar(120),
        valTable,
        emptyPar(120),
        storicoTable,
      ],
    }],
  });

  return Packer.toBlob(doc);
}
