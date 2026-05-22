// src/components/DocFirmeModal.jsx
import React, { useState, useEffect } from 'react';
import { PenLine, Trash2, Plus, Loader2 } from 'lucide-react';
import { supabase } from '../supabaseClient';

export default function DocFirmeModal({ onClose }) {
  const [firme,      setFirme]      = useState([]);
  const [signedUrls, setSignedUrls] = useState({});
  const [loading,    setLoading]    = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form,     setForm]     = useState({ nome: '', ruolo: '', file: null, preview: null });

  const caricaFirme = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('document_signatures')
      .select('*')
      .order('nome');
    const firmeData = data ?? [];
    setFirme(firmeData);
    const urls = {};
    await Promise.all(firmeData.map(async f => {
      const { data: sd } = await supabase.storage
        .from('signatures')
        .createSignedUrl(f.firma_url, 3600);
      if (sd?.signedUrl) urls[f.id] = sd.signedUrl;
    }));
    setSignedUrls(urls);
    setLoading(false);
  };

  useEffect(() => { caricaFirme(); }, []);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setForm(p => ({ ...p, file, preview }));
  };

  const handleAddFirma = async () => {
    if (!form.nome.trim())  { setError('Inserisci il nome'); return; }
    if (!form.ruolo.trim()) { setError('Inserisci il ruolo'); return; }
    if (!form.file)         { setError("Seleziona un'immagine firma"); return; }
    setSaving(true);
    setError('');
    try {
      const path = `firme/${Date.now()}_${form.file.name}`;
      const { error: upErr } = await supabase.storage
        .from('signatures')
        .upload(path, form.file, { upsert: false });
      if (upErr) throw new Error(upErr.message);
      const { error: insErr } = await supabase
        .from('document_signatures')
        .insert({ nome: form.nome.trim(), ruolo: form.ruolo.trim(), firma_url: path });
      if (insErr) throw new Error(insErr.message);
      setForm({ nome: '', ruolo: '', file: null, preview: null });
      setShowForm(false);
      await caricaFirme();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, firma_url) => {
    setError('');
    try {
      await supabase.storage.from('signatures').remove([firma_url]);
      await supabase.from('document_signatures').delete().eq('id', id);
      setFirme(p => p.filter(f => f.id !== id));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">

      {/* Header */}
      <div className="bg-slate-950 px-7 py-5 flex items-center gap-3">
        <div className="p-2 bg-slate-800 rounded-xl text-white">
          <PenLine size={20} />
        </div>
        <h2 className="text-base font-black text-white uppercase tracking-wider">
          Gestione Firme
        </h2>
      </div>

      {/* Body */}
      <div className="p-6 space-y-5">

        {error && (
          <p className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 px-4 py-2 rounded-xl">
            {error}
          </p>
        )}

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 size={24} className="text-slate-300 animate-spin" />
          </div>
        ) : (
          <>
            {firme.length === 0 && !showForm ? (
              <div className="flex flex-col items-center justify-center py-16 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                <PenLine size={32} className="text-slate-300 mb-3" />
                <p className="font-black text-slate-400">Nessuna firma registrata</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {firme.map(f => (
                  <div key={f.id} className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-3 shadow-sm">
                    <div className="bg-slate-50 rounded-xl p-3 flex items-center justify-center min-h-[80px]">
                      <img
                        src={signedUrls[f.id] ?? ''}
                        alt={f.nome}
                        className="max-h-16 object-contain"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-black text-slate-800 text-sm">{f.nome}</p>
                        <span className="inline-block text-[11px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-lg mt-1">
                          {f.ruolo}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDelete(f.id, f.firma_url)}
                        className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Elimina firma"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!showForm && (
              <button
                onClick={() => { setShowForm(true); setError(''); }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black uppercase
                  bg-slate-900 text-white hover:bg-slate-700 transition-colors shadow-sm"
              >
                <Plus size={14} /> Aggiungi firma
              </button>
            )}

            {showForm && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Nuova firma</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-wide block mb-1">Nome</label>
                    <input
                      type="text"
                      value={form.nome}
                      onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
                      placeholder="Es. Mario Rossi"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium
                        outline-none focus:ring-2 focus:ring-slate-400"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-wide block mb-1">Ruolo</label>
                    <input
                      type="text"
                      value={form.ruolo}
                      onChange={e => setForm(p => ({ ...p, ruolo: e.target.value }))}
                      placeholder="Es. Direttore Sanitario"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium
                        outline-none focus:ring-2 focus:ring-slate-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-wide block mb-1">Immagine firma</label>
                  <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-300
                    rounded-xl px-4 py-6 cursor-pointer hover:border-slate-500 hover:bg-white transition-all">
                    {form.preview ? (
                      <img src={form.preview} alt="preview" className="max-h-16 object-contain" />
                    ) : (
                      <span className="text-sm font-bold text-slate-400">Clicca per caricare immagine</span>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </label>
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={() => {
                      setShowForm(false);
                      setForm({ nome: '', ruolo: '', file: null, preview: null });
                      setError('');
                    }}
                    className="px-5 py-2.5 rounded-xl text-sm font-black uppercase text-slate-500 hover:bg-slate-200 transition-colors"
                  >
                    Annulla
                  </button>
                  <button
                    onClick={handleAddFirma}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black uppercase
                      bg-slate-900 text-white hover:bg-slate-700 transition-colors disabled:opacity-50 shadow"
                  >
                    {saving
                      ? <><Loader2 size={14} className="animate-spin" /> Salvataggio…</>
                      : 'Salva'
                    }
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-100 px-7 py-4 bg-slate-50 flex justify-end">
        <button
          onClick={onClose}
          className="px-5 py-2.5 rounded-xl text-sm font-black uppercase text-slate-500 hover:bg-slate-200 transition-colors"
        >
          Chiudi
        </button>
      </div>

    </div>
  );
}
