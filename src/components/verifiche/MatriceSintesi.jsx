// src/components/verifiche/MatriceSintesi.jsx
// Matrice di monitoraggio (distinta dalla matrice di configurazione
// responsabilità): righe = strutture, colonne = template applicabili,
// celle = stato rispetto alla cadenza concordata. Sola lettura per board.
import React, { useMemo } from 'react';
import { resolveTemplatesForFacility } from '../../utils/verificheResolve';
import { computeNextDueDate, daysOverdue } from '../../utils/verificheCadenza';

const STATUS_BG = {
  verde:  'bg-emerald-100 text-emerald-800',
  giallo: 'bg-amber-100 text-amber-800',
  rosso:  'bg-red-100 text-red-800',
  na:     'bg-slate-50 text-slate-300',
};

function statoCella(template, facility, sessioni) {
  const sessioniTemplate = sessioni.filter(s => s.facility_id === facility.id && s.template_id === template.id);
  const ultima = sessioniTemplate.length
    ? sessioniTemplate.reduce((max, s) => new Date(s.data_esecuzione) > new Date(max.data_esecuzione) ? s : max).data_esecuzione
    : null;
  const overdue = daysOverdue(computeNextDueDate(template, ultima));
  if (!ultima && overdue >= 0) return { stato: 'rosso', label: 'Mai eseguita' };
  if (overdue > 7) return { stato: 'rosso', label: `${overdue}gg di ritardo` };
  if (overdue > 0) return { stato: 'giallo', label: `${overdue}gg di ritardo` };
  return { stato: 'verde', label: 'In regola' };
}

export default function MatriceSintesi({ facilities, templates, templateRuoli, sessioni }) {
  const attiveFacilities = useMemo(
    () => (facilities ?? []).filter(f => !f.is_suspended).sort((a, b) => a.name.localeCompare(b.name)),
    [facilities]
  );
  const templateAttivi = useMemo(() => (templates ?? []).filter(t => t.attivo), [templates]);

  const rows = useMemo(() => attiveFacilities.map(facility => {
    const applicabili = resolveTemplatesForFacility(facility, templateAttivi, templateRuoli);
    const cells = templateAttivi.map(t => {
      const applicabile = applicabili.some(a => a.id === t.id);
      return { template: t, applicabile, ...(applicabile ? statoCella(t, facility, sessioni) : { stato: 'na', label: 'Non applicabile' }) };
    });
    return { facility, cells };
  }), [attiveFacilities, templateAttivi, templateRuoli, sessioni]);

  if (rows.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-8">Nessuna struttura corrisponde ai filtri selezionati.</p>;
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Matrice di sintesi</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">Stato di ciascuna verifica rispetto alla cadenza concordata</p>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-semibold text-slate-500">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-100 border border-emerald-300" /> In regola</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-100 border border-amber-300" /> In ritardo</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-100 border border-red-300" /> Scaduta</span>
        </div>
      </div>

      <div className="overflow-auto max-h-[520px] custom-scrollbar">
        <table className="border-collapse text-[11px]">
          <thead className="sticky top-0 z-20">
            <tr>
              <th className="sticky left-0 z-30 bg-white border-b border-r border-slate-200 px-3 py-2 text-left font-semibold text-slate-600 min-w-[180px]">
                Struttura
              </th>
              {templateAttivi.map(t => (
                <th key={t.id} title={t.categoria} className="bg-white border-b border-slate-200 px-2 py-2 text-left font-semibold text-slate-500 whitespace-nowrap">
                  {t.nome}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ facility, cells }) => (
              <tr key={facility.id}>
                <td className="sticky left-0 z-10 bg-white border-r border-b border-slate-100 px-3 py-1.5 font-medium text-slate-700 whitespace-nowrap">
                  {facility.name}
                </td>
                {cells.map(c => (
                  <td key={c.template.id} title={c.label} className={`border-b border-slate-100 px-2 py-1.5 text-center font-semibold whitespace-nowrap ${STATUS_BG[c.stato]}`}>
                    {c.stato === 'na' ? '—' : c.label}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
