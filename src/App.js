import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ShieldCheck, Users, UserCog, Calendar, Settings, LogOut, Loader2, Search, Grid2X2, Grid3X3, LayoutGrid } from 'lucide-react';
import { supabase } from './supabaseClient';
import { udoService, facilityService } from './services/supabaseService';
import Login from './Login';
import UdoManagerModal from './components/UdoManagerModal';
import FacilityModal from './components/FacilityModal';
import QuestionnaireModal from './components/QuestionnaireModal';
import FacilityCard from './components/FacilityCard';

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState({ facilities: [], udos: [], questionnaires: [] });
  const [modals, setModals] = useState({ udo: false, facility: false, q: false });
  const [selected, setSelected] = useState({ facility: null, q: null });
  const [gridCols, setGridCols] = useState('lg:grid-cols-8');
  const [filterUdo, setFilterUdo] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); setLoading(false); });
    supabase.auth.onAuthStateChange((_event, session) => { setSession(session); setLoading(false); });
  }, []);

  const fetchAll = useCallback(async () => {
    if (!session) return;
    try {
      const [u, f, qRes] = await Promise.all([
        udoService.getAll(),
        facilityService.getAll(),
        supabase.from('questionnaires').select('*').eq('year', year)
      ]);
      setData({ udos: u || [], facilities: f || [], questionnaires: qRes.data || [] });
    } catch (err) { console.error("Fetch error:", err); }
  }, [session, year]);

  useEffect(() => { if (session) fetchAll(); }, [session, fetchAll]);

