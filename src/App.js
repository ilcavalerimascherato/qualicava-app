import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  LayoutGrid, 
  List, 
  User, 
  Settings, 
  LogOut, 
  ChevronRight, 
  CheckCircle2, 
  AlertCircle, 
  Clock 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from './supabaseClient';
import Login from './Login';

// --- COMPONENTE MODALE QUESTIONARIO ---
function QuestionnaireModal({ isOpen, onClose, info, year, questionnaires, onSave }) {
  const q = info ? questionnaires.find(q => q.facility_id === info.facility.id && q.type === info.type) : null;
  const [startDate, setStartDate] = useState('');

  useEffect(() => {
    if (isOpen && q) setStartDate(q.start_date || '');
    else if (!isOpen) setStartDate('');
  }, [isOpen, q]);

  if (!isOpen || !info) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden text-slate-900">
        <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-lg font-bold">Monitoraggio {info.type === 'client' ? 'Clienti' : 'Operatori'}</h2>
            <p className="text-xs text-slate-500 font-medium">{info.facility.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
        </div>
        <form className="p-6 space-y-4" onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          onSave({
            facility_id: info.facility.id,
            year: year,
            type: info.type,
            start_date: fd.get('sd') || null,
            end_date: fd.get('ed') || null,
            report_url: fd.get('url') || null
          });
        }}>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Data Inizio Somministrazione</label>
            <input name="sd" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className={!startDate ? 'opacity-50 pointer-events-none' : ''}>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Data Chiusura (Fine)</label>
            <input name="ed" type="date" defaultValue={q?.end_date || ''} className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className={!startDate ? 'opacity-50 pointer-events-none' : ''}>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Link Report Finale (PDF/Cloud)</label>
            <input name="url" type="url" placeholder="https://..." defaultValue={q?.report_url || ''} className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="pt-2 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg font-bold text-slate-600">Annulla</button>
            <button type="submit" className="flex-1 bg-indigo-600 text-white py-2 rounded-lg font-bold hover:bg-indigo-700">Salva Stato</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// --- APP PRINCIPALE ---
