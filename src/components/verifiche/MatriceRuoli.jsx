// src/components/verifiche/MatriceRuoli.jsx
// Matrice responsabilità: template(righe, raggruppati per categoria) ×
// ruolo(colonne), con ereditarietà Universale → UDO → struttura. Replica
// il pattern dello screenshot condiviso da Claudio ("LTCare — Matrice
// permessi"): selettore UDO in alto, 4 stati cella (Abilitato / Ereditato
// da Universale / Salvato ora / Conflitto UDO specifiche).
import React, { useMemo, useState } from 'react';
import { Check, Settings, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { setTemplateRuolo } from '../../services/verificheService';

const UNIVERSALE = 'universale';

function groupByCategoria(templates) {
  const groups = new Map();
  templates.forEach(t => {
    if (!groups.has(t.categoria)) groups.set(t.categoria, []);
    groups.get(t.categoria).push(t);
  });
  return [...groups.entries()];
}

export default function MatriceRuoli({ templates, ruoli, templateRuoli, udos, onChanged, onEditTemplate, onManageRuoli }) {
  const [selectedUdo, setSelectedUdo] = useState(UNIVERSALE);
  const [justSaved, setJustSaved] = useState(null);
  const [saving, setSaving] = useState(null);

  const ruoliAttivi = useMemo(() => (ruoli ?? []).filter(r => r.attivo), [ruoli]);
  // Mostra sempre tutti i template, inclusi quelli disattivati — è l'unico
  // punto della UI dove gestirli, quindi disattivare un template non deve
  // farlo sparire (bug reale: prima li filtravamo qui e diventavano
  // irraggiungibili per riattivarli).
  const gruppi = useMemo(() => groupByCategoria(templates ?? []), [templates]);

  const cellState = (templateId, ruoloId) => {
    const rows = templateRuoli.filter(r => r.template_id === templateId && r.ruolo_id === ruoloId);
    const universaleRow = rows.find(r => r.facility_id == null && r.udo_id == null);

    if (selectedUdo === UNIVERSALE) {
      return { checked: universaleRow?.abilitato ?? false, mode: 'proprio', row: universaleRow };
    }

    const udoRow = rows.find(r => r.udo_id === selectedUdo);
    if (udoRow) {
      const conflitto = udoRow.abilitato !== (universaleRow?.abilitato ?? false);
      return { checked: udoRow.abilitato, mode: conflitto ? 'conflitto' : 'proprio', row: udoRow };
    }
    return { checked: universaleRow?.abilitato ?? false, mode: 'ereditato', row: null };
  };

  const toggleCell = async (templateId, ruoloId) => {
    const key = `${templateId}-${ruoloId}`;
    const state = cellState(templateId, ruoloId);
    setSaving(key);
    try {
      const udoId = selectedUdo === UNIVERSALE ? null : selectedUdo;
      await setTemplateRuolo({ templateId, ruoloId, udoId, abilitato: !state.checked });
      await onChanged();
      setJustSaved(key);
      setTimeout(() => setJustSaved(cur => cur === key ? null : cur), 1500);
    } catch (err) {
      toast.error(`Errore salvataggio: ${err.message ?? err}`);
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Matrice responsabilità</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">Chi deve eseguire ogni verifica — configurazione per gruppo, con override per tipo UDO</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedUdo}
            onChange={e => setSelectedUdo(e.target.value === UNIVERSALE ? UNIVERSALE : Number(e.target.value))}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium outline-none focus:border-emerald-400"
          >
            <option value={UNIVERSALE}>UDO: Universale</option>
            {(udos ?? []).map(u => <option key={u.id} value={u.id}>UDO: {u.name}</option>)}
          </select>
          <button onClick={onManageRuoli} className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-2.5 py-1.5">
            <Users size={12} /> Ruoli
          </button>
        </div>
      </div>

      <div className="overflow-auto max-h-[520px] custom-scrollbar">
        <table className="border-collapse text-[11px]">
          <thead className="sticky top-0 z-20 bg-white">
            <tr>
              <th className="sticky left-0 z-30 bg-white border-b border-r border-slate-200 px-3 py-2 text-left font-semibold text-slate-600 min-w-[220px]">
                Verifica
              </th>
              {ruoliAttivi.map(r => (
                <th key={r.id} className="border-b border-slate-200 px-2 py-2 text-center font-semibold text-slate-500 whitespace-nowrap min-w-[90px]">
                  {r.nome}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {gruppi.map(([categoria, temps]) => (
              <React.Fragment key={categoria}>
                <tr>
                  <td colSpan={ruoliAttivi.length + 1} className="bg-slate-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    {categoria}
                  </td>
                </tr>
                {temps.map(t => (
                  <tr key={t.id} className={!t.attivo ? 'opacity-50' : ''}>
                    <td className="sticky left-0 z-10 bg-white border-r border-b border-slate-100 px-3 py-2 whitespace-nowrap">
                      <button onClick={() => onEditTemplate(t)} className="flex items-center gap-1.5 text-left hover:text-emerald-700 group">
                        <span className="font-medium text-slate-700 group-hover:text-emerald-700">{t.nome}</span>
                        {!t.attivo && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded uppercase tracking-wide flex-shrink-0">
                            Disattivato
                          </span>
                        )}
                        <Settings size={11} className="text-slate-300 group-hover:text-emerald-500 flex-shrink-0" />
                      </button>
                    </td>
                    {ruoliAttivi.map(r => {
                      const key = `${t.id}-${r.id}`;
                      const state = cellState(t.id, r.id);
                      const isSaved = justSaved === key;
                      return (
                        <td key={r.id} className="border-b border-slate-100 px-2 py-2 text-center">
                          <button
                            onClick={() => toggleCell(t.id, r.id)}
                            disabled={saving === key}
                            title={
                              state.mode === 'ereditato' ? 'Ereditato da Universale' :
                              state.mode === 'conflitto' ? 'Conflitto UDO specifiche (diverso da Universale)' : 'Abilitato'
                            }
                            className={`w-6 h-6 rounded-md border flex items-center justify-center mx-auto transition-colors ${
                              isSaved ? 'ring-2 ring-emerald-400' : ''
                            } ${
                              state.mode === 'conflitto'
                                ? 'bg-amber-100 border-amber-400'
                                : state.checked
                                  ? state.mode === 'ereditato' ? 'bg-emerald-50 border-emerald-200' : 'bg-emerald-500 border-emerald-500'
                                  : 'bg-white border-slate-200'
                            }`}
                          >
                            {state.checked && <Check size={13} className={state.mode === 'ereditato' ? 'text-emerald-400' : 'text-white'} />}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-4 px-4 py-2.5 border-t border-slate-100 text-[10px] font-semibold text-slate-500">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500 inline-block" /> Abilitato</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-50 border border-emerald-200 inline-block" /> Ereditato da Universale</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500 ring-2 ring-emerald-400 inline-block" /> Salvato ora</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-100 border border-amber-400 inline-block" /> Conflitto UDO specifiche</span>
      </div>
    </div>
  );
}
