// src/components/verifiche/VerificheAlertPanel.jsx
// Pannello "In evidenza": verifiche scadute rispetto alla cadenza
// concordata (monitoraggio attivo richiesto esplicitamente da Claudio —
// "il sistema deve essere tenuto monitorato altrimenti si attivano
// alert"). Pattern riuso di TickerAlert.jsx (Fase 1 Cruscotto).
import React from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

const SEVERITY_STYLE = {
  alta:  { dot: 'bg-red-500',   text: 'text-red-700' },
  media: { dot: 'bg-amber-400', text: 'text-amber-700' },
};

export default function VerificheAlertPanel({ alerts, onSelect, showFacilityName = true }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle size={16} className="text-amber-500" />
        <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">In evidenza</h3>
      </div>

      {alerts.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-emerald-600 py-2">
          <CheckCircle2 size={16} />
          Nessuna verifica scaduta al momento.
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {alerts.map(alert => {
            const style = SEVERITY_STYLE[alert.severity] ?? SEVERITY_STYLE.media;
            return (
              <li key={alert.id}>
                <button
                  onClick={() => onSelect?.(alert)}
                  disabled={!onSelect}
                  className={`w-full flex items-center gap-3 py-2 text-left rounded-lg px-1.5 -mx-1.5 transition-colors ${
                    onSelect ? 'hover:bg-slate-50 cursor-pointer' : 'cursor-default'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${style.dot}`} />
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-semibold truncate ${style.text}`}>{alert.templateNome}</p>
                    {showFacilityName && <p className="text-[11px] text-slate-400 truncate">{alert.facilityName}</p>}
                  </div>
                  <span className={`text-[11px] font-bold flex-shrink-0 ${style.text}`}>
                    {alert.overdue}gg di ritardo
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
