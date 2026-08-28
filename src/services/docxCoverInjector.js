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

const HEADER_CT = 'application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml';
const FOOTER_CT = 'application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml';
const HEADER_REL_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/header';
const FOOTER_REL_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer';

// Trova il primo numero libero per un nuovo part "word/<prefix>N.xml" nel target.
function nextPartNumber(targetZip, prefix) {
  const used = Object.keys(targetZip.files)
    .map(f => f.match(new RegExp(`^word/${prefix}(\\d+)\\.xml$`)))
    .filter(Boolean)
    .map(m => parseInt(m[1], 10));
  return (used.length ? Math.max(...used) : 0) + 1;
}

// Copia le immagini referenziate da un part (header/footer) della copertina nel
// target, con nomi univoci, riscrivendo i Target nel file .rels copiato (i r:id
// restano invariati: il nuovo file .rels è indipendente, scope locale al part).
function copiaImmaginiPart(coverZip, targetZip, coverRelsXml, existingMediaNames, ctDom, ctRoot, existingDefaultExts, labelPrefix) {
  if (!coverRelsXml) return coverRelsXml;
  const relsDom = parseXml(coverRelsXml);
  const relEls = Array.from(relsDom.getElementsByTagName('Relationship'));
  let mutated = false;
  relEls.forEach((el, i) => {
    const target = el.getAttribute('Target') || '';
    if (!target.startsWith('media/')) return;
    const mediaFile = coverZip.file('word/' + target);
    if (!mediaFile) return;

    const ext = (target.split('.').pop() || 'png').toLowerCase();
    let newName = `${labelPrefix}_${Date.now()}_${i}.${ext}`;
    while (existingMediaNames.has(newName)) {
      newName = `${labelPrefix}_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
    }
    existingMediaNames.add(newName);
    targetZip.file(`word/media/${newName}`, mediaFile.asUint8Array());
    el.setAttribute('Target', `media/${newName}`);
    mutated = true;

    if (!existingDefaultExts.has(ext)) {
      const defEl = ctDom.createElement('Default');
      defEl.setAttribute('Extension', ext);
      defEl.setAttribute('ContentType', extToContentType(ext));
      ctRoot.appendChild(defEl);
      existingDefaultExts.add(ext);
    }
  });
  return mutated ? serializeXml(relsDom) : coverRelsXml;
}

// Trasferisce intestazione e piè di pagina VERI (ripetuti su ogni pagina) dalla
// copertina al documento target, sostituendo quelli (spesso obsoleti) del
// documento originale. A differenza del corpo, qui i part vengono copiati
// integralmente (non sono generati con formattazione diretta come il corpo:
// possono avere una propria porzione di stile), quindi non tocchiamo in alcun
// modo styles.xml/numbering.xml del target — solo le relationship di sectPr.
function trasferisciIntestazionePiePagina(coverZip, targetZip, coverDocXml, coverSectPrXml, targetDocXml) {
  const coverRelsFile = coverZip.file('word/_rels/document.xml.rels');
  if (!coverRelsFile) return targetDocXml;
  const coverRelsDom = parseXml(coverRelsFile.asText());
  const coverRelsById = {};
  Array.from(coverRelsDom.getElementsByTagName('Relationship')).forEach(el => {
    coverRelsById[el.getAttribute('Id')] = el.getAttribute('Target');
  });

  const headerMatch = coverSectPrXml.match(/<w:headerReference[^>]*w:type="default"[^>]*r:id="([^"]+)"/);
  const footerMatch = coverSectPrXml.match(/<w:footerReference[^>]*w:type="default"[^>]*r:id="([^"]+)"/);
  if (!headerMatch && !footerMatch) return targetDocXml; // copertina senza header/footer veri: niente da trasferire

  const targetRelsPath = 'word/_rels/document.xml.rels';
  const targetRelsDom  = parseXml(targetZip.file(targetRelsPath).asText());
  const relationshipsEl = targetRelsDom.getElementsByTagName('Relationships')[0];
  const existingIds = Array.from(targetRelsDom.getElementsByTagName('Relationship'))
    .map(el => parseInt((el.getAttribute('Id') || '').replace('rId', ''), 10))
    .filter(n => !isNaN(n));
  let nextId = (existingIds.length ? Math.max(...existingIds) : 0) + 1;

  const existingMediaNames = new Set(
    Object.keys(targetZip.files).filter(f => f.startsWith('word/media/')).map(f => f.split('/').pop())
  );
  const ctDom  = parseXml(targetZip.file('[Content_Types].xml').asText());
  const ctRoot = ctDom.getElementsByTagName('Types')[0];
  const existingDefaultExts = new Set(
    Array.from(ctDom.getElementsByTagName('Default')).map(el => (el.getAttribute('Extension') || '').toLowerCase())
  );

  let newHeaderRelId = null;
  let newFooterRelId = null;

  const trasferisciParte = (coverRelTarget, kind) => {
    // coverRelTarget es. "header1.xml"; kind: 'header' | 'footer'
    const coverPartPath = 'word/' + coverRelTarget;
    const coverPartFile = coverZip.file(coverPartPath);
    if (!coverPartFile) return null;

    const num = nextPartNumber(targetZip, kind);
    const newPartName = `${kind}${num}.xml`;
    const newPartPath = `word/${newPartName}`;

    const coverPartRelsPath = `word/_rels/${coverRelTarget}.rels`;
    const coverPartRelsFile = coverZip.file(coverPartRelsPath);
    const newRelsXml = copiaImmaginiPart(
      coverZip, targetZip,
      coverPartRelsFile ? coverPartRelsFile.asText() : null,
      existingMediaNames, ctDom, ctRoot, existingDefaultExts,
      kind
    );

    targetZip.file(newPartPath, coverPartFile.asText());
    if (newRelsXml) targetZip.file(`word/_rels/${newPartName}.rels`, newRelsXml);

    const overrideEl = ctDom.createElement('Override');
    overrideEl.setAttribute('PartName', `/word/${newPartName}`);
    overrideEl.setAttribute('ContentType', kind === 'header' ? HEADER_CT : FOOTER_CT);
    ctRoot.appendChild(overrideEl);

    const newId = `rId${nextId++}`;
    const relEl = targetRelsDom.createElement('Relationship');
    relEl.setAttribute('Id', newId);
    relEl.setAttribute('Type', kind === 'header' ? HEADER_REL_TYPE : FOOTER_REL_TYPE);
    relEl.setAttribute('Target', newPartName);
    relationshipsEl.appendChild(relEl);
    return newId;
  };

  if (headerMatch) {
    const target = coverRelsById[headerMatch[1]];
    if (target) newHeaderRelId = trasferisciParte(target, 'header');
  }
  if (footerMatch) {
    const target = coverRelsById[footerMatch[1]];
    if (target) newFooterRelId = trasferisciParte(target, 'footer');
  }
  if (!newHeaderRelId && !newFooterRelId) return targetDocXml;

  targetZip.file(targetRelsPath, serializeXml(targetRelsDom));
  targetZip.file('[Content_Types].xml', serializeXml(ctDom));

  // Rimuove i riferimenti header/footer/titlePg esistenti nel target (tutte le
  // varianti: default/first/even) e inserisce quelli nuovi, solo "default" —
  // così la stessa intestazione/piè di pagina della copertina vale su tutte
  // le pagine, sostituendo quelli obsoleti del documento originale.
  const sectPrOpenMatch = targetDocXml.match(/<w:sectPr[^>]*>/);
  if (!sectPrOpenMatch) return targetDocXml;

  let cleaned = targetDocXml
    .replace(/<w:headerReference[^>]*\/>/g, '')
    .replace(/<w:footerReference[^>]*\/>/g, '')
    .replace(/<w:titlePg\s*\/>/g, '');

  const newRefs =
    (newHeaderRelId ? `<w:headerReference w:type="default" r:id="${newHeaderRelId}"/>` : '') +
    (newFooterRelId ? `<w:footerReference w:type="default" r:id="${newFooterRelId}"/>` : '');

  const insertAfter = cleaned.match(/<w:sectPr[^>]*>/)[0];
  cleaned = cleaned.replace(insertAfter, insertAfter + newRefs);

  return cleaned;
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
  const coverSectPrEndIdx = coverDocXml.indexOf('</w:sectPr>', sectPrIdx);
  const coverSectPrXml = coverSectPrEndIdx === -1
    ? coverDocXml.slice(sectPrIdx)
    : coverDocXml.slice(sectPrIdx, coverSectPrEndIdx + '</w:sectPr>'.length);

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
  let newTargetDocXml =
    targetDocXml.slice(0, insertPoint) +
    coverBody + pageBreak +
    targetDocXml.slice(insertPoint);

  // ── 5. Sostituisci intestazione/piè di pagina del target con quelli veri della copertina ──
  newTargetDocXml = trasferisciIntestazionePiePagina(coverZip, targetZip, coverDocXml, coverSectPrXml, newTargetDocXml);

  targetZip.file('word/document.xml', newTargetDocXml);

  return targetZip.generate({ type: 'blob', compression: 'DEFLATE' });
}
