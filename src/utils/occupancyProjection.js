/**
 * src/utils/occupancyProjection.js
 * ─────────────────────────────────────────────────────────────
 * Proiezione occupazione a N mesi per struttura (Fase 2 "KPI & Economics",
 * §2 del documento di redesign /report — stessa proiezione citata anche in
 * §6 "Early warning" come dato che "esiste già in CDG").
 *
 * Metodo dichiarato dal documento: "media mobile pesata su ingressi/
 * dimissioni degli ultimi 6 mesi". Implementazione volutamente semplice e
 * leggibile — non un modello opaco: il delta netto mensile (ingressi -
 * dimissioni) degli ultimi 6 mesi viene mediato con pesi lineari crescenti
 * (il mese più recente pesa di più), poi proiettato in avanti cumulativamente,
 * cappato tra 0 e i posti letto della struttura.
 *
 * Completamente agnostico rispetto a React.
 * ─────────────────────────────────────────────────────────────
 */

/**
 * @param {Object} facility          - richiede bed_count
 * @param {Array}  cdgRecords        - record v_cdg_mensile della struttura, ordinati
 *                                     per (anno, mese) crescente (output di aggregateCdgRecords)
 * @param {number} [monthsAhead=3]
 * @returns {{
 *   currentOspiti: number,
 *   currentOccupazione: number,          // %
 *   weightedNetChange: number,           // ospiti/mese, può essere negativo
 *   projection: Array<{ monthsAhead: number, ospitiProiettati: number, occupazioneProiettata: number }>
 * } | null}  null se mancano dati sufficienti (bed_count o storico)
 */
export function projectOccupancy(facility, cdgRecords, monthsAhead = 3) {
  if (!facility?.bed_count || !cdgRecords?.length) return null;

  const last6 = cdgRecords.slice(-6);
  const lastRecord = last6[last6.length - 1];
  const currentOspiti = parseFloat(lastRecord?.media_ospiti);
  if (isNaN(currentOspiti)) return null;

  const bedCount = facility.bed_count;

  // Pesi lineari crescenti: il mese più vecchio pesa 1, il più recente pesa last6.length
  const weights = last6.map((_, i) => i + 1);
  const totalWeight = weights.reduce((s, w) => s + w, 0);

  const weightedNetChange = last6.reduce((sum, rec, i) => {
    const net = (rec.ingressi ?? 0) - (rec.dimissioni ?? 0);
    return sum + net * weights[i];
  }, 0) / totalWeight;

  const projection = [];
  let ospiti = currentOspiti;
  for (let m = 1; m <= monthsAhead; m++) {
    ospiti = Math.max(0, Math.min(bedCount, ospiti + weightedNetChange));
    projection.push({
      monthsAhead: m,
      ospitiProiettati: Math.round(ospiti * 10) / 10,
      occupazioneProiettata: Math.round((ospiti / bedCount) * 1000) / 10,
    });
  }

  return {
    currentOspiti,
    currentOccupazione: Math.round((currentOspiti / bedCount) * 1000) / 10,
    weightedNetChange: Math.round(weightedNetChange * 100) / 100,
    projection,
  };
}
