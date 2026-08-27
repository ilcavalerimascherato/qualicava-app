// src/components/verifiche/RegistraSessioneModal.jsx
// Form di registrazione sessione: esito per sotto-voce se il template ne
// ha (pattern Heliopolis OK/NC/N-P), altrimenti un esito unico sulla
// sessione.
import React, { useEffect, useState } from 'react';
import { X, ClipboardCheck } from 'lucide-react';
import { getTemplateVoci } from '../../services/verificheService';
import { formatCadenza } from '../../utils/verificheCadenza';

const ESITI = ['OK', 'NC', 'NP'];
const ESITO_STYLE = {
  OK: 'bg-emerald-600 border-emerald-600 text-white',
  NC: 'bg-red-600 border-red-600 text-white',
  NP: 'bg-amber-500 border-amber-500 text-white',
};

export default function RegistraSessioneModal({ template, onClose, onSave }) {
  const [voci, setVoci] = useState([]);
  const [esiti, setEsiti] = useState({}); // voceId -> { esito, nota } — chiave 'generale' se nessuna voce
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingVoci, setLoadingVoci] = useState(true);

  useEffect(() => {
    getTemplateVoci(template.id).then(v => { setVoci(v); setLoadingVoci(false); });
  }, [template.id]);

  const setEsito = (key, esito) => setEsiti(prev => ({ ...prev, [key]: { ...prev[key], esito } }));
  const setNotaVoce = (key, nota) => setEsiti(prev => ({ ...prev, [key]: { ...prev[key], nota } }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const righe = voci.length > 0
        ? voci.map(v => ({ voce_id: v.id, esito: esiti[v.id]?.esito ?? null, nota: esiti[v.id]?.nota ?? null })).filter(r => r.esito)
        : [{ voce_id: null, esito: esiti.generale?.esito ?? null, nota: esiti.generale?.nota ?? null }].filter(r => r.esito);
      await onSave({ esiti: righe, note });
    } finally {
      setSaving(false);
    }
  };

  const pronto = voci.length > 0
    ? voci.every(v => esiti[v.id]?.esito)
    : !!esiti.generale?.esito;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <ClipboardCheck size={16} className="text-slate-400" />
            <div>
              <h2 className="text-sm font-semibold text-slate-800">{template.nome}</h2>
              <p className="text-[11px] text-slate-400">{template.categoria} · {formatCadenza(template)}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-3 overflow-y-auto">
          {loadingVoci ? (
            <p className="text-sm text-slate-400 text-center py-6">Caricamento...</p>
          ) : voci.length > 0 ? (
            voci.map(v => (
              <div key={v.id} className="border border-slate-100 rounded-xl p-3">
                <p className="text-sm text-slate-700 mb-2">{v.voce}{v.rif && <span className="text-[10px] text-slate-400 ml-1">({v.rif})</span>}</p>
                <div className="flex items-center gap-2 mb-2">
                  {ESITI.map(e => (
                    <button key={e} onClick={() => setEsito(v.id, e)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold border ${esiti[v.id]?.esito === e ? ESITO_STYLE[e] : 'border-slate-200 text-slate-500'}`}>
                      {e}
                    </button>
                  ))}
                </div>
                <input
                  value={esiti[v.id]?.nota ?? ''}
                  onChange={e => setNotaVoce(v.id, e.target.value)}
                  placeholder="Nota (opzionale)"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-emerald-400"
                />
              </div>
            ))
          ) : (
            <div className="border border-slate-100 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                {ESITI.map(e => (
                  <button key={e} onClick={() => setEsito('generale', e)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold border ${esiti.generale?.esito === e ? ESITO_STYLE[e] : 'border-slate-200 text-slate-500'}`}>
                    {e}
                  </button>
                ))}
              </div>
              <input
                value={esiti.generale?.nota ?? ''}
                onChange={e => setNotaVoce('generale', e.target.value)}
                placeholder="Nota (opzionale)"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-emerald-400"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Note generali sessione</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-emerald-400" />
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100 bg-slate-50 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 rounded-lg">Annulla</button>
          <button onClick={handleSave} disabled={saving || !pronto} className="px-4 py-2 text-sm font-semibold bg-emerald-600 text-white rounded-lg disabled:opacity-50">
            Registra sessione
          </button>
        </div>
      </div>
    </div>
  );
}
