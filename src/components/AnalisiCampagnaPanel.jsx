import { useState, useMemo, useEffect } from 'react';
import { useSurveyCampagne } from '../hooks/useSurveyCampagne';
import { supabase } from '../supabaseClient';
import { generaReportSurveyCampagna, semaforo } from '../services/surveyCampagnaDocService';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { LABEL_MAP } from '../config/surveyLabels';
import { semaforoColor } from '../utils/surveyColors';
import { buildDistribuzione } from '../utils/surveyDistribuzione';
import { generaRadarBase64, generaTortaDomandaBase64, generaAttivitaBase64 } from '../utils/campagnaCharts';
import { buildPrompt } from '../config/aiPrompts';
import { callClaude } from '../utils/aiClient';
import { getStaffCount, computeRedemptionRate } from '../utils/redemption';
import DistribuzioneRisposte from './DistribuzioneRisposte';

// Categorie per il radar
export const CATEGORIE_CLIENT = {
  personale:    ['voto_assistenza', 'rispetto_dignita', 'assistenza_medica', 'assistenza_notturna', 'soddisfazione_tempo'],
  struttura:    ['soddisfazione_pulizia', 'voto_alloggio', 'voto_bagno', 'voto_spazio_esterno'],
  servizi:      ['voto_animazione', 'soddisfazione_servizi', 'fisioterapia'],
  ristorazione: ['voto_ristorazione_qualita', 'voto_pulizie'],
  accoglienza:  ['info_ingresso', 'info_prenotazione'],
  reputazione:  ['nps_consiglio', 'soddisfazione_generale'],
};

export const CATEGORIE_OPERATOR = {
  clima:        ['riconoscimento', 'supporto_leadership', 'sicurezza_ambiente'],
  organizzazione: ['chiarezza_ruolo', 'qualita_tecnica', 'etica_assistenza'],
  reputazione:  ['reputazione_lavoro', 'reputazione_servizio', 'soddisfazione_generale'],
};

export function NpsGauge({ nps }) {
  if (nps == null) return null;
  // NPS da avg_scores è già normalizzato 0-100
  // Promotori: >=90, Passivi: 70-89, Detrattori: <70 (scala 0-100)
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">NPS — Propensione raccomandazione</p>
      <div className="text-center mb-3">
        <span className="text-5xl font-black text-blue-600">{nps}</span>
        <span className="text-slate-400 text-sm">/100</span>
      </div>
      <div className="relative h-2 mb-2">
        <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
          <div style={{ flex: Math.max(nps, 5), background: '#0ca30c' }} className="rounded-l-full" />
          <div style={{ flex: Math.max(100 - nps - 10, 5), background: '#eda100' }} />
          <div style={{ flex: 10, background: '#e34948' }} className="rounded-r-full" />
        </div>
        {/* Indicatore posizione esatta del punteggio sulla scala 0-100 —
            i segmenti sopra sono proporzioni, non una scala leggibile da sole. */}
        <div
          title={`${nps}/100`}
          className="absolute top-1/2 w-1 h-4 bg-slate-800 rounded-full border border-white shadow"
          style={{ left: `${nps}%`, transform: 'translate(-50%, -50%)' }}
        />
      </div>
    </div>
  );
}

export function RadarCategorie({ avgScores, udoAvgScores, surveyType }) {
  const cats = surveyType === 'operator' ? CATEGORIE_OPERATOR : CATEGORIE_CLIENT;
  const data = Object.entries(cats).map(([cat, keys]) => {
    const vals = keys.map(k => avgScores?.[k]).filter(v => v != null);
    const udoVals = keys.map(k => udoAvgScores?.[k]).filter(v => v != null);
    return {
      cat: cat.charAt(0).toUpperCase() + cat.slice(1),
      struttura: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null,
      udo: udoVals.length ? Math.round(udoVals.reduce((a, b) => a + b, 0) / udoVals.length) : null,
    };
  }).filter(d => d.struttura != null);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Mappa dimensionale</p>
      <ResponsiveContainer width="100%" height={260}>
        <RadarChart data={data}>
          <PolarGrid stroke="#e2e8f0" />
          <PolarAngleAxis dataKey="cat" tick={{ fontSize: 11, fill: '#64748b' }} />
          <Radar name="Struttura" dataKey="struttura" stroke="#2a78d6" fill="#2a78d6" fillOpacity={0.25} strokeWidth={2} />
          <Radar name="Media UDO" dataKey="udo" stroke="#94a3b8" fill="none" strokeWidth={1.5} strokeDasharray="4 2" />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const cat = payload[0]?.payload?.cat?.toLowerCase();
              const keys = Object.entries(cats).find(([k]) => k === cat)?.[1] ?? [];
              return (
                <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs max-w-[200px]">
                  <p className="font-bold text-slate-700 mb-2">{payload[0]?.payload?.cat}</p>
                  <p className="text-blue-600 font-medium mb-1">Struttura: {payload[0]?.value}/100</p>
                  {payload[1] && <p className="text-slate-400 mb-2">Media UDO: {payload[1]?.value}/100</p>}
                  {keys.length > 0 && (
                    <>
                      <p className="text-slate-400 text-[10px] uppercase tracking-wide mb-1">Domande incluse:</p>
                      {keys.map(k => (
                        <p key={k} className="text-slate-500 text-[10px] flex justify-between gap-2">
                          <span>{LABEL_MAP[k] ?? k}</span>
                          <span className="font-medium text-slate-700">{avgScores?.[k] ?? '–'}</span>
                        </p>
                      ))}
                    </>
                  )}
                </div>
              );
            }}
          />
        </RadarChart>
      </ResponsiveContainer>
      <div className="flex gap-4 justify-center text-[10px] text-slate-500 mt-1">
        <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-blue-500 inline-block"></span>Struttura</span>
        <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-slate-400 inline-block" style={{borderTop:'2px dashed #94a3b8'}}></span>Media UDO</span>
      </div>
    </div>
  );
}

