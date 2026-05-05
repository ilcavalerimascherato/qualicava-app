// src/components/DocStrutturaProprioModal.jsx
import React, { useState, useRef, useCallback } from 'react';
import {
  X, FileText, Upload, Loader2, CheckCircle2,
  Tag, Calendar, ChevronDown, Send, Download,
  Pencil, Shield,
} from 'lucide-react';
import { useAuth }    from '../contexts/AuthContext';
import { supabase }   from '../supabaseClient';
import {
  createDocStruttura,
  updateDocStruttura,
  inviaAQualita,
  verificaQualita,
  uploadDocStruttura,
} from '../services/documentiService';

// ─── costanti ─────────────────────────────────────────────────

const CATEGORIE = [
  { id: 'PCA', label: 'Protocolli Clinico Assistenziali' },
  { id: 'CDS', label: 'Carta dei Servizi e Regolamento'  },
  { id: 'SSL', label: 'Sicurezza sui Luoghi di Lavoro'   },
  { id: 'ALI', label: 'Alimentazione e Nutrizione'       },
  { id: 'RDD', label: 'Riesame della Direzione'          },
  { id: 'QUA', label: 'Qualità e SGQ'                    },
  { id: 'IST', label: 'Istruzioni Operative'             },
];

const STATO_BADGE = {
  bozza:           { label: 'Bozza',                cls: 'bg-slate-200 text-slate-700'    },
  inviato_qualita: { label: 'In revisione Qualità', cls: 'bg-amber-100 text-amber-700'    },
  approvato:       { label: 'Approvato',            cls: 'bg-emerald-100 text-emerald-700' },
  obsoleto:        { label: 'Obsoleto',             cls: 'bg-red-100 text-red-700'         },
};

const defaultScadenza = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 3);
  return d.toISOString().split('T')[0];
};
const today = () => new Date().toISOString().split('T')[0];

const INITIAL_FORM = {
  titolo:             '',
  codice:             '',
  categoria:          '',
  elaborata_da:       '',
  verificata_da:      '',
  approvato_da:       '',
  revisione_corrente: 'Rev. 0',
  data_approvazione:  today(),
  data_scadenza:      defaultScadenza(),
  note_revisione:     '',
};

function formFromDoc(d) {
  return {
    titolo:             d.titolo             ?? '',
    codice:             d.codice             ?? '',
    categoria:          d.categoria          ?? '',
    elaborata_da:       d.elaborata_da       ?? '',
    verificata_da:      d.verificata_da      ?? '',
    approvato_da:       d.approvato_da       ?? '',
    revisione_corrente: d.revisione_corrente ?? 'Rev. 0',
    data_approvazione:  d.data_approvazione ? d.data_approvazione.split('T')[0] : today(),
    data_scadenza:      d.data_scadenza     ? d.data_scadenza.split('T')[0]     : defaultScadenza(),
    note_revisione:     d.note_revisione     ?? '',
  };
}

// ─── componente ───────────────────────────────────────────────

