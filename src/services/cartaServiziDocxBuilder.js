/**
 * src/services/cartaServiziDocxBuilder.js
 * ─────────────────────────────────────────────────────────────
 * Assembla la Carta dei Servizi come documento Word nativo (.docx),
 * sullo stesso schema di haccpManualeService.js: nessuna chiamata AI,
 * tutto il contenuto arriva da:
 *  - facility/company (anagrafica già presente in QualiCAVA)
 *  - carta_servizi_gestore (contenuti condivisi di gestore)
 *  - carta_servizi_profili.sezioni (box testuali specifici di struttura,
 *    ordinati secondo src/config/cartaServiziSezioni.js — che copre i
 *    contenuti minimi obbligatori della D.G.R. Lombardia X/2569/2014)
 *
 * Le primitive (r/p/h1/h2/h3/spacer/bullet) sono duplicate rispetto a
 * haccpManualeService.js invece di essere estratte in un modulo comune:
 * scelta deliberata per non toccare un file HACCP funzionante e
 * complesso — lo stesso file HACCP duplica già la propria struttura
 * in due generatori interni.
 * ─────────────────────────────────────────────────────────────
 */
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, Header, Footer, PageNumber, AlignmentType, BorderStyle,
  WidthType, ShadingType, PageBreak, TabStopType, VerticalAlign,
} from 'docx';
import { CARTA_SERVIZI_SEZIONI_STRUTTURA } from '../config/cartaServiziSezioni';

// ── Colori (stessa famiglia "verde istituzionale" degli altri documenti) ──
const VERDE        = '1D6F42';
const VERDE_DARK    = '14512F';
const VERDE_LIGHT   = 'E8F5EE';
const GRIGIO_TESTO  = '4A4A4A';
const GRIGIO_CHIARO = '9CA3AF';
const NERO          = '1A1A1A';
const BIANCO        = 'FFFFFF';

// ── Misure A4 (DXA) ───────────────────────────────────────────
const PAGE_W    = 11906;
const PAGE_H    = 16838;
const MARGIN    = 1134;
const CONTENT_W = PAGE_W - MARGIN * 2;

// ── Primitivi ─────────────────────────────────────────────────
const B  = (color = 'DDE8E1') => ({ style: BorderStyle.SINGLE, size: 1, color });

const spacer = (n = 1) => Array.from({ length: n }, () =>
  new Paragraph({ spacing: { after: 60 }, children: [new TextRun('')] })
);

const r = (text, opts = {}) => new TextRun({
  text, font: 'Arial',
  size:   opts.size   || 22,
  bold:   opts.bold   || false,
  italic: opts.italic || false,
  color:  opts.color  || NERO,
});

const p = (children, opts = {}) => new Paragraph({
  alignment: opts.align || AlignmentType.LEFT,
  spacing:   { before: opts.before || 0, after: opts.after || 120, line: opts.line || 276 },
  shading:   opts.fill ? { type: ShadingType.CLEAR, fill: opts.fill } : undefined,
  border:    opts.borderLeft
    ? { left: { style: BorderStyle.SINGLE, size: 24, color: VERDE, space: 8 } }
    : undefined,
  indent:    opts.borderLeft ? { left: 40 } : undefined,
  children:  Array.isArray(children) ? children : [children],
});

// Titolo di capitolo: banner pieno verde, testo bianco — leggibile e "istituzionale"
const h1 = (text) => new Paragraph({
  shading:  { type: ShadingType.CLEAR, fill: VERDE },
  spacing:  { before: 320, after: 220, line: 300 },
  indent:   { left: 140, right: 140 },
  children: [r(text, { size: 26, bold: true, color: BIANCO })],
});

// Sottotitolo: barra verticale verde a sinistra
const h2 = (text) => p([r(text, { size: 21, bold: true, color: VERDE_DARK })], { before: 220, after: 100, borderLeft: true });

