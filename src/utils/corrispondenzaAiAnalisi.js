// Verifica AI degli allegati PDF di una voce di corrispondenza PRIMA del
// salvataggio (vedi CorrispondenzaPanel.jsx — bottone "Verifica con AI"):
// gira sui File in memoria, nessuna scrittura su Storage/DB da qui. Stesso
// pattern di src/utils/verbaliAiExtraction.js, applicato a più PDF insieme
// invece che al singolo verbale.
import { callClaudeWithPdfs } from './aiClient';
import { buildPrompt } from '../config/aiPrompts';

const MAX_PDF_BYTES = 20 * 1024 * 1024; // 20MB — stesso limite del verbale principale

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = String(reader.result).split(',')[1] ?? '';
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Lettura file fallita.'));
    reader.readAsDataURL(file);
  });
}

function stripMarkdownFence(text) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function validateAnalisi(data) {
  if (!data || typeof data !== 'object') return 'Risposta AI non è un oggetto JSON valido.';
  if (!Array.isArray(data.riferimenti_rilevati)) return 'Campo "riferimenti_rilevati" mancante nella risposta AI.';
  return null;
}

/**
 * Analizza uno o più PDF allegati a una voce di corrispondenza, verificando
 * la coerenza col verbale a cui la corrispondenza è agganciata.
 * @param {File[]} pdfFiles - solo file PDF (il chiamante filtra a monte)
 * @param {object} verbale - { numero_verbale, ente, data_sopralluogo, documentazione_richiesta, rilievi }
 * @returns {Promise<{ ok: boolean, data: object|null, error: string|null }>}
 */
export async function analizzaAllegatiCorrispondenza(pdfFiles, verbale) {
  if (!pdfFiles?.length) {
    return { ok: false, data: null, error: 'Nessun PDF da analizzare.' };
  }
  const troppoGrande = pdfFiles.find(f => f.size > MAX_PDF_BYTES);
  if (troppoGrande) {
    return { ok: false, data: null, error: `"${troppoGrande.name}" supera i ${Math.round(MAX_PDF_BYTES / 1024 / 1024)}MB.` };
  }

  let base64Array;
  try {
    base64Array = await Promise.all(pdfFiles.map(fileToBase64));
  } catch (err) {
    return { ok: false, data: null, error: `Impossibile leggere gli allegati: ${err.message}` };
  }

  const prompt = buildPrompt('analisiAllegatiCorrispondenza', { verbale });

  let rawText = '';
  try {
    rawText = await callClaudeWithPdfs(prompt, base64Array, { maxTokens: 4000 });
  } catch (err) {
    return { ok: false, data: null, error: `Chiamata AI fallita: ${err.message}` };
  }

  let data = null;
  try {
    data = JSON.parse(stripMarkdownFence(rawText));
  } catch (err) {
    return { ok: false, data: null, error: `Risposta AI non interpretabile come JSON (${err.message}).` };
  }

  const validationError = validateAnalisi(data);
  if (validationError) {
    return { ok: false, data: null, error: validationError };
  }

  return { ok: true, data, error: null };
}
