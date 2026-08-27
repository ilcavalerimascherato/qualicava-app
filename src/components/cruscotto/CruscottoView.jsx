// src/components/cruscotto/CruscottoView.jsx
// Landing page di /report (documento redesign, §2 sezione ① Cruscotto).
// Fotografia dello stato del Gruppo in un istante: colpo d'occhio, poi
// drill-down su richiesta. Vista di default per società (nota di Claudio).
//
// La mappa coropletica dell'Italia (§2) non è ancora inclusa: richiede una
// nuova dipendenza (libreria di mappe) e un asset geojson delle regioni
// italiane che non esiste nel repo — è una decisione a parte, non bloccante
// per il resto del Cruscotto.
import React, { useMemo, useState } from 'react';
import { useCdgData } from '../../hooks/useCdgData';
import UniversalFilterBar, { EMPTY_FILTERS, applyFacilityFilters } from './UniversalFilterBar';
import NumeriChiave from './NumeriChiave';
import SemaforiGruppo from './SemaforiGruppo';
import TickerAlert from './TickerAlert';
import SocietaCard from './SocietaCard';

export default function CruscottoView({
  facilities, companies, udos, surveys, kpiRecords, nonConformities, campaignsClient,
  year, onNavigate,
}) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const filteredFacilities = useMemo(
    () => applyFacilityFilters(facilities, filters),
    [facilities, filters]
  );

  const allFacilityIds = useMemo(
    () => (facilities ?? []).filter(f => !f.is_suspended).map(f => f.id),
    [facilities]
  );
  const { data: cdgData } = useCdgData(allFacilityIds, year);
  const cdgByFacility = cdgData?.cdgByFacility ?? {};

  const filteredNc = useMemo(() => {
    const ids = new Set(filteredFacilities.map(f => f.id));
    return (nonConformities ?? []).filter(nc => ids.has(nc.facility_id));
  }, [nonConformities, filteredFacilities]);

  const filteredCampaignsClient = useMemo(() => {
    const ids = new Set(filteredFacilities.map(f => f.id));
    return (campaignsClient ?? []).filter(c => ids.has(c.facility_id));
  }, [campaignsClient, filteredFacilities]);

  const companiesToShow = useMemo(() => {
    const ids = new Set(filteredFacilities.map(f => String(f.company_id)));
    return (companies ?? [])
      .filter(c => ids.has(String(c.id)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [companies, filteredFacilities]);

  return (
    <div className="space-y-5">
      <UniversalFilterBar
        facilities={facilities}
        companies={companies}
        udos={udos}
        value={filters}
        onChange={setFilters}
        year={year}
      />

      <NumeriChiave
        facilities={filteredFacilities}
        cdgByFacility={cdgByFacility}
        nonConformities={filteredNc}
        campaignsClient={filteredCampaignsClient}
      />

      <SemaforiGruppo
        facilities={filteredFacilities}
        kpiRecords={kpiRecords}
        surveys={surveys}
        nonConformities={filteredNc}
        onNavigate={onNavigate}
      />

      <TickerAlert
        facilities={filteredFacilities}
        kpiRecords={kpiRecords}
        nonConformities={filteredNc}
        cdgByFacility={cdgByFacility}
        onNavigate={onNavigate}
      />

      <div>
        <p className="text-[11px] font-medium text-slate-400 uppercase tracking-widest mb-3">
          Società del gruppo
        </p>
        <div className="grid grid-cols-2 gap-3">
          {companiesToShow.map(c => (
            <SocietaCard key={c.id} company={c} facilities={filteredFacilities} kpiRecords={kpiRecords} />
          ))}
          {companiesToShow.length === 0 && (
            <p className="text-sm text-slate-400 col-span-2 text-center py-8">
              Nessuna società corrisponde ai filtri selezionati.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
