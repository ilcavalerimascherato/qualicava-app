// src/views/DirectorFacility.jsx
// Dashboard completa per il direttore di una struttura specifica.
// Tab: Panoramica · KPI · Survey · Report AI · Non Conformità · Benchmark
import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import {
  PawPrint, LogOut, ArrowLeft, Activity, BarChart3, Database,
  AlertTriangle, TrendingUp, CheckCircle2, Clock,
  Plus, Save, Loader2, X
} from 'lucide-react';

import { useAuth }                          from '../contexts/AuthContext';
import { useModals }                        from '../contexts/ModalContext';
import { useDashboardData, useInvalidate }  from '../hooks/useDashboardData';
import { enrichFacilitiesData }             from '../utils/statusCalculator';
import { supabase }                         from '../supabaseClient';
import { detectAnomalies }                   from '../utils/kpiAnomalyEngine';
import NcFormModal                            from '../components/NcFormModal';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, LineChart, Line, Legend, Cell, PieChart, Pie } from 'recharts';
import { KPI_RULES }                          from '../config/kpiRules';
import { computeKpiValue }                    from '../utils/kpiFormulaEngine';
import { getTimeHorizon }                     from '../utils/kpiTimeHorizon';

import KpiManagerModal  from '../components/KpiManagerModal';
import DataImportModal  from '../components/DataImportModal';
import AnalyticsModal   from '../components/AnalyticsModal';

const TABS = [
  { id: 'overview',         label: 'Panoramica',     Icon: Activity      },
  { id: 'kpi',              label: 'KPI Mensili',    Icon: BarChart3     },
  { id: 'surveys',          label: 'Survey',         Icon: Database      },
  { id: 'analysis',         label: 'Analisi Survey', Icon: BarChart3     },
  { id: 'non_conformities', label: 'Non Conformità', Icon: AlertTriangle },
  { id: 'benchmark',        label: 'Benchmark',      Icon: TrendingUp    },
];



export default function DirectorFacility() {
  const { facilityId }                    = useParams();
  const navigate                          = useNavigate();
  const { profile, isAdmin, signOut }     = useAuth();
  const { modals, open, close }           = useModals();
  const invalidate                        = useInvalidate();
  const [activeTab, setActiveTab]         = useState('overview');
  const [ncEditId, setNcEditId]           = useState(null);
  const [dataTarget, setDataTarget]       = useState(null);
  const year = new Date().getFullYear();

  const { data, loading } = useDashboardData(year);

  // Struttura corrente arricchita
  const facility = useMemo(() => {
    const raw = data.facilities.find(f => String(f.id) === String(facilityId));
    if (!raw) return null;
    const enriched = enrichFacilitiesData([raw], data.surveys, data.kpiRecords, year, data.udos);
    return enriched[0] || null;
  }, [data, facilityId, year]);

  // Survey della struttura corrente
  const facilitySurveys = useMemo(() =>
    data.surveys.filter(s =>
      String(s.facility_id) === String(facilityId) ||
      (!s.facility_id && s.company_id === facility?.company_id)
    ), [data.surveys, facilityId, facility]);

  const hasMultipleFacilities = (profile?.accessibleFacilityIds?.length ?? 0) > 1;

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
          <button
            onClick={() => navigate('/')}
            className="text-indigo-600 font-bold text-sm hover:underline"
          >
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
                {(hasMultipleFacilities || isAdmin) && (
                  <Link
                    to={isAdmin ? '/admin' : '/director'}
                    className="text-slate-400 hover:text-indigo-600 transition-colors"
                  >
                    <ArrowLeft size={16} />
                  </Link>
                )}
                <h1
                  className="text-base font-black tracking-tight"
                  style={{ color: facility.udo_color || '#4f46e5' }}
                >
                  {facility.name}
                </h1>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                {facility.udo_name} {facility.region ? `· ${facility.region}` : ''}
                {facility.bed_count > 0 ? ` · ${facility.bed_count} posti letto` : ''}
              </p>
            </div>
          </div>

          {/* Semafori compatti */}
          <div className="hidden md:flex items-center gap-2">
            <StatusPill label="Survey"  isOk={facility.isGreen}    isPartial={facility.isYellow} />
            <StatusPill label="KPI"     isOk={facility.isKpiGreen} />
          </div>

          <button
            onClick={signOut}
            className="flex items-center gap-2 text-sm text-rose-500 hover:bg-rose-50 px-3 py-2 rounded-xl transition-colors"
          >
            <LogOut size={16} /> Esci
          </button>
        </div>

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
        onUpdateSuccess={() => invalidate.kpiRecords(year)}
      />

      {dataTarget && (
        <>
          <DataImportModal
            isOpen={modals.dataImport}
            onClose={() => close('dataImport')}
            facility={dataTarget.facility}
            type={dataTarget.type}
            year={year}
            onUploadSuccess={() => { invalidate.surveys(year); toast.success('Dati caricati'); }}
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
            onUpdateSuccess={() => invalidate.surveys(year)}
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
            invalidate.kpiRecords(year);
            toast.success(`NC ${stato === 'Chiuso' ? 'chiusa' : stato === 'Pending' ? 'aggiornata a Pending' : 'registrata'}`);
          }}
        />
      )}
    </div>
  );
}

// ── Componenti Tab ────────────────────────────────────────────

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