// Paragrafo testo corpo: ogni riga (separata da \n) diventa un nuovo paragrafo
function corpo(testo = '') {
  const righe = String(testo).split(/\n+/).map(t => t.trim()).filter(Boolean);
  if (righe.length === 0) return [p([r('— da completare —', { italic: true, color: GRIGIO_CHIARO })])];
  return righe.map(riga => p([r(riga)], { after: 140, line: 300 }));
}

// ── Logo ──────────────────────────────────────────────────────
function detectImgType(hint = '') {
  const h = hint.toLowerCase();
  if (h.includes('png')) return 'png';
  if (h.includes('svg')) return 'png'; // docx non supporta svg: fallback
  return 'jpg';
}

async function fetchLogo(url) {
  if (!url) return null;
  try {
    const res  = await fetch(url);
    if (!res.ok) return null;
    const type = detectImgType(res.headers.get('content-type') || url);
    const buf  = await res.arrayBuffer();
    return { bytes: new Uint8Array(buf), type };
  } catch {
    return null;
  }
}

// ── Header / Footer (pagine 2+, non sulla copertina) ─────────────
function paginaHeader(facility) {
  return new Header({
    children: [
      new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: VERDE, space: 6 } },
        tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W }],
        children: [
          r('CARTA DEI SERVIZI', { size: 16, bold: true, color: VERDE }),
          new TextRun({ text: '\t' }),
          r(facility?.name || '', { size: 16, color: GRIGIO_TESTO }),
        ],
      }),
    ],
  });
}

function paginaFooter(company) {
  return new Footer({
    children: [
      new Paragraph({
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'DDE8E1', space: 6 } },
        tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W }],
        children: [
          r(company?.name || '', { size: 15, color: GRIGIO_CHIARO }),
          new TextRun({ text: '\t' }),
          new TextRun({ children: ['Pag. ', PageNumber.CURRENT, ' di ', PageNumber.TOTAL_PAGES], font: 'Arial', size: 15, color: GRIGIO_CHIARO }),
        ],
      }),
    ],
  });
}

