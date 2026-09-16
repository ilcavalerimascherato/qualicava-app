// src/components/cruscotto/NumeriChiave.jsx
// Numeri chiave del gruppo: strutture attive, ospiti totali, tasso occupazione
// medio, NPS medio, NC aperte (documento redesign /report, §2 Cruscotto).
import React, { useMemo } from 'react';
import { Building2, Database, Users, Percent, Smile, AlertTriangle } from 'lucide-react';
import { aggregateCdgRecords, calcCdgSummary } from '../../hooks/useCdgData';

function Tile({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}15` }}>
        <Icon size={18} style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-bold text-slate-900 leading-tight truncate">{value}</p>
        <p className="text-[11px] text-slate-500 leading-tight">{label}</p>
        {sub && <p className="text-[10px] text-slate-400 leading-tight mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function NumeriChiave({ facilities, cdgByFacility, nonConformities, campaignsClient }) {
  const stats = useMemo(() => {
    const active = (facilities ?? []).filter(f => !f.is_suspended);

    let totalOspiti = 0;
    let totalBeds   = 0;
    let struttureConDati = 0;
    active.forEach(f => {
      const records = cdgByFacility?.[f.id];
      if (!records?.length || !f.bed_count) return;
      const summary = calcCdgSummary(aggregateCdgRecords(records), f.bed_count);
      if (summary?.mediaOspiti != null) {
        totalOspiti += summary.mediaOspiti;
        totalBeds   += f.bed_count;
        struttureConDati++;
      }
    });
    const tassoOccupazione = totalBeds > 0 ? (totalOspiti / totalBeds) * 100 : null;

    const npsValues = (campaignsClient ?? [])
      .map(c => c.avg_scores?.nps_consiglio)
      .filter(v => v != null);
    const npsMedio = npsValues.length > 0
      ? npsValues.reduce((s, v) => s + v, 0) / npsValues.length
      : null;

    const ncAperte = (nonConformities ?? []).filter(nc => nc.stato !== 'Chiuso').length;

    return {
      struttureAttive:   active.length,
      struttureConDati,
      ospitiTotali:      Math.round(totalOspiti),
      tassoOccupazione,
      npsMedio,
      ncAperte,
    };
  }, [facilities, cdgByFacility, nonConformities, campaignsClient]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <Tile icon={Building2}     color="#6366f1" label="Strutture attive"      value={stats.struttureAttive} />
      <Tile icon={Database}      color="#8b5cf6" label="Con dati occupazione"  value={stats.struttureConDati} sub={`su ${stats.struttureAttive} attive`} />
      <Tile icon={Users}         color="#0ea5e9" label="Ospiti totali"         value={stats.ospitiTotali > 0 ? stats.ospitiTotali : '—'} sub="Media ultimo mese" />
      <Tile icon={Percent}       color="#10b981" label="Occupazione media"     value={stats.tassoOccupazione != null ? `${stats.tassoOccupazione.toFixed(0)}%` : 'N/D'} />
      <Tile icon={Smile}         color="#f59e0b" label="NPS medio"             value={stats.npsMedio != null ? stats.npsMedio.toFixed(0) : 'N/D'} sub="Su 100" />
      <Tile icon={AlertTriangle} color="#ef4444" label="NC aperte"             value={stats.ncAperte} />
    </div>
  );
}
