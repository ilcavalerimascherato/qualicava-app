// src/components/NcFormModal.jsx
// Form completo Non Conformità con logica di validazione per stato.
// Workflow: Aperto → Pending → Chiuso
// Usato da: DirectorFacility, QualityDashboardModal
import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../supabaseClient';

// ── Liste valori (fonte: registro Excel Elena) ────────────────
const CLASSIFICAZIONI = [
  'Reclamo',
  'Anomalia',
  'Evento avverso / Sentinella',
  'Encomio',
  'Verbale Ente Vigilanza',
  'Altro (vedi Note)',
];

const SEGNALAZIONE_DA = [
  'Utente / Ospite',
  'Familiare / Caregiver',
  'Operatore',
  'Ente di vigilanza / Autorità',
  'Audit interno',
  'Altro (vedi Note)',
];

const AMBITI = [
  'Assistenza sanitaria',
  'Assistenza infermieristica',
  'Assistenza riabilitativa',
  'Assistenza socio-assistenziale (ASA/OSS)',
  'Assistenza educativa / animativa',
  'Assistenza psicologica / psichiatrica',
  'Servizio ristorazione',
  'Amministrazione / aspetti contrattuali',
  'Comunicazione con utenti / familiari',
  'Comunicazione interna',
  'Formazione e competenze del personale',
  'Igiene e sanificazione',
  'Manutenzione / attrezzature',
  'Organizzazione del lavoro / turnistica',
  'Privacy',
  'Procedure operative / istruzioni',
  'Rischio clinico / sicurezza del paziente',
  'Sicurezza ambientale e strutturale',
  'Sistemi informativi / documentazione',
];

const CAUSE_EVENTO = [
  'Cause clinico-assistenziali',
  'Cause comunicative',
  'Cause documentali / informative',
  'Cause esterne (fornitori, terzi o condizioni non controllabili)',
  'Cause formative / competenze',
  'Cause multifattoriali',
  'Cause organizzative',
  'Cause procedurali',
  'Cause strutturali / ambientali',
  'Cause tecniche / attrezzature',
];

const TIPOLOGIE_ESITO = ['OSSERVAZIONE', 'NON CONFORMITA', 'MEMO', 'MIGLIORAMENTO'];
const ESITI_VERIFICA  = ['Efficace', 'Parzialmente efficace', 'Non efficace'];
const AZIONI_AGGIUNTIVE = [
  'Nessuna (esito efficace)',
  'Riapertura azione correttiva',
  'Nuova analisi cause / RCA',
  'Aggiornamento procedura / istruzione operativa',
  'Formazione / addestramento aggiuntivo',
  'Audit / verifica straordinaria',
  'Rafforzamento monitoraggio',
  'Manutenzione / intervento tecnico',
  'Coinvolgimento Direzione / Comitato RM / CVS',
  'Segnalazione / comunicazione a Ente competente',
  'Altro (vedi Note)',
];
const STATI  = ['Aperto', 'Pending', 'Chiuso'];
const GRAVITA = ['Bassa', 'Media', 'Alta'];

// ── Stili costanti ────────────────────────────────────────────
const INP  = 'w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-400 transition-all';
const INPD = 'w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-400 outline-none cursor-not-allowed';
const LBL  = 'block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1';
const REQ  = 'text-red-500 ml-0.5';

// ── Logica validazione per stato ─────────────────────────────
function validateForStato(form, targetStato) {
  const errors = {};
  const needsRiscontro =
    form.classificazione === 'Reclamo' ||
    form.classificazione === 'Verbale Ente Vigilanza';

  // Campi sempre obbligatori
  if (!form.classificazione)   errors.classificazione   = 'Obbligatorio';
  if (!form.gravita)           errors.gravita           = 'Obbligatorio';
  if (!form.data_ricezione)    errors.data_ricezione    = 'Obbligatorio';

  if (targetStato === 'Aperto' || targetStato === 'Pending' || targetStato === 'Chiuso') {
    if (!form.analisi_dinamica)    errors.analisi_dinamica    = 'Obbligatorio';
    if (!form.correzione_immediata) errors.correzione_immediata = 'Obbligatorio';
  }

  if (targetStato === 'Pending' || targetStato === 'Chiuso') {
    if (!form.azione_correttiva)          errors.azione_correttiva          = 'Obbligatorio';
    if (!form.responsabile_esecuzione)    errors.responsabile_esecuzione    = 'Obbligatorio';
  }

  if (targetStato === 'Chiuso') {
    if (!form.verifica_efficacia)  errors.verifica_efficacia  = 'Obbligatorio';
    if (!form.esito_verifica)      errors.esito_verifica      = 'Obbligatorio';
    if (!form.verifica_chiusura_da) errors.verifica_chiusura_da = 'Obbligatorio';

    // Se esito non efficace serve secondo ciclo
    if (form.esito_verifica && form.esito_verifica !== 'Efficace') {
      if (!form.azioni_aggiuntive)    errors.azioni_aggiuntive    = 'Obbligatorio se esito non efficace';
      if (!form.verifica_efficacia_2) errors.verifica_efficacia_2 = 'Richiesto secondo ciclo verifica';
      if (!form.esito_verifica_2)     errors.esito_verifica_2     = 'Richiesto secondo ciclo verifica';
      if (form.esito_verifica_2 && form.esito_verifica_2 !== 'Efficace') {
        errors._global = 'Il secondo ciclo di verifica deve risultare Efficace per consentire la chiusura.';
      }
    }

    // Reclamo o Verbale Ente Vigilanza: data riscontro obbligatoria
    if (needsRiscontro && !form.data_riscontro_segnalante) {
      errors.data_riscontro_segnalante = `Obbligatorio per ${form.classificazione}`;
    }
  }

  return errors;
}

