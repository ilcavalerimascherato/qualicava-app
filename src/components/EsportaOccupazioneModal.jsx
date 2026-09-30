// src/components/EsportaOccupazioneModal.jsx
// Modal per scegliere i due mesi da confrontare prima di esportare il report
// xlsx occupazione — di default gli ultimi due mesi con dato reale (stesso
// comportamento di prima), ma l'utente può scegliere qualsiasi coppia di
// mesi disponibili (es. per statistiche pregresse o confronti a metà mese).
import { useMemo, useState } from 'react';
import { X, Download } from 'lucide-react';
import { getAvailablePeriods, exportOccupazioneReport, MESE_LABEL } from '../services/occupazioneReportService';

function periodKey(p) {
  return p ? `${p.anno}-${p.mese}` : '';
}

function periodLabel(p) {
  return `${MESE_LABEL[p.mese]} ${p.anno}`;
}

export default function EsportaOccupazioneModal({ facilities, onClose }) {
  const availablePeriods = useMemo(() => getAvailablePeriods(facilities), [facilities]);

  const [currentKey]  = useState(() => periodKey(availablePeriods[0]));
  const [previousKey] = useState(() => periodKey(availablePeriods[1]));
  const [selCurrent, setSelCurrent]   = useState(currentKey);
  const [selPrevious, setSelPrevious] = useState(previousKey);

  const findPeriod = key => availablePeriods.find(p => periodKey(p) === key) ?? null;

  const handleExport = () => {
    const periodCurrent  = findPeriod(selCurrent);
    const periodPrevious = findPeriod(selPrevious);
    exportOccupazioneReport(facilities, periodCurrent, periodPrevious);
    onClose();
  };

  const sameMonth = selCurrent && selCurrent === selPrevious;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col">

        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-black text-slate-800">Esporta report occupazione</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Scegli i due mesi da confrontare
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <X size={18} className="text-slate-400" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">Mese di confronto</label>
            <select
              value={selPrevious}
              onChange={e => setSelPrevious(e.target.value)}
              className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:border-teal-400"
            >
              {availablePeriods.map(p => (
                <option key={periodKey(p)} value={periodKey(p)}>{periodLabel(p)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">Mese corrente</label>
            <select
              value={selCurrent}
              onChange={e => setSelCurrent(e.target.value)}
              className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:border-teal-400"
            >
              {availablePeriods.map(p => (
                <option key={periodKey(p)} value={periodKey(p)}>{periodLabel(p)}</option>
              ))}
            </select>
          </div>

          {sameMonth && (
            <p className="text-xs text-amber-600">
              Hai selezionato lo stesso mese in entrambi i campi.
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100">
          <button onClick={onClose} className="text-xs font-bold text-slate-500 px-3 py-2 rounded-lg hover:bg-slate-100">
            Annulla
          </button>
          <button
            onClick={handleExport}
            disabled={!selCurrent || !selPrevious}
            className="flex items-center gap-1.5 text-xs font-bold bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
          >
            <Download size={12} /> Esporta
          </button>
        </div>
      </div>
    </div>
  );
}
