// src/services/surveyCommentsService.js
// Raccoglie i commenti liberi delle survey per un insieme di strutture (non
// una singola campagna) — usato dalla word cloud di Fase 3 (/report,
// "Soddisfazione"). Generalizza fetchCommentiCampagna() di
// AnalisiCampagnaPanel.jsx: quella funzione risolve i nomi struttura nel
// contesto di UNA campagna (survey_campagna_nomi), fragile fuori da quel
// contesto (vedi i bug di mismatch nome↔tabella documentati lì). Qui invece
// si riusa survey_facility_mapping — la stessa fonte usata da
// RestituzioneModal.jsx per andare da facility_id ai nomi struttura nelle
// tabelle raw, indipendentemente da una campagna specifica.
import { supabase } from '../supabaseClient';
import { fetchEliminatiSet, TABELLE_CLIENT } from '../components/AnalisiCampagnaPanel';

/**
 * @param {Array<number>} facilityIds
 * @param {Object} opts
 * @param {string} [opts.fromDate] - ISO date, incluso
 * @param {string} [opts.toDate]   - ISO date, incluso (fino a 23:59:59)
 * @param {'client'|'operator'|'both'} [opts.surveyType]
 * @returns {Promise<Array<{ note: string, facilityId: number, surveyType: 'client'|'operator' }>>}
 */
export async function fetchCommentsForFacilities(facilityIds, opts = {}) {
  if (!facilityIds?.length) return [];
  const { fromDate, toDate, surveyType = 'both' } = opts;

  const { data: mappings } = await supabase
    .from('survey_facility_mapping')
    .select('facility_id, nome_survey')
    .in('facility_id', facilityIds);

  if (!mappings?.length) return [];

  const nameToFacility = new Map(mappings.map(m => [m.nome_survey, m.facility_id]));
  const allNames = [...nameToFacility.keys()];

  const applyDateRange = (query) => {
    let q = query.in('struttura', allNames);
    if (fromDate) q = q.gte('created_at', fromDate);
    if (toDate)   q = q.lte('created_at', `${toDate}T23:59:59`);
    return q;
  };

  const results = [];

  if (surveyType === 'client' || surveyType === 'both') {
    const [rsa, sl, psi, disab, eliminati] = await Promise.all([
      applyDateRange(supabase.from('survey_rsa').select('id, note, struttura')),
      applyDateRange(supabase.from('survey_seniorliving').select('id, "Note", struttura')),
      applyDateRange(supabase.from('survey_centri_psichiatria').select('id, note, struttura')),
      applyDateRange(supabase.from('survey_centri_disabilita').select('id, risposte_cura_assistenza, struttura')),
      fetchEliminatiSet(TABELLE_CLIENT),
    ]);

    const clientRows = [
      ...(rsa.data ?? []).filter(r => !eliminati.has(`survey_rsa:${r.id}`)).map(r => ({ note: r.note, struttura: r.struttura })),
      ...(sl.data ?? []).filter(r => !eliminati.has(`survey_seniorliving:${r.id}`)).map(r => ({ note: r.Note, struttura: r.struttura })),
      ...(psi.data ?? []).filter(r => !eliminati.has(`survey_centri_psichiatria:${r.id}`)).map(r => ({ note: r.note, struttura: r.struttura })),
      ...(disab.data ?? []).filter(r => !eliminati.has(`survey_centri_disabilita:${r.id}`)).map(r => ({ note: r.risposte_cura_assistenza, struttura: r.struttura })),
    ];

    clientRows
      .filter(r => r.note?.trim())
      .forEach(r => results.push({ note: r.note.trim(), facilityId: nameToFacility.get(r.struttura), surveyType: 'client' }));
  }

  if (surveyType === 'operator' || surveyType === 'both') {
    const [{ data }, eliminati] = await Promise.all([
      applyDateRange(supabase.from('survey_personale').select('id, note, struttura')),
      fetchEliminatiSet(['survey_personale']),
    ]);

    (data ?? [])
      .filter(r => !eliminati.has(`survey_personale:${r.id}`))
      .filter(r => r.note?.trim())
      .forEach(r => results.push({ note: r.note.trim(), facilityId: nameToFacility.get(r.struttura), surveyType: 'operator' }));
  }

  return results.filter(r => r.facilityId != null);
}
