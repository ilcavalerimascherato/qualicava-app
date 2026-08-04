// src/utils/surveyColors.js
// Schema colori a semaforo condiviso tra BarreMinMax (barre "Tutte le domande")
// e DistribuzioneRisposte (torta per domanda) — devono combaciare esattamente
// perché compaiono nella stessa schermata per la stessa fascia di punteggio.
export function semaforoColor(val) {
  if (val > 80) return '#0ca30c';
  if (val >= 75) return '#2a78d6';
  if (val >= 70) return '#eda100';
  return '#e34948';
}
