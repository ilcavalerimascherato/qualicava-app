// src/utils/haccpSemaforo.js
// SSOT per il semaforo HACCP "effettivo" di una struttura: una struttura
// con cucina condivisa (haccp_profili.cucina_condivisa_con valorizzato)
// mostra sempre 'blu', a prescindere dal semaforo grezzo in
// haccp_scadenzario. Prima questa regola era duplicata — applicata in
// useHaccpData.js per le card della pagina HACCP, ma ignorata da
// useBadgeCounts.js per il badge di navigazione — risultato: lo stesso
// dato, due numeri diversi in due punti dell'app (il badge contava i
// rossi/gialli grezzi anche per le strutture che in pagina apparivano blu).
// Ora entrambi passano da qui.
import { supabase } from '../supabaseClient';

export function resolveHaccpSemaforo(rawSemaforo, hasCucinaCondivisa) {
  return hasCucinaCondivisa ? 'blu' : (rawSemaforo ?? null);
}

/**
 * Legge haccp_scadenzario + haccp_profili.cucina_condivisa_con e ritorna
 * la mappa { struttura_id: semaforo effettivo } — stessa vista usata sia
 * dalle card/conteggi della pagina HACCP sia dai badge di navigazione.
 * @param {number[]|null} ids - limita alle sole strutture indicate; null = tutte
 */
export async function fetchEffectiveHaccpSemafori(ids = null) {
  let scadenzarioQuery = supabase
    .from('haccp_scadenzario')
    .select('struttura_id, semaforo, stato_scia, manuale_scadenza, r_haccp_scadenza, prossima_analisi');
  let profiliQuery = supabase
    .from('haccp_profili')
    .select('struttura_id, cucina_condivisa_con')
    .not('cucina_condivisa_con', 'is', null);

  if (ids?.length) {
    scadenzarioQuery = scadenzarioQuery.in('struttura_id', ids);
    profiliQuery = profiliQuery.in('struttura_id', ids);
  }

  const [scadenzarioRes, profiliRes] = await Promise.all([scadenzarioQuery, profiliQuery]);
  if (scadenzarioRes.error) throw scadenzarioRes.error;

  const cucinaCondivisaIds = new Set((profiliRes.data ?? []).map(p => p.struttura_id));
  const scadenzario = {};
  const semafori = {};
  for (const row of scadenzarioRes.data ?? []) {
    scadenzario[row.struttura_id] = row;
    semafori[row.struttura_id] = resolveHaccpSemaforo(row.semaforo, cucinaCondivisaIds.has(row.struttura_id));
  }
  // Strutture con cucina condivisa ma senza riga in haccp_scadenzario
  for (const id of cucinaCondivisaIds) {
    if (!(id in semafori)) semafori[id] = 'blu';
  }

  return { semafori, scadenzario };
}
