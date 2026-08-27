// src/views/VerbaliIspettiviPage.jsx
// Vista "sede": tutti i verbali ispettivi cross-struttura, filtrabili, con
// statistiche aggregate. RLS scopa già i dati per ruolo (admin/sede/board
// vedono tutto, director solo le proprie strutture) — stesso pattern di
// NonConformitaPage.jsx, nessun filtro esplicito per facility_id in query.
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileWarning, Search } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useDashboardData } from '../hooks/useDashboardData';
import { useBadgeCounts } from '../hooks/useBadgeCounts';
import AppHeader from '../components/AppHeader';
import UniversalFilterBar, { EMPTY_FILTERS, applyFacilityFilters } from '../components/cruscotto/UniversalFilterBar';
import VerbaleReviewModal from '../components/verbali/VerbaleReviewModal';
import { fetchAllVerbali } from '../services/verbaliIspettiviService';

const TIPO_LABEL = {
  sopralluogo_vigilanza: 'Sopralluogo di Vigilanza',
  controllo_appropriatezza: 'Controllo Appropriatezza',
  altro: 'Ispezione',
};

function StatTile({ label, value, tone = 'gray' }) {
  const tones = {
    gray:  'text-slate-700',
    amber: 'text-amber-600',
    red:   'text-red-600',
    green: 'text-emerald-600',
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">{label}</p>
      <p className={`text-2xl font-black ${tones[tone]}`}>{value}</p>
    </div>
  );
}

function Badge({ variant, children }) {
  const styles = {
    gray:  'bg-slate-100 text-slate-500 border-slate-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    red:   'bg-red-50 text-red-700 border-red-200',
  };
  return <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border whitespace-nowrap ${styles[variant]}`}>{children}</span>;
}

function statoBadge(v) {
  if (v.stato_elaborazione_ai === 'errore') return <Badge variant="red">⚠ Errore analisi</Badge>;
  if (v.stato_elaborazione_ai === 'in_coda' || v.stato_elaborazione_ai === 'in_corso') return <Badge variant="gray">⏳ Analisi in corso</Badge>;
  if (v.stato_revisione === 'confermato') return <Badge variant="green">✓ Confermato</Badge>;
  return <Badge variant="amber">⏳ Da rivedere</Badge>;
}

export default function VerbaliIspettiviPage() {
  const navigate = useNavigate();
  const { isAdmin, profile, signOut } = useAuth();
  const [year] = useState(new Date().getFullYear());
  const { data } = useDashboardData(year);
  const { facilities, companies, udos } = data;

  const allIds = useMemo(() => (facilities ?? []).filter(f => !f.is_suspended).map(f => f.id), [facilities]);
  const { totals: badgeTotals } = useBadgeCounts(allIds, year, isAdmin);

  const handleNavigate = (page) => {
    const routes = {
      dashboard: '/admin', saturazione: '/occupazione', haccp: '/master',
      documenti: '/documenti', nc: '/non-conformita', verifiche: '/verifiche',
      report: '/report', impostazioni: '/impostazioni',
    };
    navigate(routes[page] ?? '/admin');
  };

  const [verbali, setVerbali] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [search, setSearch] = useState('');
  const [enteFilter, setEnteFilter] = useState('all');
  const [reviewId, setReviewId] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchAllVerbali();
      setVerbali(rows);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const filteredFacilityIds = useMemo(
    () => new Set(applyFacilityFilters(facilities, filters).map(f => f.id)),
    [facilities, filters]
  );

  const enti = useMemo(() => [...new Set(verbali.map(v => v.ente).filter(Boolean))].sort(), [verbali]);

  const filtered = useMemo(() => verbali.filter(v => {
    if (!filteredFacilityIds.has(v.facility_id)) return false;
    if (enteFilter !== 'all' && v.ente !== enteFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = `${v.numero_verbale ?? ''} ${v.facilities?.name ?? ''} ${v.ente ?? ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }), [verbali, filteredFacilityIds, enteFilter, search]);

  const oggi = new Date().toISOString().slice(0, 10);
  const stats = useMemo(() => {
    const daRivedere = filtered.filter(v => v.stato_revisione !== 'confermato').length;
    const rispostePendenti = filtered.filter(v => ['da_rispondere', 'bozza_predisposta'].includes(v.stato_risposta) && v.scadenza_risposta);
    const scadute = rispostePendenti.filter(v => v.scadenza_risposta < oggi).length;
    const inScadenza = rispostePendenti.length - scadute;
    return { totale: filtered.length, daRivedere, scadute, inScadenza };
  }, [filtered, oggi]);

  const reviewFacility = reviewId ? facilities.find(f => f.id === verbali.find(v => v.id === reviewId)?.facility_id) : null;

  return (
    <div className="min-h-screen bg-slate-100 pb-10 text-slate-900 font-sans">
      <AppHeader activePage="verbali" badgeCounts={badgeTotals} user={profile} onSignOut={signOut} onNavigate={handleNavigate} />

      <main className="px-6 py-6 max-w-6xl mx-auto space-y-5">
        <div className="flex items-center gap-2">
          <FileWarning size={18} className="text-slate-400" />
          <h1 className="font-black text-slate-800 text-lg">Verbali Ispettivi</h1>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatTile label="Verbali (filtro corrente)" value={stats.totale} />
          <StatTile label="Da rivedere" value={stats.daRivedere} tone={stats.daRivedere > 0 ? 'amber' : 'gray'} />
          <StatTile label="Risposte in scadenza (15gg)" value={stats.inScadenza} tone={stats.inScadenza > 0 ? 'amber' : 'gray'} />
          <StatTile label="Risposte scadute" value={stats.scadute} tone={stats.scadute > 0 ? 'red' : 'gray'} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <UniversalFilterBar facilities={facilities} companies={companies} udos={udos} value={filters} onChange={setFilters} year={year} />
          <select value={enteFilter} onChange={e => setEnteFilter(e.target.value)}
            className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium outline-none focus:border-emerald-400">
            <option value="all">Tutti gli enti</option>
            {enti.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cerca numero verbale, struttura, ente…"
              className="bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs font-medium outline-none focus:border-emerald-400 min-w-[220px]"
            />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-400 animate-pulse font-medium">Caricamento...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-slate-400 text-sm font-medium">Nessun verbale trovato per questo filtro</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filtered.map(v => (
              <button
                key={v.id}
                onClick={() => setReviewId(v.id)}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border border-slate-200 bg-white hover:border-indigo-300 transition-colors text-left"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-700 truncate">
                    {v.facilities?.name || 'Struttura sconosciuta'} — Verbale N. {v.numero_verbale || '—'}
                  </p>
                  <p className="text-xs text-slate-400 truncate">
                    {TIPO_LABEL[v.tipo_ispezione] || 'Ispezione'} · {v.ente || 'Ente non identificato'}
                    {v.data_sopralluogo && ` · ${v.data_sopralluogo}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {statoBadge(v)}
                  {v.scadenza_risposta && v.stato_risposta !== 'inviata' && v.stato_risposta !== 'non_richiesta' && (
                    <Badge variant={v.scadenza_risposta < oggi ? 'red' : 'amber'}>Risposta entro {v.scadenza_risposta}</Badge>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      {reviewId && reviewFacility && (
        <VerbaleReviewModal
          verbaleId={reviewId}
          facility={reviewFacility}
          onClose={() => { setReviewId(null); reload(); }}
          onConfirmed={() => { setReviewId(null); reload(); }}
        />
      )}
    </div>
  );
}
