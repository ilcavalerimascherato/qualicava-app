// src/components/RegistroAttivitaModal.jsx
import { useState, useEffect, useCallback } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { getAuditLog, computeDiff } from '../services/auditLogService';
import { AUDIT_LOG_TABLES } from '../constants/auditLogTables';

const PAGE_SIZE = 50;

const OPERATION_CFG = {
  INSERT: { label: 'INSERT', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  UPDATE: { label: 'UPDATE', bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200'   },
  DELETE: { label: 'DELETE', bg: 'bg-red-50',     text: 'text-red-600',     border: 'border-red-200'     },
};

function formatData(dt) {
  if (!dt) return '';
  return new Date(dt).toLocaleString('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function RigaAudit({ riga, expanded, onToggle }) {
  const cfg = OPERATION_CFG[riga.operation] ?? OPERATION_CFG.UPDATE;
  const diff = riga.operation === 'INSERT'
    ? computeDiff(null, riga.new_data)
    : riga.operation === 'DELETE'
      ? computeDiff(riga.old_data, null)
      : computeDiff(riga.old_data, riga.new_data);

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-2 text-left flex-wrap">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
            {cfg.label}
          </span>
          <span className="text-xs font-bold text-slate-800">{riga.table_name}</span>
          <span className="text-xs text-slate-400">{riga.utente_label}</span>
          <span className="text-xs text-slate-400">{formatData(riga.performed_at)}</span>
        </div>
        <ChevronDown size={14} className={`text-slate-400 transition-transform shrink-0 ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="p-3">
          {diff.length === 0 ? (
            <p className="text-xs text-slate-400">Nessuna differenza rilevata</p>
          ) : (
            <div className="space-y-1">
              {diff.map(({ campo, prima, dopo }) => (
                <div key={campo} className="text-xs flex flex-wrap items-baseline gap-1">
                  <span className="font-bold text-slate-600">{campo}:</span>
                  {riga.operation === 'INSERT' ? (
                    <span className="text-emerald-700">{JSON.stringify(dopo)}</span>
                  ) : riga.operation === 'DELETE' ? (
                    <span className="text-red-600">{JSON.stringify(prima)}</span>
                  ) : (
                    <>
                      <span className="text-red-500 line-through">{JSON.stringify(prima)}</span>
                      <span className="text-slate-400">→</span>
                      <span className="text-emerald-700">{JSON.stringify(dopo)}</span>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function RegistroAttivitaModal({ onClose }) {
  const [rows, setRows]           = useState([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(0);
  const [tableName, setTableName] = useState('');
  const [loading, setLoading]     = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  const caricaPagina = useCallback(async (p, filtro, append) => {
    setLoading(true);
    try {
      const { rows: nuove, total: tot } = await getAuditLog({ page: p, pageSize: PAGE_SIZE, tableName: filtro || null });
      setRows(prev => (append ? [...prev, ...nuove] : nuove));
      setTotal(tot);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setPage(0);
    caricaPagina(0, tableName, false);
  }, [tableName, caricaPagina]);

  const caricaAltri = () => {
    const next = page + 1;
    setPage(next);
    caricaPagina(next, tableName, true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">

        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-black text-slate-800">Registro attività</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {total > 0 ? `${total} operazioni registrate` : 'Nessuna operazione registrata'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <X size={18} className="text-slate-400" />
          </button>
        </div>

        <div className="px-6 py-3 border-b border-slate-100">
          <select
            value={tableName}
            onChange={e => setTableName(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-indigo-400"
          >
            <option value="">Tutte le tabelle</option>
            {AUDIT_LOG_TABLES.map(({ group, tables }) => (
              <optgroup key={group} label={group}>
                {tables.map(t => <option key={t} value={t}>{t}</option>)}
              </optgroup>
            ))}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {loading && rows.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">Caricamento...</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">Nessuna operazione trovata</p>
          ) : (
            rows.map(r => (
              <RigaAudit
                key={r.id}
                riga={r}
                expanded={expandedId === r.id}
                onToggle={() => setExpandedId(prev => (prev === r.id ? null : r.id))}
              />
            ))
          )}

          {rows.length < total && (
            <div className="flex justify-center pt-2">
              <button
                onClick={caricaAltri}
                disabled={loading}
                className="text-xs font-bold text-slate-600 px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
              >
                {loading ? 'Caricamento...' : 'Carica altri'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
