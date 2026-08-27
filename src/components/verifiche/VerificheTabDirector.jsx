// src/components/verifiche/VerificheTabDirector.jsx
// Tab "Verifiche" dentro DirectorFacility.jsx: template risolti per la
// struttura (ereditarietà facility > udo > universale), registrazione
// sessione, storico, pannello "In evidenza", scadenzario.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import {
  getTemplates, getRuoli, getTemplateRuoli, getSessioni, getTemplateVoci,
  getScadenze, creaSessioneConEsiti,
} from '../../services/verificheService';
import { resolveTemplatesForFacility, resolveRuoliAbilitati } from '../../utils/verificheResolve';
import { computeNextDueDate, daysOverdue, formatCadenza } from '../../utils/verificheCadenza';
import { getVerificheAlertsForFacility } from '../../utils/verificheAlertEngine';
import VerificheAlertPanel from './VerificheAlertPanel';
import ScadenzeStruttura from './ScadenzeStruttura';
import RegistraSessioneModal from './RegistraSessioneModal';

export default function VerificheTabDirector({ facility }) {
  const { profile } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [ruoli, setRuoli] = useState([]);
  const [templateRuoli, setTemplateRuoli] = useState([]);
  const [sessioni, setSessioni] = useState([]);
  const [scadenze, setScadenze] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sessioneTarget, setSessioneTarget] = useState(null); // template selezionato per registrare

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, r, tr, s, sc] = await Promise.all([
        getTemplates(), getRuoli(), getTemplateRuoli(), getSessioni([facility.id]), getScadenze([facility.id]),
      ]);
      setTemplates(t); setRuoli(r); setTemplateRuoli(tr); setSessioni(s); setScadenze(sc);
    } catch (err) {
      toast.error(`Errore caricamento verifiche: ${err.message ?? err}`);
    } finally {
      setLoading(false);
    }
  }, [facility.id]);

  useEffect(() => { load(); }, [load]);

  const applicabili = useMemo(
    () => resolveTemplatesForFacility(facility, templates, templateRuoli),
    [facility, templates, templateRuoli]
  );

  const alerts = useMemo(
    () => getVerificheAlertsForFacility(facility, templates, templateRuoli, sessioni),
    [facility, templates, templateRuoli, sessioni]
  );
  const alertByTemplate = useMemo(() => new Map(alerts.map(a => [a.templateId, a])), [alerts]);

  const ultimaSessionePer = (templateId) => {
    const s = sessioni.filter(x => x.template_id === templateId);
    return s.length ? s.reduce((max, x) => new Date(x.data_esecuzione) > new Date(max.data_esecuzione) ? x : max) : null;
  };

  const handleRegistra = async ({ esiti, note }) => {
    try {
      const ruoliAbilitati = resolveRuoliAbilitati(sessioneTarget.id, facility, templateRuoli, ruoli);
      await creaSessioneConEsiti(
        {
          template_id: sessioneTarget.id,
          facility_id: facility.id,
          data_esecuzione: new Date().toISOString().split('T')[0],
          eseguita_da: profile?.id,
          ruolo_id: ruoliAbilitati[0]?.id ?? null,
          note,
        },
        esiti
      );
      setSessioneTarget(null);
      load();
      toast.success('Sessione registrata');
    } catch (err) {
      toast.error(`Errore registrazione sessione: ${err.message ?? err}`);
    }
  };

  if (loading) return <div className="text-center py-12 text-slate-400 animate-pulse font-medium">Caricamento...</div>;

  return (
    <div className="space-y-5">
      <VerificheAlertPanel alerts={alerts} showFacilityName={false} onSelect={(a) => setSessioneTarget(applicabili.find(t => t.id === a.templateId))} />

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Verifiche assegnate</h3>
        </div>
        {applicabili.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">Nessuna verifica assegnata a questa struttura.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {applicabili.map(t => {
              const ultima = ultimaSessionePer(t.id);
              const nextDue = computeNextDueDate(t, ultima?.data_esecuzione ?? null);
              const overdue = daysOverdue(nextDue);
              const alert = alertByTemplate.get(t.id);
              return (
                <li key={t.id}>
                  <button onClick={() => setSessioneTarget(t)} className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 text-left">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-700">{t.nome}</p>
                      <p className="text-[11px] text-slate-400">{t.categoria} · {formatCadenza(t)}{ultima ? ` · ultima: ${new Date(ultima.data_esecuzione).toLocaleDateString('it-IT')}` : ' · mai eseguita'}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {alert && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${alert.severity === 'alta' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{overdue}gg</span>}
                      <ChevronRight size={14} className="text-slate-300" />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-3">Scadenze normative</h3>
        <ScadenzeStruttura scadenze={scadenze} />
      </div>

      {sessioneTarget && (
        <RegistraSessioneModal
          template={sessioneTarget}
          onClose={() => setSessioneTarget(null)}
          onSave={handleRegistra}
        />
      )}
    </div>
  );
}
