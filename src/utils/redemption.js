// Fonte unica del calcolo Redemption (risposte / target audience), condivisa
// da AnalyticsModal.jsx (report mensile) e AnalisiCampagnaPanel.jsx /
// surveyCampagnaDocService.js (report di campagna) — evita che le due
// formule divergano. Estratto da AnalyticsModal.jsx (round 5).

// KPI che contiene il numero di dipendenti totali (fonte per staff_count operatori)
const STAFF_KPI_KEY = 'Numero totale dipendenti soggetti a formazione sicurezza';

/** Legge staff_count dall'ultimo record KPI completato per la struttura/periodo. */
export function getStaffCount(kpiRecords, facilityId, calendarId) {
  if (!kpiRecords?.length || !calendarId) return null;

  // Il calendar_id del survey è nel formato "YYYY-MM"
  const [year, month] = calendarId.split('-').map(Number);

  // Cerca prima il mese esatto, poi scorre a ritroso fino a 6 mesi
  for (let offset = 0; offset <= 5; offset++) {
    const d = new Date(year, month - 1 - offset, 1);
    const rec = kpiRecords.find(k =>
      String(k.facility_id) === String(facilityId) &&
      Number(k.year)  === d.getFullYear() &&
      Number(k.month) === d.getMonth() + 1 &&
      k.status === 'completed'
    );
    if (rec?.metrics_json) {
      const entry = rec.metrics_json[STAFF_KPI_KEY];
      if (entry && !entry.is_na) {
        const v = parseFloat(entry.value);
        if (!isNaN(v) && v > 0) return Math.round(v);
      }
    }
  }
  return null;
}

/** Redemption % arrotondata, null se il target audience non è disponibile. */
export function computeRedemptionRate(totalResponses, targetAudience) {
  return targetAudience && targetAudience > 0
    ? Math.round((totalResponses / targetAudience) * 100)
    : null;
}