export function BarreMinMax({ avgScores, minScores, maxScores, udoAvgScores }) {
  if (!avgScores) return null;
  const entries = Object.entries(avgScores)
    .filter(([k]) => k !== 'nps_consiglio')
    .sort((a, b) => b[1] - a[1]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tutte le domande — /100</p>
        <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-lg font-bold">
          {entries.filter(([,v]) => v < 75).length} sotto soglia (75)
        </span>
      </div>

      <div className="flex gap-3 text-[10px] text-slate-400 mb-3">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block bg-green-600"></span>&gt;80</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block bg-blue-600"></span>75–80</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block bg-amber-500"></span>70–75</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block bg-red-500"></span>&lt;70</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 inline-block bg-slate-400 opacity-50"></span>Media UDO</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block bg-slate-900 border border-white shadow"></span>Media struttura</span>
      </div>

      <div className="flex text-[10px] text-slate-400 mb-2 gap-2">
        <span style={{width:148}}>Domanda</span>
        <span className="flex-1">Range risposte</span>
        <span style={{width:28}} className="text-right">Med.</span>
        <span style={{width:44}} className="text-right">Min–Max</span>
        <span style={{width:28}} className="text-right">⌀UDO</span>
      </div>

      <div className="space-y-2">
        {entries.map(([key, avg]) => {
          const min = minScores?.[key] ?? 0;
          const max = maxScores?.[key] ?? 100;
          const udo = udoAvgScores?.[key];
          const color = semaforoColor(avg);
          const label = LABEL_MAP[key] ?? key;
          return (
            <div key={key} className="flex items-center gap-2">
              <span className="text-[11px] text-slate-600 truncate" style={{width:148}}>{label}</span>
              <div
                className="flex-1 relative h-2.5 bg-slate-100 rounded-full overflow-visible"
                title={`Media: ${avg}/100 | Min: ${min} | Max: ${max}${udo != null ? ` | Media UDO: ${udo}` : ''}`}
              >
                <div
                  className="absolute h-full rounded-full"
                  style={{
                    left: `${min}%`,
                    width: `${max - min}%`,
                    background: color,
                    opacity: 0.85,
                  }}
                />
                {udo != null && (
                  <div
                    title={`Media UDO: ${udo}/100`}
                    className="absolute cursor-help"
                    style={{
                      left: `${udo}%`,
                      top: -4,
                      width: 3,
                      height: 20,
                      background: '#1e40af',
                      opacity: 0.7,
                      borderRadius: 2,
                      transform: 'translateX(-50%)',
                      zIndex: 1,
                    }}
                  />
                )}
                {/* Media struttura — unico punto sulla barra che indica dove si
                    trova davvero il risultato, non solo il range min-max. */}
                <div
                  title={`Media struttura: ${avg}/100`}
                  className="absolute cursor-help rounded-full border-2 border-white shadow"
                  style={{
                    left: `${avg}%`,
                    top: '50%',
                    width: 10,
                    height: 10,
                    background: '#0f172a',
                    transform: 'translate(-50%, -50%)',
                    zIndex: 2,
                  }}
                />
              </div>
              <span className="text-[11px] font-medium text-slate-700" style={{width:28, textAlign:'right'}}>{avg}</span>
              <span className="text-[10px] text-slate-400" style={{width:44, textAlign:'right'}}>{min}–{max}</span>
              <span className="text-[10px] text-blue-600 font-medium" style={{width:28, textAlign:'right'}} title="Media UDO">
                {udo != null ? `⌀${udo}` : '–'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Le 4 tabelle raw che possono contenere risposte survey_type='client' (vedi
// sl_righe/rsa_righe/dis_righe/psi_righe in fix_survey_seniorliving_case_mappings.sql).
// Quale delle 4 ospita davvero una data struttura NON si può dedurre da
// survey_type — dipende dall'udo_type della campagna (es. "PSI" →
// survey_centri_psichiatria, anche per una struttura chiamata "Casa Protetta
// per Disabili") — va verificato riga per riga, vedi resolveSourceTableCampagna().
export const TABELLE_CLIENT = ['survey_rsa', 'survey_seniorliving', 'survey_centri_psichiatria', 'survey_centri_disabilita'];

// Tabella raw attesa per udo_type — usata sia come fallback informato quando
// il conteggio reale non produce un match (invece di indovinare sempre
// 'survey_rsa'), sia come guardia difensiva in resolveSourceTableCampagna()
// per intercettare un source_table risolto che non torna con l'udo_type
// della facility (vedi bug OV-Aris/SL, stessa campagna 418c25e4-... del bug
// BM-Casa-Protetta-Disabili/PSI di agosto).
const UDO_TYPE_TO_TABLE = {
  RSA: 'survey_rsa',
  SL: 'survey_seniorliving',
  PSI: 'survey_centri_psichiatria',
  DIS: 'survey_centri_disabilita',
};

// Righe marcate come duplicato-da-eliminare vanno escluse dai "Commenti liberi":
// le query sotto interrogano le tabelle raw direttamente (non v_survey_data_normalized/
// v_survey_campagne) quindi il filtro va applicato qui a mano.
export async function fetchEliminatiSet(tabelle) {
  const { data } = await supabase
    .from('survey_duplicati')
    .select('tabella_origine, riga_id')
    .eq('stato', 'eliminato')
    .in('tabella_origine', tabelle);
  return new Set((data ?? []).map(d => `${d.tabella_origine}:${d.riga_id}`));
}

// Commenti liberi della campagna, aggregati da tutte le tabelle raw pertinenti
// al survey_type. Unica implementazione condivisa da useEffect (preview a
// schermo) e generaDocumenti() (fetch fresco per il docx) — prima erano due
// copie che rischiavano di divergere (mancava survey_centri_disabilita).
async function fetchNomiCampagna(selected, facility) {
  const { data: nomiData } = await supabase
    .from('survey_campagna_nomi')
    .select('nome_survey')
    .eq('campagna_id', selected.campagna_id)
    .eq(selected.is_company_wide ? 'company_id' : 'facility_id',
        selected.is_company_wide ? facility.company_id : facility.id);

  return (nomiData ?? []).map(r => r.nome_survey);
}

// Colonne "attività" di survey_seniorliving (uniche colonne di partecipazione
// nel dataset — nessun'altra survey_type/tabella le ha) con etichetta italiana.
const ATTIVITA_LABELS = {
  uscite_territorio: 'Uscite sul territorio',
  gioco_carte: 'Gioco carte',
  ginnastica: 'Ginnastica',
  musica: 'Musica',
  beauty_routine: 'Beauty routine',
  laboratori_creativi: 'Laboratori creativi',
  enigmistica: 'Enigmistica',
  giornate_tematiche: 'Giornate tematiche',
};

// Righe grezze survey_seniorliving con le colonne attività, per il periodo/
// facility della campagna. Ritorna [] per qualunque altro survey_type/facility
// (nessuna colonna di partecipazione fuori da survey_seniorliving).
async function fetchAttivitaCampagna(selected, facility) {
  if (selected.survey_type !== 'client') return [];
  const nomi = await fetchNomiCampagna(selected, facility);
  if (!nomi.length) return [];

  const { data } = await supabase
    .from('survey_seniorliving')
    .select(['id', 'struttura', ...Object.keys(ATTIVITA_LABELS)].join(', '))
    .in('struttura', nomi)
    .gte('created_at', selected.data_inizio)
    .lte('created_at', selected.data_fine + 'T23:59:59');
  return data ?? [];
}

async function fetchCommentiCampagna(selected, facility) {
  const nomi = await fetchNomiCampagna(selected, facility);
  if (!nomi.length) return [];

  const dataInizio = selected.data_inizio;
  const dataFine = selected.data_fine + 'T23:59:59';

  if (selected.survey_type === 'operator') {
    const [{ data }, eliminati] = await Promise.all([
      supabase
        .from('survey_personale')
        .select('id, formazione_12mesi, note, struttura')
        .in('struttura', nomi)
        .gte('created_at', dataInizio)
        .lte('created_at', dataFine),
      fetchEliminatiSet(['survey_personale']),
    ]);
    return (data ?? [])
      .filter(r => !eliminati.has(`survey_personale:${r.id}`))
      .filter(r => r.formazione_12mesi?.trim() || r.note?.trim());
  }

  const [rsa, sl, psi, disab, eliminati] = await Promise.all([
    supabase.from('survey_rsa').select('id, note, struttura')
      .in('struttura', nomi).gte('created_at', dataInizio).lte('created_at', dataFine),
    supabase.from('survey_seniorliving').select('id, "Note", struttura')
      .in('struttura', nomi).gte('created_at', dataInizio).lte('created_at', dataFine),
    supabase.from('survey_centri_psichiatria').select('id, note, struttura')
      .in('struttura', nomi).gte('created_at', dataInizio).lte('created_at', dataFine),
    supabase.from('survey_centri_disabilita').select('id, risposte_cura_assistenza, struttura')
      .in('struttura', nomi).gte('created_at', dataInizio).lte('created_at', dataFine),
    fetchEliminatiSet(TABELLE_CLIENT),
  ]);
  return [
    ...(rsa.data ?? []).filter(r => !eliminati.has(`survey_rsa:${r.id}`)).map(r => ({ note: r.note, struttura: r.struttura })),
    ...(sl.data ?? []).filter(r => !eliminati.has(`survey_seniorliving:${r.id}`)).map(r => ({ note: r.Note, struttura: r.struttura })),
    ...(psi.data ?? []).filter(r => !eliminati.has(`survey_centri_psichiatria:${r.id}`)).map(r => ({ note: r.note, struttura: r.struttura })),
    ...(disab.data ?? []).filter(r => !eliminati.has(`survey_centri_disabilita:${r.id}`)).map(r => ({ note: r.risposte_cura_assistenza, struttura: r.struttura })),
  ].filter(r => r.note?.trim());
}

// source_table NON si può dedurre da survey_type (client → sempre survey_rsa
// era l'assunzione precedente, sbagliata): dipende da quale delle 4 tabelle
// TABELLE_CLIENT ospita davvero la/le struttura/e della campagna, che a sua
// volta dipende dall'udo_type in survey_campagna_nomi (es. "PSI" →
// survey_centri_psichiatria). Bug reale riscontrato su BM-Casa-Protetta-Disabili
// (facility_id=74, campagna 418c25e4-...): nome contiene "Disabili" ma i dati
// reali sono in survey_centri_psichiatria (udo_type="PSI"), non in survey_rsa
// — l'assunzione fissa faceva fallire silenziosamente la query in
// fetchCalendarIdCampagna() (zero righe trovate) senza che nessuno se ne
// accorgesse. Si individua la tabella vera contandone le righe, stesso
// principio già usato in fetchCommentiCampagna() che le interroga tutte e 4.
//
// Round 2 (facility_id=44 "OV-Aris", stessa campagna 418c25e4-...): il
// conteggio reale funziona quando i nomi in survey_campagna_nomi combaciano
// con la colonna struttura nella tabella raw — ma quando non c'è match (nomi
// mancanti per quella facility, o nomi presenti ma senza righe in nessuna
// delle 4 tabelle, es. per differenze case/spazi) i due rami di fallback
// tornavano SEMPRE 'survey_rsa' a prescindere dall'udo_type — la stessa
// assunzione fissa reintrodotta nel percorso d'errore invece che in quello
// felice. Ora il fallback usa UDO_TYPE_TO_TABLE (quando l'udo_type è noto)
// invece di indovinare survey_rsa, e in ogni caso una guardia a fine
// funzione confronta il source_table risolto con quello atteso e logga un
// warning visibile se non combaciano, invece di scrivere silenziosamente
// su survey_ai_reports una tabella sbagliata o vuota.
async function resolveSourceTableCampagna(selected, facility) {
  if (selected.survey_type === 'operator') return 'survey_personale';

  // udo_type arriva già da v_survey_campagne (facility_righe.udo_type,
  // select('*') in useSurveyCampagne) — null per le campagne aziendali
  // (company_righe), che spaziano più udo_type e quindi non hanno un'unica
  // tabella attesa: in quel caso niente fallback informato né guardia sotto.
  const tabellaAttesa = UDO_TYPE_TO_TABLE[selected.udo_type] ?? null;

  const nomi = await fetchNomiCampagna(selected, facility);
  let sourceTable;
  if (!nomi.length) {
    sourceTable = tabellaAttesa ?? 'survey_rsa';
    console.warn(`[AnalisiCampagnaPanel] resolveSourceTableCampagna: nessun nome struttura in survey_campagna_nomi per campagna ${selected.campagna_id} / facility ${facility.id} — uso fallback '${sourceTable}' (da udo_type='${selected.udo_type ?? 'n/d'}'). Verifica il collegamento facility_id/campagna_id in survey_campagna_nomi.`);
  } else {
    const conteggi = await Promise.all(
      TABELLE_CLIENT.map(async tabella => {
        const { count } = await supabase
          .from(tabella)
          .select('id', { count: 'exact', head: true })
          .in('struttura', nomi);
        return { tabella, count: count ?? 0 };
      })
    );
    const match = conteggi.find(r => r.count > 0);
    if (!match) {
      sourceTable = tabellaAttesa ?? 'survey_rsa';
      console.warn(`[AnalisiCampagnaPanel] resolveSourceTableCampagna: nessuna riga trovata in nessuna delle ${TABELLE_CLIENT.join(', ')} per i nomi struttura [${nomi.join(' | ')}] (campagna ${selected.campagna_id}, facility ${facility.id}) — uso fallback '${sourceTable}' (da udo_type='${selected.udo_type ?? 'n/d'}'). Controlla che i nomi in survey_campagna_nomi combacino esattamente (case/spazi) con la colonna struttura nella tabella raw reale.`);
    } else {
      sourceTable = match.tabella;
    }
  }

  // Guardia difensiva: il source_table risolto (che sia dal conteggio reale
  // o da un fallback) deve combaciare con la tabella attesa per l'udo_type
  // della facility. Senza questo controllo un mismatch passa silenzioso —
  // survey_ai_reports viene scritto/etichettato con la tabella sbagliata (o
  // vuota) e il report generato si basa su dati inesistenti, come successo
  // due volte sulla stessa campagna 418c25e4-... (BM-Casa-Protetta-Disabili/
  // PSI ad agosto, OV-Aris/SL il 2026-08-20) prima che qualcuno se ne
  // accorgesse a valle.
  if (tabellaAttesa && sourceTable !== tabellaAttesa) {
    console.warn(`[AnalisiCampagnaPanel] resolveSourceTableCampagna: MISMATCH — risolto '${sourceTable}' ma facility ${facility.id} ha udo_type='${selected.udo_type}' che attende '${tabellaAttesa}' (campagna ${selected.campagna_id}, nomi=[${nomi.join(' | ')}]). Verifica i nomi in survey_campagna_nomi e le righe nella tabella attesa.`);
  }

  return sourceTable;
}

// v_survey_data_normalized calcola calendar_id per singola riga di risposta
// (to_char(created_at,'YYYY-MM') in fix_survey_seniorliving_case_mappings.sql),
// non per periodo campagna, e il LEFT JOIN a survey_ai_reports usa solo
// facility_id + calendar_id + source_table (niente campagna_id). Una campagna
// con data_inizio diverso dal mese in cui le risposte sono state effettivamente
// raccolte deve quindi scrivere il calendar_id delle risposte vere, non quello
// nominale della campagna, altrimenti il JOIN non trova mai la riga. Si prende
// il mese della risposta più recente nel periodo — stesso criterio "ultima
// rilevazione" già usato altrove (es. QualityDashboardModal, sort per
// calendar_id decrescente).
async function fetchCalendarIdCampagna(selected, facility, sourceTable) {
  const nomi = await fetchNomiCampagna(selected, facility);
  if (!nomi.length) {
    console.warn(`[AnalisiCampagnaPanel] fetchCalendarIdCampagna: nessun nome struttura per campagna ${selected.campagna_id} / facility ${facility.id} — uso fallback data_inizio (${selected.data_inizio.slice(0, 7)}). Il calendar_id salvato potrebbe non combaciare con v_survey_data_normalized.`);
    return selected.data_inizio.slice(0, 7);
  }

  const { data } = await supabase
    .from(sourceTable)
    .select('created_at')
    .in('struttura', nomi)
    .gte('created_at', selected.data_inizio)
    .lte('created_at', selected.data_fine + 'T23:59:59')
    .order('created_at', { ascending: false })
    .limit(1);

  if (!data?.[0]?.created_at) {
    console.warn(`[AnalisiCampagnaPanel] fetchCalendarIdCampagna: nessuna riga in ${sourceTable} per i nomi [${nomi.join(' | ')}] nel periodo ${selected.data_inizio} → ${selected.data_fine} — uso fallback data_inizio (${selected.data_inizio.slice(0, 7)}). Il calendar_id salvato potrebbe non combaciare con v_survey_data_normalized.`);
    return selected.data_inizio.slice(0, 7);
  }

  return data[0].created_at.slice(0, 7);
}

export default function AnalisiCampagnaPanel({ facility, surveyType, surveys = [], kpiRecords = [], facilities = [], onDataClick, onRestituzioneClick }) {
  const { data: campagne = [], isLoading } = useSurveyCampagne(facility?.id, facility?.company_id);
  const [selectedId, setSelectedId] = useState(null);

  const campagneFiltrate = useMemo(
    () => campagne.filter(c => c.survey_type === surveyType),
    [campagne, surveyType]
  );

  const selected = useMemo(
    () => campagneFiltrate.find(c => c.campagna_id === selectedId) ?? campagneFiltrate[0] ?? null,
    [campagneFiltrate, selectedId]
  );

  const score = useMemo(() => {
    if (!selected?.avg_scores) return null;
    const vals = Object.values(selected.avg_scores).filter(v => v != null);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  }, [selected]);

  // Periodo da passare a Report Direzione/Restituzione (che lavorano su anno+mese,
  // non su un range campagna): l'ultimo calendar_id con dati reali dentro il
  // range della campagna. Se non c'è nessun mese con dati processati nel range
  // (campagna appena chiusa, dati non ancora elaborati), fallback difensivo sul
  // mese di chiusura campagna — non deve mai passare undefined ai modal.
  const restituzionePeriod = useMemo(() => {
    if (!selected) return {};
    const inRange = surveys
      .filter(s => s.type === selected.survey_type)
      .filter(s =>
        s.calendar_id >= selected.data_inizio.slice(0, 7) &&
        s.calendar_id <= selected.data_fine.slice(0, 7)
      )
      .sort((a, b) => b.calendar_id.localeCompare(a.calendar_id));

    const [year, month] = (inRange[0]?.calendar_id ?? selected.data_fine.slice(0, 7)).split('-');
    return { year, month };
  }, [selected, surveys]);

  // Redemption per il box KPI del doc Direzione — stessa fonte/formula del box
  // "Redemption" già esistente in AnalyticsModal.jsx (src/utils/redemption.js):
  // bed_count per clienti, staff_count da KPI per operatori, sommati sulle
  // strutture della società se la campagna è company-wide. Qui il "totale
  // risposte" è quello della campagna (selected.n_risposte), non del mese,
  // e il mese KPI di riferimento è lo stesso calcolato per Report Direzione/
  // Restituzione (restituzionePeriod), per restare coerenti con quei modal.
  const redemptionRate = useMemo(() => {
    if (!selected) return null;
    const isOperator = selected.survey_type === 'operator';
    const calendarId = restituzionePeriod.year && restituzionePeriod.month
      ? `${restituzionePeriod.year}-${restituzionePeriod.month}`
      : null;

    const targetAudience = selected.is_company_wide
      ? facilities
          .filter(f => f.company_id === facility.company_id && !f.is_suspended)
          .reduce((sum, f) => sum + (isOperator
            ? (getStaffCount(kpiRecords, f.id, calendarId) ?? 0)
            : (f.bed_count || 0)), 0)
      : (isOperator
          ? getStaffCount(kpiRecords, facility.id, calendarId)
          : (facility.bed_count || 0));

    return computeRedemptionRate(selected.n_risposte, targetAudience);
  }, [selected, restituzionePeriod, facility, facilities, kpiRecords]);

  const [commenti, setCommenti]   = useState(null);
  const [suntoCommenti, setSuntoCommenti] = useState('');
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiError, setAiError]     = useState(null);
  const [docGenerating, setDocGenerating] = useState(false);

  // Contenuti AI per i documenti Word — generati e rivisti/editati dal
  // direttore nelle card sopra il bottone "Genera documenti Word" (mai
  // generati automaticamente al click: se vuoti, il docx mostra la sezione
  // vuota, stesso trattamento dei placeholder manuali di oggi).
  const [sintesiPeriodo, setSintesiPeriodo]     = useState('');
  const [puntiForza, setPuntiForza]             = useState('');
  const [puntiDebolezza, setPuntiDebolezza]     = useState('');
  const [temiCommenti, setTemiCommenti]         = useState('');
  const [puntiForzaUtenza, setPuntiForzaUtenza]         = useState('');
  const [doveMigliorareUtenza, setDoveMigliorareUtenza] = useState('');
  const [azioniUtenza, setAzioniUtenza]         = useState('');
  const [impegnoUtenza, setImpegnoUtenza]       = useState('');
  const [obiettiviDirezione, setObiettiviDirezione] = useState('');
  const [loadingSintesi, setLoadingSintesi]     = useState(false);
  const [errorSintesi, setErrorSintesi]         = useState(null);
  const [loadingTemi, setLoadingTemi]           = useState(false);
  const [errorTemi, setErrorTemi]               = useState(null);
  const [loadingPunti, setLoadingPunti]         = useState(false);
  const [errorPunti, setErrorPunti]             = useState(null);
  const [loadingPuntiUtenza, setLoadingPuntiUtenza] = useState(false);
  const [errorPuntiUtenza, setErrorPuntiUtenza]     = useState(null);
  const [loadingAzioniImpegno, setLoadingAzioniImpegno] = useState(false);
  const [errorAzioniImpegno, setErrorAzioniImpegno]     = useState(null);
  const [loadingObiettivi, setLoadingObiettivi] = useState(false);
  const [errorObiettivi, setErrorObiettivi]     = useState(null);
  const [showAiGateModal, setShowAiGateModal]   = useState(false);
  const [pendingMissingAi, setPendingMissingAi] = useState([]);

  const showCommenti = commenti !== null; // sempre visibile se il fetch è partito

  useEffect(() => {
    setCommenti(null);
    setSuntoCommenti('');
    setAiError(null);
    setSintesiPeriodo('');
    setPuntiForza('');
    setPuntiDebolezza('');
    setTemiCommenti('');
    setPuntiForzaUtenza('');
    setDoveMigliorareUtenza('');
    setAzioniUtenza('');
    setImpegnoUtenza('');
    setObiettiviDirezione('');
    setErrorSintesi(null);
    setErrorTemi(null);
    setShowAiGateModal(false);
    setPendingMissingAi([]);
    if (!selected) return;

    fetchCommentiCampagna(selected, facility).then(setCommenti);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.campagna_id]);

  async function generaSunto() {
    if (!commenti?.length) return;
    if (!process.env.REACT_APP_ANTHROPIC_API_KEY) {
      setAiError('Chiave API Anthropic non configurata.');
      return;
    }
    setLoadingAI(true);
    setSuntoCommenti('');
    setAiError(null);

    const totaleQuestionari = selected.n_risposte;
    const nCommenti = commenti.length;
    const percRisposta = totaleQuestionari > 0 ? Math.round(nCommenti / totaleQuestionari * 100) : 0;

    const testiFormattati = commenti.map((r, i) =>
      `[${i+1}] ${r.note?.trim() ?? ''}${r.formazione_12mesi?.trim() ? ` | Formazione: ${r.formazione_12mesi.trim()}` : ''}`
    ).join('\n');

    const prompt = buildPrompt('campagnaSuntoCommenti', {
      nCommenti,
      totaleQuestionari,
      percRisposta,
      testiFormattati,
    });

    try {
      const text = await callClaude(prompt, { maxTokens: 1000 });
      setSuntoCommenti(text);
    } catch (err) {
      setAiError('Impossibile generare il sunto. Riprova.');
    } finally {
      setLoadingAI(false);
    }
  }

  // Le tre generazioni AI per i documenti Word: bozze che il direttore rivede
  // ed edita nelle textarea sotto. Ognuna ritorna anche il testo generato
  // (oltre a fare setState) — serve al flusso "Genera con AI ora" del gate
  // sotto, che non può aspettare un giro di render per leggere lo stato aggiornato.
  async function generaSintesiPeriodoAI() {
    if (!selected) return '';
    setLoadingSintesi(true);
    setErrorSintesi(null);
    try {
      const entries = Object.entries(selected.avg_scores ?? {})
        .filter(([k, v]) => k !== 'nps_consiglio' && v != null)
        .sort((a, b) => b[1] - a[1]);
      const topAree = entries.slice(0, 2).map(([k]) => LABEL_MAP[k] ?? k).join(', ') || 'diversi aspetti del servizio';
      const areeAttenzione = entries.slice(-2).map(([k]) => LABEL_MAP[k] ?? k).join(', ') || 'alcuni aspetti del servizio';
      const prompt = buildPrompt('campagnaSintesiPeriodo', {
        facilityName: facility.name,
        periodo: `${selected.data_inizio} → ${selected.data_fine}`,
        nRisposte: selected.n_risposte,
        topAree,
        areeAttenzione,
        npsScore: selected.avg_scores?.nps_consiglio ?? null,
      });
      const text = await callClaude(prompt, { maxTokens: 300 });
      setSintesiPeriodo(text);
      return text;
    } catch (err) {
      setErrorSintesi('Impossibile generare la sintesi. Riprova.');
      return '';
    } finally {
      setLoadingSintesi(false);
    }
  }

  async function generaPuntiDirezionaliAI() {
    if (!selected) return { forza: '', debolezza: '' };
    setLoadingPunti(true);
    setErrorPunti(null);
    try {
      const dataPayload = Object.entries(selected.avg_scores ?? {})
        .filter(([k, v]) => k !== 'nps_consiglio' && v != null)
        .map(([k, v]) => `${LABEL_MAP[k] ?? k}: ${v}/100`)
        .join('\n');
      const prompt = buildPrompt('campagnaPuntiDirezionali', {
        facilityName: facility.name,
        campagnaNome: selected.campagna_nome,
        dataPayload,
      });
      const text = await callClaude(prompt, { maxTokens: 500 });
      const forzaMatch = text.match(/PUNTI DI FORZA\s*([\s\S]*?)PUNTI DI DEBOLEZZA/i);
      const debolezzaMatch = text.match(/PUNTI DI DEBOLEZZA\s*([\s\S]*)/i);
      const forza = (forzaMatch?.[1] ?? text).trim();
      const debolezza = (debolezzaMatch?.[1] ?? '').trim();
      setPuntiForza(forza);
      setPuntiDebolezza(debolezza);
      return { forza, debolezza };
    } catch (err) {
      setErrorPunti('Impossibile generare la proposta. Riprova.');
      return { forza: '', debolezza: '' };
    } finally {
      setLoadingPunti(false);
    }
  }

  async function generaPuntiUtenzaAI() {
    if (!selected) return { forza: '', migliorare: '' };
    setLoadingPuntiUtenza(true);
    setErrorPuntiUtenza(null);
    try {
      const dataPayload = Object.entries(selected.avg_scores ?? {})
        .filter(([k, v]) => k !== 'nps_consiglio' && v != null)
        .map(([k, v]) => `${LABEL_MAP[k] ?? k}: ${v}/100`)
        .join('\n');
      const prompt = buildPrompt('campagnaPuntiUtenza', {
        facilityName: facility.name,
        campagnaNome: selected.campagna_nome,
        dataPayload,
        audience: selected.survey_type === 'operator' ? 'operatori' : 'ospiti',
      });
      const text = await callClaude(prompt, { maxTokens: 500 });
      const forzaMatch = text.match(/I NOSTRI PUNTI DI FORZA\s*([\s\S]*?)DOVE VOGLIAMO MIGLIORARE/i);
      const migliorareMatch = text.match(/DOVE VOGLIAMO MIGLIORARE\s*([\s\S]*)/i);
      const forza = (forzaMatch?.[1] ?? text).trim();
      const migliorare = (migliorareMatch?.[1] ?? '').trim();
      setPuntiForzaUtenza(forza);
      setDoveMigliorareUtenza(migliorare);
      return { forza, migliorare };
    } catch (err) {
      setErrorPuntiUtenza('Impossibile generare la proposta. Riprova.');
      return { forza: '', migliorare: '' };
    } finally {
      setLoadingPuntiUtenza(false);
    }
  }

  async function generaAzioniImpegnoUtenzaAI() {
    if (!selected) return { azioni: '', impegno: '' };
    setLoadingAzioniImpegno(true);
    setErrorAzioniImpegno(null);
    try {
      const dataPayload = Object.entries(selected.avg_scores ?? {})
        .filter(([k, v]) => k !== 'nps_consiglio' && v != null)
        .map(([k, v]) => `${LABEL_MAP[k] ?? k}: ${v}/100`)
        .join('\n');
      const prompt = buildPrompt('campagnaAzioniImpegnoUtenza', {
        facilityName: facility.name,
        campagnaNome: selected.campagna_nome,
        dataPayload,
        audience: selected.survey_type === 'operator' ? 'operatori' : 'ospiti',
      });
      const text = await callClaude(prompt, { maxTokens: 500 });
      const azioniMatch = text.match(/LE NOSTRE AZIONI PER IL PROSSIMO ANNO\s*([\s\S]*?)IL NOSTRO IMPEGNO/i);
      const impegnoMatch = text.match(/IL NOSTRO IMPEGNO\s*([\s\S]*)/i);
      const azioni = (azioniMatch?.[1] ?? text).trim();
      const impegno = (impegnoMatch?.[1] ?? '').trim();
      setAzioniUtenza(azioni);
      setImpegnoUtenza(impegno);
      return { azioni, impegno };
    } catch (err) {
      setErrorAzioniImpegno('Impossibile generare la proposta. Riprova.');
      return { azioni: '', impegno: '' };
    } finally {
      setLoadingAzioniImpegno(false);
    }
  }

  async function generaObiettiviDirezioneAI() {
    if (!selected) return '';
    setLoadingObiettivi(true);
    setErrorObiettivi(null);
    try {
      const dataPayload = Object.entries(selected.avg_scores ?? {})
        .filter(([k, v]) => k !== 'nps_consiglio' && v != null)
        .map(([k, v]) => `${LABEL_MAP[k] ?? k}: ${v}/100`)
        .join('\n');
      const prompt = buildPrompt('campagnaObiettiviDirezione', {
        facilityName: facility.name,
        campagnaNome: selected.campagna_nome,
        dataPayload,
      });
      const text = await callClaude(prompt, { maxTokens: 400 });
      setObiettiviDirezione(text);
      return text;
    } catch (err) {
      setErrorObiettivi('Impossibile generare la proposta. Riprova.');
      return '';
    } finally {
      setLoadingObiettivi(false);
    }
  }

  async function generaTemiCommentiAI() {
    if (!selected || !commenti?.length) return '';
    setLoadingTemi(true);
    setErrorTemi(null);
    try {
      const commentiFormattati = commenti.map((r, i) => `[${i + 1}] ${r.note?.trim() ?? ''}`).join('\n');
      const prompt = buildPrompt('campagnaTemiCommenti', {
        facilityName: facility.name,
        commentiFormattati,
        nCommenti: commenti.length,
        nQuestionari: selected.n_risposte,
      });
      const text = await callClaude(prompt, { maxTokens: 1200 });
      setTemiCommenti(text);
      return text;
    } catch (err) {
      setErrorTemi('Impossibile generare i temi. Riprova.');
      return '';
    } finally {
      setLoadingTemi(false);
    }
  }

  // Quali dei tre testi AI mancano ancora — "temi" non è richiesto se non
  // ci sono commenti nel periodo (niente da riassumere).
  function testiAiMancanti() {
    const mancanti = [];
    if (!sintesiPeriodo.trim()) mancanti.push('sintesi');
    if (!puntiForza.trim() || !puntiDebolezza.trim()) mancanti.push('punti');
    if (!puntiForzaUtenza.trim() || !doveMigliorareUtenza.trim()) mancanti.push('puntiUtenza');
    if (!azioniUtenza.trim() || !impegnoUtenza.trim()) mancanti.push('azioniImpegno');
    if (!obiettiviDirezione.trim()) mancanti.push('obiettivi');
    if (commenti?.length > 0 && !temiCommenti.trim()) mancanti.push('temi');
    return mancanti;
  }

  // Corpo effettivo dell'export — invariato rispetto a prima, tranne che
  // legge i quattro testi AI da `overrides` se presenti (usato dal percorso
  // "Genera con AI ora" del gate sotto, che ha appena generato testo fresco
  // e non può aspettare un re-render per vederlo nello stato).
  async function eseguiExportDocumenti(overrides = {}) {
    const sintesi = overrides.sintesiPeriodo ?? sintesiPeriodo;
    const forza = overrides.puntiForza ?? puntiForza;
    const debolezza = overrides.puntiDebolezza ?? puntiDebolezza;
    const temi = overrides.temiCommenti ?? temiCommenti;
    const forzaUtenza = overrides.puntiForzaUtenza ?? puntiForzaUtenza;
    const migliorareUtenza = overrides.doveMigliorareUtenza ?? doveMigliorareUtenza;
    const azioniUt = overrides.azioniUtenza ?? azioniUtenza;
    const impegnoUt = overrides.impegnoUtenza ?? impegnoUtenza;
    const obiettivi = overrides.obiettiviDirezione ?? obiettiviDirezione;
    const nCommenti = commenti?.length ?? 0;

    // Genera radar come immagine per il documento Word
    const radarBase64 = await generaRadarBase64(selected.avg_scores, selected.udo_avg_scores, selected.survey_type);

    // Un grafico per ogni domanda della campagna: torta di norma, widget
    // numero+stelle (costruito nativo in surveyCampagnaDocService.js, non
    // un'immagine) per le domande con Esito CRITICO.
    const distribuzioni = buildDistribuzione(selected.responses_json)
      .filter(d => d.key !== 'nps_consiglio');
    const perQuestionCharts = (await Promise.all(distribuzioni.map(async d => {
      const isCritico = semaforo(selected.avg_scores?.[d.key]).label === 'CRITICO';
      if (isCritico) return { key: d.key, isCritico: true, answers: d.answers };
      const img = await generaTortaDomandaBase64(d.answers);
      return img ? { key: d.key, isCritico: false, ...img } : null;
    }))).filter(Boolean);

    // Attività — confronto partecipazione: solo se la campagna include dati
    // survey_seniorliving nel periodo, altrimenti sezione omessa.
    const attivitaRows = await fetchAttivitaCampagna(selected, facility);
    const attivita = attivitaRows.length
      ? await generaAttivitaBase64(ATTIVITA_LABELS, attivitaRows)
      : null;

    const params = {
      facility, supabase,
      facilityName: facility.name,
      campagnaNome: selected.campagna_nome,
      dataInizio: selected.data_inizio,
      dataFine: selected.data_fine,
      nRisposte: selected.n_risposte,
      surveyType: selected.survey_type,
      avgScores: selected.avg_scores,
      minScores: selected.min_scores,
      maxScores: selected.max_scores,
      udoAvgScores: selected.udo_avg_scores,
      redemptionRate,
      radarBase64,
      perQuestionCharts,
      attivita,
      sintesiPeriodo: sintesi,
      puntiForza: forza,
      puntiDebolezza: debolezza,
      obiettiviDirezione: obiettivi,
      temiCommenti: temi,
      nCommenti,
      puntiForzaUtenza: forzaUtenza,
      doveMigliorareUtenza: migliorareUtenza,
      azioniUtenza: azioniUt,
      impegnoUtenza: impegnoUt,
    };

    await generaReportSurveyCampagna({ ...params, target: 'direzione' });
    await generaReportSurveyCampagna({ ...params, target: 'utenza' });

    const sourceTable = await resolveSourceTableCampagna(selected, facility);
    const calendarId = await fetchCalendarIdCampagna(selected, facility, sourceTable);

    // Storicizza in survey_ai_reports — contenuto reale (rivisto dal
    // direttore), non più solo il marker "Generato il..." di prima.
    // ai_report_ospiti/ai_report_direzione concatenano TUTTE le sezioni
    // narrative del rispettivo .docx (non solo sintesi/temi): stesso formato
    // "testo pieno" con cui AnalyticsModal.jsx valorizza queste colonne per i
    // report mensili (mai un marker lì) — così chi legge questi campi altrove
    // (badge di stato, solleciti, riapertura in AnalyticsModal) trova il
    // report completo, non solo una sua parte. Se una sezione non è ancora
    // stata generata resta fuori dalla concatenazione senza inventare nulla;
    // se nessuna sezione è pronta il campo resta null, come farebbe
    // AnalyticsModal in assenza di un report da salvare.
    const direzioneNarrativa = [
      forza && `PUNTI DI FORZA:\n${forza}`,
      debolezza && `PUNTI DI DEBOLEZZA:\n${debolezza}`,
      obiettivi && `OBIETTIVI E AZIONI PER IL PROSSIMO SEMESTRE:\n${obiettivi}`,
      temi && `TEMI EMERSI DAI COMMENTI:\n${temi}`,
    ].filter(Boolean).join('\n\n');
    const utenzaNarrativa = [
      sintesi,
      forzaUtenza && `I NOSTRI PUNTI DI FORZA:\n${forzaUtenza}`,
      migliorareUtenza && `DOVE VOGLIAMO MIGLIORARE:\n${migliorareUtenza}`,
      azioniUt && `LE NOSTRE AZIONI PER IL PROSSIMO ANNO:\n${azioniUt}`,
      impegnoUt && `IL NOSTRO IMPEGNO:\n${impegnoUt}`,
    ].filter(Boolean).join('\n\n');

    await supabase.from('survey_ai_reports').upsert({
      facility_id: facility.id,
      calendar_id: calendarId,
      source_table: sourceTable,
      campagna_id: selected.campagna_id,
      ai_report_ospiti: utenzaNarrativa || null,
      ai_report_direzione: direzioneNarrativa || null,
      sintesi_periodo_utenza: sintesi || null,
      punti_forza_direzione: forza || null,
      punti_debolezza_direzione: debolezza || null,
      obiettivi_direzione: obiettivi || null,
      temi_commenti_direzione: temi || null,
      punti_forza_utenza: forzaUtenza || null,
      dove_migliorare_utenza: migliorareUtenza || null,
      azioni_utenza: azioniUt || null,
      impegno_utenza: impegnoUt || null,
    }, { onConflict: 'facility_id,campagna_id,source_table' });
  }

  // Bottone "Genera documenti Word": se uno o più testi AI non sono ancora
  // stati generati/rivisti, non esporta silenziosamente vuoto né blocca
  // senza scelta — apre un avviso con due opzioni esplicite (vedi modal
  // sotto: generaTestiMancantiEProsegui / chiudiGateAiSenzaGenerare).
  async function generaDocumenti() {
    if (!selected) return;
    const mancanti = testiAiMancanti();
    if (mancanti.length) {
      setPendingMissingAi(mancanti);
      setShowAiGateModal(true);
      return;
    }
    setDocGenerating(true);
    try {
      await eseguiExportDocumenti();
    } finally {
      setDocGenerating(false);
    }
  }

  async function generaTestiMancantiEProsegui() {
    setShowAiGateModal(false);
    setDocGenerating(true);
    try {
      const overrides = {};
      if (pendingMissingAi.includes('sintesi')) {
        overrides.sintesiPeriodo = await generaSintesiPeriodoAI();
      }
      if (pendingMissingAi.includes('punti')) {
        const { forza, debolezza } = await generaPuntiDirezionaliAI();
        overrides.puntiForza = forza;
        overrides.puntiDebolezza = debolezza;
      }
      if (pendingMissingAi.includes('puntiUtenza')) {
        const { forza, migliorare } = await generaPuntiUtenzaAI();
        overrides.puntiForzaUtenza = forza;
        overrides.doveMigliorareUtenza = migliorare;
      }
      if (pendingMissingAi.includes('azioniImpegno')) {
        const { azioni, impegno } = await generaAzioniImpegnoUtenzaAI();
        overrides.azioniUtenza = azioni;
        overrides.impegnoUtenza = impegno;
      }
      if (pendingMissingAi.includes('obiettivi')) {
        overrides.obiettiviDirezione = await generaObiettiviDirezioneAI();
      }
      if (pendingMissingAi.includes('temi')) {
        overrides.temiCommenti = await generaTemiCommentiAI();
      }
      await eseguiExportDocumenti(overrides);
    } finally {
      setDocGenerating(false);
    }
  }

  function chiudiGateAiSenzaGenerare() {
    setShowAiGateModal(false);
  }

  if (isLoading) return <div className="py-12 text-center text-slate-400 text-sm">Caricamento campagne...</div>;

  if (campagne.length === 0) return (
    <div className="py-12 text-center">
      <p className="text-slate-400 text-sm font-medium">Nessuna campagna disponibile per questa struttura</p>
      <p className="text-slate-300 text-xs mt-1">Le campagne si creano da Impostazioni → Campagne Survey</p>
    </div>
  );

  const ETICHETTE_MANCANTI = {
    sintesi: 'Sintesi del periodo (Utenza)',
    punti: 'Valutazione direzionale — Punti di forza/debolezza (Direzione)',
    puntiUtenza: 'Punti di forza / Dove vogliamo migliorare (Utenza)',
    azioniImpegno: 'Le nostre azioni / Il nostro impegno (Utenza)',
    obiettivi: 'Obiettivi e azioni per il prossimo semestre (Direzione)',
    temi: 'Temi emersi dai commenti (Direzione)',
  };

  return (
    <>
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={selected?.campagna_id ?? ''}
          onChange={e => setSelectedId(e.target.value)}
          className="text-sm font-medium border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-700 outline-none focus:border-indigo-400"
        >
          {campagneFiltrate.map(c => (
            <option key={c.campagna_id} value={c.campagna_id}>
              {c.campagna_nome} · {c.n_risposte} risposte{c.is_company_wide ? ' 🏢' : ''}
            </option>
          ))}
        </select>

        {selected && (
          <>
            {/* "Report Direzione" apriva il vecchio flusso AnalyticsModal,
                superato dai documenti Word generati qui sotto — nascosto,
                non eliminato, per poterlo riattivare senza riscriverlo. */}
            {/*
            <button
              onClick={() => onDataClick?.(selected.survey_type, restituzionePeriod)}
              className="flex items-center gap-2 text-xs font-bold bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 transition-colors"
            >
              📊 Report Direzione
            </button>
            */}
            <button
              onClick={() => onRestituzioneClick?.(selected.survey_type, restituzionePeriod)}
              className="flex items-center gap-2 text-xs font-bold bg-indigo-50 border border-indigo-200 text-indigo-600 px-4 py-2 rounded-xl hover:bg-indigo-100 transition-colors"
            >
              👥 Restituzione
            </button>
            <button
              onClick={generaDocumenti}
              disabled={docGenerating}
              className="flex items-center gap-2 text-xs font-bold bg-emerald-600 text-white px-4 py-2 rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {docGenerating ? 'Generazione...' : '📄 Genera documenti Word'}
            </button>
          </>
        )}

        {selected && (
          <span className="text-xs text-slate-400">
            {selected.data_inizio} → {selected.data_fine}
          </span>
        )}

        {score != null && (
          <span className="ml-auto text-sm font-black" style={{color: semaforoColor(score)}}>
            Score {score}/100
          </span>
        )}
      </div>

      {!selected ? (
        <p className="text-slate-400 text-sm text-center py-8">Nessuna campagna per questo tipo</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-5">
            <NpsGauge nps={selected.avg_scores?.nps_consiglio} />
            <RadarCategorie
              avgScores={selected.avg_scores}
              udoAvgScores={selected.udo_avg_scores}
              surveyType={surveyType}
            />
          </div>
          <BarreMinMax
            avgScores={selected.avg_scores}
            minScores={selected.min_scores}
            maxScores={selected.max_scores}
            udoAvgScores={selected.udo_avg_scores}
          />

          <DistribuzioneRisposte responsesJson={selected.responses_json} excludeKeys={['nps_consiglio']} />

          {showCommenti && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Commenti liberi — {commenti.length} risposte con testo
                </p>
                <button
                  onClick={generaSunto}
                  disabled={loadingAI || commenti.length === 0}
                  className="flex items-center gap-2 text-xs font-bold bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {loadingAI ? (
                    <><span className="animate-spin">⏳</span> Analisi in corso...</>
                  ) : (
                    <>✨ Analizza commenti con AI</>
                  )}
                </button>
              </div>

              {/* Lista commenti */}
              <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                {commenti.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Nessun commento testuale in questa campagna</p>
                ) : (
                  commenti.map((r, i) => (
                    <div key={i} className="bg-slate-50 rounded-xl p-3 text-xs text-slate-600">
                      {r.struttura && (
                        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">{r.struttura}</p>
                      )}
                      {r.formazione_12mesi?.trim() && (
                        <p><span className="font-medium text-slate-500">Formazione:</span> {r.formazione_12mesi}</p>
                      )}
                      {r.note?.trim() && (
                        <p className="mt-1"><span className="font-medium text-slate-500">Note:</span> {r.note}</p>
                      )}
                    </div>
                  ))
                )}
              </div>

              {aiError && <p className="text-xs text-red-500 mb-2">{aiError}</p>}

              {/* Sunto AI */}
              {suntoCommenti && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                  <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-2">✨ Analisi AI</p>
                  {suntoCommenti}
                </div>
              )}
            </div>
          )}

          {/* Contenuti AI per i documenti Word: bozze da rivedere/editare qui
              prima dell'export. generaDocumenti() usa quello che è scritto al
              momento del click; se una sezione è ancora vuota, il gate sotto
              la genera automaticamente con l'AI (comunque rivedibile prima
              che il documento parta) invece di esportarla vuota. */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Contenuti AI per i documenti Word — da rivedere prima di generare
            </p>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-600">Sintesi del periodo (doc. Utenza)</span>
                <button
                  onClick={generaSintesiPeriodoAI}
                  disabled={loadingSintesi}
                  className="text-[11px] px-3 py-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {loadingSintesi ? '⏳ Generazione…' : sintesiPeriodo ? '🔄 Rigenera' : '✨ Genera con AI'}
                </button>
              </div>
              {errorSintesi && <p className="text-xs text-red-500 mb-1">{errorSintesi}</p>}
              <textarea
                value={sintesiPeriodo}
                onChange={e => setSintesiPeriodo(e.target.value)}
                placeholder="Genera con AI, oppure scrivi a mano come è andato il periodo..."
                rows={3}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-600">Valutazione direzionale (doc. Direzione)</span>
                <button
                  onClick={generaPuntiDirezionaliAI}
                  disabled={loadingPunti}
                  className="text-[11px] px-3 py-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {loadingPunti ? '⏳ Generazione…' : (puntiForza || puntiDebolezza) ? '🔄 Rigenera' : '✨ Genera proposta'}
                </button>
              </div>
              {errorPunti && <p className="text-xs text-red-500 mb-1">{errorPunti}</p>}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-medium text-emerald-600 uppercase tracking-wide mb-1">Punti di forza</p>
                  <textarea
                    value={puntiForza}
                    onChange={e => setPuntiForza(e.target.value)}
                    rows={4}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y"
                  />
                </div>
                <div>
                  <p className="text-[10px] font-medium text-red-600 uppercase tracking-wide mb-1">Punti di debolezza</p>
                  <textarea
                    value={puntiDebolezza}
                    onChange={e => setPuntiDebolezza(e.target.value)}
                    rows={4}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y"
                  />
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-600">Obiettivi e azioni per il prossimo semestre (doc. Direzione)</span>
                <button
                  onClick={generaObiettiviDirezioneAI}
                  disabled={loadingObiettivi}
                  className="text-[11px] px-3 py-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {loadingObiettivi ? '⏳ Generazione…' : obiettiviDirezione ? '🔄 Rigenera' : '✨ Genera proposta'}
                </button>
              </div>
              {errorObiettivi && <p className="text-xs text-red-500 mb-1">{errorObiettivi}</p>}
              <textarea
                value={obiettiviDirezione}
                onChange={e => setObiettiviDirezione(e.target.value)}
                rows={4}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-600">Punti di forza / Dove vogliamo migliorare (doc. Utenza)</span>
                <button
                  onClick={generaPuntiUtenzaAI}
                  disabled={loadingPuntiUtenza}
                  className="text-[11px] px-3 py-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {loadingPuntiUtenza ? '⏳ Generazione…' : (puntiForzaUtenza || doveMigliorareUtenza) ? '🔄 Rigenera' : '✨ Genera proposta'}
                </button>
              </div>
              {errorPuntiUtenza && <p className="text-xs text-red-500 mb-1">{errorPuntiUtenza}</p>}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-medium text-emerald-600 uppercase tracking-wide mb-1">I nostri punti di forza</p>
                  <textarea
                    value={puntiForzaUtenza}
                    onChange={e => setPuntiForzaUtenza(e.target.value)}
                    rows={4}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y"
                  />
                </div>
                <div>
                  <p className="text-[10px] font-medium text-amber-600 uppercase tracking-wide mb-1">Dove vogliamo migliorare</p>
                  <textarea
                    value={doveMigliorareUtenza}
                    onChange={e => setDoveMigliorareUtenza(e.target.value)}
                    rows={4}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y"
                  />
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-600">Le nostre azioni / Il nostro impegno (doc. Utenza)</span>
                <button
                  onClick={generaAzioniImpegnoUtenzaAI}
                  disabled={loadingAzioniImpegno}
                  className="text-[11px] px-3 py-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {loadingAzioniImpegno ? '⏳ Generazione…' : (azioniUtenza || impegnoUtenza) ? '🔄 Rigenera' : '✨ Genera proposta'}
                </button>
              </div>
              {errorAzioniImpegno && <p className="text-xs text-red-500 mb-1">{errorAzioniImpegno}</p>}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-medium text-blue-600 uppercase tracking-wide mb-1">Le nostre azioni per il prossimo anno</p>
                  <textarea
                    value={azioniUtenza}
                    onChange={e => setAzioniUtenza(e.target.value)}
                    rows={4}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y"
                  />
                </div>
                <div>
                  <p className="text-[10px] font-medium text-indigo-600 uppercase tracking-wide mb-1">Il nostro impegno</p>
                  <textarea
                    value={impegnoUtenza}
                    onChange={e => setImpegnoUtenza(e.target.value)}
                    rows={4}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y"
                  />
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-600">Temi emersi dai commenti (doc. Direzione)</span>
                <button
                  onClick={generaTemiCommentiAI}
                  disabled={loadingTemi || !commenti?.length}
                  className="text-[11px] px-3 py-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {loadingTemi ? '⏳ Generazione…' : temiCommenti ? '🔄 Rigenera' : '✨ Genera proposta'}
                </button>
              </div>
              {errorTemi && <p className="text-xs text-red-500 mb-1">{errorTemi}</p>}
              <textarea
                value={temiCommenti}
                onChange={e => setTemiCommenti(e.target.value)}
                placeholder="Genera con AI a partire dai commenti liberi raccolti nel periodo..."
                rows={8}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y"
              />
            </div>
          </div>
        </>
      )}
    </div>

    {showAiGateModal && (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
          <h3 className="text-sm font-bold text-slate-800 mb-2">Testi AI non ancora generati</h3>
          <p className="text-xs text-slate-500 mb-3">
            Questi contenuti sono ancora vuoti e verrebbero esportati come righe da compilare a mano:
          </p>
          <ul className="text-xs text-slate-700 list-disc list-inside mb-4 space-y-0.5">
            {pendingMissingAi.map(m => <li key={m}>{ETICHETTE_MANCANTI[m]}</li>)}
          </ul>
          <p className="text-xs text-slate-500 mb-5">
            Vuoi generarli ora con l'AI (potrai comunque rivederli/modificarli prima che il documento parta), oppure preferisci compilarli tu a mano prima di rilanciare l'export?
          </p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={chiudiGateAiSenzaGenerare}
              className="text-xs font-bold text-slate-600 px-4 py-2 rounded-xl hover:bg-slate-100 transition-colors"
            >
              Li inserisco io
            </button>
            <button
              onClick={generaTestiMancantiEProsegui}
              className="text-xs font-bold bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 transition-colors"
            >
              ✨ Genera con AI ora
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
