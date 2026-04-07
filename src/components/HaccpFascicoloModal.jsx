/**
 * src/components/HaccpFascicoloModal.jsx
 * ─────────────────────────────────────────────────────────────
 * Modale principale del modulo HACCP per una struttura.
 * Tab: Profilo · SCIA · Manuale · Analisi · Formazione
 *
 * Aperto da:
 *  - MasterDashboard (click sul cappello o sulla card)
 *  - FacilityCard (click sul cappello, via App.js → navigate /master?facility=ID)
 * ─────────────────────────────────────────────────────────────
 */
import React, { useState, useEffect } from 'react';
import {
  X, ChefHat, ClipboardList, FileText, FlaskConical,
  GraduationCap, Save, Loader2, Plus,
  AlertTriangle, AlertCircle, ExternalLink, UploadCloud, FileCheck2
} from 'lucide-react';
import { supabase }            from '../supabaseClient';
import { useHaccpFascicolo, useHaccpInvalidate } from '../hooks/useHaccpData';
import { useAuth }             from '../contexts/AuthContext';

// ── Costanti ──────────────────────────────────────────────────
const TABS = [
  { id: 'profilo',    label: 'Profilo HACCP', Icon: ChefHat        },
  { id: 'scia',       label: 'SCIA',          Icon: ClipboardList  },
  { id: 'manuale',    label: 'Manuale',        Icon: FileText       },
  { id: 'analisi',    label: 'Analisi',        Icon: FlaskConical   },
  { id: 'formazione', label: 'Formazione',     Icon: GraduationCap  },
];

const MODELLI = [
  { value: 'cucina_interna',        label: 'Cucina interna' },
  { value: 'appalto_fresco_caldo',  label: 'Appalto fresco-caldo in struttura' },
  { value: 'distribuzione_veicolata', label: 'Distribuzione veicolata (pasti da esterno)' },
];

