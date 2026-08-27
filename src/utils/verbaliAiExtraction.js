// Orchestratore dell'estrazione AI per il modulo Verbali Ispettivi:
// File PDF -> base64 -> callClaudeWithPdf -> parsing/validazione JSON.
// Nessuna scrittura su Supabase qui — quella vive nel service layer
// (src/services/verbaliIspettiviService.js), così questa funzione resta
// testabile in isolamento su PDF reali prima di costruire la UI.
import { callClaudeWithPdf } from './aiClient';
import { buildPrompt } from '../config/aiPrompts';

const MAX_PDF_BYTES = 20 * 1024 * 1024; // 20MB — vedi nota "dimensione massima PDF" nel piano

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // reader.result è "data:application/pdf;base64,AAAA..." — teniamo solo la parte dopo la virgola
      const base64 = String(reader.result).split(',')[1] ?? '';
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Lettura file fallita.'));
    reader.readAsDataURL(file);
  });
}

// Rimuove eventuali blocchi ```json ... ``` residui prima del parsing —
// difensivo anche se il prompt istruisce di non usarli mai.
function stripMarkdownFence(text) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

// Validazione minima: il risultato deve avere un tipo_ispezione e almeno
// un contenuto (osservazioni o rilievi) da cui ripartire — altrimenti
// meglio segnalare "estrazione incompleta" che salvare un record vuoto
// che sembra completo.
function validateExtraction(data) {
  if (!data || typeof data !== 'object') return 'Risposta AI non è un oggetto JSON valido.';
  if (!data.tipo_ispezione) return 'Campo "tipo_ispezione" mancante nella risposta AI.';
  const hasOsservazioni = typeof data.osservazioni_raw === 'string' && data.osservazioni_raw.trim().length > 0;
  const hasRilievi = Array.isArray(data.rilievi) && data.rilievi.length > 0;
  if (!hasOsservazioni && !hasRilievi) {
    return 'Estrazione incompleta — nessuna osservazione né rilievo trovato. Verifica/inserimento manuale necessario.';
  }
  return null;
}

/**
 * Estrae i dati strutturati da un PDF di verbale ispettivo.
 * @param {File} file - il PDF caricato dal Direttore
 * @returns {Promise<{ ok: boolean, data: object|null, rawText: string, model: string, error: string|null }>}
 */
export async function extractVerbaleFromPdf(file) {
  if (!file || file.type !== 'application/pdf') {
    return { ok: false, data: null, rawText: '', model: null, error: 'Il file selezionato non è un PDF.' };
  }
  if (file.size > MAX_PDF_BYTES) {
    return {
      ok: false, data: null, rawText: '', model: null,
      error: `Il PDF supera la dimensione massima consentita (${Math.round(MAX_PDF_BYTES / 1024 / 1024)}MB).`,
    };
  }

  let base64;
  try {
    base64 = await fileToBase64(file);
  } catch (err) {
    return { ok: false, data: null, rawText: '', model: null, error: `Impossibile leggere il file: ${err.message}` };
  }

  const prompt = buildPrompt('estrazioneVerbaleIspettivo');

  let rawText = '';
  try {
    rawText = await callClaudeWithPdf(prompt, base64, { maxTokens: 8000 });
  } catch (err) {
    return { ok: false, data: null, rawText: '', model: null, error: `Chiamata AI fallita: ${err.message}` };
  }

  let data = null;
  try {
    data = JSON.parse(stripMarkdownFence(rawText));
  } catch (err) {
    return {
      ok: false, data: null, rawText, model: null,
      error: `Risposta AI non interpretabile come JSON (${err.message}). Testo grezzo conservato per revisione manuale.`,
    };
  }

  const validationError = validateExtraction(data);
  if (validationError) {
    return { ok: false, data, rawText, model: null, error: validationError };
  }

  return { ok: true, data, rawText, model: null, error: null };
}
