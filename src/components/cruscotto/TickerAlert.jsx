// src/components/cruscotto/TickerAlert.jsx
// Le 5 situazioni più urgenti del gruppo (documento redesign /report, §2
// Cruscotto). Nessun inserimento — solo link alla sezione operativa.
import React, { useMemo } from 'react';
import { AlertTriangle, ChevronRight, CheckCircle2 } from 'lucide-react';
import { getGroupAlerts } from '../../utils/alertEngine';

const ROUTE_TO_NAV = { '/non-conformita': 'nc', '/occupazione': 'saturazione', '/report': 'report' };

const SEVERITY_STYLE = {
  alta:  { dot: 'bg-red-500',   text: 'text-red-700' },
  media: { dot: 'bg-amber-400', text: 'text-amber-700' },
};

export default function TickerAlert({ facilities, kpiRecords, nonConformities, cdgByFacility, onNavigate }) {
  const alerts = useMemo(() => getGroupAlerts({
    facilities, kpiRecords, nonConformities, cdgByFacility,
  }), [facilities, kpiRecords, nonConformities, cdgByFacility]);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle size={16} className="text-amber-500" />
        <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Situazioni più urgenti</h3>
      </div>

      {alerts.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-emerald-600 py-2">
          <CheckCircle2 size={16} />
          Nessuna situazione urgente al momento.
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {alerts.map(alert => {
            const style = SEVERITY_STYLE[alert.severity] ?? SEVERITY_STYLE.media;
            const clickable = !!onNavigate;
            return (
              <li key={alert.id}>
                <button
                  onClick={clickable ? () => onNavigate(ROUTE_TO_NAV[alert.target] ?? 'report') : undefined}
                  disabled={!clickable}
                  className={`w-full flex items-center gap-3 py-2 text-left rounded-lg px-1.5 -mx-1.5 transition-colors ${
                    clickable ? 'hover:bg-slate-50 cursor-pointer' : 'cursor-default'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${style.dot}`} />
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-semibold truncate ${style.text}`}>{alert.label}</p>
                    <p className="text-[11px] text-slate-400 truncate">{alert.facilityName}</p>
                  </div>
                  {clickable && <ChevronRight size={14} className="text-slate-300 flex-shrink-0" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
