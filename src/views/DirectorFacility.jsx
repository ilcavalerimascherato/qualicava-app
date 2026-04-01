/**
 * src/views/DirectorFacility.jsx  —  v3
 * Dashboard completa per il direttore di una struttura specifica.
 * Tab: Panoramica · KPI · Survey · Analisi Survey · Non Conformità · Benchmark
 *
 * MODIFICHE v3:
 *  - FIX CRITICO: superadmin/admin che accede via /facility/:id usava
 *    useDirectorData con facilityIds=[] → query disabled → facility null.
 *    Ora il hook di caricamento si sceglie in base al ruolo:
 *      • admin/superadmin/sede → useDashboardData (carica tutto, ha accesso globale)
 *      • director              → useDirectorData (carica solo le strutture assegnate)
 *    L'invalidazione segue la stessa logica.
 */
import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import {
  PawPrint, LogOut, ArrowLeft, Activity, BarChart3, Database,
  AlertTriangle, TrendingUp,
  Plus, Save, Loader2, X
} from 'lucide-react';

import { useAuth }                           from '../contexts/AuthContext';
import { useModals }                         from '../contexts/ModalContext';
import { useDirectorData, useDirectorInvalidate } from '../hooks/useDirectorData';
import { useDashboardData, useInvalidate }   from '../hooks/useDashboardData';
import { enrichFacilitiesData }              from '../utils/statusCalculator';
import { supabase }                          from '../supabaseClient';
import { detectAnomalies }                   from '../utils/kpiAnomalyEngine';
import NcFormModal                           from '../components/NcFormModal';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, LineChart, Line,
  Legend, Cell, PieChart, Pie
} from 'recharts';
import { KPI_RULES, isNumericSettore } from '../config/kpiRules';
import { computeKpiValue }  from '../utils/kpiFormulaEngine';
import { getTimeHorizon }   from '../utils/kpiTimeHorizon';
import KpiManagerModal      from '../components/KpiManagerModal';
import DataImportModal      from '../components/DataImportModal';
import AnalyticsModal       from '../components/AnalyticsModal';

const TABS = [
  { id: 'overview',         label: 'Panoramica',     Icon: Activity      },
  { id: 'kpi',              label: 'KPI Mensili',    Icon: BarChart3     },
  { id: 'surveys',          label: 'Survey',         Icon: Database      },
  { id: 'analysis',         label: 'Analisi Survey', Icon: BarChart3     },
  { id: 'non_conformities', label: 'Non Conformità', Icon: AlertTriangle },
  { id: 'benchmark',        label: 'Benchmark',      Icon: TrendingUp    },
];

// FIX v3: hook wrapper — sceglie la sorgente dati in base al ruolo.
// Entrambi i hook vengono chiamati incondizionatamente (rules of hooks),
// ma solo quello corretto per il ruolo viene effettivamente usato.
function useAdaptiveData(isAdminUser, facilityIds, year) {
  const adminData     = useDashboardData(year);
  const adminInval    = useInvalidate();
  const directorData  = useDirectorData(facilityIds, year);
  const directorInval = useDirectorInvalidate(facilityIds, year);

  if (isAdminUser) {
    return {
      data:     adminData.data,
      loading:  adminData.loading,
      errors:   adminData.errors,
      invalidate: {
        surveys:    () => adminInval.surveys(year),
        kpiRecords: () => adminInval.kpiRecords(year),
        facilities: () => adminInval.facilities(),
      },
    };
  }
  return {
    data:       directorData.data,
    loading:    directorData.loading,
    errors:     directorData.errors,
    invalidate: directorInval,
  };
}

