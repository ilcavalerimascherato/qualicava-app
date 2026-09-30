// src/components/verbali/CorrispondenzaPanel.jsx
// Registro degli scambi successivi con l'ente ispettivo (proroghe,
// integrazioni, comunicazioni, esito procedimento) — la prima risposta
// resta su non_conformities.data_riscontro_segnalante, questo copre il
// resto della corrispondenza nel tempo. Stile card ispirato a
// RegistroAttivitaModal.jsx.
import { useEffect, useRef, useState } from 'react';
import { Plus, ChevronDown, Trash2, Paperclip, CornerDownRight, ShieldCheck, AlertTriangle, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  fetchCorrispondenza, addCorrispondenza, deleteCorrispondenza,
  uploadAllegato, getAllegatoUrl,
} from '../../services/verbaliIspettiviService';
import { analizzaAllegatiCorrispondenza } from '../../utils/corrispondenzaAiAnalisi';

const TIPO_OPTIONS = [
  { value: 'risposta_iniziale', label: 'Risposta iniziale' },
  { value: 'proroga_richiesta', label: 'Proroga richiesta' },
  { value: 'proroga_concessa', label: 'Proroga concessa' },
  { value: 'integrazione', label: 'Integrazione documentazione' },
  { value: 'comunicazione_ente', label: 'Comunicazione dall\'ente' },
  { value: 'esito_procedimento', label: 'Esito procedimento' },
  { value: 'altro', label: 'Altro' },
];

const EMPTY_FORM = { tipo: 'comunicazione_ente', direzione: 'in_uscita', data: new Date().toISOString().slice(0, 10), oggetto: '', testo: '', protocollo: '', riferimento_corrispondenza_id: '' };

function DirBadge({ direzione }) {
  return direzione === 'in_uscita'
    ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg border bg-indigo-50 text-indigo-700 border-indigo-200">→ Inviata</span>
    : <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg border bg-slate-100 text-slate-600 border-slate-200">← Ricevuta</span>;
}

