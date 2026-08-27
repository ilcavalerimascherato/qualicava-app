// src/services/verificheService.js
// Servizio dati per la sezione operativa "Verifiche": template, voci, ruoli,
// matrice responsabilità, sessioni/esiti, scadenzario. Pattern di
// documentiService.js (async, throw on error, return data ?? []).
import { supabase } from '../supabaseClient';

// ─── verifiche_ruoli ────────────────────────────────────────────

export async function getRuoli() {
  const { data, error } = await supabase.from('verifiche_ruoli').select('*').order('ordine').order('nome');
  if (error) throw error;
  return data ?? [];
}

export async function createRuolo(ruolo) {
  const { data, error } = await supabase.from('verifiche_ruoli').insert([ruolo]).select().single();
  if (error) throw error;
  return data;
}

export async function updateRuolo(id, ruolo) {
  const { data, error } = await supabase.from('verifiche_ruoli').update(ruolo).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

// ─── verifiche_template (+ voci) ────────────────────────────────

export async function getTemplates() {
  const { data, error } = await supabase.from('verifiche_template').select('*').order('ordine').order('nome');
  if (error) throw error;
  return data ?? [];
}

export async function getTemplateVoci(templateId) {
  const { data, error } = await supabase
    .from('verifiche_template_voci')
    .select('*')
    .eq('template_id', templateId)
    .order('ordine');
  if (error) throw error;
  return data ?? [];
}

export async function createTemplate(template) {
  const { data, error } = await supabase.from('verifiche_template').insert([template]).select().single();
  if (error) throw error;
  return data;
}

export async function updateTemplate(id, template) {
  const { data, error } = await supabase.from('verifiche_template').update(template).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function saveTemplateVoci(templateId, voci) {
  // Rimpiazza tutte le voci del template — semplice e coerente con la
  // dimensione tipica di una checklist (poche decine di voci al più).
  const { error: delError } = await supabase.from('verifiche_template_voci').delete().eq('template_id', templateId);
  if (delError) throw delError;
  if (voci.length === 0) return [];
  const { data, error } = await supabase
    .from('verifiche_template_voci')
    .insert(voci.map((v, i) => ({ ...v, template_id: templateId, ordine: i })))
    .select();
  if (error) throw error;
  return data ?? [];
}

// ─── verifiche_template_ruoli (matrice responsabilità) ──────────

export async function getTemplateRuoli() {
  const { data, error } = await supabase.from('verifiche_template_ruoli').select('*');
  if (error) throw error;
  return data ?? [];
}

/**
 * Imposta lo stato abilitato/disabilitato di (template, ruolo) a un dato
 * livello (Universale: facilityId/udoId entrambi null; altrimenti uno dei
 * due). Upsert manuale: cerca la riga esistente a quel livello esatto,
 * altrimenti la crea.
 */
export async function setTemplateRuolo({ templateId, ruoloId, facilityId = null, udoId = null, abilitato }) {
  let q = supabase
    .from('verifiche_template_ruoli')
    .select('id')
    .eq('template_id', templateId)
    .eq('ruolo_id', ruoloId);
  q = facilityId != null ? q.eq('facility_id', facilityId) : q.is('facility_id', null);
  q = udoId != null ? q.eq('udo_id', udoId) : q.is('udo_id', null);

  const { data: existing, error: findError } = await q.maybeSingle();
  if (findError) throw findError;

  if (existing) {
    const { data, error } = await supabase
      .from('verifiche_template_ruoli')
      .update({ abilitato })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from('verifiche_template_ruoli')
    .insert([{ template_id: templateId, ruolo_id: ruoloId, facility_id: facilityId, udo_id: udoId, abilitato }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Rimuove un override (torna a ereditare dal livello superiore). */
export async function removeTemplateRuoloOverride(id) {
  const { error } = await supabase.from('verifiche_template_ruoli').delete().eq('id', id);
  if (error) throw error;
}

// ─── verifiche_sessioni / verifiche_esiti ───────────────────────

export async function getSessioni(facilityIds) {
  let q = supabase.from('verifiche_sessioni').select('*').order('data_esecuzione', { ascending: false });
  if (facilityIds?.length) q = q.in('facility_id', facilityIds);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function getEsitiPerSessione(sessioneId) {
  const { data, error } = await supabase.from('verifiche_esiti').select('*').eq('sessione_id', sessioneId);
  if (error) throw error;
  return data ?? [];
}

/**
 * Crea una sessione con i relativi esiti in un'unica chiamata logica.
 * @param {Object} sessione - { template_id, facility_id, data_esecuzione, eseguita_da, ruolo_id, note }
 * @param {Array}  esiti    - [{ voce_id, esito, nota }] — voce_id null se il template non ha sotto-voci
 */
export async function creaSessioneConEsiti(sessione, esiti) {
  const { data: sessioneCreata, error: sessioneError } = await supabase
    .from('verifiche_sessioni')
    .insert([sessione])
    .select()
    .single();
  if (sessioneError) throw sessioneError;

  if (esiti?.length) {
    const { error: esitiError } = await supabase
      .from('verifiche_esiti')
      .insert(esiti.map(e => ({ ...e, sessione_id: sessioneCreata.id })));
    if (esitiError) throw esitiError;
  }

  return sessioneCreata;
}

// ─── verifiche_scadenze ──────────────────────────────────────────

export async function getScadenze(facilityIds) {
  let q = supabase.from('verifiche_scadenze').select('*').eq('attivo', true).order('data_scadenza');
  if (facilityIds?.length) q = q.in('facility_id', facilityIds);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function createScadenza(scadenza) {
  const { data, error } = await supabase.from('verifiche_scadenze').insert([scadenza]).select().single();
  if (error) throw error;
  return data;
}

export async function updateScadenza(id, scadenza) {
  const { data, error } = await supabase.from('verifiche_scadenze').update(scadenza).eq('id', id).select().single();
  if (error) throw error;
  return data;
}