export default function DirectorFacility() {
  const { facilityId }                = useParams();
  const navigate                      = useNavigate();
  const { profile, isAdmin, signOut, can } = useAuth();
  const { modals, open, close }       = useModals();
  const [activeTab, setActiveTab]     = useState('overview');
  const [ncEditId, setNcEditId]       = useState(null);
  const [dataTarget, setDataTarget]   = useState(null);
  const year = new Date().getFullYear();

  // FIX v3: admin → useDashboardData (accesso globale)
  //         director → useDirectorData (solo strutture assegnate)
  const facilityIds = profile?.accessibleFacilityIds ?? [];
  const { data, loading, errors, invalidate } = useAdaptiveData(isAdmin, facilityIds, year);

  // Struttura corrente arricchita
  const facility = useMemo(() => {
    const raw = data.facilities.find(f => String(f.id) === String(facilityId));
    if (!raw) return null;
    return enrichFacilitiesData([raw], data.surveys, data.kpiRecords, year, data.udos)[0] ?? null;
  }, [data, facilityId, year]);

  // Survey della struttura corrente
  const facilitySurveys = useMemo(() =>
    data.surveys.filter(s =>
      String(s.facility_id) === String(facilityId) ||
      (!s.facility_id && s.company_id === facility?.company_id)
    ), [data.surveys, facilityId, facility]);

  const hasMultipleFacilities = facilityIds.length > 1;

  const handleDataClick = (type) => {
    const hasData = facilitySurveys.some(s => s.type === type);
    setDataTarget({ facility, type });
    open(hasData ? 'analytics' : 'dataImport');
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <span className="font-black text-slate-400 uppercase tracking-[0.2em] animate-pulse">
          Caricamento...
        </span>
      </div>
    );
  }

  if (!facility) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <p className="text-slate-500 font-medium mb-3">
            Struttura non trovata o accesso non autorizzato.
          </p>
          <button onClick={() => navigate('/')} className="text-indigo-600 font-bold text-sm hover:underline">
            ← Torna alla home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 font-sans">
      <Toaster position="top-right" />

      {/* Header */}
      <header className="bg-white border-b px-6 py-4 sticky top-0 z-30 shadow-sm">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-xl text-white shadow">
              <PawPrint size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                {(hasMultipleFacilities || can('viewAllStructures')) && (
                  <Link
                    to={can('viewAllStructures') ? '/admin' : '/director'}
                    className="text-slate-400 hover:text-indigo-600 transition-colors"
                  >
                    <ArrowLeft size={16} />
                  </Link>
                )}
                <h1 className="text-base font-black tracking-tight" style={{ color: facility.udo_color || '#4f46e5' }}>
                  {facility.name}
                </h1>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                {facility.udo_name} {facility.region ? `· ${facility.region}` : ''}
                {facility.bed_count > 0 ? ` · ${facility.bed_count} posti letto` : ''}
              </p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2">
            <StatusPill label="Survey" isOk={facility.isGreen}    isPartial={facility.isYellow} />
            <StatusPill label="KPI"    isOk={facility.isKpiGreen} />
          </div>

          <button
            onClick={signOut}
            className="flex items-center gap-2 text-sm text-rose-500 hover:bg-rose-50 px-3 py-2 rounded-xl transition-colors"
          >
            <LogOut size={16} /> Esci
          </button>
        </div>

        {/* Banner errori */}
        {errors.length > 0 && (
          <div className="mb-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <p className="text-xs font-bold text-red-700">
              Errore dati: {errors.join(', ')}
            </p>
          </div>
        )}

        {/* Tab nav */}
        <nav className="flex gap-1 overflow-x-auto pb-1">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === id
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </nav>
      </header>

      {/* Contenuto tab */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        {activeTab === 'overview' && (
          <OverviewTab facility={facility} surveys={facilitySurveys} year={year} />
        )}
        {activeTab === 'kpi' && (
          <KpiTab
            facility={facility}
            kpiRecords={data.kpiRecords}
            year={year}
            onOpenManager={() => open('kpiManager')}
          />
        )}
        {activeTab === 'surveys' && (
          <SurveysTab
            facility={facility}
            surveys={facilitySurveys}
            onDataClick={handleDataClick}
          />
        )}
        {activeTab === 'analysis' && (
          <SurveyAnalysisTab facility={facility} surveys={facilitySurveys} />
        )}
        {activeTab === 'non_conformities' && (
          <NonConformitiesTab
            facility={facility}
            year={year}
            profile={profile}
            onNew={() => { setNcEditId(null); open('nonConformity'); }}
            onEdit={(id) => { setNcEditId(id); open('nonConformity'); }}
          />
        )}
        {activeTab === 'benchmark' && (
          <BenchmarkTab facility={facility} kpiRecords={data.kpiRecords} year={year} />
        )}
      </main>

      {/* Modal */}
      <KpiManagerModal
        key={`kpi-${facility.id}`}
        isOpen={modals.kpiManager}
        onClose={() => close('kpiManager')}
        facility={facility}
        year={year}
        onUpdateSuccess={() => invalidate.kpiRecords()}
      />

      {dataTarget && (
        <>
          <DataImportModal
            isOpen={modals.dataImport}
            onClose={() => close('dataImport')}
            facility={dataTarget.facility}
            type={dataTarget.type}
            year={year}
            onUploadSuccess={() => { invalidate.surveys(); toast.success('Dati caricati'); }}
          />
          <AnalyticsModal
            isOpen={modals.analytics}
            onClose={() => close('analytics')}
            facility={dataTarget.facility}
            type={dataTarget.type}
            surveys={facilitySurveys}
            facilities={data.facilities}
            udos={data.udos}
            onOpenImport={() => { close('analytics'); open('dataImport'); }}
            onUpdateSuccess={() => invalidate.surveys()}
          />
        </>
      )}

      {modals.nonConformity && (
        <NcFormModal
          key={ncEditId || 'new-nc'}
          isOpen={modals.nonConformity}
          facility={facility}
          year={year}
          profile={profile}
          ncId={ncEditId}
          onClose={() => { close('nonConformity'); setNcEditId(null); }}
          onSaved={(stato) => {
            close('nonConformity');
            setNcEditId(null);
            invalidate.kpiRecords();
            toast.success(
              stato === 'Chiuso'  ? 'NC chiusa' :
              stato === 'Pending' ? 'NC aggiornata a Pending' :
              'NC registrata'
            );
          }}
        />
      )}
    </div>
  );
}

// ── Sub-componenti ─────────────────────────────────────────────
// (invariati rispetto alla versione originale — solo import cambiati)

