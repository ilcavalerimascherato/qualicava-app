// src/components/conformita/SegnaliDeboliPanel.jsx
// "Segnali deboli" — versione solo-NC (documento redesign /report, §4:
// nella versione completa incrocia NC+SAE+Verbali ispettivi; SAE non ha
// ancora fonte dati in QualiCAVA. I rilievi confermati dal modulo Verbali
// Ispettivi generano già righe non_conformities (classificazione "Verbale
// Ente Vigilanza"), quindi sono indirettamente inclusi qui — un incrocio
// dedicato per-verbale, distinto dalle NC che generano, resta da fare).
import React, { useMemo } from 'react';
import { Radar } from 'lucide-react';
import { computeWeakSignals } from '../../utils/ncStats';

export default function SegnaliDeboliPanel({ nonConformities, facilities }) {
  const facilitiesById = useMemo(() => Object.fromEntries((facilities ?? []).map(f => [f.id, f])), [facilities]);
  const signals = useMemo(
    () => computeWeakSignals(nonConformities, facilitiesById, 3),
    [nonConformities, facilitiesById]
  );

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <Radar size={14} className="text-slate-400" />
        <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Segnali deboli</h3>
      </div>
      <p className="text-[11px] text-slate-400 mb-3">
        Concentrazione di NC sullo stesso tema in uno stesso trimestre — versione solo-NC: il vero incrocio con SAE e
        Verbali ispettivi richiede la sezione operativa Verifiche, non ancora costruita.
      </p>

      {signals.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">Nessuna concentrazione anomala rilevata nel periodo.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {signals.map((s, i) => (
            <li key={i} className="py-2 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-700 truncate">{s.classificazione}</p>
                <p className="text-[11px] text-slate-400 truncate">{s.facilityName} · {s.quarter}</p>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg flex-shrink-0">
                {s.count} NC
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