const EMPTY = {
  data_ricezione: new Date().toISOString().split('T')[0],
  classificazione: '', segnalazione_da: '', ambito: '',
  gravita: 'Media', analisi_dinamica: '', cause_evento: '',
  descrizione_cause: '', tipologia_esito: '', correzione_immediata: '',
  azione_correttiva: '', ac_entro_il: '', responsabile_esecuzione: '',
  verifica_efficacia: '', esito_verifica: '', azioni_aggiuntive: '',
  verifica_efficacia_2: '', esito_verifica_2: '', azioni_aggiuntive_2: '',
  data_chiusura: '', verifica_chiusura_da: '',
  data_riscontro_segnalante: '', note: '',
  stato: 'Aperto',
};

export default function NcFormModal({ isOpen, facility, year, profile, ncId = null, onClose, onSaved }) {
  const [form, setForm]         = useState(EMPTY);
  const [errors, setErrors]     = useState({});
  const [saving, setSaving]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [section2Open, setS2]   = useState(false);
  const [section3Open, setS3]   = useState(false);
  const [section4Open, setS4]   = useState(false);

  const isEdit = !!ncId;

  // Carica NC esistente in modifica
  useEffect(() => {
    if (!isOpen) return;
    if (isEdit) {
      setLoading(true);
      supabase.from('non_conformities').select('*').eq('id', ncId).single()
        .then(({ data, error }) => {
          if (!error && data) {
            const f = {};
            Object.keys(EMPTY).forEach(k => { f[k] = data[k] ?? EMPTY[k]; });
            // Normalizza date
            ['data_ricezione','ac_entro_il','data_chiusura','data_riscontro_segnalante']
              .forEach(dk => { if (f[dk]) f[dk] = f[dk].split('T')[0].split(' ')[0]; });
            setForm(f);
            // Apri sezioni rilevanti in base allo stato
            if (data.stato === 'Pending' || data.stato === 'Chiuso') setS2(true);
            if (data.stato === 'Chiuso') { setS3(true); setS4(true); }
          }
          setLoading(false);
        });
    } else {
      setForm(EMPTY);
      setErrors({});
      setS2(false); setS3(false); setS4(false);
    }
  }, [isOpen, ncId, isEdit]);

  if (!isOpen) return null;

  const set = field => e => setForm(p => ({ ...p, [field]: e.target.value }));

  const needsRiscontro =
    form.classificazione === 'Reclamo' ||
    form.classificazione === 'Verbale Ente Vigilanza';

  const esitoPrimoNonEfficace =
    form.esito_verifica && form.esito_verifica !== 'Efficace';

  // Determina se un campo è editabile in base allo stato corrente
  const canClose =
    form.verifica_efficacia &&
    (form.esito_verifica === 'Efficace' ||
     (esitoPrimoNonEfficace && form.esito_verifica_2 === 'Efficace')) &&
    form.verifica_chiusura_da &&
    (!needsRiscontro || form.data_riscontro_segnalante);

  const handleSave = async (targetStato) => {
    const errs = validateForStato({ ...form, stato: targetStato }, targetStato);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      // Apri le sezioni con errori
      if (errs.azione_correttiva || errs.responsabile_esecuzione) setS2(true);
      if (errs.verifica_efficacia || errs.esito_verifica || errs.azioni_aggiuntive) setS3(true);
      if (errs.verifica_chiusura_da || errs.data_chiusura || errs.data_riscontro_segnalante) setS4(true);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        facility_id:               facility.id,
        company_id:                facility.company_id,
        year,
        opened_by:                 profile?.id,
        opened_by_role:            profile?.role || 'director',
        stato:                     targetStato,
        data_ricezione:            form.data_ricezione || null,
        classificazione:           form.classificazione || null,
        segnalazione_da:           form.segnalazione_da || null,
        ambito:                    form.ambito || null,
        gravita:                   form.gravita || null,
        analisi_dinamica:          form.analisi_dinamica || null,
        cause_evento:              form.cause_evento || null,
        descrizione_cause:         form.descrizione_cause || null,
        tipologia_esito:           form.tipologia_esito || null,
        correzione_immediata:      form.correzione_immediata || null,
        azione_correttiva:         form.azione_correttiva || null,
        ac_entro_il:               form.ac_entro_il || null,
        responsabile_esecuzione:   form.responsabile_esecuzione || null,
        verifica_efficacia:        form.verifica_efficacia || null,
        esito_verifica:            form.esito_verifica || null,
        azioni_aggiuntive:         form.azioni_aggiuntive || null,
        verifica_efficacia_2:      form.verifica_efficacia_2 || null,
        esito_verifica_2:          form.esito_verifica_2 || null,
        azioni_aggiuntive_2:       form.azioni_aggiuntive_2 || null,
        data_chiusura:             targetStato === 'Chiuso' && canClose ? (form.data_chiusura || new Date().toISOString().split('T')[0]) : null,
        verifica_chiusura_da:      form.verifica_chiusura_da || null,
        data_riscontro_segnalante: form.data_riscontro_segnalante || null,
        note:                      form.note || null,
      };

      let error;
      if (isEdit) {
        ({ error } = await supabase.from('non_conformities').update(payload).eq('id', ncId));
      } else {
        ({ error } = await supabase.from('non_conformities').insert([payload]));
      }
      if (error) throw error;
      onSaved(targetStato);
    } catch (err) {
      setErrors({ _global: `Errore: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  const statoColors = {
    Aperto:  'bg-red-50 text-red-700 border-red-200',
    Pending: 'bg-amber-50 text-amber-700 border-amber-200',
    Chiuso:  'bg-emerald-50 text-emerald-700 border-emerald-200',
  };

  // Componente sezione collassabile
  const Section = ({ title, id, isOpen: open, toggle, children, badge }) => (
    <div className={`border rounded-2xl overflow-hidden ${open ? 'border-indigo-200' : 'border-slate-200'}`}>
      <button
        type="button"
        onClick={toggle}
        className={`w-full flex items-center justify-between px-5 py-3 text-left transition-colors ${open ? 'bg-indigo-50' : 'bg-slate-50 hover:bg-slate-100'}`}
      >
        <div className="flex items-center gap-3">
          <span className={`text-xs font-black uppercase tracking-widest ${open ? 'text-indigo-700' : 'text-slate-600'}`}>{title}</span>
          {badge && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-lg font-bold">{badge}</span>}
        </div>
        {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
      </button>
      {open && <div className="p-5 space-y-4 bg-white">{children}</div>}
    </div>
  );

  const Field = ({ label, error, required, children }) => (
    <div>
      <label className={LBL}>{label}{required && <span className={REQ}>*</span>}</label>
      {children}
      {error && <p className="text-xs text-red-600 mt-1 font-medium">{error}</p>}
    </div>
  );

  const errCount = (fields) => fields.filter(f => errors[f]).length;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[95vh] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-red-100 p-2 rounded-xl">
              <AlertTriangle size={18} className="text-red-600" />
            </div>
            <div>
              <h2 className="font-black text-slate-800">
                {isEdit ? 'Modifica NC' : 'Nuova Segnalazione'}
              </h2>
              <p className="text-xs text-slate-400">{facility?.name} · {year}</p>
            </div>
          </div>
          {/* Badge stato corrente */}
          {isEdit && (
            <span className={`text-xs font-black px-3 py-1.5 rounded-lg border ${statoColors[form.stato] || ''}`}>
              {form.stato}
            </span>
          )}
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl ml-2">
            <X size={18} className="text-slate-500" />
          </button>
        </div>

        {/* Form scrollabile */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-indigo-400" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">

            {errors._global && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 font-medium">
                {errors._global}
              </div>
            )}

            {/* ── SEZIONE 1: Dati segnalazione (sempre visibile) ── */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden">
              <div className="bg-slate-50 px-5 py-3">
                <span className="text-xs font-black text-slate-600 uppercase tracking-widest">
                  1 · Dati segnalazione
                </span>
              </div>
              <div className="p-5 space-y-4 bg-white">

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Data ricezione" required error={errors.data_ricezione}>
                    <input type="date" value={form.data_ricezione} onChange={set('data_ricezione')} className={INP} />
                  </Field>
                  <Field label="Gravità" required error={errors.gravita}>
                    <select value={form.gravita} onChange={set('gravita')} className={INP}>
                      {GRAVITA.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </Field>
                </div>

                <Field label="Classificazione" required error={errors.classificazione}>
                  <select value={form.classificazione} onChange={set('classificazione')} className={INP}>
                    <option value="">Seleziona...</option>
                    {CLASSIFICAZIONI.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>

                {needsRiscontro && (
                  <Field
                    label="Data riscontro al segnalante"
                    required={form.stato === 'Chiuso'}
                    error={errors.data_riscontro_segnalante}
                  >
                    <input type="date" value={form.data_riscontro_segnalante} onChange={set('data_riscontro_segnalante')} className={INP} />
                  </Field>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Segnalazione rilevata da">
                    <select value={form.segnalazione_da} onChange={set('segnalazione_da')} className={INP}>
                      <option value="">Seleziona...</option>
                      {SEGNALAZIONE_DA.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </Field>
                  <Field label="Ambito / Area coinvolta">
                    <select value={form.ambito} onChange={set('ambito')} className={INP}>
                      <option value="">Seleziona...</option>
                      {AMBITI.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </Field>
                </div>

                <Field label="Analisi della dinamica dell'evento" required error={errors.analisi_dinamica}>
                  <textarea rows={3} value={form.analisi_dinamica} onChange={set('analisi_dinamica')}
                    className={INP + ' resize-none'}
                    placeholder="Chi, cosa, quando, dove, come..." />
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Cause dell'evento">
                    <select value={form.cause_evento} onChange={set('cause_evento')} className={INP}>
                      <option value="">Seleziona...</option>
                      {CAUSE_EVENTO.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </Field>
                  <Field label="Tipologia esito">
                    <select value={form.tipologia_esito} onChange={set('tipologia_esito')} className={INP}>
                      <option value="">Seleziona...</option>
                      {TIPOLOGIE_ESITO.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </Field>
                </div>

                <Field label="Descrizione cause">
                  <textarea rows={2} value={form.descrizione_cause} onChange={set('descrizione_cause')}
                    className={INP + ' resize-none'} placeholder="Dettaglio cause..." />
                </Field>

                <Field label="Descrizione correzione immediata" required error={errors.correzione_immediata}>
                  <textarea rows={2} value={form.correzione_immediata} onChange={set('correzione_immediata')}
                    className={INP + ' resize-none'}
                    placeholder="Azioni adottate nell'immediato per contenere il rischio..." />
                </Field>

              </div>
            </div>

            {/* ── SEZIONE 2: Azione correttiva (Pending) ─────── */}
            <Section
              title="2 · Azione correttiva"
              isOpen={section2Open}
              toggle={() => setS2(p => !p)}
              badge={errCount(['azione_correttiva','responsabile_esecuzione']) > 0 ? `${errCount(['azione_correttiva','responsabile_esecuzione'])} errori` : null}
            >
              <Field label="Descrizione azione correttiva" required error={errors.azione_correttiva}>
                <textarea rows={3} value={form.azione_correttiva} onChange={set('azione_correttiva')}
                  className={INP + ' resize-none'}
                  placeholder="Azioni strutturali definite..." />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="AC da eseguire entro il">
                  <input type="date" value={form.ac_entro_il} onChange={set('ac_entro_il')} className={INP} />
                </Field>
                <Field label="Responsabile esecuzione" required error={errors.responsabile_esecuzione}>
                  <input type="text" value={form.responsabile_esecuzione} onChange={set('responsabile_esecuzione')}
                    className={INP} placeholder="Nome / Ruolo" />
                </Field>
              </div>
            </Section>

            {/* ── SEZIONE 3: Verifica efficacia (Chiuso) ──────── */}
            <Section
              title="3 · Verifica efficacia"
              isOpen={section3Open}
              toggle={() => setS3(p => !p)}
              badge={errCount(['verifica_efficacia','esito_verifica','azioni_aggiuntive','verifica_efficacia_2','esito_verifica_2']) > 0
                ? `${errCount(['verifica_efficacia','esito_verifica','azioni_aggiuntive','verifica_efficacia_2','esito_verifica_2'])} errori` : null}
            >
              <Field label="Verifica efficacia (evidenze)" required error={errors.verifica_efficacia}>
                <textarea rows={3} value={form.verifica_efficacia} onChange={set('verifica_efficacia')}
                  className={INP + ' resize-none'}
                  placeholder="Descrivi le evidenze a supporto della chiusura..." />
              </Field>
              <Field label="Esito verifica efficacia" required error={errors.esito_verifica}>
                <select value={form.esito_verifica} onChange={set('esito_verifica')} className={INP}>
                  <option value="">Seleziona...</option>
                  {ESITI_VERIFICA.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </Field>

              {/* Secondo ciclo se esito non efficace */}
              {esitoPrimoNonEfficace && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-4">
                  <p className="text-xs font-black text-amber-700 uppercase tracking-widest">
                    Esito non efficace — azioni aggiuntive e secondo ciclo richiesti
                  </p>
                  <Field label="Azioni aggiuntive" required error={errors.azioni_aggiuntive}>
                    <select value={form.azioni_aggiuntive} onChange={set('azioni_aggiuntive')} className={INP}>
                      <option value="">Seleziona...</option>
                      {AZIONI_AGGIUNTIVE.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </Field>
                  <Field label="Azioni aggiuntive — dettaglio">
                    <textarea rows={2} value={form.azioni_aggiuntive_2} onChange={set('azioni_aggiuntive_2')}
                      className={INP + ' resize-none'} />
                  </Field>
                  <Field label="Secondo ciclo — verifica efficacia" required error={errors.verifica_efficacia_2}>
                    <textarea rows={2} value={form.verifica_efficacia_2} onChange={set('verifica_efficacia_2')}
                      className={INP + ' resize-none'} placeholder="Evidenze del secondo ciclo..." />
                  </Field>
                  <Field label="Esito secondo ciclo" required error={errors.esito_verifica_2}>
                    <select value={form.esito_verifica_2} onChange={set('esito_verifica_2')} className={INP}>
                      <option value="">Seleziona...</option>
                      {ESITI_VERIFICA.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                  </Field>
                </div>
              )}
            </Section>

            {/* ── SEZIONE 4: Chiusura ──────────────────────────── */}
            <Section
              title="4 · Chiusura"
              isOpen={section4Open}
              toggle={() => setS4(p => !p)}
              badge={errCount(['verifica_chiusura_da','data_chiusura']) > 0
                ? `${errCount(['verifica_chiusura_da','data_chiusura'])} errori` : null}
            >
              {!canClose && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-500 font-medium">
                  Per chiudere la NC è necessario: completare la verifica efficacia con esito Efficace
                  {needsRiscontro ? ', inserire la data riscontro al segnalante' : ''} e indicare chi ha verificato la chiusura.
                </div>
              )}
              <Field label="Verifica chiusura effettuata da" required error={errors.verifica_chiusura_da}>
                <input type="text" value={form.verifica_chiusura_da} onChange={set('verifica_chiusura_da')}
                  className={canClose ? INP : INPD}
                  disabled={!canClose}
                  placeholder="Nome / Ruolo" />
              </Field>
              <Field label="Data chiusura">
                <input type="date" value={form.data_chiusura} onChange={set('data_chiusura')}
                  className={canClose ? INP : INPD}
                  disabled={!canClose} />
              </Field>
            </Section>

            {/* Note */}
            <div>
              <label className={LBL}>Note</label>
              <textarea rows={2} value={form.note} onChange={set('note')}
                className={INP + ' resize-none'} placeholder="Note aggiuntive..." />
            </div>

          </div>
        )}

        {/* Footer con bottoni per stato */}
        <div className="px-5 py-4 border-t bg-slate-50 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <button onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-200 transition-colors">
              Annulla
            </button>
            <div className="flex gap-2">
              {/* Salva come Aperto */}
              {(!isEdit || form.stato === 'Aperto') && (
                <button onClick={() => handleSave('Aperto')} disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-black uppercase hover:bg-red-100 disabled:opacity-60 transition-colors">
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  Salva Aperto
                </button>
              )}
              {/* Avanza a Pending */}
              {(!isEdit || form.stato === 'Aperto' || form.stato === 'Pending') && (
                <button onClick={() => { setS2(true); handleSave('Pending'); }} disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl text-xs font-black uppercase hover:bg-amber-100 disabled:opacity-60 transition-colors">
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  {form.stato === 'Pending' ? 'Aggiorna Pending' : 'Avanza a Pending'}
                </button>
              )}
              {/* Chiudi NC */}
              <button
                onClick={() => { setS3(true); setS4(true); handleSave('Chiuso'); }}
                disabled={saving || !canClose}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-black uppercase hover:bg-emerald-100 disabled:opacity-40 transition-colors"
                title={!canClose ? 'Completa verifica efficacia prima di chiudere' : ''}
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                Chiudi NC
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
