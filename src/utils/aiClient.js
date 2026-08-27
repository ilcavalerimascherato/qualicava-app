// Helper condiviso per le chiamate dirette all'API Anthropic dal browser.
// UNICO PUNTO da cui l'app deve chiamare l'API Claude — tutti i call site
// AI del progetto passano da qui, così modello/endpoint/gestione errori
// restano definiti in un solo posto.
//
// Nota: la chiave (REACT_APP_ANTHROPIC_API_KEY) è imbustata nel bundle
// client e quindi visibile in rete/sorgente — pratica preesistente in
// tutto il progetto, non introdotta da questo helper.
export const MODEL = 'claude-sonnet-4-6';

export async function callClaude(prompt, { maxTokens = 1000 } = {}) {
  if (!process.env.REACT_APP_ANTHROPIC_API_KEY) {
    throw new Error('Chiave API Anthropic non configurata.');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.REACT_APP_ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return (data.content ?? []).map(b => (b.type === 'text' ? b.text : '')).join('');
}

// Variante con un PDF allegato come content block (Messages API), per i
// flussi di estrazione documento (es. verbali ispettivi) — callClaude resta
// invariata per tutti i prompt solo testo del progetto.
export async function callClaudeWithPdf(prompt, pdfBase64, { maxTokens = 8000 } = {}) {
  if (!process.env.REACT_APP_ANTHROPIC_API_KEY) {
    throw new Error('Chiave API Anthropic non configurata.');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.REACT_APP_ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
          { type: 'text', text: prompt },
        ],
      }],
    }),
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return (data.content ?? []).map(b => (b.type === 'text' ? b.text : '')).join('');
}
