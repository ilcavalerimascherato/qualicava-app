// src/views/DocMyDocumentiView.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText, Download, Loader2, FolderOpen, AlertTriangle,
  CheckCircle2, Clock, Star, Pill, Shield, Apple, Droplets,
  FolderPlus, Plus, Pencil, Send, Archive, X,
  Stethoscope, BookOpen, HardHat, BarChart2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabaseClient';
import {
  downloadMasterFile,
  compileDocumento,
  logAccesso,
  getDocStruttura,
  inviaAQualita,
  setDocStrutturaObsoleto,
} from '../services/documentiService';
import DocStrutturaProprioModal from '../components/DocStrutturaProprioModal';

// ─── mappa colori categorie (ricalca DocumentiPage) ──────────

const CAT_STYLE = {
  // legacy
  ASS: { bg: 'bg-blue-50',    icon: Star,           iconColor: 'text-blue-600',    badge: 'bg-blue-100 text-blue-700'    },
  FAR: { bg: 'bg-violet-50',  icon: Pill,           iconColor: 'text-violet-600',  badge: 'bg-violet-100 text-violet-700'},
  SIC: { bg: 'bg-amber-50',   icon: Shield,         iconColor: 'text-amber-600',   badge: 'bg-amber-100 text-amber-700'  },
  ALI: { bg: 'bg-orange-50',  icon: Apple,          iconColor: 'text-orange-600',  badge: 'bg-orange-100 text-orange-700'},
  IGI: { bg: 'bg-cyan-50',    icon: Droplets,       iconColor: 'text-cyan-600',    badge: 'bg-cyan-100 text-cyan-700'    },
  QUA: { bg: 'bg-emerald-50', icon: AlertTriangle,  iconColor: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700'},
  // new
  PCA: { bg: 'bg-blue-50',    icon: Stethoscope,    iconColor: 'text-blue-600',    badge: 'bg-blue-100 text-blue-700'    },
  CDS: { bg: 'bg-violet-50',  icon: BookOpen,       iconColor: 'text-violet-600',  badge: 'bg-violet-100 text-violet-700'},
  SSL: { bg: 'bg-amber-50',   icon: HardHat,        iconColor: 'text-amber-600',   badge: 'bg-amber-100 text-amber-700'  },
  RDD: { bg: 'bg-cyan-50',    icon: BarChart2,      iconColor: 'text-cyan-600',    badge: 'bg-cyan-100 text-cyan-700'    },
};
const CAT_DEFAULT = { bg: 'bg-slate-50', icon: FileText, iconColor: 'text-slate-400', badge: 'bg-slate-100 text-slate-600' };

// ─── badge stato doc_struttura ────────────────────────────────

const STATO_STR_BADGE = {
  bozza:           { label: 'Bozza',                cls: 'bg-slate-100 text-slate-600'    },
  inviato_qualita: { label: 'In revisione Qualità', cls: 'bg-amber-100 text-amber-700'    },
  approvato:       { label: 'Approvato',            cls: 'bg-emerald-100 text-emerald-700' },
};

function scadenzaBadge(dateStr) {
  if (!dateStr) return null;
  const d    = new Date(dateStr);
  const days = Math.ceil((d - Date.now()) / 86400000);
  if (days < 0)  return { label: 'Scaduto',    cls: 'bg-rose-100 text-rose-700'   };
  if (days < 30) return { label: `${days} gg`, cls: 'bg-amber-100 text-amber-700' };
  return           { label: d.toLocaleDateString('it-IT'), cls: 'bg-emerald-100 text-emerald-700' };
}

// ─── card documento ───────────────────────────────────────────

function DocCard({ istanza, facilityData, onDownload }) {
  const doc    = istanza.doc_master ?? {};
  const style  = CAT_STYLE[doc.categoria] ?? CAT_DEFAULT;
  const Icon   = style.icon;
  const scad   = scadenzaBadge(doc.data_scadenza);
  const isNuovo    = !istanza.primo_accesso_il;
  const isUpdated  = istanza.generato_il && istanza.primo_accesso_il &&
    new Date(istanza.generato_il) > new Date(istanza.primo_accesso_il);
  const [loading, setLoading] = useState(false);

  const handleClick = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try { await onDownload(istanza, facilityData); }
    catch (err) {
      const msg = err?.message || err?.error_description || JSON.stringify(err);
      alert('Errore download: ' + msg);
    }
    finally { setLoading(false); }
  }, [loading, onDownload, istanza, facilityData]);

  return (
    <div className={`rounded-2xl border-2 border-white p-4 ${style.bg} flex flex-col gap-3 shadow-sm hover:shadow-md transition-all`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-white rounded-xl shadow-sm">
            <Icon size={18} className={style.iconColor} />
          </div>
          <div className="flex flex-col gap-1">
            {isNuovo && (
              <span className="text-[9px] font-black bg-rose-500 text-white px-1.5 py-0.5 rounded uppercase tracking-wide w-fit">
                Nuovo
              </span>
            )}
            {isUpdated && !isNuovo && (
              <span className="text-[9px] font-black bg-amber-400 text-white px-1.5 py-0.5 rounded uppercase tracking-wide w-fit">
                Aggiornato
              </span>
            )}
          </div>
        </div>
        <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg shrink-0 ${style.badge}`}>
          {doc.categoria}
        </span>
      </div>

      <div className="flex-1">
        {doc.titolo
          ? <p className="font-black text-slate-800 text-sm leading-tight line-clamp-2">{doc.titolo}</p>
          : <p className="font-black text-slate-400 italic text-sm leading-tight">Titolo non disponibile</p>
        }
        <p className="text-[11px] text-slate-500 font-bold mt-0.5">{doc.codice_documento}</p>
        {doc.revisione_corrente && (
          <p className="text-[10px] text-slate-400 font-bold mt-0.5">Rev. {doc.revisione_corrente}</p>
        )}
      </div>

      <div className="flex items-center justify-between">
        {scad ? (
          <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${scad.cls}`}>
            {scad.label}
          </span>
        ) : <span />}

        <div className="flex items-center gap-1 text-[10px] text-slate-400">
          {istanza.primo_accesso_il
            ? <><CheckCircle2 size={10} className="text-emerald-500" /> Scaricato</>
            : <><Clock size={10} /> Non ancora</>
          }
        </div>
      </div>

      {doc.file_url_master ? (
        <button
          onClick={handleClick}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-white text-slate-700 border border-slate-200
            rounded-xl py-2 text-xs font-black uppercase hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200
            transition-all disabled:opacity-50"
        >
          {loading
            ? <><Loader2 size={13} className="animate-spin" /> Compilazione…</>
            : <><Download size={13} /> Scarica .docx</>
          }
        </button>
      ) : (
        <div className="w-full flex items-center justify-center gap-2 bg-slate-100 text-slate-400
          rounded-xl py-2 text-xs font-bold border border-slate-200">
          <AlertTriangle size={13} /> File non ancora disponibile
        </div>
      )}
    </div>
  );
}

