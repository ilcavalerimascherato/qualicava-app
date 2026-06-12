// src/components/OverviewTab.jsx
// Panoramica struttura — sostituisce il blocco inline in DirectorFacility.jsx
// Props: { facility, surveys, year, fBadge, cdgRecords, kpiRecords, onTabChange }

import { useState, useEffect, useMemo } from 'react';
import { Save, Loader2 } from 'lucide-react';
import { supabase }         from '../supabaseClient';
import { calcFacilityRiskScore, RISK_BADGE } from '../utils/riskScoreEngine';
import CdgStrutturaCard from './CdgStrutturaCard';

const ORG_CONFIG = [
  { key: 'director',            emailKey: 'email_direzione',           label: 'Direttore',      icon: '👤' },
  { key: 'director_sanitario',  emailKey: 'email_sanitario',           label: 'Dir. Sanitario', icon: '⚕️' },
  { key: 'referente_struttura', emailKey: 'email_referente_struttura', label: 'Ref. Struttura', icon: '🏠' },
  { key: 'referent',            emailKey: 'email_qualita',             label: 'Ref. Qualità',   icon: '✅' },
];

// ── Helpers UI ───────────────────────────────────────────────
function Badge({ children, variant = 'gray' }) {
  const styles = {
    green:  'bg-green-50 text-green-700 border-green-200',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    red:    'bg-red-50 text-red-700 border-red-200',
    blue:   'bg-blue-50 text-blue-700 border-blue-200',
    gray:   'bg-gray-100 text-gray-500 border-gray-200',
  };
  return (
    <span className={`text-[13px] font-medium px-2 py-0.5 rounded-full border ${styles[variant]}`}>
      {children}
    </span>
  );
}

