// src/components/QualityDashboardModal.jsx
// Dashboard Qualità HQ — solo admin/superadmin
// Tab: Mailing List · Non Conformità · Statistiche NC · Export
import React, { useState, useEffect, useMemo } from 'react';
import { X, Mail, AlertTriangle, BarChart2, Download, CheckCircle2, Search, Bell, Send, AlertCircle, Users, Edit2, Plus, Copy } from 'lucide-react';
import { supabase } from '../supabaseClient';

const TABS = [
  { id: 'nc_list',   label: 'Non Conformità',  Icon: AlertTriangle },
  { id: 'solleciti', label: 'Solleciti',        Icon: Bell         },
  { id: 'nc_stats',  label: 'Statistiche NC',  Icon: BarChart2    },
  { id: 'mailing',   label: 'Mailing List',    Icon: Mail         },
  { id: 'utenti',    label: 'Utenti',           Icon: Users        },
];

const ROLE_FIELDS = [
  { role: 'Direttori',        nameField: 'director',            emailField: 'email_direzione'           },
  { role: 'Dir. Sanitari',    nameField: 'director_sanitario',  emailField: 'email_sanitario'           },
  { role: 'Ref. Struttura',   nameField: 'referente_struttura', emailField: 'email_referente_struttura' },
  { role: 'Ref. Qualità',     nameField: 'referent',            emailField: 'email_qualita'             },
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

export default function QualityDashboardModal({ isOpen, onClose, facilities, udos, kpiRecords = [], surveys = [], year, isSuperAdmin = false }) {
  const [activeTab, setActiveTab] = useState('nc_list');
  const [ncs, setNcs]             = useState([]);
  const [loadingNc, setLoadingNc] = useState(true);
  const [ncSearch, setNcSearch]   = useState('');
  const [ncStatus, setNcStatus]   = useState('all');
  const [ncSeverity, setNcSev]    = useState('all');
  const [ncUdo, setNcUdo]         = useState('all');
  const [selectedMailRole, setSelectedMailRole] = useState('Direttori');
  const [hqNoteId, setHqNoteId]   = useState(null);
  const [hqNoteText, setHqNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [expandedNc, setExpandedNc] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
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
  }, [isOpen, year]);

  // ── Mailing list ─────────────────────────────────────────────
  const currentRole = ROLE_FIELDS.find(r => r.role === selectedMailRole);
  const mailingList = facilities
    .filter(f => !f.is_suspended && f[currentRole.emailField])
    .map(f => ({
      name:     f.name,
      contact:  f[currentRole.nameField] || '—',
      email:    f[currentRole.emailField],
      udo:      udos.find(u => u.id === f.udo_id)?.name || '—',
    }))
    .sort((a, b) => a.udo.localeCompare(b.udo) || a.name.localeCompare(b.name));

  const missingEmail = facilities.filter(f => !f.is_suspended && !f[currentRole.emailField]);

  const handleExportMailing = () => {
    const rows = [
      ['Struttura', 'UDO', 'Nome', 'Email'],
      ...mailingList.map(r => [r.name, r.udo, r.contact, r.email]),
    ];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `mailing_${selectedMailRole.replace(/\s/g,'_')}_${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleMailtoAll = () => {
    const emails = mailingList.map(r => r.email).join(';');
    window.location.href = `mailto:?bcc=${emails}`;
  };

  // ── NC filtrate ───────────────────────────────────────────────
  const filteredNcs = useMemo(() => {
    return ncs.filter(nc => {
      const fname = nc.facilities?.name?.toLowerCase() || '';
      const fudo  = nc.facilities?.udo_id;
      const udoName = udos.find(u => u.id === fudo)?.name || '';
      if (ncSearch && !fname.includes(ncSearch.toLowerCase()) && !nc.title?.toLowerCase().includes(ncSearch.toLowerCase())) return false;
      if (ncStatus !== 'all' && nc.stato !== ncStatus) return false;
      if (ncSeverity !== 'all' && nc.gravita !== ncSeverity) return false;
      if (ncUdo !== 'all' && udoName !== ncUdo) return false;
      return true;
    });
  }, [ncs, ncSearch, ncStatus, ncSeverity, ncUdo, udos]);

  // ── Statistiche ───────────────────────────────────────────────
  const stats = useMemo(() => {
    const byStatus   = {};
    const bySeverity = {};
    const byCategory = {};
    const byUdo      = {};

    ncs.forEach(nc => {
      byStatus[nc.stato]     = (byStatus[nc.stato]     || 0) + 1;
      bySeverity[nc.gravita] = (bySeverity[nc.gravita] || 0) + 1;
      byCategory[nc.category] = (byCategory[nc.category] || 0) + 1;
      const udoId   = nc.facilities?.udo_id;
      const udoName = udos.find(u => u.id === udoId)?.name || 'N/D';
      byUdo[udoName] = (byUdo[udoName] || 0) + 1;
    });

    const aperte   = (byStatus['aperta'] || 0) + (byStatus['in_lavorazione'] || 0);
    const risolte  = byStatus['risolta'] || 0;
    const totale   = ncs.length;
    const critiche = bySeverity['critica'] || 0;

    return { byStatus, bySeverity, byCategory, byUdo, aperte, risolte, totale, critiche };
  }, [ncs, udos]);

  // ── Salva nota HQ su NC ───────────────────────────────────────
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
    if (!error) {
      setNcs(prev => prev.map(n => n.id === ncId ? { ...n, stato: newStatus } : n));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl overflow-hidden font-sans">

        {/* Header */}
        <div className="bg-slate-950 px-8 py-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-rose-600 rounded-lg text-white">
              <CheckCircle2 size={22} />
            </div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-wider">Dashboard Qualità</h2>
              <p className="text-xs text-rose-400 font-bold uppercase tracking-widest">Gestione qualità e conformità — HQ</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-full transition-colors">
            <X size={26} />
          </button>
        </div>

        {/* Tab nav */}
        <div className="bg-slate-50 border-b border-slate-200 px-8 flex gap-2 pt-3 shrink-0">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-t-xl text-xs font-black uppercase tracking-widest transition-all border-b-2 ${
                activeTab === id
                  ? 'bg-white border-rose-500 text-rose-600 shadow-sm'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {/* Contenuto */}
        <div className="flex-1 overflow-y-auto bg-white p-8 min-h-0">

          {/* ── TAB UTENTI ──────────────────────────────────────── */}
          {activeTab === 'utenti' && (
            <UtentiTab facilities={facilities} isSuperAdmin={isSuperAdmin} />
          )}

          {/* ── TAB MAILING LIST ─────────────────────────────── */}
          {activeTab === 'mailing' && (
            <div className="space-y-6">
              {/* Selettore ruolo */}
              <div className="flex items-center gap-3 flex-wrap">
                {ROLE_FIELDS.map(r => (
                  <button
                    key={r.role}
                    onClick={() => setSelectedMailRole(r.role)}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                      selectedMailRole === r.role
                        ? 'bg-rose-600 text-white shadow'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {r.role}
                  </button>
                ))}
                <div className="ml-auto flex gap-2">
                  <button
                    onClick={handleMailtoAll}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-black hover:bg-indigo-700 transition-colors"
                  >
                    <Mail size={13} /> Scrivi a tutti
                  </button>
                  <button
                    onClick={handleExportMailing}
                    className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-black hover:bg-slate-700 transition-colors"
                  >
                    <Download size={13} /> Export CSV
                  </button>
                </div>
              </div>

              {/* Contatore */}
              <div className="flex items-center gap-4">
                <span className="text-sm font-bold text-slate-600">
                  <span className="text-2xl font-black text-rose-600">{mailingList.length}</span> email presenti
                </span>
                {missingEmail.length > 0 && (
                  <span className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
                    ⚠ {missingEmail.length} strutture senza email {selectedMailRole}
                  </span>
                )}
              </div>

              {/* Tabella */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {['Struttura', 'UDO', 'Nome', 'Email'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {mailingList.map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-bold text-slate-800">{r.name}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs font-bold uppercase">{r.udo}</td>
                        <td className="px-4 py-3 text-slate-600">{r.contact}</td>
                        <td className="px-4 py-3">
                          <a href={`mailto:${r.email}`} className="text-indigo-600 hover:underline font-medium">{r.email}</a>
                        </td>
                      </tr>
                    ))}
                    {mailingList.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-slate-400 font-bold">
                          Nessuna email presente per questa categoria
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Strutture senza email */}
              {missingEmail.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                  <p className="text-xs font-black text-amber-700 uppercase tracking-widest mb-2">
                    Strutture senza email {selectedMailRole}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {missingEmail.map(f => (
                      <span key={f.id} className="text-xs bg-white border border-amber-200 text-amber-700 px-2.5 py-1 rounded-lg font-medium">
                        {f.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── TAB NON CONFORMITÀ ───────────────────────────── */}
          {activeTab === 'nc_list' && (
            <div className="space-y-5">
              {/* Filtri */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-48">
                  <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cerca struttura o titolo..."
                    value={ncSearch}
                    onChange={e => setNcSearch(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-sm outline-none focus:border-rose-400"
                  />
                </div>
                <select value={ncStatus} onChange={e => setNcStatus(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none">
                  <option value="all">Tutti gli stati</option>
                  <option value="Aperto">Aperto</option>
                  <option value="Pending">Pending</option>
                  <option value="Chiuso">Chiuso</option>
                </select>
                <select value={ncSeverity} onChange={e => setNcSev(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none">
                  <option value="all">Tutte le severità</option>
                  {['Bassa','Media','Alta'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={ncUdo} onChange={e => setNcUdo(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none">
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
                    const sc  = STATUS_CFG[nc.stato] || STATUS_CFG.aperta;
                    const isExpanded = hqNoteId === nc.id;
                    return (
                      <div key={nc.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                        {/* Header card — cliccabile per espandere */}
                        <div
                          className="p-5 cursor-pointer hover:bg-slate-50 transition-colors"
                          onClick={() => setExpandedNc(expandedNc === nc.id ? null : nc.id)}
                        >
                          <div className="flex justify-between items-start gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap mb-2">
                                <span className={`text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5 ${sc.bg} ${sc.text}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                                  {sc.label}
                                </span>
                                <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${SEV_CFG[nc.gravita] || 'bg-slate-100 text-slate-600'}`}>{nc.gravita}</span>
                                <span className="text-xs text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">{nc.classificazione}</span>
                              </div>
                              <h4 className="font-black text-slate-800 mb-1">{nc.title || nc.classificazione}</h4>
                              <p className="text-xs text-slate-500 font-bold">
                                {nc.facilities?.name || '—'} · {new Date(nc.opened_at).toLocaleDateString('it')}
                              </p>
                              {nc.description && <p className="text-sm text-slate-500 mt-2 line-clamp-2">{nc.description}</p>}
                            </div>
                            <div className="flex flex-col gap-2 shrink-0">
                              {/* Cambio stato rapido */}
                              <select
                                value={nc.stato}
                                onChange={e => handleUpdateStatus(nc.id, e.target.value)}
                                className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 outline-none cursor-pointer"
                              >
                                {['Aperto','Pending','Chiuso'].map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                              <button
                                onClick={() => { setHqNoteId(isExpanded ? null : nc.id); setHqNoteText(nc.hq_note || ''); }}
                                className="text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-2 py-1.5 rounded-lg transition-colors border border-indigo-200"
                              >
                                {isExpanded ? 'Chiudi nota' : nc.hq_note ? '✏ Modifica nota' : '+ Nota HQ'}
                              </button>
                            </div>
                          </div>
                          {nc.hq_note && !isExpanded && (
                            <div className="mt-3 pt-3 border-t border-slate-100">
                              <p className="text-xs font-black text-indigo-600 mb-1">Nota HQ</p>
                              <p className="text-xs text-slate-600">{nc.hq_note}</p>
                            </div>
                          )}
                        </div> {/* fine header cliccabile */}

                        {/* Pannello dettaglio NC espanso */}
                        {expandedNc === nc.id && (
                          <div className="border-t border-slate-100 bg-slate-50 p-5 space-y-3">
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Dettaglio segnalazione</p>
                            {[
                              ['Data ricezione',       nc.data_ricezione ? new Date(nc.data_ricezione).toLocaleDateString('it') : null],
                              ['Segnalazione da',      nc.segnalazione_da],
                              ['Ambito',               nc.ambito],
                              ['Analisi dinamica',     nc.analisi_dinamica],
                              ['Cause evento',         nc.cause_evento],
                              ['Desc. cause',          nc.descrizione_cause],
                              ['Tipologia esito',      nc.tipologia_esito],
                              ['Correzione immediata', nc.correzione_immediata],
                              ['Azione correttiva',    nc.azione_correttiva],
                              ['AC entro il',          nc.ac_entro_il ? new Date(nc.ac_entro_il).toLocaleDateString('it') : null],
                              ['Responsabile',         nc.responsabile_esecuzione],
                              ['Verifica efficacia',   nc.verifica_efficacia],
                              ['Esito verifica',       nc.esito_verifica],
                              ['Azioni aggiuntive',    nc.azioni_aggiuntive],
                              ['Chiusura da',          nc.verifica_chiusura_da],
                              ['Data chiusura',        nc.data_chiusura ? new Date(nc.data_chiusura).toLocaleDateString('it') : null],
                              ['Riscontro segnalante', nc.data_riscontro_segnalante ? new Date(nc.data_riscontro_segnalante).toLocaleDateString('it') : null],
                              ['Note',                 nc.note],
                            ].filter(([,v]) => v).map(([label, value]) => (
                              <div key={label} className="grid grid-cols-3 gap-2 text-sm">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">{label}</span>
                                <span className="col-span-2 text-slate-700 font-medium">{value}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Pannello nota HQ espandibile */}
                        {isExpanded && (
                          <div className="border-t border-indigo-100 bg-indigo-50 p-4">
                            <p className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-2">Nota HQ</p>
                            <textarea
                              rows={3}
                              value={hqNoteText}
                              onChange={e => setHqNoteText(e.target.value)}
                              className="w-full bg-white border border-indigo-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400 resize-none mb-3"
                              placeholder="Inserisci una nota per la struttura..."
                            />
                            <div className="flex justify-end gap-2">
                              <button onClick={() => setHqNoteId(null)} className="text-xs font-bold text-slate-500 px-3 py-1.5 hover:bg-slate-100 rounded-lg">Annulla</button>
                              <button
                                onClick={() => handleSaveHqNote(nc.id)}
                                disabled={savingNote}
                                className="text-xs font-bold bg-indigo-600 text-white px-4 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                              >
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

          {/* ── TAB SOLLECITI ───────────────────────────────── */}
          {activeTab === 'solleciti' && (
            <div className="min-h-96">
              <SollecitiTab
                key="solleciti-tab"
                facilities={facilities}
                udos={udos}
                kpiRecords={kpiRecords}
                surveys={surveys}
                year={year}
              />
            </div>
          )}

          {/* ── TAB STATISTICHE ──────────────────────────────── */}
          {activeTab === 'nc_stats' && (
            <div className="space-y-6">
              {/* KPI cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Totale NC',     value: stats.totale,   color: 'text-slate-700',  bg: 'bg-slate-50'  },
                  { label: 'Aperte',        value: stats.aperte,   color: 'text-red-600',    bg: 'bg-red-50'    },
                  { label: 'Risolte',       value: stats.risolte,  color: 'text-emerald-600',bg: 'bg-emerald-50'},
                  { label: 'Critiche',      value: stats.critiche, color: 'text-orange-600', bg: 'bg-orange-50' },
                ].map(s => (
                  <div key={s.label} className={`${s.bg} rounded-2xl border border-slate-200 p-5 text-center`}>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{s.label}</p>
                    <p className={`text-4xl font-black ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Per stato */}
                <StatCard title="Per stato" data={stats.byStatus} cfg={
                  Object.fromEntries(Object.entries(STATUS_CFG).map(([k,v]) => [k, { label: v.label, color: v.dot }]))
                } />
                {/* Per severità */}
                <StatCard title="Per severità" data={stats.bySeverity} cfg={{
                  bassa:   { label: 'Bassa',   color: 'bg-slate-400'   },
                  media:   { label: 'Media',   color: 'bg-amber-400'   },
                  alta:    { label: 'Alta',    color: 'bg-orange-500'  },
                  critica: { label: 'Critica', color: 'bg-red-600'     },
                }} />
                {/* Per categoria */}
                <StatCard title="Per categoria" data={stats.byCategory} />
                {/* Per UDO */}
                <StatCard title="Per tipo struttura (UDO)" data={stats.byUdo} />
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

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


// ── SollecitiTab ─────────────────────────────────────────────
const MONTH_NAMES_FULL = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
  'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

function SollecitiTab({ facilities, udos, kpiRecords, surveys, year }) {
  const [checked, setChecked]     = useState(false);
  const [inadempienti, setIn]     = useState([]);
  const [selected, setSelected]   = useState({});
  const [sentIds, setSentIds]     = useState([]);

  const now           = new Date();
  const prevMonth     = now.getMonth() === 0 ? 12 : now.getMonth();
  const prevMonthYear = now.getMonth() === 0 ? year - 1 : year;

  const runCheck = (tipo = 'all') => {
    const results = [];

    facilities.filter(f => !f.is_suspended).forEach(f => {
      const mancanze = [];

      // KPI mese precedente
      if (tipo === 'all' || tipo === 'kpi') {
        const kpiRec = kpiRecords.find(k =>
          String(k.facility_id) === String(f.id) &&
          Number(k.year)  === prevMonthYear &&
          Number(k.month) === prevMonth
        );
        if (!kpiRec || kpiRec.status !== 'completed') {
          mancanze.push(`KPI ${MONTH_NAMES_FULL[prevMonth - 1]} ${prevMonthYear} non consolidati`);
        }
      }

      // Questionari (solo se tipo = 'all' o 'survey')
      if (tipo === 'all' || tipo === 'survey') {
      // Questionario clienti
      const cSurvey = surveys
        .filter(s => s.type === 'client' &&
          (String(s.facility_id) === String(f.id) ||
          (!s.facility_id && s.company_id === f.company_id)))
        .sort((a,b) => b.calendar_id.localeCompare(a.calendar_id))[0];
      if (!cSurvey || (!cSurvey.ai_report_ospiti && !cSurvey.ai_report_direzione)) {
        mancanze.push('Questionario Clienti non completato');
      }

      // Questionario operatori
      const oSurvey = surveys
        .filter(s => s.type === 'operator' &&
          (String(s.facility_id) === String(f.id) ||
          (!s.facility_id && s.company_id === f.company_id)))
        .sort((a,b) => b.calendar_id.localeCompare(a.calendar_id))[0];
      if (!oSurvey || (!oSurvey.ai_report_ospiti && !oSurvey.ai_report_direzione)) {
        mancanze.push('Questionario Operatori non completato');
      }
      } // fine blocco questionari

      if (!mancanze.length) return;

      // Destinatari: Ref. Qualità + Ref. Struttura
      // Fallback: Direttore + Dir. Sanitario
      const dest = [];
      const hasRQ = f.referent           && f.email_qualita;
      const hasRS = f.referente_struttura && f.email_referente_struttura;

      if (hasRQ || hasRS) {
        if (hasRQ) dest.push({ nome: f.referent,            email: f.email_qualita,             ruolo: 'Ref. Qualità'   });
        if (hasRS) dest.push({ nome: f.referente_struttura, email: f.email_referente_struttura, ruolo: 'Ref. Struttura' });
      } else {
        if (f.director           && f.email_direzione) dest.push({ nome: f.director,           email: f.email_direzione, ruolo: 'Direttore'      });
        if (f.director_sanitario && f.email_sanitario) dest.push({ nome: f.director_sanitario, email: f.email_sanitario, ruolo: 'Dir. Sanitario' });
      }

      const udo = udos.find(u => u.id === f.udo_id);
      results.push({ id: f.id, name: f.name, udo: udo?.name || '—', mancanze, destinatari: dest, noEmail: dest.length === 0 });
    });

    // Ordina: prima quelli senza email (da sistemare), poi per nome
    results.sort((a, b) => {
      if (a.noEmail && !b.noEmail) return -1;
      if (!a.noEmail && b.noEmail) return 1;
      return a.name.localeCompare(b.name);
    });

    setIn(results);
    // Seleziona tutto tranne quelli senza email
    const sel = {};
    results.forEach(r => { if (!r.noEmail) sel[r.id] = true; });
    setSelected(sel);
    setChecked(true);
    setSentIds([]);
  };

  const toggleSelect = (id) => setSelected(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleAll    = (val) => {
    const sel = {};
    inadempienti.filter(r => !r.noEmail).forEach(r => { sel[r.id] = val; });
    setSelected(sel);
  };

  const selectedCount = Object.values(selected).filter(Boolean).length;

  const handleSendAll = () => {
    const toSend = inadempienti.filter(r => selected[r.id] && !r.noEmail);
    if (!toSend.length) return;

    // Costruisce la mailto con tutti i destinatari selezionati
    const allEmails = [...new Set(toSend.flatMap(r => r.destinatari.map(d => d.email)))];
    const subject   = encodeURIComponent(`Sollecito attività qualità — ${MONTH_NAMES_FULL[prevMonth - 1]} ${prevMonthYear}`);
    const body      = encodeURIComponent(
      `Gentile referente,\n\nLe segnaliamo che risultano ancora attività non completate per il mese di ${MONTH_NAMES_FULL[prevMonth - 1]} ${prevMonthYear}.\n\nLa preghiamo di provvedere al completamento al più presto.\n\nGrazie,\nUfficio Qualità`
    );
    window.location.href = `mailto:?bcc=${allEmails.join(';')}&subject=${subject}&body=${body}`;
    setSentIds(prev => [...new Set([...prev, ...toSend.map(r => r.id)])]);
  };

  const handleSendSingle = (struttura) => {
    const emails  = struttura.destinatari.map(d => d.email).join(';');
    const subject = encodeURIComponent(`Sollecito attività qualità — ${struttura.name}`);
    const missing = struttura.mancanze.map(m => `• ${m}`).join('\n');
    const body    = encodeURIComponent(
      `Gentile referente,\n\nSi segnalano le seguenti attività non completate per la struttura "${struttura.name}":\n\n${missing}\n\nLa preghiamo di provvedere al completamento.\n\nGrazie,\nUfficio Qualità`
    );
    window.location.href = `mailto:${emails}?subject=${subject}&body=${body}`;
    setSentIds(prev => [...new Set([...prev, struttura.id])]);
  };

  return (
    <div className="space-y-6">

      {/* Header azione */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-black text-slate-800 text-lg">Verifica inadempienze</h3>
          <p className="text-sm text-slate-400 mt-0.5">
            Mese KPI: <span className="font-bold text-slate-600">{MONTH_NAMES_FULL[prevMonth - 1]} {prevMonthYear}</span>
            {' · '}Questionari: <span className="font-bold text-slate-600">anno {year} in corso</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => runCheck('kpi')}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-black hover:bg-indigo-700 transition-colors shadow"
          >
            <Bell size={15} /> Verifica KPI
          </button>
          <button
            onClick={() => runCheck('survey')}
            className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2.5 rounded-xl text-sm font-black hover:bg-purple-700 transition-colors shadow"
          >
            <Bell size={15} /> Verifica Questionari
          </button>
          <button
            onClick={() => runCheck('all')}
            className="flex items-center gap-2 bg-rose-600 text-white px-4 py-2.5 rounded-xl text-sm font-black hover:bg-rose-700 transition-colors shadow"
          >
            <Bell size={15} /> Verifica Tutto
          </button>
        </div>
      </div>

      {/* Risultati */}
      {checked && (
        <>
          {inadempienti.length === 0 ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center">
              <CheckCircle2 size={40} className="mx-auto text-emerald-500 mb-3" />
              <p className="font-black text-emerald-700 text-lg">Tutte le strutture sono in regola!</p>
              <p className="text-emerald-600 text-sm mt-1">
                KPI e questionari completati per {MONTH_NAMES_FULL[prevMonth - 1]} {prevMonthYear}
              </p>
            </div>
          ) : (
            <>
              {/* Barra azioni */}
              <div className="flex items-center justify-between flex-wrap gap-3 bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-bold text-slate-700">
                    <span className="text-2xl font-black text-rose-600">{inadempienti.length}</span> strutture inadempienti
                  </span>
                  {inadempienti.some(r => r.noEmail) && (
                    <span className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg flex items-center gap-1">
                      <AlertCircle size={12} /> {inadempienti.filter(r => r.noEmail).length} senza referente email
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleAll(true)}  className="text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors">Seleziona tutti</button>
                  <button onClick={() => toggleAll(false)} className="text-xs font-bold text-slate-500 hover:bg-slate-100 px-3 py-1.5 rounded-lg transition-colors">Deseleziona tutti</button>
                  <button
                    onClick={handleSendAll}
                    disabled={selectedCount === 0}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-black hover:bg-indigo-700 disabled:opacity-40 transition-colors shadow"
                  >
                    <Send size={13} /> Invia a selezionati ({selectedCount})
                  </button>
                </div>
              </div>

              {/* Lista strutture */}
              <div className="space-y-3">
                {inadempienti.map(r => (
                  <div
                    key={r.id}
                    className={`bg-white border rounded-2xl overflow-hidden transition-all ${
                      sentIds.includes(r.id) ? 'border-emerald-200 opacity-60' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-start gap-4 p-5">

                      {/* Checkbox selezione */}
                      <div className="pt-0.5 shrink-0">
                        {r.noEmail ? (
                          <div className="w-5 h-5 rounded border-2 border-slate-200 bg-slate-100 flex items-center justify-center" title="Nessun referente con email">
                            <span className="text-slate-400 text-[10px]">—</span>
                          </div>
                        ) : (
                          <input
                            type="checkbox"
                            checked={!!selected[r.id]}
                            onChange={() => toggleSelect(r.id)}
                            className="w-5 h-5 accent-indigo-600 cursor-pointer"
                          />
                        )}
                      </div>

                      {/* Contenuto */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div>
                            <p className="font-black text-slate-800">{r.name}</p>
                            <p className="text-xs text-slate-400 font-bold uppercase">{r.udo}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {sentIds.includes(r.id) && (
                              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1">
                                <CheckCircle2 size={11} /> Inviato
                              </span>
                            )}
                            {!r.noEmail && !sentIds.includes(r.id) && (
                              <button
                                onClick={() => handleSendSingle(r)}
                                className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-lg transition-colors"
                              >
                                <Send size={11} /> Invia solo a questa
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Mancanze */}
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {r.mancanze.map((m, i) => (
                            <span key={i} className="text-[11px] font-bold bg-red-50 text-red-700 border border-red-200 px-2.5 py-1 rounded-lg">
                              {m}
                            </span>
                          ))}
                        </div>

                        {/* Destinatari */}
                        {r.noEmail ? (
                          <p className="text-xs text-amber-600 font-bold mt-2 flex items-center gap-1">
                            <AlertCircle size={11} /> Nessun referente con email configurato — aggiorna l'anagrafica struttura
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {r.destinatari.map((d, i) => (
                              <span key={i} className="text-[11px] text-slate-600 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                                <span className="font-bold text-indigo-600">{d.ruolo}</span>
                                {d.nome && <span>— {d.nome}</span>}
                                <a href={`mailto:${d.email}`} className="text-indigo-400 hover:text-indigo-600">✉</a>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {!checked && (
        <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-12 text-center">
          <Bell size={40} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500 font-medium">Premi "Esegui verifica" per controllare le strutture inadempienti</p>
          <p className="text-slate-400 text-sm mt-1">
            Verranno controllati KPI e questionari per {MONTH_NAMES_FULL[prevMonth - 1]} {prevMonthYear}
          </p>
        </div>
      )}
    </div>
  );
}

// ── UtentiTab ─────────────────────────────────────────────────
const RUOLI = ['superadmin', 'sede', 'admin', 'director'];
const RUOLO_COLORS = {
  superadmin: 'bg-purple-50 text-purple-700 border-purple-200',
  sede:       'bg-indigo-50 text-indigo-700 border-indigo-200',
  admin:      'bg-blue-50 text-blue-700 border-blue-200',
  director:   'bg-emerald-50 text-emerald-700 border-emerald-200',
};

function UtentiTab({ facilities, isSuperAdmin }) {
  const [utenti, setUtenti]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [editingId, setEditingId]     = useState(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [search, setSearch]           = useState('');
  const [sqlCmd, setSqlCmd]           = useState('');
  const [showSql, setShowSql]         = useState(false);
  const [saving, setSaving]           = useState(false);

  const loadUtenti = () => {
    setLoading(true);
    supabase
      .from('user_profiles')
      .select('id, email, full_name, role, company_id, created_at, updated_at, user_facility_access!user_facility_access_user_id_fkey(facility_id)')
      .order('full_name')
      .then(({ data, error }) => {
        if (!error) setUtenti(data || []);
        setLoading(false);
      });
  };

  useEffect(() => { loadUtenti(); }, []);

  const filtered = utenti.filter(u =>
    !search ||
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  // Genera SQL per creazione utente (da eseguire su Supabase)
  const generateSql = (form) => {
    const facilityInserts = form.facilityIds.length > 0
      ? form.facilityIds.map(fid =>
          `INSERT INTO public.user_facility_access (user_id, facility_id)\n  SELECT id, ${fid} FROM public.user_profiles WHERE email = '${form.email}';`
        ).join('\n')
      : '';

    return `-- 1. Crea utente in Supabase Authentication → Users → Add user
--    Email: ${form.email}
--    Password: (imposta una password temporanea)

-- 2. Poi esegui questo SQL:
UPDATE public.user_profiles
SET role       = '${form.role}',
    company_id = ${form.companyId || 'NULL'},
    full_name  = '${form.fullName}'
WHERE email = '${form.email}';

${facilityInserts}

-- 3. Verifica
SELECT id, email, role, full_name FROM public.user_profiles WHERE email = '${form.email}';`;
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-black text-slate-800 text-lg">Gestione Utenti</h3>
          <p className="text-sm text-slate-400 mt-0.5">{utenti.length} utenti registrati</p>
        </div>
        <button
          onClick={() => { setShowNewForm(true); setShowSql(false); setSqlCmd(''); }}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-black hover:bg-indigo-700 transition-colors shadow"
        >
          <Plus size={15} /> Nuovo utente
        </button>
      </div>

      {/* Form nuovo utente */}
      {showNewForm && (
        <NuovoUtenteForm
          facilities={facilities}
          onGenerate={(form) => { setSqlCmd(generateSql(form)); setShowSql(true); }}
          onClose={() => setShowNewForm(false)}
        />
      )}

      {/* SQL generato */}
      {showSql && sqlCmd && (
        <div className="bg-slate-900 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-black text-emerald-400 uppercase tracking-widest">
              SQL da eseguire su Supabase → SQL Editor
            </p>
            <button
              onClick={() => { navigator.clipboard.writeText(sqlCmd); }}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white bg-slate-700 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Copy size={12} /> Copia
            </button>
          </div>
          <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap leading-relaxed">{sqlCmd}</pre>
          <p className="text-xs text-amber-400 mt-3 font-bold">
            ⚠ Prima crea l'utente in Supabase Authentication → Users → Add user, poi esegui questo SQL.
          </p>
          <button
            onClick={() => { setShowSql(false); setShowNewForm(false); loadUtenti(); }}
            className="mt-3 text-xs font-bold text-emerald-400 hover:text-emerald-300"
          >
            Ho eseguito il SQL → Ricarica lista
          </button>
        </div>
      )}

      {/* Ricerca */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
        <input
          type="text"
          placeholder="Cerca per nome o email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-sm outline-none focus:border-indigo-400"
        />
      </div>

      {/* Lista utenti */}
      {loading ? (
        <div className="text-center py-12 text-slate-400 animate-pulse font-bold">Caricamento...</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(u => (
            <UtenteCard
              key={u.id}
              utente={u}
              facilities={facilities}
              isEditing={editingId === u.id}
              isSuperAdmin={isSuperAdmin}
              onEdit={() => setEditingId(u.id)}
              onCancel={() => setEditingId(null)}
              onSaved={() => { setEditingId(null); loadUtenti(); }}
              saving={saving}
              setSaving={setSaving}
            />
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-8 text-slate-400 font-bold">Nessun utente trovato</div>
          )}
        </div>
      )}
    </div>
  );
}

function NuovoUtenteForm({ facilities, onGenerate, onClose }) {
  const [form, setForm] = useState({
    email: '', fullName: '', role: 'director', companyId: '', facilityIds: [],
  });

  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }));
  const toggleFacility = id => setForm(p => ({
    ...p,
    facilityIds: p.facilityIds.includes(id)
      ? p.facilityIds.filter(x => x !== id)
      : [...p.facilityIds, id],
  }));

  const INP2 = 'w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400';

  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 space-y-4">
      <h4 className="font-black text-indigo-700 text-sm uppercase tracking-widest">Nuovo utente</h4>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">Email *</label>
          <input type="email" value={form.email} onChange={set('email')} className={INP2} placeholder="nome@azienda.it" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">Nome completo *</label>
          <input type="text" value={form.fullName} onChange={set('fullName')} className={INP2} placeholder="Nome Cognome" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">Ruolo *</label>
          <select value={form.role} onChange={set('role')} className={INP2}>
            {RUOLI.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">Company ID (lascia vuoto per accesso globale)</label>
          <input type="number" value={form.companyId} onChange={set('companyId')} className={INP2} placeholder="es. 11" />
        </div>
      </div>

      {form.role === 'director' && (
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-2">Strutture assegnate</label>
          <div className="max-h-40 overflow-y-auto grid grid-cols-2 gap-1.5">
            {facilities.filter(f => !f.is_suspended).map(f => (
              <label key={f.id} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer text-xs font-medium transition-colors ${
                form.facilityIds.includes(f.id) ? 'bg-indigo-100 text-indigo-700' : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}>
                <input
                  type="checkbox"
                  checked={form.facilityIds.includes(f.id)}
                  onChange={() => toggleFacility(f.id)}
                  className="accent-indigo-600"
                />
                {f.name}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">
          Annulla
        </button>
        <button
          onClick={() => {
            if (!form.email || !form.fullName) return;
            onGenerate(form);
          }}
          className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2 rounded-xl text-sm font-black hover:bg-indigo-700 transition-colors"
        >
          <Copy size={13} /> Genera SQL
        </button>
      </div>
    </div>
  );
}

function UtenteCard({ utente: u, facilities, isEditing, isSuperAdmin, onEdit, onCancel, onSaved, saving, setSaving }) {
  const [form, setForm] = useState({
    role:       u.role,
    full_name:  u.full_name || '',
    company_id: u.company_id || '',
    facilityIds: (u.user_facility_access || []).map(a => a.facility_id),
  });

  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }));
  const toggleFacility = id => setForm(p => ({
    ...p,
    facilityIds: p.facilityIds.includes(id)
      ? p.facilityIds.filter(x => x !== id)
      : [...p.facilityIds, id],
  }));

  const handleSave = async () => {
    setSaving(true);
    try {
      // Aggiorna profilo
      await supabase.from('user_profiles').update({
        role:       form.role,
        full_name:  form.full_name,
        company_id: form.company_id ? parseInt(form.company_id) : null,
      }).eq('id', u.id);

      // Se director: aggiorna strutture assegnate
      if (form.role === 'director') {
        await supabase.from('user_facility_access').delete().eq('user_id', u.id);
        if (form.facilityIds.length > 0) {
          await supabase.from('user_facility_access').insert(
            form.facilityIds.map(fid => ({ user_id: u.id, facility_id: fid }))
          );
        }
      }
      onSaved();
    } catch (err) {
      alert('Errore: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const INP2 = 'w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400';
  const assignedFacilities = (u.user_facility_access || []).map(a => {
    const f = facilities.find(x => x.id === a.facility_id);
    return f?.name || `ID ${a.facility_id}`;
  });

  return (
    <div className={`bg-white border rounded-2xl overflow-hidden transition-all ${isEditing ? 'border-indigo-300 shadow-md' : 'border-slate-200'}`}>
      <div className="flex items-center justify-between p-4 gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
            <span className="text-sm font-black text-indigo-600">
              {(u.full_name || u.email || '?')[0].toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="font-black text-slate-800 truncate">{u.full_name || '— nessun nome —'}</p>
            <p className="text-xs text-slate-400 truncate">{u.email}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {(u.updated_at && u.updated_at !== u.created_at) ? (
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">
                  ● Ha effettuato accesso
                </span>
              ) : (
                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg">
                  ● In attesa primo accesso
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-black px-2.5 py-1 rounded-lg border ${RUOLO_COLORS[u.role] || 'bg-slate-100 text-slate-600'}`}>
            {u.role}
          </span>
          {!isEditing && (
            <button
              onClick={onEdit}
              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
            >
              <Edit2 size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Strutture assegnate (solo lettura) */}
      {!isEditing && u.role === 'director' && assignedFacilities.length > 0 && (
        <div className="px-4 pb-3 flex flex-wrap gap-1.5">
          {assignedFacilities.map((name, i) => (
            <span key={i} className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-lg font-medium">
              {name}
            </span>
          ))}
        </div>
      )}

      {/* Form modifica */}
      {isEditing && (
        <div className="border-t border-indigo-100 bg-indigo-50 p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Nome completo</label>
              <input type="text" value={form.full_name} onChange={set('full_name')} className={INP2} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Ruolo</label>
              <select value={form.role} onChange={set('role')} className={INP2}>
                {RUOLI.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Company ID (vuoto = accesso globale)</label>
              <input type="number" value={form.company_id} onChange={set('company_id')} className={INP2} placeholder="es. 11" />
            </div>
          </div>

          {form.role === 'director' && (
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2">Strutture assegnate</label>
              <div className="max-h-40 overflow-y-auto grid grid-cols-2 gap-1.5">
                {facilities.filter(f => !f.is_suspended).map(f => (
                  <label key={f.id} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer text-xs font-medium transition-colors ${
                    form.facilityIds.includes(f.id) ? 'bg-indigo-100 text-indigo-700' : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}>
                    <input
                      type="checkbox"
                      checked={form.facilityIds.includes(f.id)}
                      onChange={() => toggleFacility(f.id)}
                      className="accent-indigo-600"
                    />
                    {f.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onCancel} className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">
              Annulla
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2 rounded-xl text-sm font-black hover:bg-indigo-700 disabled:opacity-60 transition-colors">
              {saving ? 'Salvo...' : 'Salva modifiche'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
