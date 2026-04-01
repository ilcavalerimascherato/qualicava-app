// src/services/supabaseService.js
// Regola fondamentale: ogni service lancia l'errore, non lo gestisce.
// La gestione (toast, UI) spetta al chiamante.

import { supabase } from '../supabaseClient';

// ─── Log service ──────────────────────────────────────────────
// FIRE AND FORGET: il log non deve mai bloccare l'operazione principale
const log = (action, details = {}) => {
  supabase.auth.getSession()
    .then(({ data: { session } }) =>
      supabase.from('logs').insert([{
        user_email: session?.user?.email ?? 'unknown',
        action,
        details,
      }])
    )
    .catch(err => console.warn('[log] fallito silenziosamente:', err));
};

// ─── UDO service ──────────────────────────────────────────────
export const udoService = {
  save: async (udo) => {
    const { data, error } = await supabase.from('udos').upsert([udo]).select().single();
    if (error) throw error;
    log(udo.id ? 'UPDATE_UDO' : 'CREATE_UDO', { id: data.id, name: data.name });
    return data;
  },
  delete: async (id) => {
    const { error } = await supabase.from('udos').delete().eq('id', id);
    if (error) throw error;
    log('DELETE_UDO', { id });
  },
};

// ─── Facility service ─────────────────────────────────────────
export const facilityService = {
  save: async (facility) => {
    const { data, error } = await supabase.from('facilities').upsert([facility]).select().single();
    if (error) throw error;
    log(facility.id ? 'UPDATE_FACILITY' : 'CREATE_FACILITY', { id: data.id, name: data.name });
    return data;
  },
  delete: async (id) => {
    const { error } = await supabase.from('facilities').delete().eq('id', id);
    if (error) throw error;
    log('DELETE_FACILITY', { id });
  },
  toggleSuspend: async (facility) => {
    const newState = !facility.is_suspended;
    const { error } = await supabase
      .from('facilities')
      .update({ is_suspended: newState })
      .eq('id', facility.id);
    if (error) throw error;
    log(newState ? 'SUSPEND_FACILITY' : 'REACTIVATE_FACILITY', { id: facility.id });
  },
};

// ─── Questionnaire service ────────────────────────────────────
export const questionnaireService = {
  upsert: async (payload) => {
    const { data, error } = await supabase
      .from('questionnaires')
      .upsert({
        facility_id: payload.facility_id,
        year:        payload.year,
        type:        payload.type,
        calendar_id: `${payload.year}-12`,
        start_date:  payload.start_date  || null,
        end_date:    payload.end_date    || null,
        esiti_pdf:   payload.esiti_pdf   || null,
      }, { onConflict: 'facility_id, type, calendar_id' })
      .select()
      .single();
    if (error) throw error;
    log('UPSERT_QUESTIONNAIRE', { facility_id: payload.facility_id, type: payload.type });
    return data;
  },
};

// ─── User management service (solo admin/superadmin) ──────────
export const userService = {
  // Crea utente + profilo in un'unica operazione
  invite: async ({ email, fullName, role, companyId, facilityIds = [] }) => {
    // Usa la Edge Function 'invite-user' che gira server-side con la service role key.
    // La funzione: crea l'utente in Auth, aggiorna il profilo, assegna le strutture,
    // invia l'email di reset password al direttore.
    const { data, error } = await supabase.functions.invoke('invite-user', {
      body: { email, fullName, role, companyId, facilityIds },
    });
    if (error) throw new Error(error.message || 'Errore Edge Function invite-user');
    if (data?.error) throw new Error(data.error);
    log('INVITE_USER', { email, role, facilityIds });
    return data;
  },

  updateAccess: async (userId, facilityIds) => {
    // Rimpiazza tutti gli accessi con il nuovo set
    const { error: delError } = await supabase
      .from('user_facility_access')
      .delete()
      .eq('user_id', userId);
    if (delError) throw delError;

    if (facilityIds.length > 0) {
      const rows = facilityIds.map(fid => ({ user_id: userId, facility_id: fid }));
      const { error: insError } = await supabase.from('user_facility_access').insert(rows);
      if (insError) throw insError;
    }
    log('UPDATE_USER_ACCESS', { userId, facilityIds });
  },

  listByCompany: async (companyId) => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*, user_facility_access(facility_id)')
      .eq('company_id', companyId)
      .order('full_name');
    if (error) throw error;
    return data;
  },
};
