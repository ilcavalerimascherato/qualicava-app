// src/components/verbali/CorrispondenzaPanel.jsx
// Registro degli scambi successivi con l'ente ispettivo (proroghe,
// integrazioni, comunicazioni, esito procedimento) — la prima risposta
// resta su non_conformities.data_riscontro_segnalante, questo copre il
// resto della corrispondenza nel tempo. Stile card ispirato a
// RegistroAttivitaModal.jsx.
import { useEffect, useRef, useState } from 'react';
import { Plus, ChevronDown, Trash2, Paperclip } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  fetchCorrispondenza, addCorrispondenza, deleteCorrispondenza,
  uploadAllegato, getAllegatoUrl,
} from '../../services/verbaliIspettiviService';

const TIPO_OPTIONS = [
  { value: 'risposta_iniziale', label: 'Risposta iniziale' },
  { value: 'proroga_richiesta', label: 'Proroga richiesta' },
  { value: 'proroga_concessa', label: 'Proroga concessa' },
  { value: 'integrazione', label: 'Integrazione documentazione' },
  { value: 'comunicazione_ente', label: 'Comunicazione dall\'ente' },
  { value: 'esito_procedimento', label: 'Esito procedimento' },
  { value: 'altro', label: 'Altro' },
];

const EMPTY_FORM = { tipo: 'comunicazione_ente', direzione: 'in_uscita', data: new Date().toISOString().slice(0, 10), oggetto: '', testo: '', protocollo: '' };

function DirBadge({ direzione }) {
  return direzione === 'in_uscita'
    ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg border bg-indigo-50 text-indigo-700 border-indigo-200">→ Inviata</span>
    : <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg border bg-slate-100 text-slate-600 border-slate-200">← Ricevuta</span>;
}

export default function CorrispondenzaPanel({ verbaleId, facilityId }) {
  const { profile } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [attachment, setAttachment] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef();

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

  const save = async () => {
    if (!form.data) { setError('La data è obbligatoria.'); return; }
    setSaving(true);
    setError('');
    try {
      let allegatoStoragePath = null;
      if (attachment) {
        const { path } = await uploadAllegato(facilityId, verbaleId, attachment);
        allegatoStoragePath = path;
      }
      await addCorrispondenza({ verbaleId, ...form, allegatoStoragePath, createdBy: profile?.id });
      setForm(EMPTY_FORM);
      setAttachment(null);
      setShowForm(false);
      await load();
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

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Corrispondenza con l'ente</p>
        <button onClick={() => setShowForm(s => !s)} className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800">
          <Plus size={12} /> Aggiungi
        </button>
      </div>

      {showForm && (
        <div className="border border-slate-200 rounded-xl p-3 mb-3 bg-slate-50 space-y-2">
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

          {attachment ? (
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-2 py-1.5">
              <Paperclip size={12} className="text-indigo-600 flex-shrink-0" />
              <span className="text-xs text-slate-600 truncate flex-1">{attachment.name}</span>
              <button onClick={() => setAttachment(null)} className="text-slate-400 hover:text-slate-600 text-xs">✕</button>
            </div>
          ) : (
            <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 hover:text-indigo-800">
              <Paperclip size={12} /> Allega file (opzionale)
            </button>
          )}
          <input ref={fileInputRef} type="file" className="hidden" onChange={e => setAttachment(e.target.files?.[0] ?? null)} />

          {error && <p className="text-[11px] font-bold text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setAttachment(null); }} className="text-[11px] font-bold text-slate-500 px-3 py-1.5 rounded-lg hover:bg-slate-100">Annulla</button>
            <button onClick={save} disabled={saving} className="text-[11px] font-bold text-white bg-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50">Salva</button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-slate-400">Caricamento...</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-slate-400 italic">Nessuna corrispondenza registrata oltre alla risposta iniziale.</p>
      ) : (
        <div className="space-y-1.5">
          {items.map(item => (
            <div key={item.id} className="border border-slate-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setExpanded(e => (e === item.id ? null : item.id))}
                className="w-full flex items-center justify-between px-3 py-2 bg-white hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-2 text-left flex-wrap min-w-0">
                  <DirBadge direzione={item.direzione} />
                  <span className="text-xs font-bold text-slate-700 truncate">{TIPO_OPTIONS.find(o => o.value === item.tipo)?.label || item.tipo}</span>
                  <span className="text-xs text-slate-400">{item.data}</span>
                  {item.oggetto && <span className="text-xs text-slate-400 truncate">— {item.oggetto}</span>}
                  {item.allegato_storage_path && <Paperclip size={11} className="text-indigo-400 flex-shrink-0" />}
                </div>
                <ChevronDown size={13} className={`text-slate-400 transition-transform shrink-0 ${expanded === item.id ? 'rotate-180' : ''}`} />
              </button>
              {expanded === item.id && (
                <div className="px-3 py-2.5 border-t border-slate-100 bg-slate-50 text-xs text-slate-600 space-y-2">
                  {item.protocollo && <p><b>Protocollo:</b> {item.protocollo}</p>}
                  {item.testo && <p className="whitespace-pre-wrap">{item.testo}</p>}
                  <div className="flex items-center gap-3">
                    {item.allegato_storage_path && (
                      <button onClick={() => scaricaAllegato(item.allegato_storage_path)} className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800">
                        <Paperclip size={11} /> Apri allegato
                      </button>
                    )}
                    <button onClick={() => remove(item.id)} className="flex items-center gap-1 text-[11px] font-bold text-red-500 hover:text-red-700">
                      <Trash2 size={11} /> Elimina
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
