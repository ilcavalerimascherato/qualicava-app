// src/services/docxPlaceholderImage.js
//
// Sostituisce un placeholder testuale {{tag}} — quando occupa da solo l'intero
// testo di un run (caso di copertinaService.js: header con {{ragione_sociale}})
// — con un'immagine (es. il logo società), operando direttamente sull'XML del
// documento, senza toccare il resto del contenuto. Stessa tecnica "chirurgica"
// già validata in docxCoverInjector.js: nessun merge di pacchetti OOXML.
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

const REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';

function parseXml(text) {
  return new DOMParser().parseFromString(text, 'text/xml');
}
function serializeXml(dom) {
  return new XMLSerializer().serializeToString(dom);
}

function extToContentType(ext) {
  const e = ext.toLowerCase();
  if (e === 'png') return 'image/png';
  if (e === 'jpg' || e === 'jpeg') return 'image/jpeg';
  if (e === 'gif') return 'image/gif';
  if (e === 'bmp') return 'image/bmp';
  return 'application/octet-stream';
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Risolve il part dell'intestazione di default (quello referenziato da
// <w:headerReference w:type="default"/> nel sectPr di word/document.xml).
// Ogni part (document.xml, headerN.xml, ...) ha un proprio scope di
// relationship indipendente (word/_rels/<part>.rels), quindi per inserire
// un'immagine nell'intestazione bisogna operare su QUEL part, non su
// document.xml — altrimenti l'immagine finisce nel corpo per errore.
export function trovaHeaderDefaultPath(zip) {
  const docFile = zip.file('word/document.xml');
  if (!docFile) return null;
  const xml = docFile.asText();
  const match = xml.match(/<w:headerReference[^>]*w:type="default"[^>]*r:id="([^"]+)"/);
  if (!match) return null;

  const relsFile = zip.file('word/_rels/document.xml.rels');
  if (!relsFile) return null;
  const relsDom = parseXml(relsFile.asText());
  const relEls = Array.from(relsDom.getElementsByTagName('Relationship'));
  const rel = relEls.find(el => el.getAttribute('Id') === match[1]);
  if (!rel) return null;
  return 'word/' + rel.getAttribute('Target');
}

/**
 * Sostituisce {{tagName}} con un'immagine, SOLO se il tag occupa da solo
 * l'intero contenuto testuale di un <w:t> (caso copertinaService.js). Se il
 * tag non viene trovato in questa forma esatta (es. già sostituito da testo,
 * oppure combinato con altro testo nello stesso run), non fa nulla e ritorna
 * false — mai una sostituzione "alla cieca" che rischi di rompere l'XML.
 *
 * @param {PizZip} zip        - istanza PizZip del .docx, MUTATA in place
 * @param {string} tagName    - nome del placeholder, senza {{ }} (es. "ragione_sociale")
 * @param {string} imageUrl   - URL pubblico dell'immagine da inserire
 * @param {{widthPx?: number, heightPx?: number, partPath?: string}} [opts]
 *        partPath - part XML su cui operare (default 'word/document.xml');
 *        passare 'word/headerN.xml' per sostituire il placeholder in intestazione.
 * @returns {Promise<boolean>} true se sostituito, false se non applicabile
 */
export async function sostituisciPlaceholderConImmagine(zip, tagName, imageUrl, opts = {}) {
  if (!imageUrl) return false;
  const { widthPx = 160, heightPx = 60, partPath = 'word/document.xml' } = opts;

  const docFile = zip.file(partPath);
  if (!docFile) return false;
  const xml = docFile.asText();

  const tag = `{{${tagName}}}`;
  // Il run deve contenere ESATTAMENTE il tag come unico contenuto del <w:t>,
  // per evitare di toccare occorrenze combinate con altro testo.
  const runRegex = new RegExp(
    '<w:r(?:\\s[^>]*)?>(?:(?!<w:r[ >]).)*?<w:t(?:\\s[^>]*)?>' + escapeRegExp(tag) + '<\\/w:t>(?:(?!<w:r[ >]).)*?<\\/w:r>',
    's'
  );
  if (!runRegex.test(xml)) return false;

  let buffer;
  let contentType = '';
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return false;
    contentType = res.headers.get('content-type') || '';
    buffer = await res.arrayBuffer();
  } catch {
    return false;
  }

  const ext = contentType.includes('png') ? 'png'
    : (contentType.includes('jpeg') || contentType.includes('jpg')) ? 'jpg'
    : (imageUrl.split('.').pop() || 'png').toLowerCase().split('?')[0];

  // ── immagine nel pacchetto ──
  const timestamp = Date.now();
  const mediaName = `ph_${tagName}_${timestamp}.${ext}`;
  zip.file(`word/media/${mediaName}`, new Uint8Array(buffer));

  // ── relationship — scope locale al part (document.xml.rels, headerN.xml.rels, ...) ──
  const partSlashIdx = partPath.lastIndexOf('/');
  const partDir  = partPath.slice(0, partSlashIdx);
  const partFile = partPath.slice(partSlashIdx + 1);
  const relsPath = `${partDir}/_rels/${partFile}.rels`;
  const relsFile = zip.file(relsPath);
  const relsXml = relsFile ? relsFile.asText()
    : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${REL_NS}"></Relationships>`;
  const relsDom = parseXml(relsXml);
  const relationshipsEl = relsDom.getElementsByTagName('Relationships')[0];
  const existingIds = Array.from(relsDom.getElementsByTagName('Relationship'))
    .map(el => parseInt((el.getAttribute('Id') || '').replace('rId', ''), 10))
    .filter(n => !isNaN(n));
  const newId = 'rId' + ((existingIds.length ? Math.max(...existingIds) : 0) + 1);
  const relEl = relsDom.createElement('Relationship');
  relEl.setAttribute('Id', newId);
  relEl.setAttribute('Type', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image');
  relEl.setAttribute('Target', `media/${mediaName}`);
  relationshipsEl.appendChild(relEl);
  zip.file(relsPath, serializeXml(relsDom));

  // ── [Content_Types].xml ──
  const ctFile = zip.file('[Content_Types].xml');
  const ctDom  = parseXml(ctFile.asText());
  const ctRoot = ctDom.getElementsByTagName('Types')[0];
  const existingDefaultExts = new Set(
    Array.from(ctDom.getElementsByTagName('Default')).map(el => (el.getAttribute('Extension') || '').toLowerCase())
  );
  if (!existingDefaultExts.has(ext)) {
    const defEl = ctDom.createElement('Default');
    defEl.setAttribute('Extension', ext);
    defEl.setAttribute('ContentType', extToContentType(ext));
    ctRoot.appendChild(defEl);
    zip.file('[Content_Types].xml', serializeXml(ctDom));
  }

  // ── drawing inline (immagine) al posto del run col placeholder ──
  const widthEmu  = Math.round(widthPx  * 9525);
  const heightEmu = Math.round(heightPx * 9525);
  const docPrId   = Math.floor(Math.random() * 1000000) + 1000;
  const drawingRun =
    '<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">' +
    `<wp:extent cx="${widthEmu}" cy="${heightEmu}"/>` +
    `<wp:docPr id="${docPrId}" name="Logo"/>` +
    '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">' +
    '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
    '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
    `<pic:nvPicPr><pic:cNvPr id="${docPrId}" name="Logo"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${newId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${widthEmu}" cy="${heightEmu}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
    '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>';

  const newXml = xml.replace(runRegex, drawingRun);
  zip.file(partPath, newXml);
  return true;
}
