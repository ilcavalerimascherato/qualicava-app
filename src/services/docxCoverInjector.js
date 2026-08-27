// src/services/docxCoverInjector.js
//
// Inserisce la copertina come prime pagine del documento di contenuto ORIGINALE,
// senza toccare stili/numerazioni/tabelle esistenti nel documento.
// A differenza di un merge completo (che unisce due pacchetti OOXML indipendenti
// rimappando stili e numerazioni), qui il documento di contenuto resta intatto:
// copiamo solo il corpo della copertina (paragrafi/tabelle, senza stili propri
// perché generata con formattazione diretta) e le sue eventuali immagini,
// e li anteponiamo al corpo esistente con un'interruzione di pagina.
import PizZip from 'pizzip';
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

export async function inserisciCopertina(copertinaBlob, contenutoFile) {
  const copertinaBytes = new Uint8Array(await copertinaBlob.arrayBuffer());
  const contenutoBytes = new Uint8Array(await contenutoFile.arrayBuffer());

  const coverZip   = new PizZip(copertinaBytes);
  const targetZip  = new PizZip(contenutoBytes);

  const coverDocFile = coverZip.file('word/document.xml');
  const targetDocFile = targetZip.file('word/document.xml');
  if (!coverDocFile) throw new Error('Copertina non valida: word/document.xml mancante');
  if (!targetDocFile) throw new Error('Documento di contenuto non valido: word/document.xml mancante');

  // ── 1. Estrai il corpo della copertina (senza il sectPr finale, che è metadati di pagina) ──
  const coverDocXml = coverDocFile.asText();
  const bodyOpenIdx = coverDocXml.indexOf('<w:body>');
  const sectPrIdx   = coverDocXml.lastIndexOf('<w:sectPr');
  if (bodyOpenIdx === -1 || sectPrIdx === -1) {
    throw new Error('Copertina non valida: struttura <w:body>/<w:sectPr> non riconosciuta');
  }
  let coverBody = coverDocXml.slice(bodyOpenIdx + '<w:body>'.length, sectPrIdx);

  // ── 2. Copia le immagini della copertina nel target, con nomi/rId non in conflitto ──
  const coverRelsFile = coverZip.file('word/_rels/document.xml.rels');
  const coverImageRels = [];
  if (coverRelsFile) {
    const coverRelsDom = parseXml(coverRelsFile.asText());
    const relEls = coverRelsDom.getElementsByTagName('Relationship');
    for (let i = 0; i < relEls.length; i++) {
      const el = relEls[i];
      const target = el.getAttribute('Target') || '';
      if (target.startsWith('media/')) {
        coverImageRels.push({ id: el.getAttribute('Id'), target, type: el.getAttribute('Type') });
      }
    }
  }

  if (coverImageRels.length > 0) {
    const targetRelsPath = 'word/_rels/document.xml.rels';
    const targetRelsFile = targetZip.file(targetRelsPath);
    const targetRelsXml  = targetRelsFile ? targetRelsFile.asText()
      : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${REL_NS}"></Relationships>`;
    const targetRelsDom  = parseXml(targetRelsXml);
    const relationshipsEl = targetRelsDom.getElementsByTagName('Relationships')[0];

    const existingIds = Array.from(targetRelsDom.getElementsByTagName('Relationship'))
      .map(el => parseInt((el.getAttribute('Id') || '').replace('rId', ''), 10))
      .filter(n => !isNaN(n));
    let nextId = (existingIds.length ? Math.max(...existingIds) : 0) + 1;

    const existingMediaNames = new Set(
      Object.keys(targetZip.files)
        .filter(f => f.startsWith('word/media/'))
        .map(f => f.split('/').pop())
    );

    const ctFile = targetZip.file('[Content_Types].xml');
    const ctDom  = parseXml(ctFile.asText());
    const ctRoot = ctDom.getElementsByTagName('Types')[0];
    const existingDefaultExts = new Set(
      Array.from(ctDom.getElementsByTagName('Default')).map(el => (el.getAttribute('Extension') || '').toLowerCase())
    );

    const timestamp = Date.now();
    coverImageRels.forEach((rel, i) => {
      const coverMediaPath = 'word/' + rel.target; // es. word/media/image1.png
      const mediaFile = coverZip.file(coverMediaPath);
      if (!mediaFile) return;

      const ext = (rel.target.split('.').pop() || 'png').toLowerCase();
      let newName = `cover_${timestamp}_${i}.${ext}`;
      while (existingMediaNames.has(newName)) {
        newName = `cover_${timestamp}_${i}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
      }
      existingMediaNames.add(newName);

      // copia i byte immagine nel target
      targetZip.file(`word/media/${newName}`, mediaFile.asUint8Array());

      // nuova relationship nel target
      const newId = `rId${nextId++}`;
      const relEl = targetRelsDom.createElement('Relationship');
      relEl.setAttribute('Id', newId);
      relEl.setAttribute('Type', rel.type || 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image');
      relEl.setAttribute('Target', `media/${newName}`);
      relationshipsEl.appendChild(relEl);

      // dichiara l'estensione in [Content_Types].xml se mancante
      if (!existingDefaultExts.has(ext)) {
        const defEl = ctDom.createElement('Default');
        defEl.setAttribute('Extension', ext);
        defEl.setAttribute('ContentType', extToContentType(ext));
        ctRoot.appendChild(defEl);
        existingDefaultExts.add(ext);
      }

      // aggiorna nel corpo copertina i riferimenti al vecchio rId con il nuovo
      const oldIdEscaped = rel.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      coverBody = coverBody.replace(
        new RegExp('(r:embed="|r:id="|r:link=")' + oldIdEscaped + '"', 'g'),
        '$1' + newId + '"'
      );
    });

    targetZip.file('word/_rels/document.xml.rels', serializeXml(targetRelsDom));
    targetZip.file('[Content_Types].xml', serializeXml(ctDom));
  }

  // ── 3. Interruzione di pagina tra copertina e contenuto originale ──
  const pageBreak = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';

  // ── 4. Inserisci il corpo della copertina + interruzione all'inizio del body target ──
  const targetDocXml = targetDocFile.asText();
  const targetBodyOpenIdx = targetDocXml.indexOf('<w:body>');
  if (targetBodyOpenIdx === -1) throw new Error('Documento di contenuto non valido: <w:body> non trovato');
  const insertPoint = targetBodyOpenIdx + '<w:body>'.length;
  const newTargetDocXml =
    targetDocXml.slice(0, insertPoint) +
    coverBody + pageBreak +
    targetDocXml.slice(insertPoint);

  targetZip.file('word/document.xml', newTargetDocXml);

  return targetZip.generate({ type: 'blob', compression: 'DEFLATE' });
}
