// src/components/CompanyConfigTab.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Save, Plus, Loader2, X, Upload, Building2 } from 'lucide-react';
import { supabase } from '../supabaseClient';

const INPUT = 'w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-400 outline-none text-slate-700';
const LABEL = 'block text-xs font-black text-slate-400 uppercase tracking-wider mb-1';

const EMPTY_CO = {
  name: '', piva: '', codice_fiscale: '', sede_legale: '',
  pec: '', telefono: '', referente: '',
};

export default function CompanyConfigTab() {
  const [companies,   setCompanies]   = useState([]);
  const [selected,    setSelected]    = useState(null);
  const [form,        setForm]        = useState(EMPTY_CO);
  const [logoFile,    setLogoFile]    = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoUrl,     setLogoUrl]     = useState(null);
  const [saving,      setSaving]      = useState(false);
  const [errors,      setErrors]      = useState({});
  const fileInputRef = useRef(null);

  const loadCompanies = async () => {
    const { data } = await supabase.from('companies').select('*').order('name');
    if (data) setCompanies(data);
  };

  useEffect(() => { loadCompanies(); }, []);

  const selectCompany = (co) => {
    setSelected(co);
    setForm({
      name:           co.name           || '',
      piva:           co.piva           || '',
      codice_fiscale: co.codice_fiscale || '',
      sede_legale:    co.sede_legale    || '',
      pec:            co.pec            || '',
      telefono:       co.telefono       || '',
      referente:      co.referente      || '',
    });
    setLogoFile(null);
    setLogoPreview(null);
    setLogoUrl(co.logo_url || null);
    setErrors({});
  };

  const newCompany = () => {
    setSelected({ id: null });
    setForm(EMPTY_CO);
    setLogoFile(null);
    setLogoPreview(null);
    setLogoUrl(null);
    setErrors({});
  };

  const set = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleLogoFile = (file) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, logo: 'Il file supera i 2MB consentiti' }));
      return;
    }
    setErrors(prev => { const e = { ...prev }; delete e.logo; return e; });
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setErrors({ name: 'Campo obbligatorio' }); return; }
    setSaving(true);
    try {
      const payload = {
        name:           form.name.trim(),
        piva:           form.piva.trim()           || null,
        codice_fiscale: form.codice_fiscale.trim() || null,
        sede_legale:    form.sede_legale.trim()    || null,
        pec:            form.pec.trim()            || null,
        telefono:       form.telefono.trim()       || null,
        referente:      form.referente.trim()      || null,
      };

      let savedId;
      if (selected?.id) {
        await supabase.from('companies').update(payload).eq('id', selected.id);
        savedId = selected.id;
      } else {
        const { data, error } = await supabase.from('companies').insert(payload).select().single();
        if (error) throw error;
        savedId = data.id;
      }

      if (logoFile) {
        const ext  = logoFile.name.split('.').pop().toLowerCase();
        const path = `${savedId}.${ext}`;
        await supabase.storage.from('company-logos').upload(path, logoFile, { upsert: true });
        const { data: pub } = supabase.storage.from('company-logos').getPublicUrl(path);
        await supabase.from('companies').update({ logo_url: pub.publicUrl }).eq('id', savedId);
      } else if (logoUrl === null && selected?.id && selected.logo_url) {
        await supabase.from('companies').update({ logo_url: null }).eq('id', savedId);
      }

      await loadCompanies();
      const { data: fresh } = await supabase.from('companies').select('*').eq('id', savedId).single();
      if (fresh) selectCompany(fresh);
    } catch (err) {
      setErrors({ _global: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full">

      {/* Sinistra: lista società */}
      <div className="w-[35%] border-r border-slate-100 flex flex-col">
        <div className="flex-1 overflow-y-auto">
          {companies.map(co => (
            <button
              key={co.id}
              onClick={() => selectCompany(co)}
              className={`w-full text-left px-4 py-3 border-b border-slate-100 flex items-center gap-3 transition-colors ${
                selected?.id === co.id
                  ? 'bg-indigo-50 border-l-4 border-l-indigo-500'
                  : 'hover:bg-slate-50'
              }`}
            >
              <Building2 size={14} className="text-slate-400 shrink-0" />
              <span className="text-sm font-bold text-slate-700 flex-1 truncate">{co.name}</span>
              {co.logo_url && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Logo presente" />
              )}
            </button>
          ))}
        </div>
        <div className="p-3 border-t border-slate-100 shrink-0">
          <button
            onClick={newCompany}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase text-indigo-600 border border-indigo-200 hover:bg-indigo-50 transition-colors"
          >
            <Plus size={13} /> Nuova Società
          </button>
        </div>
      </div>

      {/* Destra: form */}
      <div className="flex-1 overflow-y-auto p-5">
        {!selected ? (
          <div className="h-full flex items-center justify-center text-slate-300 text-sm font-bold">
            Seleziona una società o creane una nuova
          </div>
        ) : (
          <div className="space-y-4">
            {errors._global && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 font-medium">
                {errors._global}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={LABEL}>Nome società *</label>
                <input type="text" value={form.name} onChange={set('name')} className={INPUT} placeholder="Gruppo OVER Srl" />
                {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
              </div>
              <div>
                <label className={LABEL}>Partita IVA</label>
                <input type="text" value={form.piva} onChange={set('piva')} className={INPUT} placeholder="12345678901" />
              </div>
              <div>
                <label className={LABEL}>Codice Fiscale</label>
                <input type="text" value={form.codice_fiscale} onChange={set('codice_fiscale')} className={INPUT} placeholder="12345678901" />
              </div>
              <div className="col-span-2">
                <label className={LABEL}>Sede legale</label>
                <input type="text" value={form.sede_legale} onChange={set('sede_legale')} className={INPUT} placeholder="Via Roma 1, Milano (MI)" />
              </div>
              <div>
                <label className={LABEL}>PEC</label>
                <input type="email" value={form.pec} onChange={set('pec')} className={INPUT} placeholder="pec@pec.it" />
              </div>
              <div>
                <label className={LABEL}>Telefono</label>
                <input type="tel" value={form.telefono} onChange={set('telefono')} className={INPUT} placeholder="+39 02 12345678" />
              </div>
              <div className="col-span-2">
                <label className={LABEL}>Referente</label>
                <input type="text" value={form.referente} onChange={set('referente')} className={INPUT} placeholder="Nome e cognome" />
              </div>
            </div>

            {/* Logo */}
            <div>
              <label className={LABEL}>Logo società</label>
              {(logoPreview || logoUrl) ? (
                <div className="flex items-center gap-4 mt-1">
                  <img
                    src={logoPreview || logoUrl}
                    alt="Logo società"
                    style={{ maxHeight: '60px', objectFit: 'contain' }}
                    className="rounded border border-slate-200 bg-slate-50 p-2"
                  />
                  <button
                    type="button"
                    onClick={() => { setLogoFile(null); setLogoPreview(null); setLogoUrl(null); }}
                    className="text-rose-400 hover:text-rose-600 transition-colors p-1"
                    title="Rimuovi logo"
                  >
                    <X size={15} />
                  </button>
                </div>
              ) : (
                <div
                  className="mt-1 border-2 border-dashed border-slate-200 rounded-xl p-5 flex flex-col items-center gap-2 cursor-pointer hover:border-indigo-300 hover:bg-slate-50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); handleLogoFile(e.dataTransfer.files[0]); }}
                >
                  <Upload size={20} className="text-slate-300" />
                  <p className="text-sm text-slate-400">Trascina il logo o clicca per selezionare</p>
                  <p className="text-xs text-slate-300">PNG, JPG — max 2MB</p>
                </div>
              )}
              {errors.logo && <p className="text-xs text-red-600 mt-1">{errors.logo}</p>}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => handleLogoFile(e.target.files[0])}
              />
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase shadow hover:bg-indigo-700 transition-colors disabled:opacity-60"
            >
              {saving
                ? <><Loader2 size={13} className="animate-spin" /> Salvataggio…</>
                : <><Save size={13} /> Salva Società</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