export default function DocStrutturaProprioModal({
  facilityId,
  docEsistente = null,
  onClose,
  onSaved,
  readOnly = false,
}) {
  const { profile } = useAuth();
  const isEdit = !!docEsistente;
  const stato  = docEsistente?.stato ?? 'bozza';

  const [form,          setForm]          = useState(isEdit ? formFromDoc(docEsistente) : INITIAL_FORM);
  const [file,          setFile]          = useState(null);
  const [isDragging,    setIsDragging]    = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [sending,       setSending]       = useState(false);
  const [errors,        setErrors]        = useState({});
  const [fileError,     setFileError]     = useState('');
  const [nomeVerif,     setNomeVerif]     = useState('');
  const [approvando,    setApprovando]    = useState(false);
  const [erroreApprova, setErroreApprova] = useState('');

  const fileRef = useRef(null);

  const setField = useCallback((key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: '' }));
  }, []);

  const handleFileChange = useCallback((e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.endsWith('.docx')) { setFileError('Solo file .docx supportati'); return; }
    setFileError('');
    setFile(f);
  }, []);

  const handleDragOver  = useCallback((e) => { e.preventDefault(); setIsDragging(true);  }, []);
  const handleDragLeave = useCallback((e) => { e.preventDefault(); setIsDragging(false); }, []);
  const handleDrop      = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFileChange({ target: { files: [f] } });
  }, [handleFileChange]);

  const validate = () => {
    const errs = {};
    if (!form.titolo.trim())       errs.titolo       = 'Campo obbligatorio';
    if (!form.elaborata_da.trim()) errs.elaborata_da = 'Campo obbligatorio';
    return errs;
  };

  const salvaDoc = async (nuovoStato) => {
    let fileUrl = docEsistente?.file_url ?? null;
    if (file) {
      const codicePerPath = form.codice || 'doc';
      const { url, error: uploadErr } = await uploadDocStruttura(file, facilityId, codicePerPath);
      if (uploadErr) throw new Error(uploadErr.message ?? 'Upload fallito');
      fileUrl = url;
    }
    const datiDoc = {
      ...form,
      facility_id: facilityId,
      file_url:    fileUrl,
      stato:       nuovoStato ?? stato,
    };
    if (isEdit) {
      return updateDocStruttura(docEsistente.id, datiDoc, profile?.id, docEsistente);
    } else {
      return createDocStruttura(datiDoc, profile?.id);
    }
  };

  const handleSalvaBozza = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      await salvaDoc('bozza');
      onSaved?.();
    } catch (err) {
      setErrors({ submit: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleInviaQualita = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSending(true);
    try {
      let docId = docEsistente?.id;
      if (!isEdit || stato === 'bozza') {
        const saved = await salvaDoc('bozza');
        docId = saved.id;
      }
      await inviaAQualita(docId, profile?.id);
      onSaved?.();
    } catch (err) {
      setErrors({ submit: err.message });
    } finally {
      setSending(false);
    }
  };

  const handleApprovazione = async () => {
    if (!nomeVerif.trim()) { setErroreApprova('Inserisci il nome del verificatore'); return; }
    setApprovando(true);
    setErroreApprova('');
    try {
      await verificaQualita(docEsistente.id, nomeVerif, profile?.id);
      onSaved?.();
    } catch (err) {
      setErroreApprova(err.message);
    } finally {
      setApprovando(false);
    }
  };

  const handleDownload = async () => {
    if (!docEsistente?.file_url) return;
    const path = docEsistente.file_url.split('/documenti-master/')[1];
    const { data, error } = await supabase.storage
      .from('documenti-master')
      .createSignedUrl(path, 60);
    if (error || !data?.signedUrl) {
      alert('Errore nel download del file');
      return;
    }
    const a = document.createElement('a');
    a.href     = data.signedUrl;
    a.download = `${form.codice || 'documento'}_${form.revisione_corrente}.docx`;
    a.click();
  };

  const statoBadge = STATO_BADGE[stato] ?? STATO_BADGE.bozza;
  const canEdit    = !readOnly && stato !== 'obsoleto' && stato !== 'inviato_qualita' && stato !== 'approvato';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="bg-teal-700 px-7 py-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-500 rounded-xl text-white">
              {readOnly ? <Shield size={20} /> : isEdit ? <Pencil size={20} /> : <FileText size={20} />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-black text-white uppercase tracking-wider">
                  {readOnly ? 'Verifica documento' : isEdit ? 'Modifica documento' : 'Nuovo documento struttura'}
                </h2>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${statoBadge.cls}`}>
                  {statoBadge.label}
                </span>
              </div>
              <p className="text-[10px] text-teal-200 font-bold uppercase tracking-widest mt-0.5">
                Documento proprio della struttura
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-teal-200 hover:text-white hover:bg-teal-600 rounded-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-7 space-y-5">

          {/* RIGA 1 — Titolo */}
          <div>
            <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-1.5">
              Titolo *
            </label>
            <input
              type="text"
              value={form.titolo}
              onChange={e => setField('titolo', e.target.value)}
              disabled={!canEdit}
              placeholder="es. Procedura interna smaltimento rifiuti"
              className={`w-full rounded-xl border px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-teal-400 transition-all
                disabled:opacity-60 disabled:cursor-not-allowed
                ${errors.titolo ? 'border-rose-400 bg-rose-50' : 'border-slate-200 bg-slate-50'}`}
            />
            {errors.titolo && <p className="text-xs text-rose-500 mt-1">{errors.titolo}</p>}
          </div>

          {/* RIGA 2 — Codice | Categoria */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-1.5">
                Codice
              </label>
              <input
                type="text"
                value={form.codice}
                onChange={e => setField('codice', e.target.value.toUpperCase())}
                disabled={!canEdit}
                placeholder="es. PCA-STR-001"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold uppercase outline-none focus:ring-2 focus:ring-teal-400 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Tag size={12} /> Categoria
              </label>
              <div className="relative">
                <select
                  value={form.categoria}
                  onChange={e => setField('categoria', e.target.value)}
                  disabled={!canEdit}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium appearance-none outline-none focus:ring-2 focus:ring-teal-400 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="">— Seleziona —</option>
                  {CATEGORIE.map(c => (
                    <option key={c.id} value={c.id}>{c.id} — {c.label}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-4 top-3.5 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* RIGA 3 — Elaborata da | Verificata da */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-1.5">
                Elaborata da *
              </label>
              <input
                type="text"
                value={form.elaborata_da}
                onChange={e => setField('elaborata_da', e.target.value)}
                disabled={!canEdit}
                placeholder="Nome o ufficio"
                className={`w-full rounded-xl border px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-teal-400 transition-all disabled:opacity-60 disabled:cursor-not-allowed
                  ${errors.elaborata_da ? 'border-rose-400 bg-rose-50' : 'border-slate-200 bg-slate-50'}`}
              />
              {errors.elaborata_da && <p className="text-xs text-rose-500 mt-1">{errors.elaborata_da}</p>}
            </div>
            <div>
              <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-1.5">
                Verificata da
              </label>
              <input
                type="text"
                value={form.verificata_da}
                onChange={e => setField('verificata_da', e.target.value)}
                disabled={!canEdit}
                placeholder="Nome e cognome o ruolo"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-teal-400 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* RIGA 4 — Approvata da | Revisione */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-1.5">
                Approvata da
              </label>
              <input
                type="text"
                value={form.approvato_da}
                onChange={e => setField('approvato_da', e.target.value)}
                disabled={!canEdit}
                placeholder="Nome e cognome o ruolo"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-teal-400 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-1.5">
                Revisione
              </label>
              <input
                type="text"
                value={form.revisione_corrente}
                onChange={e => setField('revisione_corrente', e.target.value)}
                disabled={!canEdit}
                placeholder="es. Rev. 0"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-teal-400 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* RIGA 5 — Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Calendar size={12} /> Data approvazione
              </label>
              <input
                type="date"
                value={form.data_approvazione}
                onChange={e => setField('data_approvazione', e.target.value)}
                disabled={!canEdit}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-teal-400 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Calendar size={12} /> Data scadenza
              </label>
              <input
                type="date"
                value={form.data_scadenza}
                onChange={e => setField('data_scadenza', e.target.value)}
                disabled={!canEdit}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-teal-400 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* RIGA 6 — Note revisione */}
          <div>
            <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-1.5">
              Note revisione
            </label>
            <textarea
              value={form.note_revisione}
              onChange={e => setField('note_revisione', e.target.value)}
              disabled={!canEdit}
              rows={3}
              placeholder="Modifiche apportate, ambito di applicazione..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-teal-400 transition-all resize-none disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          {/* RIGA 7 — Upload file .docx */}
          <div>
            <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Upload size={12} /> File .docx
            </label>

            {docEsistente?.file_url && !file && (
              <div className="flex items-center justify-between border border-slate-200 bg-slate-50 rounded-xl px-4 py-3 mb-2">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-slate-400 shrink-0" />
                  <span className="text-sm font-bold text-slate-600 truncate max-w-[280px]">
                    {decodeURIComponent(docEsistente.file_url.split('/').pop())}
                  </span>
                </div>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-1 text-xs font-black text-teal-600 hover:text-teal-700 px-2 py-1 rounded-lg hover:bg-teal-50 transition-colors"
                >
                  <Download size={12} /> Scarica
                </button>
              </div>
            )}

            {canEdit && (
              <>
                <div
                  onClick={() => fileRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-2xl px-6 py-6 text-center cursor-pointer transition-all group
                    ${fileError   ? 'border-rose-300 bg-rose-50'
                      : file       ? 'border-emerald-300 bg-emerald-50'
                      : isDragging ? 'border-teal-400 bg-teal-50/60'
                      : 'border-slate-200 hover:border-teal-300 hover:bg-teal-50/40'}
                  `}
                >
                  {file ? (
                    <div className="flex flex-col items-center gap-1.5">
                      <CheckCircle2 size={22} className="text-emerald-500" />
                      <p className="text-sm font-bold text-emerald-700">{file.name}</p>
                      <p className="text-xs text-emerald-500">{(file.size / 1024).toFixed(0)} KB — clicca per cambiare</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1.5">
                      <Upload size={22} className="text-slate-300 group-hover:text-teal-400 transition-colors" />
                      <p className="text-sm font-bold text-slate-400 group-hover:text-teal-500 transition-colors">
                        Trascina il file .docx qui oppure clicca per selezionare
                      </p>
                    </div>
                  )}
                </div>
                <input ref={fileRef} type="file" accept=".docx" onChange={handleFileChange} className="hidden" />
                {fileError && <p className="text-xs text-rose-500 mt-1">{fileError}</p>}
              </>
            )}
          </div>

          {/* Sezione verifica Qualità — readOnly + inviato_qualita */}
          {readOnly && stato === 'inviato_qualita' && (
            <div className="bg-teal-50 border border-teal-200 rounded-2xl p-5">
              <p className="text-xs font-black text-teal-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Shield size={13} /> Verifica Qualità
              </p>
              <div>
                <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-1.5">
                  Verificato da *
                </label>
                <input
                  type="text"
                  value={nomeVerif}
                  onChange={e => { setNomeVerif(e.target.value); setErroreApprova(''); }}
                  placeholder="Nome e cognome del verificatore"
                  className="w-full rounded-xl border border-teal-200 bg-white px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-teal-400 transition-all"
                />
                {erroreApprova && <p className="text-xs text-rose-500 mt-1">{erroreApprova}</p>}
              </div>
            </div>
          )}

          {errors.submit && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm font-bold px-4 py-3 rounded-xl">
              {errors.submit}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-7 py-4 flex items-center justify-between shrink-0 bg-slate-50">

          {readOnly ? (
            <>
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl text-sm font-black uppercase text-slate-500 hover:bg-slate-200 transition-colors"
              >
                Chiudi
              </button>
              {stato === 'inviato_qualita' && (
                <button
                  onClick={handleApprovazione}
                  disabled={approvando}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black uppercase bg-teal-600 text-white shadow hover:bg-teal-700 transition-colors disabled:opacity-50"
                >
                  {approvando
                    ? <><Loader2 size={15} className="animate-spin" /> Approvazione…</>
                    : <><CheckCircle2 size={15} /> Approva documento</>
                  }
                </button>
              )}
            </>

          ) : stato === 'inviato_qualita' ? (
            <>
              <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-black uppercase text-slate-500 hover:bg-slate-200 transition-colors">
                Chiudi
              </button>
              <span className="text-xs font-black text-amber-600 flex items-center gap-1.5">
                <Loader2 size={13} className="animate-spin" /> In attesa di verifica Qualità
              </span>
            </>

          ) : stato === 'approvato' ? (
            <>
              <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-black uppercase text-slate-500 hover:bg-slate-200 transition-colors">
                Chiudi
              </button>
              {docEsistente?.file_url && (
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black uppercase bg-teal-600 text-white shadow hover:bg-teal-700 transition-colors"
                >
                  <Download size={15} /> Scarica .docx
                </button>
              )}
            </>

          ) : (
            <>
              <button
                onClick={onClose}
                disabled={saving || sending}
                className="px-5 py-2.5 rounded-xl text-sm font-black uppercase text-slate-500 hover:bg-slate-200 transition-colors"
              >
                Annulla
              </button>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSalvaBozza}
                  disabled={saving || sending}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black uppercase bg-slate-700 text-white shadow hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  {saving
                    ? <><Loader2 size={15} className="animate-spin" /> Salvataggio…</>
                    : <><CheckCircle2 size={15} /> Salva bozza</>
                  }
                </button>
                <button
                  onClick={handleInviaQualita}
                  disabled={saving || sending || !form.titolo.trim() || !form.elaborata_da.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black uppercase bg-teal-600 text-white shadow hover:bg-teal-700 transition-colors disabled:opacity-50"
                >
                  {sending
                    ? <><Loader2 size={15} className="animate-spin" /> Invio…</>
                    : <><Send size={15} /> Invia a Qualità</>
                  }
                </button>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
