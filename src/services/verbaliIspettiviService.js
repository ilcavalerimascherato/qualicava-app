// src/services/verbaliIspettiviService.js
// CRUD + upload Storage per il modulo Verbali Ispettivi. Nessuna logica AI
// qui (vedi src/utils/verbaliAiExtraction.js) — solo persistenza.
import { supabase } from '../supabaseClient';
import { createNotifica } from './notificheService';

const BUCKET = 'verbali-ispettivi';
export const MAX_PDF_BYTES = 20 * 1024 * 1024; // 20MB

// ── Elenco / dettaglio ──────────────────────────────────────────
export async function fetchVerbaliByFacility(facilityId) {
  const { data, error } = await supabase
    .from('verbali_ispettivi')
    .select('*')
    .eq('facility_id', facilityId)
    .order('data_sopralluogo', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// Vista "sede": tutte le strutture visibili al ruolo corrente — nessun
// filtro esplicito per facility_id, la RLS scopa già correttamente
// admin/sede/board (tutto) vs. director (solo le proprie), stesso pattern
// di NonConformitaPage.jsx per non_conformities.
export async function fetchAllVerbali() {
  const { data, error } = await supabase
    .from('verbali_ispettivi')
    .select('*, facilities(name, udo_id, region, cudes)')
    .order('data_sopralluogo', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchVerbaleConRilievi(verbaleId) {
  const [{ data: verbale, error: errV }, { data: rilievi, error: errR }] = await Promise.all([
    supabase.from('verbali_ispettivi').select('*').eq('id', verbaleId).single(),
    supabase.from('verbali_rilievi').select('*').eq('verbale_id', verbaleId).order('ordine'),
  ]);
  if (errV) throw errV;
  if (errR) throw errR;
  return { verbale, rilievi: rilievi ?? [] };
}

// ── Verifica Cudes ────────────────────────────────────────────────
// Il verbale viene caricato dalla tab della struttura corrente — facility_id
// è già deciso PRIMA dell'estrazione AI (vedi createVerbaleRecord). Il cudes
// letto dal PDF serve quindi come controllo di coerenza ("hai caricato il
// verbale nella struttura giusta?"), non come ricerca cross-struttura.
export function checkCudesMatch(facility, cudesEstratto) {
  if (!cudesEstratto) return 'da_confermare';
  if (!facility?.cudes) return 'da_confermare';
  return String(facility.cudes).trim() === String(cudesEstratto).trim() ? 'auto_confermato' : 'non_trovato';
}

// ── Upload PDF ────────────────────────────────────────────────────
// Stesso pattern di HaccpFascicoloModal.jsx: bucket privato, path
// namespaced per struttura, signed URL valida 1 anno (non pubblica).
export async function uploadVerbalePdf(facilityId, file, verbaleId) {
  if (file.type !== 'application/pdf') throw new Error('Sono accettati solo file PDF.');
  if (file.size > MAX_PDF_BYTES) throw new Error(`Il file supera i ${Math.round(MAX_PDF_BYTES / 1024 / 1024)}MB.`);

  const path = `${facilityId}/verbali/${verbaleId}_${Date.now()}.pdf`;
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: 'application/pdf' });
  if (upErr) throw upErr;

  const { data: signedData, error: signErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 365); // 1 anno
  if (signErr) throw signErr;

  return { path, signedUrl: signedData.signedUrl };
}

export async function getVerbalePdfUrl(pdfStoragePath) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(pdfStoragePath, 60 * 60); // 1 ora, per apertura on-demand
  if (error) throw error;
  return data.signedUrl;
}

// ── Upload allegato generico (qualunque tipo, non solo PDF) ───────
// Usato sia in acquisizione (un documento ricevuto insieme al verbale fa
// parte della stessa pratica) sia dal pannello corrispondenza per gli
// scambi successivi. Path distinto dal verbale principale per non
// confondere "il verbale" con "un allegato del verbale".
export async function uploadAllegato(facilityId, verbaleId, file) {
  if (file.size > MAX_PDF_BYTES) throw new Error(`Il file supera i ${Math.round(MAX_PDF_BYTES / 1024 / 1024)}MB.`);

  const safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const path = `${facilityId}/verbali/${verbaleId}/allegati/${Date.now()}_${safeName}`;
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type || 'application/octet-stream' });
  if (upErr) throw upErr;

  return { path, fileName: file.name };
}