function StatusPill({ label, isOk, isPartial }) {
  const cfg = isOk
    ? { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-400', state: 'OK' }
    : isPartial
    ? { bg: 'bg-indigo-100',  text: 'text-indigo-700',  dot: 'bg-indigo-500',  state: 'Parziale' }
    : { bg: 'bg-red-100',     text: 'text-red-700',     dot: 'bg-red-400',     state: 'Da fare' };
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${cfg.bg} ${cfg.text}`}>
      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
      {label}: {cfg.state}
    </div>
  );
}

const ORG_CONFIG = [
  { key: 'director',            emailKey: 'email_direzione',           label: 'Direttore',      icon: '👤' },
  { key: 'director_sanitario',  emailKey: 'email_sanitario',           label: 'Dir. Sanitario', icon: '⚕️' },
  { key: 'referente_struttura', emailKey: 'email_referente_struttura', label: 'Ref. Struttura', icon: '🏠' },
  { key: 'referent',            emailKey: 'email_qualita',             label: 'Ref. Qualità',   icon: '✅' },
];

function OrgStatoPill({ email, userProfiles }) {
  if (!email) return (
    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-lg">
      Nessuna mail
    </span>
  );
  const profile = userProfiles.find(p => p.email === email);
  if (!profile) return (
    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg">
      ● Da invitare
    </span>
  );
  const hasSignedIn = profile.last_sign_in_at || profile.updated_at !== profile.created_at;
  if (hasSignedIn) return (
    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">
      ● Attivo
    </span>
  );
  return (
    <span className="text-[10px] font-bold text-orange-700 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-lg">
      ● In attesa
    </span>
  );
}

function InvitoPanel({ figura, email, facilityId, companyId, onClose, onSuccess }) {
  const [status, setStatus] = useState(null); // null | 'sending' | 'sent' | 'error'
  const [msg, setMsg]       = useState('');

  const handleInvita = async () => {
    setStatus('sending');
    try {
      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: {
          email,
          fullName:    figura,
          role:        'director',
          companyId:   companyId || null,
          facilityIds: [facilityId],
        },
      });
      if (error || data?.error) throw new Error(error?.message || data?.error);
      setStatus('sent');
      setMsg(data.message || `Invito inviato a ${email}`);
      setTimeout(() => { onClose(); if (onSuccess) onSuccess(); }, 2500);
    } catch (err) {
      setStatus('error');
      setMsg(err.message);
    }
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-2">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-black text-amber-700 uppercase tracking-widest">Invita {figura}</p>
        <button onClick={onClose} className="text-amber-400 hover:text-amber-700"><X size={14} /></button>
      </div>

      {status === null && (
        <>
          <p className="text-xs text-slate-600 mb-3">
            Verrà creato un account per <span className="font-bold">{email}</span> con ruolo Direttore.
            Riceverà un'email per impostare la password.
          </p>
          <button onClick={handleInvita}
            className="flex items-center gap-2 bg-emerald-600 text-white text-xs font-black px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors">
            ✉ Invia invito
          </button>
        </>
      )}
      {status === 'sending' && (
        <p className="text-xs font-bold text-amber-700 animate-pulse">Creazione account in corso...</p>
      )}
      {status === 'sent' && (
        <p className="text-xs font-bold text-emerald-700">✓ {msg}</p>
      )}
      {status === 'error' && (
        <div>
          <p className="text-xs font-bold text-red-700 mb-2">✗ {msg}</p>
          <p className="text-xs text-slate-500">
            Se il problema persiste, crea l'utente manualmente da{' '}
            <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer"
              className="text-indigo-600 hover:underline">Supabase Dashboard</a>
            {' '}→ Authentication → Users → Add user
          </p>
        </div>
      )}
    </div>
  );
}


function OverviewTab({ facility: f, surveys, year }) {
  const [userProfiles, setUserProfiles] = useState([]);
  const [showInvito, setShowInvito]     = useState(null);
  const [editingOrg, setEditingOrg]     = useState(false);
  const [orgForm, setOrgForm]           = useState({
    director:                  f.director                      || '',
    email_direzione:           f.email_direzione               || '',
    director_sanitario:        f.director_sanitario            || '',
    email_sanitario:           f.email_sanitario               || '',
    referente_struttura:       f.referente_struttura           || '',
    email_referente_struttura: f.email_referente_struttura     || '',
    referent:                  f.referent                      || '',
    email_qualita:             f.email_qualita                 || '',
  });
  const [savingOrg, setSavingOrg] = useState(false);

  useEffect(() => {
    const emails = ORG_CONFIG.map(o => f[o.emailKey]).filter(Boolean);
    if (!emails.length) return;
    supabase.from('user_profiles').select('email,last_sign_in_at,created_at,updated_at')
      .in('email', emails)
      .then(({ data }) => { if (data) setUserProfiles(data); });
  }, [f]);

  const handleSaveOrg = async () => {
    setSavingOrg(true);
    try {
      const { error } = await supabase.from('facilities').update({
        director:                  orgForm.director                  || null,
        email_direzione:           orgForm.email_direzione           || null,
        director_sanitario:        orgForm.director_sanitario        || null,
        email_sanitario:           orgForm.email_sanitario           || null,
        referente_struttura:       orgForm.referente_struttura       || null,
        email_referente_struttura: orgForm.email_referente_struttura || null,
        referent:                  orgForm.referent                  || null,
        email_qualita:             orgForm.email_qualita             || null,
      }).eq('id', f.id);
      if (error) throw error;
      setEditingOrg(false);
    } catch (err) {
      alert('Errore salvataggio: ' + err.message);
    } finally {
      setSavingOrg(false);
    }
  };

  const latestClient   = surveys.filter(s => s.type === 'client').sort((a,b) => b.calendar_id.localeCompare(a.calendar_id))[0];
  const latestOperator = surveys.filter(s => s.type === 'operator').sort((a,b) => b.calendar_id.localeCompare(a.calendar_id))[0];

  return (
    <div className="space-y-6">
      {/* Scheda struttura */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center"
          style={{ borderTopWidth: '4px', borderTopColor: f.udo_color || '#cbd5e1' }}>
          <div>
            <h2 className="font-black text-slate-800 text-lg">{f.name}</h2>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-widest mt-0.5">
              {f.udo_name} {f.region ? `· ${f.region}` : ''} {f.bed_count > 0 ? `· ${f.bed_count} p.l.` : ''}
            </p>
          </div>
          <button onClick={() => setEditingOrg(e => !e)}
            className={`text-xs font-black uppercase tracking-widest px-4 py-2 rounded-xl transition-colors ${
              editingOrg ? 'bg-slate-200 text-slate-600' : 'bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100'
            }`}>
            {editingOrg ? 'Annulla' : '✎ Modifica contatti'}
          </button>
        </div>

        <div className="divide-y divide-slate-50">
          {ORG_CONFIG.map(({ key, emailKey, label, icon }) => {
            const nome          = f[key];
            const email         = f[emailKey];
            const userProfile   = userProfiles.find(p => p.email === email);
            const isShowingInvito = showInvito === key;

            return (
              <div key={key} className="px-6 py-4">
                <div className="flex items-start gap-3">
                  <span className="text-lg mt-0.5">{icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
                      <OrgStatoPill email={email} userProfiles={userProfiles} />
                    </div>

                    {editingOrg ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                        <input type="text" value={orgForm[key]} onChange={e => setOrgForm(p => ({ ...p, [key]: e.target.value }))}
                          placeholder={`Nome ${label}`}
                          className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 transition-all" />
                        <input type="email" value={orgForm[emailKey]} onChange={e => setOrgForm(p => ({ ...p, [emailKey]: e.target.value }))}
                          placeholder="Email"
                          className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 transition-all" />
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-sm font-bold ${nome ? 'text-slate-800' : 'text-slate-300 italic'}`}>
                          {nome || 'Non assegnato'}
                        </span>
                        <div className="flex items-center gap-2">
                          {email && (
                            <a href={`mailto:${email}`} className="text-xs text-indigo-500 hover:text-indigo-700 transition-colors" title={email}>✉</a>
                          )}
                          {email && !userProfile && (
                            <button onClick={() => setShowInvito(isShowingInvito ? null : key)}
                              className="text-xs font-bold text-amber-600 hover:bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg transition-colors">
                              {isShowingInvito ? 'Chiudi' : 'Invia invito'}
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {isShowingInvito && !editingOrg && email && (
                      <InvitoPanel figura={label} email={f[emailKey]} facilityId={f.id} companyId={f.company_id} onClose={() => setShowInvito(null)} onSuccess={() => setUserProfiles([])} />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {editingOrg && (
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
            <button onClick={handleSaveOrg} disabled={savingOrg}
              className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase shadow hover:bg-indigo-700 transition-colors disabled:opacity-60">
              {savingOrg ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Salva contatti
            </button>
          </div>
        )}

        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100">
          <p className="text-[10px] text-slate-400 font-medium">
            🟢 Attivo · 🟠 In attesa · 🟡 Da invitare · ⚫ Nessuna mail
          </p>
        </div>
      </div>

      {/* Stato survey */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { label: 'Survey Clienti / Ospiti', survey: latestClient, type: 'client', color: 'indigo' },
          { label: 'Survey Operatori / Staff', survey: latestOperator, type: 'operator', color: 'purple' },
        ].map(({ label, survey, type, color }) => (
          <div key={type} className={`bg-white rounded-2xl border border-slate-200 p-5`}>
            <p className={`text-[10px] font-black uppercase tracking-widest text-${color}-600 mb-3`}>{label}</p>
            {survey ? (
              <>
                <p className="text-sm font-black text-slate-800 mb-1">
                  {survey.ai_report_direzione ? '✅ Relazione generata' : '⏳ Dati caricati, relazione mancante'}
                </p>
                <p className="text-xs text-slate-400">
                  Ultimo aggiornamento: {new Date(survey.updated_at || survey.created_at).toLocaleDateString('it')}
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-400 font-medium">Nessun dato caricato</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SurveysTab({ facility, surveys, onDataClick }) {
  return (
    <div className="space-y-4">
      <h2 className="font-black text-slate-800 text-lg">Gestione Survey</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { type: 'client',   label: 'Clienti / Ospiti',  desc: 'Questionari di gradimento' },
          { type: 'operator', label: 'Staff / Operatori',  desc: 'Questionari di clima interno' },
        ].map(({ type, label, desc }) => {
          const latest = surveys
            .filter(s => s.type === type)
            .sort((a,b) => b.calendar_id.localeCompare(a.calendar_id))[0];
          const status = latest
            ? latest.ai_report_direzione ? 'completed' : 'pending'
            : 'empty';
          const statusCfg = {
            completed: { label: 'Relazione OK',  bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
            pending:   { label: 'Da elaborare',  bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200'   },
            empty:     { label: 'Nessun dato',   bg: 'bg-slate-50',   text: 'text-slate-500',   border: 'border-slate-200'   },
          }[status];
          return (
            <button key={type} onClick={() => onDataClick(type)}
              className="bg-white rounded-2xl border border-slate-200 p-6 text-left hover:shadow-md hover:border-indigo-300 transition-all group">
              <div className="flex justify-between items-start mb-3">
                <p className="font-black text-slate-800">{label}</p>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}>
                  {statusCfg.label}
                </span>
              </div>
              <p className="text-xs text-slate-400 mb-4">{desc}</p>
              <p className="text-xs font-black text-indigo-600 group-hover:translate-x-1 transition-transform inline-block">
                {status === 'empty' ? 'Carica dati →' : 'Visualizza / Aggiorna →'}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NonConformitiesTab({ facility, year, profile, onNew, onEdit }) {
  const [ncs, setNcs]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supabase.from('non_conformities')
      .select('*')
      .eq('facility_id', facility.id)
      .eq('year', year)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setNcs(data);
        setLoading(false);
      });
  }, [facility.id, year]);

  const statusColor = {
    'Aperto':  'bg-rose-100 text-rose-700 border-rose-200',
    'Pending': 'bg-amber-100 text-amber-700 border-amber-200',
    'Chiuso':  'bg-emerald-100 text-emerald-700 border-emerald-200',
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-black text-slate-800 text-lg">Non Conformità {year}</h2>
        <button onClick={onNew}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors shadow">
          <Plus size={15} /> Registra NC
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={24} className="animate-spin text-indigo-400" />
        </div>
      ) : ncs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <AlertTriangle size={40} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500 font-medium">Nessuna non conformità registrata per il {year}.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {ncs.map(nc => (
            <button key={nc.id} onClick={() => onEdit(nc.id)}
              className="w-full bg-white rounded-xl border border-slate-200 px-5 py-4 text-left hover:border-indigo-300 hover:shadow-sm transition-all flex items-center gap-4 group">
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border shrink-0 ${statusColor[nc.stato] || statusColor['Aperto']}`}>
                {nc.stato}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-slate-800 truncate">{nc.titolo}</p>
                <p className="text-xs text-slate-400 mt-0.5 truncate">{nc.descrizione}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-slate-400">{new Date(nc.created_at).toLocaleDateString('it')}</p>
                <p className="text-xs font-black text-indigo-600 group-hover:translate-x-0.5 transition-transform mt-1">
                  Modifica →
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function KpiTab({ facility, kpiRecords, year, onOpenManager }) {
  const now            = new Date();
  const currentMonth   = now.getMonth() + 1;
  const isCurrentYear  = Number(year) === now.getFullYear();
  const timeHorizon    = getTimeHorizon(year);

  const facilityKpis   = kpiRecords.filter(k =>
    String(k.facility_id) === String(facility.id) && Number(k.year) === year
  );

  const completedMonths  = facilityKpis.filter(k => k.status === 'completed').length;
  const draftMonths      = facilityKpis.filter(k => k.status === 'draft').length;
  const actionableMonths = isCurrentYear ? currentMonth - 1 : 12;
  const missingMonths    = Math.max(0, actionableMonths - completedMonths - draftMonths);

  const totalAnomalies = facilityKpis
    .filter(k => k.status === 'completed' && k.metrics_json)
    .reduce((sum, k) => sum + detectAnomalies(k.metrics_json).length, 0);

  const kpiSeries = useMemo(() => KPI_RULES.map(rule => {
    const isPerc = !isNumericSettore(rule.settore);
    const data   = timeHorizon.map(t => {
      const rec = kpiRecords.find(k =>
        String(k.facility_id) === String(facility.id) &&
        Number(k.year)  === t.yearNum &&
        Number(k.month) === t.monthNum &&
        k.status === 'completed'
      );
      const val = rec?.metrics_json ? computeKpiValue(rule, rec.metrics_json, facility) : null;
      return { name: t.label, value: val };
    });
    return { rule, data, isPerc, hasData: data.some(d => d.value !== null) };
  }), [kpiRecords, facility, timeHorizon]);

  const bySector = useMemo(() => {
    const map = {};
    kpiSeries.forEach(s => {
      if (!map[s.rule.settore]) map[s.rule.settore] = [];
      map[s.rule.settore].push(s);
    });
    return map;
  }, [kpiSeries]);

  const sectors = [...new Set(KPI_RULES.map(r => r.settore))];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h2 className="font-black text-slate-800 text-lg">KPI Mensili {year}</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            {completedMonths} consolidati · {draftMonths} in bozza · {missingMonths} mancanti
            {totalAnomalies > 0 && (
              <span className="ml-2 text-red-600 font-bold">· {totalAnomalies} anomali{totalAnomalies === 1 ? 'a' : 'e'}</span>
            )}
          </p>
        </div>
        <button onClick={onOpenManager}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors shadow">
          <Activity size={15} /> Inserimento KPI
        </button>
      </div>

      {totalAnomalies > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
          <AlertTriangle size={18} className="text-red-600 shrink-0" />
          <p className="text-sm font-bold text-red-700">
            {totalAnomalies} anomali{totalAnomalies === 1 ? 'a logica rilevata' : 'e logiche rilevate'} nei dati inseriti.
          </p>
        </div>
      )}

      {sectors.map(sector => {
        const withData = (bySector[sector] || []).filter(s => s.hasData);
        if (!withData.length) return null;
        return (
          <div key={sector}>
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <span className="w-8 h-px bg-slate-200 inline-block" />{sector}<span className="w-8 h-px bg-slate-200 inline-block" />
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {withData.map(({ rule, data, isPerc }) => (
                <KpiCard key={rule.kpi_target} rule={rule} data={data} isPerc={isPerc} />
              ))}
            </div>
          </div>
        );
      })}

      {kpiSeries.every(s => !s.hasData) && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <BarChart3 size={40} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500 font-medium">Nessun dato KPI inserito per il {year}.</p>
          <button onClick={onOpenManager} className="mt-4 text-indigo-600 font-bold text-sm hover:underline">
            Apri inserimento KPI →
          </button>
        </div>
      )}
    </div>
  );
}

function KpiCard({ rule, data, isPerc }) {
  const hasTarget  = rule.target_verde !== null;
  const useBar     = isNumericSettore(rule.settore);
  const unit       = isPerc ? '%' : '';
  const lastVal    = [...data].reverse().find(d => d.value !== null);

  const getColor = (v) => {
    if (!hasTarget || v === null) return '#64748b';
    const tv = rule.target_verde * (isPerc ? 100 : 1);
    const tr = rule.target_rosso * (isPerc ? 100 : 1);
    if (rule.direzione === 'MAX') return v >= tv ? '#10b981' : v >= tr ? '#f59e0b' : '#ef4444';
    return v <= tv ? '#10b981' : v <= tr ? '#f59e0b' : '#ef4444';
  };

  const lastColor = getColor(lastVal?.value);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-sm transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <h4 className="text-xs font-black text-slate-700 uppercase leading-tight pr-2 line-clamp-2">
          {rule.kpi_target}
        </h4>
        {lastVal && (
          <span className="text-lg font-black shrink-0" style={{ color: lastColor }}>
            {lastVal.value}{unit}
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={60}>
        {useBar ? (
          <BarChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <Bar dataKey="value" radius={[2,2,0,0]}>
              {data.map((entry, i) => <Cell key={i} fill={getColor(entry.value)} />)}
            </Bar>
          </BarChart>
        ) : (
          <LineChart data={data} margin={{ top: 2, right: 4, left: 4, bottom: 2 }}>
            {hasTarget && (
              <>
                <ReferenceLine y={rule.target_verde * 100} stroke="#10b981" strokeDasharray="3 2" strokeWidth={1} />
                <ReferenceLine y={rule.target_rosso * 100} stroke="#ef4444" strokeDasharray="3 2" strokeWidth={1} />
              </>
            )}
            <Line type="monotone" dataKey="value" stroke={lastColor} strokeWidth={2}
              dot={false} activeDot={{ r: 4 }} connectNulls />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

// I 15 KPI selezionati per il Benchmark con mapping verso la view anonima
const BENCH_KPIS = [
  { target: 'Turn Over',            calcolo: '[OSPITI ASSISTITI NEL MESE] / [POSTI LETTO ATTIVI]',                                                               label: 'Turn Over',       avgKey: 'turn_over_avg',       dir: 'MAX', settore: 'ECONOMICO'   },
  { target: 'Invii PS',             calcolo: '[OSPITI INVIATI AL PS] / [OSPITI ASSISTITI NEL MESE]',                                                             label: 'Invii PS',        avgKey: 'invii_ps_avg',        dir: 'MIN', settore: 'PS'          },
  { target: 'Val Dolore',           calcolo: '[VALUTAZIONE DEL DOLORE] / [OSPITI ASSISTITI NEL MESE]',                                                           label: 'Val. Dolore',     avgKey: 'val_dolore_avg',      dir: 'MAX', settore: 'SANITARI'    },
  { target: 'Parametri 15gg',       calcolo: '[RILEVAZIONE PARAMETRI QUINDICINALE] / [OSPITI ASSISTITI NEL MESE]',                                               label: 'Parametri 15gg',  avgKey: 'parametri_avg',       dir: 'MAX', settore: 'SANITARI'    },
  { target: 'Ospiti con Lesioni',   calcolo: '[NUMERO OSPITI CON LESIONI DA PRESSIONE IN TRATTAMENTO] / [OSPITI ASSISTITI NEL MESE]',                            label: 'Ospiti Lesioni',  avgKey: 'lesioni_ospiti_avg',  dir: 'MIN', settore: 'LESIONI'     },
  { target: 'Lesioni > III Stadio', calcolo: '[NUMERO LESIONI DA PRESSIONE SUPERIORI AL III STADIO] / [OSPITI ASSISTITI NEL MESE]',                              label: 'Lesioni >III',    avgKey: 'lesioni_iii_avg',     dir: 'MIN', settore: 'LESIONI'     },
  { target: 'Ospiti Caduti',        calcolo: '[OSPITI CADUTI] / [OSPITI ASSISTITI NEL MESE]',                                                                    label: 'Ospiti Caduti',   avgKey: 'caduti_avg',          dir: 'MIN', settore: 'CADUTE'      },
  { target: 'Cadute Totali',        calcolo: '[CADUTE TOTALI] / [OSPITI ASSISTITI NEL MESE]',                                                                    label: 'Cadute Totali',   avgKey: 'cadute_avg',          dir: 'MIN', settore: 'CADUTE'      },
  { target: 'Cadute Gravi',         calcolo: '[CADUTE GRAVI] / [OSPITI ASSISTITI NEL MESE]',                                                                     label: 'Cadute Gravi',    avgKey: 'cadute_gravi_avg',    dir: 'MIN', settore: 'CADUTE'      },
  { target: 'Contenzioni',          calcolo: '[NUMERO OSPITI CON ALMENO UNA CONTENZIONE PRESCRITTA] / [OSPITI ASSISTITI NEL MESE]',                              label: 'Contenzioni',     avgKey: 'contenzioni_avg',     dir: 'MIN', settore: 'CONTENZIONI' },
  { target: 'Cont. solo Spondine',  calcolo: '[NUMERO OSPITI CON SOLO SPONDINE A LETTO] / [OSPITI ASSISTITI NEL MESE]',                                          label: 'Spondine',        avgKey: 'spondine_avg',        dir: 'MIN', settore: 'CONTENZIONI' },
  { target: 'PI PAI 30gg',          calcolo: '[OSPITI CON PI PAI REDATTO ENTRO 30 GG DALL INGRESSO] / [OSPITI ASSISTITI NEL MESE]',                              label: 'PI PAI 30gg',     avgKey: 'pipai_30_avg',        dir: 'MAX', settore: 'COMPLIANCE'  },
  { target: 'PI PAI 180gg',         calcolo: '[OSPITI CON PI PAI AGGIORNATO ENTRO 180 GG] / [OSPITI ASSISTITI NEL MESE]',                                        label: 'PI PAI 180gg',    avgKey: 'pipai_180_avg',       dir: 'MAX', settore: 'COMPLIANCE'  },
  { target: 'Form. Sicurezza',      calcolo: '[NUMERO DIPENDENTI CON FORMAZIONE SICUREZZA VALIDA] / [NUMERO TOTALE DIPENDENTI SOGGETTI A FORMAZIONE SICUREZZA]', label: 'Form. Sicurezza', avgKey: 'form_sic_avg',        dir: 'MAX', settore: 'COMPLIANCE'  },
  { target: 'Form. HACCP',          calcolo: '[NUMERO DIPENDENTI CON FORMAZIONE HACCP VALIDA] / [NUMERO TOTALE DIPENDENTI SOGGETTI A FORMAZIONE HACCP]',          label: 'Form. HACCP',     avgKey: 'form_haccp_avg',      dir: 'MAX', settore: 'COMPLIANCE'  },
];

const BENCH_MONTH_NAMES = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];

function getBenchColor(value, kpi) {
  if (value === null) return '#94a3b8';
  const rule = KPI_RULES.find(r => r.kpi_target === kpi.target);
  if (!rule?.target_verde || !rule?.target_rosso) return '#6366f1';
  const v = value / 100;
  if (rule.direzione === 'MAX') {
    if (v >= rule.target_verde) return '#10b981';
    if (v <= rule.target_rosso) return '#ef4444';
    return '#f59e0b';
  }
  if (v <= rule.target_verde) return '#10b981';
  if (v >= rule.target_rosso) return '#ef4444';
  return '#f59e0b';
}

function BenchmarkTab({ facility, kpiRecords, year }) {
  const [benchData, setBenchData]         = useState([]);
  const [loadingBench, setLoadingBench]   = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const m = new Date().getMonth();
    return m === 0 ? 12 : m;
  });
  const [selectedKpi, setSelectedKpi]     = useState(BENCH_KPIS[0].target);
  const timeHorizon                       = useMemo(() => getTimeHorizon(year), [year]);

  useEffect(() => {
    setLoadingBench(true);
    supabase
      .from('v_benchmark_anonymous')
      .select('*')
      .eq('year', year)
      .then(({ data, error }) => {
        if (!error) setBenchData(data || []);
        setLoadingBench(false);
      });
  }, [year]);

  const monthBench = useMemo(() =>
    benchData.find(b => b.udo_name === facility.udo_name && Number(b.month) === selectedMonth),
    [benchData, facility.udo_name, selectedMonth]
  );

  const myRecord = useMemo(() =>
    kpiRecords.find(k =>
      String(k.facility_id) === String(facility.id) &&
      Number(k.year) === year &&
      Number(k.month) === selectedMonth &&
      k.status === 'completed'
    ),
    [kpiRecords, facility.id, year, selectedMonth]
  );

  // Box overview: struttura vs media UDO per i 15 KPI
  const overviewData = useMemo(() => BENCH_KPIS.map(kpi => {
    const rule  = KPI_RULES.find(r => r.kpi_target === kpi.target);
    let myValue = null;
    if (myRecord?.metrics_json) {
      myValue = computeKpiValue({ ...rule, calcolo: kpi.calcolo }, myRecord.metrics_json, facility);
    }
    const udoRaw  = monthBench && kpi.avgKey ? monthBench[kpi.avgKey] : null;
    const udoAvg  = udoRaw !== null && udoRaw !== undefined ? Math.round(udoRaw * 1000) / 10 : null;
    return { label: kpi.label, target: kpi.target, myValue, udoAvg, color: getBenchColor(myValue, kpi), dir: kpi.dir };
  }), [myRecord, monthBench, facility]);

  // Trend 12 mesi per KPI selezionato
  const activeRule = useMemo(() => KPI_RULES.find(r => r.kpi_target === selectedKpi), [selectedKpi]);
  const trendData  = useMemo(() => {
    const kpi  = BENCH_KPIS.find(k => k.target === selectedKpi);
    const rule = activeRule;
    if (!kpi || !rule) return [];
    return timeHorizon.map(t => {
      const rec = kpiRecords.find(k =>
        String(k.facility_id) === String(facility.id) &&
        Number(k.year) === t.yearNum && Number(k.month) === t.monthNum &&
        k.status === 'completed'
      );
      const myVal = rec?.metrics_json
        ? computeKpiValue({ ...rule, calcolo: kpi.calcolo }, rec.metrics_json, facility)
        : null;
      const benchMonth = benchData.find(b =>
        b.udo_name === facility.udo_name &&
        Number(b.year) === t.yearNum && Number(b.month) === t.monthNum
      );
      const udoVal = benchMonth && kpi.avgKey
        ? Math.round((benchMonth[kpi.avgKey] || 0) * 1000) / 10
        : null;
      return { name: t.label, struttura: myVal, udo_media: udoVal };
    });
  }, [selectedKpi, activeRule, timeHorizon, kpiRecords, benchData, facility]);

  if (loadingBench) {
    return <div className="text-center py-12 text-slate-400 animate-pulse font-bold">Caricamento benchmark...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h2 className="font-black text-slate-800 text-lg">Benchmark {year}</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            {facility.udo_name} — confronto anonimo con strutture dello stesso tipo
            {!monthBench && <span className="ml-2 text-amber-600 font-bold">(servono almeno 3 strutture con dati per il benchmark)</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Mese</span>
          <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}
            className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400">
            {BENCH_MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>
      </div>

      {/* Box overview: struttura vs media UDO */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="font-black text-slate-700 mb-1">
          Struttura vs Media UDO — {BENCH_MONTH_NAMES[selectedMonth - 1]} {year}
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          {myRecord ? 'Dati inseriti per questo mese' : 'Nessun dato per questo mese — solo media UDO visibile'}
        </p>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          {overviewData.map(d => (
            <div key={d.target} onClick={() => setSelectedKpi(d.target)}
              className={`rounded-xl p-3 border cursor-pointer transition-all hover:shadow-md ${
                selectedKpi === d.target ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-slate-50'
              }`}>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2 truncate" title={d.label}>
                {d.label}
              </p>
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                <span className="text-sm font-black" style={{ color: d.color }}>
                  {d.myValue !== null ? `${d.myValue}%` : '—'}
                </span>
              </div>
              {d.udoAvg !== null && (
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
                  <span className="text-xs font-bold text-slate-400">{d.udoAvg}%</span>
                </div>
              )}
              <p className="text-[9px] text-slate-300 mt-1 uppercase">{d.dir === 'MAX' ? '↑ max' : '↓ min'}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-100 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-slate-500"><div className="w-3 h-1 rounded bg-indigo-400" /> Struttura</div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500"><div className="w-3 h-1 rounded bg-slate-400" /> Media UDO</div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-600"><div className="w-2 h-2 rounded-full bg-emerald-500" /> In target</div>
          <div className="flex items-center gap-1.5 text-xs text-amber-600"><div className="w-2 h-2 rounded-full bg-amber-400" /> Allerta</div>
          <div className="flex items-center gap-1.5 text-xs text-red-600"><div className="w-2 h-2 rounded-full bg-red-500" /> Critico</div>
        </div>
      </div>

      {/* Trend 12 mesi — KPI selezionato */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
          <div>
            <h3 className="font-black text-slate-700">Trend 12 mesi — {selectedKpi}</h3>
            <p className="text-xs text-slate-400 mt-0.5">Clicca un box sopra per cambiare indicatore</p>
          </div>
          <select value={selectedKpi} onChange={e => setSelectedKpi(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400">
            {BENCH_KPIS.map(k => <option key={k.target} value={k.target}>{k.label}</option>)}
          </select>
        </div>
        {activeRule?.target_verde && (
          <div className="flex items-center gap-4 mb-3 text-xs flex-wrap">
            <span className="flex items-center gap-1.5 text-emerald-600 font-bold">
              <div className="w-4 h-0.5 bg-emerald-500" /> Target verde: {(activeRule.target_verde * 100).toFixed(0)}%
            </span>
            <span className="flex items-center gap-1.5 text-red-600 font-bold">
              <div className="w-4 h-0.5 bg-red-500" /> Target rosso: {(activeRule.target_rosso * 100).toFixed(0)}%
            </span>
          </div>
        )}
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={trendData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 'bold', fill: '#64748b' }} />
            <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={v => `${v}%`} />
            <Tooltip
              formatter={(v, name) => [`${v}%`, name === 'struttura' ? 'Struttura' : 'Media UDO']}
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: '12px' }}
            />
            <Legend formatter={v => v === 'struttura' ? 'Struttura' : 'Media UDO'} wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
            {activeRule?.target_verde && (
              <ReferenceLine y={activeRule.target_verde * 100} stroke="#10b981" strokeDasharray="5 5" strokeWidth={1.5} />
            )}
            {activeRule?.target_rosso && (
              <ReferenceLine y={activeRule.target_rosso * 100} stroke="#ef4444" strokeDasharray="5 5" strokeWidth={1.5} />
            )}
            <Line type="monotone" dataKey="struttura" stroke="#4f46e5" strokeWidth={2.5}
              dot={{ r: 4, fill: '#4f46e5', strokeWidth: 0 }} activeDot={{ r: 6 }} connectNulls />
            <Line type="monotone" dataKey="udo_media" stroke="#94a3b8" strokeWidth={1.5}
              strokeDasharray="4 4" dot={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const PIE_COLORS = ['#10b981','#6366f1','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#84cc16'];

function SurveyAnalysisTab({ facility, surveys }) {
  const [selectedType, setSelectedType] = useState('client');

  const typedSurveys = surveys
    .filter(s => s.type === selectedType)
    .sort((a,b) => b.calendar_id.localeCompare(a.calendar_id));

  const latest = typedSurveys[0];

  const questions = useMemo(() => {
    if (!latest?.responses_json) return [];
    try {
      const d = typeof latest.responses_json === 'string'
        ? JSON.parse(latest.responses_json)
        : latest.responses_json;
      if (Array.isArray(d)) return d;
      return Object.entries(d).map(([question, answers]) => ({ question, answers }));
    } catch { return []; }
  }, [latest]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        {[
          { value: 'client',   label: 'Clienti / Ospiti',  color: 'bg-indigo-600' },
          { value: 'operator', label: 'Operatori / Staff',  color: 'bg-purple-600' },
        ].map(t => (
          <button key={t.value} onClick={() => setSelectedType(t.value)}
            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              selectedType === t.value ? `${t.color} text-white shadow` : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}>
            {t.label}
          </button>
        ))}
        {latest && (
          <span className="ml-auto text-xs text-slate-400 font-medium">
            Ultimo: {new Date(latest.created_at).toLocaleDateString('it', { day:'2-digit', month:'long', year:'numeric' })}
          </span>
        )}
      </div>

      {latest?.ai_report_direzione && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5">
          <p className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-2">Sintesi AI — Report Direzione</p>
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{latest.ai_report_direzione}</p>
        </div>
      )}

      {questions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <BarChart3 size={40} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500 font-medium">
            {latest ? 'Nessun dato di risposta disponibile.' : 'Nessun survey caricato.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {questions.map((q, qi) => {
            const entries = Object.entries(typeof q.answers === 'object' ? q.answers : {}).sort(([,a],[,b]) => b - a);
            const total   = entries.reduce((s,[,v]) => s + v, 0);
            const pieData = entries.map(([name, value]) => ({ name, value }));
            return (
              <div key={qi} className="bg-white rounded-2xl border border-slate-200 p-5">
                <p className="text-sm font-black text-slate-700 mb-4 leading-tight">{q.question}</p>
                {pieData.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">Nessuna risposta</p>
                ) : (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width={140} height={140}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={35} outerRadius={65} dataKey="value" paddingAngle={2}>
                          {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v) => [`${v} (${Math.round(v/total*100)}%)`, '']} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-1.5">
                      {entries.map(([name, value], i) => (
                        <div key={name} className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="text-xs text-slate-600 flex-1 truncate" title={name}>{name}</span>
                          <span className="text-xs font-black text-slate-700">{Math.round(value/total*100)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
