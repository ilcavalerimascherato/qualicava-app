// src/components/ImportChiusuraModal.jsx
// Wizard di import della chiusura mensile CDG — stesso schema a 3 step di
// ImportOccupazioneModal.jsx, con un'aggiunta: un file = una struttura, va
// scelta prima di poter caricare il file (a differenza del file BI, che è
// multi-struttura e si auto-assegna via cdg_servizi_map).
import { useState, useRef, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { X, Upload, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  readChiusuraGrid,
  extractChiusura,
  buildChiusuraRows,
  importChiusuraMensile,
  listCandidateRows,
  locateColumnBlocks,
  toNumber,
  OPTIONAL_ROW_LABELS,
} from '../services/chiusuraMensileService';

const MESE_LABEL = ['', 'Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

export default function ImportChiusuraModal({ facilities, onClose }) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const fileRef = useRef(null);

  const [facilityId, setFacilityId] = useState('');
  const [step, setStep] = useState('upload'); // upload | mapping | preview | result
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState('');
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [grid, setGrid] = useState(null);
  const [extraction, setExtraction] = useState(null);
  const [mappingSelections, setMappingSelections] = useState({}); // { [chiave]: rowIndex | 'skip' }
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [importError, setImportError] = useState('');

  const sortedFacilities = useMemo(
    () => (facilities ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)),
    [facilities]
  );
  const selectedFacility = sortedFacilities.find(f => String(f.id) === String(facilityId));

  const handleFile = useCallback(async (f) => {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.xlsx')) {
      setFileError('Solo file .xlsx supportati');
      return;
    }
    setFileError('');
    setFileName(f.name);
    setLoading(true);
    try {
      const { grid: parsedGrid } = await readChiusuraGrid(f);
      setGrid(parsedGrid);
      const ext = extractChiusura(parsedGrid);
      setExtraction(ext);
      // Mai indovinare una riga ambigua: se qualche voce opzionale non ha
      // trovato un match automatico, si passa dall'operatore prima
      // dell'anteprima invece di lasciarla vuota in silenzio.
      setMappingSelections({});
      setStep(ext.unmatchedOptional.length > 0 ? 'mapping' : 'preview');
    } catch (err) {
      setFileError(`Errore lettura file: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  // Colonna del mese di chiusura (Actual) — per mostrare un valore di
  // anteprima accanto a ogni riga candidata, così l'operatore riconosce
  // quale "Totale" (o simile) è quello giusto senza aprire l'Excel.
  const closingCol = useMemo(() => {
    if (!grid) return null;
    try {
      const { blocks } = locateColumnBlocks(grid);
      const sorted = blocks.actual.slice().sort((a, b) => a.mese - b.mese);
      return sorted.at(-1)?.col ?? null;
    } catch {
      return null;
    }
  }, [grid]);

  const candidateRows = useMemo(() => {
    if (!grid || !extraction) return [];
    return listCandidateRows(grid, Object.values(extraction.rowIndexByKey));
  }, [grid, extraction]);

  const mappingComplete = extraction
    ? extraction.unmatchedOptional.every(key => mappingSelections[key] != null)
    : false;

  const confermaMapping = () => {
    if (!grid || !mappingComplete) return;
    setExtraction(extractChiusura(grid, mappingSelections));
    setStep('preview');
  };

  const handleFileChange = useCallback((e) => handleFile(e.target.files?.[0]), [handleFile]);
  const handleDragOver  = useCallback((e) => { e.preventDefault(); setIsDragging(true);  }, []);
  const handleDragLeave = useCallback((e) => { e.preventDefault(); setIsDragging(false); }, []);
  const handleDrop      = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  }, [handleFile]);

  const confermaImport = async () => {
    setImporting(true);
    setImportError('');
    try {
      const rows = buildChiusuraRows(extraction, Number(facilityId), selectedFacility?.company_id, profile?.id);
      const res = await importChiusuraMensile(rows, profile?.id);
      queryClient.invalidateQueries({ queryKey: ['chiusuraMensile'] });
      queryClient.invalidateQueries({ queryKey: ['chiusuraPortfolio'] });
      setResult(res);
      setStep('result');
    } catch (err) {
      setImportError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setStep('upload'); setFileName(''); setGrid(null); setExtraction(null);
    setMappingSelections({}); setFileError('');
  };

  const totaleRighe = extraction ? extraction.py.length + extraction.actual.length + extraction.budget.length : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">

        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-black text-slate-800">Importa chiusura mensile</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Carica il file Excel di chiusura P&amp;L prodotto dal Controllo di Gestione
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <X size={18} className="text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">

          {step === 'upload' && (
            <>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">Struttura</label>
              <select
                value={facilityId}
                onChange={e => setFacilityId(e.target.value)}
                className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:border-teal-400 mb-4"
              >
                <option value="">Seleziona la struttura del file…</option>
                {sortedFacilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>

              <div
                onClick={() => facilityId && fileRef.current?.click()}
                onDragOver={facilityId ? handleDragOver : undefined}
                onDragLeave={facilityId ? handleDragLeave : undefined}
                onDrop={facilityId ? handleDrop : undefined}
                className={`border-2 border-dashed rounded-2xl px-6 py-10 text-center transition-all group
                  ${!facilityId ? 'border-slate-100 bg-slate-50 cursor-not-allowed'
                    : fileError   ? 'border-rose-300 bg-rose-50 cursor-pointer'
                    : loading    ? 'border-teal-300 bg-teal-50/60 cursor-pointer'
                    : isDragging ? 'border-teal-400 bg-teal-50/60 cursor-pointer'
                    : 'border-slate-200 hover:border-teal-300 hover:bg-teal-50/40 cursor-pointer'}
                `}
              >
                {loading ? (
                  <div className="flex flex-col items-center gap-1.5">
                    <Loader2 size={22} className="text-teal-500 animate-spin" />
                    <p className="text-sm font-bold text-teal-500">Lettura {fileName}...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1.5">
                    <Upload size={22} className={facilityId ? 'text-slate-300 group-hover:text-teal-400 transition-colors' : 'text-slate-200'} />
                    <p className={`text-sm font-bold transition-colors ${facilityId ? 'text-slate-400 group-hover:text-teal-500' : 'text-slate-300'}`}>
                      {facilityId ? 'Trascina il file .xlsx qui oppure clicca per selezionare' : 'Scegli prima la struttura'}
                    </p>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept=".xlsx" onChange={handleFileChange} className="hidden" />
              {fileError && <p className="text-xs text-rose-500 mt-2">{fileError}</p>}
            </>
          )}

          {step === 'mapping' && extraction && (
            <div className="space-y-4">
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-xs">
                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                <span>
                  Il modello di questo file non è uguale agli altri già visti — {extraction.unmatchedOptional.length === 1 ? 'una voce' : 'alcune voci'} non
                  {' '}{extraction.unmatchedOptional.length === 1 ? 'ha trovato' : 'hanno trovato'} una corrispondenza automatica.
                  Conferma tu quale riga usare (o indica che non è presente in questo file) — meglio chiedere che indovinare.
                </span>
              </div>

              {extraction.unmatchedOptional.map(key => (
                <div key={key} className="border border-slate-200 rounded-xl p-3">
                  <p className="text-xs font-bold text-slate-700 mb-2">{OPTIONAL_ROW_LABELS[key] || key}</p>
                  <select
                    value={mappingSelections[key] === 'skip' ? '__skip__' : (mappingSelections[key] ?? '')}
                    onChange={e => {
                      const v = e.target.value;
                      setMappingSelections(s => ({
                        ...s,
                        [key]: v === '' ? undefined : v === '__skip__' ? 'skip' : Number(v),
                      }));
                    }}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-teal-400"
                  >
                    <option value="">Seleziona la riga corretta…</option>
                    {candidateRows.map(c => (
                      <option key={c.rowIndex} value={c.rowIndex}>
                        {c.label}
                        {closingCol != null && ` — ${MESE_LABEL[extraction.meseChiusura]}: ${toNumber(grid[c.rowIndex]?.[closingCol])?.toLocaleString('it-IT') ?? '—'}`}
                      </option>
                    ))}
                    <option value="__skip__">Non presente in questo file</option>
                  </select>
                </div>
              ))}
            </div>
          )}

          {step === 'preview' && extraction && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500">
                Struttura: <span className="font-bold text-slate-700">{selectedFacility?.name}</span>
                {' · '}Chiusura: <span className="font-bold text-slate-700">{MESE_LABEL[extraction.meseChiusura]} {extraction.annoChiusura}</span>
              </p>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide font-bold">Mesi {extraction.annoChiusura - 1} (PY)</p>
                  <p className="text-xl font-black text-slate-700">{extraction.py.length}</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                  <p className="text-[10px] text-emerald-700 uppercase tracking-wide font-bold">Mesi Actual {extraction.annoChiusura}</p>
                  <p className="text-xl font-black text-emerald-800">{extraction.actual.length}</p>
                </div>
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3">
                  <p className="text-[10px] text-indigo-700 uppercase tracking-wide font-bold">Mesi Budget {extraction.annoChiusura}</p>
                  <p className="text-xl font-black text-indigo-800">{extraction.budget.length}</p>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-3 py-2">
                  <p className="text-xs font-bold text-slate-600">
                    Anteprima — {MESE_LABEL[extraction.meseChiusura]} {extraction.annoChiusura} (ultimo mese actual)
                  </p>
                </div>
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-slate-100">
                    {['ricavi', 'costi_personale', 'ebitda'].map(key => (
                      <tr key={key}>
                        <td className="px-3 py-1.5 text-slate-500">{key}</td>
                        <td className="px-3 py-1.5 text-right font-bold text-slate-700">
                          {extraction.actual.at(-1)?.values[key]?.toLocaleString('it-IT', { maximumFractionDigits: 0 }) ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-xs text-slate-500">
                Verranno scritte/aggiornate <span className="font-bold text-slate-700">{totaleRighe} righe</span> in totale
                (un mese × scenario per riga).
              </p>

              {importError && <p className="text-xs text-rose-500">Errore importazione: {importError}</p>}
            </div>
          )}

          {step === 'result' && result && (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <CheckCircle2 size={28} className="text-emerald-500" />
              <p className="text-sm font-bold text-slate-700">{result.righeImportate} righe importate/aggiornate</p>
              <p className="text-xs text-slate-500">{selectedFacility?.name}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100">
          {step === 'mapping' && (
            <>
              <button onClick={reset} className="text-xs font-bold text-slate-500 px-3 py-2 rounded-lg hover:bg-slate-100">
                Annulla
              </button>
              <button
                onClick={confermaMapping}
                disabled={!mappingComplete}
                className="text-xs font-bold text-white bg-slate-800 px-4 py-2 rounded-lg hover:bg-slate-900 disabled:opacity-50"
              >
                Continua
              </button>
            </>
          )}
          {step === 'preview' && (
            <>
              <button onClick={reset} className="text-xs font-bold text-slate-500 px-3 py-2 rounded-lg hover:bg-slate-100">
                Annulla
              </button>
              <button
                onClick={confermaImport}
                disabled={importing}
                className="flex items-center gap-1 text-xs font-bold bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                {importing ? <><Loader2 size={12} className="animate-spin" /> Importazione...</> : `Conferma importazione (${totaleRighe} righe)`}
              </button>
            </>
          )}
          {step === 'result' && (
            <button onClick={onClose} className="text-xs font-bold bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-900">
              Chiudi
            </button>
          )}
          {step === 'upload' && (
            <button onClick={onClose} className="text-xs font-bold text-slate-500 px-3 py-2 rounded-lg hover:bg-slate-100">
              Annulla
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