// ── Copertina ─────────────────────────────────────────────────
function copertina({ facility, company, numeroRevisione, dataEmissione, logo }) {
  const children = [];

  if (logo) {
    children.push(p([
      new ImageRun({ data: logo.bytes, transformation: { width: 170, height: 85 }, type: logo.type }),
    ], { align: AlignmentType.CENTER, before: 500, after: 320 }));
  } else {
    children.push(...spacer(3));
  }

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      shading: { type: ShadingType.CLEAR, fill: VERDE },
      spacing: { before: 200, after: 0, line: 360 },
      children: [r('CARTA DEI SERVIZI', { size: 48, bold: true, color: BIANCO })],
    }),
    p([r(facility?.name || '[STRUTTURA]', { size: 30, bold: true, color: VERDE_DARK })], { align: AlignmentType.CENTER, before: 260, after: 60 }),
    p([r(facility?.address || '', { size: 20, color: GRIGIO_TESTO })], { align: AlignmentType.CENTER, after: 500 }),
  );

  const metaRows = [
    ['Gestore', company?.name || '—'],
    ['Revisione', String(numeroRevisione)],
    ['Data emissione', dataEmissione],
  ];

  children.push(new Table({
    width: { size: 7000, type: WidthType.DXA },
    alignment: AlignmentType.CENTER,
    rows: metaRows.map(([k, v]) => new TableRow({
      children: [
        new TableCell({
          width: { size: 2600, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
          shading: { type: ShadingType.CLEAR, fill: VERDE_LIGHT },
          borders: { top: B(), bottom: B(), left: B(), right: B() },
          margins: { top: 100, bottom: 100, left: 150, right: 150 },
          children: [p([r(k, { bold: true, color: VERDE_DARK })], { after: 0 })],
        }),
        new TableCell({
          width: { size: 4400, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
          borders: { top: B(), bottom: B(), left: B(), right: B() },
          margins: { top: 100, bottom: 100, left: 150, right: 150 },
          children: [p([r(v)], { after: 0 })],
        }),
      ],
    })),
  }));

  children.push(new Paragraph({ children: [new PageBreak()] }));
  return children;
}

// ── Indice ────────────────────────────────────────────────────
function indice(capitoli) {
  const children = [h1('Indice')];
  capitoli.forEach((c, i) => {
    children.push(p([r(`${i + 1}. `, { bold: true, color: VERDE }), r(c.title, { bold: true })], { after: 60 }));
    if (c.sottocapitoli) {
      c.sottocapitoli.forEach((s, j) => {
        children.push(p([r(`     ${i + 1}.${j + 1}  ${s}`, { size: 20, color: GRIGIO_TESTO })], { after: 30 }));
      });
    }
  });
  children.push(new Paragraph({ children: [new PageBreak()] }));
  return children;
}

// ── Capitolo 1-3: premessa, mission, lettera ────────────────────
const PRINCIPI_FONDAMENTALI = [
  ['Eguaglianza', 'Ogni ospite ha diritto di ricevere l\'assistenza e le cure più appropriate, senza alcuna discriminazione di sesso, razza, lingua, religione o opinione politica.'],
  ['Imparzialità', 'I comportamenti del personale verso gli ospiti sono ispirati a criteri di obiettività, giustizia e imparzialità.'],
  ['Continuità', 'La struttura assicura la continuità e la regolarità dell\'assistenza nell\'arco delle 24 ore.'],
  ['Partecipazione', 'Viene garantita all\'ospite una informazione corretta e completa, la possibilità di esprimere una valutazione sulla qualità dei servizi e di inoltrare reclami o suggerimenti.'],
  ['Efficacia ed efficienza', 'Il servizio è erogato garantendo un ottimale rapporto tra le risorse impiegate, le attività svolte e i risultati ottenuti.'],
];

function bodyPremessa() {
  return corpo('La presente Carta dei Servizi è un documento a disposizione degli ospiti e delle famiglie, teso a facilitare la fruizione dei servizi e a rendere note le caratteristiche complessive dell\'organizzazione. È uno strumento dinamico, aggiornato periodicamente sulla base dell\'evoluzione dei servizi e della normativa vigente in materia socio-sanitaria.');
}

function bodyMission({ company, gestore }) {
  const blocchi = [
    ...corpo(gestore?.mission_valori || `${company?.name || 'La struttura'} pone al centro della propria attività il benessere, la dignità e la qualità della vita di ogni ospite, garantendo un'assistenza qualificata e personalizzata in un ambiente sereno e familiare.`),
    ...spacer(1),
    h2('Principi fondamentali'),
  ];
  PRINCIPI_FONDAMENTALI.forEach(([titolo, testo]) => {
    blocchi.push(p([r(`${titolo} — `, { bold: true, color: VERDE_DARK }), r(testo)], { after: 140, line: 300 }));
  });
  return blocchi;
}

function bodyLettera(gestore) {
  const blocchi = [...corpo(gestore.lettera_presentazione)];
  if (gestore.firmatario_nome || gestore.firmatario_ruolo) {
    blocchi.push(p([r(gestore.firmatario_ruolo || '', { italic: true })], { align: AlignmentType.RIGHT, before: 200, after: 20 }));
    if (gestore.firmatario_nome) {
      blocchi.push(p([r(gestore.firmatario_nome, { bold: true })], { align: AlignmentType.RIGHT }));
    }
  }
  return blocchi;
}

// ── Capitolo: la struttura e i suoi servizi (box compilati) ─────
function bodyStruttura(capNum, sezioniValori = {}) {
  const blocchi = [];
  CARTA_SERVIZI_SEZIONI_STRUTTURA.forEach((def, idx) => {
    blocchi.push(h2(`${capNum}.${idx + 1}  ${def.label}`));
    blocchi.push(...corpo(sezioniValori[def.id]));
  });
  return blocchi;
}

// ── Capitolo: storico revisioni ─────────────────────────────────
function bodyStorico(storico = []) {
  const header = new TableRow({
    tableHeader: true,
    children: ['Revisione', 'Data', 'Note'].map(t => new TableCell({
      shading: { type: ShadingType.CLEAR, fill: VERDE },
      borders: { top: B(VERDE), bottom: B(VERDE), left: B(VERDE), right: B(VERDE) },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [p([r(t, { bold: true, size: 18, color: BIANCO })], { after: 0 })],
    })),
  });
  const righe = storico.map((m, i) => new TableRow({
    children: [
      new TableCell({ shading: i % 2 === 1 ? { type: ShadingType.CLEAR, fill: VERDE_LIGHT } : undefined, borders: { top: B(), bottom: B(), left: B(), right: B() }, margins: { top: 60, bottom: 60, left: 120, right: 120 }, children: [p([r(String(m.numero_revisione))], { after: 0 })] }),
      new TableCell({ shading: i % 2 === 1 ? { type: ShadingType.CLEAR, fill: VERDE_LIGHT } : undefined, borders: { top: B(), bottom: B(), left: B(), right: B() }, margins: { top: 60, bottom: 60, left: 120, right: 120 }, children: [p([r(m.data_generazione || '—')], { after: 0 })] }),
      new TableCell({ shading: i % 2 === 1 ? { type: ShadingType.CLEAR, fill: VERDE_LIGHT } : undefined, borders: { top: B(), bottom: B(), left: B(), right: B() }, margins: { top: 60, bottom: 60, left: 120, right: 120 }, children: [p([r(m.note_revisione || '—')], { after: 0 })] }),
    ],
  }));
  if (righe.length === 0) {
    return [new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, rows: [header] })];
  }
  return [new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, rows: [header, ...righe] })];
}

