// src/components/DocMasterModal.jsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  X, FileText, Upload, Loader2, CheckCircle2,
  Tag, Calendar, Users, AlertTriangle, ChevronDown, ChevronUp,
  RefreshCw, Sparkles, History, Pencil, Building2, BookOpen,
} from 'lucide-react';
import PizZip from 'pizzip';
import { useAuth }            from '../contexts/AuthContext';
import {
  uploadMasterFile,
  createDocMaster,
  extractPlaceholders,
  creaNuovaRevisione,
  getDocMasterRevisioni,
  updateDocMaster,
  getAuditLog,
} from '../services/documentiService';
import { docMasterAnalisi }    from '../config/aiPrompts';
import { TIPOLOGIA_OPTIONS }   from '../config/docTipologie';
import DocCopertinaModal       from './DocCopertinaModal';

// ─── costanti ─────────────────────────────────────────────────

const CATEGORIE = [
  { id: 'PCA', label: 'Protocolli, Procedure e Istruzioni Operative' },
  { id: 'CDS', label: 'Carta dei Servizi e Regolamento'              },
  { id: 'ALI', label: 'Menù e Ricettari'                             },
  { id: 'QUA', label: 'Analisi e Miglioramento'                      },
  { id: 'OBS', label: 'Documenti Obsoleti'                           },
];

const UDO_OPTIONS = [
  { id: 'RSA', label: 'RSA' },
  { id: 'CDI', label: 'CDI' },
  { id: 'SL',  label: 'SL'  },
  { id: 'PSI', label: 'PSI' },
  { id: 'DIS', label: 'DIS' },
  { id: 'CDD', label: 'CDD' },
];

export { TIPOLOGIA_OPTIONS };

const REGIONI_OPTIONS = [
  'Lombardia', 'Piemonte', 'Veneto', 'Emilia-Romagna', 'Toscana',
  'Lazio', 'Campania', 'Puglia', 'Sicilia', 'Sardegna',
  'Liguria', 'Trentino-Alto Adige', 'Friuli-Venezia Giulia',
  'Umbria', 'Marche', 'Abruzzo', 'Molise', 'Basilicata', 'Calabria',
  "Valle d'Aosta",
];

const defaultScadenza = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 3);
  return d.toISOString().split('T')[0];
};
const today = () => new Date().toISOString().split('T')[0];

const AZIONE_BADGE = {
  'creazione':         'bg-green-100 text-green-700 border border-green-200',
  'modifica_metadati': 'bg-blue-100 text-blue-700 border border-blue-200',
  'modifica_file':     'bg-violet-100 text-violet-700 border border-violet-200',
  'nuova_revisione':   'bg-amber-100 text-amber-700 border border-amber-200',
  'obsoleto':          'bg-red-100 text-red-700 border border-red-200',
  'distribuzione':     'bg-teal-100 text-teal-700 border border-teal-200',
  'accesso_download':  'bg-slate-100 text-slate-600 border border-slate-200',
};

// ─── helpers ──────────────────────────────────────────────────

const INITIAL_FORM = {
  titolo:                '',
  codice_documento:      '',
  categoria:             '',
  note:                  '',
  approvato_da:          '',
  data_approvazione:     today(),
  data_scadenza:         defaultScadenza(),
  udo_applicabilita:     [],
  revisione_corrente:    'Rev. 0',
  tipologia_documento:   '',
  elaborata_da:          'Ufficio Qualità Gruppo OVER',
  verificata_da:         '',
  regioni_applicabilita: [],
};

function formFromMaster(m) {
  return {
    titolo:                m.titolo                ?? '',
    codice_documento:      m.codice_documento      ?? '',
    categoria:             m.categoria             ?? '',
    note:                  m.note                  ?? '',
    approvato_da:          m.approvato_da          ?? '',
    data_approvazione:     today(),
    data_scadenza:         defaultScadenza(),
    udo_applicabilita:     m.udo_applicabilita     ?? [],
    tipologia_documento:   m.tipologia_documento   ?? '',
    elaborata_da:          m.elaborata_da          ?? 'Ufficio Qualità Gruppo OVER',
    verificata_da:         m.verificata_da         ?? '',
    regioni_applicabilita: m.regioni_applicabilita ?? [],
  };
}

