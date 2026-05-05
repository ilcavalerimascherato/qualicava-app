// src/components/DocStrutturaPanel.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2, Save, CheckCircle2, AlertTriangle,
  Loader2, Upload, XCircle,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth }  from '../contexts/AuthContext';

// ─── campi configurazione ─────────────────────────────────────

const FACILITY_FIELDS = [
  { key: 'director',               label: 'Direttore',                     type: 'text' },
  { key: 'director_sanitario',     label: 'Direttore sanitario',           type: 'text' },
  { key: 'email_direzione',        label: 'Email direzione',               type: 'email' },
  { key: 'email_sanitario',        label: 'Email sanitario',               type: 'email' },
  { key: 'email_qualita',          label: 'Email qualità',                 type: 'email' },
  { key: 'referente_struttura',    label: 'Referente struttura',           type: 'text' },
  { key: 'email_referente_struttura', label: 'Email referente struttura',  type: 'email' },
];

const COMPANY_FIELDS = [
  { key: 'piva',          label: 'Partita IVA',   type: 'text' },
  { key: 'sede_legale',   label: 'Sede legale',   type: 'text' },
  { key: 'codice_fiscale',label: 'Codice fiscale',type: 'text' },
];

// ─── helper completamento ─────────────────────────────────────

function calcCompletamento(fForm, cForm) {
  const all = [
    ...FACILITY_FIELDS.map(f => fForm[f.key]),
    ...COMPANY_FIELDS.map(f => cForm[f.key]),
    cForm.logo_url,
  ];
  const filled = all.filter(v => v && String(v).trim() !== '').length;
  return Math.round((filled / all.length) * 100);
}

function SemaforoComp({ pct }) {
  if (pct >= 80)
    return <span className="flex items-center gap-1.5 text-xs font-black text-emerald-600">
      <CheckCircle2 size={14} /> Pronto per documenti
    </span>;
  if (pct >= 40)
    return <span className="flex items-center gap-1.5 text-xs font-black text-amber-600">
      <AlertTriangle size={14} /> Dati parziali
    </span>;
  return <span className="flex items-center gap-1.5 text-xs font-black text-rose-600">
    <XCircle size={14} /> Dati mancanti
  </span>;
}

function FormField({ label, type, value, onChange, disabled }) {
  return (
    <div>
      <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1">
        {label}
      </label>
      <input
        type={type}
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium
          outline-none focus:ring-2 focus:ring-indigo-400 transition-all
          disabled:opacity-50 disabled:cursor-not-allowed"
      />
    </div>
  );
}

// ─── componente principale ────────────────────────────────────

