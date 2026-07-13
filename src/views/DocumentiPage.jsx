// src/views/DocumentiPage.jsx
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Library, Send, Building2, Settings,
  ChevronRight, Plus, FolderOpen, Shield,
  ArrowLeft, Eye, Loader2, Filter, RefreshCw,
  Archive, Pencil, BookOpen, X, Search, PenLine,
  Stethoscope, Utensils, BarChart2
} from 'lucide-react';
import { useAuth }             from '../contexts/AuthContext';
import { useDashboardData }    from '../hooks/useDashboardData';
import { useBadgeCounts }      from '../hooks/useBadgeCounts';
import AppHeader               from '../components/AppHeader';
import DocMasterModal          from '../components/DocMasterModal';
import DocDistribuzioneModal   from '../components/DocDistribuzioneModal';
import DocAccessiModal         from '../components/DocAccessiModal';
import DocAnteprimaModal       from '../components/DocAnteprimaModal';
import DocStrutturaPanel          from '../components/DocStrutturaPanel';
import DocStrutturaProprioModal   from '../components/DocStrutturaProprioModal';
import DocMyDocumentiView         from './DocMyDocumentiView';
import DocFirmeModal              from '../components/DocFirmeModal';
import { supabase } from '../supabaseClient';
import {
  getDocMaster,
  setObsoleto,
  updateDocMaster,
  getDocStrutturaInRevisione
} from '../services/documentiService';

// ─── categorie ────────────────────────────────────────────────

