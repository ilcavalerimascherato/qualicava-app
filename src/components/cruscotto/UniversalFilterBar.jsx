// src/components/cruscotto/UniversalFilterBar.jsx
// Selettore persistente regione/società/tipo UDO/struttura/periodo (documento
// redesign /report, §1 "Filtro universale"). Pensato per essere riusato dalle
// fasi successive (KPI & Economics, Soddisfazione, ecc.), non solo dal Cruscotto.
import React, { useMemo } from 'react';

const SEL = 'bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium outline-none focus:border-emerald-400 min-w-[120px]';

export const EMPTY_FILTERS = {
  region:     '',
  companyId:  '',
  udoId:      '',
  facilityId: '',
};

export default function UniversalFilterBar({ facilities, companies, udos, value, onChange, year }) {
  const regions = useMemo(
    () => [...new Set((facilities ?? []).map(f => f.region).filter(Boolean))].sort(),
    [facilities]
  );

  // Le società/UDO/strutture disponibili si restringono in base alla regione già scelta
  const facilitiesInRegion = useMemo(
    () => value.region ? (facilities ?? []).filter(f => f.region === value.region) : (facilities ?? []),
    [facilities, value.region]
  );

  const companiesAvailable = useMemo(() => {
    const ids = new Set(facilitiesInRegion.map(f => f.company_id));
    return (companies ?? []).filter(c => ids.has(c.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [facilitiesInRegion, companies]);

  const facilitiesAvailable = useMemo(() => {
    let list = facilitiesInRegion;
    if (value.companyId) list = list.filter(f => String(f.company_id) === String(value.companyId));
    if (value.udoId)     list = list.filter(f => String(f.udo_id) === String(value.udoId));
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [facilitiesInRegion, value.companyId, value.udoId]);

  const set = (patch) => onChange({ ...value, ...patch });

  return (
    <div className="flex flex-wrap items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mr-1">Filtro</span>

      <select className={SEL} value={value.region} onChange={e => set({ region: e.target.value, companyId: '', facilityId: '' })}>
        <option value="">Tutte le regioni</option>
        {regions.map(r => <option key={r} value={r}>{r}</option>)}
      </select>

      <select className={SEL} value={value.companyId} onChange={e => set({ companyId: e.target.value, facilityId: '' })}>
        <option value="">Tutte le società</option>
        {companiesAvailable.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
      </select>

      <select className={SEL} value={value.udoId} onChange={e => set({ udoId: e.target.value, facilityId: '' })}>
        <option value="">Tutti i tipi UDO</option>
        {(udos ?? []).map(u => <option key={u.id} value={String(u.id)}>{u.name}</option>)}
      </select>

      <select className={SEL} value={value.facilityId} onChange={e => set({ facilityId: e.target.value })}>
        <option value="">Tutte le strutture</option>
        {facilitiesAvailable.map(f => <option key={f.id} value={String(f.id)}>{f.name}</option>)}
      </select>

      {(value.region || value.companyId || value.udoId || value.facilityId) && (
        <button
          onClick={() => onChange(EMPTY_FILTERS)}
          className="text-xs font-semibold text-slate-400 hover:text-slate-600 ml-1"
        >
          Reimposta
        </button>
      )}

      {year != null && (
        <span className="ml-auto text-xs text-slate-400">Anno: <span className="font-semibold text-slate-600">{year}</span></span>
      )}
    </div>
  );
}

/** Applica i filtri correnti a un array di facilities. Riusabile dalle fasi successive. */
export function applyFacilityFilters(facilities, filters) {
  return (facilities ?? []).filter(f => {
    if (filters.region && f.region !== filters.region) return false;
    if (filters.companyId && String(f.company_id) !== String(filters.companyId)) return false;
    if (filters.udoId && String(f.udo_id) !== String(filters.udoId)) return false;
    if (filters.facilityId && String(f.id) !== String(filters.facilityId)) return false;
    return true;
  });
}
