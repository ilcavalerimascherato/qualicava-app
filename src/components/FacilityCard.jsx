import React from 'react';
import { Pencil, Users, UserCog, User } from 'lucide-react';

export default function FacilityCard({ f, qs, onEdit, onQClick, gridCols }) {
  
  // LOGICA COLORI STATO SINCRONIZZATA CON IL DATABASE
  const getStatusColor = (type) => {
    // 1. Cerchiamo il questionario con confronto robusto (String + lowercase)
    const q = qs.find(x => 
      String(x.facility_id) === String(f.id) && 
      String(x.type).toLowerCase().trim() === type.toLowerCase().trim()
    );

    // 2. Se non esiste il record per quell'anno/tipo
    if (!q) return 'bg-white/50 text-slate-400 border-white/20';

    // 3. VERDE: Se esiste il file PDF (colonna corretta: esiti_pdf)
    if (q.esiti_pdf && String(q.esiti_pdf).trim() !== '') {
      return 'bg-emerald-500 text-white border-emerald-400 shadow-sm';
    }

    // 4. GIALLO: Se non c'è il PDF ma è stata inserita una data di inizio
    if (q.start_date && String(q.start_date).trim() !== '') {
      return 'bg-amber-400 text-white border-amber-300 shadow-sm';
    }

    // 5. ROSSO: Record creato ma senza dati utili
    return 'bg-rose-500 text-white border-rose-400';
  };

  // CONFIGURAZIONE DINAMICA FONT
  const isLarge = gridCols === 'lg:grid-cols-4';
  const isMedium = gridCols === 'lg:grid-cols-6';
  
  const fontSize = isLarge ? 'text-[22px]' : isMedium ? 'text-[16px]' : 'text-[14px]';
  const iconSize = isLarge ? 'w-14 h-14' : 'w-8 h-8';
  const iconInner = isLarge ? 28 : 14;

  return (
    <div 
      style={{ 
        backgroundColor: `${f.udo_color}66`, 
        borderColor: `${f.udo_color}80` 
      }} 
      className={`relative p-4 rounded-2xl border-2 group hover:shadow-xl transition-all flex flex-col justify-between ${isLarge ? 'min-h-[200px]' : 'min-h-[110px]'}`}
    >
      {/* Tasto Edit */}
      <button 
        onClick={onEdit} 
        className="absolute top-2 right-2 p-1.5 text-slate-600 hover:text-black opacity-0 group-hover:opacity-100 transition-opacity z-10"
      >
        <Pencil size={isLarge ? 22 : 14} />
      </button>
      
      {/* Header Card */}
      <div>
        <h3 className={`font-black uppercase text-slate-900 pr-8 leading-tight mb-1 truncate ${fontSize}`}>
          {f.name}
        </h3>
        <p className={`font-black text-slate-800/60 uppercase tracking-wider ${isLarge ? 'text-[14px]' : 'text-[10px]'}`}>
          {f.bed_count || 0} Posti Letto
        </p>
      </div>
      
      {/* Footer Card */}
      <div className="flex justify-between items-end mt-4 pt-4 border-t border-black/5">
        <div className="flex-1 min-w-0">
          {isLarge && (
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest leading-none mb-1">
                Referente
              </span>
              <div className="flex items-center gap-1.5 text-slate-800">
                <User size={14} className="shrink-0 opacity-50" />
                <span className="text-[15px] font-bold truncate pr-2">
                  {f.referent || '—'}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 shrink-0">
          <button 
            title="Questionario Clienti"
            onClick={() => onQClick('client')} 
            className={`rounded-full flex items-center justify-center border-2 shadow-md transition-all hover:scale-110 active:scale-90 ${iconSize} ${getStatusColor('client')}`}
          >
            <Users size={iconInner}/>
          </button>
          <button 
            title="Questionario Operatori"
            onClick={() => onQClick('operator')} 
            className={`rounded-full flex items-center justify-center border-2 shadow-md transition-all hover:scale-110 active:scale-90 ${iconSize} ${getStatusColor('operator')}`}
          >
            <UserCog size={iconInner}/>
          </button>
        </div>
      </div>
    </div>
  );
}