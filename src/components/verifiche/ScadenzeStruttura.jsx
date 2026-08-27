// src/components/verifiche/ScadenzeStruttura.jsx
// Scadenzario normativo per struttura (Legionella, ascensori, antincendio,
// caldaie, ecc. — generico, non hardcoded come nel prototipo Heliopolis).
import React, { useMemo } from 'react';

function statoScadenza(dataScadenza) {
  const oggi = new Date(); oggi.setHours(0, 0, 0, 0);
  const due = new Date(dataScadenza);
  const diff = Math.round((due - oggi) / (24 * 60 * 60 * 1000));
  if (diff < 0) return { cls: 'red', label: 'SCADUTO' };
  if (diff <= 30) return { cls: 'red', label: `tra ${diff}gg` };
  if (diff <= 90) return { cls: 'amber', label: `tra ${diff}gg` };
  return { cls: 'green', label: `tra ${diff}gg` };
}

const CLS = {
  red:   { border: 'border-l-red-500',   text: 'text-red-600' },
  amber: { border: 'border-l-amber-500', text: 'text-amber-600' },
  green: { border: 'border-l-emerald-500', text: 'text-emerald-600' },
};

export default function ScadenzeStruttura({ scadenze }) {
  const ordinate = useMemo(
    () => [...(scadenze ?? [])].sort((a, b) => new Date(a.data_scadenza) - new Date(b.data_scadenza)),
    [scadenze]
  );

  if (ordinate.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-6">Nessuna scadenza normativa registrata.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {ordinate.map(s => {
        const stato = statoScadenza(s.data_scadenza);
        const c = CLS[stato.cls];
        return (
          <div key={s.id} className={`bg-white border border-slate-200 border-l-4 ${c.border} rounded-xl p-3`}>
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">{s.riferimento_normativo || '—'}</p>
            <p className="text-sm font-semibold text-slate-700 mb-1">{s.nome}</p>
            <p className={`text-lg font-bold ${c.text}`}>{stato.label}</p>
            <p className="text-[11px] text-slate-400">
              {new Date(s.data_scadenza).toLocaleDateString('it-IT')}{s.ditta_riferimento ? ` · ${s.ditta_riferimento}` : ''}
            </p>
          </div>
        );
      })}
    </div>
  );
}
