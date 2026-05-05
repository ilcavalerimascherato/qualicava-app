// src/components/DocAnteprimaModal.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  X, Eye, Download, Send, Loader2, AlertTriangle,
  CheckCircle2, Building2,
} from 'lucide-react';
import { supabase }            from '../supabaseClient';
import { downloadMasterFile, compileDocumento, getStoricoRevisioni3 } from '../services/documentiService';

// ─── mappa placeholder → valore ──────────────────────────────

function formatDateIT(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('it-IT'); } catch { return iso; }
}

function buildValori(facilityData, masterData) {
  return {
    nome_struttura:      facilityData?.name             ?? '',
    ragione_sociale:     facilityData?.ragione_sociale  ?? '',
    indirizzo:           facilityData?.address          ?? '',
    regione:             facilityData?.region           ?? '',
    udo_tipo:            facilityData?.udo_tipo         ?? '',
    direttore:           facilityData?.director         ?? '',
    direttore_sanitario: facilityData?.director_sanitario ?? '',
    email_direzione:     facilityData?.email_direzione  ?? '',
    posti_letto:         facilityData?.bed_count?.toString() ?? '',
    revisione:           masterData?.revisione_corrente ?? '',
    codice_documento:    masterData?.codice_documento   ?? '',
    data_approvazione:   formatDateIT(masterData?.data_approvazione),
    data_scadenza:       formatDateIT(masterData?.data_scadenza),
    approvato_da:        masterData?.approvato_da       ?? '',
  };
}

// ─── componente ───────────────────────────────────────────────

