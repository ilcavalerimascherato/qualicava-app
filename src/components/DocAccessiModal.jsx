// src/components/DocAccessiModal.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { X, Eye, Download, Filter, CheckCircle2, Clock, Users } from 'lucide-react';
import { getDistribuzioneStatus } from '../services/documentiService';

const FILTRI = [
  { id: 'tutti',     label: 'Tutte'      },
  { id: 'scaricato', label: 'Scaricato'  },
  { id: 'non_ancora',label: 'Non ancora' },
];

function StatCard({ label, value, sub, color = 'text-slate-800' }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 px-5 py-4 text-center">
      <p className={`text-3xl font-black ${color}`}>{value}</p>
      <p className="text-xs font-black text-slate-500 uppercase tracking-wide mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function AccessoBadge({ hasScaricato }) {
  return hasScaricato
    ? <span className="text-[11px] font-black px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-700 flex items-center gap-1 w-fit">
        <CheckCircle2 size={10} /> Scaricato
      </span>
    : <span className="text-[11px] font-black px-2 py-0.5 rounded-lg bg-slate-100 text-slate-500 flex items-center gap-1 w-fit">
        <Clock size={10} /> Non ancora
      </span>;
}

function exportCSV(rows, master) {
  const header = ['Struttura','Società','Primo accesso','Ultimo accesso','N° download','Stato'];
  const body   = rows.map(r => [
    r.facility_name,
    r.ragione_sociale,
    r.primo_accesso  ? new Date(r.primo_accesso ).toLocaleString('it-IT') : '',
    r.ultimo_accesso ? new Date(r.ultimo_accesso).toLocaleString('it-IT') : '',
    r.accesso_count ?? 0,
    r.primo_accesso ? 'Scaricato' : 'Non ancora',
  ]);
  const csv = [header, ...body].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `accessi_${master?.codice_documento ?? 'doc'}_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function DocAccessiModal({ master, onClose }) {
  const [rows,    setRows]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro,  setFiltro]  = useState('tutti');
  const [error,   setError]   = useState('');

  useEffect(() => {
    if (!master?.id) return;
    (async () => {
      try {
        const data = await getDistribuzioneStatus(master.id);
        setRows(data);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [master]);

  const filtered = useMemo(() => {
    if (filtro === 'scaricato')  return rows.filter(r => r.primo_accesso);
    if (filtro === 'non_ancora') return rows.filter(r => !r.primo_accesso);
    return rows;
  }, [rows, filtro]);

  const totale      = rows.length;
  const scaricato   = rows.filter(r => r.primo_accesso).length;
  const nonAncora   = totale - scaricato;
  const copertura   = totale > 0 ? Math.round((scaricato / totale) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="bg-slate-950 px-7 py-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-xl text-white">
              <Eye size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white uppercase tracking-wider">
                  Chi ha scaricato
                </h2>
                {master?.revisione_corrente && (
                  <span className="text-[10px] font-black bg-indigo-600 text-white px-2 py-0.5 rounded-lg">
                    Rev. {master.revisione_corrente}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest mt-0.5">
                {master?.titolo} — {master?.codice_documento}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportCSV(filtered, master)}
              className="flex items-center gap-1.5 text-xs font-black text-slate-300 hover:text-white px-3 py-2 hover:bg-slate-800 rounded-xl transition-colors"
            >
              <Download size={13} /> Export CSV
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Metriche */}
        <div className="grid grid-cols-4 gap-4 px-7 py-5 bg-slate-50 border-b border-slate-200 shrink-0">
          <StatCard label="Strutture totali"  value={totale}    color="text-slate-800" />
          <StatCard label="Hanno scaricato"   value={scaricato} color="text-emerald-600" />
          <StatCard label="Non ancora"         value={nonAncora} color="text-slate-500" />
          <StatCard label="Copertura"          value={`${copertura}%`} color={copertura >= 80 ? 'text-emerald-600' : copertura >= 50 ? 'text-amber-600' : 'text-rose-600'} />
        </div>

        {/* Filtri */}
        <div className="flex items-center gap-1 px-7 py-3 border-b border-slate-100 bg-white shrink-0">
          <Filter size={13} className="text-slate-400 mr-1" />
          {FILTRI.map(f => (
            <button
              key={f.id}
              onClick={() => setFiltro(f.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wide transition-all
                ${filtro === f.id
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Tabella */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin w-8 h-8 rounded-full border-4 border-indigo-200 border-t-indigo-600" />
            </div>
          ) : error ? (
            <div className="p-8 text-center text-rose-600 font-bold">{error}</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="px-5 py-3 text-left text-[11px] font-black text-slate-500 uppercase tracking-wider">Struttura</th>
                  <th className="px-4 py-3 text-left text-[11px] font-black text-slate-500 uppercase tracking-wider">Società</th>
                  <th className="px-4 py-3 text-left text-[11px] font-black text-slate-500 uppercase tracking-wider">Primo accesso</th>
                  <th className="px-4 py-3 text-left text-[11px] font-black text-slate-500 uppercase tracking-wider">Ultimo accesso</th>
                  <th className="px-4 py-3 text-center text-[11px] font-black text-slate-500 uppercase tracking-wider">Download</th>
                  <th className="px-4 py-3 text-left text-[11px] font-black text-slate-500 uppercase tracking-wider">Stato</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-slate-400 font-bold">
                      Nessun risultato
                    </td>
                  </tr>
                ) : filtered.map(row => (
                  <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <Users size={13} className="text-slate-300 shrink-0" />
                        <span className="font-bold text-slate-800">{row.facility_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-sm">{row.ragione_sociale}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs font-mono">
                      {row.primo_accesso
                        ? new Date(row.primo_accesso).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs font-mono">
                      {row.ultimo_accesso
                        ? new Date(row.ultimo_accesso).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-sm font-black ${row.accesso_count > 0 ? 'text-indigo-600' : 'text-slate-300'}`}>
                        {row.accesso_count ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <AccessoBadge hasScaricato={!!row.primo_accesso} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  );
}
