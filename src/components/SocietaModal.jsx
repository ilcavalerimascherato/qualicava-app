// src/components/SocietaModal.jsx
import React from 'react';
import { X, Briefcase } from 'lucide-react';
import CompanyConfigTab from './CompanyConfigTab';

export default function SocietaModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl overflow-hidden font-sans">

        {/* Header */}
        <div className="bg-slate-950 px-8 py-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-indigo-600 rounded-lg text-white"><Briefcase size={22} /></div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-wider">Società</h2>
              <p className="text-xs text-indigo-400 font-bold uppercase tracking-widest">Gestione società e gruppi</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-full transition-colors"><X size={26} /></button>
        </div>

        {/* Contenuto */}
        <div className="flex-1 overflow-y-auto bg-white">
          <div className="h-full overflow-y-auto">
            <CompanyConfigTab />
          </div>
        </div>
      </div>
    </div>
  );
}
