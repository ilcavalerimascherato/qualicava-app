// src/components/DocCopertinaModal.jsx
import React, { useState, useCallback, useEffect } from 'react';
import { X, FileText, Download, Loader2, Upload } from 'lucide-react';
import { supabase }        from '../supabaseClient';
import { generaCopertina } from '../services/copertinaService';

// ── helpers ───────────────────────────────────────────────────

const fmtMese = (val) => {
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

export default function DocCopertinaModal({
  documento,
  dataRevisione = '',
  noteRevisione = '',
  onClose,
  onSuccess,
}) {
  const [firme,             setFirme]             = useState([]);
  const [selectedFirmaId,   setSelectedFirmaId]   = useState('');
  const [firmaSignedUrl,    setFirmaSignedUrl]    = useState('');
  const [generating,        setGenerating]        = useState(false);
  const [genError,          setGenError]          = useState('');
  const [copertinaGenerata, setCopertinaGenerata] = useState(false);
  const [salvato,           setSalvato]           = useState(false);
  const [salvandoDoc,       setSalvandoDoc]       = useState(false);
  const [isDragging,        setIsDragging]        = useState(false);
  const [logoSocietaUrl,    setLogoSocietaUrl]    = useState(null);

  // Fetch logo società collegata al documento
  useEffect(() => {
    const societaId = documento?.societa_id;
    if (!societaId) return;

    supabase
      .from('societa')
      .select('logo_url')
      .eq('id', societaId)
      .single()
      .then(async ({ data }) => {
        if (!data?.logo_url) return;
        const { data: signed } = await supabase.storage
          .from('loghi-societa')
          .createSignedUrl(data.logo_url, 3600);
        setLogoSocietaUrl(signed?.signedUrl ?? null);
      });
  }, [documento]);

  const [form, setForm] = useState({
    dataRevisione,
    noteRevisione,
    storico: INIT_STORICO,
  });

  useEffect(() => {
    supabase
      .from('document_signatures')
      .select('*')
      .order('nome')
      .then(({ data }) => setFirme(data ?? []));
  }, []);

  const firmaSelezionata = firme.find(f => f.id === selectedFirmaId) ?? null;

  useEffect(() => {
    if (!firmaSelezionata?.firma_url) { setFirmaSignedUrl(''); return; }
    supabase.storage.from('signatures')
      .createSignedUrl(firmaSelezionata.firma_url, 3600)
      .then(({ data }) => setFirmaSignedUrl(data?.signedUrl ?? ''));
  }, [firmaSelezionata]);

  const setStoricoRow = useCallback((i, k, v) => setForm(p => ({
    ...p,
    storico: p.storico.map((row, idx) => idx === i ? { ...row, [k]: v } : row),
  })), []);

  // Genera e scarica copertina
  const handleGenera = async () => {
    setGenerating(true);
    setGenError('');
    try {
      const blob = await generaCopertina({
        codice:             documento?.codice_documento    || '',
        titolo:             documento?.titolo              || '',
        categoria:          documento?.categoria           || '',
        tipologia:          documento?.tipologia_documento || '',
        revisione:          extractRevNum(documento?.revisione_corrente),
        dataRevisione:      fmtMese(form.dataRevisione),
        noteRevisione:      form.noteRevisione,
        elaborataDa:        documento?.elaborata_da        || '',
        verificataDa:       documento?.verificata_da       || '',
        approvataDa:        documento?.approvato_da        || '',
        firmaBase64:        null,
        firmaUrl:           firmaSignedUrl || null,
        societaNome:        '',
        udoNome:            '',
        strutturaNome:      '',
        indirizzoStruttura: '',
        dataValidazione:    '',
        regioneLombardia:   false,
        storico:            form.storico,
        logoSocietaUrl:     logoSocietaUrl,
      });
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = `${documento?.codice_documento || 'COPERTINA'}_COPERTINA.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setCopertinaGenerata(true);
    } catch (err) {
      setGenError('Errore: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  // Upload documento assemblato su Storage
  const doUpload = useCallback(async (file) => {
    setSalvandoDoc(true);
    setSalvato(false);
    setGenError('');
    try {
      const codice      = documento?.codice_documento || 'DOC';
      const timestamp   = Date.now();
      const storagePath = `master/${codice}_${timestamp}.docx`;
      const uint8 = new Uint8Array(await file.arrayBuffer());
      const { error } = await supabase.storage
        .from('documenti-master')
        .upload(storagePath, uint8, {
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          upsert: true,
        });
      if (error) throw new Error(error.message);
      if (documento?.id) {
        await supabase
          .from('doc_master')
          .update({ file_url_master: storagePath })
          .eq('id', documento.id);
      }
      setSalvato(true);
      setTimeout(() => { onSuccess?.(); onClose(); }, 1000);
    } catch (err) {
      setGenError('Errore upload: ' + err.message);
    } finally {
      setSalvandoDoc(false);
    }
  }, [documento, onSuccess, onClose]);

  const handleDragOver  = useCallback((e) => { e.preventDefault(); setIsDragging(true);  }, []);
  const handleDragLeave = useCallback((e) => { e.preventDefault(); setIsDragging(false); }, []);
  const handleDrop      = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) doUpload(f);
  }, [doUpload]);

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

            {/* Firma approvazione */}
            <section>
              <p className="text-[11px] font-black text-emerald-700 uppercase tracking-widest mb-3 pb-1 border-b border-emerald-100">
                Firma approvazione
              </p>
              <select
                value={selectedFirmaId}
                onChange={e => setSelectedFirmaId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium
                  outline-none focus:ring-2 focus:ring-emerald-400"
              >
                <option value="">— Nessuna firma —</option>
                {firme.map(f => (
                  <option key={f.id} value={f.id}>{f.nome} — {f.ruolo}</option>
                ))}
              </select>

              {firmaSelezionata && (
                <div className="mt-2 p-3 border border-slate-200 rounded-xl bg-slate-50">
                  <img
                    src={firmaSignedUrl}
                    alt="firma"
                    className="h-12 object-contain"
                  />
                  <p className="text-xs text-slate-500 mt-1">{firmaSelezionata.ruolo}</p>
                </div>
              )}
            </section>

            {/* Storico Revisioni */}
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

            {/* Drag-drop upload documento assemblato — visibile dopo generazione */}
            {copertinaGenerata && (
              <section>
                <p className="text-[11px] font-black text-emerald-700 uppercase tracking-widest mb-3 pb-1 border-b border-emerald-100">
                  Salva documento assemblato
                </p>
                <div
                  onClick={e => e.currentTarget.querySelector('input[type="file"]')?.click()}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-2xl px-6 py-8 text-center cursor-pointer transition-all
                    ${salvandoDoc
                      ? 'opacity-50 pointer-events-none border-slate-300'
                      : isDragging
                        ? 'border-slate-600 bg-slate-100'
                        : 'border-slate-300 hover:border-slate-500 hover:bg-slate-50'
                    }`}
                >
                  {salvandoDoc ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 size={24} className="text-slate-400 animate-spin" />
                      <p className="text-sm font-bold text-slate-500">Caricamento in corso…</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload size={24} className="text-slate-400" />
                      <p className="text-sm font-bold text-slate-500">
                        Trascina il documento assemblato oppure clicca
                      </p>
                      <p className="text-xs text-slate-400">File .docx completo (copertina + contenuto)</p>
                    </div>
                  )}
                  <input
                    type="file"
                    accept=".docx"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) doUpload(f); }}
                  />
                </div>
              </section>
            )}

          </div>

          {/* ── Colonna dx: Riepilogo (40%) ── */}
          <div className="w-2/5 overflow-y-auto p-6 bg-slate-50 space-y-4">
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Riepilogo copertina</p>

            <div className="space-y-2.5">
              {[
                ['Codice',         documento?.codice_documento],
                ['Data revisione', fmtMese(form.dataRevisione)],
                ['Titolo',         documento?.titolo],
                ['Note revisione', form.noteRevisione],
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
                    {s.rev  && <span className="font-bold mr-2">{s.rev}</span>}
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
          <div className="flex flex-col items-end gap-2">
            {genError && (
              <span className="text-xs text-rose-600 font-bold max-w-xs">{genError}</span>
            )}
            {salvato && (
              <span className="text-xs text-emerald-600 font-bold">✓ Documento salvato</span>
            )}
            <button
              onClick={handleGenera}
              disabled={generating}
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