// Pannello organico con stato utenti — sostituisce OverviewTab in DirectorFacility
// Logica stati:
// - Nessuna mail → grigio, invita a compilare
// - Mail presente, no account → giallo, mostra istruzioni invito
// - Account presente, accesso mai fatto → arancione "In attesa"  
// - Account presente, ha fatto accesso → verde "Attivo"

const ORG_CONFIG = [
  { key: 'director',            emailKey: 'email_direzione',           userIdKey: 'dir_user_id',      label: 'Direttore',          icon: '👤', canEdit: true  },
  { key: 'director_sanitario',  emailKey: 'email_sanitario',           userIdKey: 'dir_san_user_id',  label: 'Dir. Sanitario',     icon: '⚕️', canEdit: false },
  { key: 'referente_struttura', emailKey: 'email_referente_struttura', userIdKey: 'ref_str_user_id',  label: 'Ref. Struttura',     icon: '🏠', canEdit: false },
  { key: 'referent',            emailKey: 'email_qualita',             userIdKey: 'ref_qual_user_id', label: 'Ref. Qualità',       icon: '✅', canEdit: false },
];

function OrgStatoPill({ email, userId, userProfiles }) {
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
  
  // Ha account — controlla last_sign_in
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

function InvitoPanel({ figura, email, facilityName, onClose }) {
  const [copied, setCopied] = useState(false);
  
  const sql = `-- Invita ${figura} per ${facilityName}
-- 1. Vai su Supabase → Authentication → Users → Add user
--    Email: ${email}
--    Spunta "Send welcome email" o usa "Send invite"

-- 2. Dopo la creazione, esegui:
UPDATE public.user_profiles
SET role = 'director', full_name = '${figura}'
WHERE email = '${email}';

-- 3. Assegna accesso alla struttura:
INSERT INTO public.user_facility_access (user_id, facility_id)
SELECT p.id, f.id
FROM public.user_profiles p, public.facilities f
WHERE p.email = '${email}' AND f.name = '${facilityName}'
ON CONFLICT DO NOTHING;`;

  const copy = () => {
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-2">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-black text-amber-700 uppercase tracking-widest">
          Istruzioni invito — {email}
        </p>
        <button onClick={onClose} className="text-amber-400 hover:text-amber-700">
          <X size={14} />
        </button>
      </div>
      <div className="bg-slate-900 rounded-lg p-3 mb-3">
        <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto">{sql}</pre>
      </div>
      <div className="flex gap-2">
        <button onClick={copy}
          className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
            copied ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
          }`}>
          {copied ? '✓ Copiato!' : '📋 Copia SQL'}
        </button>
        <a
          href="https://supabase.com/dashboard"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs font-bold bg-slate-800 text-white px-3 py-1.5 rounded-lg hover:bg-slate-700 transition-colors"
        >
          Apri Supabase →
        </a>
      </div>
    </div>
  );
}

function OverviewTab({ facility: f, surveys, year }) {
  const [userProfiles, setUserProfiles] = useState([]);
  const [showInvito, setShowInvito]     = useState(null); // key della figura
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

  // Carica profili utenti per verificare stato account
  useEffect(() => {
    supabase
      .from('user_profiles')
      .select('id, email, created_at, updated_at, role')
      .then(({ data }) => { if (data) setUserProfiles(data); });
  }, []);

  const clientSurvey   = surveys.filter(s => s.type === 'client').sort((a,b) => b.calendar_id.localeCompare(a.calendar_id))[0];
  const operatorSurvey = surveys.filter(s => s.type === 'operator').sort((a,b) => b.calendar_id.localeCompare(a.calendar_id))[0];

  const statusCards = [
    { label: 'Survey Clienti',   value: f.clientStatus === 'completed' ? 'Completata' : f.clientStatus === 'pending' ? 'In elaborazione' : 'Da avviare', isOk: f.clientStatus === 'completed', detail: clientSurvey ? `Caricata: ${new Date(clientSurvey.created_at).toLocaleDateString('it')}` : 'Nessun dato' },
    { label: 'Survey Operatori', value: f.staffStatus  === 'completed' ? 'Completata' : f.staffStatus  === 'pending' ? 'In elaborazione' : 'Da avviare', isOk: f.staffStatus  === 'completed', detail: operatorSurvey ? `Caricata: ${new Date(operatorSurvey.created_at).toLocaleDateString('it')}` : 'Nessun dato' },
    { label: 'KPI Mensili',      value: f.isKpiGreen ? 'In regola' : 'Mesi mancanti', isOk: f.isKpiGreen, detail: `Anno ${year}` },
  ];

  const handleSaveOrg = async () => {
    setSavingOrg(true);
    const { error } = await supabase.from('facilities').update({
      director:                  orgForm.director.trim()                   || null,
      email_direzione:           orgForm.email_direzione.trim()            || null,
      director_sanitario:        orgForm.director_sanitario.trim()         || null,
      email_sanitario:           orgForm.email_sanitario.trim()            || null,
      referente_struttura:       orgForm.referente_struttura.trim()        || null,
      email_referente_struttura: orgForm.email_referente_struttura.trim()  || null,
      referent:                  orgForm.referent.trim()                   || null,
      email_qualita:             orgForm.email_qualita.trim()              || null,
    }).eq('id', f.id);
    setSavingOrg(false);
    if (error) { toast.error('Errore salvataggio: ' + error.message); return; }
    toast.success('Organico aggiornato');
    setEditingOrg(false);
  };

  return (
    <div className="space-y-6">

      {/* 3 card stato */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statusCards.map(c => (
          <div key={c.label} className={`bg-white rounded-2xl border p-5 ${c.isOk ? 'border-emerald-200' : 'border-slate-200'}`}>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{c.label}</p>
            <div className="flex items-center gap-2 mb-1">
              {c.isOk ? <CheckCircle2 size={18} className="text-emerald-600" /> : <Clock size={18} className="text-amber-500" />}
              <span className="font-black text-slate-800">{c.value}</span>
            </div>
            <p className="text-xs text-slate-400">{c.detail}</p>
          </div>
        ))}
      </div>

      {/* Dettagli struttura */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h3 className="font-black text-slate-700 mb-4">Dettagli struttura</h3>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          {[['Tipo (UDO)', f.udo_name], ['Regione', f.region], ['Indirizzo', f.address], ['Posti letto', f.bed_count || null]]
            .filter(([,v]) => v).map(([k, v]) => (
            <div key={k}>
              <dt className="text-slate-400 font-medium">{k}</dt>
              <dd className="font-bold text-slate-700">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Organico struttura */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50">
          <h3 className="font-black text-slate-700">Organico struttura</h3>
          {!editingOrg ? (
            <button onClick={() => setEditingOrg(true)}
              className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-3 py-2 rounded-xl transition-colors">
              ✏ Modifica
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setEditingOrg(false)}
                className="text-xs font-bold text-slate-500 hover:bg-slate-100 px-3 py-2 rounded-xl transition-colors">
                Annulla
              </button>
              <button onClick={handleSaveOrg} disabled={savingOrg}
                className="flex items-center gap-2 text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 px-4 py-2 rounded-xl transition-colors disabled:opacity-60">
                {savingOrg ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                Salva
              </button>
            </div>
          )}
        </div>

        <div className="divide-y divide-slate-100">
          {ORG_CONFIG.map(({ key, emailKey, label, icon }) => {
            const nome  = editingOrg ? orgForm[key]      : (f[key]      || '');
            const isShowingInvito = showInvito === key;
            const userProfile = userProfiles.find(p => p.email === f[emailKey]);

            return (
              <div key={key} className="px-6 py-4">
                <div className="flex items-start gap-4">
                  <span className="text-xl w-8 text-center mt-0.5">{icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
                      <OrgStatoPill email={f[emailKey]} userId={f[`${key}_user_id`]} userProfiles={userProfiles} />
                    </div>

                    {editingOrg ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                        <input
                          type="text"
                          value={orgForm[key]}
                          onChange={e => setOrgForm(p => ({ ...p, [key]: e.target.value }))}
                          placeholder={`Nome ${label}`}
                          className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 transition-all"
                        />
                        <input
                          type="email"
                          value={orgForm[emailKey]}
                          onChange={e => setOrgForm(p => ({ ...p, [emailKey]: e.target.value }))}
                          placeholder="Email"
                          className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 transition-all"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-sm font-bold ${nome ? 'text-slate-800' : 'text-slate-300 italic'}`}>
                          {nome || 'Non assegnato'}
                        </span>
                        <div className="flex items-center gap-2">
                          {f[emailKey] && (
                            <a href={`mailto:${f[emailKey]}`}
                              className="text-xs text-indigo-500 hover:text-indigo-700 transition-colors"
                              title={f[emailKey]}>✉</a>
                          )}
                          {f[emailKey] && !userProfile && (
                            <button
                              onClick={() => setShowInvito(isShowingInvito ? null : key)}
                              className="text-xs font-bold text-amber-600 hover:bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg transition-colors">
                              {isShowingInvito ? 'Chiudi' : 'Genera invito'}
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Pannello istruzioni invito */}
                    {isShowingInvito && !editingOrg && f[emailKey] && (
                      <InvitoPanel
                        figura={label}
                        email={f[emailKey]}
                        facilityName={f.name}
                        onClose={() => setShowInvito(null)}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100">
          <p className="text-[10px] text-slate-400 font-medium">
            🟢 Attivo · 🟠 In attesa di primo accesso · 🟡 Da invitare · ⚫ Nessuna mail configurata
          </p>
        </div>
      </div>

    </div>
  );
}


function KpiTab({ facility, kpiRecords, year, onOpenManager }) {
  const now           = new Date();
  const currentMonth  = now.getMonth() + 1;
  const isCurrentYear = Number(year) === now.getFullYear();
  const timeHorizon   = getTimeHorizon(year);

  const facilityKpis = kpiRecords.filter(k =>
    String(k.facility_id) === String(facility.id) && Number(k.year) === year
  );

  const completedMonths = facilityKpis.filter(k => k.status === 'completed').length;
  const draftMonths     = facilityKpis.filter(k => k.status === 'draft').length;
  const actionableMonths = isCurrentYear ? currentMonth - 1 : 12;
  const missingMonths   = Math.max(0, actionableMonths - completedMonths - draftMonths);

  const totalAnomalies = facilityKpis
    .filter(k => k.status === 'completed' && k.metrics_json)
    .reduce((sum, k) => sum + detectAnomalies(k.metrics_json).length, 0);

  // Calcola serie trend per ogni KPI sui 12 mesi rolling
  const kpiSeries = useMemo(() => {
    return KPI_RULES.map(rule => {
      const isPerc = !['NUMERI', 'ISPEZIONI'].includes(rule.settore);
      const data   = timeHorizon.map(t => {
        const rec = kpiRecords.find(k =>
          String(k.facility_id) === String(facility.id) &&
          Number(k.year)  === t.yearNum &&
          Number(k.month) === t.monthNum &&
          k.status === 'completed'
        );
        const val = rec?.metrics_json
          ? computeKpiValue(rule, rec.metrics_json, facility)
          : null;
        return { name: t.label, value: val };
      });
      const hasData = data.some(d => d.value !== null);
      return { rule, data, isPerc, hasData };
    });
  }, [kpiRecords, facility, timeHorizon]);

  // Raggruppa per settore
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
      {/* Header con riepilogo */}
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h2 className="font-black text-slate-800 text-lg">KPI Mensili {year}</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            {completedMonths} consolidati · {draftMonths} in bozza · {missingMonths} mancanti
            {totalAnomalies > 0 && (
              <span className="ml-2 text-red-600 font-bold">
                · {totalAnomalies} anomali{totalAnomalies === 1 ? 'a' : 'e'}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={onOpenManager}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors shadow"
        >
          <Activity size={15} /> Inserimento KPI
        </button>
      </div>

      {totalAnomalies > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
          <AlertTriangle size={18} className="text-red-600 shrink-0" />
          <p className="text-sm font-bold text-red-700">
            {totalAnomalies} anomali{totalAnomalies === 1 ? 'a logica rilevata' : 'e logiche rilevate'} nei dati inseriti.
            Aprire "Inserimento KPI" per i dettagli.
          </p>
        </div>
      )}

      {/* KPI per settore */}
      {sectors.map(sector => {
        const sectorKpis = bySector[sector] || [];
        const withData   = sectorKpis.filter(s => s.hasData);
        if (!withData.length) return null;
        return (
          <div key={sector}>
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <span className="w-8 h-px bg-slate-200 inline-block" />
              {sector}
              <span className="w-8 h-px bg-slate-200 inline-block" />
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

// Card singolo KPI con grafico appropriato
function KpiCard({ rule, data, isPerc }) {
  const hasTarget  = rule.target_verde !== null;
  const useBar     = ['NUMERI', 'ISPEZIONI'].includes(rule.settore);
  const multiplier = isPerc ? 100 : 1;
  const unit       = isPerc ? '%' : '';

  // Valore ultimo mese disponibile
  const lastVal = [...data].reverse().find(d => d.value !== null);

  // Colore semaforo per valore corrente
  const getColor = (val) => {
    if (val === null || !hasTarget) return '#6366f1';
    const v = isPerc ? val / 100 : val;
    if (rule.direzione === 'MAX') {
      if (v >= rule.target_verde) return '#10b981';
      if (v <= rule.target_rosso) return '#ef4444';
      return '#f59e0b';
    }
    if (v <= rule.target_verde) return '#10b981';
    if (v >= rule.target_rosso) return '#ef4444';
    return '#f59e0b';
  };

  const currentColor = lastVal ? getColor(lastVal.value) : '#94a3b8';
  const tv = hasTarget ? rule.target_verde * multiplier : null;
  const tr = hasTarget ? rule.target_rosso * multiplier : null;

  const chartData = data.map(d => ({
    name:  d.name,
    value: d.value !== null ? Math.round(d.value * (isPerc ? 10 : 10)) / 10 : null,
  }));

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 hover:shadow-sm transition-shadow">
      {/* Header card */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1 pr-2">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wide leading-tight">
            {rule.settore}
          </p>
          <p className="text-xs font-black text-slate-700 leading-tight mt-0.5" title={rule.indicatore}>
            {rule.kpi_target}
          </p>
        </div>
        {lastVal && (
          <div className="shrink-0 text-right">
            <p className="text-lg font-black" style={{ color: currentColor }}>
              {lastVal.value}{unit}
            </p>
            <p className="text-[9px] text-slate-400">ultimo</p>
          </div>
        )}
      </div>

      {/* Grafico */}
      <ResponsiveContainer width="100%" height={80}>
        {useBar ? (
          <BarChart data={chartData} margin={{ top: 2, right: 2, left: -20, bottom: 0 }}>
            <XAxis dataKey="name" hide />
            <YAxis hide />
            <Tooltip
              formatter={v => v !== null ? [`${v}${unit}`, rule.kpi_target] : ['—', rule.kpi_target]}
              contentStyle={{ fontSize: '11px', borderRadius: '8px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
            />
            <Bar dataKey="value" radius={[2,2,0,0]} maxBarSize={20}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.value !== null ? getColor(entry.value) : '#e2e8f0'} />
              ))}
            </Bar>
          </BarChart>
        ) : (
          <LineChart data={chartData} margin={{ top: 2, right: 2, left: -20, bottom: 0 }}>
            <XAxis dataKey="name" hide />
            <YAxis hide domain={['auto', 'auto']} />
            <Tooltip
              formatter={v => v !== null ? [`${v}${unit}`, rule.kpi_target] : ['—', rule.kpi_target]}
              contentStyle={{ fontSize: '11px', borderRadius: '8px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
            />
            {tv !== null && (
              <ReferenceLine y={tv} stroke="#10b981" strokeDasharray="3 3" strokeWidth={1} />
            )}
            {tr !== null && (
              <ReferenceLine y={tr} stroke="#ef4444" strokeDasharray="3 3" strokeWidth={1} />
            )}
            <Line
              type="monotone"
              dataKey="value"
              stroke={currentColor}
              strokeWidth={2}
              dot={{ r: 2, fill: currentColor, strokeWidth: 0 }}
              activeDot={{ r: 4 }}
              connectNulls
            />
          </LineChart>
        )}
      </ResponsiveContainer>

      {/* Target legenda */}
      {hasTarget && (
        <div className="flex items-center gap-3 mt-2 pt-2 border-t border-slate-50">
          <span className="text-[9px] text-emerald-600 font-bold">▲ {rule.target_verde * multiplier}{unit}</span>
          <span className="text-[9px] text-red-500 font-bold">▼ {rule.target_rosso * multiplier}{unit}</span>
          <span className="text-[9px] text-slate-400 ml-auto">{rule.direzione}</span>
        </div>
      )}
    </div>
  );
}


function SurveysTab({ facility, surveys, onDataClick }) {
  const clientSurveys   = surveys.filter(s => s.type === 'client').sort((a,b) => b.calendar_id.localeCompare(a.calendar_id));
  const operatorSurveys = surveys.filter(s => s.type === 'operator').sort((a,b) => b.calendar_id.localeCompare(a.calendar_id));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <SurveySection
        title="Survey Clienti / Ospiti"
        Icon={BarChart3}
        surveys={clientSurveys}
        color="indigo"
        onDataClick={() => onDataClick('client')}
      />
      <SurveySection
        title="Survey Operatori / Staff"
        Icon={Database}
        surveys={operatorSurveys}
        color="purple"
        onDataClick={() => onDataClick('operator')}
      />
    </div>
  );
}

function SurveySection({ title, Icon, surveys, color, onDataClick }) {
  const latest = surveys[0];
  const C = {
    indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-200', btn: 'bg-indigo-600 hover:bg-indigo-700' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200', btn: 'bg-purple-600 hover:bg-purple-700' },
  }[color];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className={`${C.bg} ${C.border} border-b px-5 py-4 flex items-center gap-3`}>
        <Icon size={18} className={C.text} />
        <h3 className={`font-black ${C.text} text-sm`}>{title}</h3>
      </div>
      <div className="p-5 space-y-4">
        {latest ? (
          <div className="text-sm space-y-1">
            <p className="text-slate-600">
              <span className="font-bold">Ultimo caricamento:</span>{' '}
              {new Date(latest.created_at).toLocaleDateString('it', { day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
            {(latest.ai_report_ospiti || latest.ai_report_direzione) && (
              <p className="text-emerald-600 font-bold text-xs flex items-center gap-1">
                <CheckCircle2 size={12} /> Report AI disponibile
              </p>
            )}
            <p className="text-xs text-slate-400">{surveys.length} caricamento{surveys.length !== 1 ? 'i' : ''} totali</p>
          </div>
        ) : (
          <p className="text-sm text-slate-400">Nessun dato caricato.</p>
        )}
        <button
          onClick={onDataClick}
          className={`flex items-center gap-2 ${C.btn} text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors`}
        >
          <Plus size={13} /> {latest ? 'Gestisci dati' : 'Carica dati'}
        </button>
      </div>
    </div>
  );
}


function NonConformitiesTab({ facility, year, profile, onNew, onEdit }) {
  const [ncs, setNcs]         = useState([]);
  const [ncLoading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('non_conformities')
      .select('*')
      .eq('facility_id', facility.id)
      .eq('year', year)
      .order('opened_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error) setNcs(data || []);
        setLoading(false);
      });
  }, [facility.id, year]);

  const statusCfg = {
    aperta:         { label: 'Aperta',         bg: 'bg-red-50',     text: 'text-red-700'     },
    in_lavorazione: { label: 'In lavorazione', bg: 'bg-amber-50',   text: 'text-amber-700'   },
    risolta:        { label: 'Risolta',        bg: 'bg-emerald-50', text: 'text-emerald-700' },
    respinta:       { label: 'Respinta',       bg: 'bg-slate-100',  text: 'text-slate-600'   },
    chiusa:         { label: 'Chiusa',         bg: 'bg-slate-100',  text: 'text-slate-600'   },
  };

  const severityCfg = {
    bassa:   'bg-slate-100 text-slate-600',
    media:   'bg-amber-50 text-amber-700',
    alta:    'bg-orange-50 text-orange-700',
    critica: 'bg-red-100 text-red-700 font-black',
  };

  const aperte = ncs.filter(n => n.status === 'aperta' || n.status === 'in_lavorazione').length;

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="font-black text-slate-800 text-lg">Non Conformità {year}</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            {ncs.length} registrate · {aperte} aperte
          </p>
        </div>
        <button
          onClick={onNew}
          className="flex items-center gap-2 bg-red-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-red-700 transition-colors shadow"
        >
          <Plus size={15} /> Nuova NC
        </button>
      </div>

      {ncLoading ? (
        <div className="text-center py-12 text-slate-400 animate-pulse font-bold">Caricamento...</div>
      ) : ncs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <AlertTriangle size={40} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500 font-medium">Nessuna non conformità per il {year}.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {ncs.map(nc => {
            const sc = statusCfg[nc.status] || statusCfg.aperta;
            return (
              <div key={nc.id} className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${sc.bg} ${sc.text}`}>
                        {sc.label}
                      </span>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${severityCfg[nc.severity]}`}>
                        {nc.severity}
                      </span>
                      <span className="text-xs text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                        {nc.category}
                      </span>
                    </div>
                    <h4 className="font-black text-slate-800">{nc.title}</h4>
                    {nc.description && (
                      <p className="text-sm text-slate-500 mt-1 line-clamp-2">{nc.description}</p>
                    )}
                    <p className="text-xs text-slate-400 mt-2">
                      Aperta il {new Date(nc.opened_at).toLocaleDateString('it')}
                    </p>
                  </div>
                  {nc.due_date && (
                    <div className="text-right shrink-0">
                      <p className="text-xs text-slate-400">Scadenza</p>
                      <p className={`text-sm font-black ${
                        new Date(nc.due_date) < new Date() && nc.status !== 'risolta'
                          ? 'text-red-600' : 'text-slate-700'
                      }`}>
                        {new Date(nc.due_date).toLocaleDateString('it')}
                      </p>
                    </div>
                  )}
                </div>
                {nc.hq_note && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <p className="text-xs font-bold text-indigo-600 mb-1">Nota HQ</p>
                    <p className="text-xs text-slate-600">{nc.hq_note}</p>
                  </div>
                )}
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={() => onEdit(nc.id)}
                    className="text-xs font-bold text-indigo-600 hover:bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    ✏ Modifica / Avanza stato
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}



// I 15 KPI selezionati con mapping verso la view benchmark
const BENCH_KPIS = [
  { target: 'Turn Over',           calcolo: '[OSPITI ASSISTITI NEL MESE] / [POSTI LETTO ATTIVI]',                                                              label: 'Turn Over',       avgKey: 'turn_over_avg',       medKey: 'turn_over_median',      dir: 'MAX', settore: 'ECONOMICO'    },
  { target: 'Invii PS',            calcolo: '[OSPITI INVIATI AL PS] / [OSPITI ASSISTITI NEL MESE]',                                                            label: 'Invii PS',        avgKey: 'invii_ps_avg',        medKey: 'invii_ps_median',       dir: 'MIN', settore: 'PS'           },
  { target: 'Val Dolore',          calcolo: '[VALUTAZIONE DEL DOLORE] / [OSPITI ASSISTITI NEL MESE]',                                                          label: 'Val. Dolore',     avgKey: 'val_dolore_avg',      medKey: 'val_dolore_median',     dir: 'MAX', settore: 'SANITARI'     },
  { target: 'Parametri 15gg',      calcolo: '[RILEVAZIONE PARAMETRI QUINDICINALE] / [OSPITI ASSISTITI NEL MESE]',                                              label: 'Parametri 15gg',  avgKey: 'parametri_avg',       medKey: 'parametri_median',      dir: 'MAX', settore: 'SANITARI'     },
  { target: 'Ospiti con Lesioni',  calcolo: '[NUMERO OSPITI CON LESIONI DA PRESSIONE IN TRATTAMENTO] / [OSPITI ASSISTITI NEL MESE]',                           label: 'Ospiti Lesioni',  avgKey: 'lesioni_ospiti_avg',  medKey: 'lesioni_ospiti_median', dir: 'MIN', settore: 'LESIONI'      },
  { target: 'Lesioni > III Stadio',calcolo: '[NUMERO LESIONI DA PRESSIONE SUPERIORI AL III STADIO] / [OSPITI ASSISTITI NEL MESE]',                             label: 'Lesioni >III',    avgKey: 'lesioni_iii_avg',     medKey: 'lesioni_iii_median',    dir: 'MIN', settore: 'LESIONI'      },
  { target: 'Ospiti Caduti',       calcolo: '[OSPITI CADUTI] / [OSPITI ASSISTITI NEL MESE]',                                                                   label: 'Ospiti Caduti',   avgKey: 'caduti_avg',          medKey: null,                    dir: 'MIN', settore: 'CADUTE'       },
  { target: 'Cadute Totali',       calcolo: '[CADUTE TOTALI] / [OSPITI ASSISTITI NEL MESE]',                                                                   label: 'Cadute Totali',   avgKey: 'cadute_avg',          medKey: null,                    dir: 'MIN', settore: 'CADUTE'       },
  { target: 'Cadute Gravi',        calcolo: '[CADUTE GRAVI] / [OSPITI ASSISTITI NEL MESE]',                                                                    label: 'Cadute Gravi',    avgKey: 'cadute_gravi_avg',    medKey: null,                    dir: 'MIN', settore: 'CADUTE'       },
  { target: 'Contenzioni',         calcolo: '[NUMERO OSPITI CON ALMENO UNA CONTENZIONE PRESCRITTA] / [OSPITI ASSISTITI NEL MESE]',                             label: 'Contenzioni',     avgKey: 'contenzioni_avg',     medKey: 'contenzioni_median',    dir: 'MIN', settore: 'CONTENZIONI'  },
  { target: 'Cont. solo Spondine', calcolo: '[NUMERO OSPITI CON SOLO SPONDINE A LETTO] / [OSPITI ASSISTITI NEL MESE]',                                         label: 'Spondine',        avgKey: 'spondine_avg',        medKey: 'spondine_median',       dir: 'MIN', settore: 'CONTENZIONI'  },
  { target: 'PI PAI 30gg',         calcolo: '[OSPITI CON PI PAI REDATTO ENTRO 30 GG DALL INGRESSO] / [OSPITI ASSISTITI NEL MESE]',                             label: 'PI PAI 30gg',     avgKey: 'pipai_30_avg',        medKey: null,                    dir: 'MAX', settore: 'COMPLIANCE'   },
  { target: 'PI PAI 180gg',        calcolo: '[OSPITI CON PI PAI AGGIORNATO ENTRO 180 GG] / [OSPITI ASSISTITI NEL MESE]',                                       label: 'PI PAI 180gg',    avgKey: 'pipai_180_avg',       medKey: null,                    dir: 'MAX', settore: 'COMPLIANCE'   },
  { target: 'Form. Sicurezza',     calcolo: '[NUMERO DIPENDENTI CON FORMAZIONE SICUREZZA VALIDA] / [NUMERO TOTALE DIPENDENTI SOGGETTI A FORMAZIONE SICUREZZA]', label: 'Form. Sicurezza', avgKey: 'form_sic_avg',        medKey: null,                    dir: 'MAX', settore: 'COMPLIANCE'   },
  { target: 'Form. HACCP',         calcolo: '[NUMERO DIPENDENTI CON FORMAZIONE HACCP VALIDA] / [NUMERO TOTALE DIPENDENTI SOGGETTI A FORMAZIONE HACCP]',         label: 'Form. HACCP',     avgKey: 'form_haccp_avg',      medKey: null,                    dir: 'MAX', settore: 'COMPLIANCE'   },
];

const MONTH_NAMES = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];

function getColor(value, rule, isPerc) {
  if (value === null) return '#94a3b8';
  const v = isPerc ? value / 100 : value;
  const tv = rule?.target_verde;
  const tr = rule?.target_rosso;
  if (tv === null || tr === null || !rule?.direzione) return '#6366f1';
  if (rule.direzione === 'MAX') {
    if (v >= tv) return '#10b981';
    if (v <= tr) return '#ef4444';
    return '#f59e0b';
  }
  if (v <= tv) return '#10b981';
  if (v >= tr) return '#ef4444';
  return '#f59e0b';
}


export function BenchmarkTab({ facility, kpiRecords, year }) {
  const [benchData, setBenchData]     = useState([]);
  const [loading, setLoading]         = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const m = new Date().getMonth(); // mese corrente 0-based
    return m === 0 ? 12 : m;        // mese precedente
  });
  const [selectedKpi, setSelectedKpi] = useState(BENCH_KPIS[0].target);

  useEffect(() => {
    supabase
      .from('v_benchmark_anonymous')
      .select('*')
      .eq('year', year)
      .then(({ data, error }) => {
        if (!error) setBenchData(data || []);
        setLoading(false);
      });
  }, [year]);

  const timeHorizon = useMemo(() => getTimeHorizon(year), [year]);

  // Benchmark del mese selezionato per il proprio UDO
  const monthBench = useMemo(() =>
    benchData.find(b => b.udo_name === facility.udo_name && Number(b.month) === selectedMonth),
    [benchData, facility.udo_name, selectedMonth]
  );

  // Record KPI della struttura per il mese selezionato
  const myRecord = useMemo(() =>
    kpiRecords.find(k =>
      String(k.facility_id) === String(facility.id) &&
      Number(k.year) === year &&
      Number(k.month) === selectedMonth &&
      k.status === 'completed'
    ),
    [kpiRecords, facility.id, year, selectedMonth]
  );

  // Dati overview mese: struttura vs media UDO per tutti i 15 KPI
  const overviewData = useMemo(() => {
    return BENCH_KPIS.map(kpi => {
      const rule = KPI_RULES.find(r => r.kpi_target === kpi.target);
      const isPerc = !['NUMERI', 'ISPEZIONI'].includes(kpi.settore);

      let myValue = null;
      if (myRecord?.metrics_json) {
        const raw = computeKpiValue({ ...rule, calcolo: kpi.calcolo }, myRecord.metrics_json, facility);
        myValue = raw;
      }

      const udoAvg = monthBench && kpi.avgKey ? monthBench[kpi.avgKey] : null;
      const udoAvgPerc = udoAvg !== null && udoAvg !== undefined ? Math.round(udoAvg * 1000) / 10 : null;

      return {
        label:    kpi.label,
        target:   kpi.target,
        myValue,
        udoAvg:   udoAvgPerc,
        color:    getColor(myValue, rule, isPerc),
        rule,
        isPerc,
        dir:      kpi.dir,
      };
    });
  }, [myRecord, monthBench, facility]);

  // Dati trend: struttura + media UDO per KPI selezionato nei 12 mesi
  const trendData = useMemo(() => {
    const kpi  = BENCH_KPIS.find(k => k.target === selectedKpi);
    const rule = KPI_RULES.find(r => r.kpi_target === selectedKpi);
    if (!kpi || !rule) return [];

    return timeHorizon.map(t => {
      const rec = kpiRecords.find(k =>
        String(k.facility_id) === String(facility.id) &&
        Number(k.year) === t.yearNum &&
        Number(k.month) === t.monthNum &&
        k.status === 'completed'
      );

      let myVal = null;
      if (rec?.metrics_json) {
        myVal = computeKpiValue({ ...rule, calcolo: kpi.calcolo }, rec.metrics_json, facility);
      }

      const benchMonth = benchData.find(b =>
        b.udo_name === facility.udo_name &&
        Number(b.year) === t.yearNum &&
        Number(b.month) === t.monthNum
      );
      const udoVal = benchMonth && kpi.avgKey
        ? Math.round((benchMonth[kpi.avgKey] || 0) * 1000) / 10
        : null;

      return { name: t.label, struttura: myVal, udo_media: udoVal };
    });
  }, [selectedKpi, timeHorizon, kpiRecords, benchData, facility]);

  const activeKpi = BENCH_KPIS.find(k => k.target === selectedKpi);
  const activeRule = KPI_RULES.find(r => r.kpi_target === selectedKpi);

  if (loading) {
    return <div className="text-center py-12 text-slate-400 animate-pulse font-bold">Caricamento benchmark...</div>;
  }

  const hasEnoughData = !!monthBench;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h2 className="font-black text-slate-800 text-lg">Benchmark {year}</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            {facility.udo_name} — confronto anonimo con strutture dello stesso tipo
            {!hasEnoughData && <span className="ml-2 text-amber-600 font-bold">(servono almeno 3 strutture con dati)</span>}
          </p>
        </div>
        {/* Selettore mese */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Mese</span>
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(Number(e.target.value))}
            className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400"
          >
            {MONTH_NAMES.map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      {/* OVERVIEW: barre struttura vs media UDO */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="font-black text-slate-700 mb-1">
          Struttura vs Media UDO — {MONTH_NAMES[selectedMonth - 1]} {year}
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          {myRecord ? 'Dati inseriti per questo mese' : 'Nessun dato inserito per questo mese — solo media UDO visibile'}
        </p>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          {overviewData.map(d => (
            <div
              key={d.target}
              onClick={() => setSelectedKpi(d.target)}
              className={`rounded-xl p-3 border cursor-pointer transition-all hover:shadow-md ${
                selectedKpi === d.target ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-slate-50'
              }`}
            >
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2 truncate" title={d.label}>
                {d.label}
              </p>
              {/* Barra struttura */}
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                <span className="text-sm font-black" style={{ color: d.color }}>
                  {d.myValue !== null ? `${d.myValue}%` : '—'}
                </span>
              </div>
              {/* Media UDO */}
              {d.udoAvg !== null && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
                  <span className="text-xs font-bold text-slate-400">{d.udoAvg}%</span>
                </div>
              )}
              <p className="text-[9px] text-slate-300 mt-1 uppercase">
                {d.dir === 'MAX' ? '↑ max' : '↓ min'}
              </p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <div className="w-3 h-1 rounded bg-indigo-400" /> Struttura
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <div className="w-3 h-1 rounded bg-slate-400" /> Media UDO
          </div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-600">
            <div className="w-2 h-2 rounded-full bg-emerald-500" /> In target
          </div>
          <div className="flex items-center gap-1.5 text-xs text-amber-600">
            <div className="w-2 h-2 rounded-full bg-amber-400" /> Allerta
          </div>
          <div className="flex items-center gap-1.5 text-xs text-red-600">
            <div className="w-2 h-2 rounded-full bg-red-500" /> Critico
          </div>
        </div>
      </div>

      {/* TREND: KPI selezionato nei 12 mesi */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
          <div>
            <h3 className="font-black text-slate-700">
              Trend 12 mesi — {activeKpi?.label}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Clicca un KPI sopra per cambiare indicatore
            </p>
          </div>
          <select
            value={selectedKpi}
            onChange={e => setSelectedKpi(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400"
          >
            {BENCH_KPIS.map(k => (
              <option key={k.target} value={k.target}>{k.label}</option>
            ))}
          </select>
        </div>

        {/* Target lines */}
        {activeRule?.target_verde && (
          <div className="flex items-center gap-4 mb-3 text-xs">
            <span className="flex items-center gap-1.5 text-emerald-600 font-bold">
              <div className="w-4 h-0.5 bg-emerald-500" />
              Target verde: {(activeRule.target_verde * 100).toFixed(0)}%
            </span>
            <span className="flex items-center gap-1.5 text-red-600 font-bold">
              <div className="w-4 h-0.5 bg-red-500 border-dashed" style={{borderTop: '2px dashed #ef4444', height: 0}} />
              Target rosso: {(activeRule.target_rosso * 100).toFixed(0)}%
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
            <Legend
              formatter={v => v === 'struttura' ? 'Struttura' : 'Media UDO'}
              wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }}
            />
            {activeRule?.target_verde && (
              <ReferenceLine
                y={activeRule.target_verde * 100}
                stroke="#10b981"
                strokeDasharray="5 5"
                strokeWidth={1.5}
              />
            )}
            {activeRule?.target_rosso && (
              <ReferenceLine
                y={activeRule.target_rosso * 100}
                stroke="#ef4444"
                strokeDasharray="5 5"
                strokeWidth={1.5}
              />
            )}
            <Line
              type="monotone"
              dataKey="struttura"
              stroke="#4f46e5"
              strokeWidth={2.5}
              dot={{ r: 4, fill: '#4f46e5', strokeWidth: 0 }}
              activeDot={{ r: 6 }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="udo_media"
              stroke="#94a3b8"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

    </div>
  );
}

// ── SurveyAnalysisTab ─────────────────────────────────────────
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
      const data = typeof latest.responses_json === 'string'
        ? JSON.parse(latest.responses_json)
        : latest.responses_json;
      if (Array.isArray(data)) return data;
      return Object.entries(data).map(([question, answers]) => ({ question, answers }));
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
            const total = entries.reduce((s,[,v]) => s + v, 0);
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
