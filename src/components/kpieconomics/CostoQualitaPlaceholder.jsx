// src/components/kpieconomics/CostoQualitaPlaceholder.jsx
// Placeholder per il quadrante "costo per ospite vs qualità percepita"
// (documento redesign /report, §2 KPI & Economics). Nessuna fonte di dati
// economici (fatturato/costi) esiste oggi in QualiCAVA — stesso trattamento
// del semaforo "Economico" in Fase 1: si comunica cosa manca, non si finge
// un numero.
import React from 'react';
import { Wallet } from 'lucide-react';

export default function CostoQualitaPlaceholder() {
  return (
    <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-5 flex items-start gap-3">
      <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center flex-shrink-0">
        <Wallet size={16} className="text-slate-400" />
      </div>
      <div>
        <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Costo per ospite vs qualità percepita</h3>
        <p className="text-[12px] text-slate-400 mt-1 leading-relaxed">
          Dato non disponibile — nessuna fonte di fatturato/costi esiste oggi in QualiCAVA. Fonte e visibilità
          per ruolo restano una decisione della Presidente (stessa nota del semaforo Economico nel Cruscotto).
          Attenzione anche quando sarà disponibile: confrontare i costi senza normalizzare per tipo UDO è
          fuorviante — un RSA psichiatrico ha costi strutturalmente più alti di un Senior Living.
        </p>
      </div>
    </div>
  );
}
