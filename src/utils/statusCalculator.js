/**
 * src/utils/statusCalculator.js  —  v2
 * MODIFICHE v2:
 *  - enrichFacilitiesData aggiunge `_kpiFuture: true` alle strutture
 *    quando l'anno selezionato è nel futuro.
 *    FacilityCard usa questo flag per mostrare "KPI N/D" grigio
 *    invece del verde fuorviante (isKpiGreen=true su anni futuri).
 *    La logica di isKpiGreen rimane invariata (fonte di verità per
 *    il calcolo del semaforo dashboard), _kpiFuture è solo un
 *    hint visivo per la card.
 */

const getActionableMonths = (selectedYear) => {
  const now          = new Date();
  const currentYear  = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const sel          = Number(selectedYear);

  if (sel < currentYear)   return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  if (sel === currentYear) return Array.from({ length: currentMonth - 1 }, (_, i) => i + 1);
  return []; // anno futuro
};

export const getSurveyStatus = (surveys, facilityId, companyId, type) => {
  const relevant = surveys.filter(s =>
    s.type === type &&
    (s.facility_id === facilityId || (!s.facility_id && s.company_id === companyId))
  );
  if (relevant.length === 0) return 'empty';
  const latest = relevant.sort((a, b) => b.calendar_id.localeCompare(a.calendar_id))[0];
  if (latest.ai_report_ospiti || latest.ai_report_direzione) return 'completed';
  return 'pending';
};

export const enrichFacilitiesData = (facilities, surveys, kpiRecords, year, udos = []) => {
  if (!facilities?.length) return [];

  const actionableMonths = getActionableMonths(year);
  const selectedYear     = Number(year);
  const isFutureYear     = selectedYear > new Date().getFullYear();
  const udoMap           = new Map(udos.map(u => [u.id, u]));

  return facilities.map(f => {
    const udo       = udoMap.get(f.udo_id);
    const udo_color = udo?.color || '#cbd5e1';
    const udo_name  = udo?.name  || '';

    const clientStatus = getSurveyStatus(surveys, f.id, f.company_id, 'client');
    const staffStatus  = getSurveyStatus(surveys, f.id, f.company_id, 'operator');

    const clientCompleted = clientStatus === 'completed';
    const staffCompleted  = staffStatus  === 'completed';

    const isGreen  = clientCompleted && staffCompleted;
    const isRed    = clientStatus === 'empty' && staffStatus === 'empty';
    const isYellow = !isGreen && !isRed;

    const fKpis = (kpiRecords ?? []).filter(k =>
      String(k.facility_id) === String(f.id) &&
      Number(k.year) === selectedYear &&
      k.status === 'completed'
    );
    const completedMonths = fKpis.map(k => Number(k.month));
    const isKpiGreen = actionableMonths.length === 0
      ? true
      : actionableMonths.every(m => completedMonths.includes(m));

    return {
      ...f,
      bed_count:    f.bed_count ?? 0,
      udo_color,
      udo_name,
      isGreen,
      isYellow,
      isRed,
      isKpiGreen,
      _kpiFuture:   isFutureYear, // hint visivo per FacilityCard
      clientCompleted,
      staffCompleted,
      clientStatus,
      staffStatus,
    };
  });
};

// Se la struttura ha cucina condivisa con un'altra struttura, il semaforo HACCP
// diventa blu indipendentemente da qualsiasi altro calcolo.
export const getHaccpSemaforoOverride = (profilo) => {
  if (profilo?.cucina_condivisa_con) {
    return {
      semaforo:    'blu',
      label:       'Cucina condivisa',
      color:       '#3B82F6',
      descrizione: 'La gestione HACCP è affidata alla struttura capofila',
    };
  }
  return null;
};

export const calculateDashboardStats = (enrichedFacilities, activeUdo = 'all') => {
  const active = enrichedFacilities.filter(f =>
    !f.is_suspended &&
    (activeUdo === 'all' || String(f.udo_id) === String(activeUdo))
  );
  const total = active.length || 1;

  return {
    clientPct:  Math.round((active.filter(f => f.clientCompleted).length / total) * 100),
    staffPct:   Math.round((active.filter(f => f.staffCompleted).length  / total) * 100),
    totalBeds:  active.reduce((sum, f) => sum + (f.bed_count || 0), 0),
    counts: {
      all:       active.length,
      todo:      active.filter(f => f.isRed).length,
      progress:  active.filter(f => f.isYellow).length,
      completed: active.filter(f => f.isGreen).length,
    },
  };
};
