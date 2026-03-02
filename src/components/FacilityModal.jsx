import React, { useState, useEffect } from 'react';
import { X, Save, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function FacilityModal({ isOpen, onClose, udos, facility, onSave, onDelete }) {
  const [formData, setFormData] = useState({ name: '', udo_id: '', bed_count: 0, referent: '' });

  useEffect(() => {
    if (facility) setFormData(facility);
    else setFormData({ name: '', udo_id: udos[0]?.id || '', bed_count: 0, referent: '' });
  }, [facility, isOpen, udos]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden text-slate-900">
        <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50">
          <h2 className="text-lg font-bold">{facility ? 'Modifica Struttura' : 'Nuova Struttura'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
        </div>
        
        <form className="p-6 space-y-4" onSubmit={(e) => { e.preventDefault(); onSave(formData); }}>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase">Nome Struttura</label>
            <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase">Categoria UDO</label>
            <select required value={formData.udo_id} onChange={e => setFormData({...formData, udo_id: e.target.value})} className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">Seleziona UDO...</option>
              {udos.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Posti Letto</label>
              <input type="number" value={formData.bed_count} onChange={e => setFormData({...formData, bed_count: parseInt(e.target.value)})} className="w-full border rounded-lg px-3 py-2 outline-none" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Referente</label>
              <input type="text" value={formData.referent || ''} onChange={e => setFormData({...formData, referent: e.target.value})} className="w-full border rounded-lg px-3 py-2 outline-none" />
            </div>
          </div>

          <div className="pt-4 flex flex-col gap-2">
            <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700">
              <Save size={18} /> Salva Modifiche
            </button>
            {facility && (
              <button type="button" onClick={() => onDelete(facility.id)} className="w-full text-rose-500 py-2 text-sm font-bold hover:bg-rose-50 rounded-xl flex items-center justify-center gap-2">
                <Trash2 size={16} /> Elimina Struttura
              </button>
            )}
          </div>
        </form>
      </motion.div>
    </div>
  );
}