// src/services/documentiService.js
import { supabase }         from '../supabaseClient';
import PizZip               from 'pizzip';
import { createNotifica }   from './notificheService';

// ─── doc_master ───────────────────────────────────────────────

export async function getDocMaster(filters = {}) {
  let q = supabase
    .from('doc_master')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters.categoria) q = q.eq('categoria', filters.categoria);
  if (filters.stato)     q = q.eq('stato',     filters.stato);

  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function createDocMaster(docData) {
  const { data, error } = await supabase
    .from('doc_master')
    .insert([docData])
    .select()
    .single();
  if (error) throw error;
  await logAzione(data.id, 'creazione', {
    titolo:    data.titolo,
    codice:    data.codice_documento,
    categoria: data.categoria,
    revisione: data.revisione_corrente,
  }, docData.creato_da ?? null);
  return data;
}

export async function updateDocMaster(id, datiNuovi, userId, vecchiDati) {
  const { data, error } = await supabase
    .from('doc_master')
    .update({
      ...datiNuovi,
      modificato_il: new Date().toISOString(),
      modificato_da: userId ?? null,
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;

  const fileChanged = vecchiDati &&
    datiNuovi.file_url_master !== undefined &&
    datiNuovi.file_url_master !== vecchiDati.file_url_master;
  const azione = fileChanged ? 'modifica_file' : 'modifica_metadati';

  const modifiche = [];
  if (vecchiDati) {
    for (const campo of Object.keys(datiNuovi)) {
      if (datiNuovi[campo] !== vecchiDati[campo]) {
        modifiche.push({ campo, da: vecchiDati[campo], a: datiNuovi[campo] });
      }
    }
  }
  await logAzione(id, azione, { modifiche }, userId ?? null);
  return data;
}

// ─── storage ──────────────────────────────────────────────────

export async function uploadMasterFile(file, codice) {
  const ext      = file.name.split('.').pop();
  const filename = `${codice}_${Date.now()}.${ext}`;
  const path     = `master/${filename}`;

  const { error } = await supabase.storage
    .from('documenti-master')
    .upload(path, file, { upsert: false });
  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from('documenti-master')
    .getPublicUrl(path);

  return { path, publicUrl: urlData.publicUrl };
}

export async function getMasterFileUrl(filePath) {
  const { data } = supabase.storage
    .from('documenti-master')
    .getPublicUrl(filePath);
  return data?.publicUrl ?? null;
}

// ─── doc_istanze ──────────────────────────────────────────────

export async function getDocIstanze(facilityId) {
  const { data, error } = await supabase
    .from('doc_istanze')
    .select('*, doc_master(*)')
    .eq('facility_id', facilityId)
    .order('generato_il', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function generateIstanza(masterId, facilityId, userId) {
  const { data, error } = await supabase
    .from('doc_istanze')
    .insert([{
      master_id:   masterId,
      facility_id: facilityId,
      generato_da: userId,
      generato_il: new Date().toISOString(),
      accesso_count: 0,
    }])
    .select()
    .single();
  if (error) throw error;
  const master = await getDocMasterById(masterId).catch(() => null);
  await logAzione(masterId, 'distribuzione', {
    facility_id: facilityId,
    revisione:   master?.revisione_corrente ?? null,
  }, userId);
  return data;
}

// ─── log accesso ──────────────────────────────────────────────

export async function logAccesso(istanzaId) {
  const now = new Date().toISOString();

  // Leggo prima per sapere se è il primo accesso
  const { data: existing } = await supabase
    .from('doc_istanze')
    .select('accesso_count, primo_accesso_il, facility_id, master_id, facilities(user_id)')
    .eq('id', istanzaId)
    .single();

  const updates = {
    accesso_count: (existing?.accesso_count ?? 0) + 1,
    ultimo_accesso_il: now,
  };
  if (!existing?.primo_accesso_il) updates.primo_accesso_il = now;

  const { data, error } = await supabase
    .from('doc_istanze')
    .update(updates)
    .eq('id', istanzaId)
    .select()
    .single();
  if (error) throw error;

  await logAzione(
    existing?.master_id ?? null,
    'accesso_download',
    { facility_id: existing?.facility_id ?? null, istanza_id: istanzaId },
    existing?.facilities?.user_id ?? null,
  );
  return data;
}

// ─── placeholder extraction ───────────────────────────────────

export async function extractPlaceholders(fileBuffer) {
  const zip = new PizZip(fileBuffer);

  // Legge document.xml (body principale del .docx)
  const documentXml = zip.files['word/document.xml']?.asText() ?? '';
  const headerXmls  = Object.keys(zip.files)
    .filter(k => k.startsWith('word/header') && k.endsWith('.xml'))
    .map(k => zip.files[k].asText());
  const footerXmls  = Object.keys(zip.files)
    .filter(k => k.startsWith('word/footer') && k.endsWith('.xml'))
    .map(k => zip.files[k].asText());

  const allText = [documentXml, ...headerXmls, ...footerXmls].join('');

  // Rimuove i tag XML interni ai placeholder (Word spezza spesso i run)
  const stripped = allText.replace(/<[^>]+>/g, '');

  const matches = stripped.match(/\{\{([^}]+)\}\}/g) ?? [];
  const unique  = [...new Set(matches.map(m => m.slice(2, -2).trim()))];
  return unique;
}

// ─── aggiunte Session 2 ───────────────────────────────────────

export async function getDocMasterById(id) {
  const { data, error } = await supabase
    .from('doc_master')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function getFacilitiesForDistribution(masterUdoList = []) {
  const { data, error } = await supabase
    .from('facilities')
    .select(`
      id, name, address, region, company_id,
      director, director_sanitario,
      email_direzione, bed_count, udo_id, is_suspended,
      companies(name),
      udos(id, name)
    `)
    .eq('is_suspended', false)
    .order('name');
  if (error) throw error;

  const mapped = (data ?? []).map(f => ({
    ...f,
    ragione_sociale: f.companies?.name ?? '',
    udo_tipo:        f.udos?.name ?? '',
  }));

  if (!masterUdoList || masterUdoList.length === 0) return mapped;

  return mapped.filter(f => {
    if (!f.udo_tipo) return false;
    return masterUdoList.some(u =>
      f.udo_tipo.toUpperCase().includes(u.toUpperCase()) ||
      u.toUpperCase() === f.udo_tipo.toUpperCase()
    );
  });
}

export async function generateIstanzaMassiva(masterId, facilityIds, userId) {
  const results = [];
  for (const facilityId of facilityIds) {
    try {
      await generateIstanza(masterId, facilityId, userId);
      results.push({ facilityId, success: true });
    } catch (err) {
      results.push({ facilityId, success: false, error: err.message });
    }
  }
  return results;
}

export async function getDistribuzioneStatus(masterId) {
  const { data, error } = await supabase
    .from('doc_istanze')
    .select(`
      id, facility_id, master_id, generato_il,
      accesso_count, primo_accesso_il, ultimo_accesso_il, stato,
      file_path_compilato,
      facilities(name, company_id, companies(name))
    `)
    .eq('master_id', masterId)
    .order('generato_il', { ascending: false });
  if (error) throw error;

  return (data ?? []).map(i => ({
    ...i,
    facility_name:   i.facilities?.name ?? '',
    ragione_sociale: i.facilities?.companies?.name ?? '',
  }));
}

export async function downloadMasterFile(filePath) {
  const { data, error } = await supabase.storage
    .from('documenti-master')
    .download(filePath);
  if (error) throw error;
  return data.arrayBuffer();
}

export async function uploadCompiledIstanza(masterId, facilityId, revisione, blob) {
  const rev  = revisione ?? '1';
  const path = `compilati/${masterId}/${facilityId}/Rev_${rev}.docx`;
  const { error } = await supabase.storage
    .from('documenti-master')
    .upload(path, blob, {
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      upsert: true,
    });
  if (error) throw error;
  return path;
}

function formatDateIT(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('it-IT'); } catch { return iso; }
}

function formatMeseAnno(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }); } catch { return iso; }
}