function CardSection({ title, action, onAction, children }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[12px] font-medium text-gray-400 uppercase tracking-wider">{title}</p>
        {action && (
          <button onClick={onAction}
            className="text-[12px] text-indigo-600 hover:text-indigo-800 cursor-pointer">
            {action}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

// ── OrgStatoPill ─────────────────────────────────────────────
function OrgStatoPill({ email }) {
  if (!email) return (
    <span className="text-[12px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-lg">
      Nessuna mail
    </span>
  );
  return (
    <span className="text-[12px] font-bold text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-lg">
      {email}
    </span>
  );
}


// ── Risk Score card ──────────────────────────────────────────
function RiskScoreCard({ facility, kpiRecords, onTabChange }) {
  const { score, level, months, detail } = useMemo(
    () => calcFacilityRiskScore(facility, kpiRecords),
    [facility, kpiRecords]
  );

  const badge    = RISK_BADGE[level] || RISK_BADGE.low;
  const barColor = level === 'high' ? 'bg-red-500' : level === 'medium' ? 'bg-yellow-400' : 'bg-green-500';

  const lastRecord = useMemo(() => kpiRecords
    ?.filter(r => r.facility_id === facility.id && r.status === 'completed')
    ?.sort((a, b) => b.year * 100 + b.month - (a.year * 100 + a.month))
    ?.[0], [kpiRecords, facility.id]);

  const topKpis = useMemo(() => {
    if (!lastRecord?.metrics_json) return [];
    const m = lastRecord.metrics_json;
    const ospiti  = parseFloat(m['Ospiti assistiti nel mese']?.value) || null;
    const totDip  = parseFloat(m['Numero totale dipendenti soggetti a formazione sicurezza']?.value) || null;

    // detail[].kpi === rule.kpi_target (etichetta breve); status === 'red'|'yellow'|'green'
    const kpiDetail = detail?.reduce((acc, d) => { acc[d.kpi] = d.status; return acc; }, {}) || {};
    const s = (kpiTarget) => kpiDetail[kpiTarget] || 'gray';
    const colorDot = { red: 'bg-red-500', yellow: 'bg-yellow-400', green: 'bg-green-500', gray: 'bg-gray-300' };

    const raw = (key) => {
      const v = m[key]?.value;
      return (v !== '' && v != null) ? parseFloat(v) : null;
    };

    const farmaci     = raw('numero farmaci mediamente assunti in una giornata campione');
    const contenzioni = raw('numero ospiti con almeno una contenzione prescritta');
    const formSic     = raw('Numero dipendenti con formazione sicurezza valida');

    return [
      {
        label: 'Ospiti con LDP',
        val: raw('Numero ospiti con lesioni da pressione in trattamento'),
        dot: colorDot[s('Ospiti con Lesioni')],
      },
      {
        label: 'LDP > III stadio',
        val: raw('Numero lesioni da pressione superiori al III stadio'),
        dot: colorDot[s('Lesioni > III Stadio')],
      },
      {
        label: 'Cadute totali',
        val: raw('Cadute totali'),
        dot: colorDot[s('Cadute Totali')],
      },
      {
        label: 'Farmaci/osp/die',
        val: farmaci != null ? farmaci.toFixed(1) : null,
        dot: colorDot[s('Farmaci Die')],
      },
      {
        label: 'Contenzioni %',
        val: contenzioni != null && ospiti
          ? `${((contenzioni / ospiti) * 100).toFixed(1)}%`
          : contenzioni != null ? contenzioni : null,
        dot: colorDot[s('Contenzioni')],
      },
      {
        label: 'Form. sicurezza %',
        val: formSic != null && totDip
          ? `${((formSic / totDip) * 100).toFixed(1)}%`
          : formSic != null ? formSic : null,
        dot: colorDot[s('Form. Sicurezza')],
      },
    ].filter(k => k.val !== null);
  }, [lastRecord, detail]);

  return (
    <CardSection title="Indice di rischio" action="→ KPI mensili" onAction={() => onTabChange?.('kpi')}>
      <div className="flex items-center gap-3 mb-2">
        <span className="text-4xl font-medium" style={{ color: badge.color }}>
          {score ?? '—'}
        </span>
        <span className="text-base font-medium px-2 py-0.5 rounded-full"
          style={{ background: badge.bg, color: badge.color }}>
          {level === 'high' ? 'Alto' : level === 'medium' ? 'Medio' : 'Basso'}
        </span>
        {months < 3 && score !== null && (
          <span className="text-[12px] text-gray-400">{months} mes{months === 1 ? 'e' : 'i'}</span>
        )}
      </div>
      <div className="h-1 bg-gray-100 rounded-full overflow-hidden mb-2">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${score ?? 0}%` }} />
      </div>
      <p className="text-[12px] text-gray-400 mb-3">Media mobile ultimi {months || 0} mesi consolidati</p>
      {lastRecord && (
        <p className="text-[10px] text-gray-400 mb-2">
          Ultimo mese inserito: {lastRecord.month}/{lastRecord.year}
        </p>
      )}
      {topKpis.length > 0 ? (
        <div className="grid grid-cols-2 gap-1">
          {topKpis.map(k => (
            <div key={k.label} className="flex items-center gap-1.5 py-1 border-b border-gray-100 last:border-0">
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${k.dot}`} />
              <span className="text-[13px] text-gray-500 flex-1 truncate">{k.label}</span>
              <span className="text-[13px] font-medium text-gray-700">{k.val || '—'}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[13px] text-gray-400 italic">Nessun KPI inserito per il periodo</p>
      )}
    </CardSection>
  );
}

