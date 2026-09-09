// src/components/ImportOccupazioneModal.jsx
import { useState, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { X, Upload, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  parseXlsxFile,
  matchToServiziMap,
  importOccupazioneMensile,
} from '../services/occupazioneImportService';

const MESE_LABEL = ['', 'Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

export default function ImportOccupazioneModal({ onClose }) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const fileRef = useRef(null);

  const [step, setStep] = useState('upload'); // upload | preview | result
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState('');
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [matched, setMatched] = useState([]);
  const [errors, setErrors] = useState([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [importError, setImportError] = useState('');

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
      const rawRows = await parseXlsxFile(f);
      const { matched: m, errors: e } = await matchToServiziMap(rawRows);
      setMatched(m);
      setErrors(e);
      setStep('preview');
    } catch (err) {
      setFileError(`Errore lettura file: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleFileChange = useCallback((e) => {
    handleFile(e.target.files?.[0]);
  }, [handleFile]);

  const handleDragOver  = useCallback((e) => { e.preventDefault(); setIsDragging(true);  }, []);
  const handleDragLeave = useCallback((e) => { e.preventDefault(); setIsDragging(false); }, []);
  const handleDrop      = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  }, [handleFile]);

  const periodi = Array.from(
    new Set(matched.map(r => `${MESE_LABEL[r.mese]} ${r.anno}`))
  ).sort();

  const confermaImport = async () => {
    setImporting(true);
    setImportError('');
    try {
      const res = await importOccupazioneMensile(matched, profile?.id);
      queryClient.invalidateQueries({ queryKey: ['cdgData'] });
      setResult(res);
      setStep('result');
    } catch (err) {
      setImportError(err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">

        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-black text-slate-800">Importa occupazione mensile</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Carica il file Excel di presenze/occupazione da caricare in Saturazione
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <X size={18} className="text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">

          {step === 'upload' && (
            <>
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl px-6 py-10 text-center cursor-pointer transition-all group
                  ${fileError   ? 'border-rose-300 bg-rose-50'
                    : loading    ? 'border-teal-300 bg-teal-50/60'
                    : isDragging ? 'border-teal-400 bg-teal-50/60'
                    : 'border-slate-200 hover:border-teal-300 hover:bg-teal-50/40'}
                `}
              >
                {loading ? (
                  <div className="flex flex-col items-center gap-1.5">
                    <Loader2 size={22} className="text-teal-500 animate-spin" />
                    <p className="text-sm font-bold text-teal-500">Lettura {fileName}...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1.5">
                    <Upload size={22} className="text-slate-300 group-hover:text-teal-400 transition-colors" />
                    <p className="text-sm font-bold text-slate-400 group-hover:text-teal-500 transition-colors">
                      Trascina il file .xlsx qui oppure clicca per selezionare
                    </p>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept=".xlsx" onChange={handleFileChange} className="hidden" />
              {fileError && <p className="text-xs text-rose-500 mt-2">{fileError}</p>}
            </>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                  <p className="text-[10px] text-emerald-700 uppercase tracking-wide font-bold">Righe riconosciute</p>
                  <p className="text-xl font-black text-emerald-800">{matched.length}</p>
                </div>
                <div className={`rounded-xl px-4 py-3 border ${errors.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                  <p className={`text-[10px] uppercase tracking-wide font-bold ${errors.length > 0 ? 'text-amber-700' : 'text-slate-500'}`}>Righe non riconosciute</p>
                  <p className={`text-xl font-black ${errors.length > 0 ? 'text-amber-800' : 'text-slate-500'}`}>{errors.length}</p>
                </div>
              </div>

              {periodi.length > 0 && (
                <p className="text-xs text-slate-500">
                  Periodi nel file: <span className="font-medium text-slate-700">{periodi.join(', ')}</span>
                </p>
              )}

              {errors.length > 0 && (
                <div className="border border-amber-200 rounded-xl overflow-hidden">
                  <div className="bg-amber-50 px-3 py-2 flex items-center gap-1.5">
                    <AlertTriangle size={13} className="text-amber-600" />
                    <p className="text-xs font-bold text-amber-800">
                      Queste righe non hanno trovato corrispondenza e non verranno importate
                    </p>
                  </div>
                  <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
                    {errors.map((e, i) => (
                      <div key={i} className="px-3 py-2 text-xs">
                        <p className="text-slate-700">
                          <span className="font-medium">{e.sede || '—'}</span>
                          {' · '}
                          <span>{e.servizio || '—'}</span>
                          {e.anno && e.mese && (
                            <span className="text-slate-400"> · {MESE_LABEL[e.mese]} {e.anno}</span>
                          )}
                        </p>
                        <p className="text-amber-600">{e.motivo}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {importError && (
                <p className="text-xs text-rose-500">Errore importazione: {importError}</p>
              )}
            </div>
          )}

          {step === 'result' && result && (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <CheckCircle2 size={28} className="text-emerald-500" />
              <p className="text-sm font-bold text-slate-700">
                {result.righeImportate} righe importate/aggiornate
              </p>
              <p className="text-xs text-slate-500">
                Periodi: {result.periodi.join(', ')}
              </p>
              {errors.length > 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  {errors.length} righe non importate perché senza corrispondenza (vedi elenco nella schermata precedente)
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100">
          {step === 'preview' && (
            <>
              <button
                onClick={() => { setStep('upload'); setFileName(''); setMatched([]); setErrors([]); }}
                className="text-xs font-bold text-slate-500 px-3 py-2 rounded-lg hover:bg-slate-100"
              >
                Annulla
              </button>
              <button
                onClick={confermaImport}
                disabled={importing || matched.length === 0}
                className="flex items-center gap-1 text-xs font-bold bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                {importing ? <><Loader2 size={12} className="animate-spin" /> Importazione...</> : `Conferma importazione (${matched.length} righe)`}
              </button>
            </>
          )}
          {step === 'result' && (
            <button
              onClick={onClose}
              className="text-xs font-bold bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-900"
            >
              Chiudi
            </button>
          )}
          {step === 'upload' && (
            <button
              onClick={onClose}
              className="text-xs font-bold text-slate-500 px-3 py-2 rounded-lg hover:bg-slate-100"
            >
              Annulla
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
