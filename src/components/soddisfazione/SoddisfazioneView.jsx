// src/components/soddisfazione/SoddisfazioneView.jsx
// Sezione /report ③ "Soddisfazione" (documento redesign, §3): benchmark per
// dimensione, trend NPS con early warning, word cloud commenti liberi,
// confronto ospiti vs operatori. Sola consultazione — la generazione
// documenti resta nella sezione operativa Survey (SurveyPage.jsx).
import React, { useMemo, useState } from 'react';
import UniversalFilterBar, { EMPTY_FILTERS, applyFacilityFilters } from '../cruscotto/UniversalFilterBar';
import BenchmarkDimensioni from './BenchmarkDimensioni';
import NpsTrendChart from './NpsTrendChart';
import WordCloudCommenti from './WordCloudCommenti';
import OspitiVsOperatoriPanel from './OspitiVsOperatoriPanel';

const PERIOD_OPTIONS = [
  { value: '12', label: 'Ultimi 12 mesi' },
  { value: '24', label: 'Ultimi 24 mesi' },
  { value: 'all', label: 'Tutto lo storico' },
];

export default function SoddisfazioneView({
  facilities, companies, udos, campaignsClient, campaignsOperator,
}) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [period, setPeriod] = useState('12');

  const filteredFacilities = useMemo(
    () => applyFacilityFilters(facilities, filters),
    [facilities, filters]
  );
  const filteredFacilityIds = useMemo(
    () => filteredFacilities.filter(f => !f.is_suspended).map(f => f.id),
    [filteredFacilities]
  );

  // Il periodo limita solo la scansione dei commenti liberi (5 tabelle raw,
  // costo di query maggiore) — il trend NPS e il benchmark usano sempre
  // tutto lo storico campagne disponibile, altrimenti un "trend" a 12 mesi
  // mostrerebbe 1-2 punti soltanto.
  const { fromDate, toDate } = useMemo(() => {
    if (period === 'all') return { fromDate: null, toDate: null };
    const months = Number(period);
    const from = new Date();
    from.setMonth(from.getMonth() - months);
    return { fromDate: from.toISOString().split('T')[0], toDate: null };
  }, [period]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <UniversalFilterBar
          facilities={facilities}
          companies={companies}
          udos={udos}
          value={filters}
          onChange={setFilters}
        />
        <select value={period} onChange={e => setPeriod(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium outline-none focus:border-emerald-400">
          {PERIOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <BenchmarkDimensioni facilities={filteredFacilities} campaignsClient={campaignsClient} campaignsOperator={campaignsOperator} />

      <NpsTrendChart facilities={filteredFacilities} campaignsClient={campaignsClient} />

      <div className="grid grid-cols-2 gap-4">
        <WordCloudCommenti facilityIds={filteredFacilityIds} fromDate={fromDate} toDate={toDate} />
        <OspitiVsOperatoriPanel facilities={filteredFacilities} campaignsClient={campaignsClient} campaignsOperator={campaignsOperator} />
      </div>
    </div>
  );
}
