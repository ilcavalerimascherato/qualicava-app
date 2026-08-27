// src/components/verbali/VerbaleUploadModal.jsx
// Upload PDF + estrazione AI (stati: idle -> file selezionato -> upload ->
// analisi -> completata/errore). Al successo apre la revisione tramite
// onExtracted(verbaleId) — nessuna persistenza qui oltre a quella minima
// necessaria per tenere traccia del verbale durante l'elaborazione.
import { useRef, useState } from 'react';
import { X, UploadCloud, Loader2, AlertTriangle, Paperclip } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  uploadVerbalePdf, createVerbaleRecord, updateVerbaleHeader,
  saveExtractionSuccess, saveExtractionError, MAX_PDF_BYTES,
  uploadAllegato, addAllegatoAcquisizione, notificaVerbaleCaricato,
} from '../../services/verbaliIspettiviService';
import { extractVerbaleFromPdf } from '../../utils/verbaliAiExtraction';

const STEPS = [
  { key: 'upload',    label: 'Caricamento file in archivio' },
  { key: 'analisi',   label: 'Lettura AI del documento e degli allegati' },
  { key: 'estrazione', label: 'Estrazione rilievi e proposta di risposta' },
];

export default function VerbaleUploadModal({ facility, onClose, onExtracted }) {
  const { profile } = useAuth();
  const [file, setFile] = useState(null);
  const [allegato, setAllegato] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [phase, setPhase] = useState('idle'); // idle | upload | analisi | estrazione | errore
  const [error, setError] = useState('');
  const inputRef = useRef();
  const allegatoInputRef = useRef();

  const pick = (f) => {
    if (!f) return;
    if (f.type !== 'application/pdf') { setError('Sono accettati solo file PDF.'); return; }
    if (f.size > MAX_PDF_BYTES) { setError(`Il file supera i ${Math.round(MAX_PDF_BYTES / 1024 / 1024)}MB.`); return; }
    setError('');
    setFile(f);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    pick(e.dataTransfer.files?.[0]);
  };

  const avvia = async () => {
    if (!file) return;
    setError('');
    let verbale;
    try {
      setPhase('upload');
      // Creiamo prima il record (senza path) per avere un id da usare nel
      // path dello Storage — pattern analogo a scia_id in HaccpFascicoloModal.
      const placeholder = await createVerbaleRecord({ facility, uploadedBy: profile?.id, pdfStoragePath: '' });
      verbale = placeholder;
      const { path } = await uploadVerbalePdf(facility.id, file, verbale.id);
      await updateVerbaleHeader(verbale.id, { pdf_storage_path: path });
      notificaVerbaleCaricato({ facilityName: facility.name }).catch(() => {});

      // Allegato opzionale ricevuto insieme al verbale — stessa pratica,
      // registrato come prima voce della corrispondenza (non analizzato
      // dall'AI, solo archiviato e collegato).
      if (allegato) {
        const { path: allegatoPath, fileName } = await uploadAllegato(facility.id, verbale.id, allegato);
        await addAllegatoAcquisizione({ verbaleId: verbale.id, storagePath: allegatoPath, fileName, createdBy: profile?.id });
      }

      setPhase('analisi');
      const result = await extractVerbaleFromPdf(file);

      setPhase('estrazione');
      if (!result.ok) {
        await saveExtractionError(verbale.id, result.error, result.rawText);
        setError(result.error || 'Estrazione non riuscita.');
        setPhase('errore');
        return;
      }

      await saveExtractionSuccess(verbale.id, result.data, facility);
      onExtracted(verbale.id);
    } catch (err) {
      if (verbale) await saveExtractionError(verbale.id, err.message, '');
      setError(`Errore: ${err.message}`);
      setPhase('errore');
    }
  };

  const isBusy = phase === 'upload' || phase === 'analisi' || phase === 'estrazione';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-slate-50">
          <div>
            <h2 className="font-black text-slate-800">Carica verbale</h2>
            <p className="text-xs text-slate-400">{facility?.name}</p>
          </div>
          {!isBusy && (
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <X size={18} />
            </button>
          )}
        </div>

        <div className="p-6">
          {!isBusy ? (
            <>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
                className={`flex flex-col items-center justify-center gap-2 p-8 rounded-2xl border-2 border-dashed cursor-pointer transition-all
                  ${dragging ? 'border-indigo-500 bg-indigo-50 scale-[1.01]' : 'border-slate-200 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/40'}`}
              >
                <UploadCloud size={28} className={dragging ? 'text-indigo-500' : 'text-slate-300'} />
                <p className="text-sm font-bold text-slate-600 text-center">
                  Trascina qui il PDF del verbale<br />oppure clicca per selezionarlo
                </p>
                <p className="text-xs text-slate-400">Solo PDF · max {Math.round(MAX_PDF_BYTES / 1024 / 1024)}MB</p>
                <input
                  ref={inputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={e => pick(e.target.files?.[0])}
                />
              </div>

              {file && (
                <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3 mt-4">
                  <div className="w-9 h-9 rounded-lg bg-red-50 text-red-600 flex items-center justify-center text-xs font-black">PDF</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-700 truncate">{file.name}</p>
                    <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(0)} KB</p>
                  </div>
                  <button onClick={() => setFile(null)} className="text-slate-400 hover:text-slate-600 text-xs">✕</button>
                </div>
              )}

              {file && (
                <div className="mt-3">
                  {allegato ? (
                    <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
                      <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                        <Paperclip size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-700 truncate">{allegato.name}</p>
                        <p className="text-xs text-slate-400">Allegato · {(allegato.size / 1024).toFixed(0)} KB</p>
                      </div>
                      <button onClick={() => setAllegato(null)} className="text-slate-400 hover:text-slate-600 text-xs">✕</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => allegatoInputRef.current?.click()}
                      className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800"
                    >
                      <Paperclip size={13} /> Aggiungi un allegato (stessa pratica, opzionale)
                    </button>
                  )}
                  <input
                    ref={allegatoInputRef}
                    type="file"
                    className="hidden"
                    onChange={e => setAllegato(e.target.files?.[0] ?? null)}
                  />
                </div>
              )}

              {error && (
                <p className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg mt-3 flex items-start gap-2">
                  <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" /> {error}
                </p>
              )}

              <div className="flex justify-end gap-2 mt-5">
                <button onClick={onClose} className="text-xs font-bold text-slate-500 hover:bg-slate-100 px-4 py-2 rounded-xl transition-colors">
                  Annulla
                </button>
                <button
                  onClick={avvia}
                  disabled={!file}
                  className="text-xs font-bold bg-indigo-600 text-white px-5 py-2 rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                >
                  Analizza con AI →
                </button>
              </div>
            </>
          ) : phase === 'errore' ? (
            <div className="text-center py-4">
              <AlertTriangle size={28} className="text-red-500 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-700 mb-1">Estrazione non riuscita</p>
              <p className="text-xs text-slate-500 mb-5">{error}</p>
              <div className="flex justify-center gap-2">
                <button onClick={onClose} className="text-xs font-bold text-slate-500 hover:bg-slate-100 px-4 py-2 rounded-xl transition-colors">
                  Chiudi
                </button>
                <button onClick={() => { setPhase('idle'); setError(''); }} className="text-xs font-bold bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 transition-colors">
                  Riprova
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <Loader2 size={32} className="text-indigo-500 mx-auto mb-3 animate-spin" />
              <p className="text-sm font-bold text-slate-700">Analisi in corso</p>
              <p className="text-xs text-slate-400 mb-5">Può richiedere fino a 2 minuti su verbali con allegati estesi.</p>
              <div className="text-left max-w-xs mx-auto space-y-2">
                {STEPS.map(s => {
                  const order = ['upload', 'analisi', 'estrazione'];
                  const idx = order.indexOf(s.key);
                  const curIdx = order.indexOf(phase);
                  const done = idx < curIdx;
                  const active = idx === curIdx;
                  return (
                    <div key={s.key} className={`flex items-center gap-2 text-xs ${done ? 'text-slate-500' : active ? 'text-slate-800 font-bold' : 'text-slate-300'}`}>
                      <span className={`w-4 h-4 rounded-full border flex items-center justify-center text-[9px] flex-shrink-0
                        ${done ? 'bg-emerald-500 border-emerald-500 text-white' : active ? 'border-indigo-500' : 'border-slate-200'}`}>
                        {done ? '✓' : ''}
                      </span>
                      {s.label}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