function fixSplitTags(zip) {
  const filesToFix = [
    'word/document.xml',
    'word/header1.xml', 'word/header2.xml', 'word/header3.xml',
    'word/footer1.xml', 'word/footer2.xml', 'word/footer3.xml',
  ];

  filesToFix.forEach(filename => {
    try {
      const content = zip.files[filename];
      if (!content) return;

      let xml = content.asText();

      // Unisci runs adiacenti che contengono parti di tag {{...}}
      xml = xml.replace(
        /\{\{([^}]*?)<\/w:t>(?:<\/w:r>)?(?:<w:r[^>]*>)?(?:<w:rPr[^>]*>.*?<\/w:rPr>)?(?:<w:t[^>]*>)([^}]*?)\}\}/gs,
        '{{$1$2}}'
      );

      // Secondo passaggio: gestisce splits multipli
      xml = xml.replace(
        /\{\{([^{}]*)<\/w:t>[\s\S]*?<w:t[^>]*>([^{}]*)\}\}/g,
        '{{$1$2}}'
      );

      zip.file(filename, xml);
    } catch (e) {
      // file non presente, ignora
    }
  });

  return zip;
}

export async function compileDocumento(masterFileBuffer, facilityData, masterData = {}, storicoRevisioni = []) {
  const [{ default: Docxtemplater }, { default: PizZipLib }] = await Promise.all([
    import('docxtemplater'),
    import('pizzip'),
  ]);

  const zip = new PizZipLib(masterFileBuffer);
  fixSplitTags(zip);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks:    true,
    nullGetter:    () => '',
    delimiters:    { start: '{{', end: '}}' },
  });

  try {
    doc.render({
      nome_struttura:      facilityData.name             ?? '',
      ragione_sociale:     facilityData.ragione_sociale  ?? '',
      indirizzo:           facilityData.address          ?? '',
      regione:             facilityData.region           ?? '',
      udo_tipo:            facilityData.udo_tipo         ?? '',
      direttore:           facilityData.director         || '_______________',
      direttore_sanitario: facilityData.director_sanitario || '_______________',
      email_direzione:     facilityData.email_direzione  ?? '',
      posti_letto:         facilityData.bed_count?.toString() ?? '',
      revisione:           masterData.revisione_corrente ?? '',
      codice_documento:    masterData.codice_documento   ?? '',
      data_approvazione:   formatDateIT(masterData.data_approvazione),
      data_scadenza:       formatDateIT(masterData.data_scadenza),
      approvato_da:        masterData.approvato_da        ?? '',
      tipologia_documento: masterData.tipologia_documento ?? '',
      elaborata_da:        masterData.elaborata_da        ?? '',
      verificata_da:       masterData.verificata_da       ?? '',
      validata_da:         masterData.approvato_da        ?? '',
      data_adozione:       formatDateIT(masterData.data_approvazione),
      mese_anno_approvazione: formatMeseAnno(masterData.data_approvazione),
      mese_anno_scadenza:  formatMeseAnno(masterData.data_scadenza),
      citta:               facilityData.citta ?? facilityData.address?.split(',')[0] ?? '',
      storico_rev_1_revisione:         storicoRevisioni[0]?.revisione         ?? '',
      storico_rev_1_data_approvazione: storicoRevisioni[0]?.data_approvazione ?? '',
      storico_rev_1_note:              storicoRevisioni[0]?.note              ?? '',
      storico_rev_2_revisione:         storicoRevisioni[1]?.revisione         ?? '',
      storico_rev_2_data_approvazione: storicoRevisioni[1]?.data_approvazione ?? '',
      storico_rev_2_note:              storicoRevisioni[1]?.note              ?? '',
      storico_rev_3_revisione:         storicoRevisioni[2]?.revisione         ?? '',
      storico_rev_3_data_approvazione: storicoRevisioni[2]?.data_approvazione ?? '',
      storico_rev_3_note:              storicoRevisioni[2]?.note              ?? '',
    });
  } catch (error) {
    if (error.properties && error.properties.errors) {
      error.properties.errors.forEach(err => {
        console.error(
          'Placeholder problematico:', err.properties?.id,
          '| Messaggio:', err.message,
          '| Dettaglio:', JSON.stringify(err.properties)
        );
      });
    }
    throw error;
  }

  return doc.getZip().generate({
    type:     'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

// ─── revisioni ────────────────────────────────────────────────

export async function getDocMasterRevisioni(masterId) {
  const { data, error } = await supabase
    .from('doc_master_revisioni')
    .select('*')
    .eq('master_id', masterId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getStoricoRevisioni3(masterId) {
  const { data, error } = await supabase
    .from('doc_master_revisioni')
    .select('dati_vecchi, note_revisione, created_at')
    .eq('master_id', masterId)
    .order('created_at', { ascending: false })
    .limit(3);
  if (error) throw error;
  return (data ?? []).map(r => ({
    revisione:         r.dati_vecchi?.revisione_corrente ?? '',
    data_approvazione: formatDateIT(r.dati_vecchi?.data_approvazione),
    note:              r.note_revisione ?? '',
  }));
}

export async function creaNuovaRevisione(masterId, datiNuovi, noteRevisione, userId) {
  try {
    const masterCorrente = await getDocMasterById(masterId);

    const { error: revError } = await supabase
      .from('doc_master_revisioni')
      .insert([{
        master_id:      masterId,
        dati_vecchi:    masterCorrente,
        note_revisione: noteRevisione,
        creato_da:      userId,
      }]);
    if (revError) throw revError;

    const { error: masterError } = await supabase
      .from('doc_master')
      .update({ ...datiNuovi, note_ultima_revisione: noteRevisione })
      .eq('id', masterId);
    if (masterError) throw masterError;

    await logAzione(masterId, 'nuova_revisione', {
      da:   masterCorrente.revisione_corrente,
      a:    datiNuovi.revisione_corrente,
      note: noteRevisione,
    }, userId);

    const { error: istanzeError } = await supabase
      .from('doc_istanze')
      .update({ stato: 'aggiornare' })
      .eq('master_id', masterId)
      .eq('stato', 'disponibile');
    if (istanzeError) throw istanzeError;

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function getDocumentiInScadenza(giorniSoglia = 90) {
  const now       = new Date().toISOString();
  const threshold = new Date(Date.now() + giorniSoglia * 86400000).toISOString();

  const { data, error } = await supabase
    .from('doc_master')
    .select('*')
    .eq('stato', 'approvato')
    .not('data_scadenza', 'is', null)
    .lte('data_scadenza', threshold)
    .order('data_scadenza', { ascending: true });
  if (error) throw error;

  const docs    = data ?? [];
  const scaduti = docs.filter(d => d.data_scadenza < now).length;
  return { docs, scaduti };
}

// ─── audit log ───────────────────────────────────────────────

export async function logAzione(masterId, azione, dettaglio, userId) {
  const { error } = await supabase
    .from('doc_audit_log')
    .insert([{
      master_id:   masterId,
      azione,
      dettaglio,
      eseguito_da: userId ?? null,
      eseguito_il: new Date().toISOString(),
    }]);
  if (error) console.error('logAzione error:', error);
}

export async function getAuditLog(masterId) {
  const { data, error } = await supabase
    .from('doc_audit_log')
    .select(`
      id, azione, dettaglio, eseguito_il,
      user_profiles!eseguito_da(email)
    `)
    .eq('master_id', masterId)
    .order('eseguito_il', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(r => ({
    id:           r.id,
    azione:       r.azione,
    dettaglio:    r.dettaglio,
    eseguito_il:  r.eseguito_il,
    utente_email: r.user_profiles?.email ?? '',
  }));
}

export async function setObsoleto(masterId, userId) {
  const master = await getDocMasterById(masterId);
  const { error } = await supabase
    .from('doc_master')
    .update({ stato: 'obsoleto' })
    .eq('id', masterId);
  if (error) throw error;
  await logAzione(masterId, 'obsoleto', {
    titolo:    master.titolo,
    revisione: master.revisione_corrente,
  }, userId);
}

// ─── doc_struttura ────────────────────────────────────────────

async function logAzioneStruttura(strutturaDocId, azione, dettaglio, userId) {
  const { error } = await supabase
    .from('doc_audit_log')
    .insert([{
      struttura_doc_id: strutturaDocId,
      master_id:        null,
      azione,
      dettaglio,
      eseguito_da:      userId ?? null,
      eseguito_il:      new Date().toISOString(),
    }]);
  if (error) console.error('logAzioneStruttura error:', error);
}

export async function getDocStruttura(facilityId) {
  const { data, error } = await supabase
    .from('doc_struttura')
    .select('*')
    .eq('facility_id', facilityId)
    .neq('stato', 'obsoleto')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getDocStrutturaById(id) {
  const { data, error } = await supabase
    .from('doc_struttura')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function createDocStruttura(docData, userId) {
  const payload = {
    facility_id:       docData.facility_id,
    titolo:            docData.titolo,
    codice:            docData.codice,
    categoria:         docData.categoria,
    revisione:         docData.revisione,
    note_revisione:    docData.note_revisione,
    elaborata_da:      docData.elaborata_da,
    verificata_da:     docData.verificata_da,
    approvato_da:      docData.approvato_da,
    data_approvazione: docData.data_approvazione,
    data_scadenza:     docData.data_scadenza,
    file_url:          docData.file_url,
    stato:             docData.stato,
    creato_da:         userId,
    updated_by:        userId,
  };
  const { data, error } = await supabase
    .from('doc_struttura')
    .insert([payload])
    .select()
    .single();
  if (error) throw error;
  await logAzioneStruttura(data.id, 'creazione', {
    titolo:    data.titolo,
    codice:    data.codice,
    categoria: data.categoria,
  }, userId);
  return data;
}

export async function updateDocStruttura(id, datiNuovi, userId, vecchiDati) {
  const { data, error } = await supabase
    .from('doc_struttura')
    .update({ ...datiNuovi, updated_by: userId, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;

  const fileChanged = vecchiDati &&
    datiNuovi.file_url !== undefined &&
    datiNuovi.file_url !== vecchiDati.file_url;
  const azione = fileChanged ? 'modifica_file' : 'modifica_metadati';

  const modifiche = [];
  if (vecchiDati) {
    for (const campo of Object.keys(datiNuovi)) {
      if (datiNuovi[campo] !== vecchiDati[campo]) {
        modifiche.push({ campo, da: vecchiDati[campo], a: datiNuovi[campo] });
      }
    }
  }
  await logAzioneStruttura(id, azione, { modifiche }, userId);
  return data;
}

export async function inviaAQualita(id, userId) {
  const { data: doc, error: fetchError } = await supabase
    .from('doc_struttura')
    .select('titolo')
    .eq('id', id)
    .single();
  if (fetchError) throw fetchError;

  const { error } = await supabase
    .from('doc_struttura')
    .update({ stato: 'inviato_qualita' })
    .eq('id', id);
  if (error) throw error;

  await logAzioneStruttura(id, 'inviato_qualita', { id }, userId);

  const { data: admins } = await supabase
    .from('user_profiles')
    .select('id')
    .in('role', ['admin', 'superadmin']);

  for (const admin of admins ?? []) {
    await createNotifica(
      admin.id,
      'doc_struttura_revisione',
      'Documento struttura da verificare',
      `La struttura ha inviato un documento per verifica qualità: ${doc.titolo}`,
      '/documenti'
    ).catch(() => {});
  }
}

export async function verificaQualita(id, nomeVerificatore, userId) {
  const { data: doc, error: fetchError } = await supabase
    .from('doc_struttura')
    .select('titolo, facility_id')
    .eq('id', id)
    .single();
  if (fetchError) throw fetchError;

  const { error } = await supabase
    .from('doc_struttura')
    .update({
      flag_qualita_ok:       true,
      verificato_da_qualita: nomeVerificatore,
      data_verifica_qualita: new Date().toISOString().split('T')[0],
      stato:                 'approvato',
    })
    .eq('id', id);
  if (error) throw error;

  await logAzioneStruttura(id, 'verifica_qualita', { verificato_da: nomeVerificatore }, userId);

  const { data: facilityUsers } = await supabase
    .from('user_facility_access')
    .select('user_id')
    .eq('facility_id', doc.facility_id);

  for (const u of facilityUsers ?? []) {
    await createNotifica(
      u.user_id,
      'doc_struttura_approvato',
      'Documento approvato dalla Qualità',
      `Il documento ${doc.titolo} è stato verificato e approvato.`,
      '/documenti'
    ).catch(() => {});
  }
}

export async function setDocStrutturaObsoleto(id, userId) {
  const { error } = await supabase
    .from('doc_struttura')
    .update({ stato: 'obsoleto' })
    .eq('id', id);
  if (error) throw error;
  await logAzioneStruttura(id, 'obsoleto', {}, userId);
}

export async function uploadDocStruttura(file, facilityId, codice) {
  const ext      = file.name.split('.').pop();
  const filename = `${codice}_${Date.now()}.${ext}`;
  const path     = `strutture/${facilityId}/${filename}`;

  const { error } = await supabase.storage
    .from('documenti-master')
    .upload(path, file, { upsert: false });
  if (error) return { url: null, error };

  const { data: urlData } = supabase.storage
    .from('documenti-master')
    .getPublicUrl(path);

  return { url: urlData.publicUrl, error: null };
}

export async function getDocStrutturaInRevisione() {
  const { data, error } = await supabase
    .from('doc_struttura')
    .select('*, facilities(id, name)')
    .eq('stato', 'inviato_qualita')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
