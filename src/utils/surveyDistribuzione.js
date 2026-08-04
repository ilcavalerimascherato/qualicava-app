// src/utils/surveyDistribuzione.js
import { semaforoColor } from './surveyColors';
import { LABEL_MAP } from '../config/surveyLabels';

const FASCIA_VERDE   = 'Verde (>80)';
const FASCIA_BLU     = 'Blu (75-80)';
const FASCIA_ARANCIO = 'Arancio (70-75)';
const FASCIA_ROSSO   = 'Rosso (<70)';

// Sonde dentro ogni fascia, non sui confini: se semaforoColor() cambia dove
// cadono esattamente 80/75/70 (come già successo una volta), queste restano
// valide perché stanno nel mezzo di ciascun intervallo, mai su un bordo.
export const FASCIA_COLORS = {
  [FASCIA_VERDE]:   semaforoColor(100),
  [FASCIA_BLU]:     semaforoColor(77),
  [FASCIA_ARANCIO]: semaforoColor(72),
  [FASCIA_ROSSO]:   semaforoColor(0),
};

function fasciaDi(val) {
  const c = semaforoColor(val);
  if (c === FASCIA_COLORS[FASCIA_VERDE])   return FASCIA_VERDE;
  if (c === FASCIA_COLORS[FASCIA_BLU])     return FASCIA_BLU;
  if (c === FASCIA_COLORS[FASCIA_ARANCIO]) return FASCIA_ARANCIO;
  return FASCIA_ROSSO;
}

// Etichette a valore esatto, posizionali (non per valore numerico fisso):
// usate solo quando la domanda ha esattamente 5 o 6 valori distinti nei dati
// ricevuti. La posizione nell'ordinamento decrescente decide l'etichetta, così
// lo stesso valore grezzo (es. 40) può essere "Insufficiente" su una scala a 5
// e "Incerto" su una scala a 6 (es. nps_consiglio), senza casi speciali per domanda.
const ETICHETTE_VALORE_ESATTO = ['Ottimo', 'Buono', 'Sufficiente', 'Incerto', 'Insufficiente', 'Scarso'];

// Ordine fisso di visualizzazione (fette/legenda), dal migliore al peggiore:
// indipendente dal conteggio di risposte in ciascuna fascia.
export const ORDINE_FASCE = [FASCIA_VERDE, FASCIA_BLU, FASCIA_ARANCIO, FASCIA_ROSSO, ...ETICHETTE_VALORE_ESATTO];
const COLORI_VALORE_ESATTO = {
  Ottimo:        '#0ca30c',
  Buono:         '#2a78d6',
  Sufficiente:   '#eab308',
  Incerto:       '#e2701a',
  Insufficiente: '#eda100',
  Scarso:        '#e34948',
};
Object.assign(FASCIA_COLORS, COLORI_VALORE_ESATTO);

function etichettePerConteggio(n) {
  if (n === 6) return ETICHETTE_VALORE_ESATTO;
  if (n === 5) return ETICHETTE_VALORE_ESATTO.filter(l => l !== 'Incerto');
  return null;
}

/**
 * responses_json (v_survey_data_normalized e v_survey_campagne condividono
 * la stessa forma) è un array con un elemento per rispondente, ognuno un
 * oggetto piatto { chiave_domanda: punteggio_0_100 }.
 * Per ogni domanda, se i valori distinti realmente presenti sono esattamente
 * 5 o 6 (scale Likert testuali chiuse), raggruppiamo per valore esatto
 * (Ottimo…Scarso). Altrimenti (scale numeriche continue 0-10, o campioni
 * troppo piccoli/parziali) restiamo sulle 4 fasce a soglia di sempre.
 * Pronto per il grafico a torta (che accetta già qualunque dizionario
 * chiave→conteggio, a prescindere da quale dei due schemi è stato usato).
 */
export function buildDistribuzione(responsesJson, labelMap = LABEL_MAP) {
  if (!Array.isArray(responsesJson) || responsesJson.length === 0) return [];

  const keys = new Set();
  responsesJson.forEach(r => {
    if (r && typeof r === 'object') Object.keys(r).forEach(k => keys.add(k));
  });

  return Array.from(keys).map(key => {
    const valori = responsesJson
      .map(r => r?.[key])
      .filter(v => typeof v === 'number');

    const distinti = Array.from(new Set(valori)).sort((a, b) => b - a);
    const etichette = etichettePerConteggio(distinti.length);

    const answers = {};
    if (etichette) {
      etichette.forEach(l => { answers[l] = 0; });
      const etichettaPerValore = new Map(distinti.map((v, i) => [v, etichette[i]]));
      valori.forEach(v => { answers[etichettaPerValore.get(v)] += 1; });
    } else {
      answers[FASCIA_VERDE] = 0;
      answers[FASCIA_BLU] = 0;
      answers[FASCIA_ARANCIO] = 0;
      answers[FASCIA_ROSSO] = 0;
      valori.forEach(v => { answers[fasciaDi(v)] += 1; });
    }

    return { key, question: labelMap[key] ?? key, answers };
  });
}
