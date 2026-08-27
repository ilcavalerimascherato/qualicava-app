// src/components/conformita/VerbaliIspettiviSummaryCard.jsx
// Sostituisce la metà "Verbali ispettivi" di SaeIspettiviPlaceholder.jsx —
// dato reale dal modulo Verbali Ispettivi, filtrato sullo stesso perimetro
// (facilities) del resto della vista Conformità & Rischio.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileWarning } from 'lucide-react';
import { fetchAllVerbali } from '../../services/verbaliIspettiviService';

export default function VerbaliIspettiviSummaryCard({ facilities }) {
  const navigate = useNavigate();
  const [verbali, setVerbali] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchAllVerbali()
      .then(rows => { if (!cancelled) setVerbali(rows); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const ids = new Set((facilities ?? []).map(f => f.id));
    return verbali.filter(v => ids.has(v.facility_id));
  }, [verbali, facilities]);

  const { daRivedere, scadute } = useMemo(() => {
    const oggi = new Date().toISOString().slice(0, 10);
    const pendenti = filtered.filter(v => ['da_rispondere', 'bozza_predisposta'].includes(v.stato_risposta) && v.scadenza_risposta);
    return {
      daRivedere: filtered.filter(v => v.stato_revisione !== 'confermato').length,
      scadute: pendenti.filter(v => v.scadenza_risposta < oggi).length,
    };
  }, [filtered]);

  return (
    <button
      onClick={() => navigate('/verbali-ispettivi')}
      className="bg-white border border-slate-200 rounded-2xl p-5 flex items-start gap-3 text-left hover:border-indigo-300 transition-colors w-full"
    >
      <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center flex-shrink-0">
        <FileWarning size={16} className="text-slate-400" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Verbali ispettivi</h3>
        {loading ? (
          <p className="text-[12px] text-slate-400 mt-1.5">Caricamento...</p>
        ) : filtered.length === 0 ? (
          <p className="text-[12px] text-slate-400 mt-1 leading-relaxed">Nessun verbale caricato per il perimetro selezionato.</p>
        ) : (
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-lg font-black text-slate-700">{filtered.length}</span>
            <span className="text-[11px] text-slate-400">verbali</span>
            {daRivedere > 0 && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                {daRivedere} da rivedere
              </span>
            )}
            {scadute > 0 && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                {scadute} risposte scadute
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}
