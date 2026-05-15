// src/components/DocCopertinaModal.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  X, FileText, Download, Loader2, ChevronDown,
  AlertTriangle, Building2, Calendar, User, CheckCircle2, Tag,
} from 'lucide-react';
import { supabase }          from '../supabaseClient';
import { generaCopertina }   from '../services/copertinaService';
import { TIPOLOGIA_OPTIONS } from '../config/docTipologie';

// ── helpers ───────────────────────────────────────────────────

const today    = () => new Date().toISOString().split('T')[0];
const fmtMese  = (val) => {
  if (!val) return '';
  const [y, m] = val.split('-');
  return `${m}/${y}`;
};
const extractRevNum = (rev) => {
  const m = (rev || '').match(/\d+/);
  return m ? m[0] : '0';
};

const INIT_STORICO = [
  { rev: '', data: '', note: '' },
  { rev: '', data: '', note: '' },
  { rev: '', data: '', note: '' },
];

// ── componente ────────────────────────────────────────────────

export default function DocCopertinaModal({ documento, facility: initFacility, company: initCompany, onClose }) {
  // Struttura / Società
  const [facilities,       setFacilities]       = useState([]);
  const [selectedFacility, setSelectedFacility] = useState(initFacility ?? null);
  const [selectedCompany,  setSelectedCompany]  = useState(initCompany  ?? null);
  const [loadingFac,       setLoadingFac]       = useState(!initFacility);
  const [loadingCo,        setLoadingCo]        = useState(false);

  // Firma
  const [firmaBase64,  setFirmaBase64]  = useState(null);
  const [firmaLoading, setFirmaLoading] = useState(false);
  const [firmaWarning, setFirmaWarning] = useState('');

  // Generazione
  const [generating, setGenerating] = useState(false);
  const [genError,   setGenError]   = useState('');

  // Form
  const [form, setForm] = useState({
    tipologia:             documento?.tipologia_documento || '',
    revisione:             extractRevNum(documento?.revisione_corrente),
    dataRevisione:         '',
    noteRevisione:         '',
    elaborataDa:           documento?.elaborata_da || '',
    verificataDa:          documento?.verificata_da || '',
    approvataDa:           documento?.approvato_da || 'Aladar Kovacs',
    inclFirma:             false,
    dataValidazione:       today(),
    inclBloccoValidazione: true,
    storico:               INIT_STORICO,
  });

  const setField       = useCallback((k, v) => setForm(p => ({ ...p, [k]: v })), []);
  const setStoricoRow  = useCallback((i, k, v) => setForm(p => ({
    ...p,
    storico: p.storico.map((row, idx) => idx === i ? { ...row, [k]: v } : row),
  })), []);

  // Carica strutture (se non passata come prop)
  useEffect(() => {
    if (initFacility) { setLoadingFac(false); return; }
    supabase
      .from('facilities')
      .select('id, name, address, region, company_id, udos(name)')
      .order('name')
      .then(({ data }) => { setFacilities(data ?? []); setLoadingFac(false); });
  }, [initFacility]);

  // Carica società quando cambia la struttura
  useEffect(() => {
    if (!selectedFacility) return;
    if (initCompany?.id) {
      supabase.from('companies')
        .select('id, name, logo_url, logo_key')
        .eq('id', initCompany.id)
        .single()
        .then(({ data }) => { if (data) setSelectedCompany(data); });
      return;
    }
    if (!selectedFacility.company_id) return;
    setLoadingCo(true);
    supabase
      .from('companies')
      .select('id, name, logo_url, logo_key')
      .eq('id', selectedFacility.company_id)
      .single()
      .then(({ data }) => { if (data) setSelectedCompany(data); })
      .finally(() => setLoadingCo(false));
  }, [selectedFacility, initCompany]);

  // Toggle firma Aladar
  const handleFirmaToggle = useCallback(async (checked) => {
    setField('inclFirma', checked);
    setFirmaWarning('');
    if (checked && !firmaBase64) {
      setFirmaLoading(true);
      try {
        const { data, error } = await supabase.storage
          .from('signatures')
          .createSignedUrl('aladar_kovacs/firma.png', 60);
        if (error || !data?.signedUrl) throw new Error('not found');
        const res    = await fetch(data.signedUrl);
        const buffer = await res.arrayBuffer();
        const bytes  = new Uint8Array(buffer);
        let bin = '';
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        setFirmaBase64(btoa(bin));
      } catch {
        setFirmaWarning('Firma non disponibile in Storage');
        setField('inclFirma', false);
      } finally {
        setFirmaLoading(false);
      }
    }
  }, [firmaBase64, setField]);

  const isValidazioneRegion = ['Lombardia', 'Liguria'].includes(selectedFacility?.region);

  // Genera e scarica
  const handleGenera = async () => {
    setGenerating(true);
    setGenError('');
    try {
      const blob = await generaCopertina({
        codice:             documento?.codice_documento || '',
        titolo:             documento?.titolo            || '',
        categoria:          documento?.categoria         || '',
        tipologia:          form.tipologia,
        revisione:          form.revisione,
        dataRevisione:      fmtMese(form.dataRevisione),
        noteRevisione:      form.noteRevisione,
        elaborataDa:        form.elaborataDa,
        verificataDa:       form.verificataDa,
        approvataDa:        form.approvataDa,
        firmaBase64:        form.inclFirma ? firmaBase64 : null,
        societaNome:        selectedCompany?.name         || '',
        udoNome:            selectedFacility?.udos?.name  || '',
        strutturaNome:      selectedFacility?.name        || '',
        indirizzoStruttura: selectedFacility?.address     || '',
        dataValidazione:    form.dataValidazione
          ? new Date(form.dataValidazione).toLocaleDateString('it-IT') : '',
        regioneLombardia:   form.inclBloccoValidazione && isValidazioneRegion,
        storico:            form.storico,
        logoSocietaUrl:     selectedCompany?.logo_url      || null,
      });

      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = `${documento?.codice_documento || 'COPERTINA'}_Rev${form.revisione}_COPERTINA.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setGenError('Errore: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  // ── render ────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="bg-emerald-900 px-7 py-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-600 rounded-xl text-white">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="text-base font-black text-white uppercase tracking-wider">
                Genera Copertina .docx
              </h2>
              <p className="text-[10px] text-emerald-300 font-bold uppercase tracking-widest mt-0.5">
                {documento?.codice_documento} — {documento?.titolo}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-emerald-200 hover:text-white hover:bg-emerald-700 rounded-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body — 2 colonne */}
        <div className="flex flex-1 overflow-hidden min-h-0">

          {/* ── Colonna sx: Form (60%) ── */}
          <div className="w-3/5 overflow-y-auto p-6 space-y-6 border-r border-slate-100">

            {/* Picker struttura (solo se non passata come prop) */}
            {!initFacility && (
              <div>
                <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Building2 size={12} /> Struttura *
                </label>
                {loadingFac ? (
                  <div className="flex items-center gap-2 text-sm text-slate-400 font-medium">
                    <Loader2 size={14} className="animate-spin" /> Caricamento strutture…
                  </div>
                ) : (
                  <div className="relative">
                    <select
                      value={selectedFacility?.id ?? ''}
                      onChange={e => {
                        const f = facilities.find(x => String(x.id) === e.target.value);
                        setSelectedFacility(f ?? null);
                        setSelectedCompany(null);
                      }}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium appearance-none outline-none focus:ring-2 focus:ring-emerald-400"
                    >
                      <option value="">— Seleziona struttura —</option>
                      {facilities.map(f => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-4 top-3.5 text-slate-400 pointer-events-none" />
                  </div>
                )}
              </div>
            )}

            {/* ── Sezione Documento ── */}
            <section>
              <p className="text-[11px] font-black text-emerald-700 uppercase tracking-widest mb-3 pb-1 border-b border-emerald-100">
                Documento
              </p>
              <div className="space-y-4">

                {/* Categoria readonly */}
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1">Categoria</label>
                  <div className="px-4 py-2.5 rounded-xl bg-slate-100 text-sm font-bold text-slate-600">
                    {documento?.categoria || '—'}
                  </div>
                </div>

                {/* Tipologia select */}
                <div>
                  <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Tag size={12} /> Tipologia
                  </label>
                  <div className="relative">
                    <select
                      value={form.tipologia}
                      onChange={e => setField('tipologia', e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium appearance-none outline-none focus:ring-2 focus:ring-emerald-400"
                    >
                      <option value="">— Seleziona tipologia —</option>
                      {TIPOLOGIA_OPTIONS.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-4 top-3.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                {/* Codice readonly | Revisione */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1">Codice</label>
                    <div className="px-4 py-2.5 rounded-xl bg-slate-100 text-sm font-bold text-slate-600">
                      {documento?.codice_documento || '—'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-1.5">Revisione n°</label>
                    <input
                      type="number" min="0"
                      value={form.revisione}
                      onChange={e => setField('revisione', e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-400"
                    />
                  </div>
                </div>

                {/* Titolo readonly */}
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1">Titolo</label>
                  <div className="px-4 py-2.5 rounded-xl bg-slate-100 text-sm font-medium text-slate-600 leading-snug">
                    {documento?.titolo || '—'}
                  </div>
                </div>

                {/* Data revisione (MM/YYYY) */}
                <div>
                  <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Calendar size={12} /> Data revisione * <span className="font-medium text-slate-400 normal-case">(MM/YYYY)</span>
                  </label>
                  <input
                    type="month"
                    value={form.dataRevisione}
                    onChange={e => setField('dataRevisione', e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>

                {/* Note revisione */}
                <div>
                  <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-1.5">Note revisione *</label>
                  <textarea
                    rows={2}
                    value={form.noteRevisione}
                    onChange={e => setField('noteRevisione', e.target.value)}
                    placeholder="Modifiche apportate rispetto alla revisione precedente..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
                  />
                </div>
              </div>
            </section>

            {/* ── Sezione Responsabilità ── */}
            <section>
              <p className="text-[11px] font-black text-emerald-700 uppercase tracking-widest mb-3 pb-1 border-b border-emerald-100">
                Responsabilità
              </p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-1.5">Elaborata da *</label>
                  <input
                    type="text" value={form.elaborataDa}
                    onChange={e => setField('elaborataDa', e.target.value)}
                    placeholder="es. Ufficio Qualità Gruppo OVER"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-1.5">Verificata da *</label>
                  <input
                    type="text" value={form.verificataDa}
                    onChange={e => setField('verificataDa', e.target.value)}
                    placeholder="Nome e cognome o ruolo"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <User size={12} /> Approvata da
                  </label>
                  <input
                    type="text" value={form.approvataDa}
                    onChange={e => setField('approvataDa', e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>

                {/* Toggle firma */}
                <div className="flex items-center gap-3 pt-1">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={form.inclFirma}
                      onChange={e => handleFirmaToggle(e.target.checked)}
                      disabled={firmaLoading}
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:ring-2 peer-focus:ring-emerald-400 rounded-full peer
                      peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute
                      after:top-0.5 after:left-0.5 after:bg-white after:border-slate-300 after:border after:rounded-full
                      after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600" />
                  </label>
                  <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                    {firmaLoading
                      ? <><Loader2 size={12} className="animate-spin" /> Caricamento firma…</>
                      : 'Includi firma Aladar Kovacs'}
                  </span>
                </div>
                {firmaWarning && (
                  <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 px-3 py-2 rounded-xl text-xs font-bold">
                    <AlertTriangle size={13} /> {firmaWarning}
                  </div>
                )}
                {form.inclFirma && firmaBase64 && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-bold">
                    <CheckCircle2 size={12} /> Firma caricata correttamente
                  </div>
                )}
              </div>
            </section>

            {/* ── Sezione Applicabilità ── */}
            <section>
              <p className="text-[11px] font-black text-emerald-700 uppercase tracking-widest mb-3 pb-1 border-b border-emerald-100">
                Applicabilità
              </p>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1">Società</label>
                    <div className="px-4 py-2.5 rounded-xl bg-slate-100 text-sm font-medium text-slate-600 min-h-[42px] flex items-center">
                      {loadingCo
                        ? <Loader2 size={13} className="animate-spin text-slate-400" />
                        : (selectedCompany?.name || '—')}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1">UDO</label>
                    <div className="px-4 py-2.5 rounded-xl bg-slate-100 text-sm font-medium text-slate-600">
                      {selectedFacility?.udos?.name || '—'}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1">Struttura</label>
                  <div className="px-4 py-2.5 rounded-xl bg-slate-100 text-sm font-medium text-slate-600">
                    {selectedFacility?.name || '—'}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1">Indirizzo</label>
                  <div className="px-4 py-2.5 rounded-xl bg-slate-100 text-sm font-medium text-slate-600">
                    {selectedFacility?.address || '—'}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Calendar size={12} /> Data validazione struttura
                  </label>
                  <input
                    type="date"
                    value={form.dataValidazione}
                    onChange={e => setField('dataValidazione', e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>

                {/* Blocco validazione regionale */}
                {isValidazioneRegion && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                    <div className="flex items-center gap-3">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={form.inclBloccoValidazione}
                          onChange={e => setField('inclBloccoValidazione', e.target.checked)}
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:ring-2 peer-focus:ring-emerald-400 rounded-full peer
                          peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute
                          after:top-0.5 after:left-0.5 after:bg-white after:border-slate-300 after:border after:rounded-full
                          after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600" />
                      </label>
                      <span className="text-xs font-bold text-emerald-700">
                        Includi blocco validazione ({selectedFacility.region})
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-600 mt-1.5 ml-12">
                      Aggiunge il riquadro obbligatorio di validazione regionale
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* ── Sezione Storico ── */}
            <section>
              <p className="text-[11px] font-black text-emerald-700 uppercase tracking-widest mb-3 pb-1 border-b border-emerald-100">
                Storico Revisioni (max 3 righe)
              </p>
              <div className="space-y-2">
                <div className="grid grid-cols-[80px_110px_1fr] gap-2">
                  {['Rev.', 'MM/YYYY', 'Note'].map(h => (
                    <span key={h} className="text-[10px] font-black text-slate-400 uppercase tracking-wide">{h}</span>
                  ))}
                </div>
                {form.storico.map((entry, i) => (
                  <div key={i} className="grid grid-cols-[80px_110px_1fr] gap-2">
                    <input
                      type="text" value={entry.rev}
                      onChange={e => setStoricoRow(i, 'rev', e.target.value)}
                      placeholder={`Rev.${i}`}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none focus:ring-1 focus:ring-emerald-400"
                    />
                    <input
                      type="text" value={entry.data}
                      onChange={e => setStoricoRow(i, 'data', e.target.value)}
                      placeholder="01/2024"
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium outline-none focus:ring-1 focus:ring-emerald-400"
                    />
                    <input
                      type="text" value={entry.note}
                      onChange={e => setStoricoRow(i, 'note', e.target.value)}
                      placeholder="Note modifiche"
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium outline-none focus:ring-1 focus:ring-emerald-400"
                    />
                  </div>
                ))}
              </div>
            </section>

          </div>

          {/* ── Colonna dx: Riepilogo (40%) ── */}
          <div className="w-2/5 overflow-y-auto p-6 bg-slate-50 space-y-4">
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Riepilogo copertina</p>

            <div className="space-y-2.5">
              {[
                ['Codice',          documento?.codice_documento],
                ['Revisione',       `Rev. ${form.revisione}`],
                ['Data revisione',  fmtMese(form.dataRevisione)],
                ['Categoria',       documento?.categoria],
                ['Tipologia',       form.tipologia],
                ['Titolo',          documento?.titolo],
                ['Elaborata da',    form.elaborataDa],
                ['Verificata da',   form.verificataDa],
                ['Approvata da',    form.inclFirma ? '✎ Firma immagine' : form.approvataDa],
                ['Società',         selectedCompany?.name || '—'],
                ['UDO',             selectedFacility?.udos?.name || '—'],
                ['Struttura',       selectedFacility?.name || '—'],
                ['Indirizzo',       selectedFacility?.address || '—'],
                ['Data validazione', form.dataValidazione
                  ? new Date(form.dataValidazione).toLocaleDateString('it-IT') : '—'],
                ['Blocco validazione', form.inclBloccoValidazione && isValidazioneRegion
                  ? `✔ ${selectedFacility?.region}` : '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex items-start gap-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wide w-32 shrink-0 pt-0.5">
                    {label}
                  </span>
                  <span className="text-xs font-medium text-slate-700 break-words flex-1">
                    {value || '—'}
                  </span>
                </div>
              ))}
            </div>

            {/* Storico preview */}
            {form.storico.some(s => s.rev || s.data || s.note) && (
              <div className="pt-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wide mb-2">Storico</p>
                {form.storico.filter(s => s.rev || s.data || s.note).map((s, i) => (
                  <div key={i} className="text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 mb-1.5 text-slate-600">
                    {s.rev && <span className="font-bold mr-2">{s.rev}</span>}
                    {s.data && <span className="text-slate-400 mr-2">{s.data}</span>}
                    {s.note && <span>{s.note}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-7 py-4 flex items-center justify-between shrink-0 bg-slate-50">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm font-black uppercase text-slate-500 hover:bg-slate-200 transition-colors"
          >
            Chiudi
          </button>
          <div className="flex items-center gap-3">
            {genError && (
              <span className="text-xs text-rose-600 font-bold max-w-xs">{genError}</span>
            )}
            <button
              onClick={handleGenera}
              disabled={generating || !selectedFacility}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black uppercase
                bg-emerald-600 text-white hover:bg-emerald-700 shadow transition-colors disabled:opacity-50"
            >
              {generating
                ? <><Loader2 size={15} className="animate-spin" /> Generazione…</>
                : <><Download size={15} /> Genera Copertina .docx</>
              }
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
