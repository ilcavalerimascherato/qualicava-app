// src/components/CompaniesView.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';

export default function CompaniesView({ companies, facilities, onSelectCompany }) {
  const [ncs, setNcs] = useState([]);

  useEffect(() => {
    supabase
      .from('non_conformities')
      .select('id, stato, gravita, facility_id')
      .neq('stato', 'risolta')
      .then(({ data }) => setNcs(data || []));
  }, []);

  // Indice facility_id → company_id
  const facilityCompany = useMemo(() => {
    const map = {};
    facilities.forEach(f => { map[f.id] = f.company_id; });
    return map;
  }, [facilities]);

  // Per ogni company: conteggio strutture e NC aperte per severità
  const companyStats = useMemo(() => {
    const stats = {};
    companies.forEach(c => {
      stats[c.id] = { facilityCount: 0, grave: 0, media: 0 };
    });

    facilities.forEach(f => {
      if (f.company_id && stats[f.company_id]) {
        stats[f.company_id].facilityCount += 1;
      }
    });

    ncs.forEach(nc => {
      const companyId = facilityCompany[nc.facility_id];
      if (!companyId || !stats[companyId]) return;
      const g = (nc.gravita || '').toLowerCase();
      if (g === 'alta' || g === 'critica' || g === 'grave') {
        stats[companyId].grave += 1;
      } else if (g === 'media' || g === 'moderata') {
        stats[companyId].media += 1;
      }
    });

    return stats;
  }, [companies, facilities, ncs, facilityCompany]);

  if (companies.length === 0) {
    return (
      <div className="flex items-center justify-center py-32 text-slate-400 font-black uppercase tracking-widest">
        Nessuna società
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
      {companies.map(company => {
        const s = companyStats[company.id] || { facilityCount: 0, grave: 0, media: 0 };
        const hasNc = s.grave > 0 || s.media > 0;

        return (
          <div
            key={company.id}
            onClick={() => onSelectCompany(company)}
            className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex flex-col gap-3 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
          >
            <div className="font-black text-slate-800 text-sm leading-tight">{company.name}</div>

            <div className="text-xs text-slate-500 font-bold">
              {s.facilityCount} {s.facilityCount === 1 ? 'struttura' : 'strutture'}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {hasNc ? (
                <>
                  {s.grave > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 bg-red-500 text-white text-xs font-black rounded-md">
                      {s.grave}
                    </span>
                  )}
                  {s.media > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 bg-orange-400 text-white text-xs font-black rounded-md">
                      {s.media}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-emerald-600 text-xs font-black">&#10003; nessuna NC</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
