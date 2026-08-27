// src/components/verifiche/RuoliManagerModal.jsx
// CRUD dei "player" responsabili (verifiche_ruoli) — lista configurabile
// da sede, non un enum fisso (lo screenshot di riferimento ne mostra più
// di 10: OSS, Infermiere, Caposala, Medico, Direttore, ...).
import React, { useState } from 'react';
import { X, Plus, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { createRuolo, updateRuolo } from '../../services/verificheService';

export default function RuoliManagerModal({ isOpen, onClose, ruoli, onChanged }) {
  const [nuovoNome, setNuovoNome] = useState('');
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleAdd = async () => {
    if (!nuovoNome.trim()) return;
    setSaving(true);
    try {
      await createRuolo({ nome: nuovoNome.trim(), ordine: ruoli.length });
      setNuovoNome('');
      onChanged();
    } catch (err) {
      toast.error(`Errore creazione ruolo: ${err.message ?? err}`);
    } finally {
      setSaving(false);
    }
  };

  const toggleAttivo = async (ruolo) => {
    try {
      await updateRuolo(ruolo.id, { attivo: !ruolo.attivo });
      onChanged();
    } catch (err) {
      toast.error(`Errore aggiornamento ruolo: ${err.message ?? err}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-800">Ruoli responsabili</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
          {ruoli.length === 0 && <p className="text-sm text-slate-400 text-center py-6">Nessun ruolo configurato.</p>}
          {ruoli.map(r => (
            <div key={r.id} className="flex items-center justify-between gap-3 py-1.5 border-b border-slate-50 last:border-0">
              <span className={`text-sm ${r.attivo ? 'text-slate-700' : 'text-slate-300 line-through'}`}>{r.nome}</span>
              <button
                onClick={() => toggleAttivo(r)}
                className={`text-[11px] font-semibold px-2 py-1 rounded-lg ${
                  r.attivo ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {r.attivo ? 'Attivo' : 'Disattivato'}
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 px-5 py-4 border-t border-slate-100 bg-slate-50">
          <input
            value={nuovoNome}
            onChange={e => setNuovoNome(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="Nuovo ruolo (es. Coordinatore Infermieristico)"
            className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-400"
          />
          <button
            onClick={handleAdd}
            disabled={saving || !nuovoNome.trim()}
            className="flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
          >
            <Plus size={14} /> Aggiungi
          </button>
        </div>
      </div>
    </div>
  );
}
