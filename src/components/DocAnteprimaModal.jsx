// src/components/DocAnteprimaModal.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  X, Eye, Download, Send, Loader2, Building2,
} from 'lucide-react';
import { supabase }           from '../supabaseClient';
import { downloadMasterFile, compileDocumento, getStoricoRevisioni3 } from '../services/documentiService';

export default function DocAnteprimaModal({ master, onClose, onGoDist, facilityId = null }) {
  const fixedFacility = !!facilityId;

  const [facilities,    setFacilities]    = useState([]);
  const [selectedFacId, setSelectedFacId] = useState(facilityId ? String(facilityId) : '');
  const [facilityData,  setFacilityData]  = useState(null);
  const [loadingData,   setLoadingData]   = useState(false);
  const [loadingFac,    setLoadingFac]    = useState(!fixedFacility);
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
      .select(`id, name, address, region, company_id,
        director, director_sanitario, email_direzione, bed_count,
        companies(name), udos(name)`)
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
              ? <>Anteprima del documento. <span className="font-black">Non distribuisce nulla.</span></>
              : <>Scegli una struttura e scarica il documento master. <span className="font-black">Non distribuisce nulla</span> e non lascia tracce nel DB.</>
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
              <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
                <Building2 size={14} className="text-slate-400 shrink-0" />
                <span className="text-sm font-bold text-slate-700">
                  {facilityData?.name ?? '…'}
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
                ? <><Loader2 size={14} className="animate-spin" /> Download…</>
                : <><Download size={14} /> Scarica anteprima .docx</>
              }
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
