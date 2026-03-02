import React, { useState } from 'react';
import { X, Plus, Trash2, Save, Edit2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function UdoManagerModal({ isOpen, onClose, udos, onSave, onDelete }) {
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({ name: '', color: '#4f46e5' });
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#4f46e5');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden text-slate-900">
        <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50">
          <h2 className="text-lg font-bold">Configurazione UDO</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Form Nuovo */}
          <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100 space-y-3">
            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Aggiungi Categoria</p>
            <div className="flex gap-2">
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Esempio: RSA" className="flex-1 border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
              <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)} className="w-10 h-10 border rounded-lg cursor-pointer p-1 bg-white" />
              <button onClick={() => { if(newName) { onSave({ name: newName, color: newColor }); setNewName(''); } }} className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 shadow-md"><Plus size={20} /></button>
            </div>
          </div>

          {/* Lista e Modifica */}
          <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Categorie Esistenti</p>
            {udos.map(u => (
              <div key={u.id} className="flex items-center justify-between p-3 border rounded-xl bg-white hover:border-indigo-200 transition-colors">
                {editingId === u.id ? (
                  <div className="flex gap-2 w-full">
                    <input type="text" value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} className="flex-1 border rounded px-2 py-1 text-sm outline-none" />
                    <input type="color" value={editData.color} onChange={e => setEditData({...editData, color: e.target.value})} className="w-8 h-8 border rounded cursor-pointer" />
                    <button onClick={() => { onSave({ id: u.id, ...editData }); setEditingId(null); }} className="text-emerald-500 p-1"><Save size={18} /></button>
                    <button onClick={() => setEditingId(null)} className="text-slate-400 p-1"><X size={18} /></button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full shadow-inner border border-black/10" style={{ backgroundColor: u.color }}></div>
                      <span className="text-sm font-bold text-slate-700">{u.name}</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setEditingId(u.id); setEditData({ name: u.name, color: u.color }); }} className="text-slate-300 hover:text-indigo-500 transition-colors"><Edit2 size={16} /></button>
                      <button onClick={() => onDelete(u.id)} className="text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={16} /></button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}