export default function DocAnteprimaModal({ master, onClose, onGoDist, facilityId = null }) {
  const fixedFacility = !!facilityId;

  const [facilities,    setFacilities]    = useState([]);
  const [selectedFacId, setSelectedFacId] = useState(facilityId ? String(facilityId) : '');
  const [facilityData,  setFacilityData]  = useState(null);
  const [loadingFac,    setLoadingFac]    = useState(!fixedFacility);
  const [loadingData,   setLoadingData]   = useState(false);
  const [downloading,   setDownloading]   = useState(false);
  const [error,         setError]         = useState('');

  // Carica elenco strutture attive — solo in modalità admin (senza facilityId fisso)
  useEffect(() => {
    if (fixedFacility) return;
    (async () => {
      const { data, error: e } = await supabase
        .from('facilities')
        .select('id, name, company_id, companies(name)')
        .eq('is_suspended', false)
        .order('name');
      if (e) { setError(e.message); return; }
      const facs = (data ?? []).map(f => ({
        ...f,
        ragione_sociale: f.companies?.name ?? '',
      }));
      setFacilities(facs);
      if (facs.length > 0) setSelectedFacId(String(facs[0].id));
      setLoadingFac(false);
    })();
  }, [fixedFacility]);

  // Carica dati completi della struttura selezionata
  useEffect(() => {
    if (!selectedFacId) return;
    setLoadingData(true);
    setFacilityData(null);
    supabase
      .from('facilities')
      .select(`
        id, name, address, region, company_id,
        director, director_sanitario, email_direzione, bed_count,
        companies(name), udos(name)
      `)
      .eq('id', selectedFacId)
      .single()
      .then(({ data, error: e }) => {
        if (e) { setError(e.message); return; }
        setFacilityData({
          ...data,
          ragione_sociale: data.companies?.name ?? '',
          udo_tipo:        data.udos?.name       ?? '',
        });
      })
      .finally(() => setLoadingData(false));
  }, [selectedFacId]);

  const valori = facilityData ? buildValori(facilityData, master) : {};
  const placeholders = master?.placeholder_list ?? [];

  const handleDownload = useCallback(async () => {
    if (!master?.file_url_master || !facilityData) return;
    setDownloading(true);
    setError('');
    try {
      const buffer  = await downloadMasterFile(master.file_url_master);
      const storico = await getStoricoRevisioni3(master.id);
      const blob    = await compileDocumento(buffer, facilityData, master, storico);
      const safeName = facilityData.name.replace(/[^a-z0-9]/gi, '_');
      const filename = `ANTEPRIMA_${master.codice_documento}_${safeName}.docx`;
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message);
    } finally {
      setDownloading(false);
    }
  }, [master, facilityData]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="bg-slate-950 px-7 py-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-700 rounded-xl text-white">
              <Eye size={18} />
            </div>
            <div>
              <h2 className="text-base font-black text-white uppercase tracking-wider">
                Anteprima documento
              </h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5 max-w-sm truncate">
                {master?.titolo}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Info banner */}
        <div className="bg-indigo-50 border-b border-indigo-100 px-7 py-3 shrink-0">
          <p className="text-xs font-bold text-indigo-700">
            {fixedFacility
              ? <>Anteprima del documento compilato con i dati della tua struttura. <span className="font-black">Non distribuisce nulla.</span></>
              : <>Scegli una struttura per vedere il documento compilato con i suoi dati reali. <span className="font-black"> Non distribuisce nulla</span> e non lascia tracce nel DB.</>
            }
          </p>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-7 space-y-5">

          {/* Struttura: fissa (direttore/sede) o selezionabile (admin) */}
          <div>
            <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Building2 size={12} /> Struttura di anteprima
            </label>

            {fixedFacility ? (
              /* Struttura fissa — vista direttore/sede */
              <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
                <Building2 size={14} className="text-slate-400 shrink-0" />
                <span className="text-sm font-bold text-slate-700">
                  {facilityData?.name ?? (loadingData ? '…' : '—')}
                </span>
                {facilityData?.name && (
                  <span className="text-xs text-slate-400 font-medium ml-1">
                    — Anteprima per questa struttura
                  </span>
                )}
              </div>
            ) : loadingFac ? (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Loader2 size={14} className="animate-spin" /> Caricamento strutture…
              </div>
            ) : (
              <select
                value={selectedFacId}
                onChange={e => setSelectedFacId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm
                  font-medium outline-none focus:ring-2 focus:ring-indigo-400 transition-all"
              >
                {facilities.map(f => (
                  <option key={f.id} value={String(f.id)}>
                    {f.name}{f.ragione_sociale ? ` (${f.ragione_sociale})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Tabella placeholder */}
          {placeholders.length > 0 && (
            <div>
              <p className="text-xs font-black text-slate-600 uppercase tracking-wider mb-2">
                Valori che verranno inseriti ({placeholders.length} placeholder)
              </p>

              {loadingData ? (
                <div className="flex items-center gap-2 py-4 text-sm text-slate-400">
                  <Loader2 size={14} className="animate-spin" /> Caricamento dati struttura…
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-2.5 text-left text-[11px] font-black text-slate-500 uppercase tracking-wider w-1/2">
                          Placeholder
                        </th>
                        <th className="px-4 py-2.5 text-left text-[11px] font-black text-slate-500 uppercase tracking-wider">
                          Valore
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {placeholders.map(ph => {
                        const val = valori[ph];
                        const isEmpty = !val || String(val).trim() === '';
                        return (
                          <tr key={ph} className={isEmpty ? 'bg-amber-50' : 'hover:bg-slate-50'}>
                            <td className="px-4 py-2.5">
                              <span className="font-mono text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                                {`{{${ph}}}`}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              {isEmpty ? (
                                <span className="flex items-center gap-1.5 text-[11px] font-black text-amber-600">
                                  <AlertTriangle size={11} /> mancante
                                </span>
                              ) : (
                                <span className="text-sm text-slate-700 font-medium">{val}</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Riepilogo mancanti */}
              {!loadingData && facilityData && (() => {
                const mancanti = placeholders.filter(ph => {
                  const v = valori[ph];
                  return !v || String(v).trim() === '';
                });
                if (mancanti.length === 0) return (
                  <p className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 mt-2">
                    <CheckCircle2 size={12} /> Tutti i campi sono compilati
                  </p>
                );
                return (
                  <p className="flex items-center gap-1.5 text-xs font-bold text-amber-600 mt-2">
                    <AlertTriangle size={12} />
                    {mancanti.length} campo{mancanti.length > 1 ? 'i' : ''} mancant{mancanti.length > 1 ? 'i' : 'e'} —
                    verranno lasciati vuoti nel documento
                  </p>
                );
              })()}
            </div>
          )}

          {/* Nessun placeholder */}
          {placeholders.length === 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
              <p className="text-xs font-bold text-slate-500">
                Nessun placeholder rilevato nel documento.
                Il file verrà scaricato così com'è.
              </p>
            </div>
          )}

          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm font-bold px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-7 py-4 flex items-center justify-between shrink-0 bg-slate-50">
          <button
            onClick={() => { onClose(); onGoDist?.(); }}
            className="flex items-center gap-2 text-xs font-black uppercase text-slate-500
              hover:text-indigo-600 px-3 py-2 hover:bg-indigo-50 rounded-xl transition-colors"
          >
            <Send size={13} /> Vai a Distribuzione
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-sm font-black uppercase text-slate-500
                hover:bg-slate-200 transition-colors"
            >
              Chiudi
            </button>
            <button
              onClick={handleDownload}
              disabled={downloading || loadingData || !facilityData || !master?.file_url_master}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black uppercase
                bg-slate-800 text-white shadow hover:bg-slate-700 transition-colors disabled:opacity-40"
            >
              {downloading
                ? <><Loader2 size={14} className="animate-spin" /> Generazione…</>
                : <><Download size={14} /> Scarica anteprima .docx</>
              }
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
