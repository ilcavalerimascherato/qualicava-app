/**
 * src/services/cartaServiziService.js
 * ─────────────────────────────────────────────────────────────
 * CRUD del profilo Carta dei Servizi (per struttura e per gestore) e
 * generazione del documento .docx, sullo stesso schema di
 * haccpManualeService.js: upload su Storage privato + riga di storico
 * con signed URL valida 1 anno.
 * ─────────────────────────────────────────────────────────────
 */
import { supabase } from '../supabaseClient';
import { buildCartaServiziDocx } from './cartaServiziDocxBuilder';

const BUCKET = 'carta-servizi-documents';
const SIGNED_URL_TTL = 60 * 60 * 24 * 365; // 1 anno

// ── Profilo struttura ────────────────────────────────────────

export async function getProfilo(facilityId) {
  const { data, error } = await supabase
    .from('carta_servizi_profili')
    .select('*')
    .eq('facility_id', facilityId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertProfilo(facilityId, sezioni, userId) {
  const { data, error } = await supabase
    .from('carta_servizi_profili')
    .upsert(
      { facility_id: facilityId, sezioni, updated_at: new Date().toISOString(), updated_by: userId },
      { onConflict: 'facility_id' }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Contenuti gestore (company) ──────────────────────────────

export async function getGestoreContenuti(companyId) {
  if (!companyId) return null;
  const { data, error } = await supabase
    .from('carta_servizi_gestore')
    .select('*')
    .eq('company_id', companyId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertGestoreContenuti(companyId, contenuti, userId) {
  const { data, error } = await supabase
    .from('carta_servizi_gestore')
    .upsert(
      { company_id: companyId, ...contenuti, updated_at: new Date().toISOString(), updated_by: userId },
      { onConflict: 'company_id' }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Storico generazioni ───────────────────────────────────────

export async function getGenerati(facilityId) {
  // Ordina per data di creazione (non per numero_revisione): con
  // numero/data di emissione liberamente impostabili dall'utente, "più
  // recente generato" non coincide necessariamente con "numero più alto"
  // (es. si può preparare in anticipo una revisione futura).
  const { data, error } = await supabase
    .from('carta_servizi_generati')
    .select('*')
    .eq('facility_id', facilityId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// ── Generazione documento ────────────────────────────────────

function slugify(text = '') {
  return text
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Suggerisce il prossimo numero di revisione (max esistente + 1, o 1 se non
 * c'è ancora nulla). È solo un default nel form: l'utente può cambiarlo
 * liberamente prima di generare, ad es. per preparare in anticipo un
 * documento con una data/numero specifici.
 */
export function suggerisciProssimaRevisione(generati = []) {
  const max = generati.reduce((acc, g) => Math.max(acc, g.numero_revisione ?? 0), 0);
  return max + 1;
}

/**
 * Etichetta da mostrare nelle liste interne (storico, badge): include il
 * suffisso _N solo se questo numero_revisione è già stato generato altre
 * volte in precedenza. Il documento .docx stampabile invece non usa mai
 * questo suffisso — mostra sempre e solo il numero_revisione principale.
 */
export function formattaRevisione(riga) {
  if (!riga) return '';
  return riga.versione_interna > 0
    ? `${riga.numero_revisione}_${riga.versione_interna}`
    : String(riga.numero_revisione);
}

/**
 * Genera il .docx della Carta dei Servizi, lo carica su Storage e crea una
 * nuova riga di storico. `numeroRevisione` e `dataEmissione` sono scelti
 * dall'utente nel form (di norma pre-compilati con un default sensato).
 * Se il numero_revisione richiesto è già stato usato in precedenza per la
 * stessa struttura, la nuova riga viene marcata come sotto-versione
 * (versione_interna = 1, 2, ...) — visibile solo nelle liste interne,
 * mai nel documento stampabile (che riporta sempre il solo numero principale).
 */
export async function generaCartaServizi({
  facility, company, gestore, profiloSezioni, noteRevisione, userId,
  numeroRevisione, dataEmissione,
}) {
  const esistenti = await getGenerati(facility.id);
  const numRev = Number(numeroRevisione) || suggerisciProssimaRevisione(esistenti);
  const oggi = dataEmissione || new Date().toISOString().split('T')[0];
  const versioneInterna = esistenti.filter(g => g.numero_revisione === numRev).length;

  const docxBuffer = await buildCartaServiziDocx({
    facility,
    company,
    gestore: gestore ?? {},
    sezioni: profiloSezioni ?? {},
    numeroRevisione: numRev,
    dataEmissione: oggi,
    storicoRevisioni: esistenti.slice(0, 3),
  });

  const suffisso = versioneInterna > 0 ? `${numRev}_${versioneInterna}` : String(numRev);
  const nomeFile = `CartaServizi_${slugify(facility.name)}_${suffisso}_${oggi}.docx`;
  const path = `${facility.id}/carta-servizi/${nomeFile}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, docxBuffer, {
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      upsert: true,
    });
  if (upErr) throw upErr;

  const { data: signData, error: signErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL);
  if (signErr) throw signErr;
  if (!signData?.signedUrl) throw new Error('Impossibile generare URL di download.');

  const { data: riga, error: dbErr } = await supabase
    .from('carta_servizi_generati')
    .insert([{
      facility_id: facility.id,
      numero_revisione: numRev,
      versione_interna: versioneInterna,
      data_generazione: oggi,
      generato_da: userId,
      note_revisione: noteRevisione || null,
      file_path: path,
      file_url: signData.signedUrl,
    }])
    .select()
    .single();
  if (dbErr) throw dbErr;

  return riga;
}