// ─── view principale ──────────────────────────────────────────

export default function DocMyDocumentiView({ facilityId: propFacilityId = null }) {
  const { profile } = useAuth();

  const [facilityId,       setFacilityId]       = useState(propFacilityId);
  const [facilityData,     setFacilityData]     = useState(null);
  const [istanze,          setIstanze]          = useState([]);
  const [facilities,       setFacilities]       = useState([]);
  const [loading,          setLoading]          = useState(true);
  const [error,            setError]            = useState('');
  const [docStruttura,     setDocStruttura]     = useState([]);
  const [loadingStruttura, setLoadingStruttura] = useState(false);
  const [strutturaModal,   setStrutturaModal]   = useState({ open: false, doc: null, isNew: false });
  const [confermaElimina,  setConfermaElimina]  = useState(null);

  // Determina la struttura dell'utente (ignorato se facilityId passato come prop)
  useEffect(() => {
    if (propFacilityId != null) return;
    const ids = profile?.accessibleFacilityIds ?? [];
    if (ids.length > 0) setFacilityId(ids[0]);
  }, [profile, propFacilityId]);

  // Carica selettore strutture (ignorato se facilityId passato come prop)
  useEffect(() => {
    if (propFacilityId != null) return;
    const ids = profile?.accessibleFacilityIds ?? [];
    if (ids.length <= 1) return;
    supabase.from('facilities').select('id, name').in('id', ids).order('name')
      .then(({ data }) => setFacilities(data ?? []));
  }, [profile, propFacilityId]);

  // Carica istanze + dati struttura
  useEffect(() => {
    if (!facilityId) return;
    setLoading(true);
    setError('');

    // Step 1: carica istanze
    supabase
      .from('doc_istanze')
      .select('*')
      .eq('facility_id', facilityId)
      .order('generato_il', { ascending: false })
    .then(async ({ data: ist, error: e1 }) => {
      if (e1) { setError(e1.message); setLoading(false); return; }
      const istanze = ist ?? [];

      // Step 2: carica i doc_master solo per gli id che servono
      const masterIds = [...new Set(istanze.map(i => i.master_id).filter(Boolean))];
      const mastersMap = {};
      if (masterIds.length > 0) {
        const { data: masters } = await supabase
          .from('doc_master')
          .select('*')
          .in('id', masterIds);
        (masters ?? []).forEach(m => { mastersMap[m.id] = m; });
      }

      // Step 3: carica facility
      const { data: fac, error: e3 } = await supabase
        .from('facilities')
        .select('id, name, address, region, director, director_sanitario, email_direzione, bed_count, company_id, companies(name), udos(name)')
        .eq('id', facilityId)
        .single();
      if (e3) { setError(e3.message); setLoading(false); return; }

      const istConMaster = istanze.map(i => ({
        ...i,
        doc_master: mastersMap[i.master_id] ?? null,
      }));
      setIstanze(istConMaster);
      if (fac) {
        setFacilityData({
          ...fac,
          ragione_sociale: fac.companies?.name ?? '',
          udo_tipo:        fac.udos?.name       ?? '',
        });
      }
      setLoading(false);
    }).catch(e => { setError(e.message); setLoading(false); });
  }, [facilityId]);

  // Carica documenti propri struttura
  useEffect(() => {
    if (!facilityId) return;
    setLoadingStruttura(true);
    getDocStruttura(facilityId)
      .then(setDocStruttura)
      .catch(console.error)
      .finally(() => setLoadingStruttura(false));
  }, [facilityId]);

  const ricaricaStruttura = useCallback(() => {
    if (!facilityId) return;
    setLoadingStruttura(true);
    getDocStruttura(facilityId)
      .then(setDocStruttura)
      .catch(console.error)
      .finally(() => setLoadingStruttura(false));
  }, [facilityId]);

  const handleInviaStruttura = useCallback(async (docId) => {
    try {
      await inviaAQualita(docId, profile?.id);
      setDocStruttura(prev => prev.map(d =>
        d.id === docId ? { ...d, stato: 'inviato_qualita' } : d
      ));
    } catch (err) {
      console.error(err);
    }
  }, [profile?.id]);

  const handleObsoletoStruttura = useCallback(async (docId) => {
    try {
      await setDocStrutturaObsoleto(docId, profile?.id);
      setDocStruttura(prev => prev.filter(d => d.id !== docId));
    } catch (err) {
      console.error(err);
    }
  }, [profile?.id]);

  const handleEliminaStruttura = useCallback(async (docId) => {
    const { error: delErr } = await supabase.from('doc_struttura').delete().eq('id', docId);
    if (!delErr) setDocStruttura(prev => prev.filter(d => d.id !== docId));
    setConfermaElimina(null);
  }, []);

  const handleScaricaStruttura = useCallback(async (doc) => {
    if (!doc?.file_url) return;
    const path = doc.file_url.split('/documenti-master/')[1];
    const { data, error } = await supabase.storage
      .from('documenti-master')
      .createSignedUrl(path, 60);
    if (error || !data?.signedUrl) {
      alert('Errore nel download del file');
      return;
    }
    const a = document.createElement('a');
    a.href     = data.signedUrl;
    a.download = `${doc.titolo}.docx`;
    a.click();
  }, []);

  const handleDownload = useCallback(async (istanza, fData) => {
    const doc = istanza.doc_master;
    if (!doc?.file_url_master) {
      alert("Il file del documento non è ancora disponibile. Contatta l'Ufficio Qualità.");
      return;
    }

    const buffer = await downloadMasterFile(doc.file_url_master);
    const blob   = await compileDocumento(buffer, fData, doc);

    const filename = `${doc.codice_documento}_${fData?.name ?? 'struttura'}.docx`
      .replace(/[^a-z0-9_\-. ]/gi, '_');
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    await logAccesso(istanza.id);
    // Aggiorna stato localmente
    setIstanze(prev => prev.map(i =>
      i.id === istanza.id
        ? { ...i, accesso_count: (i.accesso_count ?? 0) + 1, ultimo_accesso_il: new Date().toISOString(),
            primo_accesso_il: i.primo_accesso_il || new Date().toISOString() }
        : i
    ));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={28} className="text-indigo-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertTriangle size={32} className="text-rose-300 mb-3" />
        <p className="font-black text-slate-600">{error}</p>
      </div>
    );
  }

  // Raggruppa per categoria
  const byCategoria = istanze.reduce((acc, ist) => {
    const cat = ist.doc_master?.categoria ?? 'ALTRO';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(ist);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      {/* Struttura selector (solo se multi-struttura e nessun prop facilityId) */}
      {facilities.length > 1 && propFacilityId == null && (
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-slate-600">Struttura:</span>
          <select
            value={facilityId ?? ''}
            onChange={e => setFacilityId(Number(e.target.value))}
            className="rounded-xl border-2 border-slate-200 bg-white px-4 py-2 text-sm font-bold
              outline-none focus:border-indigo-400 transition-all"
          >
            {facilities.map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Intestazione struttura — nascosta quando incorporata nella vista direttore (header già visibile) */}
      {facilityData && propFacilityId == null && (
        <div className="flex items-center gap-3 pb-2 border-b border-slate-200">
          <div className="p-2 bg-indigo-100 rounded-xl">
            <FileText size={18} className="text-indigo-600" />
          </div>
          <div>
            <p className="font-black text-slate-800">{facilityData.name}</p>
            <p className="text-xs text-slate-400">{facilityData.ragione_sociale}</p>
          </div>
        </div>
      )}

      {istanze.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center
          bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl">
          <FolderOpen size={36} className="text-slate-300 mb-3" />
          <p className="font-black text-slate-500">Nessun documento disponibile</p>
          <p className="text-sm text-slate-400 mt-1">
            Non ci sono ancora documenti distribuiti per questa struttura.
          </p>
        </div>
      ) : (
        Object.entries(byCategoria).map(([cat, docs]) => {
          const style = CAT_STYLE[cat] ?? CAT_DEFAULT;
          const Icon  = style.icon;
          const nuoviOAggiornati = docs.filter(ist => {
            const isNew = !ist.primo_accesso_il;
            const isUpd = ist.generato_il && ist.primo_accesso_il &&
              new Date(ist.generato_il) > new Date(ist.primo_accesso_il);
            return isNew || isUpd;
          }).length;
          return (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-4">
                <Icon size={16} className={style.iconColor} />
                <h3 className="font-black text-slate-700 uppercase tracking-wide text-sm">{cat}</h3>
                <span className="text-xs text-slate-400">({docs.length})</span>
                {nuoviOAggiornati > 0 && (
                  <span className="min-w-[18px] h-[18px] bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1 leading-none">
                    {nuoviOAggiornati}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {docs.map(ist => (
                  <DocCard
                    key={ist.id}
                    istanza={ist}
                    facilityData={facilityData}
                    onDownload={handleDownload}
                  />
                ))}
              </div>
            </div>
          );
        })
      )}

      {/* ── Documenti della struttura ─────────────────────── */}
      <div className="pt-4 border-t-2 border-slate-200">

        {/* Header sezione */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-teal-100 rounded-xl">
              <FolderPlus size={18} className="text-teal-600" />
            </div>
            <div>
              <h3 className="font-black text-slate-800">I miei documenti</h3>
              <p className="text-xs text-slate-400">Procedure e istruzioni operative proprie della struttura</p>
            </div>
          </div>
          {facilityId && (
            <button
              onClick={() => setStrutturaModal({ open: true, doc: null, isNew: true })}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase
                bg-teal-600 text-white shadow hover:bg-teal-700 transition-colors"
            >
              <Plus size={13} /> Nuovo documento
            </button>
          )}
        </div>

        {/* Lista o empty state */}
        {loadingStruttura ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={22} className="text-teal-400 animate-spin" />
          </div>
        ) : docStruttura.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center
            bg-teal-50/50 border-2 border-dashed border-teal-200 rounded-2xl">
            <FolderPlus size={32} className="text-teal-300 mb-3" />
            <p className="font-black text-slate-500 text-sm">Nessun documento caricato</p>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">
              Puoi caricare istruzioni operative e procedure locali della struttura.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {docStruttura.map(doc => {
              const style     = CAT_STYLE[doc.categoria] ?? CAT_DEFAULT;
              const Icon      = style.icon;
              const statoBadge = STATO_STR_BADGE[doc.stato] ?? STATO_STR_BADGE.bozza;
              return (
                <div key={doc.id} className={`rounded-2xl border-2 border-white p-4 ${style.bg} flex flex-col gap-3 shadow-sm`}>

                  {/* Top */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="p-2 bg-white rounded-xl shadow-sm">
                      <Icon size={16} className={style.iconColor} />
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {doc.categoria && (
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${style.badge}`}>
                          {doc.categoria}
                        </span>
                      )}
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${statoBadge.cls}`}>
                        {statoBadge.label}
                      </span>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1">
                    <p className="font-black text-slate-800 text-sm leading-tight line-clamp-2">{doc.titolo}</p>
                    {doc.codice && <p className="text-[11px] text-slate-500 font-bold mt-0.5">{doc.codice}</p>}
                    {doc.revisione_corrente && (
                      <p className="text-[10px] text-slate-400 font-bold mt-0.5">{doc.revisione_corrente}</p>
                    )}
                    {doc.data_approvazione && (
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {new Date(doc.data_approvazione).toLocaleDateString('it-IT')}
                      </p>
                    )}
                    {doc.flag_qualita_ok && (
                      <p className="flex items-center gap-1 text-[10px] text-emerald-600 font-bold mt-1"
                        title={`Verificato da ${doc.verificato_da_qualita ?? ''} il ${doc.data_verifica_qualita ?? ''}`}>
                        <CheckCircle2 size={10} /> Verificato Qualità
                      </p>
                    )}
                  </div>

                  {/* Azioni */}
                  <div className="flex flex-wrap gap-1.5 pt-2 border-t border-white/60">

                    {doc.stato === 'bozza' && (
                      <>
                        <button
                          onClick={() => setStrutturaModal({ open: true, doc, isNew: false })}
                          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-black uppercase
                            text-slate-600 hover:bg-white/80 transition-colors"
                        >
                          <Pencil size={10} /> Modifica
                        </button>
                        <button
                          onClick={() => handleInviaStruttura(doc.id)}
                          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-black uppercase
                            text-teal-600 hover:bg-white/80 transition-colors"
                        >
                          <Send size={10} /> Invia Qualità
                        </button>
                        <button
                          onClick={() => setConfermaElimina(doc.id)}
                          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-black uppercase
                            text-red-500 hover:bg-white/80 transition-colors ml-auto"
                        >
                          <X size={10} /> Elimina
                        </button>
                      </>
                    )}

                    {doc.stato === 'inviato_qualita' && (
                      <>
                        <span className="text-[11px] font-bold text-amber-600 flex items-center gap-1 px-2 py-1.5">
                          <Loader2 size={10} className="animate-spin" /> In attesa Qualità
                        </span>
                        <button
                          onClick={() => setStrutturaModal({ open: true, doc, isNew: false })}
                          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-black uppercase
                            text-slate-500 hover:bg-white/80 transition-colors ml-auto"
                        >
                          <FolderOpen size={10} /> Visualizza
                        </button>
                      </>
                    )}

                    {doc.stato === 'approvato' && (
                      <>
                        {doc.file_url && (
                          <button
                            onClick={() => handleScaricaStruttura(doc)}
                            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-black uppercase
                              text-teal-600 hover:bg-white/80 transition-colors"
                          >
                            <Download size={10} /> Scarica
                          </button>
                        )}
                        <button
                          onClick={() => setStrutturaModal({ open: true, doc, isNew: false })}
                          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-black uppercase
                            text-slate-600 hover:bg-white/80 transition-colors"
                        >
                          <Pencil size={10} /> Nuova rev.
                        </button>
                        <button
                          onClick={() => handleObsoletoStruttura(doc.id)}
                          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-black uppercase
                            text-red-500 hover:bg-white/80 transition-colors ml-auto"
                        >
                          <Archive size={10} /> Obsoleto
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modale DocStrutturaProprioModal */}
      {strutturaModal.open && facilityId && (
        <DocStrutturaProprioModal
          facilityId={facilityId}
          docEsistente={strutturaModal.isNew ? null : strutturaModal.doc}
          onClose={() => setStrutturaModal({ open: false, doc: null, isNew: false })}
          onSaved={() => {
            setStrutturaModal({ open: false, doc: null, isNew: false });
            ricaricaStruttura();
          }}
        />
      )}

      {/* Dialog conferma eliminazione */}
      {confermaElimina && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-base font-black text-slate-800 mb-2">Elimina documento</h3>
            <p className="text-sm text-slate-500 mb-5">
              Il documento verrà eliminato definitivamente. Questa azione non è reversibile.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfermaElimina(null)}
                className="px-4 py-2 rounded-xl text-sm font-black uppercase text-slate-500 hover:bg-slate-100 transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={() => handleEliminaStruttura(confermaElimina)}
                className="px-5 py-2 rounded-xl text-sm font-black uppercase bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
