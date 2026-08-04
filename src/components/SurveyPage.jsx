// src/components/SurveyPage.jsx
// Pagina Survey unificata della dashboard direttore — sostituisce le vecchie
// tab separate "Survey" / "Analisi Survey" / "Analisi campagne".
// Selettore tipo (client/operator) e periodo (Standard/Personalizzato) sono
// qui, condivisi tra le due sotto-viste così non possono andare fuori sync.
import { useState } from 'react';
import AnalisiCampagnaPanel from './AnalisiCampagnaPanel';
import SurveyPersonalizzato from './SurveyPersonalizzato';

const TYPE_OPTIONS = [
  { value: 'client',   label: '👥 Clienti / Ospiti' },
  { value: 'operator', label: '💼 Staff / Operatori' },
];

const PERIOD_OPTIONS = [
  { value: 'standard',       label: 'Campagna standard' },
  { value: 'personalizzato', label: 'Personalizzato' },
];

export default function SurveyPage({ facility, surveys, onDataClick, onRestituzioneClick }) {
  const [surveyType, setSurveyType] = useState('client');
  const [periodMode, setPeriodMode] = useState('standard');

  return (
    <div className="space-y-6">
      <h2 className="font-black text-slate-800 text-lg">Survey</h2>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-2">
          {TYPE_OPTIONS.map(t => (
            <button key={t.value} onClick={() => setSurveyType(t.value)}
              className={`text-xs font-bold px-4 py-2 rounded-xl transition-all ${
                surveyType === t.value
                  ? 'bg-indigo-600 text-white shadow'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2 ml-auto">
          {PERIOD_OPTIONS.map(p => (
            <button key={p.value} onClick={() => setPeriodMode(p.value)}
              className={`text-xs font-bold px-4 py-2 rounded-xl transition-all ${
                periodMode === p.value
                  ? 'bg-slate-800 text-white shadow'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-400'
              }`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {periodMode === 'standard' ? (
        <AnalisiCampagnaPanel
          facility={facility}
          surveyType={surveyType}
          surveys={surveys}
          onDataClick={onDataClick}
          onRestituzioneClick={onRestituzioneClick}
        />
      ) : (
        <SurveyPersonalizzato
          facility={facility}
          surveys={surveys}
          surveyType={surveyType}
          onDataClick={onDataClick}
          onRestituzioneClick={onRestituzioneClick}
        />
      )}
    </div>
  );
}