function formFromMasterEdit(m) {
  return {
    titolo:                m.titolo                ?? '',
    codice_documento:      m.codice_documento      ?? '',
    categoria:             m.categoria             ?? '',
    note:                  m.note                  ?? '',
    approvato_da:          m.approvato_da          ?? '',
    data_approvazione:     m.data_approvazione ? m.data_approvazione.split('T')[0] : today(),
    data_scadenza:         m.data_scadenza     ? m.data_scadenza.split('T')[0]     : defaultScadenza(),
    udo_applicabilita:     m.udo_applicabilita     ?? [],
    revisione_corrente:    m.revisione_corrente    ?? 'Rev. 0',
    tipologia_documento:   m.tipologia_documento   ?? '',
    elaborata_da:          m.elaborata_da          ?? 'Ufficio Qualità Gruppo OVER',
    verificata_da:         m.verificata_da         ?? '',
    regioni_applicabilita: m.regioni_applicabilita ?? [],
  };
}

function nextRev(current) {
  const match = current?.match(/\d+/);
  const n = match ? parseInt(match[0], 10) : 0;
  return `Rev. ${n + 1}`;
}

// ─── componente ───────────────────────────────────────────────

export default function DocMasterModal({
  onClose,
  onSuccess,
  masterEsistente    = null,
  masterDaModificare = null,
}) {
  const { profile } = useAuth();
  const isAllowed  = ['superadmin', 'admin'].includes(profile?.role);
  const isRevMode  = !!masterEsistente;
  const isEditMode = !!masterDaModificare;

  const [form,         setForm]        = useState(
    isRevMode  ? formFromMaster(masterEsistente) :
    isEditMode ? formFromMasterEdit(masterDaModificare) :
    INITIAL_FORM
  );
  const [file,         setFile]        = useState(null);
  const [placeholders, setPlaceholders]= useState([]);
  const [loadingFile,  setLoadingFile] = useState(false);
  const [saving,       setSaving]      = useState(false);
  const [errors,       setErrors]      = useState({});
  const [fileError,    setFileError]   = useState('');
  const [isDragging,   setIsDragging]  = useState(false);

  // Revisione
  const [noteRevisione, setNoteRevisione] = useState('');
  const [revisioni,     setRevisioni]     = useState([]);
  const [showRevisioni, setShowRevisioni] = useState(false);
  const [loadingRev,    setLoadingRev]    = useState(false);

  // AI
  const [aiLoading,   setAiLoading]   = useState(false);
  const [aiResult,    setAiResult]    = useState('');
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiError,     setAiError]     = useState('');

  // Edit mode
  const [sostituisciFile,   setSostituisciFile]   = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmFields,     setConfirmFields]     = useState({ data_approvazione: '' });
  const [auditLog,          setAuditLog]          = useState([]);
  const [showAuditLog,      setShowAuditLog]      = useState(false);
  const [loadingAuditLog,   setLoadingAuditLog]   = useState(false);
  const [copertinaModal,    setCopertinaModal]    = useState(false);

  const fileRef  = useRef(null);
  const prossRev = isRevMode ? nextRev(masterEsistente.revisione_corrente) : null;

  // Carica storico in modalità revisione
  useEffect(() => {
    if (!isRevMode) return;
    setLoadingRev(true);
    getDocMasterRevisioni(masterEsistente.id)
      .then(setRevisioni)
      .catch(() => {})
      .finally(() => setLoadingRev(false));
  }, [isRevMode, masterEsistente?.id]);

  // Carica audit log in modalità modifica
  useEffect(() => {
    if (!isEditMode) return;
    setLoadingAuditLog(true);
    getAuditLog(masterDaModificare.id)
      .then(setAuditLog)
      .catch(() => {})
      .finally(() => setLoadingAuditLog(false));
  }, [isEditMode, masterDaModificare?.id]);

  // ── form helpers ─────────────────────────────────────────────

  const setField = useCallback((key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: '' }));
  }, []);

  const toggleUdo = useCallback((id) => {
    setForm(prev => ({
      ...prev,
      udo_applicabilita: prev.udo_applicabilita.includes(id)
        ? prev.udo_applicabilita.filter(x => x !== id)
        : [...prev.udo_applicabilita, id],
    }));
  }, []);

  const toggleRegione = useCallback((regione) => {
    setForm(prev => ({
      ...prev,
      regioni_applicabilita: prev.regioni_applicabilita.includes(regione)
        ? prev.regioni_applicabilita.filter(x => x !== regione)
        : [...prev.regioni_applicabilita, regione],
    }));
  }, []);

  // ── file handlers ─────────────────────────────────────────────

  const handleFileChange = useCallback(async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.endsWith('.docx')) { setFileError('Solo file .docx supportati'); return; }
    setFileError('');
    setFile(f);
    setLoadingFile(true);
    setPlaceholders([]);
    setAiResult('');
    setShowAiPanel(false);
    setAiError('');
    try {
      const buffer = await f.arrayBuffer();
      setPlaceholders(await extractPlaceholders(buffer));
    } catch {
      setFileError('Impossibile leggere i placeholder dal file.');
    } finally {
      setLoadingFile(false);
    }
  }, []);

  const handleDragOver  = useCallback((e) => { e.preventDefault(); setIsDragging(true);  }, []);
  const handleDragLeave = useCallback((e) => { e.preventDefault(); setIsDragging(false); }, []);
  const handleDrop      = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFileChange({ target: { files: [f] } });
  }, [handleFileChange]);

  // ── AI analysis ───────────────────────────────────────────────

  const handleAnalisiAI = useCallback(async () => {
    if (!file) return;
    setAiLoading(true);
    setAiError('');
    setAiResult('');
    setShowAiPanel(true);
    try {
      const buffer = await file.arrayBuffer();
      const zip    = new PizZip(buffer);
      const xml    = zip.files['word/document.xml']?.asText() ?? '';
      const testo  = xml.replace(/<[^>]+>/g, '').trim().slice(0, 8000);

      const apiKey = process.env.REACT_APP_ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error('REACT_APP_ANTHROPIC_API_KEY non configurata nel .env');

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type':                              'application/json',
          'x-api-key':                                apiKey,
          'anthropic-version':                        '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model:      'claude-haiku-4-5-20251001',
          max_tokens: 1000,
          messages:   [{ role: 'user', content: docMasterAnalisi.prompt + '\n\nTESTO DOCUMENTO:\n' + testo }],
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Errore API ${res.status}: ${err}`);
      }
      const data   = await res.json();
      const result = data.content?.map(b => b.text || '').join('') || '';
      if (!result) throw new Error('Risposta vuota dall\'API');
      setAiResult(result);
    } catch (err) {
      setAiError(`Analisi non riuscita: ${err.message}`);
    } finally {
      setAiLoading(false);
    }
  }, [file]);

  // ── validate + save ───────────────────────────────────────────

  const validate = () => {
    const errs = {};
    if (!form.titolo.trim())           errs.titolo           = 'Campo obbligatorio';
    if (!form.codice_documento.trim()) errs.codice_documento = 'Campo obbligatorio';
    if (!form.categoria)               errs.categoria        = 'Seleziona una categoria';
    if (!isEditMode && !file)          errs.file             = 'Carica un file .docx';
    if (isEditMode && sostituisciFile && !file)
                                       errs.file             = 'Seleziona un file .docx da sostituire';
    if (isRevMode && !noteRevisione.trim()) errs.noteRevisione = 'Note di revisione obbligatorie';
    return errs;
  };

  const handleSave = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    // In edit mode apre il modale di conferma invece di salvare direttamente
    if (isEditMode) {
      setConfirmFields({ data_approvazione: form.data_approvazione });
      setShowConfirmDialog(true);
      return;
    }

    setSaving(true);
    try {
      const { path } = await uploadMasterFile(file, form.codice_documento);
      if (isRevMode) {
        const { success, error: revErr } = await creaNuovaRevisione(
          masterEsistente.id,
          { ...form, file_url_master: path, placeholder_list: placeholders, revisione_corrente: prossRev },
          noteRevisione,
          profile?.id
        );
        if (!success) throw new Error(revErr);
      } else {
        await createDocMaster({
          ...form,
          file_url_master:  path,
          placeholder_list: placeholders,
          stato:            'attivo',
        });
      }
      onSuccess?.();
    } catch (err) {
      setErrors({ submit: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmSave = async () => {
    setSaving(true);
    setShowConfirmDialog(false);
    try {
      let fileUrlMaster     = masterDaModificare.file_url_master;
      let nuoviPlaceholders = masterDaModificare.placeholder_list;
      if (sostituisciFile && file) {
        const { path } = await uploadMasterFile(file, form.codice_documento);
        fileUrlMaster     = path;
        nuoviPlaceholders = placeholders;
      }
      const datiNuovi = {
        ...form,
        data_approvazione: confirmFields.data_approvazione,
        file_url_master:   fileUrlMaster,
        placeholder_list:  nuoviPlaceholders,
      };
      await updateDocMaster(masterDaModificare.id, datiNuovi, profile?.id, masterDaModificare);
      onSuccess?.();
    } catch (err) {
      setErrors({ submit: err.message });
    } finally {
      setSaving(false);
    }
  };

  // ── guard ─────────────────────────────────────────────────────
  if (!isAllowed) return null;

  // ── render ───────────────────────────────────────────────────

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

          {/* Header */}
          <div className={`px-7 py-5 flex items-center justify-between shrink-0 ${
            isRevMode  ? 'bg-amber-900' :
            isEditMode ? 'bg-slate-800' :
            'bg-slate-950'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl text-white ${
                isRevMode  ? 'bg-amber-600' :
                isEditMode ? 'bg-slate-600' :
                'bg-indigo-600'
              }`}>
                {isRevMode ? <RefreshCw size={20} /> : isEditMode ? <Pencil size={20} /> : <FileText size={20} />}
              </div>
              <div>
                <h2 className="text-lg font-black text-white uppercase tracking-wider">
                  {isRevMode
                    ? `Nuova revisione — ${masterEsistente.titolo}`
                    : isEditMode
                      ? `Modifica — ${masterDaModificare.titolo}`
                      : 'Nuovo documento master'}
                </h2>
                <p className={`text-[10px] font-bold uppercase tracking-widest ${
                  isRevMode  ? 'text-amber-300' :
                  isEditMode ? 'text-slate-400' :
                  'text-indigo-400'
                }`}>
                  {isRevMode
                    ? `${masterEsistente.revisione_corrente ?? 'Rev. 0'} → ${prossRev}`
                    : isEditMode
                      ? `${masterDaModificare.revisione_corrente ?? '—'} — modifica senza revisione`
                      : 'Carica e configura un documento modello'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="overflow-y-auto p-7 space-y-6">

            {/* Banner prossima revisione */}
            {isRevMode && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3 flex items-center gap-3">
                <RefreshCw size={16} className="text-amber-600 shrink-0" />
                <div>
                  <p className="text-xs font-black text-amber-800 uppercase tracking-wider">
                    Prossima revisione: {prossRev}
                  </p>
                  <p className="text-[11px] text-amber-600 mt-0.5">
                    Revisione corrente: {masterEsistente.revisione_corrente ?? 'Rev. 0'}
                  </p>
                </div>
              </div>
            )}

            {/* Banner modalità modifica */}
            {isEditMode && (
              <div className="bg-slate-100 border border-slate-200 rounded-2xl px-5 py-3 flex items-center gap-3">
                <Pencil size={16} className="text-slate-500 shrink-0" />
                <div>
                  <p className="text-xs font-black text-slate-700 uppercase tracking-wider">
                    Modifica documento — nessuna nuova revisione
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    I metadati vengono aggiornati direttamente. Revisione corrente: {masterDaModificare.revisione_corrente ?? '—'}
                  </p>
                </div>
              </div>
            )}

            {/* RIGA 1 — Titolo */}
            <div>
              <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-1.5">
                Titolo *
              </label>
              <input
                type="text"
                value={form.titolo}
                onChange={e => setField('titolo', e.target.value)}
                placeholder="es. Procedura gestione farmaci"
                className={`w-full rounded-xl border px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-400 transition-all
                  ${errors.titolo ? 'border-rose-400 bg-rose-50' : 'border-slate-200 bg-slate-50'}`}
              />
              {errors.titolo && <p className="text-xs text-rose-500 mt-1">{errors.titolo}</p>}
            </div>

            {/* RIGA 2 — Codice | Tipologia */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-1.5">
                  Codice documento *
                </label>
                <input
                  type="text"
                  value={form.codice_documento}
                  onChange={e => setField('codice_documento', e.target.value.toUpperCase())}
                  placeholder="es. PCA-001"
                  className={`w-full rounded-xl border px-4 py-2.5 text-sm font-bold uppercase outline-none focus:ring-2 focus:ring-indigo-400 transition-all
                    ${errors.codice_documento ? 'border-rose-400 bg-rose-50' : 'border-slate-200 bg-slate-50'}`}
                />
                {errors.codice_documento && <p className="text-xs text-rose-500 mt-1">{errors.codice_documento}</p>}
              </div>
              <div>
                <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-1.5">
                  Tipologia
                </label>
                <div className="relative">
                  <select
                    value={form.tipologia_documento}
                    onChange={e => setField('tipologia_documento', e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium appearance-none outline-none focus:ring-2 focus:ring-indigo-400 transition-all"
                  >
                    <option value="">— Seleziona tipologia —</option>
                    {TIPOLOGIA_OPTIONS.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-4 top-3.5 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Categoria */}
            <div>
              <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Tag size={12} /> Categoria *
              </label>
              <div className="relative">
                <select
                  value={form.categoria}
                  onChange={e => setField('categoria', e.target.value)}
                  className={`w-full rounded-xl border px-4 py-2.5 text-sm font-bold appearance-none outline-none focus:ring-2 focus:ring-indigo-400 transition-all
                    ${errors.categoria ? 'border-rose-400 bg-rose-50' : 'border-slate-200 bg-slate-50'}`}
                >
                  <option value="">— Seleziona categoria —</option>
                  {CATEGORIE.map(c => (
                    <option key={c.id} value={c.id}>{c.id} — {c.label}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-4 top-3.5 text-slate-400 pointer-events-none" />
              </div>
              {errors.categoria && <p className="text-xs text-rose-500 mt-1">{errors.categoria}</p>}
            </div>

            {/* Applicabilità UDO */}
            <div>
              <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Users size={12} /> Applicabilità UDO
              </label>
              <div className="flex flex-wrap gap-2">
                {UDO_OPTIONS.map(udo => {
                  const active = form.udo_applicabilita.includes(udo.id);
                  return (
                    <button
                      key={udo.id}
                      type="button"
                      onClick={() => toggleUdo(udo.id)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wide border-2 transition-all
                        ${active
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                        }`}
                    >
                      {udo.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5">
                Nessuna selezione = applicabile a tutte le UDO
              </p>
            </div>

            {/* RIGA 5 — Regioni di applicabilità */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-black text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 size={12} /> Regioni di applicabilità
                </label>
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, regioni_applicabilita: [] }))}
                  className="text-[11px] font-bold text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Tutte le regioni
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {REGIONI_OPTIONS.map(r => {
                  const active = form.regioni_applicabilita.includes(r);
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => toggleRegione(r)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all
                        ${active
                          ? 'bg-teal-600 text-white border-teal-600'
                          : 'bg-white text-slate-500 border-slate-200 hover:border-teal-300 hover:text-teal-600'
                        }`}
                    >
                      {r}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5">
                Nessuna selezione = applicabile a tutte le regioni
              </p>
            </div>

            {/* RIGA 6 — Elaborata da */}
            <div>
              <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-1.5">
                Elaborata da
              </label>
              <input
                type="text"
                value={form.elaborata_da}
                onChange={e => setField('elaborata_da', e.target.value)}
                placeholder="es. Ufficio Qualità Gruppo OVER"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-400 transition-all"
              />
            </div>

            {/* RIGA 7 — Verificata da | Approvata da */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-1.5">
                  Verificata da
                </label>
                <input
                  type="text"
                  value={form.verificata_da}
                  onChange={e => setField('verificata_da', e.target.value)}
                  placeholder="Nome e cognome o ruolo"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-400 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-1.5">
                  Approvata da
                </label>
                <input
                  type="text"
                  value={form.approvato_da}
                  onChange={e => setField('approvato_da', e.target.value)}
                  placeholder="Nome e cognome o ruolo"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-400 transition-all"
                />
              </div>
            </div>

            {/* RIGA 8 — Date approvazione | scadenza | revisione */}
            <div className={`grid gap-4 ${isRevMode ? 'grid-cols-2' : 'grid-cols-3'}`}>
              <div>
                <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Calendar size={12} /> Data validazione
                </label>
                <input
                  type="date"
                  value={form.data_approvazione}
                  onChange={e => setField('data_approvazione', e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-400 transition-all"
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
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-400 transition-all"
                />
              </div>
              {!isRevMode && (
                <div>
                  <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-1.5">
                    {isEditMode ? 'Revisione corrente' : 'Revisione iniziale'}
                  </label>
                  <input
                    type="text"
                    value={form.revisione_corrente}
                    onChange={e => setField('revisione_corrente', e.target.value)}
                    placeholder="es. Rev. 0"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-400 transition-all"
                  />
                  {!isEditMode && (
                    <p className="text-[10px] text-slate-400 mt-1.5">
                      Permette di partire da qualsiasi revisione storica
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* RIGA 9 — Note di revisione / note documento */}
            <div>
              <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                {isRevMode && <RefreshCw size={12} />}
                {isRevMode ? 'Note di revisione *' : 'Note di revisione (modifiche apportate)'}
              </label>
              <textarea
                value={isRevMode ? noteRevisione : form.note}
                onChange={e => {
                  if (isRevMode) {
                    setNoteRevisione(e.target.value);
                    setErrors(prev => ({ ...prev, noteRevisione: '' }));
                  } else {
                    setField('note', e.target.value);
                  }
                }}
                rows={3}
                placeholder={isRevMode
                  ? 'Descrivi le modifiche apportate rispetto alla revisione precedente...'
                  : 'Informazioni aggiuntive, ambito di applicazione, modifiche apportate...'}
                className={`w-full rounded-xl border px-4 py-2.5 text-sm font-medium outline-none resize-none transition-all
                  ${isRevMode
                    ? `focus:ring-2 focus:ring-amber-400 ${errors.noteRevisione ? 'border-rose-400 bg-rose-50' : 'border-amber-200 bg-amber-50'}`
                    : 'focus:ring-2 focus:ring-indigo-400 border-slate-200 bg-slate-50'
                  }`}
              />
              {errors.noteRevisione && <p className="text-xs text-rose-500 mt-1">{errors.noteRevisione}</p>}
            </div>

            {/* Upload file */}
            <div>
              <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Upload size={12} />
                {isRevMode ? 'Nuovo file .docx *' : isEditMode ? 'File .docx' : 'File .docx *'}
              </label>

              {/* Edit mode: mostra file attuale con opzione sostituzione */}
              {isEditMode && !sostituisciFile && (
                <div className="flex items-center justify-between border border-slate-200 bg-slate-50 rounded-2xl px-5 py-4">
                  <div className="flex items-center gap-3">
                    <FileText size={18} className="text-slate-400 shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-slate-600 truncate max-w-[280px]">
                        {masterDaModificare.file_url_master
                          ? masterDaModificare.file_url_master.split('/').pop()
                          : 'Nessun file caricato'}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">File master corrente</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSostituisciFile(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase
                      bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors shrink-0"
                  >
                    <Upload size={12} /> Sostituisci file
                  </button>
                </div>
              )}

              {/* Drag-drop: sempre in new/rev mode; in edit mode solo se sostituisciFile */}
              {(!isEditMode || sostituisciFile) && (
                <>
                  {isEditMode && sostituisciFile && (
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[11px] text-slate-500 font-medium">Seleziona il nuovo file da caricare</p>
                      <button
                        type="button"
                        onClick={() => { setSostituisciFile(false); setFile(null); setPlaceholders([]); setFileError(''); setErrors(prev => ({ ...prev, file: '' })); }}
                        className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors underline"
                      >
                        Mantieni file attuale
                      </button>
                    </div>
                  )}
                  <div
                    onClick={() => fileRef.current?.click()}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`
                      border-2 border-dashed rounded-2xl px-6 py-8 text-center cursor-pointer transition-all group
                      ${errors.file    ? 'border-rose-300 bg-rose-50'
                        : file         ? 'border-emerald-300 bg-emerald-50'
                        : isDragging   ? 'border-emerald-400 bg-emerald-50/60'
                        : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40'}
                    `}
                  >
                    {loadingFile ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 size={24} className="text-indigo-400 animate-spin" />
                        <p className="text-sm font-bold text-slate-500">Analisi placeholder...</p>
                      </div>
                    ) : file ? (
                      <div className="flex flex-col items-center gap-2">
                        <CheckCircle2 size={24} className="text-emerald-500" />
                        <p className="text-sm font-bold text-emerald-700">{file.name}</p>
                        <p className="text-xs text-emerald-500">{(file.size / 1024).toFixed(0)} KB — clicca per cambiare</p>
                      </div>
                    ) : isDragging ? (
                      <div className="flex flex-col items-center gap-2">
                        <Upload size={24} className="text-emerald-500" />
                        <p className="text-sm font-bold text-emerald-600">Rilascia il file .docx qui</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Upload size={24} className="text-slate-300 group-hover:text-indigo-400 transition-colors" />
                        <p className="text-sm font-bold text-slate-400 group-hover:text-indigo-500 transition-colors">
                          Trascina il file .docx qui oppure clicca per selezionare
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}

              <input ref={fileRef} type="file" accept=".docx" onChange={handleFileChange} className="hidden" />
              {errors.file && <p className="text-xs text-rose-500 mt-1">{errors.file}</p>}
              {fileError   && <p className="text-xs text-rose-500 mt-1">{fileError}</p>}
            </div>

            {/* Placeholder trovati */}
            {placeholders.length > 0 && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4">
                <p className="text-xs font-black text-indigo-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <AlertTriangle size={12} />
                  {placeholders.length} placeholder trovati nel documento
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {placeholders.map(ph => (
                    <span
                      key={ph}
                      className="bg-white border border-indigo-200 text-indigo-700 text-[11px] font-bold px-2 py-0.5 rounded-lg font-mono"
                    >
                      {`{{${ph}}}`}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Analisi AI — visibile solo dopo upload riuscito */}
            {file && !loadingFile && !fileError && (
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-violet-500" />
                    <span className="text-xs font-black text-slate-700 uppercase tracking-wider">
                      Analisi AI documento
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {(aiResult || aiError) && (
                      <button
                        onClick={() => setShowAiPanel(s => !s)}
                        className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {showAiPanel ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    )}
                    <button
                      onClick={handleAnalisiAI}
                      disabled={aiLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase
                        bg-violet-600 text-white hover:bg-violet-700 transition-colors disabled:opacity-50 shadow-sm"
                    >
                      {aiLoading
                        ? <><Loader2 size={12} className="animate-spin" /> Analisi...</>
                        : <><Sparkles size={12} /> Analizza con AI</>
                      }
                    </button>
                  </div>
                </div>

                {showAiPanel && (
                  <div className="p-4 bg-slate-50 border-t border-slate-100">
                    {aiLoading && (
                      <div className="flex items-center gap-2 text-sm text-slate-500 font-medium py-4 justify-center">
                        <Loader2 size={16} className="animate-spin text-violet-500" />
                        Analisi in corso...
                      </div>
                    )}
                    {aiError && !aiLoading && (
                      <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm font-medium px-4 py-3 rounded-xl">
                        {aiError}
                      </div>
                    )}
                    {aiResult && !aiLoading && (
                      <pre className="text-xs text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">
                        {aiResult}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Storico revisioni — solo in rev mode */}
            {isRevMode && (
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setShowRevisioni(s => !s)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <History size={14} className="text-slate-500" />
                    <span className="text-xs font-black text-slate-600 uppercase tracking-wider">
                      Storico revisioni{revisioni.length > 0 ? ` (${revisioni.length})` : ''}
                    </span>
                  </div>
                  {showRevisioni ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                </button>

                {showRevisioni && (
                  <div className="divide-y divide-slate-100">
                    {loadingRev ? (
                      <div className="flex justify-center py-6">
                        <Loader2 size={18} className="animate-spin text-slate-300" />
                      </div>
                    ) : revisioni.length === 0 ? (
                      <p className="text-xs text-slate-400 font-medium text-center py-5">
                        Nessuna revisione precedente
                      </p>
                    ) : (
                      revisioni.map((rev, i) => (
                        <div key={rev.id ?? i} className="px-4 py-3">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[11px] font-black text-slate-600 uppercase">
                              Rev. {rev.dati_vecchi?.revisione_corrente ?? '—'}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {rev.created_at ? new Date(rev.created_at).toLocaleDateString('it-IT') : ''}
                            </span>
                          </div>
                          {rev.note_revisione && (
                            <p className="text-xs text-slate-500 leading-relaxed">{rev.note_revisione}</p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Storico modifiche (audit log) — solo in edit mode */}
            {isEditMode && (
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setShowAuditLog(s => !s)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <History size={14} className="text-slate-500" />
                    <span className="text-xs font-black text-slate-600 uppercase tracking-wider">
                      Storico modifiche{auditLog.length > 0 ? ` (${auditLog.length})` : ''}
                    </span>
                  </div>
                  {showAuditLog ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                </button>

                {showAuditLog && (
                  <div>
                    {loadingAuditLog ? (
                      <div className="flex justify-center py-6">
                        <Loader2 size={18} className="animate-spin text-slate-300" />
                      </div>
                    ) : auditLog.length === 0 ? (
                      <p className="text-xs text-slate-400 font-medium text-center py-5">
                        Nessuna modifica registrata
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/60">
                              <th className="text-left px-4 py-2 font-black text-slate-500 uppercase tracking-wide text-[10px]">Data/ora</th>
                              <th className="text-left px-4 py-2 font-black text-slate-500 uppercase tracking-wide text-[10px]">Utente</th>
                              <th className="text-left px-4 py-2 font-black text-slate-500 uppercase tracking-wide text-[10px]">Azione</th>
                              <th className="text-left px-4 py-2 font-black text-slate-500 uppercase tracking-wide text-[10px]">Dettaglio</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {auditLog.map(entry => (
                              <tr key={entry.id} className="hover:bg-slate-50/60 transition-colors">
                                <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">
                                  {entry.eseguito_il
                                    ? new Date(entry.eseguito_il).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })
                                    : '—'}
                                </td>
                                <td className="px-4 py-2.5 text-slate-600 font-medium max-w-[140px] truncate">
                                  {entry.utente_email || '—'}
                                </td>
                                <td className="px-4 py-2.5">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wide
                                    ${AZIONE_BADGE[entry.azione] ?? 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                                    {entry.azione?.replace(/_/g, ' ')}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 text-slate-500 max-w-[180px]">
                                  {entry.dettaglio
                                    ? <span className="font-mono text-[10px] text-slate-400 truncate block">
                                        {JSON.stringify(entry.dettaglio)}
                                      </span>
                                    : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
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
            {(isRevMode || isEditMode) ? (
              <button
                onClick={() => setCopertinaModal(true)}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black uppercase
                  text-emerald-700 hover:bg-emerald-50 border border-emerald-200 transition-colors"
              >
                <BookOpen size={13} /> Copertina
              </button>
            ) : <span />}
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                disabled={saving}
                className="px-5 py-2.5 rounded-xl text-sm font-black uppercase text-slate-500 hover:bg-slate-200 transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black uppercase text-white shadow transition-colors disabled:opacity-50
                  ${isRevMode  ? 'bg-amber-600 hover:bg-amber-700'
                  : isEditMode ? 'bg-slate-700 hover:bg-slate-800'
                  : 'bg-indigo-600 hover:bg-indigo-700'}`}
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                {saving
                  ? 'Salvataggio...'
                  : isRevMode  ? 'Salva revisione'
                  : isEditMode ? 'Modifica documento'
                  : 'Salva documento'}
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Modale di conferma — solo in edit mode */}
      {isEditMode && showConfirmDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

            <div className="px-6 pt-6">
              <h3 className="text-base font-black text-slate-800 uppercase tracking-wider">
                Conferma modifica
              </h3>
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mt-3">
                <p className="text-sm font-bold text-amber-800">
                  Stai modificando il documento senza creare nuova revisione.
                </p>
                <p className="text-xs text-amber-600 mt-1">
                  Verifica i valori qui sotto prima di salvare. Puoi correggerli direttamente.
                </p>
              </div>
            </div>

            <div className="px-6 pt-5 pb-2 space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Calendar size={12} /> Data validazione
                </label>
                <input
                  type="date"
                  value={confirmFields.data_approvazione}
                  onChange={e => setConfirmFields(prev => ({ ...prev, data_approvazione: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-slate-400 transition-all"
                />
              </div>
            </div>

            <div className="px-6 pb-6 pt-4 flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmDialog(false)}
                disabled={saving}
                className="px-5 py-2.5 rounded-xl text-sm font-black uppercase text-slate-500 hover:bg-slate-100 transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={handleConfirmSave}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black uppercase text-white bg-slate-700 hover:bg-slate-800 shadow transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                {saving ? 'Salvataggio...' : 'Conferma e salva'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Modale copertina */}
      {copertinaModal && (isRevMode || isEditMode) && (
        <DocCopertinaModal
          documento={masterEsistente ?? masterDaModificare}
          facility={null}
          company={null}
          onClose={() => setCopertinaModal(false)}
        />
      )}
    </>
  );
}