// ── Survey + NC card ─────────────────────────────────────────
function SurveyNcCard({ facility, surveys, fBadge, onTabChange }) {
  const [ncList, setNcList] = useState([]);

  useEffect(() => {
    if (!facility?.id) return;
    supabase
      .from('non_conformities')
      .select('id, titolo, stato, created_at, gravita')
      .eq('facility_id', facility.id)
      .neq('stato', 'Chiuso')
      .order('created_at', { ascending: false })
      .limit(3)
      .then(({ data }) => setNcList(data || []));
  }, [facility?.id]);

  const clientSurvey = surveys?.find(s => s.type === 'client');
  const staffSurvey  = surveys?.find(s => s.type === 'operator');

  const surveyVariant = s => {
    if (!s) return 'gray';
    if (s.ai_report_direzione) return 'green';
    return 'yellow';
  };
  const surveyLabel = s => {
    if (!s) return 'Nessun dato';
    if (s.ai_report_direzione) return 'Relazione OK';
    return 'Da elaborare';
  };

  const ncDot = severity => {
    if (!severity) return 'bg-gray-300';
    if (severity === 'Critica' || severity === 'Alta') return 'bg-red-500';
    return 'bg-yellow-400';
  };

  return (
    <CardSection title="Survey &amp; non conformità">
      <div className="space-y-2 mb-3">
        <div className="flex items-center justify-between py-1.5 border-b border-gray-100">
          <div>
            <p className="text-base font-medium text-gray-700">Clienti / Ospiti</p>
            <p className="text-[12px] text-gray-400">
              {clientSurvey
                ? `${clientSurvey.summary_stats?.total_responses ?? '?'} risposte · ${clientSurvey.calendar_id}`
                : 'Nessun dato disponibile'}
            </p>
            {clientSurvey?.summary_stats?.is_company_wide && (
              <p className="text-[10px] text-blue-600 mt-1">
                ⚠ Rilevazione societaria — {clientSurvey.summary_stats.nome_survey}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={surveyVariant(clientSurvey)}>{surveyLabel(clientSurvey)}</Badge>
            <button onClick={() => onTabChange?.('analysis')} className="text-[12px] text-indigo-600">→</button>
          </div>
        </div>
        <div className="flex items-center justify-between py-1.5">
          <div>
            <p className="text-base font-medium text-gray-700">Staff / Operatori</p>
            <p className="text-[12px] text-gray-400">
              {staffSurvey
                ? `${staffSurvey.summary_stats?.total_responses ?? '?'} risposte · ${staffSurvey.calendar_id}`
                : 'Nessun dato disponibile'}
            </p>
            {staffSurvey?.summary_stats?.is_company_wide && (
              <p className="text-[10px] text-blue-600 mt-1">
                ⚠ Rilevazione societaria — {staffSurvey.summary_stats.nome_survey}
              </p>
            )}
          </div>
          <Badge variant={surveyVariant(staffSurvey)}>{surveyLabel(staffSurvey)}</Badge>
        </div>
      </div>

      <div className="border-t border-gray-100 pt-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[12px] font-medium text-gray-400 uppercase tracking-wider">Non conformità aperte</p>
          <button onClick={() => onTabChange?.('non_conformities')} className="text-[12px] text-indigo-600">
            {fBadge?.nc > 0 ? `${fBadge.nc} totali →` : '→ vedi'}
          </button>
        </div>
        {ncList.length === 0 ? (
          <p className="text-[13px] text-gray-400 italic">Nessuna NC aperta</p>
        ) : (
          <div className="space-y-1">
            {ncList.map(nc => (
              <div key={nc.id} className="flex items-center gap-2 py-1 border-b border-gray-100 last:border-0">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${ncDot(nc.gravita)}`} />
                <span className="text-[13px] text-gray-700 flex-1 truncate">{nc.titolo || '—'}</span>
                <span className="text-[12px] text-gray-400">
                  {new Date(nc.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </CardSection>
  );
}

// ── Contatti card (con editing inline) ───────────────────────
function ContattiCard({ facility: f }) {
  const [editing, setEditing] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [form,    setForm]    = useState({
    director:                  f.director                      || '',
    email_direzione:           f.email_direzione               || '',
    director_sanitario:        f.director_sanitario            || '',
    email_sanitario:           f.email_sanitario               || '',
    referente_struttura:       f.referente_struttura           || '',
    email_referente_struttura: f.email_referente_struttura     || '',
    referent:                  f.referent                      || '',
    email_qualita:             f.email_qualita                 || '',
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from('facilities').update({
        director:                  form.director                  || null,
        email_direzione:           form.email_direzione           || null,
        director_sanitario:        form.director_sanitario        || null,
        email_sanitario:           form.email_sanitario           || null,
        referente_struttura:       form.referente_struttura       || null,
        email_referente_struttura: form.email_referente_struttura || null,
        referent:                  form.referent                  || null,
        email_qualita:             form.email_qualita             || null,
      }).eq('id', f.id);
      if (error) throw error;
      setEditing(false);
    } catch (err) {
      alert('Errore salvataggio: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <p className="text-[12px] font-medium text-gray-400 uppercase tracking-wider">Riferimenti struttura</p>
        <button
          onClick={() => setEditing(e => !e)}
          className={`text-base font-black uppercase tracking-widest px-3 py-1.5 rounded-lg transition-colors ${
            editing ? 'bg-slate-200 text-slate-600' : 'bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100'
          }`}
        >
          {editing ? 'Annulla' : '✎ Modifica'}
        </button>
      </div>

      <div className="divide-y divide-slate-50">
        {ORG_CONFIG.map(({ key, emailKey, label, icon }) => {
          const nome  = f[key];
          const email = f[emailKey];

          return (
            <div key={key} className="px-4 py-3">
              <div className="flex items-start gap-2">
                <span className="text-lg mt-0.5">{icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[12px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
                    <OrgStatoPill email={email} />
                  </div>
                  {editing ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                      <input type="text" value={form[key]}
                        onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                        placeholder={`Nome ${label}`}
                        className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-lg outline-none focus:border-indigo-400 transition-all" />
                      <input type="email" value={form[emailKey]}
                        onChange={e => setForm(p => ({ ...p, [emailKey]: e.target.value }))}
                        placeholder="Email"
                        className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-lg outline-none focus:border-indigo-400 transition-all" />
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-lg font-bold ${nome ? 'text-slate-800' : 'text-slate-300 italic'}`}>
                        {nome || 'Non assegnato'}
                      </span>
                      {email && (
                        <a href={`mailto:${email}`} className="text-base text-indigo-500 hover:text-indigo-700" title={email}>✉</a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {editing && (
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2 rounded-xl text-base font-black uppercase shadow hover:bg-indigo-700 transition-colors disabled:opacity-60">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Salva contatti
          </button>
        </div>
      )}
    </div>
  );
}

// ── Società + Struttura + Documenti card ─────────────────────
function SocietaCard({ facility, company, fBadge, onTabChange, onEditStructure }) {
  return (
    <CardSection title="Società &amp; struttura" action="modifica struttura" onAction={onEditStructure}>
      <div className="flex items-center gap-2.5 mb-3">
        {company?.logo_url ? (
          <img src={company.logo_url} alt="" className="w-8 h-8 rounded object-contain" />
        ) : (
          <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center text-[12px] font-medium text-gray-500">
            {company?.name?.[0] || '?'}
          </div>
        )}
        <div>
          <p className="text-lg font-medium text-gray-800">{company?.name || '—'}</p>
          <p className="text-[12px] text-gray-400">{company?.piva || ''}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[13px] mb-3">
        {[
          ['Sede legale', company?.sede_legale],
          ['Regione',     facility?.region],
          ['UDO',         facility?.udo_name],
          ['Posti letto', facility?.bed_count || null],
          ['Indirizzo',   facility?.address],
        ].map(([label, val]) => (
          <div key={label}>
            <p className="text-gray-400 mb-0.5">{label}</p>
            <p className="font-medium text-gray-700">{val || '—'}</p>
          </div>
        ))}
      </div>

      <div className="border-t border-gray-100 pt-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[12px] font-medium text-gray-400 uppercase tracking-wider">Documenti</p>
          <button onClick={() => onTabChange?.('haccp')} className="text-[12px] text-indigo-600">→ vedi tutti</button>
        </div>
        <div className="space-y-1.5">
          {[
            ['In scadenza (30gg)', fBadge?.documenti, 'yellow'],
            ['HACCP critici',      fBadge?.haccpRossi, 'red'],
          ].map(([label, count, variant]) => (
            <div key={label} className="flex items-center justify-between text-[13px]">
              <span className="text-gray-500">{label}</span>
              <Badge variant={count > 0 ? variant : 'gray'}>{count ?? 0}</Badge>
            </div>
          ))}
        </div>
      </div>
    </CardSection>
  );
}

// ── Componente principale ────────────────────────────────────
export default function OverviewTab({ facility, surveys, year, fBadge, cdgRecords, kpiRecords, onTabChange, onEditStructure }) {
  const [company, setCompany] = useState(null);

  useEffect(() => {
    if (!facility?.company_id) return;
    supabase
      .from('companies')
      .select('name, piva, sede_legale, logo_url')
      .eq('id', facility.company_id)
      .single()
      .then(({ data }) => setCompany(data));
  }, [facility?.company_id]);

  const latestSurveys = useMemo(() => {
    if (!surveys?.length) return [];
    const byType = {};
    for (const s of surveys) {
      if (!byType[s.type] || s.calendar_id > byType[s.type].calendar_id) byType[s.type] = s;
    }
    return Object.values(byType);
  }, [surveys]);

  return (
    <div className="space-y-3">
      {/* Riga 1: Risk score + CDG + Survey/NC */}
      <div className="grid grid-cols-3 gap-3">
        <RiskScoreCard facility={facility} kpiRecords={kpiRecords} onTabChange={onTabChange} />
        <CdgStrutturaCard facility={facility} cdgRecords={cdgRecords} />
        <SurveyNcCard facility={facility} surveys={latestSurveys} fBadge={fBadge} onTabChange={onTabChange} />
      </div>

      {/* Riga 2: Contatti + Società */}
      <div className="grid grid-cols-2 gap-3">
        <ContattiCard facility={facility} />
        <SocietaCard facility={facility} company={company} fBadge={fBadge} onTabChange={onTabChange} onEditStructure={onEditStructure} />
      </div>
    </div>
  );
}
