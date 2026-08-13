// src/components/UtentiRuoliModal.jsx
import React, { useState, useEffect } from 'react';
import { X, Search, Users, Edit2, Plus } from 'lucide-react';
import { supabase } from '../supabaseClient';

const RUOLI = ['superadmin', 'sede', 'admin', 'director'];
const RUOLO_COLORS = {
  superadmin: 'bg-purple-50 text-purple-700 border-purple-200',
  sede:       'bg-indigo-50 text-indigo-700 border-indigo-200',
  admin:      'bg-blue-50 text-blue-700 border-blue-200',
  director:   'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export default function UtentiRuoliModal({ isOpen, onClose, facilities, isSuperAdmin }) {
  const [utenti, setUtenti]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [editingId, setEditingId]     = useState(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [search, setSearch]           = useState('');
  const [filterFacility, setFilterFacility] = useState('');
  const [saving, setSaving]           = useState(false);
  const [inviting, setInviting]       = useState(false);
  const [inviteResult, setInviteResult] = useState(null);
  const [showSql, setShowSql]         = useState(false); // eslint-disable-line no-unused-vars

  const loadUtenti = () => {
    setLoading(true);
    // Due query separate per evitare problemi con FK join in Supabase.
    // Prima carica i profili, poi carica gli accessi e li unisce client-side.
    Promise.all([
      supabase
        .from('user_profiles')
        .select('id, email, full_name, role, company_id, created_at, updated_at')
        .order('full_name'),
      supabase
        .from('user_facility_access')
        .select('user_id, facility_id'),
    ]).then(([profilesRes, accessRes]) => {
      if (profilesRes.error) {
        console.error('[UtentiRuoliModal] errore profili:', profilesRes.error.message);
      }
      const profiles = profilesRes.data || [];
      const accesses = accessRes.data  || [];
      // Unisce gli accessi ai profili
      const merged = profiles.map(p => ({
        ...p,
        user_facility_access: accesses.filter(a => a.user_id === p.id),
      }));
      setUtenti(merged);
      setLoading(false);
    });
  };

  useEffect(() => {
    if (!isOpen) return;
    loadUtenti();
  }, [isOpen]);

  if (!isOpen) return null;

  const filtered = utenti.filter(u => {
    const matchSearch = !search ||
      u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase());

    const matchFacility = !filterFacility ||
      u.user_facility_access?.some(a => String(a.facility_id) === filterFacility);

    return matchSearch && matchFacility;
  });

  const inviteUser = async (form) => {
    setInviting(true);
    setInviteResult(null);
    try {
      const { userService } = await import('../services/supabaseService');
      const result = await userService.invite({
        email:       form.email,
        fullName:    form.fullName,
        role:        form.role,
        companyId:   form.companyId ? parseInt(form.companyId) : null,
        facilityIds: form.facilityIds,
      });
      setInviteResult({ success: true, msg: result.message || `Utente creato. Email inviata a ${form.email}.` });
      setShowNewForm(false);
      setTimeout(loadUtenti, 1500);
    } catch (err) {
      setInviteResult({ success: false, msg: 'Errore: ' + err.message });
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl overflow-hidden font-sans">

        {/* Header */}
        <div className="bg-slate-950 px-8 py-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-indigo-600 rounded-lg text-white"><Users size={22} /></div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-wider">Utenti e ruoli</h2>
              <p className="text-xs text-indigo-400 font-bold uppercase tracking-widest">Accessi e permessi applicazione</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-full transition-colors"><X size={26} /></button>
        </div>

        {/* Contenuto */}
        <div className="flex-1 overflow-y-auto bg-white p-8 min-h-0">
          <div className="space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="font-black text-slate-800 text-lg">Gestione Utenti</h3>
                <p className="text-sm text-slate-400 mt-0.5">{utenti.length} utenti registrati</p>
              </div>
              <button onClick={() => { setShowNewForm(true); setShowSql(false); }}
                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-black hover:bg-indigo-700 transition-colors shadow">
                <Plus size={15} /> Nuovo utente
              </button>
            </div>

            {showNewForm && (
              <NuovoUtenteForm
                facilities={facilities}
                onGenerate={inviteUser}
                onClose={() => setShowNewForm(false)}
              />
            )}

            {inviting && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 text-center">
                <p className="text-sm font-bold text-indigo-700 animate-pulse">Creazione utente in corso...</p>
              </div>
            )}
            {inviteResult && (
              <div className={`rounded-2xl p-4 flex items-start gap-3 ${inviteResult.success ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
                <span className="text-lg">{inviteResult.success ? '✓' : '✗'}</span>
                <div>
                  <p className={`text-sm font-bold ${inviteResult.success ? 'text-emerald-700' : 'text-red-700'}`}>{inviteResult.msg}</p>
                  {inviteResult.success && (
                    <p className="text-xs text-emerald-600 mt-1">Il direttore riceverà un'email per impostare la sua password.</p>
                  )}
                </div>
                <button onClick={() => setInviteResult(null)} className="ml-auto text-slate-400 hover:text-slate-600"><X size={14} /></button>
              </div>
            )}

            <div className="flex gap-3 flex-wrap">
              <div className="relative flex-1 min-w-48">
                <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
                <input type="text" placeholder="Cerca per nome o email..." value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-sm outline-none focus:border-indigo-400" />
              </div>
              <select value={filterFacility} onChange={e => setFilterFacility(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400 min-w-48">
                <option value="">Tutte le strutture</option>
                {[...facilities].sort((a,b) => a.name.localeCompare(b.name)).map(f => (
                  <option key={f.id} value={String(f.id)}>{f.name}</option>
                ))}
              </select>
            </div>

            {loading ? (
              <div className="text-center py-12 text-slate-400 animate-pulse font-bold">Caricamento...</div>
            ) : (
              <div className="space-y-3">
                {filtered.map(u => (
                  <UtenteCard
                    key={u.id}
                    utente={u}
                    facilities={facilities}
                    isEditing={editingId === u.id}
                    isSuperAdmin={isSuperAdmin}
                    onEdit={() => setEditingId(u.id)}
                    onCancel={() => setEditingId(null)}
                    onSaved={() => { setEditingId(null); loadUtenti(); }}
                    saving={saving}
                    setSaving={setSaving}
                  />
                ))}
                {filtered.length === 0 && (
                  <div className="text-center py-8 text-slate-400 font-bold">
                    {utenti.length === 0 ? 'Nessun utente trovato nel database' : 'Nessun risultato per la ricerca'}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── NuovoUtenteForm ───────────────────────────────────────────
function NuovoUtenteForm({ facilities, onGenerate, onClose }) {
  const [form, setForm] = useState({ email: '', fullName: '', role: 'director', companyId: '', facilityIds: [] });
  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }));
  const toggleFacility = id => setForm(p => ({
    ...p,
    facilityIds: p.facilityIds.includes(id) ? p.facilityIds.filter(x => x !== id) : [...p.facilityIds, id],
  }));
  const INP2 = 'w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400';

  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 space-y-4">
      <h4 className="font-black text-indigo-700 text-sm uppercase tracking-widest">Nuovo utente</h4>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">Email *</label>
          <input type="email" value={form.email} onChange={set('email')} className={INP2} placeholder="nome@azienda.it" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">Nome completo *</label>
          <input type="text" value={form.fullName} onChange={set('fullName')} className={INP2} placeholder="Nome Cognome" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">Ruolo *</label>
          <select value={form.role} onChange={set('role')} className={INP2}>
            {RUOLI.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">Company ID (lascia vuoto per accesso globale)</label>
          <input type="number" value={form.companyId} onChange={set('companyId')} className={INP2} placeholder="es. 11" />
        </div>
      </div>
      {form.role === 'director' && (
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-2">Strutture assegnate</label>
          <div className="max-h-40 overflow-y-auto grid grid-cols-2 gap-1.5">
            {facilities.filter(f => !f.is_suspended).map(f => (
              <label key={f.id} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer text-xs font-medium transition-colors ${
                form.facilityIds.includes(f.id) ? 'bg-indigo-100 text-indigo-700' : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}>
                <input type="checkbox" checked={form.facilityIds.includes(f.id)} onChange={() => toggleFacility(f.id)} className="accent-indigo-600" />
                {f.name}
              </label>
            ))}
          </div>
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">Annulla</button>
        <button onClick={() => { if (!form.email || !form.fullName) return; onGenerate(form); }}
          className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2 rounded-xl text-sm font-black hover:bg-indigo-700 transition-colors">
          <Plus size={13} /> Crea utente
        </button>
      </div>
    </div>
  );
}

// ── UtenteCard ────────────────────────────────────────────────
function UtenteCard({ utente: u, facilities, isEditing, isSuperAdmin, onEdit, onCancel, onSaved, saving, setSaving }) {
  const [form, setForm] = useState({
    role:        u.role,
    full_name:   u.full_name || '',
    company_id:  u.company_id || '',
    facilityIds: (u.user_facility_access || []).map(a => a.facility_id),
  });

  const set         = f => e => setForm(p => ({ ...p, [f]: e.target.value }));
  const toggleFacility = id => setForm(p => ({
    ...p,
    facilityIds: p.facilityIds.includes(id) ? p.facilityIds.filter(x => x !== id) : [...p.facilityIds, id],
  }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await supabase.from('user_profiles').update({
        role:       form.role,
        full_name:  form.full_name,
        company_id: form.company_id ? parseInt(form.company_id) : null,
      }).eq('id', u.id);

      if (form.role === 'director') {
        await supabase.from('user_facility_access').delete().eq('user_id', u.id);
        if (form.facilityIds.length > 0) {
          await supabase.from('user_facility_access').insert(
            form.facilityIds.map(fid => ({ user_id: u.id, facility_id: fid }))
          );
        }
      }
      onSaved();
    } catch (err) {
      alert('Errore: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const INP2 = 'w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400';
  const assignedFacilities = (u.user_facility_access || []).map(a => {
    const f = facilities.find(x => x.id === a.facility_id);
    return f?.name || `ID ${a.facility_id}`;
  });

  return (
    <div className={`bg-white border rounded-2xl overflow-hidden transition-all ${isEditing ? 'border-indigo-300 shadow-md' : 'border-slate-200'}`}>
      <div className="flex items-center justify-between p-4 gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
            <span className="text-sm font-black text-indigo-600">{(u.full_name || u.email || '?')[0].toUpperCase()}</span>
          </div>
          <div className="min-w-0">
            <p className="font-black text-slate-800 truncate">{u.full_name || '— nessun nome —'}</p>
            <p className="text-xs text-slate-400 truncate">{u.email}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {(u.updated_at && u.updated_at !== u.created_at) ? (
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">● Ha effettuato accesso</span>
              ) : (
                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg">● In attesa primo accesso</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-black px-2.5 py-1 rounded-lg border ${RUOLO_COLORS[u.role] || 'bg-slate-100 text-slate-600'}`}>{u.role}</span>
          {!isEditing && (
            <button onClick={onEdit} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"><Edit2 size={15} /></button>
          )}
        </div>
      </div>

      {!isEditing && u.role === 'director' && assignedFacilities.length > 0 && (
        <div className="px-4 pb-3 flex flex-wrap gap-1.5">
          {assignedFacilities.map((name, i) => (
            <span key={i} className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-lg font-medium">{name}</span>
          ))}
        </div>
      )}

      {isEditing && (
        <div className="border-t border-indigo-100 bg-indigo-50 p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Nome completo</label>
              <input type="text" value={form.full_name} onChange={set('full_name')} className={INP2} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Ruolo</label>
              <select value={form.role} onChange={set('role')} className={INP2}>
                {RUOLI.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Company ID (vuoto = accesso globale)</label>
              <input type="number" value={form.company_id} onChange={set('company_id')} className={INP2} placeholder="es. 11" />
            </div>
          </div>

          {form.role === 'director' && (
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2">Strutture assegnate</label>
              <div className="max-h-40 overflow-y-auto grid grid-cols-2 gap-1.5">
                {facilities.filter(f => !f.is_suspended).map(f => (
                  <label key={f.id} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer text-xs font-medium transition-colors ${
                    form.facilityIds.includes(f.id) ? 'bg-indigo-100 text-indigo-700' : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}>
                    <input type="checkbox" checked={form.facilityIds.includes(f.id)} onChange={() => toggleFacility(f.id)} className="accent-indigo-600" />
                    {f.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onCancel} className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">Annulla</button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2 rounded-xl text-sm font-black hover:bg-indigo-700 disabled:opacity-60 transition-colors">
              {saving ? 'Salvo...' : 'Salva modifiche'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