export async function getAllegatoUrl(storagePath) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

// ── Creazione record iniziale (prima dell'estrazione AI) ─────────
export async function createVerbaleRecord({ facility, uploadedBy, pdfStoragePath }) {
  const { data, error } = await supabase
    .from('verbali_ispettivi')
    .insert([{
      facility_id: facility.id,
      company_id: facility.company_id ?? null,
      pdf_storage_path: pdfStoragePath,
      pdf_uploaded_by: uploadedBy ?? null,
      stato_elaborazione_ai: 'in_coda',
    }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Salvataggio esito estrazione AI (header + rilievi) ────────────
// extraction è il JSON validato da verbaliAiExtraction.js. facility è la
// struttura su cui si è caricato il verbale (già fissata prima dell'AI) —
// serve solo per il controllo di coerenza sul cudes.
export async function saveExtractionSuccess(verbaleId, extraction, facility) {
  const matchStatus = checkCudesMatch(facility, extraction.cudes);

  const headerPatch = {
    tipo_ispezione: extraction.tipo_ispezione || 'altro',
    classificazione_originale: extraction.classificazione_originale ?? null,
    ente: extraction.ente ?? null,
    numero_verbale: extraction.numero_verbale ?? null,
    data_sopralluogo: extraction.data_sopralluogo ?? null,
    ora_sopralluogo: extraction.ora_sopralluogo ?? null,
    cudes_estratto: extraction.cudes ?? null,
    facility_match_status: matchStatus,
    stato_elaborazione_ai: 'completata',
    ai_estrazione_raw: extraction,
    ai_model_usato: 'claude-sonnet-4-6',
    ai_estratto_il: new Date().toISOString(),
    valutazione_sintetica: extraction.valutazione_sintetica ?? null,
    percentuale_indicatori: extraction.riepilogo_indicatori?.percentuale ?? null,
    totale_fascicoli_esaminati: extraction.riepilogo_indicatori?.totale_fascicoli_esaminati ?? null,
    indicatori_raggiunti: extraction.riepilogo_indicatori?.indicatori_raggiunti ?? null,
    indicatori_non_raggiunti: extraction.riepilogo_indicatori?.indicatori_non_raggiunti ?? null,
    indicatori_non_pertinenti: extraction.riepilogo_indicatori?.indicatori_non_pertinenti ?? null,
    osservazioni_raw: extraction.osservazioni_raw ?? null,
    checklist_grezza: extraction.checklist_grezza ?? null,
    documentazione_richiesta: extraction.documentazione_richiesta ?? null,
    scadenza_risposta: extraction.scadenza_risposta ?? null,
    indirizzo_invio_risposta: extraction.indirizzo_invio_risposta ?? null,
    oggetto_pec_suggerito: extraction.oggetto_pec_suggerito ?? null,
    responsabile_istruttoria_nome: extraction.responsabile_istruttoria?.nome ?? null,
    responsabile_istruttoria_tel: extraction.responsabile_istruttoria?.telefono ?? null,
    responsabile_istruttoria_email: extraction.responsabile_istruttoria?.email ?? null,
    stato_revisione: 'in_revisione',
    stato_risposta: extraction.scadenza_risposta ? 'bozza_predisposta' : 'non_richiesta',
    bozza_risposta_ai: extraction.bozza_risposta_suggerita ?? null,
    updated_at: new Date().toISOString(),
  };

  const { error: updErr } = await supabase.from('verbali_ispettivi').update(headerPatch).eq('id', verbaleId);
  if (updErr) throw updErr;

  const rilievi = (extraction.rilievi ?? []).map((r, i) => ({
    verbale_id: verbaleId,
    ordine: i,
    tipo: r.tipo || 'osservazione',
    area_tematica: r.area_tematica ?? null,
    riferimento_fasas: r.riferimento_fasas ?? null,
    riferimento_indicatore: r.riferimento_indicatore ?? null,
    descrizione: r.descrizione,
    gravita_suggerita: r.gravita_suggerita ?? null,
    stato_revisione: 'proposto_ai',
    // Le osservazioni "soft" (senza contenuto prescrittivo) partono
    // deselezionate di default — il Direttore le attiva se le ritiene
    // rilevanti, invece di doverle scartare una per una.
    escluso_da_nc: r.tipo === 'osservazione',
  }));

  if (rilievi.length) {
    const { error: insErr } = await supabase.from('verbali_rilievi').insert(rilievi);
    if (insErr) throw insErr;
  }

  return { matchStatus };
}

export async function saveExtractionError(verbaleId, errorMessage, rawText) {
  await supabase.from('verbali_ispettivi').update({
    stato_elaborazione_ai: 'errore',
    ai_errore_dettaglio: errorMessage,
    ai_estrazione_raw: rawText ? { _raw_non_json: rawText } : null,
    updated_at: new Date().toISOString(),
  }).eq('id', verbaleId);
}

// ── Aggiornamenti da schermata di revisione ───────────────────────
export async function updateVerbaleHeader(verbaleId, patch) {
  const { error } = await supabase.from('verbali_ispettivi')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', verbaleId);
  if (error) throw error;
}

export async function updateRilievo(rilievoId, patch) {
  const { error } = await supabase.from('verbali_rilievi')
    .update({ ...patch, stato_revisione: 'modificato', updated_at: new Date().toISOString() })
    .eq('id', rilievoId);
  if (error) throw error;
}

export async function deleteRilievo(rilievoId) {
  const { error } = await supabase.from('verbali_rilievi').delete().eq('id', rilievoId);
  if (error) throw error;
}

// ── Conferma: genera le Non Conformità collegate ──────────────────
// Un solo rilievo -> una sola NC (la decisione di "raggruppare" avviene a
// monte, nel prompt AI e nell'editing del Direttore prima di questo punto
// — qui ogni riga verbali_rilievi non esclusa diventa esattamente una NC).
export async function confermaVerbaleEGeneraNc({ verbale, rilievi, facility, profile }) {
  const anno = verbale.data_sopralluogo
    ? new Date(verbale.data_sopralluogo).getFullYear()
    : new Date().getFullYear();

  const daGenerare = rilievi.filter(r => !r.escluso_da_nc && !r.non_conformity_id);

  for (const rilievo of daGenerare) {
    const ncPayload = {
      facility_id: facility.id,
      company_id: facility.company_id ?? null,
      year: anno,
      opened_by: profile?.id ?? null,
      opened_by_role: profile?.role || 'director',
      stato: 'Aperto',
      titolo: `Verbale N. ${verbale.numero_verbale || '?'} — ${rilievo.area_tematica || rilievo.tipo}`,
      data_ricezione: verbale.data_sopralluogo || null,
      classificazione: 'Verbale Ente Vigilanza',
      segnalazione_da: 'Ente di vigilanza / Autorità',
      gravita: rilievo.gravita_suggerita || 'Media',
      analisi_dinamica: rilievo.descrizione,
      note: `Generata da Verbale N. ${verbale.numero_verbale || '?'} del ${verbale.data_sopralluogo || '—'} (${verbale.ente || 'ente esterno'}).`,
      verbale_id: verbale.id,
      verbale_rilievo_id: rilievo.id,
    };
    const { data: nc, error: ncErr } = await supabase.from('non_conformities').insert([ncPayload]).select().single();
    if (ncErr) throw ncErr;

    const { error: rErr } = await supabase.from('verbali_rilievi')
      .update({ non_conformity_id: nc.id, stato_revisione: 'confermato' })
      .eq('id', rilievo.id);
    if (rErr) throw rErr;
  }

  // Anche i rilievi esclusi vengono marcati come "confermato" (decisione
  // presa dal Direttore), non lasciati per sempre "proposto_ai".
  const esclusi = rilievi.filter(r => r.escluso_da_nc && r.stato_revisione !== 'scartato');
  if (esclusi.length) {
    await supabase.from('verbali_rilievi')
      .update({ stato_revisione: 'confermato' })
      .in('id', esclusi.map(r => r.id));
  }

  await supabase.from('verbali_ispettivi').update({
    stato_revisione: 'confermato',
    confermato_da: profile?.id ?? null,
    confermato_il: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', verbale.id);

  return { nCreate: daGenerare.length };
}

// ── Corrispondenza successiva (proroghe, integrazioni, esito procedimento) ─
// Non sostituisce data_riscontro_segnalante sulla NC (la prima risposta
// resta lì) — questa tabella copre gli scambi SUCCESSIVI con l'ente.
export async function fetchCorrispondenza(verbaleId) {
  const { data, error } = await supabase
    .from('verbali_corrispondenza')
    .select('*')
    .eq('verbale_id', verbaleId)
    .order('data', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function addCorrispondenza({ verbaleId, tipo, direzione, data, oggetto, testo, protocollo, allegatoStoragePath, createdBy }) {
  const { data: row, error } = await supabase
    .from('verbali_corrispondenza')
    .insert([{
      verbale_id: verbaleId, tipo, direzione, data,
      oggetto: oggetto || null, testo: testo || null, protocollo: protocollo || null,
      allegato_storage_path: allegatoStoragePath || null,
      created_by: createdBy ?? null,
    }])
    .select()
    .single();
  if (error) throw error;
  return row;
}

export async function deleteCorrispondenza(id) {
  const { error } = await supabase.from('verbali_corrispondenza').delete().eq('id', id);
  if (error) throw error;
}

// Registra l'allegato acquisito insieme al verbale (stessa pratica) come
// prima voce della corrispondenza — coerente col resto della timeline
// invece di essere un campo separato senza storia.
export async function addAllegatoAcquisizione({ verbaleId, storagePath, fileName, createdBy }) {
  return addCorrispondenza({
    verbaleId,
    tipo: 'integrazione',
    direzione: 'in_entrata',
    data: new Date().toISOString().slice(0, 10),
    oggetto: `Allegato acquisito con il verbale: ${fileName}`,
    allegatoStoragePath: storagePath,
    createdBy,
  });
}

// ── Gestione risposta ──────────────────────────────────────────────
export async function segnaRispostaInviata({ verbale, testoInviato, createdBy }) {
  const oggi = new Date().toISOString().slice(0, 10);
  await supabase.from('verbali_ispettivi').update({
    stato_risposta: 'inviata',
    data_risposta_inviata: oggi,
    updated_at: new Date().toISOString(),
  }).eq('id', verbale.id);

  await addCorrispondenza({
    verbaleId: verbale.id,
    tipo: 'risposta_iniziale',
    direzione: 'in_uscita',
    data: oggi,
    oggetto: `Risposta a Verbale N. ${verbale.numero_verbale || '?'}`,
    testo: testoInviato || null,
    createdBy,
  });
}

// ── Notifica admin al caricamento ──────────────────────────────────
// Stesso pattern di inviaAQualita() in documentiService.js: una riga
// notifications per ogni admin/superadmin, best-effort (un fallimento
// nell'invio della notifica non deve mai far fallire l'upload).
export async function notificaVerbaleCaricato({ facilityName }) {
  const { data: admins } = await supabase
    .from('user_profiles')
    .select('id')
    .in('role', ['admin', 'superadmin']);

  for (const admin of admins ?? []) {
    await createNotifica(
      admin.id,
      'verbale_ispettivo_caricato',
      'Nuovo verbale ispettivo caricato',
      `${facilityName} ha caricato un nuovo verbale ispettivo, in attesa di analisi AI.`,
      '/verbali-ispettivi'
    ).catch(() => {});
  }
}
