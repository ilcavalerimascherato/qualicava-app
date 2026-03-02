import React, { useState, useEffect } from 'react';
import { X, Save, Upload, Loader2, CheckCircle, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../supabaseClient';

export default function QuestionnaireModal({ isOpen, onClose, info, year, questionnaires, onSave }) {
  const q = info ? questionnaires.find(x => x.facility_id === info.facility.id && x.type === info.type) : null;
  
  // STATO SINCRONIZZATO CON NOMI COLONNE DB
  const [formData, setFormData] = useState({ start_date: '', end_date: '', esiti_pdf: '' });
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (isOpen && q) {
      setFormData({ 
        start_date: q.start_date || '', 
        end_date: q.end_date || '', 
        esiti_pdf: q.esiti_pdf || '' 
      });
    } else if (!isOpen) {
      setFormData({ start_date: '', end_date: '', esiti_pdf: '' });
    }
  }, [isOpen, q]);

  if (!isOpen || !info) return null;

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || file.type !== 'application/pdf') {
      alert("Solo PDF.");
      return;
    }

    setUploading(true);
    try {
      const filePath = `${year}/${info.facility.id}_${info.type}.pdf`.replace(/\s/g, '');
      const { error: uploadError } = await supabase.storage.from('questionnaires').upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const payload = {
        facility_id: info.facility.id,
        year: year,
        type: info.type,
        start_date: formData.start_date || new Date().toISOString().split('T')[0],
        end_date: formData.end_date || null,
        esiti_pdf: filePath
      };

      await onSave(payload);
      setFormData(prev => ({ ...prev, esiti_pdf: filePath }));
    } catch (error) {
      alert("Errore caricamento: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const publicUrl = `https://ibgbejvqujgiovxnhsuz.supabase.co/storage/v1/object/public/questionnaires/${formData.esiti_pdf}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 text-slate-900">
        <div className="px-8 py-6 border-b flex justify-between items-center bg-slate-50/50">
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight text-indigo-950">Monitoraggio {info.type === 'client' ? 'Clienti' : 'Operatori'}</h2>
            <p className="text-[13px] text-slate-500 font-bold uppercase italic tracking-wider">{info.facility.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-rose-500 p-2 rounded-full transition-colors"><X size={28} /></button>
        </div>
        
        <div className="p-8 space-y-8">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-[11px] font-black text-slate-400 uppercase mb-2 tracking-widest">Inizio</label>
              <input type="date" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 font-bold bg-slate-50/50 outline-none focus:border-indigo-500 transition-all" />
            </div>
            <div>
              <label className="block text-[11px] font-black text-slate-400 uppercase mb-2 tracking-widest">Fine</label>
              <input type="date" value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 font-bold bg-slate-50/50 outline-none focus:border-indigo-500 transition-all" />
            </div>
          </div>

          <div 
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFileUpload({target: {files: e.dataTransfer.files}}); }}
            className={`relative border-2 border-dashed rounded-3xl p-8 transition-all flex flex-col items-center justify-center ${isDragging ? 'border-indigo-500 bg-indigo-50' : formData.esiti_pdf ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}
          >
            {uploading ? (
              <Loader2 className="animate-spin text-indigo-600" size={40} />
            ) : formData.esiti_pdf ? (
              <div className="flex flex-col items-center gap-3">
                <CheckCircle className="text-emerald-500" size={40} />
                <p className="text-sm font-black text-emerald-900 uppercase italic">Report Acquisito</p>
                <a href={publicUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-indigo-600 font-black text-xs uppercase border-b-2 border-indigo-200 hover:border-indigo-600 pb-1">
                  <ExternalLink size={14} /> Apri PDF
                </a>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-slate-400">
                <Upload size={40} /><p className="text-xs font-black uppercase text-center tracking-tighter">Trascina il PDF o Clicca</p>
              </div>
            )}
            <label className="mt-6">
              <div className={`px-6 py-2.5 rounded-xl font-black text-xs uppercase cursor-pointer shadow-md transition-all ${formData.esiti_pdf ? 'bg-white text-emerald-600 border border-emerald-200 hover:bg-emerald-50' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
                {formData.esiti_pdf ? 'Sostituisci Documento' : 'Seleziona Documento'}
              </div>
              <input type="file" className="hidden" accept=".pdf" onChange={handleFileUpload} disabled={uploading} />
            </label>
          </div>

          <button onClick={() => onSave({ ...formData, facility_id: info.facility.id, year, type: info.type })} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-[2px] hover:bg-black shadow-xl transition-all">
            <Save size={20} className="inline mr-2" /> Salva Dati Sessione
          </button>
        </div>
      </motion.div>
    </div>
  );
}