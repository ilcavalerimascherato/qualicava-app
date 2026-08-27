// src/components/verbali/VerbaleReviewModal.jsx
// Schermata di revisione/conferma dei dati estratti dall'AI — nessun dato
// arriva a non_conformities finché il Direttore non preme "Conferma".
import { useEffect, useState } from 'react';
import { X, Loader2, AlertTriangle, ChevronDown, ChevronUp, CheckCircle2, Send, MessageSquareText, FileStack } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  fetchVerbaleConRilievi, updateVerbaleHeader, updateRilievo, deleteRilievo,
  confermaVerbaleEGeneraNc, segnaRispostaInviata,
} from '../../services/verbaliIspettiviService';
import CorrispondenzaPanel from './CorrispondenzaPanel';

const TIPO_ISPEZIONE_OPTIONS = [
  { value: 'sopralluogo_vigilanza', label: 'Sopralluogo di Vigilanza' },
  { value: 'controllo_appropriatezza', label: 'Controllo Appropriatezza' },
  { value: 'altro', label: 'Altro' },
];

const VALUTAZIONE_OPTIONS = [
  { value: '', label: '— Non specificata —' },
  { value: 'in_possesso_requisiti', label: 'In possesso dei requisiti', pill: 'success' },
  { value: 'subordinato_valutazioni', label: 'Subordinato a ulteriori valutazioni', pill: 'warning' },
  { value: 'non_in_possesso', label: 'Non in possesso dei requisiti', pill: 'danger' },
];

const RILIEVO_TIPO_OPTIONS = [
  { value: 'prescrizione', label: 'Prescrizione' },
  { value: 'osservazione', label: 'Osservazione' },
  { value: 'criticita_fasas', label: 'Criticità' },
  { value: 'richiesta_documentazione', label: 'Richiesta documentazione' },
];

