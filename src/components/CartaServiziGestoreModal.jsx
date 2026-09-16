/**
 * src/components/CartaServiziGestoreModal.jsx
 * ─────────────────────────────────────────────────────────────
 * Contenuti Carta dei Servizi condivisi a livello di GESTORE (company):
 * Mission/Valori e Lettera di presentazione, riutilizzati su tutte le
 * strutture dello stesso gestore. Solo admin/superadmin possono
 * modificarli (vedi RLS su carta_servizi_gestore).
 *
 * Può essere aperto già scoperto su una company (companyId/companyName
 * passati come prop, es. dal generatore di una struttura) oppure in
 * modalità standalone dal tab Generazione, con selettore company.
 * ─────────────────────────────────────────────────────────────
 */
import React, { useState, useEffect } from 'react';
import { X, Building2, Save, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { getGestoreContenuti, upsertGestoreContenuti } from '../services/cartaServiziService';
import { useAuth } from '../contexts/AuthContext';

const LBL = 'block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5';
const INP = 'w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:border-violet-400 outline-none text-slate-700';
const TXT = `${INP} resize-y`;

export default function CartaServiziGestoreModal({ companyId: fixedCompanyId, companyName, onClose, onSaved }) {
  const { profile } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState(fixedCompanyId || '');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ mission_valori: '', lettera_presentazione: '', firmatario_nome: '', firmatario_ruolo: '' });

  useEffect(() => {
    if (fixedCompanyId) return;
    supabase.from('companies').select('id, name').order('name')
      .then(({ data }) => setCompanies(data ?? []));
  }, [fixedCompanyId]);

  useEffect(() => {
    if (!companyId) { setForm({ mission_valori: '', lettera_presentazione: '', firmatario_nome: '', firmatario_ruolo: '' }); return; }
    setLoading(true);
    getGestoreContenuti(companyId)
      .then(data => setForm({
        mission_valori:        data?.mission_valori        || '',
        lettera_presentazione: data?.lettera_presentazione  || '',
        firmatario_nome:       data?.firmatario_nome        || '',
        firmatario_ruolo:      data?.firmatario_ruolo       || '',
      }))
      .finally(() => setLoading(false));
  }, [companyId]);

  const setField = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  async function handleSave() {
    setSaving(true); setError('');
    try {
      await upsertGestoreContenuti(companyId, form, profile.id);
      onSaved?.();
    } catch (e) {
      setError(e.message || 'Errore durante il salvataggio.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="bg-violet-100 p-2.5 rounded-xl"><Building2 size={20} className="text-violet-600" /></div>
            <div>
              <h2 className="text-base font-black text-slate-800">Contenuti comuni gestore</h2>
              {companyName && <p className="text-sm text-slate-500">{companyName}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {!fixedCompanyId && (
            <div>
              <label className={LBL}>Gestore</label>
              <select className={INP} value={companyId} onChange={e => setCompanyId(e.target.value)}>
                <option value="">Seleziona un gestore...</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {companyId && (loading ? (
            <div className="flex justify-center py-6"><Loader2 className="animate-spin text-violet-400" size={24} /></div>
          ) : (
            <>
              <div>
                <label className={LBL}>Mission e Valori</label>
                <textarea className={TXT} rows={4} value={form.mission_valori}
                  onChange={e => setField('mission_valori', e.target.value)}
                  placeholder="Es: La mission del gestore è quella di mettere al centro il benessere e la dignità dell'ospite..." />
              </div>
              <div>
                <label className={LBL}>Lettera di presentazione</label>
                <textarea className={TXT} rows={5} value={form.lettera_presentazione}
                  onChange={e => setField('lettera_presentazione', e.target.value)}
                  placeholder="Testo della lettera introduttiva agli ospiti e alle famiglie..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LBL}>Nome firmatario</label>
                  <input className={INP} value={form.firmatario_nome}
                    onChange={e => setField('firmatario_nome', e.target.value)} placeholder="Es: Mario Rossi" />
                </div>
                <div>
                  <label className={LBL}>Ruolo firmatario</label>
                  <input className={INP} value={form.firmatario_ruolo}
                    onChange={e => setField('firmatario_ruolo', e.target.value)} placeholder="Es: Amministratore" />
                </div>
              </div>
            </>
          ))}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-black text-slate-500 hover:bg-slate-100 transition-colors">
            Annulla
          </button>
          <button
            onClick={handleSave}
            disabled={!companyId || saving}
            className="flex items-center gap-2 bg-violet-600 text-white px-5 py-2.5 rounded-xl text-sm font-black uppercase shadow hover:bg-violet-700 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Salva
          </button>
        </div>
      </div>
    </div>
  );
}
