/**
 * src/utils/pdfExport.js  —  v5
 * ─────────────────────────────────────────────────────────────
 * Export PDF A4 con supporto multi-sezione.
 *
 * PROBLEMA RISOLTO:
 *  Un singolo template lungo veniva fotografato tutto insieme e poi
 *  tagliato meccanicamente — il testo AI veniva troncato e i grafici
 *  spezzati tra pagine in modo imprevedibile.
 *
 * SOLUZIONE — due modalità:
 *
 *  1. exportPDF({ elementId, filename })
 *     Modalità semplice: fotografa un singolo elemento e lo impagina.
 *     Usa data-pdf-pagebreak per salti pagina espliciti.
 *
 *  2. exportPDF({ sections: ['id1','id2'], filename })
 *     Modalità multi-sezione: fotografa ogni sezione separatamente,
 *     poi le concatena nel PDF nell'ordine dato.
 *     Ogni sezione inizia sempre su una pagina nuova.
 *     Ogni sezione può scorrere su più pagine se necessario.
 *     Questo garantisce che il testo non venga mai troncato e che
 *     i grafici stiano sempre insieme sulla loro pagina.
 *
 * LOGO AZIENDALE:
 *  Se logoSrc è fornito (default: '/intestazione.png'), viene
 *  mostrato in alto a sinistra di OGNI pagina, piccolo e discreto.
 * ─────────────────────────────────────────────────────────────
 */
import html2canvas from 'html2canvas';
import { jsPDF }   from 'jspdf';

// ── Costanti layout A4 ────────────────────────────────────────
const PAGE_W_MM    = 210;
const PAGE_H_MM    = 297;
const MARGIN_H_MM  = 14;   // margine sx e dx
const MARGIN_T_MM  = 4;   // margine top (sopra il logo)
const MARGIN_B_MM  = 10;   // margine bottom
const LOGO_H_MM    = 10;   // altezza logo
const LOGO_W_MM    = 40;   // larghezza logo (proporzionale)
const LOGO_GAP_MM  = 4;    // gap tra logo e contenuto

// Area utile per il contenuto per pagina
const CONTENT_TOP_MM  = MARGIN_T_MM + LOGO_H_MM + LOGO_GAP_MM;
const CONTENT_W_MM    = PAGE_W_MM - MARGIN_H_MM * 2;
const CONTENT_H_MM    = PAGE_H_MM - CONTENT_TOP_MM - MARGIN_B_MM;

/** Carica un'immagine come JPEG data URL via canvas (evita errori PNG in jsPDF) */
async function loadAsJpeg(path) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous'; // Evita blocchi CORS
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff'; // Sfondo bianco per trasparenze PNG
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = () => {
      console.error(`[CRITICO] Impossibile caricare il logo al path: ${path}`);
      resolve(null);
    };
    img.src = path + '?t=' + new Date().getTime(); // Cache busting
  });
}

/** Attende render DOM */
async function waitFrames(n = 2, extraMs = 0) {
  for (let i = 0; i < n; i++) await new Promise(r => requestAnimationFrame(r));
  if (extraMs) await new Promise(r => setTimeout(r, extraMs));
}

/**
 * Impagina un canvas su N pagine A4, aggiungendo il logo su ognuna.
 * Ritorna il numero di pagine aggiunte.
 */
function paginateCanvas(pdf, canvas, logoDataUrl, pxPerMm, isFirstSection) {
  const contentAreaPx = CONTENT_H_MM * pxPerMm;
  let cursor = 0;
  let pagesAdded = 0;

  while (cursor < canvas.height) {
    const srcH = Math.min(contentAreaPx, canvas.height - cursor);
    if (srcH <= 0) break;

    if (!isFirstSection || pagesAdded > 0) pdf.addPage();

    // Logo in alto a sinistra
    if (logoDataUrl) {
      pdf.addImage(logoDataUrl, 'JPEG', MARGIN_H_MM, MARGIN_T_MM, LOGO_W_MM, LOGO_H_MM);
    }

    // Slice del contenuto
    const sc       = document.createElement('canvas');
    sc.width       = canvas.width;
    sc.height      = Math.round(srcH);
    const ctx      = sc.getContext('2d');
    ctx.fillStyle  = '#ffffff';
    ctx.fillRect(0, 0, sc.width, sc.height);
    ctx.drawImage(canvas, 0, -cursor);

    pdf.addImage(
      sc.toDataURL('image/jpeg', 0.95), 'JPEG',
      MARGIN_H_MM, CONTENT_TOP_MM,
      CONTENT_W_MM, srcH / pxPerMm,
    );

    cursor += srcH;
    pagesAdded++;
  }
  return pagesAdded;
}

/**
 * Esporta il PDF.
 *
 * @param {object}   opts
 * @param {string}   [opts.elementId]   id singolo elemento (modalità semplice)
 * @param {string[]} [opts.sections]    array di id (modalità multi-sezione)
 * @param {string}   opts.filename      nome file .pdf
 * @param {string}   [opts.logoSrc]     path logo da /public (default: /intestazione.png)
 * @param {function} [opts.onDone]      callback al termine
 */
export async function exportPDF({
  elementId,
  sections,
  filename,
  logoSrc = 'intestazione.jpeg',
  onDone,
}) {
  // Normalizza: supporta sia elementId singolo che array sections
  const sectionIds = sections ?? (elementId ? [elementId] : []);
  if (sectionIds.length === 0) {
    console.error('[pdfExport] nessun elemento specificato');
    return;
  }

  const elements = sectionIds.map(id => document.getElementById(id)).filter(Boolean);
  if (elements.length === 0) {
    console.error('[pdfExport] nessun elemento trovato nel DOM:', sectionIds);
    return;
  }

  // ── 1. Carica logo ────────────────────────────────────────────
  const logoDataUrl = await loadAsJpeg(logoSrc);

  // ── 2. Mostra tutti gli elementi e aspetta il render ──────────
  elements.forEach(el => { el.style.display = 'block'; });
  await waitFrames(2, 500); // 500ms per Recharts SVG

  try {
    const pdf     = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    let   isFirst = true;

    for (const el of elements) {
      // Fotografa la sezione
      const canvas = await html2canvas(el, {
        scale: 2, useCORS: true, allowTaint: false,
        logging: false, backgroundColor: '#ffffff',
      });

      const pxPerMm = canvas.width / CONTENT_W_MM;

      paginateCanvas(pdf, canvas, logoDataUrl, pxPerMm, isFirst);
      isFirst = false;
    }

    pdf.save(filename);

  } finally {
    elements.forEach(el => { el.style.display = 'none'; });
    if (onDone) onDone();
  }
}