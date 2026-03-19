import React, { useState, useEffect } from 'react';
import { X, Save, Trash2, Loader2 } from 'lucide-react';
import { supabase }         from '../supabaseClient';
import { REGIONI_ITALIANE } from '../config/constants';

const EMPTY = {
  name: '', udo_id: '', company_id: '',
  regione: '', indirizzo: '', posti_letto: 0,
  direttore: '', email_direzione: '',
  dir_sanitario: '', email_sanitario: '',
  ref_struttura: '', email_ref_struttura: '',
  referente: '', email_qualita: '',
};

const INPUT    = 'w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none text-slate-700';
const INPUT_SM = 'w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none text-slate-700';
const LABEL    = 'block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2';
const LABEL_SM = 'block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1';

function facilityToForm(f) {
  return {
    name:                f.name                      || '',
    udo_id:              f.udo_id                    || '',
    company_id:          f.company_id                || '',
    regione:             f.region                    || '',
    indirizzo:           f.address                   || '',
    posti_letto:         f.bed_count                 || 0,
    direttore:           f.director                  || '',
    email_direzione:     f.email_direzione            || '',
    dir_sanitario:       f.director_sanitario        || '',
    email_sanitario:     f.email_sanitario           || '',
    ref_struttura:       f.referente_struttura       || '',
    email_ref_struttura: f.email_referente_struttura || '',
    referente:           f.referent                  || '',
    email_qualita:       f.email_qualita             || '',
  };
}