export default function CorrispondenzaPanel({ verbaleId, facilityId, verbaleContesto, prefillSignal, onSaved }) {
  const { profile } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [attachments, setAttachments] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // Verifica AI degli allegati PRIMA del salvataggio — niente va in
  // Storage/DB finché l'utente non conferma esplicitamente dopo aver visto
  // l'esito (anche in caso di incoerenza rilevata, la decisione resta sua).
  const [verificando, setVerificando] = useState(false);
  const [analisiResult, setAnalisiResult] = useState(null);
  const [analisiError, setAnalisiError] = useState(null);
  const fileInputRef = useRef();
  const formRef = useRef();

  const load = async () => {
    setLoading(true);
    try {
      setItems(await fetchCorrispondenza(verbaleId));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [verbaleId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Apertura pre-compilata dall'esterno (es. bottone "È stato inviato un
  // altro documento" in VerbaleReviewModal) — prefillSignal cambia identità
  // ad ogni click così l'effetto riparte anche con lo stesso contenuto.
  useEffect(() => {
    if (!prefillSignal) return;
    setForm(f => ({ ...EMPTY_FORM, ...prefillSignal }));
    setShowForm(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  }, [prefillSignal]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setAttachments([]);
    setAnalisiResult(null);
    setAnalisiError(null);
    setShowForm(false);
  };

  // Cambiare gli allegati dopo una verifica invalida il risultato — non si
  // può confermare un salvataggio basato su file diversi da quelli allegati.
  const onPickFiles = (fileList) => {
    const files = Array.from(fileList ?? []);
    if (!files.length) return;
    const nonPdf = files.find(f => f.type !== 'application/pdf');
    if (nonPdf) {
      setError(`"${nonPdf.name}" non è un PDF — converti il file in PDF prima di allegarlo (es. stampa in PDF da Word, scansiona in PDF).`);
      return;
    }
    setError('');
    setAttachments(list => [...list, ...files]);
    setAnalisiResult(null);
    setAnalisiError(null);
  };

  const removeAttachment = (i) => {
    setAttachments(list => list.filter((_, j) => j !== i));
    setAnalisiResult(null);
    setAnalisiError(null);
  };

  const doVerifica = async () => {
    setVerificando(true);
    setError('');
    setAnalisiError(null);
    const { ok, data, error: aiErr } = await analizzaAllegatiCorrispondenza(attachments, verbaleContesto ?? {});
    setVerificando(false);
    if (!ok) { setAnalisiError(aiErr); return; }
    setAnalisiResult(data);
  };

  // skipVerifica: solo dalla scelta esplicita "Salva comunque senza verifica
  // AI" dopo un errore di analisi — mai un fallback silenzioso.
  const save = async ({ skipVerifica = false } = {}) => {
    if (!form.data) { setError('La data è obbligatoria.'); return; }
    if (attachments.length > 0 && !analisiResult && !skipVerifica) {
      setError('Verifica prima gli allegati con l\'AI, oppure scegli di salvare senza verifica.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const allegati = [];
      for (const file of attachments) {
        const { path, fileName } = await uploadAllegato(facilityId, verbaleId, file);
        allegati.push({ storagePath: path, fileName });
      }
      let analisiAi;
      if (attachments.length > 0) {
        analisiAi = analisiResult
          ? { stato: 'completata', risultato: analisiResult }
          : { stato: 'errore', risultato: analisiError ? { _errore: analisiError } : null };
      }
      const row = await addCorrispondenza({
        verbaleId, ...form,
        riferimentoCorrispondenzaId: form.riferimento_corrispondenza_id || null,
        allegati, analisiAi,
        createdBy: profile?.id,
      });
      resetForm();
      await load();
      onSaved?.(row);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const scaricaAllegato = async (path) => {
    try {
      const url = await getAllegatoUrl(path);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(`Impossibile aprire l'allegato: ${err.message}`);
    }
  };

  const remove = async (id) => {
    await deleteCorrispondenza(id);
    setItems(list => list.filter(i => i.id !== id));
  };

  // Voci con riferimento_corrispondenza_id vanno indentate sotto la voce
  // padre invece che nella lista piatta — le "figlie" vengono tolte dal
  // livello radice e riattaccate come children della propria voce padre.
  const byId = new Map(items.map(i => [i.id, i]));
  const radici = items.filter(i => !i.riferimento_corrispondenza_id || !byId.has(i.riferimento_corrispondenza_id));
  const childrenOf = (id) => items.filter(i => i.riferimento_corrispondenza_id === id);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Corrispondenza con l'ente</p>
        <button onClick={() => (showForm ? resetForm() : setShowForm(true))} className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800">
          <Plus size={12} /> Aggiungi
        </button>
      </div>

      {showForm && (
        <div ref={formRef} className="border border-slate-200 rounded-xl p-3 mb-3 bg-slate-50 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
              className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1.5 outline-none">
              {TIPO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select value={form.direzione} onChange={e => setForm(f => ({ ...f, direzione: e.target.value }))}
              className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1.5 outline-none">
              <option value="in_uscita">In uscita (inviata)</option>
              <option value="in_entrata">In entrata (ricevuta)</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
              className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1.5 outline-none" />
            <input value={form.protocollo} onChange={e => setForm(f => ({ ...f, protocollo: e.target.value }))}
              placeholder="N. protocollo (opzionale)"
              className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1.5 outline-none" />
          </div>
          <input value={form.oggetto} onChange={e => setForm(f => ({ ...f, oggetto: e.target.value }))}
            placeholder="Oggetto"
            className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2 py-1.5 outline-none" />
          <textarea rows={3} value={form.testo} onChange={e => setForm(f => ({ ...f, testo: e.target.value }))}
            placeholder="Testo / note"
            className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2 py-1.5 outline-none resize-y" />

          <select value={form.riferimento_corrispondenza_id} onChange={e => setForm(f => ({ ...f, riferimento_corrispondenza_id: e.target.value }))}
            className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2 py-1.5 outline-none text-slate-500">
            <option value="">In risposta a: nessuna voce precedente</option>
            {items.map(i => (
              <option key={i.id} value={i.id}>
                In risposta a: {TIPO_OPTIONS.find(o => o.value === i.tipo)?.label || i.tipo} del {i.data}{i.oggetto ? ` — ${i.oggetto}` : ''}
              </option>
            ))}
          </select>

          {attachments.length > 0 && (
            <div className="space-y-1.5">
              {attachments.map((file, i) => (
                <div key={i} className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-2 py-1.5">
                  <Paperclip size={12} className="text-indigo-600 flex-shrink-0" />
                  <span className="text-xs text-slate-600 truncate flex-1">{file.name}</span>
                  <button onClick={() => removeAttachment(i)} className="text-slate-400 hover:text-slate-600 text-xs">✕</button>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 hover:text-indigo-800">
            <Paperclip size={12} /> Allega PDF — anche più di uno (opzionale)
          </button>
          <input ref={fileInputRef} type="file" multiple accept="application/pdf" className="hidden"
            onChange={e => { onPickFiles(e.target.files); e.target.value = ''; }} />

          {/* Esito della verifica AI — solo suggerimento, la decisione di
              salvare resta sempre dell'operatore. */}
          {analisiResult && (
            <div className="space-y-2">
              {analisiResult.coerente_con_verbale_selezionato === false ? (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2 text-[11px]">
                  <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
                  <span><b>Possibile incoerenza con il verbale selezionato:</b> {analisiResult.motivazione_incoerenza || 'i documenti sembrano riferirsi a un atto diverso.'}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg px-3 py-2 text-[11px]">
                  <ShieldCheck size={13} className="flex-shrink-0" /> Nessuna incoerenza rilevata col verbale selezionato.
                </div>
              )}
              {analisiResult.considerazioni && (
                <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-[11px] text-slate-600">
                  <b>Considerazioni AI:</b> {analisiResult.considerazioni}
                </div>
              )}
              <button onClick={() => setAnalisiResult(null)} className="text-[11px] font-bold text-slate-400 hover:text-slate-600">Ripeti verifica</button>
            </div>
          )}
          {analisiError && (
            <p className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">Verifica AI non riuscita: {analisiError}</p>
          )}

          {error && <p className="text-[11px] font-bold text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={() => resetForm()} className="text-[11px] font-bold text-slate-500 px-3 py-1.5 rounded-lg hover:bg-slate-100">Annulla</button>
            {analisiError && (
              <button onClick={() => save({ skipVerifica: true })} disabled={saving} className="text-[11px] font-bold text-slate-500 border border-slate-300 px-3 py-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-50">
                Salva comunque senza verifica AI
              </button>
            )}
            {attachments.length > 0 && !analisiResult ? (
              <button onClick={doVerifica} disabled={verificando} className="flex items-center gap-1.5 text-[11px] font-bold text-white bg-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-800 disabled:opacity-50">
                {verificando ? <><Loader2 size={12} className="animate-spin" /> Verifica in corso…</> : <><ShieldCheck size={12} /> Verifica con AI</>}
              </button>
            ) : (
              <button onClick={() => save()} disabled={saving} className="text-[11px] font-bold text-white bg-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {attachments.length > 0 ? 'Conferma e salva' : 'Salva'}
              </button>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-slate-400">Caricamento...</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-slate-400 italic">Nessuna corrispondenza registrata oltre alla risposta iniziale.</p>
      ) : (
        <div className="space-y-1.5">
          {radici.map(item => (
            <div key={item.id} className="space-y-1.5">
              <CorrispondenzaRow item={item} expanded={expanded} setExpanded={setExpanded} scaricaAllegato={scaricaAllegato} remove={remove} />
              {childrenOf(item.id).map(child => (
                <div key={child.id} className="flex items-start gap-1.5 pl-4">
                  <CornerDownRight size={13} className="text-slate-300 mt-2.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <CorrispondenzaRow item={child} expanded={expanded} setExpanded={setExpanded} scaricaAllegato={scaricaAllegato} remove={remove} />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CorrispondenzaRow({ item, expanded, setExpanded, scaricaAllegato, remove }) {
  // allegato_storage_path (legacy, voci create prima della tabella figlia)
  // + verbali_corrispondenza_allegati (voci nuove, uno o più file).
  const allegati = [
    ...(item.allegato_storage_path ? [{ storage_path: item.allegato_storage_path, nome_file: 'Allegato' }] : []),
    ...(item.verbali_corrispondenza_allegati ?? []),
  ];
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(e => (e === item.id ? null : item.id))}
        className="w-full flex items-center justify-between px-3 py-2 bg-white hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2 text-left flex-wrap min-w-0">
          <DirBadge direzione={item.direzione} />
          <span className="text-xs font-bold text-slate-700 truncate">{TIPO_OPTIONS.find(o => o.value === item.tipo)?.label || item.tipo}</span>
          <span className="text-xs text-slate-400">{item.data}</span>
          {item.oggetto && <span className="text-xs text-slate-400 truncate">— {item.oggetto}</span>}
          {allegati.length > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] font-bold text-indigo-400 flex-shrink-0">
              <Paperclip size={11} /> {allegati.length > 1 ? allegati.length : ''}
            </span>
          )}
        </div>
        <ChevronDown size={13} className={`text-slate-400 transition-transform shrink-0 ${expanded === item.id ? 'rotate-180' : ''}`} />
      </button>
      {expanded === item.id && (
        <div className="px-3 py-2.5 border-t border-slate-100 bg-slate-50 text-xs text-slate-600 space-y-2">
          {item.protocollo && <p><b>Protocollo:</b> {item.protocollo}</p>}
          {item.testo && <p className="whitespace-pre-wrap">{item.testo}</p>}
          {item.analisi_ai_stato === 'completata' && item.analisi_ai_risultato?.coerente_con_verbale_selezionato === false && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2 text-[11px]">
              <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
              <span><b>Possibile incoerenza rilevata al momento del salvataggio:</b> {item.analisi_ai_risultato.motivazione_incoerenza}</span>
            </div>
          )}
          {item.analisi_ai_stato === 'completata' && item.analisi_ai_risultato?.considerazioni && (
            <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-[11px] text-slate-600">
              <b>Considerazioni AI:</b> {item.analisi_ai_risultato.considerazioni}
            </div>
          )}
          {item.analisi_ai_stato === 'errore' && (
            <p className="text-[11px] text-slate-400 italic">Analisi AI non eseguita su questa voce.</p>
          )}
          {allegati.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              {allegati.map((a, i) => (
                <button key={i} onClick={() => scaricaAllegato(a.storage_path)} className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800">
                  <Paperclip size={11} /> {a.nome_file || `Allegato ${i + 1}`}
                </button>
              ))}
            </div>
          )}
          <button onClick={() => remove(item.id)} className="flex items-center gap-1 text-[11px] font-bold text-red-500 hover:text-red-700">
            <Trash2 size={11} /> Elimina
          </button>
        </div>
      )}
    </div>
  );
}