const STATI_SCIA = [
  { value: 'ok',              label: '✅ OK — SCIA aggiornata',         cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  { value: 'da_verificare',   label: '⚠️ Da verificare',               cls: 'text-amber-700 bg-amber-50 border-amber-200'       },
  { value: 'mancante',        label: '🔴 Mancante — da presentare',     cls: 'text-red-700 bg-red-50 border-red-200'             },
  { value: 'voltura',         label: '🔴 Da voltare (cambio gestione)', cls: 'text-red-700 bg-red-50 border-red-200'             },
  { value: 'variazione',      label: '🟡 Da aggiornare (variazione)',   cls: 'text-amber-700 bg-amber-50 border-amber-200'       },
  { value: 'non_applicabile', label: '⚪ Non applicabile',              cls: 'text-slate-500 bg-slate-50 border-slate-200'       },
];

const SEMAFORO_CFG = {
  verde:  { color: 'text-emerald-500', bg: 'bg-emerald-50',  border: 'border-emerald-200', label: 'In regola'  },
  giallo: { color: 'text-amber-400',   bg: 'bg-amber-50',    border: 'border-amber-200',   label: 'Attenzione' },
  rosso:  { color: 'text-red-500',     bg: 'bg-red-50',      border: 'border-red-200',     label: 'Critico'    },
  grigio: { color: 'text-slate-400',   bg: 'bg-slate-50',    border: 'border-slate-200',   label: 'Non censito'},
};

const INP  = 'w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:border-amber-400 outline-none text-slate-700';
const INP2 = 'w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-amber-400 outline-none text-slate-700';
const LBL  = 'block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5';

// ── Sezioni manuale (speculare al configuratore HTML) ─────────
// Sezioni sempre attive (non selezionabili)
const SEZIONI_FISSE = [
  'intro', 'normativa', 'cultura', 'struttura', 'diagrammi', 'ccp', 'celiachia',
];
// Sezione base selezionabile
const SEZIONE_TEAM = { k: 'team', label: 'Gruppo HACCP e composizione del team', desc: 'Organigramma HACCP, ruoli e responsabilità dei membri del team' };
// Sezioni opzionali non coperte da "Specificità ospiti" — stile checkbox con descrizione
const SEZIONI_OPT = [
  { k: 'microbio',       label: 'Piano analisi microbiologiche',     desc: 'Superfici, mani operatori, acqua — frequenze e parametri' },
  { k: 'formazione',     label: 'Piano formazione',                  desc: 'Calendario formativo, ore obbligatorie per regione, attestati' },
  { k: 'manutenzione',   label: 'Manutenzione e taratura',           desc: 'Registro manutenzioni attrezzature, taratura strumenti di misura' },
  { k: 'documentazione', label: 'Documentazione e archiviazione',    desc: 'Elenco moduli, tempi di conservazione, gestione dei registri' },
];
// Le sezioni ospiti (disfagia, srtr, monouso, abbattuto, riabilitazione)
// NON appaiono qui — vengono incluse automaticamente dal buildPrompt
// in base alle checkbox di "Specificità ospiti" già compilate sopra

const SEZIONI_BASE_DEFAULT = [...SEZIONI_FISSE, 'team'];

// ── Parser apparecchiature frigorifere ───────────────────────
// Input: testo libero "F1 – Frigorifero cucina\nC1 – Congelatore\nFR1 – Reparto"
// Output: { frigoCucina: [{codice, desc}], congelatori: [...], frigoReparti: [...] }
export function parseApparecchiature(testo = '') {
  const righe = testo.split('\n').map(r => r.trim()).filter(Boolean);
  const frigoCucina  = [];
  const congelatori  = [];
  const frigoReparti = [];

  for (const riga of righe) {
    const [codiceRaw, ...descParts] = riga.split(/[–\-]/);
    const codice = codiceRaw.trim().toUpperCase();
    const desc   = descParts.join('–').trim() || codice;

    if (/^CR\d*/i.test(codice)) {
      frigoReparti.push({ codice, desc, tipo: 'congelatore_reparto' });
    } else if (/^FR\d*/i.test(codice) || /^FD$/i.test(codice)) {
      frigoReparti.push({ codice, desc, tipo: 'frigorifero_reparto' });
    } else if (/^C\d+/i.test(codice)) {
      congelatori.push({ codice, desc });
    } else if (/^F\d+/i.test(codice)) {
      frigoCucina.push({ codice, desc });
    } else {
      // Fallback — tratta come frigorifero cucina
      frigoCucina.push({ codice, desc });
    }
  }

  return { frigoCucina, congelatori, frigoReparti };
}

// ── Componente principale ─────────────────────────────────────
export default function HaccpFascicoloModal({ facility, onClose }) {
  const [activeTab, setActiveTab] = useState('profilo');
  const { profile }               = useAuth();
  const isDirector                = profile?.role === 'director';
  const canGenerate               = profile?.role === 'superadmin';
  const canRequest                = ['admin','sede','director'].includes(profile?.role);
  const canEdit                   = !isDirector;

  const { data, loading }         = useHaccpFascicolo(facility?.id);
  const invalidate                = useHaccpInvalidate(facility?.id);

  // Rileva automaticamente se la struttura è PSI dalla tabella udos
  const [isUdoPsi, setIsUdoPsi]   = useState(false);
  useEffect(() => {
    if (!facility?.udo_id) return;
    supabase
      .from('udos')
      .select('name')
      .eq('id', facility.udo_id)
      .single()
      .then(({ data: udoData }) => {
        const nome = (udoData?.name || '').toUpperCase();
        setIsUdoPsi(nome.includes('PSI') || nome.includes('PSICHI') || nome.includes('SRTR'));
      });
  }, [facility?.udo_id]);

  const semaforo = data.scadenzario?.semaforo ?? 'grigio';
  const semCfg   = SEMAFORO_CFG[semaforo] ?? SEMAFORO_CFG.grigio;

  if (!facility) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden font-sans">

        {/* ── Header ── */}
        <div className="bg-amber-500 px-8 py-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-white/20 rounded-xl">
              <ChefHat size={22} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-wider">
                Fascicolo HACCP
              </h2>
              <p className="text-xs text-amber-100 font-bold">{facility.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Badge semaforo */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border font-black text-xs ${semCfg.bg} ${semCfg.border} ${semCfg.color}`}>
              <ChefHat size={13} />
              {semCfg.label.toUpperCase()}
            </div>
            <button onClick={onClose} className="p-2 text-white/70 hover:text-white rounded-full transition-colors">
              <X size={24} />
            </button>
          </div>
        </div>

        {/* ── Tab nav ── */}
        <div className="bg-slate-50 border-b border-slate-200 px-8 flex gap-1 pt-3 shrink-0 overflow-x-auto">
          {TABS.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-t-xl text-xs font-black uppercase tracking-widest transition-all border-b-2 whitespace-nowrap ${
                activeTab === id
                  ? 'bg-white border-amber-500 text-amber-600 shadow-sm'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {/* ── Contenuto tab ── */}
        <div className="flex-1 overflow-y-auto bg-white min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={32} className="animate-spin text-amber-400" />
            </div>
          ) : (
            <>
              {activeTab === 'profilo'    && <ProfiloTab    facility={facility} profilo={data.profilo}       invalidate={invalidate} isDirector={isDirector} isUdoPsi={isUdoPsi} onSaved={() => setActiveTab('scia')} />}
              {activeTab === 'scia'       && <SciaTab       facility={facility} scia={data.scia}             invalidate={invalidate} canEdit={canEdit} />}
              {activeTab === 'manuale'    && <ManualeTab    facility={facility} manuali={data.manuali}       profilo={data.profilo}  invalidate={invalidate} canGenerate={canGenerate} canRequest={canRequest} isUdoPsi={isUdoPsi} />}
              {activeTab === 'analisi'    && <AnalisiTab    facility={facility} analisi={data.analisi}       invalidate={invalidate} canEdit={canEdit} />}
              {activeTab === 'formazione' && <FormazioneTab facility={facility} formazione={data.formazione} invalidate={invalidate} canEdit={canEdit} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// TAB 1 — PROFILO HACCP
// ══════════════════════════════════════════════════════════════
function ProfiloTab({ facility, profilo, invalidate, isDirector, isUdoPsi, onSaved }) {
  const EMPTY = {
    modello_ristorazione:        'cucina_interna',
    piva_osa:                    '',
    fornitore_nome:              '',
    fornitore_piva:              '',
    fornitore_ha_scia:           false,
    fornitore_scia_estremi:      '',
    lr_attuale:                  '',
    r_haccp:                     '',
    r_haccp_formazione_scadenza: '',
    // Gruppo HACCP dinamico — array di { ruolo, nome }
    team_haccp:                  [],
    // Apparecchiature e logistica (comuni)
    apparecchiature_frigorifere: '',
    n_cucina:                    '',
    n_distribuzione:             '',
    // Sezioni manuale attive (array di chiavi)
    sezioni_manuale:             SEZIONI_BASE_DEFAULT,
    // Dati revisione manuale
    rev_precedente:              '',
    rev_corrente:                '',
    data_revisione:              '',
    redattore:                   'Ufficio Qualità OVER',
    // Note operative strutturate (salvate in note_operative come JSON)
    note_operative:              '',
    // Campi specifici per modello — salvati in sezioni_attive jsonb
    op_orari_distribuzione:      '',
    op_nuclei_note:              '',
    op_disfagici:                false,
    op_disfagici_note:           '',
    op_cena_abbattuta:           false,
    op_cena_abbattuta_note:      '',
    op_srtr:                     false,
    op_monouso_infetti:          false,
    op_cucinette_nuclei:         false,
    op_cucinette_note:           '',
    op_riabilitazione:           false,
    op_macchinetta_caffe:        false,
    op_macchinetta_caffe_note:   '',
    op_distributore_acqua:       false,
    op_distributore_acqua_note:  '',
    op_celiachia_note:           '',
  };

  const [form, setForm]     = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profilo) {
      // Leggo i campi operativi dal jsonb sezioni_attive
      const sa = profilo.sezioni_attive || {};
      setForm({
        modello_ristorazione:        profilo.modello_ristorazione        || 'cucina_interna',
        piva_osa:                    sa.piva_osa                         || '',
        fornitore_nome:              profilo.fornitore_nome              || '',
        fornitore_piva:              profilo.fornitore_piva              || '',
        fornitore_ha_scia:           profilo.fornitore_ha_scia           || false,
        fornitore_scia_estremi:      profilo.fornitore_scia_estremi      || '',
        lr_attuale:                  profilo.lr_attuale                  || '',
        r_haccp:                     profilo.r_haccp                     || '',
        r_haccp_formazione_scadenza: profilo.r_haccp_formazione_scadenza || '',
        team_haccp:                  sa.team_haccp                       || [],
        apparecchiature_frigorifere: profilo.apparecchiature_frigorifere || '',
        n_cucina:                    profilo.unita_cucina                || '',
        n_distribuzione:             sa.n_distribuzione                  || '',
        sezioni_attive:              sa,
        sezioni_manuale:             sa.sezioni_manuale  || SEZIONI_BASE_DEFAULT,
        rev_precedente:              sa.rev_precedente   || '',
        rev_corrente:                sa.rev_corrente     || '',
        data_revisione:              sa.data_revisione   || '',
        redattore:                   sa.redattore        || 'Ufficio Qualità OVER',
        note_operative:              profilo.note_operative              || '',
        op_orari_distribuzione:      sa.op_orari_distribuzione           || '',
        op_nuclei_note:              sa.op_nuclei_note                   || '',
        op_disfagici:                sa.op_disfagici                     || false,
        op_disfagici_note:           sa.op_disfagici_note                || '',
        op_cena_abbattuta:           sa.op_cena_abbattuta                || false,
        op_cena_abbattuta_note:      sa.op_cena_abbattuta_note           || '',
        op_srtr:                     sa.op_srtr                          || false,
        op_monouso_infetti:          sa.op_monouso_infetti               || false,
        op_cucinette_nuclei:         sa.op_cucinette_nuclei              || false,
        op_cucinette_note:           sa.op_cucinette_note                || '',
        op_riabilitazione:           sa.op_riabilitazione                || false,
        op_macchinetta_caffe:        sa.op_macchinetta_caffe             || false,
        op_macchinetta_caffe_note:   sa.op_macchinetta_caffe_note        || '',
        op_distributore_acqua:       sa.op_distributore_acqua            || false,
        op_distributore_acqua_note:  sa.op_distributore_acqua_note       || '',
        op_celiachia_note:           sa.op_celiachia_note                || '',
      });
    }
  }, [profilo]);

  const set = f => e => setForm(p => ({ ...p, [f]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const hasFornitore = ['appalto_fresco_caldo', 'distribuzione_veicolata'].includes(form.modello_ristorazione);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Costruisco sezioni_attive jsonb con tutti i campi operativi
      const sezioni_attive = {
        piva_osa:                form.piva_osa,
        team_haccp:              form.team_haccp,
        sezioni_manuale:         form.sezioni_manuale,
        rev_precedente:          form.rev_precedente,
        rev_corrente:            form.rev_corrente,
        data_revisione:          form.data_revisione,
        redattore:               form.redattore,
        n_distribuzione:         form.n_distribuzione,
        op_orari_distribuzione:  form.op_orari_distribuzione,
        op_nuclei_note:          form.op_nuclei_note,
        op_disfagici:            form.op_disfagici,
        op_disfagici_note:       form.op_disfagici_note,
        op_cena_abbattuta:       form.op_cena_abbattuta,
        op_cena_abbattuta_note:  form.op_cena_abbattuta_note,
        op_srtr:                 form.op_srtr,
        op_monouso_infetti:      form.op_monouso_infetti,
        op_cucinette_nuclei:     form.op_cucinette_nuclei,
        op_cucinette_note:       form.op_cucinette_note,
        op_riabilitazione:       form.op_riabilitazione,
        op_macchinetta_caffe:    form.op_macchinetta_caffe,
        op_macchinetta_caffe_note: form.op_macchinetta_caffe_note,
        op_distributore_acqua:   form.op_distributore_acqua,
        op_distributore_acqua_note: form.op_distributore_acqua_note,
        op_celiachia_note:       form.op_celiachia_note,
      };
      const payload = {
        struttura_id:                facility.id,
        modello_ristorazione:        form.modello_ristorazione,
        fornitore_nome:              form.fornitore_nome              || null,
        fornitore_piva:              form.fornitore_piva              || null,
        fornitore_ha_scia:           form.fornitore_ha_scia,
        fornitore_scia_estremi:      form.fornitore_scia_estremi      || null,
        lr_attuale:                  form.lr_attuale                  || null,
        r_haccp:                     form.r_haccp                     || null,
        r_haccp_formazione_scadenza: form.r_haccp_formazione_scadenza || null,
        apparecchiature_frigorifere: form.apparecchiature_frigorifere || null,
        unita_cucina:                form.n_cucina ? parseInt(form.n_cucina) : null,
        sezioni_attive,
        note_operative:              form.note_operative              || null,
        updated_at:                  new Date().toISOString(),
      };
      const { error } = profilo
        ? await supabase.from('haccp_profili').update(payload).eq('struttura_id', facility.id)
        : await supabase.from('haccp_profili').insert([payload]);
      if (error) throw error;
      await invalidate.profilo();
      await invalidate.semafori();
      onSaved?.();
    } catch (err) {
      alert('Errore salvataggio: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8 space-y-8">

      {/* Modello ristorazione */}
      <section className="space-y-4">
        <h3 className="text-xs font-black text-amber-600 uppercase tracking-widest border-b border-amber-100 pb-2">
          Modello ristorazione
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {MODELLI.map(m => (
            <label key={m.value}
              className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                form.modello_ristorazione === m.value
                  ? 'border-amber-400 bg-amber-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <input type="radio" name="modello" value={m.value}
                checked={form.modello_ristorazione === m.value}
                onChange={set('modello_ristorazione')}
                className="mt-0.5 accent-amber-500" />
              <span className="text-sm font-bold text-slate-700">{m.label}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Fornitore — solo se non cucina interna */}
      {hasFornitore && (
        <section className="space-y-4">
          <h3 className="text-xs font-black text-amber-600 uppercase tracking-widest border-b border-amber-100 pb-2">
            Fornitore ristorazione
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={LBL}>Nome fornitore</label>
              <input type="text" value={form.fornitore_nome} onChange={set('fornitore_nome')} className={INP} placeholder="Es. Vivenda SpA" />
            </div>
            <div>
              <label className={LBL}>P.IVA fornitore</label>
              <input type="text" value={form.fornitore_piva} onChange={set('fornitore_piva')} className={INP} placeholder="IT00000000000" />
            </div>
          </div>
          <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
            <input type="checkbox" checked={form.fornitore_ha_scia} onChange={set('fornitore_ha_scia')} className="accent-amber-500 w-4 h-4" />
            <span className="text-sm font-bold text-slate-700">Il fornitore ha propria SCIA</span>
          </label>
          {form.fornitore_ha_scia && (
            <div>
              <label className={LBL}>Estremi SCIA fornitore</label>
              <input type="text" value={form.fornitore_scia_estremi} onChange={set('fornitore_scia_estremi')} className={INP} placeholder="N. protocollo, data, ente" />
            </div>
          )}
        </section>
      )}

      {/* Responsabili e Gruppo HACCP */}
      <section className="space-y-5">
        <h3 className="text-xs font-black text-amber-600 uppercase tracking-widest border-b border-amber-100 pb-2">
          Responsabili
        </h3>

        {/* P.IVA OSA */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={LBL}>P.IVA OSA (Ragione sociale che presenta la SCIA)</label>
            <input type="text" value={form.piva_osa} onChange={set('piva_osa')} className={INP}
              placeholder="es. IT12345678901" />
          </div>
        </div>

        {/* LR e R-HACCP — sempre fissi */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={LBL}>Legale Rappresentante attuale *</label>
            <input type="text" value={form.lr_attuale} onChange={set('lr_attuale')} className={INP}
              placeholder="Nome Cognome" />
          </div>
          <div>
            <label className={LBL}>Responsabile HACCP (R-HACCP) *</label>
            <input type="text" value={form.r_haccp} onChange={set('r_haccp')} className={INP}
              placeholder="Nome Cognome" />
          </div>
          <div>
            <label className={LBL}>Scadenza formazione R-HACCP</label>
            <input type="date" value={form.r_haccp_formazione_scadenza}
              onChange={set('r_haccp_formazione_scadenza')} className={INP} />
          </div>
        </div>

        {/* Gruppo HACCP dinamico */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black text-slate-500 uppercase tracking-widest">
              Altri membri del Gruppo HACCP
            </p>
            <button type="button"
              onClick={() => setForm(p => ({
                ...p,
                team_haccp: [...p.team_haccp, { ruolo: '', nome: '' }]
              }))}
              className="flex items-center gap-1.5 text-xs font-black text-amber-600 border border-amber-200 hover:bg-amber-50 px-3 py-1.5 rounded-xl transition-colors"
            >
              <Plus size={12} /> Aggiungi membro
            </button>
          </div>

          {form.team_haccp.length === 0 && (
            <p className="text-xs text-slate-400 italic px-1">
              Nessun membro aggiuntivo. Premi "+" per aggiungere (es. Direttore, Cuoco, Referente Igiene, Dietista…)
            </p>
          )}

          <div className="space-y-2">
            {form.team_haccp.map((membro, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  value={membro.ruolo}
                  onChange={e => {
                    const updated = form.team_haccp.map((m, i) =>
                      i === idx ? { ...m, ruolo: e.target.value } : m
                    );
                    setForm(p => ({ ...p, team_haccp: updated }));
                  }}
                  className={INP2 + ' flex-1'}
                  placeholder="Ruolo (es. Direttore, Cuoco, Dietista)"
                />
                <input
                  type="text"
                  value={membro.nome}
                  onChange={e => {
                    const updated = form.team_haccp.map((m, i) =>
                      i === idx ? { ...m, nome: e.target.value } : m
                    );
                    setForm(p => ({ ...p, team_haccp: updated }));
                  }}
                  className={INP2 + ' flex-1'}
                  placeholder="Nome Cognome (opzionale)"
                />
                <button type="button"
                  onClick={() => setForm(p => ({
                    ...p,
                    team_haccp: p.team_haccp.filter((_, i) => i !== idx)
                  }))}
                  className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>

          {/* Banner UDO PSI — SRTR automatico */}
          {isUdoPsi && (
            <div className="flex items-start gap-2 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3">
              <span className="text-indigo-500 text-sm mt-0.5">ℹ</span>
              <p className="text-xs font-bold text-indigo-700">
                Struttura PSI — la sezione <strong>Specificità SRTR psichiatrica</strong> verrà inclusa
                automaticamente nel manuale HACCP.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Note operative strutturate per modello */}
      <NoteOperativeSection form={form} set={set} modello={form.modello_ristorazione} />

      {/* Sezioni manuale e dati revisione */}
      <section className="space-y-5">
        <h3 className="text-xs font-black text-amber-600 uppercase tracking-widest border-b border-amber-100 pb-2">
          Dati revisione manuale
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className={LBL}>N° revisione corrente</label>
            <input type="text" value={form.rev_corrente} onChange={set('rev_corrente')} className={INP}
              placeholder="es. 1" />
          </div>
          <div>
            <label className={LBL}>Data revisione</label>
            <input type="date" value={form.data_revisione} onChange={set('data_revisione')} className={INP} />
          </div>
          <div>
            <label className={LBL}>Redatto da</label>
            <input type="text" value={form.redattore} onChange={set('redattore')} className={INP} />
          </div>
        </div>

        <h3 className="text-xs font-black text-amber-600 uppercase tracking-widest border-b border-amber-100 pb-2 mt-2">
          Sezioni manuale da includere
        </h3>

        {/* Sezioni fisse — sempre incluse, non modificabili */}
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
            Sempre incluse
          </p>
          <div className="flex flex-wrap gap-2">
            {['Introduzione e definizioni', 'Normativa di riferimento', 'Cultura sicurezza alimentare',
              'Paragrafo struttura', 'Diagrammi di flusso', 'Analisi pericoli e CCP', 'Celiachia e allergeni'
            ].map(label => (
              <span key={label}
                className="px-3 py-1.5 rounded-full text-xs font-bold border bg-slate-100 text-slate-500 border-slate-200 cursor-default">
                ✓ {label}
              </span>
            ))}
          </div>
        </div>

        {/* Team HACCP — selezionabile */}
        <div
          onClick={() => {
            const cur    = form.sezioni_manuale;
            const attiva = cur.includes('team');
            set('sezioni_manuale')({ target: { value: attiva ? cur.filter(k => k !== 'team') : [...cur, 'team'] }});
          }}
          className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
            form.sezioni_manuale.includes('team')
              ? 'border-amber-400 bg-amber-50'
              : 'border-slate-200 hover:border-slate-300 bg-white'
          }`}
        >
          <input type="checkbox" readOnly checked={form.sezioni_manuale.includes('team')}
            className="mt-0.5 accent-amber-500 w-4 h-4 shrink-0" />
          <div>
            <p className="text-sm font-black text-slate-700">{SEZIONE_TEAM.label}</p>
            <p className="text-xs text-slate-400 mt-0.5">{SEZIONE_TEAM.desc}</p>
          </div>
        </div>

        {/* Sezioni opzionali — stile specificità ospiti */}
        <div className="space-y-2">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Sezioni opzionali
          </p>
          {SEZIONI_OPT.map(s => {
            const attiva = form.sezioni_manuale.includes(s.k);
            return (
              <div key={s.k}
                onClick={() => {
                  const cur = form.sezioni_manuale;
                  set('sezioni_manuale')({ target: { value: attiva ? cur.filter(k => k !== s.k) : [...cur, s.k] }});
                }}
                className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  attiva
                    ? 'border-indigo-400 bg-indigo-50'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <input type="checkbox" readOnly checked={attiva}
                  className="mt-0.5 accent-indigo-500 w-4 h-4 shrink-0" />
                <div>
                  <p className="text-sm font-black text-slate-700">{s.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{s.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-[10px] text-slate-400 italic">
          Le sezioni relative a ospiti disfagici, SRTR, pazienti infetti, teglie abbattute e riabilitazione
          vengono incluse automaticamente in base alle specificità indicate sopra.
        </p>
      </section>

      {/* Salva */}
      <div className="flex justify-end pt-2">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 bg-amber-500 text-white px-8 py-3 rounded-xl text-sm font-black hover:bg-amber-600 disabled:opacity-60 transition-colors shadow-md">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? 'Salvataggio...' : 'Salva profilo'}
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// TAB 2 — SCIA
// ══════════════════════════════════════════════════════════════
function SciaTab({ facility, scia, invalidate, canEdit }) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [form, setForm]         = useState({
    tipo: 'notifica_852', osa_dichiarato: '', data_presentazione: '',
    numero_protocollo: '', portale_suap: '', comune_suap: '',
    stato: 'da_verificare', note: '',
  });

  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from('haccp_scia').insert([{
        struttura_id:      facility.id,
        tipo:              form.tipo,
        osa_dichiarato:    form.osa_dichiarato    || null,
        data_presentazione:form.data_presentazione || null,
        numero_protocollo: form.numero_protocollo  || null,
        portale_suap:      form.portale_suap       || null,
        comune_suap:       form.comune_suap        || null,
        stato:             form.stato,
        note:              form.note               || null,
      }]);
      if (error) throw error;
      await invalidate.scia();
      await invalidate.semafori();
      setShowForm(false);
      setForm({ tipo: 'notifica_852', osa_dichiarato: '', data_presentazione: '', numero_protocollo: '', portale_suap: '', comune_suap: '', stato: 'da_verificare', note: '' });
    } catch (err) {
      alert('Errore: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStato = async (id, stato) => {
    await supabase.from('haccp_scia').update({ stato, updated_at: new Date().toISOString() }).eq('id', id);
    await invalidate.scia();
    await invalidate.semafori();
  };

  const handleUploadDone = async (sciaId, fileUrl) => {
    await supabase.from('haccp_scia').update({ file_url: fileUrl }).eq('id', sciaId);
    await invalidate.scia();
  };

  // Notifica_852 principale
  const notifica = scia.find(s => s.tipo === 'notifica_852');
  const altre    = scia.filter(s => s.tipo !== 'notifica_852');

  return (
    <div className="p-8 space-y-6">

      {/* Notifica 852 — sempre la più importante */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-black text-amber-600 uppercase tracking-widest">
            Notifica 852/2004 (registrazione OSA)
          </h3>
          {canEdit && !notifica && (
            <button onClick={() => { setForm(f => ({ ...f, tipo: 'notifica_852' })); setShowForm(true); }}
              className="flex items-center gap-2 text-xs font-black text-amber-600 border border-amber-200 hover:bg-amber-50 px-3 py-1.5 rounded-xl transition-colors">
              <Plus size={12} /> Aggiungi
            </button>
          )}
        </div>

        {notifica ? (
          <SciaCard
            scia={notifica}
            facilityId={facility.id}
            onUpdateStato={handleUpdateStato}
            onUploadDone={handleUploadDone}
            canEdit={canEdit}
          />
        ) : (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex items-center gap-3">
            <AlertCircle size={18} className="text-red-500 shrink-0" />
            <div>
              <p className="font-black text-red-700 text-sm">Notifica 852 mancante o non censita</p>
              <p className="text-xs text-red-500 mt-0.5">Questa notifica è obbligatoria per tutte le strutture HACCP.</p>
            </div>
          </div>
        )}
      </section>

      {/* Altre SCIA */}
      {altre.length > 0 && (
        <section>
          <h3 className="text-xs font-black text-amber-600 uppercase tracking-widest mb-4">
            Altre SCIA / documentazione
          </h3>
          <div className="space-y-3">
            {altre.map(s => (
              <SciaCard
                key={s.id}
                scia={s}
                facilityId={facility.id}
                onUpdateStato={handleUpdateStato}
                onUploadDone={handleUploadDone}
                canEdit={canEdit}
              />
            ))}
          </div>
        </section>
      )}

      {/* Aggiungi altra SCIA */}
      {canEdit && (
        <div>
          <button onClick={() => { setForm(f => ({ ...f, tipo: 'scia_fornitore' })); setShowForm(true); }}
            className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-amber-600 hover:bg-amber-50 px-4 py-2 rounded-xl border border-dashed border-slate-300 hover:border-amber-300 transition-all">
            <Plus size={13} /> Aggiungi SCIA fornitore / commerciale
          </button>
        </div>
      )}

      {/* Form nuova SCIA */}
      {showForm && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 space-y-4">
          <h4 className="font-black text-amber-700 text-sm uppercase tracking-widest">Nuova SCIA</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LBL}>Tipo</label>
              <select value={form.tipo} onChange={set('tipo')} className={INP2}>
                <option value="notifica_852">Notifica 852/2004</option>
                <option value="scia_commerciale">SCIA commerciale</option>
                <option value="scia_fornitore">SCIA fornitore</option>
              </select>
            </div>
            <div>
              <label className={LBL}>Stato</label>
              <select value={form.stato} onChange={set('stato')} className={INP2}>
                {STATI_SCIA.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className={LBL}>OSA dichiarato</label>
              <input type="text" value={form.osa_dichiarato} onChange={set('osa_dichiarato')} className={INP2} placeholder="Ragione sociale OSA" />
            </div>
            <div>
              <label className={LBL}>Data presentazione</label>
              <input type="date" value={form.data_presentazione} onChange={set('data_presentazione')} className={INP2} />
            </div>
            <div>
              <label className={LBL}>N° protocollo</label>
              <input type="text" value={form.numero_protocollo} onChange={set('numero_protocollo')} className={INP2} />
            </div>
            <div>
              <label className={LBL}>Portale SUAP</label>
              <input type="text" value={form.portale_suap} onChange={set('portale_suap')} className={INP2} placeholder="impresainungiorno.gov.it" />
            </div>
            <div className="col-span-2">
              <label className={LBL}>Note</label>
              <textarea value={form.note} onChange={set('note')} rows={2} className={INP2} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">Annulla</button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 bg-amber-500 text-white px-5 py-2 rounded-xl text-sm font-black hover:bg-amber-600 disabled:opacity-60 transition-colors">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Salva SCIA
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── UploadPdf — drag & drop con progress ─────────────────────
function UploadPdf({ facilityId, sciaId, tipoLabel, onDone, onCancel }) {
  const [dragging,  setDragging]  = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress,  setProgress]  = useState(0);
  const [error,     setError]     = useState('');
  const inputRef = React.useRef();

  const doUpload = async (file) => {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setError('Sono accettati solo file PDF.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Il file supera i 10 MB.');
      return;
    }
    setError('');
    setUploading(true);
    setProgress(10);

    try {
      const ext      = 'pdf';
      const ts       = Date.now();
      const path     = `${facilityId}/scia/${sciaId}_${ts}.${ext}`;

      setProgress(30);
      const { error: upErr } = await supabase.storage
        .from('haccp-documents')
        .upload(path, file, { upsert: true, contentType: 'application/pdf' });
      if (upErr) throw upErr;

      setProgress(70);
      const { data: signedData, error: signErr } = await supabase.storage
        .from('haccp-documents')
        .createSignedUrl(path, 60 * 60 * 24 * 365); // 1 anno
      if (signErr) throw signErr;

      setProgress(100);
      // Salviamo il path (non la signed URL che scade) — generiamo signed URL on demand
      // Per semplicità salviamo la signed URL lunga 1 anno e la aggiorniamo al rinnovo
      onDone(signedData.signedUrl);
    } catch (err) {
      setError('Errore upload: ' + err.message);
      setUploading(false);
      setProgress(0);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    doUpload(file);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs font-black text-amber-700 uppercase tracking-widest">
        Allega PDF — {tipoLabel}
      </p>

      {/* Zona drag & drop */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`
          flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed cursor-pointer transition-all
          ${dragging  ? 'border-amber-500 bg-amber-100 scale-[1.01]' : 'border-amber-300 bg-white hover:border-amber-400 hover:bg-amber-50'}
          ${uploading ? 'pointer-events-none opacity-70' : ''}
        `}
      >
        <UploadCloud size={28} className={dragging ? 'text-amber-500' : 'text-amber-300'} />
        {uploading ? (
          <div className="w-full space-y-1">
            <div className="w-full h-2 bg-amber-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-amber-600 font-bold text-center">{progress}% — Caricamento in corso...</p>
          </div>
        ) : (
          <>
            <p className="text-sm font-bold text-slate-600">
              Trascina il PDF qui oppure <span className="text-amber-600 underline">sfoglia</span>
            </p>
            <p className="text-xs text-slate-400">Solo PDF · max 10 MB</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={e => doUpload(e.target.files?.[0])}
        />
      </div>

      {error && (
        <p className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <button
          onClick={onCancel}
          disabled={uploading}
          className="text-xs font-bold text-slate-500 hover:bg-slate-100 px-4 py-2 rounded-xl transition-colors"
        >
          Annulla
        </button>
      </div>
    </div>
  );
}

function SciaCard({ scia, facilityId, onUpdateStato, onUploadDone, canEdit }) {
  const statoCfg  = STATI_SCIA.find(s => s.value === scia.stato) || STATI_SCIA[1];
  const [showUpload, setShowUpload] = useState(false);
  const [nota, setNota]             = useState(scia.note || '');
  const [savingNota, setSavingNota] = useState(false);

  const tipoLabel = {
    notifica_852:    'Notifica 852/2004',
    scia_commerciale:'SCIA Commerciale',
    scia_fornitore:  'SCIA Fornitore',
  }[scia.tipo] || scia.tipo;

  const handleSaveNota = async () => {
    setSavingNota(true);
    await supabase.from('haccp_scia').update({ note: nota || null }).eq('id', scia.id);
    setSavingNota(false);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Riga principale */}
      <div className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black text-slate-500 uppercase tracking-widest">{tipoLabel}</p>
            {scia.osa_dichiarato && <p className="font-bold text-slate-800 text-sm mt-0.5">OSA: {scia.osa_dichiarato}</p>}
          </div>
          {canEdit ? (
            <select
              value={scia.stato}
              onChange={e => onUpdateStato(scia.id, e.target.value)}
              className={`text-xs font-black px-3 py-1.5 rounded-xl border outline-none ${statoCfg.cls}`}
            >
              {STATI_SCIA.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          ) : (
            <span className={`text-xs font-black px-3 py-1.5 rounded-xl border ${statoCfg.cls}`}>{statoCfg.label}</span>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs text-slate-500">
          {scia.data_presentazione && <div><span className="font-bold text-slate-400">Data:</span> {scia.data_presentazione}</div>}
          {scia.numero_protocollo  && <div><span className="font-bold text-slate-400">Prot.:</span> {scia.numero_protocollo}</div>}
          {scia.portale_suap       && <div><span className="font-bold text-slate-400">Portale:</span> {scia.portale_suap}</div>}
          {scia.comune_suap        && <div><span className="font-bold text-slate-400">Comune:</span> {scia.comune_suap}</div>}
        </div>

        {/* Note — sempre visibile, editabile se canEdit */}
        {canEdit ? (
          <div className="flex items-start gap-2 pt-1 border-t border-slate-100">
            <textarea
              value={nota}
              onChange={e => setNota(e.target.value)}
              onBlur={handleSaveNota}
              rows={2}
              placeholder="Note sulla SCIA (es. solo somministrazione interna, da voltare, intestata a precedente gestore…)"
              className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 outline-none focus:border-amber-400 resize-none"
            />
            {savingNota && <Loader2 size={13} className="animate-spin text-amber-400 mt-2 shrink-0" />}
          </div>
        ) : (
          nota && <p className="text-xs text-slate-400 italic border-t border-slate-100 pt-2">{nota}</p>
        )}

        {/* Azioni PDF */}
        <div className="flex items-center gap-2 pt-1">
          {scia.file_url ? (
            <>
              <a
                href={scia.file_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs font-black text-emerald-600 border border-emerald-200 hover:bg-emerald-50 px-3 py-1.5 rounded-xl transition-colors"
              >
                <FileCheck2 size={13} /> Visualizza PDF
              </a>
              {canEdit && (
                <button
                  onClick={() => setShowUpload(u => !u)}
                  className="text-xs font-bold text-slate-400 hover:text-amber-600 px-3 py-1.5 rounded-xl hover:bg-amber-50 transition-colors"
                >
                  Sostituisci
                </button>
              )}
            </>
          ) : canEdit ? (
            <button
              onClick={() => setShowUpload(u => !u)}
              className="flex items-center gap-1.5 text-xs font-black text-amber-600 border border-dashed border-amber-300 hover:bg-amber-50 px-3 py-1.5 rounded-xl transition-colors"
            >
              <UploadCloud size={13} /> Allega PDF SCIA
            </button>
          ) : (
            <span className="text-xs text-slate-300 italic">Nessun PDF allegato</span>
          )}
        </div>
      </div>

      {/* Area upload — collassabile */}
      {showUpload && canEdit && (
        <div className="border-t border-amber-100 bg-amber-50 p-4">
          <UploadPdf
            facilityId={facilityId}
            sciaId={scia.id}
            tipoLabel={tipoLabel}
            onDone={(url) => {
              onUploadDone(scia.id, url);
              setShowUpload(false);
            }}
            onCancel={() => setShowUpload(false)}
          />
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// TAB 3 — MANUALE
// ══════════════════════════════════════════════════════════════
function ManualeTab({ facility, manuali, profilo, invalidate, canGenerate, canRequest, isUdoPsi }) {
  const [generating, setGenerating]   = useState(false);
  const [generatedText, setGeneratedText] = useState('');
  const [showGenerated, setShowGenerated] = useState(false);
  const [revNote, setRevNote]         = useState('');
  const [saving, setSaving]           = useState(false);
  const [logoVariante, setLogoVariante] = useState('A');
  const [requesting, setRequesting]   = useState(false);
  const ultimo = manuali[0] ?? null;

  const profiloCompleto = profilo?.modello_ristorazione && profilo?.r_haccp && profilo?.lr_attuale;

  const LOGO_OPTIONS = [
    { value: 'A', label: 'OVER società consortile' },
    { value: 'B', label: 'Pittogramma gruppo OVER' },
    { value: 'C', label: 'Logo personalizzato struttura' },
  ];

  const handleRichiedi = async () => {
    setRequesting(true);
    try {
      // Salva la richiesta come record con flag richiesta_pending = true
      const { error } = await supabase.from('haccp_manuali').insert([{
        struttura_id:      facility.id,
        numero_revisione:  0,
        data_emissione:    new Date().toISOString().split('T')[0],
        note_revisione:    `RICHIESTA MANUALE da ${profilo?.lr_attuale || 'struttura'} — in attesa di generazione da superadmin`,
        richiesta_pending: true,
      }]);
      if (error) throw error;
      await invalidate.manuali();
      alert('Richiesta inviata. Il superadmin riceverà notifica e provvederà alla generazione del manuale.');
    } catch (err) {
      alert('Errore richiesta: ' + err.message);
    } finally {
      setRequesting(false);
    }
  };

  // ── buildPrompt — speculare al configuratore HTML ────────────
  const buildPrompt = (p) => {
    const sa = p.sezioni_attive || {};
    const sezioni = sa.sezioni_manuale || SEZIONI_BASE_DEFAULT;

    const modelloLabel = {
      cucina_interna:         'CUCINA INTERNA – modello base cucina propria',
      appalto_fresco_caldo:   'CUCINA IN APPALTO fresco/caldo in struttura – modello doppia responsabilità gestione/fornitore',
      distribuzione_veicolata:'SOLO DISTRIBUZIONE pasti veicolati da centro cottura esterno',
    }[p.modello_ristorazione] || p.modello_ristorazione;

    const sezioniLabel = [
      ...SEZIONI_FISSE.map(k => {
        const labels = {
          intro: 'Introduzione e definizioni', normativa: 'Normativa di riferimento',
          cultura: 'Cultura sicurezza alimentare', struttura: 'Paragrafo struttura',
          diagrammi: 'Diagrammi di flusso', ccp: 'Analisi pericoli e CCP',
          celiachia: 'Celiachia e allergeni',
        };
        return labels[k] || k;
      }),
      ...(sezioni.includes('team') ? [SEZIONE_TEAM.label] : []),
      ...SEZIONI_OPT.filter(s => sezioni.includes(s.k)).map(s => s.label),
      // Sezioni ospiti da specificità operative
      ...(sa.op_disfagici     ? ['Ospiti disfagici']                        : []),
      ...(sa.op_srtr || isUdoPsi ? ['Specificità SRTR psichiatrica']            : []),
      ...(sa.op_monouso_infetti ? ['Pazienti infetti — pasto monouso']      : []),
      ...(sa.op_cena_abbattuta  ? ['Teglie abbattute (cena)']                : []),
      ...(sa.op_riabilitazione  ? ['Coinvolgimento pazienti riabilitazione'] : []),
    ].join(', ');

    const righeFreigo = p.apparecchiature_frigorifere
      ? p.apparecchiature_frigorifere.split('\n').filter(Boolean).join('\n')
      : 'da definire';

    // Parsing strutturato per il piano temperature
    const app = parseApparecchiature(p.apparecchiature_frigorifere || '');
    const riepilogoApp = [
      app.frigoCucina.length  ? `Frigoriferi cucina (scheda unica con ${app.frigoCucina.length} colonne): ${app.frigoCucina.map(f => f.codice + ' ' + f.desc).join(', ')}` : '',
      app.congelatori.length  ? `Congelatori cucina (scheda unica con ${app.congelatori.length} colonne): ${app.congelatori.map(f => f.codice + ' ' + f.desc).join(', ')}` : '',
      app.frigoReparti.filter(f => f.tipo === 'frigorifero_reparto').length ? `Frigoriferi reparto (scheda separata per ognuno): ${app.frigoReparti.filter(f => f.tipo === 'frigorifero_reparto').map(f => f.codice + ' ' + f.desc).join(', ')}` : '',
      app.frigoReparti.filter(f => f.tipo === 'congelatore_reparto').length ? `Congelatori reparto (scheda separata per ognuno): ${app.frigoReparti.filter(f => f.tipo === 'congelatore_reparto').map(f => f.codice + ' ' + f.desc).join(', ')}` : '',
    ].filter(Boolean).join('\n');

    return `Sei un esperto di sicurezza alimentare e normativa HACCP italiana. Genera un Manuale HACCP completo e professionale in italiano per la struttura socio-sanitaria indicata di seguito.

Il documento deve essere formattato come un manuale aziendale reale, con intestazioni, numerazione sezioni, tabelle dove opportuno, e linguaggio tecnico-normativo corretto.

━━ DATI STRUTTURA ━━
Ragione sociale OSA: ${facility.name}
P.IVA OSA: ${sa.piva_osa || '—'}
Tipo struttura: ${facility.udo_name || 'struttura socio-sanitaria'}
Regione: ${facility.region || ''}
Indirizzo: ${facility.address || ''}

━━ MODELLO RISTORAZIONE ━━
${modelloLabel}
${p.fornitore_nome ? `Fornitore: ${p.fornitore_nome}${p.fornitore_piva ? ' (P.IVA ' + p.fornitore_piva + ')' : ''}` : ''}
${p.fornitore_ha_scia && p.fornitore_scia_estremi ? `SCIA fornitore: ${p.fornitore_scia_estremi}` : ''}

━━ RESPONSABILI E GRUPPO HACCP ━━
Legale Rappresentante / OSA: ${p.lr_attuale || '—'}
Responsabile HACCP struttura (R-HACCP): ${p.r_haccp || '—'}
${(sa.team_haccp || []).filter(m => m.ruolo).map(m => `${m.ruolo}: ${m.nome || '(da nominare)'}`).join('\n')}
Redatto da: ${sa.redattore || 'Ufficio Qualità OVER'}
Rev. precedente: ${sa.rev_precedente || '0 – prima emissione'}
Rev. corrente: ${sa.rev_corrente || '1'}  Data: ${sa.data_revisione || new Date().toLocaleDateString('it-IT')}

━━ LOCALI E LAYOUT ━━
${sa.op_nuclei_note || 'Non specificato'}
Orari distribuzione: ${sa.op_orari_distribuzione || 'Non specificati'}

━━ APPARECCHIATURE FRIGORIFERE ━━
${riepilogoApp || righeFreigo}

Nel piano di monitoraggio temperature del manuale:
- Le apparecchiature F1, F2... vanno in un'unica scheda Autoc 2A cucina con una colonna per ognuna
- Le apparecchiature C1, C2... vanno in un'unica scheda Autoc 2B con una colonna per ognuna  
- Le apparecchiature FR1, FR2..., FD, CR1... hanno ciascuna una scheda separata (la scheda resta sull'apparecchio)

━━ DISTRIBUTORI AUTOMATICI ━━
${sa.op_macchinetta_caffe ? `Macchinette caffè/bevande: ${sa.op_macchinetta_caffe_note || 'presenti'}` : 'Nessuna macchinetta caffè'}
${sa.op_distributore_acqua ? `Distributore acqua: ${sa.op_distributore_acqua_note || 'presente'}` : 'Nessun distributore acqua'}

━━ SPECIFICITÀ OPERATIVE ━━
${sa.op_disfagici ? `Ospiti disfagici: SÌ — ${sa.op_disfagici_note || 'gestione dedicata'}` : 'Ospiti disfagici: NO'}
${sa.op_cena_abbattuta ? `Cena con teglie abbattute: SÌ — ${sa.op_cena_abbattuta_note || 'riattivazione ≥75°C'}` : ''}
${sa.op_cucinette_nuclei ? `Cucinette di nucleo: SÌ — ${sa.op_cucinette_note || 'per colazione e merenda'}` : ''}
${(sa.op_srtr || isUdoPsi) ? 'Struttura SRTR psichiatrica: SÌ (UDO PSI automatico)' : ''}
${sa.op_monouso_infetti ? 'Pazienti infetti con pasto monouso: SÌ' : ''}
${sa.op_riabilitazione ? 'Coinvolgimento pazienti in attività cucina: SÌ' : ''}
${sa.op_celiachia_note ? `Allergeni/celiachia: ${sa.op_celiachia_note}` : ''}
${p.note_operative ? `Note aggiuntive: ${p.note_operative}` : ''}

━━ SEZIONI DA INCLUDERE ━━
${sezioniLabel}

━━ NORMATIVA REGIONALE ━━
${facility.region ? `Per la regione ${facility.region}: includi normativa formazione regionale specifica e riferimento ASL/ATS competente.` : ''}

━━ ISTRUZIONI OBBLIGATORIE ━━
- Produci un manuale completo e professionale, NON una bozza
- Ogni sezione deve essere pienamente sviluppata con contenuto normativo corretto
- Usa Reg. CE 852/2004, Reg. UE 625/2017, D.Lgs 27/2021, Reg. UE 2021/382, D.Lgs 18/2023
- I diagrammi di flusso vanno descritti testualmente con frecce (→) e punti di controllo
- Il piano monitoraggio temperature deve elencare OGNI apparecchiatura frigorífera indicata
- Per ogni CCP: pericolo, limite critico, monitoraggio, azione correttiva, verifica, registrazione
- NON includere nomi di persone nel corpo del manuale (solo ruoli: LR, R-HACCP, ecc.)
- Il registro revisioni deve riportare le revisioni indicate
${sezioni.includes('microbio') ? '- Piano analisi microbiologiche: superfici, mani operatori, acqua (NO campionamento alimenti routinario)' : ''}
${sa.op_disfagici       ? '- Sezione disfagici: locale dedicato, frigorifero identificato, pasto nominale, procedure specifiche' : ''}
${sa.op_cena_abbattuta  ? '- Gestione teglie abbattute: temperatura ricevimento ≤4°C, riattivazione ≥75°C al cuore' : ''}
${(sa.op_srtr || isUdoPsi) ? '- Sezione SRTR: sicurezza posateria (conta cutlery), supervisione tavoli, gestione crisi, pasto in camera per isolamento' : ''}
${sa.op_monouso_infetti ? '- Gestione pazienti infetti: pasto monouso, smaltimento come rifiuti speciali (non RSU)' : ''}
${sa.op_riabilitazione  ? '- Coinvolgimento pazienti in attività cucina: procedure sicurezza, supervisione' : ''}`;
  };

  const handleGenera = async () => {
    if (!profiloCompleto) {
      alert('Completa prima il Profilo HACCP (modello ristorazione, LR e R-HACCP obbligatori).');
      return;
    }
    setGenerating(true);
    setShowGenerated(false);
    setGeneratedText('');
    try {
      const prompt = buildPrompt(profilo);
      const apiKey = process.env.REACT_APP_ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error('REACT_APP_ANTHROPIC_API_KEY non configurata nel .env');

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type':                              'application/json',
          'x-api-key':                                apiKey,
          'anthropic-version':                        '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model:      'claude-haiku-4-5-20251001',
          max_tokens: 8000,
          messages:   [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Anthropic ${response.status}: ${err}`);
      }
      const data  = await response.json();
      const testo = data.content?.map(b => b.text || '').join('') || '';
      if (!testo) throw new Error('Risposta vuota');
      setGeneratedText(testo);
      setShowGenerated(true);
    } catch (err) {
      alert('Errore generazione: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleSalvaManuale = async () => {
    if (!generatedText) return;
    setSaving(true);
    try {
      const sa     = profilo?.sezioni_attive || {};
      // Rev: se è il primo manuale usa rev_corrente dal profilo, altrimenti incrementa
      const numRev = manuali.filter(m => !m.richiesta_pending).length > 0
        ? (parseInt(manuali.find(m => !m.richiesta_pending)?.numero_revisione || '0') || 0) + 1
        : parseInt(sa.rev_corrente) || 1;
      const oggi     = new Date().toISOString().split('T')[0];
      const scadenza = new Date(new Date().setFullYear(new Date().getFullYear() + 2)).toISOString().split('T')[0];

      // 1. Genera .docx via Edge Function
      const docxParams = {
        nomestruttura: facility.name,
        osa:           facility.name,
        pivaOsa:       sa.piva_osa            || '—',
        modello:       profilo.modello_ristorazione || 'cucina_interna',
        lr:            profilo.lr_attuale      || '—',
        rHaccp:        profilo.r_haccp         || '—',
        teamHaccp:     sa.team_haccp           || [],
        numRev:        String(numRev),
        dataRev:       new Date().toLocaleDateString('it-IT'),
        redattore:     sa.redattore            || 'Ufficio Qualità OVER',
        noteRevisione: revNote                 || 'Prima emissione',
        testoManuale:  generatedText,
        logoVariante:  logoVariante,
      };

      const { data: fnData, error: fnError } = await supabase.functions.invoke(
        'generate-haccp-docx',
        { body: docxParams }
      );

      if (fnError) throw new Error(fnError.message || 'Errore Edge Function generate-haccp-docx');
      if (!fnData?.docx_base64) throw new Error(fnData?.error || 'Risposta vuota dalla Edge Function');

      // Decodifica base64 → Uint8Array
      const binaryStr = atob(fnData.docx_base64);
      const bytes     = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
      const docxBuffer = bytes.buffer;

      // 2. Upload .docx in Storage
      const path = `${facility.id}/manuali/manuale_rev${numRev}_${oggi}.docx`;
      const { error: upErr } = await supabase.storage
        .from('haccp-documents')
        .upload(path, docxBuffer, {
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          upsert: true,
        });
      if (upErr) throw upErr;

      const { data: signData } = await supabase.storage
        .from('haccp-documents')
        .createSignedUrl(path, 60 * 60 * 24 * 365);

      if (!signData?.signedUrl) throw new Error('Impossibile generare URL di download.');

      // 3. Inserisce record in haccp_manuali
      const { error: dbErr } = await supabase.from('haccp_manuali').insert([{
        struttura_id:            facility.id,
        numero_revisione:        numRev,
        data_emissione:          oggi,
        data_scadenza_revisione: scadenza,
        file_url_manuale:        signData.signedUrl,
        note_revisione:          revNote || null,
        logo_variante:           logoVariante,
        richiesta_pending:       false,
      }]);
      if (dbErr) throw dbErr;

      await invalidate.manuali();
      await invalidate.semafori();
      setShowGenerated(false);
      setGeneratedText('');
      setRevNote('');
      alert(`Manuale Rev. ${numRev} salvato correttamente come documento Word.`);
    } catch (err) {
      alert('Errore salvataggio: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8 space-y-6">

      {/* Stato manuale corrente */}
      <section>
        <h3 className="text-xs font-black text-amber-600 uppercase tracking-widest border-b border-amber-100 pb-2 mb-4">
          Manuale corrente
        </h3>
        {ultimo ? (
          <div className={`bg-white border rounded-xl p-5 space-y-3 ${ultimo.richiesta_pending ? 'border-amber-200 bg-amber-50' : 'border-slate-200'}`}>
            {ultimo.richiesta_pending ? (
              <div className="flex items-center gap-3">
                <AlertTriangle size={16} className="text-amber-500 shrink-0" />
                <div>
                  <p className="font-black text-amber-700">Richiesta manuale in attesa</p>
                  <p className="text-xs text-amber-600 mt-0.5">Inviata il {ultimo.data_emissione} — in attesa di generazione da superadmin.</p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-black text-slate-800">Revisione {ultimo.numero_revisione}</p>
                      {/* Badge formato file */}
                      {ultimo.file_url_manuale && (
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                          ultimo.file_url_manuale.includes('.docx')
                            ? 'bg-indigo-100 text-indigo-600'
                            : 'bg-slate-100 text-slate-400'
                        }`}>
                          {ultimo.file_url_manuale.includes('.docx') ? 'WORD' : 'TXT'}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5">Emesso il {ultimo.data_emissione}</p>
                    {ultimo.data_scadenza_revisione && (
                      <p className={`text-xs font-bold mt-1 ${
                        new Date(ultimo.data_scadenza_revisione) < new Date()
                          ? 'text-red-600' : 'text-slate-400'
                      }`}>
                        Scadenza revisione: {ultimo.data_scadenza_revisione}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {ultimo.file_url_manuale && (
                      <a href={ultimo.file_url_manuale} target="_blank" rel="noreferrer"
                        className={`flex items-center gap-1.5 text-xs font-black border px-3 py-1.5 rounded-xl transition-colors ${
                          ultimo.file_url_manuale.includes('.docx')
                            ? 'text-indigo-600 border-indigo-200 hover:bg-indigo-50'
                            : 'text-slate-500 border-slate-200 hover:bg-slate-50'
                        }`}>
                        <ExternalLink size={12} />
                        {ultimo.file_url_manuale.includes('.docx') ? '📄 Scarica Word' : 'Apri TXT'}
                      </a>
                    )}
                    {ultimo.file_url_modulistica && (
                      <a href={ultimo.file_url_modulistica} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1.5 text-xs font-black text-amber-600 border border-amber-200 hover:bg-amber-50 px-3 py-1.5 rounded-xl transition-colors">
                        <ExternalLink size={12} /> Modulistica
                      </a>
                    )}
                  </div>
                </div>
                {ultimo.note_revisione && (
                  <p className="text-xs text-slate-400 italic border-t border-slate-100 pt-2">{ultimo.note_revisione}</p>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-8 text-center">
            <FileText size={36} className="mx-auto text-slate-300 mb-3" />
            <p className="font-bold text-slate-500">Nessun manuale generato</p>
            <p className="text-xs text-slate-400 mt-1">Completa il profilo HACCP e premi "Genera Manuale"</p>
          </div>
        )}
      </section>

      {/* Banner profilo incompleto */}
      {!profiloCompleto && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle size={16} className="text-amber-500 shrink-0" />
          <p className="text-sm font-bold text-amber-700">
            Completa il tab "Profilo HACCP" prima di generare il manuale.
            Campi obbligatori: modello ristorazione, Legale Rappresentante, R-HACCP.
          </p>
        </div>
      )}

      {/* Banner richieste pending — visibile solo a superadmin */}
      {canGenerate && manuali.some(m => m.richiesta_pending) && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-300 rounded-xl px-5 py-4">
          <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-black text-amber-700">Richiesta manuale in attesa</p>
            <p className="text-xs text-amber-600 mt-0.5">
              La struttura ha richiesto la generazione del manuale HACCP.
              Completa il profilo se necessario e premi "Genera Manuale".
            </p>
          </div>
        </div>
      )}
        <section className="space-y-4">
          {/* Selettore variante logo */}
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">
              Logo da utilizzare nel documento
            </label>
            <div className="flex flex-wrap gap-2">
              {LOGO_OPTIONS.map(opt => (
                <button key={opt.value} type="button"
                  onClick={() => setLogoVariante(opt.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                    logoVariante === opt.value
                      ? 'bg-amber-100 text-amber-700 border-amber-400'
                      : 'bg-slate-100 text-slate-400 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {opt.value === 'A' ? '🏢' : opt.value === 'B' ? '💚' : '📎'} {opt.label}
                </button>
              ))}
            </div>
            {logoVariante === 'C' && (
              <p className="text-xs text-amber-600 mt-2 italic">
                Logo personalizzato: funzionalità in sviluppo — verrà usato il logo OVER come fallback.
              </p>
            )}
          </div>

          <div className="flex justify-center">
            <button
              onClick={handleGenera}
              disabled={generating || !profiloCompleto}
              className="flex items-center gap-3 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg transition-all text-sm"
            >
              {generating
                ? <><Loader2 size={18} className="animate-spin" /> Generazione in corso (30-60 sec.)...</>
                : <><ChefHat size={18} /> Genera Manuale HACCP</>
              }
            </button>
          </div>
        </section>
      )}

      {/* Tasto richiedi — admin / sede / director */}
      {canRequest && !canGenerate && (
        <div className="flex flex-col items-center gap-3 pt-4">
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-6 py-4 text-center max-w-md">
            <p className="text-sm font-bold text-indigo-700 mb-1">Generazione manuale riservata al superadmin</p>
            <p className="text-xs text-indigo-500">Puoi inviare una richiesta che verrà notificata al responsabile qualità di gruppo.</p>
          </div>
          {/* Controlla se c'è già una richiesta pending */}
          {manuali.some(m => m.richiesta_pending) ? (
            <div className="flex items-center gap-2 text-sm font-bold text-amber-600">
              <Loader2 size={15} /> Richiesta già inviata — in attesa di elaborazione
            </div>
          ) : (
            <button
              onClick={handleRichiedi}
              disabled={requesting || !profiloCompleto}
              className="flex items-center gap-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg transition-all text-sm"
            >
              {requesting
                ? <><Loader2 size={18} className="animate-spin" /> Invio richiesta...</>
                : <><FileText size={18} /> Richiedi Manuale HACCP</>
              }
            </button>
          )}
        </div>
      )}

      {/* Area testo generato — solo superadmin può editare */}
      {showGenerated && generatedText && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-emerald-600 uppercase tracking-widest">
              ✓ Manuale generato — rivedi e salva
            </h3>
            <button onClick={() => setShowGenerated(false)}
              className="text-xs text-slate-400 hover:text-slate-600 font-bold">Chiudi anteprima</button>
          </div>

          {/* Solo superadmin può modificare il testo */}
          {canGenerate ? (
            <textarea
              value={generatedText}
              onChange={e => setGeneratedText(e.target.value)}
              rows={20}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-800 font-mono leading-relaxed outline-none focus:border-amber-400 resize-y"
            />
          ) : (
            <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto">
              {generatedText}
            </div>
          )}

          <div>
            <label className={LBL}>Note di revisione (opzionale)</label>
            <input type="text" value={revNote} onChange={e => setRevNote(e.target.value)}
              className={INP} placeholder="es. Prima emissione, aggiornamento R-HACCP, variazione fornitore..." />
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => { setShowGenerated(false); setGeneratedText(''); }}
              className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">
              Scarta
            </button>
            <button onClick={handleSalvaManuale} disabled={saving}
              className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-2.5 rounded-xl text-sm font-black hover:bg-emerald-700 disabled:opacity-60 transition-colors shadow-md">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {saving ? 'Salvataggio...' : 'Salva manuale'}
            </button>
          </div>
        </section>
      )}

      {/* Storico revisioni */}
      {manuali.length > 1 && (
        <section>
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 mb-4">
            Storico revisioni
          </h3>
          <div className="space-y-2">
            {manuali.slice(1).map(m => (
              <div key={m.id} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                <div>
                  <span className="text-xs font-black text-slate-500">Rev. {m.numero_revisione}</span>
                  <span className="text-xs text-slate-400 ml-3">{m.data_emissione}</span>
                </div>
                <div className="flex gap-2">
                  {m.file_url_manuale && (
                    <a href={m.file_url_manuale} target="_blank" rel="noreferrer"
                      className="text-xs text-indigo-500 hover:underline font-bold">Manuale</a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// TAB 4 — ANALISI MICROBIOLOGICHE
// ══════════════════════════════════════════════════════════════
function AnalisiTab({ facility, analisi, invalidate, canEdit }) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [form, setForm]         = useState({
    data_campionamento: '', laboratorio: '', tipo_campione: 'superficie',
    parametro: '', risultato: '', conforme: true, note: '',
  });

  const set = f => e => setForm(p => ({
    ...p,
    [f]: e.target.type === 'checkbox' ? e.target.checked : e.target.value,
  }));

  const handleSave = async () => {
    if (!form.data_campionamento) { alert('Inserisci la data del campionamento.'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('haccp_analisi').insert([{
        struttura_id:       facility.id,
        data_campionamento: form.data_campionamento,
        laboratorio:        form.laboratorio     || null,
        tipo_campione:      form.tipo_campione,
        parametro:          form.parametro       || null,
        risultato:          form.risultato       || null,
        conforme:           form.conforme,
        note:               form.note            || null,
      }]);
      if (error) throw error;
      await invalidate.analisi();
      await invalidate.semafori();
      setShowForm(false);
      setForm({ data_campionamento: '', laboratorio: '', tipo_campione: 'superficie', parametro: '', risultato: '', conforme: true, note: '' });
    } catch (err) {
      alert('Errore: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-black text-amber-600 uppercase tracking-widest">
          Analisi microbiologiche — {analisi.length} registrate
        </h3>
        {canEdit && (
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 text-xs font-black text-amber-600 border border-amber-200 hover:bg-amber-50 px-3 py-1.5 rounded-xl transition-colors">
            <Plus size={12} /> Nuova analisi
          </button>
        )}
      </div>

      {analisi.length === 0 && !showForm && (
        <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-8 text-center">
          <FlaskConical size={36} className="mx-auto text-slate-300 mb-3" />
          <p className="font-bold text-slate-500">Nessuna analisi registrata</p>
        </div>
      )}

      <div className="space-y-3">
        {analisi.map(a => (
          <div key={a.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <span className="text-xs font-black text-slate-500 uppercase">{a.tipo_campione}</span>
                <span className="text-xs text-slate-400">{a.data_campionamento}</span>
              </div>
              {a.parametro  && <p className="text-sm font-bold text-slate-700">{a.parametro}</p>}
              {a.risultato  && <p className="text-xs text-slate-500">Risultato: {a.risultato}</p>}
              {a.laboratorio && <p className="text-xs text-slate-400">Lab: {a.laboratorio}</p>}
              {a.note        && <p className="text-xs text-slate-400 italic">{a.note}</p>}
            </div>
            <span className={`shrink-0 text-xs font-black px-2.5 py-1 rounded-lg border ${
              a.conforme
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}>
              {a.conforme ? '✓ Conforme' : '✗ NC'}
            </span>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 space-y-4">
          <h4 className="font-black text-amber-700 text-sm uppercase tracking-widest">Nuova analisi</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LBL}>Data campionamento *</label>
              <input type="date" value={form.data_campionamento} onChange={set('data_campionamento')} className={INP2} />
            </div>
            <div>
              <label className={LBL}>Tipo campione</label>
              <select value={form.tipo_campione} onChange={set('tipo_campione')} className={INP2}>
                <option value="superficie">Superficie</option>
                <option value="mani">Mani operatori</option>
                <option value="acqua">Acqua</option>
                <option value="alimento">Alimento</option>
              </select>
            </div>
            <div>
              <label className={LBL}>Parametro analizzato</label>
              <input type="text" value={form.parametro} onChange={set('parametro')} className={INP2} placeholder="Es. Listeria, E.coli, Salmonella" />
            </div>
            <div>
              <label className={LBL}>Laboratorio</label>
              <input type="text" value={form.laboratorio} onChange={set('laboratorio')} className={INP2} />
            </div>
            <div>
              <label className={LBL}>Risultato</label>
              <input type="text" value={form.risultato} onChange={set('risultato')} className={INP2} placeholder="Es. Assente in 25g" />
            </div>
            <div className="flex items-center gap-3 pt-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.conforme} onChange={set('conforme')} className="accent-amber-500 w-4 h-4" />
                <span className="text-sm font-bold text-slate-700">Conforme</span>
              </label>
            </div>
            <div className="col-span-2">
              <label className={LBL}>Note</label>
              <textarea value={form.note} onChange={set('note')} rows={2} className={INP2} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl">Annulla</button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 bg-amber-500 text-white px-5 py-2 rounded-xl text-sm font-black hover:bg-amber-600 disabled:opacity-60">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Salva
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// TAB 5 — FORMAZIONE
// ══════════════════════════════════════════════════════════════
function FormazioneTab({ facility, formazione, invalidate, canEdit }) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [form, setForm]         = useState({
    persona: '', ruolo: 'addetto', tipo_formazione: '',
    ente_formatore: '', data_formazione: '', ore: '',
    data_scadenza: '', note: '',
  });

  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }));

  const handleSave = async () => {
    if (!form.persona) { alert('Inserisci il nome della persona.'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('haccp_formazione').insert([{
        struttura_id:   facility.id,
        persona:        form.persona,
        ruolo:          form.ruolo,
        tipo_formazione:form.tipo_formazione  || null,
        ente_formatore: form.ente_formatore   || null,
        data_formazione:form.data_formazione  || null,
        ore:            form.ore ? parseFloat(form.ore) : null,
        data_scadenza:  form.data_scadenza    || null,
        note:           form.note             || null,
      }]);
      if (error) throw error;
      await invalidate.formazione();
      await invalidate.semafori();
      setShowForm(false);
      setForm({ persona: '', ruolo: 'addetto', tipo_formazione: '', ente_formatore: '', data_formazione: '', ore: '', data_scadenza: '', note: '' });
    } catch (err) {
      alert('Errore: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Scadenza alert
  const oggi = new Date();
  const scaduti   = formazione.filter(f => f.data_scadenza && new Date(f.data_scadenza) < oggi);
  const inScadenza = formazione.filter(f => {
    if (!f.data_scadenza) return false;
    const d = new Date(f.data_scadenza);
    const diff = (d - oggi) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 60;
  });

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-black text-amber-600 uppercase tracking-widest">
          Piano formazione HACCP — {formazione.length} record
        </h3>
        {canEdit && (
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 text-xs font-black text-amber-600 border border-amber-200 hover:bg-amber-50 px-3 py-1.5 rounded-xl transition-colors">
            <Plus size={12} /> Aggiungi
          </button>
        )}
      </div>

      {/* Alert scadenze */}
      {scaduti.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle size={16} className="text-red-500 shrink-0" />
          <p className="text-sm font-bold text-red-700">{scaduti.length} attestato/i scaduto/i</p>
        </div>
      )}
      {inScadenza.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle size={16} className="text-amber-500 shrink-0" />
          <p className="text-sm font-bold text-amber-700">{inScadenza.length} attestato/i in scadenza entro 60 giorni</p>
        </div>
      )}

      {formazione.length === 0 && !showForm && (
        <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-8 text-center">
          <GraduationCap size={36} className="mx-auto text-slate-300 mb-3" />
          <p className="font-bold text-slate-500">Nessun record di formazione</p>
        </div>
      )}

      <div className="space-y-3">
        {formazione.map(f => {
          const scaduto   = f.data_scadenza && new Date(f.data_scadenza) < oggi;
          const inScad    = f.data_scadenza && !scaduto && (new Date(f.data_scadenza) - oggi) / (1000*60*60*24) <= 60;
          return (
            <div key={f.id} className={`bg-white border rounded-xl p-4 space-y-1 ${scaduto ? 'border-red-200' : inScad ? 'border-amber-200' : 'border-slate-200'}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-slate-800 text-sm">{f.persona}</p>
                  <p className="text-xs text-slate-400 uppercase font-bold">{f.ruolo}</p>
                </div>
                {f.data_scadenza && (
                  <span className={`text-xs font-black px-2.5 py-1 rounded-lg border ${
                    scaduto  ? 'bg-red-50 border-red-200 text-red-700'   :
                    inScad   ? 'bg-amber-50 border-amber-200 text-amber-700' :
                               'bg-emerald-50 border-emerald-200 text-emerald-700'
                  }`}>
                    {scaduto ? '⚠ Scaduto' : inScad ? '⚡ Scade presto' : '✓ Valido'}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-4 text-xs text-slate-400 mt-1">
                {f.tipo_formazione  && <span>{f.tipo_formazione}</span>}
                {f.data_formazione  && <span>Data: {f.data_formazione}</span>}
                {f.ore              && <span>{f.ore}h</span>}
                {f.data_scadenza    && <span>Scadenza: {f.data_scadenza}</span>}
                {f.ente_formatore   && <span>Ente: {f.ente_formatore}</span>}
              </div>
              {f.note && <p className="text-xs text-slate-300 italic">{f.note}</p>}
            </div>
          );
        })}
      </div>

      {showForm && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 space-y-4">
          <h4 className="font-black text-amber-700 text-sm uppercase tracking-widest">Nuovo record formazione</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LBL}>Persona *</label>
              <input type="text" value={form.persona} onChange={set('persona')} className={INP2} placeholder="Nome Cognome" />
            </div>
            <div>
              <label className={LBL}>Ruolo</label>
              <select value={form.ruolo} onChange={set('ruolo')} className={INP2}>
                <option value="r_haccp">R-HACCP</option>
                <option value="addetto">Addetto</option>
                <option value="responsabile">Responsabile</option>
              </select>
            </div>
            <div>
              <label className={LBL}>Tipo formazione</label>
              <input type="text" value={form.tipo_formazione} onChange={set('tipo_formazione')} className={INP2} placeholder="Es. HACCP base, aggiornamento" />
            </div>
            <div>
              <label className={LBL}>Ente formatore</label>
              <input type="text" value={form.ente_formatore} onChange={set('ente_formatore')} className={INP2} />
            </div>
            <div>
              <label className={LBL}>Data formazione</label>
              <input type="date" value={form.data_formazione} onChange={set('data_formazione')} className={INP2} />
            </div>
            <div>
              <label className={LBL}>Ore</label>
              <input type="number" step="0.5" value={form.ore} onChange={set('ore')} className={INP2} placeholder="Es. 8" />
            </div>
            <div>
              <label className={LBL}>Scadenza attestato</label>
              <input type="date" value={form.data_scadenza} onChange={set('data_scadenza')} className={INP2} />
            </div>
            <div>
              <label className={LBL}>Note</label>
              <input type="text" value={form.note} onChange={set('note')} className={INP2} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl">Annulla</button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 bg-amber-500 text-white px-5 py-2 rounded-xl text-sm font-black hover:bg-amber-600 disabled:opacity-60">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Salva
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// COMPONENTE NOTE OPERATIVE — campi specifici per modello
// Alimentano direttamente il prompt di generazione del manuale
// ══════════════════════════════════════════════════════════════
function NoteOperativeSection({ form, set, modello }) {
  const isCucinaInterna = modello === 'cucina_interna';
  const isAppalto       = modello === 'appalto_fresco_caldo';
  const isVeicolato     = modello === 'distribuzione_veicolata';

  return (
    <section className="space-y-6">
      <h3 className="text-xs font-black text-amber-600 uppercase tracking-widest border-b border-amber-100 pb-2">
        Dati operativi struttura — alimentano il manuale
      </h3>

      {/* ── DESCRIZIONE CUCINA / LOCALI (comune a tutti i modelli) ── */}
      <div className="space-y-4">
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Locali e layout</p>
        <div>
          <label className={LBL}>
            {isCucinaInterna ? 'Descrizione cucina (ubicazione, layout, flussi, zone)' :
             isAppalto       ? 'Descrizione cucina e locali (chi gestisce cosa, layout, flussi)' :
                               'Descrizione locali di distribuzione (dove avviene, layout)'}
          </label>
          <textarea
            value={form.op_nuclei_note}
            onChange={set('op_nuclei_note')}
            rows={3}
            className={INP}
            placeholder={
              isCucinaInterna
                ? 'es. Cucina al piano terra (ca. 80 mq). Zona cottura separata dalla zona preparazione fredda. Accesso diretto al corridoio di distribuzione. Locale lavaggio stoviglie separato.'
                : isAppalto
                ? 'es. Cucina al piano terra gestita da Vivenda SpA con proprio personale. L\'OSA gestisce le cucinette di nucleo ai piani per colazioni e merende. Locale lavaggio stoviglie gestito dal fornitore.'
                : 'es. La distribuzione avviene nella sala da pranzo al piano terra. I pasti arrivano in contenitori isotermici dall\'ingresso lato cortile. Ogni nucleo ha una cucinetta per colazione e merenda.'
            }
          />
        </div>
        <div>
          <label className={LBL}>Orari distribuzione pasti</label>
          <input type="text" value={form.op_orari_distribuzione} onChange={set('op_orari_distribuzione')} className={INP}
            placeholder="es. Colazione 7:30 · Pranzo 12:00 · Merenda 15:30 · Cena 18:30" />
        </div>
      </div>

      {/* ── APPARECCHIATURE FRIGORIFERE ── */}
      <div className="space-y-3">
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Apparecchiature frigorifere</p>

        {/* Box istruzioni denominazione */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 space-y-1.5">
          <p className="text-xs font-black text-amber-700">Regole di denominazione — necessarie per generare le schede di monitoraggio corrette</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-1">
            {[
              { prefisso: 'F1, F2…', desc: 'Frigorifero cucina (colonna su scheda unica 2A cucina)' },
              { prefisso: 'C1, C2…', desc: 'Congelatore cucina (colonna su scheda unica 2B)' },
              { prefisso: 'FR1, FR2…', desc: 'Frigorifero reparto (scheda 2A separata per ognuno)' },
              { prefisso: 'FD', desc: 'Frigorifero disfagici (scheda 2A separata)' },
              { prefisso: 'CR1, CR2…', desc: 'Congelatore reparto (scheda 2B separata per ognuno)' },
            ].map(r => (
              <div key={r.prefisso} className="flex items-start gap-2">
                <span className="text-xs font-black text-amber-600 shrink-0 w-16">{r.prefisso}</span>
                <span className="text-xs text-amber-700">{r.desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className={LBL}>Elenco apparecchiature (una per riga)</label>
          <textarea
            value={form.apparecchiature_frigorifere}
            onChange={set('apparecchiature_frigorifere')}
            rows={5}
            className={INP}
            placeholder={
              isCucinaInterna
                ? 'F1 – Frigorifero cucina carni e latticini\nF2 – Frigorifero cucina frutta e verdura\nC1 – Congelatore cucina\nFR1 – Frigorifero reparto nucleo A\nFR2 – Frigorifero reparto nucleo B\nFD – Frigorifero disfagici'
                : isAppalto
                ? 'F1 – Frigorifero cucina (gestito dal fornitore)\nFR1 – Frigorifero cucinetta nucleo A\nFR2 – Frigorifero cucinetta nucleo B'
                : 'FR1 – Frigorifero nucleo A\nFR2 – Frigorifero nucleo B\nFD – Frigorifero locale disfagici'
            }
          />
          <p className="text-[10px] text-slate-400 mt-1.5">
            Formato: <strong>Codice – Descrizione</strong> · Una riga per apparecchiatura · Il codice determina quale scheda viene generata
          </p>
        </div>
      </div>

      {/* ── DISTRIBUTORI AUTOMATICI ── */}
      <div className="space-y-3">
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Distributori automatici</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
              <input type="checkbox" checked={form.op_macchinetta_caffe} onChange={set('op_macchinetta_caffe')} className="accent-amber-500 w-4 h-4" />
              <div>
                <span className="text-sm font-bold text-slate-700">Macchinetta caffè / bevande calde</span>
                <p className="text-xs text-slate-400">Distributore automatico bevande calde</p>
              </div>
            </label>
            {form.op_macchinetta_caffe && (
              <div>
                <label className={LBL}>N° macchinette e ubicazione</label>
                <input type="text" value={form.op_macchinetta_caffe_note} onChange={set('op_macchinetta_caffe_note')} className={INP}
                  placeholder="es. 2 macchinette: 1 al piano terra (sala comune), 1 al piano 1" />
              </div>
            )}
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
              <input type="checkbox" checked={form.op_distributore_acqua} onChange={set('op_distributore_acqua')} className="accent-amber-500 w-4 h-4" />
              <div>
                <span className="text-sm font-bold text-slate-700">Distributore acqua / microfiltratore</span>
                <p className="text-xs text-slate-400">Erogatore acqua microfiltrata o naturale</p>
              </div>
            </label>
            {form.op_distributore_acqua && (
              <div>
                <label className={LBL}>N° distributori e ubicazione</label>
                <input type="text" value={form.op_distributore_acqua_note} onChange={set('op_distributore_acqua_note')} className={INP}
                  placeholder="es. 1 microfiltratore cucina + 1 distributore sala da pranzo" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── SPECIFICITÀ PER MODELLO ── */}

      {/* Appalto — cucinette nucleo */}
      {isAppalto && (
        <div className="space-y-3">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Specificità appalto</p>
          <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
            <input type="checkbox" checked={form.op_cucinette_nuclei} onChange={set('op_cucinette_nuclei')} className="accent-amber-500 w-4 h-4" />
            <div>
              <span className="text-sm font-bold text-slate-700">Cucinette di nucleo gestite dall'OSA</span>
              <p className="text-xs text-slate-400">Per colazioni, merende, preparazioni leggere</p>
            </div>
          </label>
          {form.op_cucinette_nuclei && (
            <div>
              <label className={LBL}>Descrizione cucinette (quante, dove, cosa viene preparato)</label>
              <textarea value={form.op_cucinette_note} onChange={set('op_cucinette_note')} rows={2} className={INP}
                placeholder="es. 2 cucinette ai piani 1 e 2. Utilizzate per colazione (caffè, latte) e merenda pomeridiana." />
            </div>
          )}
        </div>
      )}

      {/* Veicolato — specifiche ricevimento e cena */}
      {isVeicolato && (
        <div className="space-y-3">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Specificità distribuzione veicolata</p>
          <div>
            <label className={LBL}>Modalità ricevimento pasti (CCP temperatura)</label>
            <textarea value={form.op_cucinette_note} onChange={set('op_cucinette_note')} rows={2} className={INP}
              placeholder="es. Pasti consegnati all'ingresso cucina lato cortile tra 11:30 e 12:00. Verifica temperatura: caldi ≥65°C, freddi ≤4°C." />
          </div>
          <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
            <input type="checkbox" checked={form.op_cucinette_nuclei} onChange={set('op_cucinette_nuclei')} className="accent-amber-500 w-4 h-4" />
            <div>
              <span className="text-sm font-bold text-slate-700">Cucinette di nucleo gestite dall'OSA</span>
              <p className="text-xs text-slate-400">Per colazioni, merende, preparazioni leggere</p>
            </div>
          </label>
          {form.op_cucinette_nuclei && (
            <div>
              <label className={LBL}>Descrizione cucinette</label>
              <textarea value={form.op_cucinette_note} onChange={set('op_cucinette_note')} rows={2} className={INP}
                placeholder="es. 8 cucinette (una per nucleo). Colazione e merenda gestite dall'OSA." />
            </div>
          )}
          <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
            <input type="checkbox" checked={form.op_cena_abbattuta} onChange={set('op_cena_abbattuta')} className="accent-amber-500 w-4 h-4" />
            <div>
              <span className="text-sm font-bold text-slate-700">Cena con teglie abbattute</span>
              <p className="text-xs text-slate-400">Riattivazione in forno ≥75°C al cuore del prodotto</p>
            </div>
          </label>
          {form.op_cena_abbattuta && (
            <div>
              <label className={LBL}>Note gestione cena abbattuta</label>
              <input type="text" value={form.op_cena_abbattuta_note} onChange={set('op_cena_abbattuta_note')} className={INP}
                placeholder="es. Teglie consegnate il mattino ≤4°C. Riattivazione forni reparto dalle 17:30." />
            </div>
          )}
        </div>
      )}

      {/* ── SPECIFICITÀ OSPITI (comuni a tutti) ── */}
      <div className="space-y-3">
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Specificità ospiti</p>

        <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
          <input type="checkbox" checked={form.op_disfagici} onChange={set('op_disfagici')} className="accent-amber-500 w-4 h-4" />
          <div>
            <span className="text-sm font-bold text-slate-700">Ospiti disfagici</span>
            <p className="text-xs text-slate-400">Locale dedicato, frigorifero identificato, pasto nominale</p>
          </div>
        </label>
        {form.op_disfagici && (
          <div>
            <label className={LBL}>Descrizione gestione disfagici (locale, frigo, identificazione pasto)</label>
            <textarea value={form.op_disfagici_note} onChange={set('op_disfagici_note')} rows={2} className={INP}
              placeholder="es. Locale disfagici al piano interrato con frigorifero dedicato (FD). Pasti nominali con etichetta. Frullati preparati al momento." />
          </div>
        )}

        <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
          <input type="checkbox" checked={form.op_srtr} onChange={set('op_srtr')} className="accent-amber-500 w-4 h-4" />
          <div>
            <span className="text-sm font-bold text-slate-700">Struttura SRTR / psichiatrica</span>
            <p className="text-xs text-slate-400">Include sezione specificità riabilitazione psichiatrica nel manuale</p>
          </div>
        </label>

        <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
          <input type="checkbox" checked={form.op_monouso_infetti} onChange={set('op_monouso_infetti')} className="accent-amber-500 w-4 h-4" />
          <div>
            <span className="text-sm font-bold text-slate-700">Pazienti infetti — pasto monouso</span>
            <p className="text-xs text-slate-400">Pasto monouso + smaltimento rifiuti speciali (non RSU)</p>
          </div>
        </label>

        <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
          <input type="checkbox" checked={form.op_riabilitazione} onChange={set('op_riabilitazione')} className="accent-amber-500 w-4 h-4" />
          <div>
            <span className="text-sm font-bold text-slate-700">Coinvolgimento pazienti in attività cucina (riabilitazione)</span>
            <p className="text-xs text-slate-400">Laboratori alimentari terapeutici — sezione dedicata nel manuale</p>
          </div>
        </label>
      </div>

      {/* ── ALLERGENI E CELIACHIA ── */}
      <div className="space-y-3">
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Allergeni e celiachia</p>
        <div>
          <label className={LBL}>Specificità allergeni / celiachia della struttura</label>
          <textarea value={form.op_celiachia_note} onChange={set('op_celiachia_note')} rows={2} className={INP}
            placeholder="es. 3 ospiti celiaci: dieta gluten-free certificata, preparazione separata con utensili dedicati, fornitore con certificazione prodotti gluten-free." />
        </div>
      </div>

    </section>
  );
}