const processedData = useMemo(() => {
  const list = data.facilities.map(f => {
    const fId = String(f.id);
    const qs = data.questionnaires.filter(q => String(q.facility_id) === fId);

    // Identificazione record (Agnostica)
    const cQ = qs.find(q => q.type?.toLowerCase().trim() === 'client');
    const oQ = qs.find(q => q.type?.toLowerCase().trim() === 'operator');

    // Booleani di completamento (Quelli che useremo per le percentuali)
    // Se c'è un file PDF nella colonna esiti_pdf, il lavoro è fatto.
    const isClientDone = !!(cQ?.esiti_pdf && String(cQ.esiti_pdf).trim() !== '');
    const isOpDone = !!(oQ?.esiti_pdf && String(oQ.esiti_pdf).trim() !== '');
    
    // Logica Colori Struttura
    const isGreen = isClientDone && isOpDone;
    const isYellow = !isGreen && (
      isClientDone || isOpDone || 
      (cQ?.start_date && cQ.start_date !== '') || 
      (oQ?.start_date && oQ.start_date !== '')
    );
    const isRed = !isGreen && !isYellow;

    return { ...f, isGreen, isYellow, isRed, isClientDone, isOpDone };
  });

  const total = list.length || 1; // Evitiamo divisione per zero
  
  // CALCOLO PERCENTUALI: Contiamo quante strutture hanno isClientDone = true
  const countClient = list.filter(x => x.isClientDone).length;
  const countOp = list.filter(x => x.isOpDone).length;

  return {
    list,
    percClient: Math.round((countClient / total) * 100),
    percOp: Math.round((countOp / total) * 100),
    counts: {
      all: list.length,
      todo: list.filter(x => x.isRed).length,
      progress: list.filter(x => x.isYellow).length,
      completed: list.filter(x => x.isGreen).length
    }
  };
}, [data]);

  const filteredFacilities = useMemo(() => {
    return processedData.list.filter(f => {
      const matchSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchUdo = filterUdo === 'all' || String(f.udo_id) === String(filterUdo);
      if (!matchSearch || !matchUdo) return false;
      if (filterStatus === 'completed') return f.isGreen;
      if (filterStatus === 'progress') return f.isYellow;
      if (filterStatus === 'todo') return f.isRed;
      return true;
    });
  }, [processedData, filterUdo, filterStatus, searchQuery]);

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50 font-black text-slate-400 uppercase tracking-[0.2em]">Caricamento...</div>;
  if (!session) return <Login />;

  return (
    <div className="min-h-screen bg-slate-100 pb-10 text-slate-900 font-sans">
      <header className="bg-white border-b px-6 py-4 sticky top-0 z-30 shadow-md">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg"><ShieldCheck size={24} /></div>
            <h1 className="text-xl font-black uppercase tracking-tighter italic">QualiCARE <span className="text-indigo-600 italic">SECURE</span></h1>
          </div>

          <div className="flex items-center gap-10 bg-slate-50 px-8 py-3 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-3 font-black text-[16px]">
              <Users size={20} className="text-emerald-600" />
              <span className="text-slate-500 uppercase">Clienti: <span className="text-slate-900">{processedData.percClient}%</span></span>
            </div>
            <div className="flex items-center gap-3 border-l-2 pl-10 font-black text-[16px]">
              <UserCog size={20} className="text-indigo-600" />
              <span className="text-slate-500 uppercase">Staff: <span className="text-slate-900">{processedData.percOp}%</span></span>
            </div>
          </div>

          <div className="flex gap-4">
            <button onClick={() => { setSelected({facility: null}); setModals({...modals, facility: true}); }} className="bg-indigo-600 text-white px-6 py-3 rounded-xl text-xs font-black uppercase shadow-md hover:bg-indigo-700">Nuova Struttura</button>
            <div className="flex items-center gap-2 bg-slate-50 px-4 py-3 rounded-xl border border-slate-200">
              <Calendar size={18} />
              <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="bg-transparent font-black outline-none italic">{[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}</select>
            </div>
            <button onClick={() => setModals({...modals, udo: true})} className="p-3 text-slate-400 hover:text-indigo-600 transition-colors"><Settings size={26}/></button>
            <button onClick={() => supabase.auth.signOut()} className="text-rose-500 p-3 hover:bg-rose-50 rounded-2xl transition-colors"><LogOut size={26}/></button>
          </div>
        </div>

        <div className="flex justify-between items-center pt-4 border-t border-slate-100">
          <div className="flex items-center gap-6 grow max-w-6xl">
            <div className="relative flex-1">
              <Search size={22} className="absolute left-4 top-3.5 text-slate-400" />
              <input type="text" placeholder="Cerca struttura..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full text-[16px] font-bold bg-slate-50 pl-14 pr-4 py-4 rounded-2xl border-2 border-slate-100 outline-none focus:border-indigo-500 transition-all shadow-inner" />
            </div>
            <select value={filterUdo} onChange={e => setFilterUdo(e.target.value)} className="text-[16px] font-black bg-slate-50 px-6 py-4 rounded-2xl border-2 border-slate-100 uppercase outline-none">
              <option value="all">Tutte le UDO</option>
              {data.udos.map(u => <option key={u.id} value={String(u.id)}>{u.name}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="text-[16px] font-black bg-slate-50 px-6 py-4 rounded-2xl border-2 border-slate-100 uppercase outline-none">
              <option value="all">Tutti ({processedData.counts.all})</option>
              <option value="todo">🔴 Da Iniziare ({processedData.counts.todo})</option>
              <option value="progress">🟡 In Corso ({processedData.counts.progress})</option>
              <option value="completed">🟢 Completati ({processedData.counts.completed})</option>
            </select>
          </div>
          <div className="flex items-center gap-2 bg-slate-200 p-2 rounded-2xl ml-8">
            <button onClick={() => setGridCols('lg:grid-cols-4')} className={`p-3 rounded-xl transition-all ${gridCols === 'lg:grid-cols-4' ? 'bg-white shadow-xl text-indigo-600' : 'text-slate-500'}`}><Grid2X2 size={24}/></button>
            <button onClick={() => setGridCols('lg:grid-cols-6')} className={`p-3 rounded-xl transition-all ${gridCols === 'lg:grid-cols-6' ? 'bg-white shadow-xl text-indigo-600' : 'text-slate-500'}`}><Grid3X3 size={24}/></button>
            <button onClick={() => setGridCols('lg:grid-cols-8')} className={`p-3 rounded-xl transition-all ${gridCols === 'lg:grid-cols-8' ? 'bg-white shadow-xl text-indigo-600' : 'text-slate-500'}`}><LayoutGrid size={24}/></button>
          </div>
        </div>
      </header>

      <main className="px-10 py-12">
        <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 ${gridCols} gap-10`}>
          {filteredFacilities.map(f => (
            <FacilityCard key={f.id} f={f} qs={data.questionnaires} gridCols={gridCols} onEdit={() => { setSelected({facility: f}); setModals({...modals, facility: true}); }} onQClick={(type) => { setSelected({q: {facility: f, type}}); setModals({...modals, q: true}); }} />
          ))}
        </div>
      </main>

      <UdoManagerModal isOpen={modals.udo} onClose={() => setModals({...modals, udo: false})} udos={data.udos} onSave={async (d) => { await udoService.save(d); fetchAll(); }} onDelete={async (id) => { if(window.confirm("Eliminare?")) { await udoService.delete(id); fetchAll(); }}} />
      <FacilityModal isOpen={modals.facility} onClose={() => setModals({...modals, facility: false})} udos={data.udos} facility={selected.facility} onSave={async (d) => { await facilityService.save(d); setModals({...modals, facility: false}); fetchAll(); }} onDelete={async (id) => { if(window.confirm("Eliminare?")) { await facilityService.delete(id); setModals({...modals, facility: false}); fetchAll(); }}} />
      <QuestionnaireModal 
        isOpen={modals.q} 
        onClose={() => setModals({...modals, q: false})} 
        info={selected.q} 
        year={year} 
        questionnaires={data.questionnaires} 
        onSave={async (p) => { 
          try { 
            const { error } = await supabase.from('questionnaires').upsert({
              facility_id: p.facility_id,
              year: p.year,
              type: p.type,
              start_date: p.start_date || null,
              end_date: p.end_date || null,
              esiti_pdf: p.esiti_pdf || null
            }, { onConflict: 'facility_id, year, type' }); 
            if (error) throw error; 
            await fetchAll(); 
            setModals(m => ({...m, q: false}));
          } catch (err) { alert("Errore DB: " + err.message); } 
        }} 
      />
    </div>
  );
}