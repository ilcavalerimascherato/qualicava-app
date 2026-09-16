/**
 * src/components/CartaServiziGeneratorModal.jsx
 * ─────────────────────────────────────────────────────────────
 * Generatore Carta dei Servizi per una struttura. Stesso schema UX
 * del generatore manuale HACCP (HaccpFascicoloModal.jsx): tab Profilo
 * (box testuali) + tab Documento (storico revisioni + genera).
 *
 * Sia admin/superadmin che il Direttore della struttura possono
 * compilare i box e generare direttamente il documento (nessun
 * flusso di richiesta).
 * ─────────────────────────────────────────────────────────────
 */
import React, { useState, useEffect } from 'react';
import {
  X, BookOpen, FileEdit, Save, Loader2, Download,
  AlertTriangle, Building2, Settings,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { useCartaServiziFascicolo, useCartaServiziInvalidate } from '../hooks/useCartaServiziData';
import {
  upsertProfilo, generaCartaServizi, suggerisciProssimaRevisione, formattaRevisione,
} from '../services/cartaServiziService';
import { CARTA_SERVIZI_SEZIONI_STRUTTURA } from '../config/cartaServiziSezioni';
import CartaServiziGestoreModal from './CartaServiziGestoreModal';

const TABS = [
  { id: 'profilo',   label: 'Profilo',   Icon: FileEdit },
  { id: 'documento', label: 'Documento', Icon: BookOpen },
];

const LBL  = 'block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5';
const TXT  = 'w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:border-violet-400 outline-none text-slate-700 resize-y';

export default function CartaServiziGeneratorModal({ facility, onClose }) {
  const [activeTab, setActiveTab] = useState('profilo');
  const { profile } = useAuth();

  // Admin/superadmin gestiscono qualunque struttura; il Direttore genera
  // direttamente solo per la propria (RLS applica comunque lo stesso vincolo lato server).
  const canManage = ['superadmin', 'admin'].includes(profile?.role) || profile?.role === 'director';
  const isAdminUser = ['superadmin', 'admin'].includes(profile?.role);

  const [company, setCompany] = useState(null);
  useEffect(() => {
    if (!facility?.company_id) { setCompany(null); return; }
    supabase.from('companies').select('id, name, logo_url')
      .eq('id', facility.company_id).maybeSingle()
      .then(({ data }) => setCompany(data));
  }, [facility?.company_id]);

  const { data, loading } = useCartaServiziFascicolo(facility?.id, company?.id);
  const invalidate = useCartaServiziInvalidate(facility?.id, company?.id);

  const [sezioni, setSezioni] = useState({});
  useEffect(() => { setSezioni(data.profilo?.sezioni ?? {}); }, [data.profilo]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [noteRevisione, setNoteRevisione] = useState('');
  const [showGestoreModal, setShowGestoreModal] = useState(false);

  // Numero revisione e data di emissione: pre-compilati con un default
  // sensato ma liberamente modificabili, per poter preparare in anticipo
  // un documento con una data/numero specifici.
  const [numeroRevisioneInput, setNumeroRevisioneInput] = useState('');
  const [dataEmissioneInput, setDataEmissioneInput]     = useState(() => new Date().toISOString().split('T')[0]);
  useEffect(() => {
    if (numeroRevisioneInput === '') {
      setNumeroRevisioneInput(String(suggerisciProssimaRevisione(data.generati)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.generati]);

  const ultimaGenerata = data.generati?.[0] ?? null;
  const revisioneEsistente = data.generati?.some(g => g.numero_revisione === Number(numeroRevisioneInput));

  const setSezione = (id, value) => setSezioni(prev => ({ ...prev, [id]: value }));

  async function handleSalvaProfilo() {
    setSaving(true); setError('');
    try {
      await upsertProfilo(facility.id, sezioni, profile.id);
      invalidate.profilo();
    } catch (e) {
      setError(e.message || 'Errore durante il salvataggio.');
    } finally {
      setSaving(false);
    }
  }

  async function handleGenera() {
    const numRevUsato = Number(numeroRevisioneInput);
    if (!numRevUsato || numRevUsato < 1) {
      setError('Il numero di revisione deve essere un intero positivo.');
      return;
    }
    setSaving(true); setError('');
    try {
      await upsertProfilo(facility.id, sezioni, profile.id);
      await generaCartaServizi({
        facility, company, gestore: data.gestore, profiloSezioni: sezioni,
        noteRevisione, userId: profile.id,
        numeroRevisione: numRevUsato, dataEmissione: dataEmissioneInput,
      });
      invalidate.profilo();
      invalidate.generati();
      setNoteRevisione('');
      setNumeroRevisioneInput(String(numRevUsato + 1));
      setDataEmissioneInput(new Date().toISOString().split('T')[0]);
      setActiveTab('documento');
    } catch (e) {
      setError(e.message || 'Errore durante la generazione del documento.');
    } finally {
      setSaving(false);
    }
  }

  if (!facility) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="bg-violet-100 p-2.5 rounded-xl">
              <BookOpen size={22} className="text-violet-600" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800">Carta dei Servizi</h2>
              <p className="text-sm text-slate-500">{facility.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-6">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-black uppercase tracking-wide
                border-b-2 transition-all
                ${activeTab === id ? 'border-violet-500 text-violet-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-violet-400" size={28} /></div>
          ) : (
            <>
              {error && (
                <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-5">
                  <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {activeTab === 'profilo' && (
                <div className="space-y-6">
                  {/* Contenuti gestore — sola lettura + link modifica per admin */}
                  <div className="bg-violet-50 border border-violet-200 rounded-xl px-4 py-3 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-2">
                      <Building2 size={16} className="text-violet-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-violet-700">
                        Mission/Valori e Lettera di presentazione sono condivisi con tutte le sedi di{' '}
                        <strong>{company?.name || 'questo gestore'}</strong>.
                        {!data.gestore?.mission_valori && ' Non ancora compilati: verrà usato un testo generico.'}
                      </p>
                    </div>
                    {isAdminUser && (
                      <button
                        onClick={() => setShowGestoreModal(true)}
                        className="flex items-center gap-1.5 text-xs font-black text-violet-600 hover:text-violet-800 shrink-0"
                      >
                        <Settings size={13} /> Modifica
                      </button>
                    )}
                  </div>

                  {!canManage && (
                    <p className="text-xs text-slate-400 italic">Sola lettura per il tuo ruolo.</p>
                  )}

                  {CARTA_SERVIZI_SEZIONI_STRUTTURA.map(def => (
                    <div key={def.id}>
                      <label className={LBL}>{def.label}</label>
                      {def.help && <p className="text-xs text-slate-400 mb-1.5">{def.help}</p>}
                      <textarea
                        className={TXT}
                        rows={def.id === 'note_finali' ? 3 : 4}
                        placeholder={def.placeholder}
                        value={sezioni[def.id] || ''}
                        disabled={!canManage}
                        onChange={e => setSezione(def.id, e.target.value)}
                      />
                    </div>
                  ))}

                  {canManage && (
                    <div className="flex justify-end pt-2">
                      <button
                        onClick={handleSalvaProfilo}
                        disabled={saving}
                        className="flex items-center gap-2 bg-violet-600 text-white px-5 py-2.5 rounded-xl text-sm font-black uppercase shadow hover:bg-violet-700 transition-colors disabled:opacity-50"
                      >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        Salva box
                      </button>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'documento' && (
                <div className="space-y-6">
                  {ultimaGenerata ? (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-black text-emerald-800">Rev. {formattaRevisione(ultimaGenerata)}</p>
                        <p className="text-xs text-emerald-600">{ultimaGenerata.data_generazione}</p>
                        {ultimaGenerata.note_revisione && (
                          <p className="text-xs text-emerald-700 mt-1">{ultimaGenerata.note_revisione}</p>
                        )}
                      </div>
                      <a
                        href={ultimaGenerata.file_url} target="_blank" rel="noreferrer"
                        className="flex items-center gap-2 bg-white border border-emerald-300 text-emerald-700 px-4 py-2 rounded-xl text-xs font-black uppercase hover:bg-emerald-100 transition-colors shrink-0"
                      >
                        <Download size={14} /> Scarica Word
                      </a>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">Nessuna Carta dei Servizi generata finora per questa struttura.</p>
                  )}

                  {canManage && (
                    <section className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className={LBL}>Numero revisione</label>
                          <input
                            type="number" min="1" step="1"
                            className={TXT}
                            value={numeroRevisioneInput}
                            onChange={e => setNumeroRevisioneInput(e.target.value)}
                          />
                          {revisioneEsistente && (
                            <p className="text-xs text-amber-600 mt-1.5">
                              Esiste già una revisione {numeroRevisioneInput}: questa generazione verrà salvata come sotto-versione nello storico interno; il documento stampabile riporterà comunque solo "{numeroRevisioneInput}".
                            </p>
                          )}
                        </div>
                        <div>
                          <label className={LBL}>Data di emissione</label>
                          <input
                            type="date"
                            className={TXT}
                            value={dataEmissioneInput}
                            onChange={e => setDataEmissioneInput(e.target.value)}
                          />
                          <p className="text-xs text-slate-400 mt-1.5">Puoi impostare una data diversa da oggi per preparare in anticipo il documento.</p>
                        </div>
                      </div>
                      <div>
                        <label className={LBL}>Note di revisione (opzionale)</label>
                        <textarea
                          className={TXT} rows={2}
                          value={noteRevisione}
                          onChange={e => setNoteRevisione(e.target.value)}
                          placeholder="Es: Aggiornamento orari visite e retta 2026"
                        />
                      </div>
                      <div className="flex justify-end">
                        <button
                          onClick={handleGenera}
                          disabled={saving}
                          className="flex items-center gap-2 bg-violet-600 text-white px-5 py-2.5 rounded-xl text-sm font-black uppercase shadow hover:bg-violet-700 transition-colors disabled:opacity-50"
                        >
                          {saving ? <Loader2 size={16} className="animate-spin" /> : <BookOpen size={16} />}
                          Genera Carta dei Servizi
                        </button>
                      </div>
                    </section>
                  )}

                  {data.generati?.length > 1 && (
                    <div>
                      <p className={LBL}>Storico</p>
                      <div className="space-y-1.5">
                        {data.generati.slice(1).map(m => (
                          <div key={m.id} className="flex items-center justify-between text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                            <span>Rev. {formattaRevisione(m)} — {m.data_generazione}</span>
                            <a href={m.file_url} target="_blank" rel="noreferrer" className="text-violet-600 font-bold hover:underline">Scarica</a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showGestoreModal && company && (
        <CartaServiziGestoreModal
          companyId={company.id}
          companyName={company.name}
          onClose={() => setShowGestoreModal(false)}
          onSaved={() => { invalidate.gestore(); setShowGestoreModal(false); }}
        />
      )}
    </div>
  );
}
