/**
 * src/views/DirectorApp.jsx  —  v2
 * Vista per direttori con PIÙ strutture assegnate.
 * Se ha una sola struttura, AppRouter la bypassa e va diretto a /facility/:id
 *
 * MODIFICHE v2:
 *  - Sostituito useDashboardData (carica tutto il gruppo) con
 *    useDirectorData(facilityIds, year) che carica solo le strutture assegnate.
 *  - Aggiunto banner errori per problemi di rete.
 *  - FacilitySelectionCard invariata (era già corretta).
 */
import React, { useMemo } from 'react';
import { useNavigate }         from 'react-router-dom';
import { PawPrint, LogOut, Building2, Activity, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { useAuth }               from '../contexts/AuthContext';
import { useDirectorData }       from '../hooks/useDirectorData';
import { useBadgeCounts }        from '../hooks/useBadgeCounts';
import { enrichFacilitiesData }  from '../utils/statusCalculator';

export default function DirectorApp() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const year     = new Date().getFullYear();

  const facilityIds = profile?.accessibleFacilityIds ?? [];
  const { data, loading, errors } = useDirectorData(facilityIds, year);
  const { perFacility: badgePerFacility } = useBadgeCounts(facilityIds);

  const myFacilities = useMemo(() =>
    enrichFacilitiesData(data.facilities, data.surveys, data.kpiRecords, year, data.udos),
    [data, year]
  );

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <span className="font-black text-slate-400 uppercase tracking-[0.2em] animate-pulse">
          Caricamento...
        </span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 font-sans">

      {/* Header */}
      <header className="bg-white border-b px-6 py-4 shadow-sm sticky top-0 z-30">
        <div className="flex justify-between items-center max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-xl text-white shadow">
              <PawPrint size={20} />
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight">
                Qualità <span className="text-indigo-600">GRUPPO OVER</span>
              </h1>
              <p className="text-xs text-slate-400 font-medium">
                {profile?.full_name || profile?.email}
              </p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="flex items-center gap-2 text-sm text-rose-500 hover:bg-rose-50 px-3 py-2 rounded-xl transition-colors"
          >
            <LogOut size={16} /> Esci
          </button>
        </div>
      </header>

      {/* Contenuto */}
      <main className="max-w-4xl mx-auto px-6 py-10">

        {/* Banner errori di rete */}
        {errors.length > 0 && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <p className="text-sm font-bold text-red-700">
              Errore nel caricamento dei dati: {errors.join(', ')}
            </p>
          </div>
        )}

        <div className="mb-8">
          <h2 className="text-2xl font-black text-slate-800">Le tue strutture</h2>
          <p className="text-slate-500 mt-1 text-sm">Seleziona una struttura per gestirla</p>
        </div>

        {myFacilities.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <Building2 size={40} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 font-medium">Nessuna struttura trovata.</p>
            <p className="text-slate-400 text-sm mt-1">Contatta l'amministratore di sistema.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {myFacilities.map(f => (
              <FacilitySelectionCard
                key={f.id}
                facility={f}
                onClick={() => navigate(`/facility/${f.id}`)}
                badge={badgePerFacility[f.id]}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function FacilitySelectionCard({ facility: f, onClick, badge }) {
  const statusConfig = f.isGreen
    ? { Icon: CheckCircle2, color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', label: 'In regola' }
    : f.isRed
    ? { Icon: AlertTriangle, color: 'text-red-500',    bg: 'bg-red-50',     border: 'border-red-200',     label: 'Da avviare' }
    : { Icon: Activity,      color: 'text-indigo-600', bg: 'bg-indigo-50',  border: 'border-indigo-200',  label: 'In corso' };

  const { Icon } = statusConfig;

  const badgeTotal = badge?.total ?? 0;
  const badgeBg    = badge?.haccpRossi > 0 ? 'bg-rose-500'
    : badge?.haccp > 0 ? 'bg-amber-500'
    : 'bg-blue-500';

  return (
    <button
      onClick={onClick}
      className="relative bg-white rounded-2xl border border-slate-200 p-5 text-left hover:shadow-md hover:border-indigo-300 transition-all group"
      style={{ borderTopWidth: '4px', borderTopColor: f.udo_color || '#cbd5e1' }}
    >
      {badgeTotal > 0 && (
        <span className={`absolute -top-2 -right-2 min-w-[22px] h-[22px] ${badgeBg} text-white text-[11px] font-black rounded-full flex items-center justify-center px-1 leading-none shadow-md z-10`}>
          {badgeTotal > 99 ? '99+' : badgeTotal}
        </span>
      )}
      <div className="flex justify-between items-start mb-3">
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${statusConfig.bg} ${statusConfig.color} ${statusConfig.border} border`}>
          <Icon size={12} />
          {statusConfig.label}
        </div>
        {!f.isKpiGreen && (
          <span className="text-[10px] font-bold bg-amber-50 text-amber-600 px-2 py-1 rounded-lg border border-amber-200 flex items-center gap-1">
            <Clock size={10} /> KPI
          </span>
        )}
      </div>

      <h3 className="font-black text-slate-800 text-sm leading-tight mb-1 group-hover:text-indigo-700 transition-colors">
        {f.name}
      </h3>
      <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">
        {f.udo_name || '—'} {f.region ? `· ${f.region}` : ''}
      </p>

      {f.bed_count > 0 && (
        <p className="text-xs text-slate-500 mt-2">
          <span className="font-bold text-indigo-600">{f.bed_count}</span> posti letto
        </p>
      )}

      <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
        <span className="text-xs font-black text-indigo-600 uppercase tracking-widest group-hover:translate-x-1 transition-transform inline-block">
          Gestisci →
        </span>
      </div>
    </button>
  );
}
