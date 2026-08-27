// Orchestratore dell'estrazione AI dei metadati copertina per il modulo
// Documenti/Protocolli: file .docx -> testo grezzo -> callClaude -> parsing
// JSON. Stesso pattern di src/utils/verbaliAiExtraction.js (PDF), qui su
// testo estratto da un .docx via pizzip. Nessuna scrittura su Supabase qui.
import PizZip from 'pizzip';
import { callClaude } from './aiClient';
import { buildPrompt } from '../config/aiPrompts';

const MAX_TESTO_CHARS = 6000; // sufficiente per titolo/codice/tipologia, di solito nelle prime pagine

function stripMarkdownFence(text) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

// Estrae il testo leggibile (senza tag XML) dal word/document.xml di un .docx —
// stessa tecnica di extractPlaceholders() in documentiService.js.
async function extractTextFromDocx(file) {
  const buffer = await file.arrayBuffer();
  const zip = new PizZip(buffer);
  const documentXml = zip.files['word/document.xml']?.asText() ?? '';
  const text = documentXml
    .replace(/<w:p[ >]/g, '\n$&')      // newline prima di ogni paragrafo, per leggibilità
    .replace(/<[^>]+>/g, '')
    .replace(/\n{2,}/g, '\n')
    .trim();
  return text.slice(0, MAX_TESTO_CHARS);
}

/**
 * Estrae titolo/codice/tipologia/elaborata-verificata-approvata da un documento
 * di contenuto .docx, per pre-compilare la copertina.
 * @param {File} file - il .docx caricato dall'admin
 * @returns {Promise<{ ok: boolean, data: object|null, error: string|null }>}
 */
export async function estraiMetadatiDocumento(file) {
  if (!file || !file.name?.endsWith('.docx')) {
    return { ok: false, data: null, error: 'Il file selezionato non è un .docx.' };
  }

  let testo;
  try {
    testo = await extractTextFromDocx(file);
  } catch (err) {
    return { ok: false, data: null, error: `Impossibile leggere il documento: ${err.message}` };
  }
  if (!testo) {
    return { ok: false, data: null, error: 'Il documento sembra vuoto: nessun testo da analizzare.' };
  }

  const prompt = buildPrompt('estrazioneMetadatiDocumento', { testo });

  let rawText;
  try {
    rawText = await callClaude(prompt, { maxTokens: 500 });
  } catch (err) {
    return { ok: false, data: null, error: `Chiamata AI fallita: ${err.message}` };
  }

  let data;
  try {
    data = JSON.parse(stripMarkdownFence(rawText));
  } catch (err) {
    return { ok: false, data: null, error: `Risposta AI non interpretabile come JSON (${err.message}).` };
  }

  return { ok: true, data, error: null };
}