// ── Entry point ───────────────────────────────────────────────
export async function buildCartaServiziDocx({
  facility, company, gestore = {}, sezioni = {},
  numeroRevisione = 1, dataEmissione, storicoRevisioni = [],
}) {
  const logo = await fetchLogo(company?.logo_url);

  // Capitoli numerati dinamicamente: se manca la lettera di presentazione
  // la numerazione si adatta automaticamente (niente salti tipo 2 → 4).
  const capitoli = [
    { title: 'Premessa e riferimenti normativi', body: bodyPremessa() },
    { title: 'Mission e valori', body: bodyMission({ company, gestore }) },
  ];
  if (gestore?.lettera_presentazione) {
    capitoli.push({ title: 'Lettera di presentazione', body: bodyLettera(gestore) });
  }
  capitoli.push({
    title: 'La struttura e i suoi servizi',
    sottocapitoli: CARTA_SERVIZI_SEZIONI_STRUTTURA.map(s => s.label),
    body: null, // popolato sotto, serve il numero di capitolo
  });
  capitoli.push({ title: 'Storico revisioni', body: bodyStorico(storicoRevisioni) });

  const struttureIdx = capitoli.findIndex(c => c.title === 'La struttura e i suoi servizi');
  capitoli[struttureIdx].body = bodyStruttura(struttureIdx + 1, sezioni);

  const corpoDocumento = [];
  capitoli.forEach((c, i) => {
    corpoDocumento.push(h1(`${i + 1}. ${c.title}`));
    corpoDocumento.push(...c.body);
  });

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Arial', size: 22, color: NERO } } } },
    sections: [
      {
        properties: {
          page: { size: { width: PAGE_W, height: PAGE_H }, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } },
          titlePage: true,
        },
        headers: { default: paginaHeader(facility), first: new Header({ children: [] }) },
        footers: { default: paginaFooter(company), first: new Footer({ children: [] }) },
        children: [
          ...copertina({ facility, company, numeroRevisione, dataEmissione, logo }),
          ...indice(capitoli),
          ...corpoDocumento,
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  return await blob.arrayBuffer();
}
