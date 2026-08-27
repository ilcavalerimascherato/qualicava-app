// src/components/verbali/VerbaliIspettiviTab.jsx
// Tab "Verbali Ispettivi" della dashboard struttura — elenco + upload +
// revisione. Stato dei modal gestito localmente (nessuna registrazione in
// ModalContext: nessun altro punto dell'app deve aprirli, per ora).
import { useEffect, useState, useCallback } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { fetchVerbaliByFacility } from '../../services/verbaliIspettiviService';
import VerbaleUploadModal from './VerbaleUploadModal';
import VerbaleReviewModal from './VerbaleReviewModal';

const TIPO_LABEL = {
  sopralluogo_vigilanza: 'Sopralluogo di Vigilanza',
  controllo_appropriatezza: 'Controllo Appropriatezza',
  altro: 'Ispezione',
};

function Badge({ variant, children }) {
  const styles = {
    gray:    'bg-slate-100 text-slate-500 border-slate-200',
    amber:   'bg-amber-50 text-amber-700 border-amber-200',
    green:   'bg-emerald-50 text-emerald-700 border-emerald-200',
    red:     'bg-red-50 text-red-700 border-red-200',
  };
  return <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border whitespace-nowrap ${styles[variant]}`}>{children}</span>;
}

function statoBadge(v) {
  if (v.stato_elaborazione_ai === 'errore') return <Badge variant="red">⚠ Errore analisi</Badge>;
  if (v.stato_elaborazione_ai === 'in_coda' || v.stato_elaborazione_ai === 'in_corso') return <Badge variant="gray">⏳ Analisi in corso</Badge>;
  if (v.stato_revisione === 'confermato') return <Badge variant="green">✓ Confermato</Badge>;
  return <Badge variant="amber">⏳ Da rivedere</Badge>;
}

function rispostaBadge(v) {
  if (v.stato_risposta === 'non_richiesta' || !v.scadenza_risposta) return null;
  if (v.stato_risposta === 'inviata') return <Badge variant="gray">Risposta inviata</Badge>;
  const oggi = new Date().toISOString().slice(0, 10);
  const urgente = v.scadenza_risposta <= oggi;
  return <Badge variant={urgente ? 'red' : 'amber'}>Risposta entro {v.scadenza_risposta}</Badge>;
}

export default function VerbaliIspettiviTab({ facility }) {
  const [verbali, setVerbali] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [reviewId, setReviewId] = useState(null);

  const load = useCallback(async () => {
    if (!facility?.id) return;
    setLoading(true);
    try {
      const data = await fetchVerbaliByFacility(facility.id);
      setVerbali(data);
      setError('');
    } catch (err) {
      setError(`Impossibile caricare i verbali: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [facility?.id]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-black text-slate-800 text-lg">Verbali Ispettivi</h2>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 text-xs font-bold bg-emerald-600 text-white px-4 py-2 rounded-xl hover:bg-emerald-700 transition-colors"
        >
          ＋ Carica verbale
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
          <Loader2 size={16} className="animate-spin" /> Caricamento verbali...
        </div>
      ) : error ? (
        <p className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{error}</p>
      ) : verbali.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-slate-400 text-sm font-medium">Nessun verbale caricato per questa struttura</p>
          <p className="text-slate-300 text-xs mt-1">Carica il PDF ricevuto dall'ente per estrarre automaticamente rilievi e prescrizioni</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {verbali.map(v => (
            <button
              key={v.id}
              onClick={() => setReviewId(v.id)}
              disabled={v.stato_elaborazione_ai === 'in_coda' || v.stato_elaborazione_ai === 'in_corso'}
              className="w-full flex items-center gap-4 p-4 rounded-2xl border border-slate-200 bg-white hover:border-indigo-300 transition-colors text-left disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center flex-shrink-0">
                <FileText size={16} className="text-slate-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-700 truncate">
                  Verbale N. {v.numero_verbale || '—'} · {TIPO_LABEL[v.tipo_ispezione] || 'Ispezione'}
                  {v.data_sopralluogo && ` · ${v.data_sopralluogo}`}
                </p>
                <p className="text-xs text-slate-400 truncate">{v.ente || 'Ente non identificato'}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {statoBadge(v)}
                {rispostaBadge(v)}
              </div>
            </button>
          ))}
        </div>
      )}

      {showUpload && (
        <VerbaleUploadModal
          facility={facility}
          onClose={() => setShowUpload(false)}
          onExtracted={(verbaleId) => { setShowUpload(false); setReviewId(verbaleId); load(); }}
        />
      )}

      {reviewId && (
        <VerbaleReviewModal
          verbaleId={reviewId}
          facility={facility}
          onClose={() => { setReviewId(null); load(); }}
          onConfirmed={() => { setReviewId(null); load(); }}
        />
      )}
    </div>
  );
}