function Pill({ variant = 'gray', children }) {
  const styles = {
    gray: 'bg-slate-100 text-slate-600 border-slate-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    danger: 'bg-red-50 text-red-700 border-red-200',
  };
  return <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${styles[variant]}`}>{children}</span>;
}

function pillForValutazione(v) {
  return VALUTAZIONE_OPTIONS.find(o => o.value === v)?.pill || 'gray';
}

function pillForGravita(g) {
  return g === 'Alta' ? 'danger' : g === 'Bassa' ? 'gray' : 'warning';
}

export default function VerbaleReviewModal({ verbaleId, facility, onClose, onConfirmed }) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(null);
  const [rilievi, setRilievi] = useState([]);
  const [showTeam, setShowTeam] = useState(false);
  const [tab, setTab] = useState('dati'); // 'dati' | 'risposta'

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { verbale, rilievi: r } = await fetchVerbaleConRilievi(verbaleId);
        if (cancelled) return;
        setForm(verbale);
        setRilievi(r);
      } catch (err) {
        if (!cancelled) setError(`Impossibile caricare il verbale: ${err.message}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [verbaleId]);

  const setField = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  const setRilievoField = (id, key) => (e) => {
    const value = e.target?.type === 'checkbox' ? e.target.checked : e.target.value;
    setRilievi(list => list.map(r => (r.id === id ? { ...r, [key]: value } : r)));
  };

  const removeRilievo = async (id) => {
    setRilievi(list => list.filter(r => r.id !== id));
    try { await deleteRilievo(id); } catch { /* già rimosso lato UI, riprovabile al refresh */ }
  };

  const persist = async () => {
    await updateVerbaleHeader(form.id, {
      tipo_ispezione: form.tipo_ispezione,
      valutazione_sintetica: form.valutazione_sintetica || null,
      osservazioni_raw: form.osservazioni_raw,
      bozza_risposta_ai: form.bozza_risposta_ai,
    });
    await Promise.all(rilievi.map(r => updateRilievo(r.id, {
      area_tematica: r.area_tematica,
      descrizione: r.descrizione,
      tipo: r.tipo,
      gravita_suggerita: r.gravita_suggerita,
      escluso_da_nc: r.escluso_da_nc,
    })));
  };

  const salvaBozza = async () => {
    setSaving(true);
    setError('');
    try {
      await persist();
    } catch (err) {
      setError(`Errore salvataggio: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const conferma = async () => {
    setSaving(true);
    setError('');
    try {
      await persist();
      const { nCreate } = await confermaVerbaleEGeneraNc({ verbale: form, rilievi, facility, profile });
      setForm(f => ({ ...f, stato_revisione: 'confermato' }));
      onConfirmed?.({ nCreate });
    } catch (err) {
      setError(`Errore conferma: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const inviaRisposta = async () => {
    setSaving(true);
    setError('');
    try {
      await persist();
      await segnaRispostaInviata({ verbale: form, testoInviato: form.bozza_risposta_ai, createdBy: profile?.id });
      setForm(f => ({ ...f, stato_risposta: 'inviata', data_risposta_inviata: new Date().toISOString().slice(0, 10) }));
    } catch (err) {
      setError(`Errore: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-10 flex flex-col items-center gap-3">
          <Loader2 size={26} className="text-indigo-500 animate-spin" />
          <p className="text-sm font-bold text-slate-600">Caricamento verbale…</p>
        </div>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center">
          <AlertTriangle size={24} className="text-red-500 mx-auto mb-3" />
          <p className="text-sm text-slate-600 mb-4">{error || 'Verbale non trovato.'}</p>
          <button onClick={onClose} className="text-xs font-bold bg-slate-100 px-4 py-2 rounded-xl">Chiudi</button>
        </div>
      </div>
    );
  }

  const selezionati = rilievi.filter(r => !r.escluso_da_nc).length;
  const ncGenerate = rilievi.filter(r => r.non_conformity_id).length;
  const confermato = form.stato_revisione === 'confermato';
  const cudesMismatch = form.facility_match_status === 'non_trovato';
  const tipoVerificaDisplay = form.ai_estrazione_raw?.tipo_verifica
    || (form.ai_estrazione_raw?.azioni_intraprese ?? []).join(' · ')
    || '—';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[95vh] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-slate-50 shrink-0">
          <div>
            <h2 className="font-black text-slate-800">
              Verbale N. {form.numero_verbale || '—'} — {facility?.name}
            </h2>
            <p className="text-xs text-slate-400">
              {form.ente} {form.data_sopralluogo && `· Sopralluogo del ${form.data_sopralluogo}`}
              {form.ora_sopralluogo && ` ore ${form.ora_sopralluogo}`}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        {/* Tab interne */}
        <div className="flex items-center gap-1 px-6 pt-3 border-b bg-white shrink-0">
          <button
            onClick={() => setTab('dati')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 transition-colors ${
              tab === 'dati' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <FileStack size={13} /> Dati e rilievi
          </button>
          <button
            onClick={() => setTab('risposta')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 transition-colors ${
              tab === 'risposta' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <MessageSquareText size={13} /> Risposta e comunicazioni
            {form.stato_risposta === 'da_rispondere' && form.scadenza_risposta && (
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            )}
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5 space-y-5">

          {tab === 'dati' && <>

          {/* Coerenza struttura */}
          {form.cudes_estratto && (
            cudesMismatch ? (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-xs">
                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                <span>Il Cudes letto dal verbale (<b>{form.cudes_estratto}</b>) non corrisponde al Cudes di questa struttura
                  (<b>{facility?.cudes || 'non impostato'}</b>). Verifica di aver caricato il verbale nella struttura giusta prima di confermare.</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-4 py-2.5 text-xs">
                <CheckCircle2 size={14} className="flex-shrink-0" />
                Cudes verificato — corrisponde a {facility?.name}.
              </div>
            )
          )}

          {/* Metadati */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Tipo ispezione</label>
              <select value={form.tipo_ispezione} onChange={setField('tipo_ispezione')}
                className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 outline-none focus:border-indigo-400">
                {TIPO_ISPEZIONE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Tipo di verifica</label>
              <p className="text-xs font-semibold text-slate-700 pt-2 truncate" title={tipoVerificaDisplay}>{tipoVerificaDisplay}</p>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Valutazione sintetica</label>
              <select value={form.valutazione_sintetica || ''} onChange={setField('valutazione_sintetica')}
                className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 outline-none focus:border-indigo-400">
                {VALUTAZIONE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Ente</label>
              <p className="text-xs font-semibold text-slate-700 pt-2 truncate" title={form.ente}>{form.ente || '—'}</p>
            </div>
          </div>
          {form.valutazione_sintetica && (
            <Pill variant={pillForValutazione(form.valutazione_sintetica)}>
              {VALUTAZIONE_OPTIONS.find(o => o.value === form.valutazione_sintetica)?.label}
            </Pill>
          )}

          {/* Osservazioni */}
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Osservazioni (testo AI, editabile)</p>
            <textarea rows={4} value={form.osservazioni_raw || ''} onChange={setField('osservazioni_raw')}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y" />
          </div>

          {/* Rilievi */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Rilievi estratti</p>
              <span className="text-[11px] text-slate-400 font-medium">{rilievi.length} proposti · {selezionati} selezionati per NC</span>
            </div>

            {rilievi.length === 0 && (
              <p className="text-xs text-slate-400 italic py-4 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                Nessuna criticità rilevata dall'AI in questo verbale.
              </p>
            )}

            <div className="space-y-2.5">
              {rilievi.map(r => {
                const linked = !!r.non_conformity_id;
                return (
                <div key={r.id} className={`border rounded-xl p-3.5 ${linked ? 'border-emerald-200 bg-emerald-50/40' : r.escluso_da_nc ? 'border-slate-200 opacity-60' : 'border-slate-200 bg-white'}`}>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    {linked ? (
                      <span className="flex-1 min-w-[160px] text-xs font-bold text-slate-700">{r.area_tematica || '—'}</span>
                    ) : (
                      <input
                        value={r.area_tematica || ''}
                        onChange={setRilievoField(r.id, 'area_tematica')}
                        placeholder="Area tematica"
                        className="flex-1 min-w-[160px] text-xs font-bold bg-transparent border-b border-transparent hover:border-slate-200 focus:border-indigo-400 outline-none py-0.5"
                      />
                    )}
                    <Pill variant={pillForGravita(r.gravita_suggerita)}>{r.gravita_suggerita || 'n/d'}</Pill>
                    {!linked && (
                      <select value={r.tipo} onChange={setRilievoField(r.id, 'tipo')}
                        className="text-[11px] font-semibold bg-slate-50 border border-slate-200 rounded-full px-2 py-0.5 outline-none text-slate-500">
                        {RILIEVO_TIPO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    )}
                  </div>
                  {linked ? (
                    <p className="text-xs text-slate-600 mb-2 leading-relaxed">{r.descrizione}</p>
                  ) : (
                    <textarea
                      rows={2}
                      value={r.descrizione}
                      onChange={setRilievoField(r.id, 'descrizione')}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y mb-2"
                    />
                  )}
                  <div className="flex items-center justify-between">
                    {linked ? (
                      <Pill variant="success">✓ Non Conformità generata</Pill>
                    ) : (
                      <>
                        <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 cursor-pointer">
                          <input type="checkbox" checked={!r.escluso_da_nc} onChange={e => setRilievi(list => list.map(x => x.id === r.id ? { ...x, escluso_da_nc: !e.target.checked } : x))} className="accent-indigo-600" />
                          Genera Non Conformità collegata
                        </label>
                        <button onClick={() => removeRilievo(r.id)} className="text-[11px] font-bold text-slate-400 hover:text-red-500">
                          🗑 Scarta
                        </button>
                      </>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          </div>

          {/* Team */}
          <button onClick={() => setShowTeam(s => !s)} className="text-xs font-bold text-indigo-600 flex items-center gap-1">
            {showTeam ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            Team ispettivo e presenti
          </button>
          {showTeam && (
            <div className="flex flex-wrap gap-2">
              {(form.ai_estrazione_raw?.team_ispettivo ?? []).map((p, i) => (
                <div key={`t${i}`} className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                  <p className="text-xs font-bold text-slate-700">{p.nominativo}</p>
                  <p className="text-[11px] text-slate-400">{p.qualifica}</p>
                </div>
              ))}
              {(form.ai_estrazione_raw?.presenti_ente_gestore ?? []).map((p, i) => (
                <div key={`p${i}`} className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                  <p className="text-xs font-bold text-slate-700">{p.nominativo}</p>
                  <p className="text-[11px] text-slate-400">{p.qualifica} (presente)</p>
                </div>
              ))}
            </div>
          )}

          </>}

          {tab === 'risposta' && <>

          {/* Risposta — sezione a piena larghezza, non più compressa in un
              collapsible tra i rilievi e il team. */}
          {form.stato_risposta === 'non_richiesta' ? (
            <p className="text-xs text-slate-400 italic py-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
              Questo verbale non richiede una risposta formale all'ente.
            </p>
          ) : (
            <div className="border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Scadenza risposta</p>
                  <p className="text-base font-black text-red-600">
                    {form.scadenza_risposta ? `entro il ${form.scadenza_risposta}` : 'non specificata'}
                  </p>
                </div>
                <div className="text-right max-w-sm">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Destinatario</p>
                  <p className="text-xs text-slate-600">{form.indirizzo_invio_risposta || '—'}</p>
                </div>
                <div>
                  {form.stato_risposta === 'inviata' ? (
                    <Pill variant="success">✓ Inviata il {form.data_risposta_inviata}</Pill>
                  ) : (
                    <Pill variant="warning">Da inviare</Pill>
                  )}
                </div>
              </div>

              {form.oggetto_pec_suggerito && (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Oggetto PEC suggerito</p>
                  <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">{form.oggetto_pec_suggerito}</p>
                </div>
              )}

              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Testo della risposta — bozza AI, da rivedere prima dell'invio</p>
                <textarea rows={12} value={form.bozza_risposta_ai || ''} onChange={setField('bozza_risposta_ai')}
                  disabled={form.stato_risposta === 'inviata'}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y disabled:opacity-60" />
              </div>

              {form.stato_risposta !== 'inviata' && (
                <div className="flex justify-end">
                  <button onClick={inviaRisposta} disabled={saving} className="flex items-center gap-2 text-xs font-bold bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                    <Send size={13} /> Segna risposta come inviata
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Corrispondenza — note, proroghe, integrazioni, esito procedimento */}
          <CorrispondenzaPanel verbaleId={form.id} facilityId={facility?.id} />

          </>}

          {error && (
            <p className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{error}</p>
          )}
        </div>

        {/* Footer sticky */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t bg-white shrink-0 flex-wrap">
          <p className="text-xs text-slate-500">
            {confermato
              ? `${ncGenerate} Non Conformità collegate a questo verbale`
              : <>{selezionati} rilievi genereranno una Non Conformità collegata (classificazione "Verbale Ente Vigilanza")
                  {rilievi.length - selezionati > 0 && ` · ${rilievi.length - selezionati} esclusi`}</>
            }
          </p>
          <div className="flex gap-2">
            <button onClick={salvaBozza} disabled={saving} className="text-xs font-bold text-slate-600 hover:bg-slate-100 px-4 py-2 rounded-xl disabled:opacity-50 transition-colors">
              Salva
            </button>
            {confermato ? (
              <Pill variant="success">✓ Confermato — {ncGenerate} NC generate</Pill>
            ) : (
              <button onClick={conferma} disabled={saving} className="flex items-center gap-2 text-xs font-bold bg-emerald-600 text-white px-5 py-2 rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                {saving ? <Loader2 size={13} className="animate-spin" /> : '✓'} Conferma e genera Non Conformità
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
