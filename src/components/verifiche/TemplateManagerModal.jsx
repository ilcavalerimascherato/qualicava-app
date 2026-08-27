// src/components/verifiche/TemplateManagerModal.jsx
// CRUD di un template di verifica: nome/categoria, cadenza strutturata
// (non testuale — unità+intervallo+ancora, come richiesto esplicitamente
// da Claudio così il sistema calcola la prossima scadenza deterministicamente),
// e le sotto-voci opzionali (pattern Heliopolis A1-A5).
import React, { useEffect, useState } from 'react';
import { X, Plus, Trash2, ClipboardList } from 'lucide-react';
import toast from 'react-hot-toast';
import { createTemplate, updateTemplate, getTemplateVoci, saveTemplateVoci } from '../../services/verificheService';
import { formatCadenza } from '../../utils/verificheCadenza';

const GIORNI_SETTIMANA = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

const EMPTY = {
  nome: '', categoria: '', rif: '',
  cadenza_unita: 'settimane', cadenza_intervallo: 1,
  cadenza_giorno_settimana: 4, cadenza_giorno_mese: null,
  attivo: true,
};

export default function TemplateManagerModal({ isOpen, onClose, template, onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const [voci, setVoci] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (template) {
      setForm({ ...EMPTY, ...template });
      getTemplateVoci(template.id).then(setVoci);
    } else {
      setForm(EMPTY);
      setVoci([]);
    }
  }, [isOpen, template]);

  if (!isOpen) return null;

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const addVoce = () => setVoci(v => [...v, { voce: '', rif: '' }]);
  const updateVoce = (i, field, value) => setVoci(v => v.map((x, idx) => idx === i ? { ...x, [field]: value } : x));
  const removeVoce = (i) => setVoci(v => v.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    if (!form.nome.trim() || !form.categoria.trim()) return;
    setSaving(true);
    try {
      const payload = {
        nome: form.nome.trim(),
        categoria: form.categoria.trim(),
        rif: form.rif || null,
        cadenza_unita: form.cadenza_unita,
        cadenza_intervallo: Number(form.cadenza_intervallo) || 1,
        cadenza_giorno_settimana: form.cadenza_unita === 'settimane' ? Number(form.cadenza_giorno_settimana) : null,
        cadenza_giorno_mese: form.cadenza_unita === 'mesi' && form.cadenza_giorno_mese ? Number(form.cadenza_giorno_mese) : null,
        attivo: form.attivo,
      };
      const saved = template ? await updateTemplate(template.id, payload) : await createTemplate(payload);
      const vociValide = voci.filter(v => v.voce?.trim());
      await saveTemplateVoci(saved.id, vociValide);
      onSaved();
    } catch (err) {
      toast.error(`Errore salvataggio template: ${err.message ?? err}`);
    } finally {
      setSaving(false);
    }
  };

  const INP = 'w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-400';

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <ClipboardList size={16} className="text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-800">{template ? 'Modifica template' : 'Nuovo template'}</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Nome *</label>
              <input className={INP} value={form.nome} onChange={set('nome')} placeholder="es. Adeguatezza personale" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Categoria *</label>
              <input className={INP} value={form.categoria} onChange={set('categoria')} placeholder="es. Personale, Igiene, Manutenzioni" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Riferimento procedura (opzionale)</label>
            <input className={INP} value={form.rif ?? ''} onChange={set('rif')} placeholder="es. Cap. Serv. p.10" />
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <label className="block text-xs font-semibold text-slate-500 mb-2">Cadenza — valori precisi, usati per calcolare la prossima scadenza</label>
            <div className="grid grid-cols-3 gap-2 items-end">
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">Ogni</label>
                <input type="number" min="1" className={INP} value={form.cadenza_intervallo} onChange={set('cadenza_intervallo')} />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">Unità</label>
                <select className={INP} value={form.cadenza_unita} onChange={set('cadenza_unita')}>
                  <option value="giorni">Giorni</option>
                  <option value="settimane">Settimane</option>
                  <option value="mesi">Mesi</option>
                </select>
              </div>
              {form.cadenza_unita === 'settimane' && (
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Giorno</label>
                  <select className={INP} value={form.cadenza_giorno_settimana ?? 4} onChange={set('cadenza_giorno_settimana')}>
                    {GIORNI_SETTIMANA.map((g, i) => <option key={i} value={i}>{g}</option>)}
                  </select>
                </div>
              )}
              {form.cadenza_unita === 'mesi' && (
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Giorno del mese (opz.)</label>
                  <input type="number" min="1" max="31" className={INP} value={form.cadenza_giorno_mese ?? ''} onChange={set('cadenza_giorno_mese')} placeholder="es. 28" />
                </div>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-2">Anteprima: <span className="font-semibold text-slate-600">{formatCadenza(form)}</span></p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-500">Sotto-voci (opzionale)</label>
              <button onClick={addVoce} className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800">
                <Plus size={12} /> Aggiungi voce
              </button>
            </div>
            {voci.length === 0 && <p className="text-[11px] text-slate-400">Nessuna sotto-voce — la sessione avrà un esito unico.</p>}
            <div className="space-y-2">
              {voci.map((v, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input className={`${INP} flex-1`} value={v.voce} onChange={e => updateVoce(i, 'voce', e.target.value)} placeholder="Voce di controllo" />
                  <input className={`${INP} w-28`} value={v.rif ?? ''} onChange={e => updateVoce(i, 'rif', e.target.value)} placeholder="Rif." />
                  <button onClick={() => removeVoce(i)} className="text-slate-300 hover:text-red-500"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={form.attivo} onChange={e => setForm(f => ({ ...f, attivo: e.target.checked }))} />
            Template attivo
          </label>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100 bg-slate-50 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 rounded-lg">Annulla</button>
          <button
            onClick={handleSave}
            disabled={saving || !form.nome.trim() || !form.categoria.trim()}
            className="px-4 py-2 text-sm font-semibold bg-emerald-600 text-white rounded-lg disabled:opacity-50"
          >
            Salva
          </button>
        </div>
      </div>
    </div>
  );
}