const COLORI_CLASSI = {
  blue:    { bg: 'bg-blue-50',    iconBg: 'bg-blue-100',    iconColor: 'text-blue-600',    border: 'border-blue-200',    badge: 'bg-blue-100 text-blue-700'     },
  violet:  { bg: 'bg-violet-50',  iconBg: 'bg-violet-100',  iconColor: 'text-violet-600',  border: 'border-violet-200',  badge: 'bg-violet-100 text-violet-700' },
  amber:   { bg: 'bg-amber-50',   iconBg: 'bg-amber-100',   iconColor: 'text-amber-600',   border: 'border-amber-200',   badge: 'bg-amber-100 text-amber-700'   },
  orange:  { bg: 'bg-orange-50',  iconBg: 'bg-orange-100',  iconColor: 'text-orange-600',  border: 'border-orange-200',  badge: 'bg-orange-100 text-orange-700' },
  cyan:    { bg: 'bg-cyan-50',    iconBg: 'bg-cyan-100',    iconColor: 'text-cyan-600',    border: 'border-cyan-200',    badge: 'bg-cyan-100 text-cyan-700'     },
  emerald: { bg: 'bg-emerald-50', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700'},
  slate:   { bg: 'bg-slate-50',   iconBg: 'bg-slate-200',   iconColor: 'text-slate-500',   border: 'border-slate-300',   badge: 'bg-slate-200 text-slate-600'   }
};

const ICONE_MAPPA = { Stethoscope, BookOpen, Utensils, BarChart2, Archive, FileText };

const CATEGORIE = [
  {
    id: 'PCA', codice: 'PCA', nome: 'Protocolli, Procedure e Istruzioni Operative',
    descrizione: 'Protocolli clinico-assistenziali, Procedure, Istruzioni Operative, Moduli',
    colore: 'blue', icona: 'Stethoscope'
  },
  {
    id: 'CDS', codice: 'CDS', nome: 'Carta dei Servizi e Regolamento',
    descrizione: 'Carta dei Servizi, Regolamento',
    colore: 'violet', icona: 'BookOpen'
  },
  {
    id: 'ALI', codice: 'ALI', nome: 'Menù e Ricettari',
    descrizione: 'Menù, Ricettari, Bromatologico, Grammature, Diete Speciali',
    colore: 'orange', icona: 'Utensils'
  },
  {
    id: 'QUA', codice: 'QUA', nome: 'Analisi e Miglioramento',
    descrizione: 'Riesame, Relazione Organizzativa, Piano di Miglioramento, Analisi del Contesto/Rischi/Processi, Politica della Qualità',
    colore: 'emerald', icona: 'BarChart2'
  },
  {
    id: 'OBS', codice: 'OBS', nome: 'Documenti Obsoleti',
    descrizione: 'Documenti non più in vigore',
    colore: 'slate', icona: 'Archive'
  },
];

const CAT_MAP = Object.fromEntries(
  CATEGORIE.map(c => [c.id, {
    ...c,
    label:       c.nome,
    description: c.descrizione,
    Icon:        ICONE_MAPPA[c.icona] ?? FileText,
    ...COLORI_CLASSI[c.colore]
  }])
);

const TABS_ADMIN = [
  { id: 'libreria',      label: 'Libreria',      Icon: Library   },
  { id: 'distribuzione', label: 'Distribuzione', Icon: Send       },
  { id: 'strutture',     label: 'Strutture',     Icon: Building2 },
  { id: 'firme',         label: 'Firme',         Icon: PenLine   },
  { id: 'impostazioni',  label: 'Impostazioni',  Icon: Settings  },
];

// ─── helper scadenza ──────────────────────────────────────────

function scadenzaBadge(dateStr) {
  if (!dateStr) return null;
  const d    = new Date(dateStr);
  const days = Math.ceil((d - Date.now()) / 86400000);
  if (days < 0)  return { label: 'Scaduto',                 cls: 'bg-rose-100 text-rose-700'   };
  if (days < 30) return { label: `Scade tra ${days} giorni`, cls: 'bg-amber-100 text-amber-700' };
  return           { label: d.toLocaleDateString('it-IT'),  cls: 'bg-emerald-100 text-emerald-700' };
}

// ─── card categoria (Libreria) ────────────────────────────────

function CategoriaCard({ cat, docCount = 0, unreadCount = 0, onClick }) {
  const { Icon, label, description, bg, iconBg, iconColor, border, badge, codice, id } = cat;
  return (
    <button
      onClick={onClick}
      className={`relative w-full text-left rounded-2xl p-5 border-2 ${bg} ${border}
        hover:shadow-md transition-all duration-200 group flex flex-col gap-3`}
    >
      {unreadCount > 0 && (
        <span className="absolute -top-2 -right-2 min-w-[20px] h-[20px] bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1 leading-none shadow z-50">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
      <div className="flex items-start justify-between">
        <div className={`p-2.5 rounded-xl ${iconBg}`}>
          <Icon size={22} className={iconColor} />
        </div>
        <span className={`text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg ${badge}`}>
          {codice ?? id}
        </span>
      </div>
      <div>
        <p className="font-black text-slate-800 text-sm">{label}</p>
        <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{description}</p>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-slate-400">
          {docCount === 0 ? 'Nessun documento' : `${docCount} document${docCount === 1 ? 'o' : 'i'}`}
        </span>
        <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
      </div>
    </button>
  );
}

// ─── card documento (Libreria / Distribuzione) ────────────────

function DocMasterCard({ doc, unreadCount = 0, onDistribuisci, onAccessi, onAnteprima, onNuovaRevisione, onModifica, onObsoleto }) {
  const cat  = CAT_MAP[doc.categoria];
  const scad = scadenzaBadge(doc.data_scadenza);

  return (
    <div className="relative bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all">
      {unreadCount > 0 && (
        <span className="absolute -top-2 -right-2 min-w-[20px] h-[20px] bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1 leading-none shadow z-50"
          title={`${unreadCount} struttur${unreadCount === 1 ? 'a' : 'e'} non ha ancora consultato questo documento`}>
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5">
          {cat && (
            <div className={`p-2 rounded-xl ${cat.iconBg}`}>
              <cat.Icon size={16} className={cat.iconColor} />
            </div>
          )}
          <div>
            <p className="font-black text-slate-800 text-sm leading-tight">{doc.titolo}</p>
            <p className="text-[11px] text-slate-400 font-bold">{doc.codice_documento}</p>
          </div>
        </div>
        {cat && (
          <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg shrink-0 ${cat.badge}`}>
            {doc.categoria}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap mb-4">
        {doc.revisione_corrente && (
          <span className="text-[11px] font-black bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg">
            {doc.revisione_corrente}
          </span>
        )}
        {scad && (
          <span className={`text-[11px] font-black px-2 py-0.5 rounded-lg ${scad.cls}`}>
            {scad.label}
          </span>
        )}
        {doc.udo_applicabilita?.map(u => (
          <span key={u} className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-md">
            {u}
          </span>
        ))}
      </div>

      {/* Ordine: Anteprima | Modifica | Nuova rev. | Accessi | Distribuisci | Obsoleto */}
      <div className="flex items-center gap-1.5 pt-3 border-t border-slate-100 flex-wrap">
        <button
          onClick={() => onAnteprima(doc)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-black uppercase
            text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors border border-slate-200"
        >
          <Eye size={11} /> Anteprima
        </button>

        {onModifica && (
          <button
            onClick={() => onModifica(doc)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-black uppercase
              text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition-colors border border-slate-200"
          >
            <Pencil size={11} /> Modifica
          </button>
        )}

        {onNuovaRevisione && (doc.stato === 'approvato' || doc.stato === 'attivo') && (
          <button
            onClick={() => onNuovaRevisione(doc)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-black uppercase
              text-amber-600 hover:text-amber-700 hover:bg-amber-50 transition-colors border border-amber-200"
          >
            <RefreshCw size={11} /> Nuova rev.
          </button>
        )}

        <button
          onClick={() => onAccessi(doc)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-black uppercase
            text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors border border-slate-200"
        >
          <Eye size={11} /> Accessi
        </button>

        <button
          onClick={() => onDistribuisci(doc)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-black uppercase
            bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm ml-auto"
        >
          <Send size={11} /> Distribuisci
        </button>

        {onObsoleto && (
          <button
            onClick={() => onObsoleto(doc)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-black uppercase
              text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors border border-red-200"
          >
            <Archive size={11} /> Obsoleto
          </button>
        )}
      </div>
    </div>
  );
}

// ─── card documento obsoleto ──────────────────────────────────

function ObsDocCard({ doc, onVisualizza, onRipristina }) {
  const cat = CAT_MAP[doc.categoria];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm opacity-75 saturate-50 hover:opacity-100 hover:saturate-100 transition-all">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5">
          {cat && (
            <div className={`p-2 rounded-xl ${cat.iconBg}`}>
              <cat.Icon size={16} className={cat.iconColor} />
            </div>
          )}
          <div>
            <p className="font-black text-slate-700 text-sm leading-tight">{doc.titolo}</p>
            <p className="text-[11px] text-slate-400 font-bold">{doc.codice_documento}</p>
          </div>
        </div>
        <span className="text-[10px] font-black px-2 py-0.5 rounded-lg shrink-0 bg-red-100 text-red-700">
          OBSOLETO
        </span>
      </div>

      <div className="flex items-center gap-2 flex-wrap mb-4">
        {doc.revisione_corrente && (
          <span className="text-[11px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg">
            {doc.revisione_corrente}
          </span>
        )}
        {doc.udo_applicabilita?.map(u => (
          <span key={u} className="text-[10px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md">
            {u}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
        <button
          onClick={() => onVisualizza(doc)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase
            text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors border border-slate-200"
        >
          <Eye size={12} /> Visualizza
        </button>
        <button
          onClick={() => onRipristina(doc)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase
            text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors border border-emerald-200 ml-auto"
        >
          <RefreshCw size={12} /> Ripristina
        </button>
      </div>
    </div>
  );
}

// ─── tab placeholder ──────────────────────────────────────────

function ComingSoon({ label }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="p-4 bg-slate-100 rounded-2xl mb-3">
        <FileText size={32} className="text-slate-300" />
      </div>
      <p className="font-black text-slate-400 text-base uppercase tracking-wide">
        {label} — prossimamente
      </p>
    </div>
  );
}

// ─── pagina principale ────────────────────────────────────────

export default function DocumentiPage() {
  const navigate    = useNavigate();
  const { profile, isAdmin, signOut } = useAuth();

  const isAdminRole    = ['superadmin', 'admin'].includes(profile?.role);
  const isSedeRole     = profile?.role === 'sede';
  const isDirectorRole = profile?.role === 'director';
  const isUserView     = isDirectorRole || isSedeRole;

  // facility dell'utente corrente (per direttori/sede)
  const userFacilityId = (profile?.accessibleFacilityIds ?? [])[0] ?? null;

  const year = new Date().getFullYear();
  const { data: dashboardData } = useDashboardData(year);
  const allIds = useMemo(
    () => (dashboardData.facilities ?? []).filter(f => !f.is_suspended).map(f => f.id),
    [dashboardData.facilities],
  );
  const { totals: badgeTotals } = useBadgeCounts(allIds, year, isAdmin);

  const handleNavigate = (page) => {
    const routes = {
      dashboard:    '/admin',
      saturazione:  '/occupazione',
      haccp:        '/master',
      documenti:    '/documenti',
      nc:           '/admin',
      report:       '/report',
      impostazioni: '/impostazioni',
    };
    navigate(routes[page] ?? '/admin');
  };

  const [activeTab,         setActiveTab]        = useState('libreria');
  const [showUploadModal,   setShowUploadModal]   = useState(false);
  const [selectedCategoria, setSelectedCategoria] = useState(null);

  // doc_master list
  const [docMasterList, setDocMasterList] = useState([]);
  const [loadingDocs,   setLoadingDocs]   = useState(false);

  // Filtri distribuzione tab
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroUdo,       setFiltroUdo]       = useState('');
  const [searchTitolo,    setSearchTitolo]    = useState('');
  const [ordinamento,     setOrdinamento]     = useState('recenti');

  // Modali
  //const [firmeModal,     setFirmeModal]     = useState(false);'//
  const [distribModal,   setDistribModal]   = useState({ open: false, master: null });
  const [accessiModal,   setAccessiModal]   = useState({ open: false, master: null });
  const [anteprimaModal, setAnteprimaModal] = useState({ open: false, master: null });
  const [revisioneModal, setRevisioneModal] = useState({ open: false, master: null });
  const [modificaModal,  setModificaModal]  = useState({ open: false, master: null });
  const [obsoletoModal,    setObsoletoModal]    = useState({ open: false, master: null });
  const [obsoletoLoading,  setObsoletoLoading]  = useState(false);
  const [pendingStruttura, setPendingStruttura] = useState([]);
  const [loadingPending,   setLoadingPending]   = useState(false);
  const [strutturaModal,   setStrutturaModal]   = useState({ open: false, doc: null });
  const [unreadByMaster,   setUnreadByMaster]   = useState({});

  const ricaricaDocMaster = useCallback(() => {
    setLoadingDocs(true);
    getDocMaster()
      .then(setDocMasterList)
      .catch(console.error)
      .finally(() => setLoadingDocs(false));
  }, []);

  const ricaricaPending = useCallback(() => {
    if (!isAdminRole) return;
    setLoadingPending(true);
    getDocStrutturaInRevisione()
      .then(setPendingStruttura)
      .catch(console.error)
      .finally(() => setLoadingPending(false));
  }, [isAdminRole]);

  // Carica doc_master all'avvio (solo admin/sede)
  useEffect(() => {
    if (isUserView) return;
    ricaricaDocMaster();
  }, [isUserView, ricaricaDocMaster]);

  // Carica doc struttura in revisione (solo admin)
  useEffect(() => {
    ricaricaPending();
  }, [ricaricaPending]);

  // Documenti attivi e obsoleti (split su stato)
  const docAttivi   = useMemo(() => docMasterList.filter(d => d.stato !== 'obsoleto'), [docMasterList]);
  const docObsoleti = useMemo(() => docMasterList.filter(d => d.stato === 'obsoleto'),  [docMasterList]);

  // Badge doc admin: A (pubblicati non distribuiti) + D (distribuiti con scadenza superata)
  useEffect(() => {
    if (!isAdminRole) return;
    const today = new Date().toISOString().split('T')[0];
    supabase
      .from('doc_istanze')
      .select('master_id')
      .then(({ data, error }) => {
        if (error) return;
        const distributedIds = new Set((data ?? []).map(r => r.master_id).filter(Boolean));
        const badge = {};
        for (const doc of docAttivi) {
          const isDistributed = distributedIds.has(doc.id);
          const isExpired     = doc.data_scadenza && doc.data_scadenza < today;
          if (!isDistributed || isExpired) badge[doc.id] = 1;
        }
        setUnreadByMaster(badge);
      })
      .catch(console.error);
  }, [isAdminRole, docAttivi]);

  const handleUploadSuccess = useCallback(() => {
    setShowUploadModal(false);
    ricaricaDocMaster();
  }, [ricaricaDocMaster]);

  const handleObsoletoConfirm = useCallback(async () => {
    if (!obsoletoModal.master) return;
    setObsoletoLoading(true);
    try {
      await setObsoleto(obsoletoModal.master.id, profile?.id);
      setObsoletoModal({ open: false, master: null });
      ricaricaDocMaster();
    } catch (err) {
      console.error(err);
    } finally {
      setObsoletoLoading(false);
    }
  }, [obsoletoModal.master, profile?.id, ricaricaDocMaster]);

  const handleRipristina = useCallback(async (doc) => {
    try {
      await updateDocMaster(doc.id, { stato: 'bozza' }, profile?.id, doc);
      ricaricaDocMaster();
    } catch (err) {
      console.error(err);
    }
  }, [profile?.id, ricaricaDocMaster]);

  // Conteggi per categoria (solo attivi)
  const docCounts = useMemo(() => {
    const counts = {};
    for (const doc of docAttivi) {
      counts[doc.categoria] = (counts[doc.categoria] ?? 0) + 1;
    }
    return counts;
  }, [docAttivi]);

  const isLibraryEmpty = docAttivi.length === 0;

  // Badge per categoria: conta i master che richiedono attenzione (A o D)
  const unreadByCategoria = useMemo(() => {
    const catCounts = {};
    for (const doc of docAttivi) {
      if (unreadByMaster[doc.id]) catCounts[doc.categoria] = (catCounts[doc.categoria] ?? 0) + 1;
    }
    return catCounts;
  }, [docAttivi, unreadByMaster]);

  // Filtro distribuzione (solo attivi)
  const docMasterFiltrati = useMemo(() => {
    return docAttivi
      .filter(doc => {
        if (filtroCategoria && doc.categoria !== filtroCategoria) return false;
        if (filtroUdo && !(doc.udo_applicabilita ?? []).includes(filtroUdo)) return false;
        if (searchTitolo) {
          const q = searchTitolo.toLowerCase();
          if (!doc.titolo?.toLowerCase().includes(q) && !doc.codice_documento?.toLowerCase().includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (ordinamento === 'az') return (a.titolo || '').localeCompare(b.titolo || '');
        if (ordinamento === 'za') return (b.titolo || '').localeCompare(a.titolo || '');
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      });
  }, [docAttivi, filtroCategoria, filtroUdo, searchTitolo, ordinamento]);

  // Lista doc nella categoria selezionata — drill-down (solo attivi)
  const docInCategoria = useMemo(() => {
    let list = docAttivi.filter(d => d.categoria === selectedCategoria);
    if (searchTitolo) {
      const q = searchTitolo.toLowerCase();
      list = list.filter(d =>
        d.titolo?.toLowerCase().includes(q) ||
        d.codice_documento?.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => {
      if (ordinamento === 'az') return (a.titolo || '').localeCompare(b.titolo || '');
      if (ordinamento === 'za') return (b.titolo || '').localeCompare(a.titolo || '');
      return new Date(b.created_at) - new Date(a.created_at);
    });
  }, [docAttivi, selectedCategoria, searchTitolo, ordinamento]);

  // UDO unici per filtro (solo attivi)
  const udoOptions = useMemo(() => {
    const set = new Set();
    for (const doc of docAttivi) {
      (doc.udo_applicabilita ?? []).forEach(u => set.add(u));
    }
    return [...set].sort();
  }, [docAttivi]);

  // ── Se director/sede → mostra vista documenti propria struttura ──

  if (isUserView) {
    return (
      <div className="min-h-screen bg-slate-100 pb-10 text-slate-900 font-sans">
        <AppHeader
          activePage="documenti"
          badgeCounts={badgeTotals}
          user={profile}
          onSignOut={signOut}
          onNavigate={handleNavigate}
        />
        {/* Tasto X per tornare indietro — stile HaccpFascicoloModal */}
        <button
          onClick={() => navigate(-1)}
          className="fixed top-4 right-4 z-40 p-2 text-slate-600/70 hover:text-slate-900 bg-white/80 shadow rounded-full transition-colors"
        >
          <X size={24} />
        </button>
        <main className="max-w-7xl mx-auto px-6 py-8">
          <DocMyDocumentiView />
        </main>
      </div>
    );
  }

  // ── Vista admin/superadmin ────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-100 pb-10 text-slate-900 font-sans">

      <AppHeader
        activePage="documenti"
        badgeCounts={badgeTotals}
        user={profile}
        onSignOut={signOut}
        onNavigate={handleNavigate}
      />

      {/* Context bar */}
      <div className="flex items-center justify-between px-5 py-2 bg-white border-b border-slate-200">
        <div className="flex-shrink-0">
          <h1 className="text-sm font-semibold text-slate-900">DocuMASTER · Gestione documentale</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Distribuzione e archiviazione documenti · {docAttivi.length} document{docAttivi.length === 1 ? 'o' : 'i'} attiv{docAttivi.length === 1 ? 'o' : 'i'}
          </p>
        </div>
        {isAdminRole && (
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase shadow hover:bg-indigo-700 transition-colors"
          >
            <Plus size={14} /> Nuovo documento
          </button>
        )}
      </div>

      {/* ── Tab bar ──────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-6">
        <div className="max-w-7xl mx-auto flex gap-1">
          {TABS_ADMIN.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`relative flex items-center gap-2 px-5 py-3.5 text-sm font-black uppercase tracking-wide
                border-b-2 transition-all
                ${activeTab === id
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-200'
                }`}
            >
              <Icon size={15} />
              {label}
              {id === 'strutture' && pendingStruttura.length > 0 && (
                <span className="absolute -top-0.5 right-1 min-w-[17px] h-[17px] rounded-full bg-rose-500
                  text-white text-[9px] font-black flex items-center justify-center px-1">
                  {pendingStruttura.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Contenuto ────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-6 py-8">

        {/* ── Tab Libreria ── */}
        {activeTab === 'libreria' && (
          <div>
            {selectedCategoria === 'OBS' ? (
              /* ── Drill-down documenti obsoleti ── */
              <div>
                <button
                  onClick={() => setSelectedCategoria(null)}
                  className="flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-slate-700 mb-6 transition-colors"
                >
                  <ArrowLeft size={15} /> Tutte le categorie
                </button>

                <div className="flex items-center gap-2.5 mb-6">
                  <div className="p-2 rounded-xl bg-slate-200">
                    <Archive size={20} className="text-slate-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-800">Documenti Obsoleti</h2>
                    <p className="text-sm text-slate-400">Documenti archiviati e fuori uso</p>
                  </div>
                </div>

                {loadingDocs ? (
                  <div className="flex justify-center py-12">
                    <Loader2 size={24} className="text-slate-300 animate-spin" />
                  </div>
                ) : docObsoleti.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                    <Archive size={32} className="text-slate-300 mb-3" />
                    <p className="font-black text-slate-500">Nessun documento obsoleto</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {docObsoleti.map(doc => (
                      <ObsDocCard
                        key={doc.id}
                        doc={doc}
                        onVisualizza={m => setAnteprimaModal({ open: true, master: m })}
                        onRipristina={handleRipristina}
                      />
                    ))}
                  </div>
                )}
              </div>

            ) : selectedCategoria ? (
              /* ── Drill-down categoria normale ── */
              <div>
                <button
                  onClick={() => setSelectedCategoria(null)}
                  className="flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-slate-700 mb-6 transition-colors"
                >
                  <ArrowLeft size={15} /> Tutte le categorie
                </button>

                {/* Barra ricerca + ordinamento */}
                <div className="flex items-center gap-3 mb-6 flex-wrap">
                  <div className="relative flex-1 max-w-sm">
                    <Search size={13} className="absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Cerca titolo o codice..."
                      value={searchTitolo}
                      onChange={e => setSearchTitolo(e.target.value)}
                      className="w-full pl-8 pr-4 py-2 rounded-xl border border-slate-200
                        bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                  </div>
                  <select
                    value={ordinamento}
                    onChange={e => setOrdinamento(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2
                      text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    <option value="recenti">Più recenti</option>
                    <option value="az">A → Z</option>
                    <option value="za">Z → A</option>
                  </select>
                  {(searchTitolo || ordinamento !== 'recenti') && (
                    <button
                      onClick={() => { setSearchTitolo(''); setOrdinamento('recenti'); }}
                      className="text-xs font-black text-slate-400 hover:text-slate-700
                        px-3 py-2 hover:bg-slate-100 rounded-xl transition-colors"
                    >
                      Reset
                    </button>
                  )}
                  <span className="text-xs font-bold text-slate-400 ml-auto">
                    {docInCategoria.length} document{docInCategoria.length === 1 ? 'o' : 'i'}
                  </span>
                </div>

                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2.5">
                    {CAT_MAP[selectedCategoria] && (() => {
                      const cat  = CAT_MAP[selectedCategoria];
                      const Icon = cat.Icon;
                      return (
                        <>
                          <div className={`p-2 rounded-xl ${cat.iconBg}`}>
                            <Icon size={20} className={cat.iconColor} />
                          </div>
                          <div>
                            <h2 className="text-xl font-black text-slate-800">{cat.label}</h2>
                            <p className="text-sm text-slate-400">{cat.description}</p>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {loadingDocs ? (
                  <div className="flex justify-center py-12">
                    <Loader2 size={24} className="text-indigo-400 animate-spin" />
                  </div>
                ) : docInCategoria.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                    <FolderOpen size={32} className="text-slate-300 mb-3" />
                    <p className="font-black text-slate-500">Nessun documento in questa categoria</p>
                    {isAdminRole && (
                      <button
                        onClick={() => setShowUploadModal(true)}
                        className="mt-5 flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5
                          rounded-xl text-sm font-black uppercase shadow hover:bg-indigo-700 transition-colors"
                      >
                        <Plus size={16} /> Carica documento
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {docInCategoria.map(doc => (
                      <DocMasterCard
                        key={doc.id}
                        doc={doc}
                        unreadCount={unreadByMaster[doc.id] ?? 0}
                        onAnteprima={m => setAnteprimaModal({ open: true, master: m })}
                        onDistribuisci={m => setDistribModal({ open: true, master: m })}
                        onAccessi={m => setAccessiModal({ open: true, master: m })}
                        onNuovaRevisione={isAdminRole ? m => setRevisioneModal({ open: true, master: m }) : undefined}
                        onModifica={isAdminRole ? m => setModificaModal({ open: true, master: m }) : undefined}
                        onObsoleto={isAdminRole ? m => setObsoletoModal({ open: true, master: m }) : undefined}
                      />
                    ))}
                  </div>
                )}
              </div>

            ) : (
              /* ── Griglia categorie ── */
              <>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-black text-slate-800">Libreria master</h2>
                    <p className="text-sm text-slate-400 mt-0.5">
                      Documenti modello centralizzati, distribuibili a tutte le strutture
                    </p>
                  </div>
                </div>

                {loadingDocs ? (
                  <div className="flex justify-center py-12">
                    <Loader2 size={24} className="text-indigo-400 animate-spin" />
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {CATEGORIE.map(cat => (
                        <CategoriaCard
                          key={cat.id}
                          cat={CAT_MAP[cat.id]}
                          docCount={cat.id === 'OBS' ? docObsoleti.length : (docCounts[cat.id] ?? 0)}
                          unreadCount={unreadByCategoria[cat.id] ?? 0}
                          onClick={() => setSelectedCategoria(cat.id)}
                        />
                      ))}
                    </div>

                    {isLibraryEmpty && (
                      <div className="mt-8 flex flex-col items-center justify-center py-10 text-center
                        bg-indigo-50 border-2 border-dashed border-indigo-200 rounded-2xl">
                        <div className="p-4 bg-white rounded-2xl shadow-sm mb-3">
                          <FolderOpen size={32} className="text-indigo-300" />
                        </div>
                        <p className="font-black text-slate-700 text-base mb-1">Libreria vuota</p>
                        <p className="text-slate-400 text-sm mb-5 max-w-xs">
                          Nessun documento master ancora caricato. Inizia ora.
                        </p>
                        {isAdminRole && (
                          <button
                            onClick={() => setShowUploadModal(true)}
                            className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5
                              rounded-xl text-sm font-black uppercase shadow hover:bg-indigo-700 transition-colors"
                          >
                            <Plus size={16} /> Carica primo documento
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Tab Distribuzione ── */}
        {activeTab === 'distribuzione' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-black text-slate-800">Distribuzione documenti</h2>
                <p className="text-sm text-slate-400 mt-0.5">
                  Distribuisci i documenti master alle strutture e monitora gli accessi
                </p>
              </div>
            </div>

            {/* Filtri */}
            <div className="flex items-center gap-3 mb-6 flex-wrap">
              <Filter size={14} className="text-slate-400 shrink-0" />

              {/* Ricerca testo */}
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchTitolo}
                  onChange={e => setSearchTitolo(e.target.value)}
                  placeholder="Cerca titolo o codice…"
                  className="rounded-xl border border-slate-200 bg-white pl-8 pr-3 py-2 text-sm font-medium
                    outline-none focus:ring-2 focus:ring-indigo-400 transition-all w-52"
                />
              </div>

              <select
                value={filtroCategoria}
                onChange={e => setFiltroCategoria(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold
                  outline-none focus:ring-2 focus:ring-indigo-400 transition-all"
              >
                <option value="">Tutte le categorie</option>
                {CATEGORIE.map(c => (
                  <option key={c.id} value={c.id}>{c.codice} — {c.nome}</option>
                ))}
              </select>

              {udoOptions.length > 0 && (
                <select
                  value={filtroUdo}
                  onChange={e => setFiltroUdo(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold
                    outline-none focus:ring-2 focus:ring-indigo-400 transition-all"
                >
                  <option value="">Tutte le UDO</option>
                  {udoOptions.map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              )}

              {/* Ordinamento */}
              <select
                value={ordinamento}
                onChange={e => setOrdinamento(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold
                  outline-none focus:ring-2 focus:ring-indigo-400 transition-all ml-auto"
              >
                <option value="recenti">Più recenti</option>
                <option value="az">A → Z</option>
                <option value="za">Z → A</option>
              </select>

              {(filtroCategoria || filtroUdo || searchTitolo) && (
                <button
                  onClick={() => { setFiltroCategoria(''); setFiltroUdo(''); setSearchTitolo(''); }}
                  className="text-xs font-bold text-slate-400 hover:text-slate-600 px-2 transition-colors"
                >
                  Resetta filtri
                </button>
              )}
            </div>

            {loadingDocs ? (
              <div className="flex justify-center py-12">
                <Loader2 size={24} className="text-indigo-400 animate-spin" />
              </div>
            ) : docMasterFiltrati.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 bg-slate-50
                border-2 border-dashed border-slate-200 rounded-2xl text-center">
                <FileText size={32} className="text-slate-300 mb-3" />
                <p className="font-black text-slate-400">Nessun documento da distribuire</p>
                {isLibraryEmpty && isAdminRole && (
                  <button
                    onClick={() => { setActiveTab('libreria'); setShowUploadModal(true); }}
                    className="mt-5 flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5
                      rounded-xl text-sm font-black uppercase shadow hover:bg-indigo-700 transition-colors"
                  >
                    <Plus size={16} /> Carica il primo documento
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {docMasterFiltrati.map(doc => (
                  <DocMasterCard
                    key={doc.id}
                    doc={doc}
                    unreadCount={unreadByMaster[doc.id] ?? 0}
                    onAnteprima={m => setAnteprimaModal({ open: true, master: m })}
                    onDistribuisci={m => setDistribModal({ open: true, master: m })}
                    onAccessi={m => setAccessiModal({ open: true, master: m })}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Tab Strutture ── */}
        {activeTab === 'strutture' && (
          <div className="space-y-10">
            <DocStrutturaPanel />

            {/* Documenti struttura da verificare */}
            {(loadingPending || pendingStruttura.length > 0) && (
              <div>
                <div className="flex items-center gap-2.5 mb-5">
                  <div className="p-2 rounded-xl bg-amber-100">
                    <Shield size={18} className="text-amber-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-800">Documenti struttura da verificare</h2>
                    <p className="text-sm text-slate-400 mt-0.5">
                      {loadingPending ? 'Caricamento…' : `${pendingStruttura.length} documento/i in attesa di verifica Qualità`}
                    </p>
                  </div>
                </div>

                {loadingPending ? (
                  <div className="flex justify-center py-10">
                    <Loader2 size={24} className="text-amber-400 animate-spin" />
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-5 py-3 text-left text-[11px] font-black text-slate-500 uppercase tracking-wider">Struttura</th>
                          <th className="px-4 py-3 text-left text-[11px] font-black text-slate-500 uppercase tracking-wider">Titolo</th>
                          <th className="px-4 py-3 text-left text-[11px] font-black text-slate-500 uppercase tracking-wider">Categoria</th>
                          <th className="px-4 py-3 text-left text-[11px] font-black text-slate-500 uppercase tracking-wider">Data invio</th>
                          <th className="px-4 py-3 text-center text-[11px] font-black text-slate-500 uppercase tracking-wider">Azioni</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {pendingStruttura.map(doc => (
                          <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-5 py-3 font-bold text-slate-800 text-sm">
                              {doc.facilities?.name ?? '—'}
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-700 max-w-[200px] truncate">
                              {doc.titolo}
                            </td>
                            <td className="px-4 py-3">
                              {doc.categoria && (
                                <span className="text-[11px] font-black bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg">
                                  {doc.categoria}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-500">
                              {doc.updated_at
                                ? new Date(doc.updated_at).toLocaleDateString('it-IT')
                                : '—'}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => setStrutturaModal({ open: true, doc })}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase
                                  bg-teal-600 text-white hover:bg-teal-700 transition-colors mx-auto shadow-sm"
                              >
                                <Eye size={12} /> Visualizza e approva
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Tab Firme ── */}
        {activeTab === 'firme' && (
          <DocFirmeModal onClose={() => setActiveTab('libreria')} />
        )}

        {/* ── Tab Impostazioni ── */}
        {activeTab === 'impostazioni' && <ComingSoon label="Impostazioni" />}

      </main>

      {/* ── Modali ───────────────────────────────────────── */}

      {showUploadModal && isAdminRole && (
        <DocMasterModal
          onClose={() => setShowUploadModal(false)}
          onSuccess={handleUploadSuccess}
        />
      )}

      {anteprimaModal.open && anteprimaModal.master && (
        <DocAnteprimaModal
          master={anteprimaModal.master}
          onClose={() => setAnteprimaModal({ open: false, master: null })}
          onGoDist={() => { setActiveTab('distribuzione'); }}
          facilityId={isUserView ? userFacilityId : undefined}
        />
      )}

      {distribModal.open && distribModal.master && (
        <DocDistribuzioneModal
          master={distribModal.master}
          onClose={() => setDistribModal({ open: false, master: null })}
          onDistributed={() => {
            // Non chiudiamo: il modal mostra la schermata risultati con pulsante Chiudi
            // Aggiorniamo solo la lista in background
            getDocMaster().then(setDocMasterList).catch(console.error);
          }}
        />
      )}

      {accessiModal.open && accessiModal.master && (
        <DocAccessiModal
          master={accessiModal.master}
          onClose={() => setAccessiModal({ open: false, master: null })}
        />
      )}

      {revisioneModal.open && revisioneModal.master && (
        <DocMasterModal
          masterEsistente={revisioneModal.master}
          onClose={() => setRevisioneModal({ open: false, master: null })}
          onSuccess={() => {
            setRevisioneModal({ open: false, master: null });
            ricaricaDocMaster();
          }}
        />
      )}

      {modificaModal.open && modificaModal.master && (
        <DocMasterModal
          masterDaModificare={modificaModal.master}
          onClose={() => setModificaModal({ open: false, master: null })}
          onSuccess={() => {
            setModificaModal({ open: false, master: null });
            ricaricaDocMaster();
          }}
        />
      )}

      {/* Modale conferma Obsoleto */}
      {obsoletoModal.open && obsoletoModal.master && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

            <div className="px-6 pt-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-red-100 rounded-xl">
                  <Archive size={20} className="text-red-600" />
                </div>
                <h3 className="text-base font-black text-slate-800 uppercase tracking-wider">
                  Archivia documento
                </h3>
              </div>
              <p className="text-sm font-bold text-slate-700 mb-1">
                Sei sicuro di voler archiviare questo documento come obsoleto?
              </p>
              <p className="text-[11px] text-slate-400 font-medium leading-relaxed mb-1">
                Il documento non sarà più visibile nella libreria attiva.
              </p>
              <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                Verrà conservato nella sezione <span className="font-black text-slate-500">Documenti Obsoleti</span>.
              </p>
              <div className="mt-4 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                <p className="text-xs font-black text-slate-700 truncate">{obsoletoModal.master.titolo}</p>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">{obsoletoModal.master.codice_documento}</p>
              </div>
            </div>

            <div className="px-6 pb-6 pt-5 flex justify-end gap-3">
              <button
                onClick={() => setObsoletoModal({ open: false, master: null })}
                disabled={obsoletoLoading}
                className="px-5 py-2.5 rounded-xl text-sm font-black uppercase text-slate-500 hover:bg-slate-100 transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={handleObsoletoConfirm}
                disabled={obsoletoLoading}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black uppercase
                  text-white bg-red-600 hover:bg-red-700 shadow transition-colors disabled:opacity-50"
              >
                {obsoletoLoading
                  ? <><Loader2 size={14} className="animate-spin" /> Archiviazione…</>
                  : <><Archive size={14} /> Rendi obsoleto</>
                }
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Modale DocStrutturaProprioModal — revisione qualità */}
      {strutturaModal.open && strutturaModal.doc && (
        <DocStrutturaProprioModal
          facilityId={strutturaModal.doc.facility_id}
          docEsistente={strutturaModal.doc}
          readOnly={true}
          onClose={() => setStrutturaModal({ open: false, doc: null })}
          onSaved={() => {
            setStrutturaModal({ open: false, doc: null });
            ricaricaPending();
          }}
        />
      )}

    </div>
  );
}
