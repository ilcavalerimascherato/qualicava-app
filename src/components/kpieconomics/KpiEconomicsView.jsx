// src/components/kpieconomics/KpiEconomicsView.jsx
// Sezione /report ② "KPI & Economics" (documento redesign, §2): integra KPI
// qualitativi e dati occupazionali in un'unica vista di confronto strutture.
// Riusa il filtro universale già costruito in Fase 1 per "confronto solo tra
// pari" (regione/società/UDO/struttura).
import React, { useMemo, useState } from 'react';
import { useCdgData } from '../../hooks/useCdgData';
import UniversalFilterBar, { EMPTY_FILTERS, applyFacilityFilters } from '../cruscotto/UniversalFilterBar';
import KpiHeatmap from './KpiHeatmap';
import KpiTrendBoxes from './KpiTrendBoxes';
import OccupazioneIntegrata from './OccupazioneIntegrata';
import CorrelazioneOccupazioneSoddisfazione from './CorrelazioneOccupazioneSoddisfazione';
import CostoQualitaPlaceholder from './CostoQualitaPlaceholder';
import EconomicoGruppoPanel    from './EconomicoGruppoPanel';

export default function KpiEconomicsView({
  facilities, companies, udos, kpiRecords, campaignsClient, year,
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

      <KpiHeatmap facilities={filteredFacilities} kpiRecords={kpiRecords} year={year} />

      <KpiTrendBoxes facilities={filteredFacilities} kpiRecords={kpiRecords} year={year} />

      <EconomicoGruppoPanel year={year} />

      <div className="grid grid-cols-2 gap-4">
        <OccupazioneIntegrata facilities={filteredFacilities} cdgByFacility={cdgByFacility} year={year} />
        <div className="space-y-4">
          <CorrelazioneOccupazioneSoddisfazione
            facilities={filteredFacilities}
            cdgByFacility={cdgByFacility}
            campaignsClient={campaignsClient}
          />
          <CostoQualitaPlaceholder />
        </div>
      </div>
    </div>
  );
}
