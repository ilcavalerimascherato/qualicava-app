// src/services/copertinaService.js
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, Header, Footer, PageNumber, AlignmentType, BorderStyle, WidthType,
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

function loadImageElement(bytes, mimeType) {
  return new Promise((resolve) => {
    try {
      const blob = new Blob([bytes], { type: mimeType === 'jpg' ? 'image/jpeg' : 'image/png' });
      const url  = URL.createObjectURL(blob);
      const img  = new Image();
      img.onload  = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    } catch {
      resolve(null);
    }
  });
}

// I file logo caricati dalle società spesso hanno margini trasparenti (PNG) o
// bianchi (JPG) di dimensione molto diversa da un file all'altro: senza
// ritagliarli, due loghi con lo stesso "contain" finiscono per apparire di
// dimensione molto diversa (quello con più padding sembra più piccolo).
// Scansiona i pixel e ritaglia al bounding box del contenuto non di sfondo.
function trimPadding(img, mimeType) {
  try {
    const canvas = document.createElement('canvas');
    canvas.width  = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const isJpeg = mimeType === 'jpg'; // niente alpha: sfondo tipicamente bianco
    let minX = canvas.width, minY = canvas.height, maxX = -1, maxY = -1;

    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const i = (y * canvas.width + x) * 4;
        const isBackground = isJpeg
          ? (data[i] > 250 && data[i + 1] > 250 && data[i + 2] > 250)
          : data[i + 3] < 10;
        if (!isBackground) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < minX || maxY < minY) return null; // immagine vuota

    const w = maxX - minX + 1;
    const h = maxY - minY + 1;
    if (w >= canvas.width * 0.98 && h >= canvas.height * 0.98) return null; // già senza padding

    const cropCanvas = document.createElement('canvas');
    cropCanvas.width  = w;
    cropCanvas.height = h;
    cropCanvas.getContext('2d').drawImage(canvas, minX, minY, w, h, 0, 0, w, h);
    const dataUrl = cropCanvas.toDataURL('image/png');
    const base64  = dataUrl.split(',')[1];
    const binary  = atob(base64);
    const bytes   = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return { bytes, width: w, height: h, type: 'png' };
  } catch {
    return null; // canvas "tainted" o altro errore imprevisto: si usa l'immagine originale
  }
}

// Scala l'immagine dentro un riquadro massimo mantenendo le proporzioni
// originali ("contain", come in CSS) invece di stirarla/schiacciarla per
// riempire esattamente width x height.
function fitTransformation(natural, maxWidth, maxHeight) {
  if (!natural?.width || !natural?.height) return { width: maxWidth, height: maxHeight };
  const scale = Math.min(maxWidth / natural.width, maxHeight / natural.height);
  return {
    width:  Math.round(natural.width  * scale),
    height: Math.round(natural.height * scale),
  };
}

// Ritaglia il padding (se presente) e calcola la trasformazione "contain" —
// unica funzione da chiamare per preparare un logo per l'ImageRun.
async function prepareLogo(bytes, mimeType, maxWidth, maxHeight) {
  const img = await loadImageElement(bytes, mimeType);
  if (!img) return { bytes, type: mimeType, transformation: { width: maxWidth, height: maxHeight } };

  const trimmed = trimPadding(img, mimeType);
  if (trimmed) {
    return {
      bytes: trimmed.bytes,
      type:  trimmed.type,
      transformation: fitTransformation(trimmed, maxWidth, maxHeight),
    };
  }
  return {
    bytes,
    type: mimeType,
    transformation: fitTransformation({ width: img.naturalWidth, height: img.naturalHeight }, maxWidth, maxHeight),
  };
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

  // Fetch logo società — ritaglio padding + dimensioni "contain" nel riquadro
  // 220x80, così loghi con margini/proporzioni diversi da una società
  // all'altra appaiono comunque di dimensione coerente.
  let logoImg = null;
  if (logoSocietaUrl) {
    try {
      const res    = await fetch(logoSocietaUrl);
      const buffer = await res.arrayBuffer();
      const bytes  = new Uint8Array(buffer);
      const type   = detectImgType(res.headers.get('content-type') || logoSocietaUrl);
      logoImg = await prepareLogo(bytes, type, 220, 80);
    } catch { logoImg = null; }
  }

  let logoOverImg = await fetchLogoOver();
  if (logoOverImg) {
    logoOverImg = await prepareLogo(logoOverImg.bytes, logoOverImg.type, 80, 80);
  }

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
    ? [new ImageRun({ data: logoImg.bytes, transformation: logoImg.transformation, type: logoImg.type })]
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
              ? new ImageRun({ data: logoOverImg.bytes, transformation: logoOverImg.transformation, type: logoOverImg.type })
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

  // Intestazione di pagina vera (si ripete su ogni pagina, non solo sulla
  // copertina) — così quando la copertina viene inserita in testa a un
  // documento di contenuto, la sua intestazione sostituisce quella (spesso
  // obsoleta) del documento originale su tutte le pagine.
  const header = new Header({ children: [headerTable, lineaVerde] });

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
  // "Pag. X di Y" con campi dinamici Word (non testo fisso): resta corretto
  // anche quando la copertina viene inserita in testa a un documento più
  // lungo, invece di restare "Pag. 1 di 1" su ogni pagina.
  const footerPrefix = `${codice} — Rev. ${revisione} — ${dataRevisione} — Pag. `;
  const footer = new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: footerPrefix, font: 'Arial', size: 16, color: VERDE }),
        new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 16, color: VERDE }),
        new TextRun({ text: ' di ', font: 'Arial', size: 16, color: VERDE }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], font: 'Arial', size: 16, color: VERDE }),
      ],
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
      headers: { default: header },
      footers: { default: footer },
      children: [
        tipologiaPar,
        titoloPar,
        emptyPar(80),
        metadataTable,
        applicabileLabel,
        applicabilitaTable,
        distribuzionePar,
        emptyPar(120),
        // Tag di sezione docxtemplater: alla distribuzione per struttura
        // (documentiService.js) il box validazione regionale viene incluso
        // solo se quella struttura ha il Direttore Sanitario compilato in
        // "Riferimenti struttura" (facilities.director_sanitario).
        new Paragraph({ children: [r('{{#direttoreSanitarioPresente}}', { size: 8, color: 'CCCCCC' })] }),
        valTable,
        new Paragraph({ children: [r('{{/direttoreSanitarioPresente}}', { size: 8, color: 'CCCCCC' })] }),
        emptyPar(120),
        storicoTable,
      ],
    }],
  });

  return Packer.toBlob(doc);
}
