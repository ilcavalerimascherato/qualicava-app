import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { getNotifiche, markAsRead, markAllAsRead } from '../services/notificheService';

function tempoRelativo(isoString) {
  if (!isoString) return '';
  const diff = Date.now() - new Date(isoString).getTime();
  const min  = Math.floor(diff / 60000);
  if (min < 1)  return 'adesso';
  if (min < 60) return `${min} min fa`;
  const ore = Math.floor(min / 60);
  if (ore < 24) return `${ore} ${ore === 1 ? 'ora' : 'ore'} fa`;
  const giorni = Math.floor(ore / 24);
  if (giorni === 1) return 'ieri';
  return `${giorni} giorni fa`;
}

const TIPO_ICONA = { info: 'ℹ️', warning: '⚠️', success: '✅', error: '🔴' };

export default function NotifichePanel({ isOpen, onClose, userId, selectedNotifica, onReadChange }) {
  const navigate = useNavigate();
  const [notifiche, setNotifiche] = useState([]);
  const [loading, setLoading]     = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const loadNotifiche = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const data = await getNotifiche(userId);
      setNotifiche(data);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (isOpen) loadNotifiche();
  }, [isOpen, loadNotifiche]);

  useEffect(() => {
    if (isOpen && selectedNotifica) setExpandedId(selectedNotifica.id);
  }, [isOpen, selectedNotifica]);

  const handleClickNotifica = (n) => {
    if (!n.letta) {
      markAsRead(n.id).catch(() => {});
      setNotifiche(prev => prev.map(x => x.id === n.id ? { ...x, letta: true } : x));
      onReadChange?.();
    }
    setExpandedId(prev => (prev === n.id ? null : n.id));
  };

  const handleMarkAll = () => {
    if (!userId) return;
    markAllAsRead(userId).catch(() => {});
    setNotifiche(prev => prev.map(x => ({ ...x, letta: true })));
    onReadChange?.();
  };

  const handleVaiAllaStruttura = (e, n) => {
    e.stopPropagation();
    navigate(n.link);
    onClose();
  };

  if (!isOpen) return null;

  const countNonLette = notifiche.filter(n => !n.letta).length;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      <div className="fixed inset-y-0 right-0 w-96 h-full bg-slate-800 border-l border-slate-700 shadow-2xl z-50 flex flex-col">
        <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between shrink-0">
          <span className="text-sm font-black text-slate-200 uppercase tracking-widest">Notifiche</span>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
            title="Chiudi"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="px-5 py-8 text-center text-slate-500 text-xs font-bold">Caricamento...</div>
          ) : notifiche.length === 0 ? (
            <div className="px-5 py-8 text-center text-slate-500 text-xs font-bold">Nessuna notifica</div>
          ) : (
            <ul className="divide-y divide-slate-700">
              {notifiche.map(n => {
                const expanded = expandedId === n.id;
                return (
                  <li
                    key={n.id}
                    onClick={() => handleClickNotifica(n)}
                    className={`px-5 py-4 cursor-pointer hover:bg-slate-700 transition-colors ${!n.letta ? 'bg-slate-900/40' : ''}`}
                  >
                    <div className="flex gap-3">
                      <span className="text-base leading-none pt-0.5">
                        {TIPO_ICONA[n.tipo] ?? '🔔'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-black ${n.letta ? 'text-slate-400' : 'text-white'}`}>
                          {n.titolo}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1 whitespace-pre-wrap">
                          {n.messaggio}
                        </p>
                        <p className="text-[10px] text-slate-600 mt-1.5">{tempoRelativo(n.created_at)}</p>

                        {expanded && n.link && (
                          <button
                            onClick={(e) => handleVaiAllaStruttura(e, n)}
                            className="mt-3 text-[11px] font-bold text-indigo-400 hover:text-indigo-300 border border-indigo-500/40 rounded-lg px-3 py-1.5 transition-colors"
                          >
                            Vai alla struttura
                          </button>
                        )}
                      </div>
                      {!n.letta && (
                        <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1 shrink-0" />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {countNonLette > 0 && (
          <div className="px-5 py-3 border-t border-slate-700 shrink-0">
            <button
              onClick={handleMarkAll}
              className="w-full text-xs font-black text-slate-400 hover:text-white uppercase tracking-wider transition-colors"
            >
              Segna tutte lette
            </button>
          </div>
        )}
      </div>
    </>
  );
}
