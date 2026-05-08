// src/components/DocDistribuzioneModal.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  X, Send, CheckSquare, Square, AlertTriangle,
  Loader2, CheckCircle2, XCircle,
  Building2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  getFacilitiesForDistribution,
  getDistribuzioneStatus,
  downloadMasterFile,
  compileDocumento,
  uploadCompiledIstanza,
  generateIstanzaMassiva,
  getStoricoRevisioni3,
} from '../services/documentiService';

function scadenzaBadge(dateStr) {
  if (!dateStr) return null;
  const d    = new Date(dateStr);
  const now  = new Date();
  const days = Math.ceil((d - now) / 86400000);
  if (days < 0)  return { label: 'Scaduto',    cls: 'bg-rose-100 text-rose-700'   };
  if (days < 30) return { label: `${days}gg`,  cls: 'bg-amber-100 text-amber-700' };
  return           { label: d.toLocaleDateString('it-IT'), cls: 'bg-emerald-100 text-emerald-700' };
}

function IstanzaStatoBadge({ stato }) {
  if (stato === 'distribuito')
    return <span className="text-[11px] font-black px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-700">Distribuito</span>;
  if (stato === 'aggiornare')
    return <span className="text-[11px] font-black px-2 py-0.5 rounded-lg bg-amber-100 text-amber-700">Aggiornare</span>;
  return   <span className="text-[11px] font-black px-2 py-0.5 rounded-lg bg-slate-100 text-slate-500">Non distribuito</span>;
}