export default function FacilityModal({ isOpen, onClose, udos, facility, onSave, onDelete }) {
  const [form, setForm]           = useState(EMPTY);
  const [companies, setCompanies] = useState([]);
  const [loadingCo, setLoadingCo] = useState(false);
  const [loadingFacility, setLoadingFacility] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [errors, setErrors]       = useState({});

  useEffect(() => {
    if (!isOpen) return;
    setErrors({});
    if (facility?.id) {
      setLoadingFacility(true);
      supabase.from('facilities').select('*').eq('id', facility.id).single()
        .then(({ data, error }) => {
          setForm(error || !data ? facilityToForm(facility) : facilityToForm(data));
          setLoadingFacility(false);
        });
    } else {
      setForm(EMPTY);
    }
  }, [facility?.id, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setLoadingCo(true);
    supabase.from('companies').select('id, name').order('name')
      .then(({ data, error }) => {
        if (!error && data) setCompanies(data);
        setLoadingCo(false);
      });
  }, [isOpen]);

  if (!isOpen) return null;

  const set = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name   = 'Campo obbligatorio';
    if (!form.udo_id)      e.udo_id = 'Campo obbligatorio';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setSaving(true);
    try {
      const payload = {
        ...(facility?.id ? { id: facility.id } : {}),
        name:                      form.name.trim(),
        udo_id:                    parseInt(form.udo_id, 10),
        company_id:                form.company_id ? parseInt(form.company_id, 10) : null,
        region:                    form.regione               || null,
        address:                   form.indirizzo.trim()      || null,
        bed_count:                 parseInt(form.posti_letto, 10) || 0,
        director:                  form.direttore.trim()      || null,
        email_direzione:           form.email_direzione.trim()|| null,
        director_sanitario:        form.dir_sanitario.trim()  || null,
        email_sanitario:           form.email_sanitario.trim()|| null,
        referente_struttura:       form.ref_struttura.trim()  || null,
        email_referente_struttura: form.email_ref_struttura.trim() || null,
        referent:                  form.referente.trim()      || null,
        email_qualita:             form.email_qualita.trim()  || null,
      };
      await onSave(payload);
    } catch (err) {
      setErrors({ _global: `Errore di salvataggio: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (window.confirm('Eliminare questa struttura? L\'operazione è irreversibile.')) {
      onDelete(facility.id);
    }
  };

  const ContactBlock = ({ title, nameField, emailField, namePlaceholder, emailPlaceholder }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
      <p className="md:col-span-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
      <div>
        <label className={LABEL_SM}>{namePlaceholder ? 'Nome' : 'Nome'}</label>
        <input type="text" value={form[nameField]} onChange={set(nameField)} className={INPUT_SM} placeholder={namePlaceholder} />
      </div>
      <div>
        <label className={LABEL_SM}>Email</label>
        <input type="email" value={form[emailField]} onChange={set(emailField)} className={INPUT_SM} placeholder={emailPlaceholder} />
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">

        <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex justify-between items-center shrink-0">
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">
            {facility ? 'Modifica Struttura' : 'Nuova Struttura'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-rose-500 transition-colors p-1">
            <X size={20} />
          </button>
        </div>

        {loadingFacility ? (
          <div className="flex-1 flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-indigo-400" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
            <div className="p-6 space-y-6">

              {errors._global && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 font-medium">
                  {errors._global}
                </div>
              )}

              {/* Dati identificativi */}
              <div className="space-y-4">
                <h3 className="text-xs font-black text-indigo-600 uppercase tracking-widest border-b pb-2">Dati identificativi</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className={LABEL}>Nome struttura *</label>
                    <input type="text" value={form.name} onChange={set('name')} className={INPUT} placeholder="Es: RSA Villa Serena" />
                    {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
                  </div>
                  <div>
                    <label className={LABEL}>Unità d'offerta (UDO) *</label>
                    <select value={form.udo_id} onChange={set('udo_id')} className={INPUT}>
                      <option value="">Seleziona UDO...</option>
                      {udos.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                    {errors.udo_id && <p className="text-xs text-red-600 mt-1">{errors.udo_id}</p>}
                  </div>
                  <div>
                    <label className={LABEL}>Società</label>
                    <select value={form.company_id} onChange={set('company_id')} className={INPUT} disabled={loadingCo}>
                      <option value="">{loadingCo ? 'Caricamento...' : 'Nessuna'}</option>
                      {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Logistica */}
              <div className="space-y-4">
                <h3 className="text-xs font-black text-indigo-600 uppercase tracking-widest border-b pb-2">Logistica e capacità</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className={LABEL}>Regione</label>
                    <select value={form.regione} onChange={set('regione')} className={INPUT}>
                      <option value="">Seleziona...</option>
                      {REGIONI_ITALIANE.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={LABEL}>Indirizzo</label>
                    <input type="text" value={form.indirizzo} onChange={set('indirizzo')} className={INPUT} placeholder="Via Roma 1, Milano" />
                  </div>
                  <div>
                    <label className={LABEL}>Posti letto</label>
                    <input type="number" min="0" value={form.posti_letto} onChange={set('posti_letto')} className={INPUT} />
                  </div>
                </div>
              </div>

              {/* Contatti */}
              <div className="space-y-3">
                <h3 className="text-xs font-black text-indigo-600 uppercase tracking-widest border-b pb-2">Contatti e riferimenti</h3>
                <ContactBlock title="Direzione"            nameField="direttore"      emailField="email_direzione"      namePlaceholder="Mario Rossi"      emailPlaceholder="direzione@struttura.it" />
                <ContactBlock title="Direzione sanitaria"  nameField="dir_sanitario"  emailField="email_sanitario"      namePlaceholder="Dott. Bianchi"    emailPlaceholder="sanitario@struttura.it" />
                <ContactBlock title="Referente struttura"  nameField="ref_struttura"  emailField="email_ref_struttura"  namePlaceholder="Anna Verdi"       emailPlaceholder="referente@struttura.it" />
                <ContactBlock title="Referente qualità"    nameField="referente"      emailField="email_qualita"        namePlaceholder="Laura Bianchi"    emailPlaceholder="qualita@struttura.it" />
              </div>

            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
              {facility ? (
                <button type="button" onClick={handleDelete} className="flex items-center gap-2 text-xs font-black text-rose-500 uppercase tracking-widest hover:text-rose-700 transition-colors">
                  <Trash2 size={14} /> Elimina
                </button>
              ) : <div />}
              <div className="flex gap-3">
                <button type="button" onClick={onClose} className="px-6 py-3 rounded-xl text-xs font-black uppercase text-slate-500 hover:bg-slate-200 transition-colors">
                  Annulla
                </button>
                <button type="submit" disabled={saving} className="flex items-center gap-2 bg-indigo-600 text-white px-8 py-3 rounded-xl text-xs font-black uppercase shadow-md hover:bg-indigo-700 transition-colors disabled:opacity-60">
                  <Save size={14} />
                  {saving ? 'Salvataggio...' : 'Salva'}
                </button>
              </div>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