export default function DocStrutturaPanel() {
  const { profile, isAdmin, isSuperAdmin } = useAuth();

  const [facilities,      setFacilities]      = useState([]);
  const [selectedId,      setSelectedId]      = useState('');
  const [facilityForm,    setFacilityForm]     = useState({});
  const [companyForm,     setCompanyForm]      = useState({});
  const [companyId,       setCompanyId]        = useState(null);
  const [loadingFac,      setLoadingFac]       = useState(true);
  const [loadingData,     setLoadingData]      = useState(false);
  const [saving,          setSaving]           = useState(false);
  const [savedOk,         setSavedOk]          = useState(false);
  const [error,           setError]            = useState('');
  const [uploadingLogo,   setUploadingLogo]    = useState(false);

  // Carica lista strutture
  useEffect(() => {
    (async () => {
      setLoadingFac(true);
      try {
        let q = supabase
          .from('facilities')
          .select('id, name, company_id')
          .eq('is_suspended', false)
          .order('name');

        if (!isSuperAdmin && !isAdmin && profile?.accessibleFacilityIds?.length) {
          q = q.in('id', profile.accessibleFacilityIds);
        }

        const { data, error: e } = await q;
        if (e) throw e;
        const facs = data ?? [];
        setFacilities(facs);

        // Auto-select: director con una struttura, o prima struttura disponibile
        const defaultId = profile?.accessibleFacilityIds?.length === 1
          ? String(profile.accessibleFacilityIds[0])
          : facs[0]?.id ? String(facs[0].id) : '';
        if (defaultId) setSelectedId(defaultId);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoadingFac(false);
      }
    })();
  }, [profile, isAdmin, isSuperAdmin]);

  // Carica dati struttura/company selezionata
  useEffect(() => {
    if (!selectedId) return;
    (async () => {
      setLoadingData(true);
      setSavedOk(false);
      setError('');
      try {
        const { data: fac, error: e1 } = await supabase
          .from('facilities')
          .select('*')
          .eq('id', selectedId)
          .single();
        if (e1) throw e1;

        const fForm = {};
        FACILITY_FIELDS.forEach(f => { fForm[f.key] = fac[f.key] ?? ''; });
        setFacilityForm(fForm);
        setCompanyId(fac.company_id);

        if (fac.company_id) {
          const { data: comp, error: e2 } = await supabase
            .from('companies')
            .select('*')
            .eq('id', fac.company_id)
            .single();
          if (!e2 && comp) {
            const cForm = {};
            COMPANY_FIELDS.forEach(f => { cForm[f.key] = comp[f.key] ?? ''; });
            cForm.logo_url = comp.logo_url ?? '';
            setCompanyForm(cForm);
          }
        }
      } catch (e) {
        setError(e.message);
      } finally {
        setLoadingData(false);
      }
    })();
  }, [selectedId]);

  const setFacField = useCallback((key, val) =>
    setFacilityForm(p => ({ ...p, [key]: val })), []);

  const setComField = useCallback((key, val) =>
    setCompanyForm(p => ({ ...p, [key]: val })), []);

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !companyId) return;
    setUploadingLogo(true);
    try {
      const ext  = file.name.split('.').pop();
      const path = `logos/${companyId}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('company-assets')
        .upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;
      const { data: { publicUrl } } = supabase.storage
        .from('company-assets')
        .getPublicUrl(path);
      setComField('logo_url', publicUrl);
    } catch (e) {
      setError(`Logo: ${e.message}`);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSave = async () => {
    if (!selectedId) return;
    setSaving(true);
    setSavedOk(false);
    setError('');
    try {
      const { error: e1 } = await supabase
        .from('facilities')
        .update(facilityForm)
        .eq('id', selectedId);
      if (e1) throw e1;

      if (companyId) {
        const { error: e2 } = await supabase
          .from('companies')
          .update(companyForm)
          .eq('id', companyId);
        if (e2) throw e2;
      }

      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 3000);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const completamento = calcCompletamento(facilityForm, companyForm);

  if (loadingFac) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={28} className="text-indigo-400 animate-spin" />
      </div>
    );
  }

  if (facilities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <AlertTriangle size={32} className="text-amber-300 mb-3" />
        <p className="font-black text-slate-400 uppercase tracking-wide">
          Nessuna struttura accessibile
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Selettore struttura */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-800">Dati struttura</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Completa le informazioni usate per compilare automaticamente i documenti
          </p>
        </div>
        {facilities.length > 1 && (
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            className="rounded-xl border-2 border-slate-200 bg-white px-4 py-2.5 text-sm font-bold
              outline-none focus:border-indigo-400 transition-all max-w-xs"
          >
            {facilities.map(f => (
              <option key={f.id} value={String(f.id)}>{f.name}</option>
            ))}
          </select>
        )}
      </div>

      {loadingData ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="text-indigo-400 animate-spin" />
        </div>
      ) : (
        <>
          {/* Barra completamento */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-black text-slate-700">Completamento profilo</p>
                <SemaforoComp pct={completamento} />
              </div>
              <span className={`text-3xl font-black ${
                completamento >= 80 ? 'text-emerald-600' :
                completamento >= 40 ? 'text-amber-600'   : 'text-rose-600'
              }`}>{completamento}%</span>
            </div>
            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  completamento >= 80 ? 'bg-emerald-500' :
                  completamento >= 40 ? 'bg-amber-400'   : 'bg-rose-400'
                }`}
                style={{ width: `${completamento}%` }}
              />
            </div>
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm font-bold px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          {/* Dati struttura */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100 bg-slate-50">
              <Building2 size={16} className="text-indigo-500" />
              <h3 className="font-black text-slate-700 text-sm uppercase tracking-wider">Dati struttura</h3>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              {FACILITY_FIELDS.map(f => (
                <FormField
                  key={f.key}
                  label={f.label}
                  type={f.type}
                  value={facilityForm[f.key]}
                  onChange={v => setFacField(f.key, v)}
                />
              ))}
            </div>
          </div>

          {/* Dati azienda */}
          {companyId && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100 bg-slate-50">
                <Building2 size={16} className="text-violet-500" />
                <h3 className="font-black text-slate-700 text-sm uppercase tracking-wider">Dati azienda</h3>
              </div>
              <div className="p-6 grid grid-cols-2 gap-4">
                {COMPANY_FIELDS.map(f => (
                  <FormField
                    key={f.key}
                    label={f.label}
                    type={f.type}
                    value={companyForm[f.key]}
                    onChange={v => setComField(f.key, v)}
                  />
                ))}

                {/* Logo upload */}
                <div className="col-span-2">
                  <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1">
                    Logo aziendale
                  </label>
                  <div className="flex items-center gap-4">
                    {companyForm.logo_url && (
                      <img
                        src={companyForm.logo_url}
                        alt="Logo"
                        className="h-12 w-auto rounded-lg border border-slate-200 object-contain"
                      />
                    )}
                    <label className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200
                      text-slate-600 rounded-xl text-xs font-black uppercase cursor-pointer transition-colors">
                      {uploadingLogo
                        ? <><Loader2 size={13} className="animate-spin" /> Caricamento…</>
                        : <><Upload size={13} /> Carica immagine</>
                      }
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                        disabled={uploadingLogo}
                      />
                    </label>
                    {companyForm.logo_url && (
                      <button
                        onClick={() => setComField('logo_url', '')}
                        className="text-rose-400 hover:text-rose-600 text-xs font-bold"
                      >
                        Rimuovi
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Salva */}
          <div className="flex justify-end gap-3">
            {savedOk && (
              <span className="flex items-center gap-1.5 text-sm font-black text-emerald-600 px-4 py-2.5">
                <CheckCircle2 size={16} /> Salvato
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black uppercase
                bg-indigo-600 text-white shadow hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {saving ? 'Salvataggio…' : 'Salva'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
