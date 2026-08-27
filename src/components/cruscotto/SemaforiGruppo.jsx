// src/components/cruscotto/SemaforiGruppo.jsx
// 5 semafori aggregati per area (documento redesign /report, §2 Cruscotto).
// Solo 3 hanno oggi una fonte dati reale: Qualità (KPI), Soddisfazione
// (survey), Conformità (NC). Economico e Personale non hanno ancora fonte
// dati (nessun CDG economico, nessuna sezione Verifiche) e vengono mostrati
// come "Dato non disponibile" invece di essere nascosti, per comunicare cosa
// arriverà nelle fasi successive del redesign.
import React, { useMemo } from 'react';
import { ClipboardCheck, Smile, ShieldAlert, Wallet, Users2 } from 'lucide-react';
import { RISK_BADGE, calcFacilityRiskScore } from '../../utils/riskScoreEngine';
import { RISK_THRESHOLDS } from '../../config/riskWeights';

function Semaforo({ icon: Icon, title, level, detail, disponibile, onClick }) {
  const badge = disponibile ? (RISK_BADGE[level] ?? RISK_BADGE.unknown) : RISK_BADGE.unknown;
  const clickable = disponibile && !!onClick;
  return (
    <button
      onClick={clickable ? onClick : undefined}
      disabled={!clickable}
      className={`bg-white border rounded-2xl p-4 flex flex-col gap-2 text-left transition-colors ${
        clickable ? 'border-slate-200 hover:border-slate-300 cursor-pointer' : 'border-slate-100 cursor-default'
      } ${disponibile ? '' : 'opacity-70'}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={16} className="text-slate-500" />
          <span className="text-xs font-semibold text-slate-700">{title}</span>
        </div>
        <span className={`w-2.5 h-2.5 rounded-full ${badge.dot}`} />
      </div>
      <p className={`text-sm font-bold ${badge.text}`}>
        {disponibile ? badge.label : 'Dato non disponibile'}
      </p>
      <p className="text-[11px] text-slate-400 leading-snug">{detail}</p>
    </button>
  );
}

export default function SemaforiGruppo({ facilities, kpiRecords, surveys, nonConformities, onNavigate }) {
  const qualita = useMemo(() => {
    const active = (facilities ?? []).filter(f => !f.is_suspended);
    const scores = active
      .map(f => calcFacilityRiskScore(f, kpiRecords))
      .filter(r => r.score !== null);
    if (scores.length === 0) return { level: 'unknown', detail: 'Nessun dato KPI disponibile' };
    const avg = Math.round(scores.reduce((s, r) => s + r.score, 0) / scores.length);
    const level = avg < RISK_THRESHOLDS.LOW ? 'low' : avg < RISK_THRESHOLDS.MEDIUM ? 'medium' : 'high';
    return { level, detail: `Rischio composito medio: ${avg}/100 su ${scores.length} strutture` };
  }, [facilities, kpiRecords]);

  const soddisfazione = useMemo(() => {
    const clientTypes = (surveys ?? []).filter(s => s.type === 'client');
    if (clientTypes.length === 0) return { level: 'unknown', detail: 'Nessuna campagna survey disponibile' };
    // Prossimità euristica: usiamo la % di strutture con survey ospiti completata
    // di recente come proxy fino a quando §3 (Soddisfazione) non porta il benchmark reale.
    const withFacility = new Set(clientTypes.map(s => s.facility_id).filter(Boolean));
    const active = (facilities ?? []).filter(f => !f.is_suspended);
    const coverage = active.length > 0 ? withFacility.size / active.length : 0;
    const level = coverage >= 0.7 ? 'low' : coverage >= 0.4 ? 'medium' : 'high';
    return { level, detail: `${withFacility.size}/${active.length} strutture con survey ospiti recente` };
  }, [surveys, facilities]);

  const conformita = useMemo(() => {
    const aperte = (nonConformities ?? []).filter(nc => nc.stato !== 'Chiuso');
    if ((nonConformities ?? []).length === 0) return { level: 'unknown', detail: 'Nessuna NC registrata' };
    const level = aperte.length === 0 ? 'low' : aperte.length <= 5 ? 'medium' : 'high';
    return { level, detail: `${aperte.length} NC aperte/in lavorazione sul gruppo` };
  }, [nonConformities]);

  return (
    <div className="grid grid-cols-5 gap-3">
      <Semaforo icon={ClipboardCheck} title="Qualità" disponibile level={qualita.level} detail={qualita.detail}
        onClick={onNavigate ? () => onNavigate('report') : undefined} />
      <Semaforo icon={Smile} title="Soddisfazione" disponibile level={soddisfazione.level} detail={soddisfazione.detail}
        onClick={onNavigate ? () => onNavigate('dashboard') : undefined} />
      <Semaforo icon={ShieldAlert} title="Conformità" disponibile level={conformita.level} detail={conformita.detail}
        onClick={onNavigate ? () => onNavigate('nc') : undefined} />
      <Semaforo icon={Wallet} title="Economico" disponibile={false}
        detail="Nessun dato di fatturato/costi in QualiCAVA oggi — in valutazione (vedi nota in calce al documento di redesign)." />
      <Semaforo icon={Users2} title="Personale" disponibile={false}
        detail="Richiede la sezione operativa Verifiche (minutaggi assistenziali) — non ancora costruita." />
    </div>
  );
}