export default function DocDistribuzioneModal({ master, onClose, onDistributed }) {
  const { profile } = useAuth();
  const isAllowed = ['superadmin', 'admin'].includes(profile?.role);

  const [facilities,    setFacilities]    = useState([]);
  const [istanzeMap,    setIstanzeMap]    = useState({});  // facilityId → istanza
  const [selected,      setSelected]      = useState(new Set());
  const [loading,       setLoading]       = useState(true);
  const [generating,    setGenerating]    = useState(false);
  const [progress,      setProgress]      = useState({ current: 0, total: 0 });
  const [risultati,     setRisultati]     = useState(null);
  const [error,         setError]         = useState('');

  useEffect(() => {
    if (!master) return;
    (async () => {
      setLoading(true);
      try {
        const [facs, status] = await Promise.all([
          getFacilitiesForDistribution(master.udo_applicabilita ?? []),
          getDistribuzioneStatus(master.id),
        ]);
        setFacilities(facs);
        const map = {};
        for (const ist of status) {
          const prev = map[ist.facility_id];
          if (!prev || new Date(ist.generato_il) > new Date(prev.generato_il)) {
            map[ist.facility_id] = ist;
          }
        }
        setIstanzeMap(map);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [master]);

  const getStatoFacility = useCallback((fac) => {
    const ist = istanzeMap[fac.id];
    if (!ist) return 'non_distribuito';
    const masterUpdated = master.updated_at ?? master.created_at;
    if (masterUpdated && new Date(ist.generato_il) < new Date(masterUpdated))
      return 'aggiornare';
    return 'distribuito';
  }, [istanzeMap, master]);

  const toggleSelect = (id) =>
    setSelected(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });

  const toggleAll = () => {
    if (selected.size === facilities.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(facilities.map(f => f.id)));
    }
  };

  const selectedFacilities = useMemo(
    () => facilities.filter(f => selected.has(f.id)),
    [facilities, selected]
  );

  const missingData = useMemo(
    () => selectedFacilities.filter(f => !f.director_sanitario),
    [selectedFacilities]
  );

  const handleGenera = async () => {
    if (!selected.size || !master.file_url_master) return;
    setGenerating(true);
    setProgress({ current: 0, total: selected.size });
    setRisultati(null);
    setError('');

    try {
      const fileBuffer = await downloadMasterFile(master.file_url_master);
      const storico    = await getStoricoRevisioni3(master.id);
      const errors     = [];
      let   done       = 0;

      for (const fac of selectedFacilities) {
        try {
          // 1. Compila documento con dati struttura
          const blob = await compileDocumento(fileBuffer, fac, master, storico);
          // 2. Upload file compilato + aggiorna path in DB
          await uploadCompiledIstanza(
            master.id, fac.id, master.revisione_corrente ?? '1', blob
          );
          // 3. Crea istanza (upsert — se già esiste la aggiorna)
          await generateIstanzaMassiva(master.id, [fac.id], profile.id);
        } catch (e) {
          errors.push({ facilityId: fac.id, name: fac.name, error: e.message });
        }
        done++;
        setProgress({ current: done, total: selected.size });
      }

      setRisultati({ total: selected.size, errors });
      // NON chiudere qui — mostra la schermata risultati e lascia chiudere all'utente
      if (errors.length === 0) onDistributed?.();  // notifica il padre SENZA chiudere
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  if (!isAllowed) return null;

  const scad = scadenzaBadge(master?.data_scadenza);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="bg-slate-950 px-7 py-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-xl text-white">
              <Send size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white uppercase tracking-wider">
                  {master?.titolo ?? 'Distribuzione documento'}
                </h2>
                {master?.revisione_corrente && (
                  <span className="text-[10px] font-black bg-indigo-600 text-white px-2 py-0.5 rounded-lg">
                    Rev. {master.revisione_corrente}
                  </span>
                )}
                <span className="text-[10px] font-black bg-slate-700 text-slate-300 px-2 py-0.5 rounded-lg">
                  {master?.codice_documento}
                </span>
              </div>
              <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest mt-0.5">
                Seleziona strutture destinatarie e genera documenti
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {scad && (
              <span className={`text-[11px] font-black px-2.5 py-1 rounded-lg ${scad.cls}`}>
                Scad. {scad.label}
              </span>
            )}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Info bar */}
        {master?.udo_applicabilita?.length > 0 && (
          <div className="bg-slate-50 border-b border-slate-100 px-7 py-2.5 flex items-center gap-2">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">UDO applicabili:</span>
            {master.udo_applicabilita.map(u => (
              <span key={u} className="text-[11px] font-black bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-lg">
                {u}
              </span>
            ))}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={28} className="text-indigo-400 animate-spin" />
            </div>
          ) : error ? (
            <div className="p-8 text-center text-rose-600 font-bold">{error}</div>
          ) : risultati ? (
            /* Schermata risultati */
            <div className="p-8 flex flex-col items-center text-center gap-4">
              {risultati.errors.length === 0 ? (
                <>
                  <CheckCircle2 size={48} className="text-emerald-500" />
                  <p className="text-xl font-black text-slate-800">
                    {risultati.total} document{risultati.total === 1 ? 'o generato' : 'i generati'} con successo
                  </p>
                  <div className="w-full max-w-md bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-left space-y-2">
                    <p className="text-xs font-bold text-indigo-800">✓ Documenti disponibili nell'area personale di ogni struttura</p>
                    <p className="text-xs text-indigo-600">Le strutture troveranno i documenti nella sezione <strong>I miei documenti</strong> del loro portale.</p>
                    <p className="text-xs text-slate-400 italic">Notifica email: non attiva in questa versione.</p>
                  </div>
                </>
              ) : (
                <>
                  <AlertTriangle size={48} className="text-amber-500" />
                  <p className="text-xl font-black text-slate-800">
                    {risultati.total - risultati.errors.length}/{risultati.total} documenti generati
                  </p>
                  <div className="w-full max-w-md text-left bg-rose-50 border border-rose-200 rounded-xl p-4 space-y-1">
                    {risultati.errors.map((e, i) => (
                      <p key={i} className="text-xs font-bold text-rose-700 flex items-start gap-2">
                        <XCircle size={13} className="mt-0.5 shrink-0" />
                        <span>{e.name}: {e.error}</span>
                      </p>
                    ))}
                  </div>
                </>
              )}
              <button
                onClick={onClose}
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-black uppercase shadow hover:bg-indigo-700 transition-colors"
              >
                Chiudi
              </button>
            </div>
          ) : (
            /* Tabella strutture */
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="px-5 py-3 text-left w-10">
                    <button onClick={toggleAll} className="text-slate-400 hover:text-indigo-600">
                      {selected.size === facilities.length && facilities.length > 0
                        ? <CheckSquare size={16} />
                        : <Square size={16} />
                      }
                    </button>
                  </th>
                  <th className="px-3 py-3 text-left text-[11px] font-black text-slate-500 uppercase tracking-wider">Struttura</th>
                  <th className="px-3 py-3 text-left text-[11px] font-black text-slate-500 uppercase tracking-wider">Società</th>
                  <th className="px-3 py-3 text-left text-[11px] font-black text-slate-500 uppercase tracking-wider">UDO</th>
                  <th className="px-3 py-3 text-left text-[11px] font-black text-slate-500 uppercase tracking-wider">Regione</th>
                  <th className="px-3 py-3 text-center text-[11px] font-black text-slate-500 uppercase tracking-wider">Dir. San.</th>
                  <th className="px-3 py-3 text-left text-[11px] font-black text-slate-500 uppercase tracking-wider">Stato</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {facilities.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-slate-400 font-bold">
                      Nessuna struttura compatibile con le UDO di questo documento
                    </td>
                  </tr>
                ) : (
                  facilities.map(fac => {
                    const stato     = getStatoFacility(fac);
                    const isSel     = selected.has(fac.id);
                    const missingDs = !fac.director_sanitario;
                    return (
                      <tr
                        key={fac.id}
                        onClick={() => toggleSelect(fac.id)}
                        className={`cursor-pointer transition-colors ${
                          isSel ? 'bg-indigo-50' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="px-5 py-3">
                          {isSel
                            ? <CheckSquare size={16} className="text-indigo-600" />
                            : <Square     size={16} className="text-slate-300"   />
                          }
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <Building2 size={13} className="text-slate-300 shrink-0" />
                            <span className="font-bold text-slate-800 text-sm">{fac.name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-sm text-slate-500">{fac.ragione_sociale}</td>
                        <td className="px-3 py-3">
                          <span className="text-[11px] font-black bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg">
                            {fac.udo_tipo}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-sm text-slate-500">{fac.region}</td>
                        <td className="px-3 py-3 text-center">
                          {missingDs
                            ? <AlertTriangle size={14} className="text-amber-400 mx-auto" title="Direttore sanitario mancante" />
                            : <CheckCircle2  size={14} className="text-emerald-500 mx-auto" />
                          }
                        </td>
                        <td className="px-3 py-3">
                          <IstanzaStatoBadge stato={stato} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Progress bar durante generazione */}
        {generating && (
          <div className="px-7 py-3 bg-indigo-50 border-t border-indigo-100">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-indigo-700">
                Generazione in corso… {progress.current}/{progress.total}
              </span>
              <span className="text-xs text-indigo-500">
                {Math.round((progress.current / (progress.total || 1)) * 100)}%
              </span>
            </div>
            <div className="h-2 bg-indigo-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600 transition-all duration-300"
                style={{ width: `${Math.round((progress.current / (progress.total || 1)) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Footer */}
        {!risultati && (
          <div className="border-t border-slate-100 px-7 py-4 flex items-center justify-between shrink-0 bg-slate-50">
            <div className="flex items-center gap-4">
              <span className="text-sm font-black text-slate-600">
                {selected.size} struttur{selected.size === 1 ? 'a' : 'e'} selezionat{selected.size === 1 ? 'a' : 'e'}
              </span>
              {missingData.length > 0 && (
                <span className="flex items-center gap-1.5 text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
                  <AlertTriangle size={12} />
                  {missingData.length} con dati mancanti (Dir. Sanitario)
                </span>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={generating}
                className="px-5 py-2.5 rounded-xl text-sm font-black uppercase text-slate-500 hover:bg-slate-200 transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={handleGenera}
                disabled={generating || selected.size === 0 || !master.file_url_master}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black uppercase bg-indigo-600 text-white shadow hover:bg-indigo-700 transition-colors disabled:opacity-40"
              >
                {generating ? (
                  <><Loader2 size={15} className="animate-spin" /> Generazione…</>
                ) : (
                  <><Send size={15} /> Genera e distribuisci</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