export default function App() {
  const [session, setSession] = useState(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [facilities, setFacilities] = useState([]);
  const [udos, setUdos] = useState([]);
  const [questionnaires, setQuestionnaires] = useState([]);
  const [udoFilter, setUdoFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  
  const [isQuestionnaireModalOpen, setIsQuestionnaireModalOpen] = useState(false);
  const [selectedQuestionnaireInfo, setSelectedQuestionnaireInfo] = useState(null);

  // GESTIONE SESSIONE
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  // CARICAMENTO DATI
  const fetchData = async () => {
    const { data: u } = await supabase.from('udos').select('*').order('name');
    const { data: f } = await supabase.from('facilities').select('*, udos(name, color)');
    const { data: q } = await supabase.from('questionnaires').select('*').eq('year', year);
    setUdos(u || []);
    setQuestionnaires(q || []);
    setFacilities(f?.map(i => ({ ...i, udo_name: i.udos?.name, udo_color: i.udos?.color })) || []);
  };

  useEffect(() => { if (session) fetchData(); }, [session, year]);

  // LOGICA STATUS
  const getStatus = (fid, type) => {
    const q = questionnaires.find(x => x.facility_id === fid && x.type === type);
    if (!q) return 'red';
    return q.report_url ? 'green' : (q.start_date ? 'yellow' : 'red');
  };

  const filteredFacilities = useMemo(() => {
    return facilities.filter(f => {
      const matchUdo = udoFilter === 'all' || f.udo_id === udoFilter;
      const statusC = getStatus(f.id, 'client');
      const statusO = getStatus(f.id, 'operator');
      const matchStatus = statusFilter === 'all' || statusC === statusFilter || statusO === statusFilter;
      return matchUdo && matchStatus;
    });
  }, [facilities, udoFilter, statusFilter, questionnaires]);

  if (!session) return <Login />;

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20 text-slate-900">
      <header className="bg-white border-b px-6 py-3 sticky top-0 z-30 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-1.5 rounded-lg text-white"><Activity size={20} /></div>
          <h1 className="text-xl font-black text-indigo-950 uppercase tracking-tight">QualiCARE <span className="text-xs font-normal text-slate-400 capitalize">Console Admin</span></h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-100 px-3 py-1 rounded-full border">
            <Calendar size={14} className="text-slate-500" />
            <select value={year} onChange={(e) => setYear(parseInt(e.target.value))} className="bg-transparent text-xs font-bold outline-none cursor-pointer">
              {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <button onClick={() => supabase.auth.signOut()} className="text-rose-500 p-2 hover:bg-rose-50 rounded-full transition-colors"><LogOut size={18} /></button>
        </div>
      </header>

      {/* KPI STRATEGICI */}
      <div className="px-6 py-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Target Clienti</p>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-black text-emerald-600">
              {facilities.length > 0 ? Math.round((questionnaires.filter(q => q.type === 'client' && q.report_url).length / facilities.length) * 100) : 0}%
            </span>
            <span className="text-[10px] text-slate-400 mb-1 font-bold italic">REPORT OK</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Target Operatori</p>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-black text-indigo-600">
              {facilities.length > 0 ? Math.round((questionnaires.filter(q => q.type === 'operator' && q.report_url).length / facilities.length) * 100) : 0}%
            </span>
            <span className="text-[10px] text-slate-400 mb-1 font-bold italic">REPORT OK</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border-l-4 border-l-amber-400 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">In Corso</p>
          <p className="text-2xl font-black text-amber-500">{questionnaires.filter(q => q.start_date && !q.report_url).length}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-right">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Totale Sedi</p>
          <p className="text-2xl font-black text-slate-800">{facilities.length}</p>
        </div>
      </div>

      {/* FILTRI */}
      <div className="px-6 mb-6 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex gap-2 p-1 bg-white rounded-xl border shadow-sm">
          <select value={udoFilter} onChange={(e) => setUdoFilter(e.target.value === 'all' ? 'all' : parseInt(e.target.value))} className="bg-transparent px-4 py-2 text-xs font-bold outline-none border-r border-slate-100 cursor-pointer">
            <option value="all">Tutte le UDO</option>
            {udos.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-transparent px-4 py-2 text-xs font-bold outline-none cursor-pointer">
            <option value="all">Tutti gli Stati</option>
            <option value="green">Completati</option>
            <option value="yellow">In Corso</option>
            <option value="red">Da Iniziare</option>
          </select>
        </div>
        <div className="flex items-center gap-4 text-[9px] font-bold text-slate-400 uppercase bg-white px-4 py-2 rounded-lg border shadow-sm">
           <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500"></span> Da fare</span>
           <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400"></span> In corso</span>
           <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Chiuso</span>
        </div>
      </div>

      {/* GRIGLIA */}
      <main className="px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
          <AnimatePresence>
            {filteredFacilities.map((f) => (
              <motion.div layout key={f.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ backgroundColor: f.udo_color || '#ffffff' }} 
                className="p-3 rounded-xl border border-black/5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between min-h-[135px] group">
                
                <div>
                  <h3 className="font-bold text-[10px] leading-tight truncate mb-0.5 uppercase tracking-tighter" title={f.name}>{f.name}</h3>
                  <div className="flex justify-between items-center">
                    <p className="text-[9px] font-black text-slate-500/60 uppercase">{f.udo_name}</p>
                    <span className="text-[8px] font-bold text-slate-400">{f.bed_count || 0} PL</span>
                  </div>
                </div>

                <div className="flex gap-1.5 justify-end mt-4 pt-2 border-t border-black/5">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[7px] font-bold text-slate-400">CLIENTI</span>
                    <button onClick={() => { setSelectedQuestionnaireInfo({ facility: f, type: 'client' }); setIsQuestionnaireModalOpen(true); }}
                      className={`w-8 h-8 rounded-full flex items-center justify-center border shadow-sm transition-transform hover:scale-110 ${
                        getStatus(f.id, 'client') === 'green' ? 'bg-emerald-500 text-white border-emerald-600' : 
                        getStatus(f.id, 'client') === 'yellow' ? 'bg-amber-400 text-white border-amber-500' : 'bg-white text-rose-500 border-rose-100'
                      }`}><Users size={14} /></button>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[7px] font-bold text-slate-400">STAFF</span>
                    <button onClick={() => { setSelectedQuestionnaireInfo({ facility: f, type: 'operator' }); setIsQuestionnaireModalOpen(true); }}
                      className={`w-8 h-8 rounded-full flex items-center justify-center border shadow-sm transition-transform hover:scale-110 ${
                        getStatus(f.id, 'operator') === 'green' ? 'bg-emerald-500 text-white border-emerald-600' : 
                        getStatus(f.id, 'operator') === 'yellow' ? 'bg-amber-400 text-white border-amber-500' : 'bg-white text-indigo-500 border-indigo-100'
                      }`}><UserCog size={14} /></button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </main>

      {/* MODALE QUESTIONARIO */}
      <QuestionnaireModal 
        isOpen={isQuestionnaireModalOpen} 
        onClose={() => setIsQuestionnaireModalOpen(false)} 
        info={selectedQuestionnaireInfo} 
        year={year} questionnaires={questionnaires} 
        onSave={async (data) => {
          await supabase.from('questionnaires').upsert(data, { onConflict: 'facility_id,year,type' });
          setIsQuestionnaireModalOpen(false);
          fetchData();
        }} 
      />
    </div>
  );
}