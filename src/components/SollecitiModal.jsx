// src/components/SollecitiModal.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { X, Bell, Send, AlertCircle, CheckCircle2 } from 'lucide-react';

const MONTH_NAMES_FULL = [
  'Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
  'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre',
];

export default function SollecitiModal({ isOpen, onClose, facilities, udos, kpiRecords, surveys, year }) {
  const [checked, setChecked]   = useState(false);
  const [inadempienti, setIn]   = useState([]);
  const [selected, setSelected] = useState({});
  const [sentIds, setSentIds]   = useState([]);

  useEffect(() => {
    if (!isOpen) return;
    setChecked(false);
    setIn([]);
    setSelected({});
    setSentIds([]);
  }, [isOpen]);

  const now          = new Date();
  const currentYear  = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // FIX 2: tutti i mesi rendicontabili per l'anno selezionato
  const actionableMonths = useMemo(() => {
    const sel = Number(year);
    if (sel < currentYear)   return Array.from({ length: 12 }, (_, i) => ({ month: i + 1, year: sel }));
    if (sel === currentYear) return Array.from({ length: currentMonth - 1 }, (_, i) => ({ month: i + 1, year: sel }));
    return [];
  }, [year, currentYear, currentMonth]);

  if (!isOpen) return null;

  const runCheck = (tipo = 'all') => {
    const results = [];

    facilities.filter(f => !f.is_suspended).forEach(f => {
      const mancanze = [];

      // FIX 2: controlla TUTTI i mesi rendicontabili, non solo l'ultimo
      if (tipo === 'all' || tipo === 'kpi') {
        actionableMonths.forEach(({ month, year: y }) => {
          const rec = kpiRecords.find(k =>
            String(k.facility_id) === String(f.id) &&
            Number(k.year)  === y &&
            Number(k.month) === month &&
            k.status === 'completed'
          );
          if (!rec) mancanze.push(`KPI ${MONTH_NAMES_FULL[month - 1]} ${y} non consolidati`);
        });
      }

      if (tipo === 'all' || tipo === 'survey') {
        const cSurvey = surveys
          .filter(s => s.type === 'client' && (String(s.facility_id) === String(f.id) || (!s.facility_id && s.company_id === f.company_id)))
          .sort((a, b) => b.calendar_id.localeCompare(a.calendar_id))[0];
        if (!cSurvey || (!cSurvey.ai_report_ospiti && !cSurvey.ai_report_direzione)) {
          mancanze.push('Questionario Clienti non completato');
        }

        const oSurvey = surveys
          .filter(s => s.type === 'operator' && (String(s.facility_id) === String(f.id) || (!s.facility_id && s.company_id === f.company_id)))
          .sort((a, b) => b.calendar_id.localeCompare(a.calendar_id))[0];
        if (!oSurvey || (!oSurvey.ai_report_ospiti && !oSurvey.ai_report_direzione)) {
          mancanze.push('Questionario Operatori non completato');
        }
      }

      if (!mancanze.length) return;

      const dest = [];
      const hasRQ = f.referent            && f.email_qualita;
      const hasRS = f.referente_struttura  && f.email_referente_struttura;
      if (hasRQ || hasRS) {
        if (hasRQ) dest.push({ nome: f.referent,            email: f.email_qualita,             ruolo: 'Ref. Qualità'   });
        if (hasRS) dest.push({ nome: f.referente_struttura, email: f.email_referente_struttura, ruolo: 'Ref. Struttura' });
      } else {
        if (f.director           && f.email_direzione) dest.push({ nome: f.director,           email: f.email_direzione, ruolo: 'Direttore'      });
        if (f.director_sanitario && f.email_sanitario) dest.push({ nome: f.director_sanitario, email: f.email_sanitario, ruolo: 'Dir. Sanitario' });
      }

      const udo = udos.find(u => u.id === f.udo_id);
      results.push({ id: f.id, name: f.name, udo: udo?.name || '—', mancanze, destinatari: dest, noEmail: dest.length === 0 });
    });

    results.sort((a, b) => {
      if (a.noEmail && !b.noEmail) return -1;
      if (!a.noEmail && b.noEmail) return 1;
      return a.name.localeCompare(b.name);
    });

    setIn(results);
    const sel = {};
    results.forEach(r => { if (!r.noEmail) sel[r.id] = true; });
    setSelected(sel);
    setChecked(true);
    setSentIds([]);
  };

  const toggleSelect = (id) => setSelected(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleAll    = (val) => {
    const sel = {};
    inadempienti.filter(r => !r.noEmail).forEach(r => { sel[r.id] = val; });
    setSelected(sel);
  };
  const selectedCount = Object.values(selected).filter(Boolean).length;

  const handleSendAll = () => {
    const toSend = inadempienti.filter(r => selected[r.id] && !r.noEmail);
    if (!toSend.length) return;
    const allEmails = [...new Set(toSend.flatMap(r => r.destinatari.map(d => d.email)))];
    const subject   = encodeURIComponent(`Sollecito attività qualità — anno ${year}`);
    const body      = encodeURIComponent(`Gentile referente,\n\nLe segnaliamo che risultano ancora attività non completate per l'anno ${year}.\n\nLa preghiamo di provvedere al completamento al più presto.\n\nGrazie,\nUfficio Qualità`);
    window.location.href = `mailto:?bcc=${allEmails.join(';')}&subject=${subject}&body=${body}`;
    setSentIds(prev => [...new Set([...prev, ...toSend.map(r => r.id)])]);
  };

  const handleSendSingle = (struttura) => {
    const emails  = struttura.destinatari.map(d => d.email).join(';');
    const subject = encodeURIComponent(`Sollecito attività qualità — ${struttura.name}`);
    const missing = struttura.mancanze.map(m => `• ${m}`).join('\n');
    const body    = encodeURIComponent(`Gentile referente,\n\nSi segnalano le seguenti attività non completate per la struttura "${struttura.name}":\n\n${missing}\n\nLa preghiamo di provvedere al completamento.\n\nGrazie,\nUfficio Qualità`);
    window.location.href = `mailto:${emails}?subject=${subject}&body=${body}`;
    setSentIds(prev => [...new Set([...prev, struttura.id])]);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl overflow-hidden font-sans">

        {/* Header */}
        <div className="bg-slate-950 px-8 py-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-rose-600 rounded-lg text-white"><Bell size={22} /></div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-wider">Solleciti</h2>
              <p className="text-xs text-rose-400 font-bold uppercase tracking-widest">Verifica inadempienze KPI e questionari</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-full transition-colors"><X size={26} /></button>
        </div>

        {/* Contenuto */}
        <div className="flex-1 overflow-y-auto bg-white p-8 min-h-0">
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="font-black text-slate-800 text-lg">Verifica inadempienze</h3>
                <p className="text-sm text-slate-400 mt-0.5">
                  KPI: <span className="font-bold text-slate-600">tutti i mesi rendicontabili {year}</span>
                  {' · '}Questionari: <span className="font-bold text-slate-600">anno {year} in corso</span>
                </p>
                {actionableMonths.length === 0 && (
                  <p className="text-xs text-amber-600 font-bold mt-1">Anno futuro: nessun mese rendicontabile per i KPI</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => runCheck('kpi')}    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-black hover:bg-indigo-700 transition-colors shadow"><Bell size={15} /> Verifica KPI</button>
                <button onClick={() => runCheck('survey')} className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2.5 rounded-xl text-sm font-black hover:bg-purple-700 transition-colors shadow"><Bell size={15} /> Verifica Questionari</button>
                <button onClick={() => runCheck('all')}    className="flex items-center gap-2 bg-rose-600   text-white px-4 py-2.5 rounded-xl text-sm font-black hover:bg-rose-700   transition-colors shadow"><Bell size={15} /> Verifica Tutto</button>
              </div>
            </div>

            {checked && (
              <>
                {inadempienti.length === 0 ? (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center">
                    <CheckCircle2 size={40} className="mx-auto text-emerald-500 mb-3" />
                    <p className="font-black text-emerald-700 text-lg">Tutte le strutture sono in regola!</p>
                    <p className="text-emerald-600 text-sm mt-1">KPI e questionari completati per tutti i mesi rendicontabili</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between flex-wrap gap-3 bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3">
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-bold text-slate-700">
                          <span className="text-2xl font-black text-rose-600">{inadempienti.length}</span> strutture con attività mancanti
                        </span>
                        {inadempienti.some(r => r.noEmail) && (
                          <span className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg flex items-center gap-1">
                            <AlertCircle size={12} /> {inadempienti.filter(r => r.noEmail).length} senza referente email
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => toggleAll(true)}  className="text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors">Seleziona tutti</button>
                        <button onClick={() => toggleAll(false)} className="text-xs font-bold text-slate-500 hover:bg-slate-100 px-3 py-1.5 rounded-lg transition-colors">Deseleziona tutti</button>
                        <button onClick={handleSendAll} disabled={selectedCount === 0}
                          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-black hover:bg-indigo-700 disabled:opacity-40 transition-colors shadow">
                          <Send size={13} /> Invia a selezionati ({selectedCount})
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {inadempienti.map(r => (
                        <div key={r.id} className={`bg-white border rounded-2xl overflow-hidden transition-all ${sentIds.includes(r.id) ? 'border-emerald-200 opacity-60' : 'border-slate-200'}`}>
                          <div className="flex items-start gap-4 p-5">
                            <div className="pt-0.5 shrink-0">
                              {r.noEmail ? (
                                <div className="w-5 h-5 rounded border-2 border-slate-200 bg-slate-100 flex items-center justify-center" title="Nessun referente con email">
                                  <span className="text-slate-400 text-[10px]">—</span>
                                </div>
                              ) : (
                                <input type="checkbox" checked={!!selected[r.id]} onChange={() => toggleSelect(r.id)} className="w-5 h-5 accent-indigo-600 cursor-pointer" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-3 flex-wrap">
                                <div>
                                  <p className="font-black text-slate-800">{r.name}</p>
                                  <p className="text-xs text-slate-400 font-bold">{r.udo}</p>
                                </div>
                                {!r.noEmail && !sentIds.includes(r.id) && (
                                  <button onClick={() => handleSendSingle(r)}
                                    className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 border border-indigo-200 hover:bg-indigo-50 px-3 py-1.5 rounded-xl transition-colors">
                                    <Send size={11} /> Invia singolo
                                  </button>
                                )}
                                {sentIds.includes(r.id) && (
                                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">✓ Inviato</span>
                                )}
                              </div>

                              {/* Mancanze — ogni mese come badge separato */}
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {r.mancanze.map((m, i) => (
                                  <span key={i} className="text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-lg">{m}</span>
                                ))}
                              </div>

                              {/* Destinatari */}
                              {r.destinatari.length > 0 ? (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {r.destinatari.map((d, i) => (
                                    <div key={i} className="flex items-center gap-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
                                      <span className="font-bold text-slate-500">{d.ruolo}:</span>
                                      <a href={`mailto:${d.email}`} className="text-indigo-600 hover:underline font-medium">{d.email}</a>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="mt-2 text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1 inline-block">
                                  ⚠ Nessun referente con email configurato
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
