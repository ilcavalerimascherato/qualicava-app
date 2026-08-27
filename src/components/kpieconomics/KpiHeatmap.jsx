// src/components/kpieconomics/KpiHeatmap.jsx
// Heatmap strutture×KPI colorata per scostamento dal target (documento
// redesign /report, §2 KPI & Economics). Le strutture con completezza dati
// sotto soglia sono segnalate ma i loro valori restano visibili — sono solo
// escluse dalle medie di gruppo (vedi groupKpiStats.js), non nascoste qui.
import React, { useMemo, useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { KPI_SECTORS, getKpisBySettore, getKpiLabel, getKpiStatusFromComputedValue, formatKpiValue, isNumericSettore } from '../../config/kpiRules';
import { computeKpiValue } from '../../utils/kpiFormulaEngine';
import { getTimeHorizon } from '../../utils/kpiTimeHorizon';
import { computeFacilityCompleteness, COMPLETENESS_THRESHOLD } from '../../utils/groupKpiStats';

const STATUS_BG = {
  green:   'bg-emerald-100 text-emerald-800',
  yellow:  'bg-amber-100 text-amber-800',
  red:     'bg-red-100 text-red-800',
  neutral: 'bg-slate-50 text-slate-400',
};

const SECTOR_COLORS = [
  'bg-indigo-50 text-indigo-700', 'bg-sky-50 text-sky-700', 'bg-teal-50 text-teal-700',
  'bg-amber-50 text-amber-700', 'bg-rose-50 text-rose-700', 'bg-violet-50 text-violet-700',
];

// Solo i KPI con target hanno senso in una heatmap "per scostamento dal target".
// Raggruppati per settore (non nell'ordine grezzo di KPI_RULES) perché
// l'intestazione usa colSpan per settore: le colonne devono restare contigue.
const SECTORS_WITH_TARGETS = KPI_SECTORS.filter(s => getKpisBySettore(s).some(r => r.target_verde !== null));
const HEATMAP_RULES = SECTORS_WITH_TARGETS.flatMap(s => getKpisBySettore(s).filter(r => r.target_verde !== null));

function cellValue(rule, record, facility) {
  if (!record?.metrics_json) return { value: null, status: 'neutral' };
  const value = computeKpiValue(rule, record.metrics_json, facility);
  const status = getKpiStatusFromComputedValue(rule, value);
  return { value, status };
}

function formatCell(rule, value) {
  if (value === null) return '—';
  return isNumericSettore(rule.settore) ? value : formatKpiValue(value / 100);
}

export default function KpiHeatmap({ facilities, kpiRecords, year }) {
  const recentMonths = useMemo(() => getTimeHorizon(year).slice(-6), [year]);
  const activeFacilities = useMemo(() => (facilities ?? []).filter(f => !f.is_suspended), [facilities]);

  // Copertura per mese: quante strutture (tra quelle filtrate) hanno almeno
  // una sottomissione — aiuta a scegliere un mese con dati più completi
  // invece di essere bloccati sull'ultimo mese consolidato se è ancora scarso.
  const monthOptions = useMemo(() => recentMonths.map(m => {
    const submitted = activeFacilities.filter(f =>
      computeFacilityCompleteness(f, kpiRecords ?? [], m.yearNum, m.monthNum) !== null
    ).length;
    return { ...m, submitted, total: activeFacilities.length };
  }), [recentMonths, activeFacilities, kpiRecords]);

  const [selectedKey, setSelectedKey] = useState(null);
  // Default: ultimo mese disponibile. Se cambiano i filtri (nuova lista mesi),
  // non forzare la selezione se l'utente ne aveva già scelto uno valido.
  useEffect(() => {
    if (monthOptions.length === 0) return;
    const stillValid = monthOptions.some(m => `${m.yearNum}-${m.monthNum}` === selectedKey);
    if (!stillValid) {
      const last = monthOptions[monthOptions.length - 1];
      setSelectedKey(`${last.yearNum}-${last.monthNum}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthOptions]);

  const selectedMonth = monthOptions.find(m => `${m.yearNum}-${m.monthNum}` === selectedKey) ?? monthOptions[monthOptions.length - 1];
  const endYear = selectedMonth?.yearNum;
  const endMonthNum = selectedMonth?.monthNum;

  const rows = useMemo(() => {
    if (!endYear || !endMonthNum) return [];
    const active = [...activeFacilities].sort((a, b) => a.name.localeCompare(b.name));
    return active.map(facility => {
      const record = (kpiRecords ?? []).find(k =>
        String(k.facility_id) === String(facility.id) &&
        Number(k.year) === endYear && Number(k.month) === endMonthNum &&
        k.status === 'completed'
      );
      const completeness = computeFacilityCompleteness(facility, kpiRecords ?? [], endYear, endMonthNum);
      const cells = HEATMAP_RULES.map(rule => ({ rule, ...cellValue(rule, record, facility) }));
      return { facility, record, completeness, cells };
    });
  }, [activeFacilities, kpiRecords, endYear, endMonthNum]);

  if (rows.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-8">Nessuna struttura corrisponde ai filtri selezionati.</p>;
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-4">
        <div>
          <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Heatmap KPI per struttura</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">Colore per scostamento dal target</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedKey ?? ''}
            onChange={e => setSelectedKey(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] font-medium outline-none focus:border-emerald-400"
          >
            {monthOptions.map(m => (
              <option key={`${m.yearNum}-${m.monthNum}`} value={`${m.yearNum}-${m.monthNum}`}>
                {m.label} · {m.submitted}/{m.total} strutture
              </option>
            ))}
          </select>
          <div className="flex items-center gap-3 text-[10px] font-semibold text-slate-500">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-100 border border-emerald-300" /> Verde</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-100 border border-amber-300" /> Giallo</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-100 border border-red-300" /> Rosso</span>
          </div>
        </div>
      </div>

      <div className="overflow-auto max-h-[520px] custom-scrollbar">
        <table className="border-collapse text-[11px]">
          <thead className="sticky top-0 z-20">
            <tr>
              <th className="sticky left-0 z-30 bg-slate-50 border-b border-r border-slate-200 px-3 py-1.5 text-left" />
              {SECTORS_WITH_TARGETS.map((settore, si) => {
                const count = getKpisBySettore(settore).filter(r => r.target_verde !== null).length;
                return (
                  <th key={settore} colSpan={count}
                    className={`border-b border-slate-200 px-2 py-1 text-center font-bold uppercase tracking-wide whitespace-nowrap ${SECTOR_COLORS[si % SECTOR_COLORS.length]}`}>
                    {settore}
                  </th>
                );
              })}
            </tr>
            <tr>
              <th className="sticky left-0 z-30 bg-white border-b border-r border-slate-200 px-3 py-2 text-left font-semibold text-slate-600 min-w-[180px]">
                Struttura
              </th>
              {HEATMAP_RULES.map(rule => (
                <th key={rule.kpi_target} title={rule.indicatore}
                  className="bg-white border-b border-slate-200 px-2 py-2 text-left font-semibold text-slate-500 whitespace-nowrap">
                  {getKpiLabel(rule)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ facility, completeness, cells }) => {
              const lowCompleteness = completeness !== null && completeness < COMPLETENESS_THRESHOLD;
              return (
                <tr key={facility.id} className={lowCompleteness ? 'opacity-50' : ''}>
                  <td className="sticky left-0 z-10 bg-white border-r border-b border-slate-100 px-3 py-1.5 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-slate-700">{facility.name}</span>
                      {lowCompleteness && (
                        <span title={`Dati incompleti (${Math.round(completeness * 100)}%) — esclusa dalle medie di gruppo`}>
                          <AlertTriangle size={11} className="text-amber-500 flex-shrink-0" />
                        </span>
                      )}
                    </div>
                  </td>
                  {cells.map(({ rule, value, status }) => (
                    <td key={rule.kpi_target} className={`border-b border-slate-100 px-2 py-1.5 text-center font-semibold whitespace-nowrap ${STATUS_BG[status]}`}>
                      {formatCell(rule, value)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
