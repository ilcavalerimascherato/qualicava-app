// src/views/NonConformitaPage.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, BarChart2, Search, Edit2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useDashboardData } from '../hooks/useDashboardData';
import { useBadgeCounts } from '../hooks/useBadgeCounts';
import { supabase } from '../supabaseClient';
import AppHeader from '../components/AppHeader';
import NcFormModal from '../components/NcFormModal';

const TABS = [
  { id: 'nc_list',   label: 'Non Conformità',  Icon: AlertTriangle },
  { id: 'nc_stats',  label: 'Statistiche NC',  Icon: BarChart2    },
];

const STATUS_CFG = {
  Aperto:  { label: 'Aperto',  bg: 'bg-red-50',     text: 'text-red-700',     dot: 'bg-red-500'     },
  Pending: { label: 'Pending', bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-400'   },
  Chiuso:  { label: 'Chiuso',  bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
};

const SEV_CFG = {
  Bassa:  'bg-slate-100 text-slate-600',
  Media:  'bg-amber-50 text-amber-700',
  Alta:   'bg-orange-50 text-orange-700',
};

export default function NonConformitaPage() {
  const navigate = useNavigate();
  const { isAdmin, profile, signOut } = useAuth();
  const [year] = useState(new Date().getFullYear());
  const { data } = useDashboardData(year);
  const { facilities, udos } = data;

  const allIds = useMemo(
    () => facilities.filter(f => !f.is_suspended).map(f => f.id),
    [facilities],
  );
  const { totals: badgeTotals } = useBadgeCounts(allIds, year, isAdmin);

  const handleNavigate = (page) => {
    const routes = {
      dashboard:    '/admin',
      saturazione:  '/occupazione',
      haccp:        '/master',
      documenti:    '/documenti',
      nc:           '/non-conformita',
      report:       '/report',
      impostazioni: '/impostazioni',
    };
    navigate(routes[page] ?? '/admin');
  };

  const [activeTab, setActiveTab]             = useState('nc_list');
  const [ncs, setNcs]                         = useState([]);
  const [loadingNc, setLoadingNc]             = useState(true);
  const [ncSearch, setNcSearch]               = useState('');
  const [ncStatus, setNcStatus]               = useState('all');
  const [ncSeverity, setNcSev]                = useState('all');
  const [ncUdo, setNcUdo]                     = useState('all');
  const [hqNoteId, setHqNoteId]               = useState(null);
  const [hqNoteText, setHqNoteText]           = useState('');
  const [savingNote, setSavingNote]           = useState(false);
  const [expandedNc, setExpandedNc]           = useState(null);
  const [ncEditId, setNcEditId]               = useState(null);
  const [ncEditFacility, setNcEditFacility]   = useState(null);

  const reloadNcs = useCallback(() => {
    setLoadingNc(true);
    supabase
      .from('non_conformities')
      .select('*, facilities(name, udo_id, region)')
      .eq('year', year)
      .order('opened_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error) setNcs(data || []);
        setLoadingNc(false);
      });
  }, [year]);

  useEffect(() => {
    reloadNcs();
  }, [reloadNcs]);

  // Conteggio NC aperte/pending — usato per badge tab e header
  const ncOpenCount = useMemo(
    () => ncs.filter(n => n.stato === 'Aperto' || n.stato === 'Pending').length,
    [ncs]
  );

  // ── NC filtrate ───────────────────────────────────────────────
  const filteredNcs = useMemo(() => ncs.filter(nc => {
    const fname   = nc.facilities?.name?.toLowerCase() || '';
    const fudo    = nc.facilities?.udo_id;
    const udoName = udos.find(u => u.id === fudo)?.name || '';
    const titleLc = (nc.titolo || nc.classificazione || '').toLowerCase();
    if (ncSearch   && !fname.includes(ncSearch.toLowerCase()) && !titleLc.includes(ncSearch.toLowerCase())) return false;
    if (ncStatus   !== 'all' && nc.stato   !== ncStatus)   return false;
    if (ncSeverity !== 'all' && nc.gravita !== ncSeverity) return false;
    if (ncUdo      !== 'all' && udoName    !== ncUdo)      return false;
    return true;
  }), [ncs, ncSearch, ncStatus, ncSeverity, ncUdo, udos]);

  // ── Statistiche ───────────────────────────────────────────────
  const stats = useMemo(() => {
    const byStatus = {}, bySeverity = {}, byCategory = {}, byUdo = {};
    ncs.forEach(nc => {
      byStatus[nc.stato]       = (byStatus[nc.stato]       || 0) + 1;
      bySeverity[nc.gravita]   = (bySeverity[nc.gravita]   || 0) + 1;
      byCategory[nc.category]  = (byCategory[nc.category]  || 0) + 1;
      const udoId   = nc.facilities?.udo_id;
      const udoName = udos.find(u => u.id === udoId)?.name || 'N/D';
      byUdo[udoName] = (byUdo[udoName] || 0) + 1;
    });
    return {
      byStatus, bySeverity, byCategory, byUdo,
      aperte:   (byStatus['Aperto'] || 0) + (byStatus['Pending'] || 0),
      risolte:  byStatus['risolta'] || 0,
      totale:   ncs.length,
      critiche: bySeverity['critica'] || 0,
    };
  }, [ncs, udos]);

  // ── Nota HQ ───────────────────────────────────────────────────
  const handleSaveHqNote = async (ncId) => {
    setSavingNote(true);
    const { error } = await supabase
      .from('non_conformities')
      .update({ hq_note: hqNoteText, reviewed_at: new Date().toISOString() })
      .eq('id', ncId);
    if (!error) {
      setNcs(prev => prev.map(n => n.id === ncId ? { ...n, hq_note: hqNoteText } : n));
      setHqNoteId(null);
      setHqNoteText('');
    }
    setSavingNote(false);
  };

  const handleUpdateStatus = async (ncId, newStatus) => {
    const { error } = await supabase
      .from('non_conformities')
      .update({ stato: newStatus, ...(newStatus === 'Chiuso' ? { data_chiusura: new Date().toISOString().split('T')[0] } : {}) })
      .eq('id', ncId);
    if (!error) setNcs(prev => prev.map(n => n.id === ncId ? { ...n, stato: newStatus } : n));
  };

  return (
    <div className="min-h-screen bg-slate-100 pb-10 text-slate-900 font-sans">
      <AppHeader
        activePage="nc"
        badgeCounts={badgeTotals}
        user={profile}
        onSignOut={signOut}
        onNavigate={handleNavigate}
      />

      {/* ── Context bar ── */}
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-slate-100">
        <div>
          <h1 className="text-base font-semibold text-slate-900">Dashboard Qualità</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Gestione qualità e conformità — HQ
            {!loadingNc && ncOpenCount > 0 && (
              <span className="ml-1 text-rose-600 font-medium">· {ncOpenCount} NC aperte/pending</span>
            )}
          </p>
        </div>
      </div>

      {/* Tab nav */}
      <div className="bg-white border-b border-slate-200 px-5 flex gap-2 pt-3">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-t-xl text-xs font-black uppercase tracking-widest transition-all border-b-2 ${
              activeTab === id
                ? 'bg-slate-50 border-rose-500 text-rose-600'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}>
            <Icon size={14} /> {label}
            {id === 'nc_list' && !loadingNc && ncOpenCount > 0 && (
              <span className="min-w-[18px] h-[18px] bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1 leading-none">
                {ncOpenCount > 99 ? '99+' : ncOpenCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Body ── */}
      <main className="px-6 py-6 max-w-6xl mx-auto">

        {/* ══ TAB NON CONFORMITÀ ══ */}
        {activeTab === 'nc_list' && (
          <div className="space-y-5">
            {/* Filtri */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-48">
                <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
                <input type="text" placeholder="Cerca struttura o titolo..." value={ncSearch}
                  onChange={e => setNcSearch(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-sm outline-none focus:border-rose-400" />
              </div>
              <select value={ncStatus}   onChange={e => setNcStatus(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none">
                <option value="all">Tutti gli stati</option>
                {['Aperto','Pending','Chiuso'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={ncSeverity} onChange={e => setNcSev(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none">
                <option value="all">Tutte le severità</option>
                {['Bassa','Media','Alta'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={ncUdo}      onChange={e => setNcUdo(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none">
                <option value="all">Tutte le UDO</option>
                {udos.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
              </select>
              <span className="text-xs font-bold text-slate-400 ml-auto">{filteredNcs.length} NC</span>
            </div>

            {loadingNc ? (
              <div className="text-center py-12 text-slate-400 animate-pulse font-bold">Caricamento...</div>
            ) : filteredNcs.length === 0 ? (
              <div className="text-center py-12 text-slate-400 font-bold">Nessuna non conformità trovata</div>
            ) : (
              <div className="space-y-3">
                {filteredNcs.map(nc => {
                  const sc         = STATUS_CFG[nc.stato] || STATUS_CFG.Aperto;
                  const isExpanded = expandedNc === nc.id;
                  const isNoteOpen = hqNoteId   === nc.id;

                  const cardTitle = [
                    nc.facilities?.name,
                    nc.titolo || nc.classificazione,
                  ].filter(Boolean).join(' · ');

                  return (
                    <div key={nc.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-slate-300 transition-all">

                      {/* Header cliccabile per espandere */}
                      <div
                        className="p-5 cursor-pointer hover:bg-slate-50 transition-colors"
                        onClick={() => setExpandedNc(isExpanded ? null : nc.id)}
                      >
                        <div className="flex justify-between items-start gap-3">
                          <div className="flex-1 min-w-0">
                            {/* Badge riga */}
                            <div className="flex items-center gap-2 flex-wrap mb-2">
                              <span className={`text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5 ${sc.bg} ${sc.text}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                                {sc.label}
                              </span>
                              <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${SEV_CFG[nc.gravita] || 'bg-slate-100 text-slate-600'}`}>
                                {nc.gravita}
                              </span>
                              {nc.classificazione && (
                                <span className="text-xs text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                                  {nc.classificazione}
                                </span>
                              )}
                              <span className="text-xs text-slate-400 ml-auto">
                                {nc.opened_at ? new Date(nc.opened_at).toLocaleDateString('it') : ''}
                              </span>
                            </div>

                            {/* Titolo sempre "Struttura · NC title" */}
                            <h4 className="font-black text-slate-800 text-sm leading-snug mb-2">{cardTitle}</h4>

                            {nc.analisi_dinamica && (
                              <p className="text-sm text-slate-600 leading-relaxed">{nc.analisi_dinamica}</p>
                            )}

                            {/* Nota HQ compatta (solo se presente e pannello nota chiuso) */}
                            {nc.hq_note && !isNoteOpen && (
                              <div className="mt-2 text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-1.5">
                                <span className="font-black">Nota HQ:</span> {nc.hq_note}
                              </div>
                            )}

                            {/* Hint espansione */}
                            <p className="text-[10px] text-slate-400 font-bold mt-2 uppercase tracking-wide">
                              {isExpanded ? '▲ Clicca per chiudere' : '▼ Clicca per dettaglio completo'}
                            </p>
                          </div>

                          {/* Controlli rapidi — stopPropagation per non triggerare expand */}
                          <div className="flex flex-col gap-2 shrink-0">
                            <select
                              value={nc.stato}
                              onClick={e => e.stopPropagation()}
                              onChange={e => { e.stopPropagation(); handleUpdateStatus(nc.id, e.target.value); }}
                              className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 outline-none cursor-pointer"
                            >
                              {['Aperto','Pending','Chiuso'].map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <button
                              onClick={e => { e.stopPropagation(); setHqNoteId(isNoteOpen ? null : nc.id); setHqNoteText(nc.hq_note || ''); }}
                              className="text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-2 py-1.5 rounded-lg transition-colors border border-indigo-200"
                            >
                              {isNoteOpen ? 'Chiudi nota' : nc.hq_note ? '✏ Modifica nota' : '+ Nota HQ'}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Pannello dettaglio completo espanso */}
                      {isExpanded && (
                        <div className="border-t border-slate-100 bg-slate-50 p-5 space-y-2">
                          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Dettaglio completo segnalazione</p>
                          {[
                            ['Data ricezione',       nc.data_ricezione           ? new Date(nc.data_ricezione).toLocaleDateString('it')                   : null],
                            ['Segnalazione da',      nc.segnalazione_da],
                            ['Ambito',               nc.ambito],
                            ['Analisi dinamica',     nc.analisi_dinamica],
                            ['Cause evento',         nc.cause_evento],
                            ['Desc. cause',          nc.descrizione_cause],
                            ['Tipologia esito',      nc.tipologia_esito],
                            ['Correzione immediata', nc.correzione_immediata],
                            ['Azione correttiva',    nc.azione_correttiva],
                            ['AC entro il',          nc.ac_entro_il              ? new Date(nc.ac_entro_il).toLocaleDateString('it')                       : null],
                            ['Responsabile',         nc.responsabile_esecuzione],
                            ['Verifica efficacia',   nc.verifica_efficacia],
                            ['Esito verifica',       nc.esito_verifica],
                            ['Azioni aggiuntive',    nc.azioni_aggiuntive],
                            ['Chiusura da',          nc.verifica_chiusura_da],
                            ['Data chiusura',        nc.data_chiusura            ? new Date(nc.data_chiusura).toLocaleDateString('it')                     : null],
                            ['Riscontro segnalante', nc.data_riscontro_segnalante ? new Date(nc.data_riscontro_segnalante).toLocaleDateString('it')        : null],
                            ['Note',                 nc.note],
                          ].filter(([, v]) => v).map(([label, value]) => (
                            <div key={label} className="grid grid-cols-3 gap-2 py-2 border-b border-slate-100 last:border-0">
                              <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">{label}</span>
                              <span className="col-span-2 text-sm text-slate-700 font-medium whitespace-pre-wrap">{value}</span>
                            </div>
                          ))}
                          <div className="pt-3 flex justify-end">
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                const fac = facilities.find(f => String(f.id) === String(nc.facility_id));
                                if (fac) { setNcEditFacility(fac); setNcEditId(nc.id); }
                              }}
                              className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors border border-indigo-200"
                            >
                              <Edit2 size={12} /> Modifica completa
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Pannello nota HQ */}
                      {isNoteOpen && (
                        <div className="border-t border-indigo-100 bg-indigo-50 p-4">
                          <p className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-2">Nota HQ</p>
                          <textarea rows={3} value={hqNoteText} onChange={e => setHqNoteText(e.target.value)}
                            className="w-full bg-white border border-indigo-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400 resize-none mb-3"
                            placeholder="Inserisci una nota per la struttura..." />
                          <div className="flex justify-end gap-2">
                            <button onClick={() => setHqNoteId(null)} className="text-xs font-bold text-slate-500 px-3 py-1.5 hover:bg-slate-100 rounded-lg">Annulla</button>
                            <button onClick={() => handleSaveHqNote(nc.id)} disabled={savingNote}
                              className="text-xs font-bold bg-indigo-600 text-white px-4 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors">
                              {savingNote ? 'Salvo...' : 'Salva nota'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══ TAB STATISTICHE ══ */}
        {activeTab === 'nc_stats' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Totale NC',  value: stats.totale,   color: 'text-slate-700',   bg: 'bg-white'      },
                { label: 'Aperte',     value: stats.aperte,   color: 'text-red-600',     bg: 'bg-red-50'     },
                { label: 'Risolte',    value: stats.risolte,  color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { label: 'Critiche',   value: stats.critiche, color: 'text-orange-600',  bg: 'bg-orange-50'  },
              ].map(s => (
                <div key={s.label} className={`${s.bg} rounded-2xl border border-slate-200 p-5 text-center`}>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{s.label}</p>
                  <p className={`text-4xl font-black ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <StatCard title="Per stato"                data={stats.byStatus}   cfg={Object.fromEntries(Object.entries(STATUS_CFG).map(([k,v]) => [k, { label: v.label, color: v.dot }]))} />
              <StatCard title="Per severità"             data={stats.bySeverity} cfg={{ bassa: { label:'Bassa', color:'bg-slate-400' }, media: { label:'Media', color:'bg-amber-400' }, alta: { label:'Alta', color:'bg-orange-500' }, critica: { label:'Critica', color:'bg-red-600' } }} />
              <StatCard title="Per categoria"            data={stats.byCategory} />
              <StatCard title="Per tipo struttura (UDO)" data={stats.byUdo}      />
            </div>
          </div>
        )}

      </main>

      {ncEditId && ncEditFacility && (
        <NcFormModal
          isOpen={true}
          facility={ncEditFacility}
          year={year}
          profile={profile}
          ncId={ncEditId}
          onClose={() => { setNcEditId(null); setNcEditFacility(null); }}
          onSaved={() => { setNcEditId(null); setNcEditFacility(null); reloadNcs(); }}
        />
      )}
    </div>
  );
}

// ── StatCard ─────────────────────────────────────────────────
function StatCard({ title, data, cfg = {} }) {
  const total   = Object.values(data).reduce((s, v) => s + v, 0) || 1;
  const entries = Object.entries(data).sort(([,a],[,b]) => b - a);
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <h4 className="font-black text-slate-700 mb-4 text-sm uppercase tracking-widest">{title}</h4>
      <div className="space-y-2">
        {entries.map(([key, count]) => {
          const pct   = Math.round((count / total) * 100);
          const label = cfg[key]?.label || key;
          const color = cfg[key]?.color || 'bg-indigo-400';
          return (
            <div key={key}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-slate-600 capitalize">{label}</span>
                <span className="text-xs font-black text-slate-700">{count} <span className="text-slate-400 font-medium">({pct}%)</span></span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%`, transition: 'width 0.5s ease' }} />
              </div>
            </div>
          );
        })}
        {entries.length === 0 && <p className="text-xs text-slate-400 text-center py-4">Nessun dato</p>}
      </div>
    </div>
  );
}
