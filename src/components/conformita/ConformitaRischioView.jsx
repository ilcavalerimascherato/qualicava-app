// src/components/conformita/ConformitaRischioView.jsx
// Sezione /report ④ "Conformità & Rischio" (documento redesign, §4).
// SAE resta placeholder (dipende dalla sezione operativa Verifiche, non
// costruita); Verbali ispettivi ora ha dato reale dal modulo omonimo.
import React, { useMemo, useState } from 'react';
import UniversalFilterBar, { EMPTY_FILTERS, applyFacilityFilters } from '../cruscotto/UniversalFilterBar';
import NcDistribuzione from './NcDistribuzione';
import NcTrendMensile from './NcTrendMensile';
import NcTempoChiusura from './NcTempoChiusura';
import NcAging from './NcAging';
import SegnaliDeboliPanel from './SegnaliDeboliPanel';
import SaeIspettiviPlaceholder from './SaeIspettiviPlaceholder';
import VerbaliIspettiviSummaryCard from './VerbaliIspettiviSummaryCard';

export default function ConformitaRischioView({ facilities, companies, udos, nonConformities }) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const filteredFacilities = useMemo(
    () => applyFacilityFilters(facilities, filters),
    [facilities, filters]
  );

  const filteredNc = useMemo(() => {
    const ids = new Set(filteredFacilities.map(f => f.id));
    return (nonConformities ?? []).filter(nc => ids.has(nc.facility_id));
  }, [nonConformities, filteredFacilities]);

  return (
    <div className="space-y-5">
      <UniversalFilterBar
        facilities={facilities}
        companies={companies}
        udos={udos}
        value={filters}
        onChange={setFilters}
      />

      <NcDistribuzione nonConformities={filteredNc} />

      <NcTrendMensile nonConformities={filteredNc} />

      <div className="grid grid-cols-2 gap-4">
        <NcTempoChiusura nonConformities={filteredNc} />
        <NcAging nonConformities={filteredNc} />
      </div>

      <SegnaliDeboliPanel nonConformities={filteredNc} facilities={filteredFacilities} />

      <div className="grid grid-cols-2 gap-4">
        <SaeIspettiviPlaceholder />
        <VerbaliIspettiviSummaryCard facilities={filteredFacilities} />
      </div>
    </div>
  );
}
