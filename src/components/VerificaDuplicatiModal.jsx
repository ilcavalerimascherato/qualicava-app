// src/components/VerificaDuplicatiModal.jsx
import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { X, AlertTriangle, Check, Trash2, Loader2, ChevronDown } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { useSurveyDuplicati } from '../hooks/useSurveyDuplicati';
import { useAllSurveyCampagne } from '../hooks/useSurveyCampagne';

const STATO_CFG = {
  da_verificare: { label: 'Da verificare', bg: 'bg-amber-50',    text: 'text-amber-700',   border: 'border-amber-200'   },
  tenuto:        { label: 'Tenuto',        bg: 'bg-emerald-50',  text: 'text-emerald-700', border: 'border-emerald-200' },
  eliminato:     { label: 'Eliminato',     bg: 'bg-slate-50',    text: 'text-slate-500',   border: 'border-slate-200'   },
};

// Tabelle con poche domande: tasso di falsi positivi misurato più alto nel dedup
const TABELLE_RISCHIO_FALSI_POSITIVI = ['survey_centri_psichiatria', 'survey_personale'];

function formatData(dt) {
  if (!dt) return '';
  return new Date(dt).toLocaleString('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function GruppoCard({ gruppo, isRischioso, actionState, setActionState, saving, onConferma, canAgire }) {
  const [expanded, setExpanded] = useState(gruppo.stato === 'da_verificare');

  const domande = useMemo(() => {
    const keys = new Set();
    gruppo.membri.forEach(m => Object.keys(m.risposte || {}).forEach(k => keys.add(k)));
    return Array.from(keys);
  }, [gruppo.membri]);

  const cfg = STATO_CFG[gruppo.stato] ?? STATO_CFG.da_verificare;
  const azioneAperta = actionState?.gruppoId === gruppo.gruppo_id ? actionState.tipo : null;

  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-2 text-left flex-wrap">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
            {cfg.label}
          </span>
          <span className="text-sm font-bold text-slate-800">{gruppo.facility_name ?? 'Struttura non mappata'}</span>
          <span className="text-xs text-slate-400">{gruppo.campagna_nome ?? 'Campagna sconosciuta'} · {gruppo.membri.length} righe</span>
          {isRischioso && (
            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
              <AlertTriangle size={10} /> Falso positivo probabile
            </span>
          )}
        </div>
        <ChevronDown size={16} className={`text-slate-400 transition-transform shrink-0 ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="p-4 space-y-4">
          {isRischioso && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              Questo questionario ha poche domande — più probabile un falso positivo, verifica con attenzione.
            </p>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th className="text-left text-slate-400 font-bold uppercase tracking-wide px-2 py-1 w-40">Campo</th>
                  {gruppo.membri.map((m, i) => (
                    <th key={`${m.riga_id}-${i}`} className="text-left text-slate-600 font-bold px-2 py-1 border-l border-slate-100 whitespace-nowrap">
                      {formatData(m.created_at)}{m.identificativo ? ` · ${m.identificativo}` : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-slate-100">
                  <td className="px-2 py-1 text-slate-400 font-medium">Commento</td>
                  {gruppo.membri.map((m, i) => (
                    <td key={`${m.riga_id}-${i}`} className="px-2 py-1 border-l border-slate-100 italic text-slate-500">
                      {m.commento || '—'}
                    </td>
                  ))}
                </tr>
                {domande.map(k => (
                  <tr key={k} className="border-t border-slate-100">
                    <td className="px-2 py-1 text-slate-500">{k.replace(/_/g, ' ')}</td>
                    {gruppo.membri.map((m, i) => (
                      <td key={`${m.riga_id}-${i}`} className="px-2 py-1 border-l border-slate-100 text-slate-700">
                        {String(m.risposte?.[k] ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {gruppo.stato !== 'da_verificare' && (
            <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
              Risolto da <strong>{gruppo.risolto_da_nome ?? '—'}</strong> il {formatData(gruppo.risolto_il)} — {gruppo.motivo}
            </p>
          )}

          {gruppo.stato === 'da_verificare' && canAgire && (
            <div className="flex flex-col gap-2">
              {!azioneAperta ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setActionState({ gruppoId: gruppo.gruppo_id, tipo: 'tieni_una', motivo: '', tenereRigaId: null })}
                    className="text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
                  >
                    Tenere una riga
                  </button>
                  <button
                    onClick={() => setActionState({ gruppoId: gruppo.gruppo_id, tipo: 'tieni_tutte', motivo: '' })}
                    className="flex items-center gap-1 text-xs font-bold px-3 py-2 rounded-xl border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  >
                    <Check size={12} /> Tenere tutte
                  </button>
                  <button
                    onClick={() => setActionState({ gruppoId: gruppo.gruppo_id, tipo: 'elimina_tutte', motivo: '' })}
                    className="flex items-center gap-1 text-xs font-bold px-3 py-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={12} /> Eliminare tutte
                  </button>
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                  <p className="text-xs font-bold text-slate-600">
                    {azioneAperta === 'tieni_una' ? 'Tenere una riga'
                      : azioneAperta === 'tieni_tutte' ? 'Tenere tutte (falso positivo)'
                      : 'Eliminare tutte'}
                  </p>
                  {azioneAperta === 'tieni_una' && (
                    <div className="flex flex-col gap-1">
                      {gruppo.membri.map((m, i) => (
                        <label key={`${m.riga_id}-${i}`} className="flex items-center gap-2 text-xs text-slate-600">
                          <input
                            type="radio"
                            name={`tieni-${gruppo.gruppo_id}`}
                            checked={actionState.tenereRigaId === m.riga_id}
                            onChange={() => setActionState(s => ({ ...s, tenereRigaId: m.riga_id }))}
                          />
                          {formatData(m.created_at)}{m.identificativo ? ` · ${m.identificativo}` : ''}
                        </label>
                      ))}
                    </div>
                  )}
                  <textarea
                    value={actionState.motivo}
                    onChange={e => setActionState(s => ({ ...s, motivo: e.target.value }))}
                    placeholder="Motivo (obbligatorio)"
                    rows={2}
                    className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-indigo-400"
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setActionState(null)}
                      className="text-xs font-bold text-slate-500 px-3 py-1.5 rounded-lg hover:bg-slate-100"
                    >
                      Annulla
                    </button>
                    <button
                      onClick={() => onConferma(gruppo)}
                      disabled={saving || !actionState.motivo.trim() || (azioneAperta === 'tieni_una' && !actionState.tenereRigaId)}
                      className="flex items-center gap-1 text-xs font-bold bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {saving ? <><Loader2 size={12} className="animate-spin" /> Salvataggio...</> : 'Conferma'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function VerificaDuplicatiModal({ isOpen, onClose, facilities = [] }) {
  const { profile, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const { data: rows = [], isLoading } = useSurveyDuplicati();
  const { data: campagne = [] } = useAllSurveyCampagne();

  const [filtroCampagna, setFiltroCampagna] = useState('');
  const [filtroStruttura, setFiltroStruttura] = useState('');
  const [actionState, setActionState] = useState(null);
  const [saving, setSaving] = useState(false);

  const gruppi = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      if (!map.has(r.gruppo_id)) {
        map.set(r.gruppo_id, {
          gruppo_id: r.gruppo_id,
          tabella_origine: r.tabella_origine,
          campagna_id: r.campagna_id,
          campagna_nome: r.campagna_nome,
          stato: r.stato,
          risolto_da_nome: r.risolto_da_nome,
          risolto_il: r.risolto_il,
          motivo: r.motivo,
          facility_id: r.facility_id,
          facility_name: r.facility_name,
          membri: [],
        });
      }
      map.get(r.gruppo_id).membri.push(r);
    }
    return Array.from(map.values());
  }, [rows]);

  const gruppiFiltrati = useMemo(() => {
    return gruppi
      .filter(g => !filtroCampagna || String(g.campagna_id) === filtroCampagna)
      .filter(g => !filtroStruttura || String(g.facility_id) === filtroStruttura)
      .sort((a, b) => {
        if (a.stato === 'da_verificare' && b.stato !== 'da_verificare') return -1;
        if (a.stato !== 'da_verificare' && b.stato === 'da_verificare') return 1;
        return (a.facility_name || '').localeCompare(b.facility_name || '');
      });
  }, [gruppi, filtroCampagna, filtroStruttura]);

  const countDaVerificare = useMemo(
    () => gruppi.filter(g => g.stato === 'da_verificare').length,
    [gruppi],
  );

  async function confermaAzione(gruppo) {
    if (!actionState || actionState.gruppoId !== gruppo.gruppo_id) return;
    const { tipo, motivo, tenereRigaId } = actionState;
    if (!motivo.trim()) return;
    if (tipo === 'tieni_una' && !tenereRigaId) return;

    setSaving(true);
    try {
      const risolto_da = profile?.id;
      const risolto_il = new Date().toISOString();
      const motivoTrim = motivo.trim();

      if (tipo === 'tieni_tutte') {
        const { error } = await supabase
          .from('survey_duplicati')
          .update({ stato: 'tenuto', risolto_da, risolto_il, motivo: motivoTrim })
          .eq('gruppo_id', gruppo.gruppo_id);
        if (error) throw error;
      } else if (tipo === 'elimina_tutte') {
        const { error } = await supabase
          .from('survey_duplicati')
          .update({ stato: 'eliminato', risolto_da, risolto_il, motivo: motivoTrim })
          .eq('gruppo_id', gruppo.gruppo_id);
        if (error) throw error;
      } else if (tipo === 'tieni_una') {
        const altreRigheIds = gruppo.membri.filter(m => m.riga_id !== tenereRigaId).map(m => m.riga_id);
        const { error: errAltre } = await supabase
          .from('survey_duplicati')
          .update({ stato: 'eliminato', risolto_da, risolto_il, motivo: motivoTrim })
          .eq('gruppo_id', gruppo.gruppo_id)
          .in('riga_id', altreRigheIds);
        if (errAltre) throw errAltre;

        const { error: errTenuta } = await supabase
          .from('survey_duplicati')
          .update({ stato: 'tenuto', risolto_da, risolto_il, motivo: motivoTrim })
          .eq('gruppo_id', gruppo.gruppo_id)
          .eq('riga_id', tenereRigaId);
        if (errTenuta) throw errTenuta;
      }

      toast.success('Gruppo risolto');
      setActionState(null);
      queryClient.invalidateQueries({ queryKey: ['survey_duplicati_dettaglio'] });
      queryClient.invalidateQueries({ queryKey: ['survey_duplicati_count'] });
    } catch (err) {
      toast.error(`Errore risoluzione: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col">

        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-black text-slate-800">Verifica duplicati survey</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {countDaVerificare > 0 ? `${countDaVerificare} gruppi da verificare` : 'Nessun gruppo da verificare'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <X size={18} className="text-slate-400" />
          </button>
        </div>

        <div className="px-6 py-3 border-b border-slate-100 flex gap-3">
          <select
            value={filtroCampagna}
            onChange={e => setFiltroCampagna(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-indigo-400"
          >
            <option value="">Tutte le campagne</option>
            {campagne.map(c => <option key={c.id} value={String(c.id)}>{c.nome}</option>)}
          </select>
          <select
            value={filtroStruttura}
            onChange={e => setFiltroStruttura(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-indigo-400"
          >
            <option value="">Tutte le strutture</option>
            {facilities.map(f => <option key={f.id} value={String(f.id)}>{f.name}</option>)}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {isLoading ? (
            <p className="text-sm text-slate-400 text-center py-8">Caricamento...</p>
          ) : gruppiFiltrati.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">Nessun gruppo trovato</p>
          ) : (
            gruppiFiltrati.map(g => (
              <GruppoCard
                key={g.gruppo_id}
                gruppo={g}
                isRischioso={TABELLE_RISCHIO_FALSI_POSITIVI.includes(g.tabella_origine)}
                actionState={actionState}
                setActionState={setActionState}
                saving={saving}
                onConferma={confermaAzione}
                canAgire={isAdmin}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
