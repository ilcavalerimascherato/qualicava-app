// src/components/conformita/SaeIspettiviPlaceholder.jsx
// Placeholder per SAE (Eventi Avversi Severi) — documento redesign /report,
// §4 Conformità & Rischio. Questa fonte non esiste ancora in QualiCAVA:
// richiede il form dedicato nella sezione operativa "Verifiche". Il
// secondo box di questa sezione (Verbali ispettivi) non è più un
// placeholder: vedi VerbaliIspettiviSummaryCard.jsx, dato reale dal
// modulo Verbali Ispettivi.
import React from 'react';
import { ShieldAlert } from 'lucide-react';

export default function SaeIspettiviPlaceholder() {
  return (
    <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-5 flex items-start gap-3">
      <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center flex-shrink-0">
        <ShieldAlert size={16} className="text-slate-400" />
      </div>
      <div>
        <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">SAE — Eventi Avversi Severi</h3>
        <p className="text-[12px] text-slate-400 mt-1 leading-relaxed">
          Dato non disponibile — richiede il form dedicato (classificazione, esito, azioni correttive) nella sezione operativa Verifiche, non ancora costruita.
        </p>
      </div>
    </div>
  );
}
