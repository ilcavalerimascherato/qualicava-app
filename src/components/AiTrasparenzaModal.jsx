// src/components/AiTrasparenzaModal.jsx
// Pannello di trasparenza sull'uso dell'AI in QualiCAVA (Impostazioni →
// Dati → Trasparenza AI). Pensato in ottica AI Act: elenca ogni punto del
// sistema in cui un modello genera testo o dati per l'utente, con il
// prompt esatto inviato. Legge SOLO src/config/aiPrompts.js — nessuna
// duplicazione: aggiungere un prompt lì lo fa comparire automaticamente qui.
import { useMemo, useState } from 'react';
import { X, ChevronDown, Bot, FileText, Database } from 'lucide-react';
import { listAiCallSites } from '../config/aiPrompts';
import { MODEL } from '../utils/aiClient';

const CATEGORIA_ICON = {
  'Questionari — bozze testuali':                <FileText size={14} />,
  'KPI qualità':                                  <Bot size={14} />,
  'Estrazione automatica documenti (dati strutturati)': <Database size={14} />,
};

function VoceAi({ voce, expanded, onToggle }) {
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-800 font-mono">{voce.id}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">{voce.trigger}</p>
        </div>
        <ChevronDown size={14} className={`text-slate-400 transition-transform shrink-0 ml-3 ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="p-3 space-y-3 border-t border-slate-100">
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <p className="text-slate-400 font-bold uppercase tracking-wide text-[9px]">Chiamata da</p>
              <p className="text-slate-700 font-mono mt-0.5">{voce.calledFrom}</p>
            </div>
            <div>
              <p className="text-slate-400 font-bold uppercase tracking-wide text-[9px]">Client / modello</p>
              <p className="text-slate-700 font-mono mt-0.5">{voce.client} · {MODEL}</p>
            </div>
            <div className="col-span-2">
              <p className="text-slate-400 font-bold uppercase tracking-wide text-[9px]">Uso del risultato</p>
              <p className="text-slate-700 mt-0.5">{voce.output}</p>
            </div>
          </div>
          <div>
            <p className="text-slate-400 font-bold uppercase tracking-wide text-[9px] mb-1">
              Prompt inviato al modello (i valori tra [parentesi quadre] sono i dati che vengono inseriti al posto del segnaposto)
            </p>
            <pre className="text-[11px] leading-relaxed bg-slate-900 text-slate-100 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap font-mono">
              {voce.promptPreview}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AiTrasparenzaModal({ onClose }) {
  const [expandedId, setExpandedId] = useState(null);

  const gruppi = useMemo(() => {
    const voci = listAiCallSites();
    const byCategoria = {};
    voci.forEach(v => {
      const cat = v.categoria || 'Altro';
      if (!byCategoria[cat]) byCategoria[cat] = [];
      byCategoria[cat].push(v);
    });
    return Object.entries(byCategoria);
  }, []);

  const totale = gruppi.reduce((sum, [, voci]) => sum + voci.length, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">

        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-black text-slate-800">Trasparenza AI</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {totale} funzioni in cui QualiCAVA chiama un modello AI (Anthropic Claude) — cosa lo attiva e il prompt esatto inviato
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <X size={18} className="text-slate-400" />
          </button>
        </div>

        <div className="px-6 py-3 border-b border-slate-100 bg-amber-50/50">
          <p className="text-[11px] text-slate-600 leading-relaxed">
            In tutti i casi il testo o i dati generati dall'AI restano una <strong>bozza</strong>: nessun contenuto
            viene pubblicato, inviato o salvato senza che un utente lo riveda ed eventualmente lo modifichi prima.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {gruppi.map(([categoria, voci]) => (
            <div key={categoria}>
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-slate-400">{CATEGORIA_ICON[categoria] ?? <Bot size={14} />}</span>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{categoria}</p>
                <span className="text-[10px] text-slate-300">({voci.length})</span>
              </div>
              <div className="space-y-2">
                {voci.map(voce => (
                  <VoceAi
                    key={voce.id}
                    voce={voce}
                    expanded={expandedId === voce.id}
                    onToggle={() => setExpandedId(prev => (prev === voce.id ? null : voce.id))}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
