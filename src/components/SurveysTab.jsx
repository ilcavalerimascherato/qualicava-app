import React, { useState, useMemo, useEffect } from 'react';
import { Users, Briefcase, Building2 } from 'lucide-react';

const MONTH_NAMES = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];

const TYPES_CFG = [
  { type: 'client',   label: 'Clienti / Ospiti',  desc: 'Questionari di gradimento',    icon: Users     },
  { type: 'operator', label: 'Staff / Operatori',  desc: 'Questionari di clima interno', icon: Briefcase },
];

function StatusBadge({ status }) {
  const cfg = {
    completed: { label: 'Relazione OK', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    pending:   { label: 'Da elaborare', bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200'   },
    empty:     { label: 'Nessun dato',  bg: 'bg-slate-50',   text: 'text-slate-500',   border: 'border-slate-200'   },
  }[status];
  return (
    <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      {cfg.label}
    </span>
  );
}

function StatCard({ label, value, unit, subtitle, delta }) {
  const hasDelta = delta !== null && delta !== undefined;
  const isPos    = delta > 0;
  const isNeg    = delta < 0;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
      <div className="flex items-end gap-2">
        <p className="text-2xl font-black text-slate-800">{value ?? '–'}</p>
        {unit && <p className="text-xs text-slate-400 mb-1">{unit}</p>}
        {hasDelta && (
          <span className={`text-xs font-bold mb-1 ${isPos ? 'text-emerald-600' : isNeg ? 'text-red-500' : 'text-slate-400'}`}>
            {isPos ? '+' : ''}{delta}
          </span>
        )}
      </div>
      {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
    </div>
  );
}

function formatCalendar(calId) {
  if (!calId) return '–';
  const [y, m] = calId.split('-');
  return `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y}`;
}

function shiftMonthBack(year, month) {
  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  return m === 1
    ? { year: String(y - 1), month: '12' }
    : { year, month: String(m - 1).padStart(2, '0') };
}

export default function SurveysTab({ facility, surveys, onDataClick, onRestituzioneClick }) {
  const [activeType,    setActiveType]    = useState('client');
  const [selectedYear,  setSelectedYear]  = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');

  // Surveys for the active type, sorted descending
  const typeSurveys = useMemo(
    () => surveys
      .filter(s => s.type === activeType)
      .sort((a, b) => b.calendar_id.localeCompare(a.calendar_id)),
    [surveys, activeType]
  );

  // Available years derived from data
  const years = useMemo(() => {
    const set = new Set(typeSurveys.map(s => s.calendar_id.slice(0, 4)));
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [typeSurveys]);

  // Reset selection when type changes
  useEffect(() => {
    setSelectedYear(years[0] ?? '');
    setSelectedMonth('');
  }, [activeType]); // eslint-disable-line react-hooks/exhaustive-deps

  // Available months for the selected year
  const months = useMemo(() => {
    if (!selectedYear) return [];
    const set = new Set(
      typeSurveys
        .filter(s => s.calendar_id.startsWith(selectedYear + '-'))
        .map(s => s.calendar_id.slice(5, 7))
    );
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [typeSurveys, selectedYear]);

  // Survey matching the current selection
  const selectedSurvey = useMemo(() => {
    if (!selectedYear) return typeSurveys[0] ?? null;
    if (selectedMonth) return typeSurveys.find(s => s.calendar_id === `${selectedYear}-${selectedMonth}`) ?? null;
    return typeSurveys.find(s => s.calendar_id.startsWith(selectedYear + '-')) ?? null;
  }, [typeSurveys, selectedYear, selectedMonth]);

  const latest = typeSurveys[0] ?? null;
  const status = latest
    ? (latest.ai_report_direzione ? 'completed' : 'pending')
    : 'empty';

  const summaryStats  = selectedSurvey?.summary_stats ?? {};
  const isCompanyWide = summaryStats.is_company_wide ?? false;
  const nomeSurvey    = summaryStats.nome_survey ?? '';
  const periodCount   = summaryStats.total_responses ?? 0;
  const historicCount = typeSurveys.length;

  // Previous month stats (only when a specific month is selected)
  const prevPeriod = useMemo(() => {
    if (!selectedYear || !selectedMonth) return null;
    const { year: py, month: pm } = shiftMonthBack(selectedYear, selectedMonth);
    const s = typeSurveys.find(s => s.calendar_id === `${py}-${pm}`);
    return {
      calId: `${py}-${pm}`,
      count: s?.summary_stats?.total_responses ?? null,
    };
  }, [typeSurveys, selectedYear, selectedMonth]);

  const delta = (prevPeriod && prevPeriod.count !== null)
    ? periodCount - prevPeriod.count
    : null;

  const handleClick = () => {
    onDataClick(activeType, {
      year:  selectedYear  || undefined,
      month: selectedMonth || undefined,
    });
  };

  const handleRestituzioneClick = () => {
    onRestituzioneClick?.(activeType, {
      year:  selectedYear  || undefined,
      month: selectedMonth || undefined,
    });
  };

  return (
    <div className="space-y-6">
      <h2 className="font-black text-slate-800 text-lg">Gestione Survey</h2>

      {/* Type switcher */}
      <div className="flex gap-2 flex-wrap">
        {TYPES_CFG.map(({ type, label, icon: Icon }) => (
          <button
            key={type}
            onClick={() => setActiveType(type)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all ${
              activeType === type
                ? 'bg-indigo-600 text-white shadow'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Company-wide banner */}
      {isCompanyWide && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <Building2 size={16} className="text-indigo-600 shrink-0" />
          <p className="text-sm font-semibold text-indigo-700">
            Dati societari – survey aggregata a livello di gruppo
            {nomeSurvey ? ` · ${nomeSurvey}` : ''}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">

        {/* Main card */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6">

          {/* Period selectors */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Anno</label>
              <select
                value={selectedYear}
                onChange={e => { setSelectedYear(e.target.value); setSelectedMonth(''); }}
                className="text-sm font-semibold bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700"
              >
                {years.length === 0 && <option value="">–</option>}
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Mese</label>
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                disabled={!selectedYear || months.length === 0}
                className="text-sm font-semibold bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 disabled:opacity-50"
              >
                <option value="">Tutti</option>
                {months.map(m => (
                  <option key={m} value={m}>{MONTH_NAMES[parseInt(m, 10) - 1]}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Status + CTA */}
          {typeSurveys.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-400 font-medium mb-4">Nessuna survey disponibile</p>
              <button
                onClick={handleClick}
                className="bg-indigo-600 text-white font-bold text-sm px-5 py-2.5 rounded-xl hover:bg-indigo-700 transition-colors"
              >
                Carica dati →
              </button>
            </div>
          ) : (
            <div>
              <div className="flex items-start justify-between mb-5">
                <div>
                  <p className="text-xs text-slate-400 font-medium mb-0.5">Ultima elaborazione</p>
                  <p className="font-black text-slate-800 text-lg">{latest.calendar_id}</p>
                  {nomeSurvey && <p className="text-xs text-slate-500 mt-0.5">{nomeSurvey}</p>}
                </div>
                <StatusBadge status={status} />
              </div>
              {status === 'empty' ? (
                <button
                  onClick={handleClick}
                  className="w-full bg-indigo-600 text-white font-bold text-sm py-3 rounded-xl hover:bg-indigo-700 transition-colors"
                >
                  Carica dati →
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={handleClick}
                    className="flex-1 text-sm font-bold py-3 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                  >
                    📊 Report Direzione
                  </button>
                  <button
                    onClick={handleRestituzioneClick}
                    className="flex-1 text-sm font-bold py-3 rounded-xl bg-white border border-gray-200 text-gray-700 hover:border-gray-400 transition-colors"
                  >
                    👥 Restituzione
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar stats */}
        <div className="flex flex-col gap-3">
          <StatCard
            label="Totale storico"
            value={historicCount}
            unit="survey"
            subtitle="Tutta la struttura"
          />
          {(selectedYear || typeSurveys.length > 0) && (
            <StatCard
              label="Periodo selezionato"
              value={periodCount}
              unit="risposte"
              subtitle={
                selectedMonth
                  ? `${MONTH_NAMES[parseInt(selectedMonth, 10) - 1]} ${selectedYear}`
                  : selectedYear || '–'
              }
            />
          )}
          {prevPeriod && (
            <StatCard
              label="Periodo precedente"
              value={prevPeriod.count ?? '–'}
              unit="risposte"
              subtitle={formatCalendar(prevPeriod.calId)}
              delta={delta}
            />
          )}
        </div>
      </div>
    </div>
  );
}
