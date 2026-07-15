// src/components/CampagneSurveyModal.jsx
import { useState, useEffect } from 'react';
import { X, Plus, Lock, Archive, Calendar } from 'lucide-react';
import { supabase } from '../supabaseClient';

const STATO_CFG = {
  aperta:       { label: 'Aperta',       bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  chiusa:       { label: 'Chiusa',       bg: 'bg-slate-50',   text: 'text-slate-600',   border: 'border-slate-200'   },
  storicizzata: { label: 'Storicizzata', bg: 'bg-indigo-50',  text: 'text-indigo-700',  border: 'border-indigo-200'  },
};

export default function CampagneSurveyModal({ isOpen, onClose }) {
  const [campagne, setCampagne]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [saving, setSaving]       = useState(false);
  const [form, setForm] = useState({
    nome: '', survey_type: 'client',
    data_inizio: '', data_fine: '', note: ''
  });

  useEffect(() => {
    if (!isOpen) return;
    supabase.from('survey_campagne')
      .select('*')
      .order('data_inizio', { ascending: false })
      .then(({ data }) => { setCampagne(data ?? []); setLoading(false); });
  }, [isOpen]);

  const handleSave = async () => {
    if (!form.nome || !form.data_inizio || !form.data_fine) return;
    setSaving(true);
    const { data } = await supabase.from('survey_campagne')
      .insert({ ...form, stato: 'aperta' })
      .select().single();
    if (data) setCampagne(prev => [data, ...prev]);
    setShowForm(false);
    setForm({ nome: '', survey_type: 'client', data_inizio: '', data_fine: '', note: '' });
    setSaving(false);
  };

  const handleStato = async (id, stato) => {
    await supabase.from('survey_campagne').update({ stato }).eq('id', id);
    setCampagne(prev => prev.map(c => c.id === id ? { ...c, stato } : c));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-black text-slate-800">Campagne Survey</h2>
            <p className="text-xs text-slate-500 mt-0.5">Gestisci i periodi di rilevazione</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowForm(f => !f)}
              className="flex items-center gap-2 bg-indigo-600 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-indigo-700 transition-colors"
            >
              <Plus size={14} /> Nuova campagna
            </button>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
              <X size={18} className="text-slate-400" />
            </button>
          </div>
        </div>

        {/* Form nuova campagna */}
        {showForm && (
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
            <p className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-3">Nuova campagna</p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="col-span-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nome campagna</label>
                <input
                  value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  placeholder="es. Clienti · Primo Semestre 2026"
                  className="mt-1 w-full text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-400"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tipo</label>
                <select
                  value={form.survey_type}
                  onChange={e => setForm(f => ({ ...f, survey_type: e.target.value }))}
                  className="mt-1 w-full text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-400"
                >
                  <option value="client">Clienti / Ospiti</option>
                  <option value="operator">Staff / Operatori</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Data inizio</label>
                <input type="date" value={form.data_inizio}
                  onChange={e => setForm(f => ({ ...f, data_inizio: e.target.value }))}
                  className="mt-1 w-full text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-400"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Data fine</label>
                <input type="date" value={form.data_fine}
                  onChange={e => setForm(f => ({ ...f, data_fine: e.target.value }))}
                  className="mt-1 w-full text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-400"
                />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Note (opzionale)</label>
                <input value={form.note}
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  placeholder="es. Include dati CDI da febbraio"
                  className="mt-1 w-full text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-400"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowForm(false)} className="text-xs font-bold text-slate-500 px-4 py-2 rounded-xl hover:bg-slate-100">Annulla</button>
              <button onClick={handleSave} disabled={saving} className="text-xs font-bold bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 disabled:opacity-50">
                {saving ? 'Salvataggio...' : 'Salva campagna'}
              </button>
            </div>
          </div>
        )}

        {/* Lista campagne */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <p className="text-sm text-slate-400 text-center py-8">Caricamento...</p>
          ) : campagne.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">Nessuna campagna creata</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {campagne.map(c => {
                const cfg = STATO_CFG[c.stato] ?? STATO_CFG.aperta;
                return (
                  <div key={c.id} className="py-4 flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                          {cfg.label}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {c.survey_type === 'client' ? 'Clienti' : 'Operatori'}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-slate-800 truncate">{c.nome}</p>
                      <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                        <Calendar size={10} />
                        {c.data_inizio} → {c.data_fine}
                      </p>
                      {c.note && <p className="text-xs text-slate-400 mt-0.5 italic">{c.note}</p>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {c.stato === 'aperta' && (
                        <button
                          onClick={() => handleStato(c.id, 'chiusa')}
                          className="flex items-center gap-1 text-[10px] font-bold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                        >
                          <Lock size={10} /> Chiudi
                        </button>
                      )}
                      {c.stato === 'chiusa' && (
                        <button
                          onClick={() => handleStato(c.id, 'storicizzata')}
                          className="flex items-center gap-1 text-[10px] font-bold px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                        >
                          <Archive size={10} /> Storicizza
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
