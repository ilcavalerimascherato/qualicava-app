import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bell } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  getNotifiche,
  getCountNonLette,
  markAsRead,
  markAllAsRead,
} from '../services/notificheService';
import NotifichePanel from './NotifichePanel';

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

export default function NotificheDropdown() {
  const { session }  = useAuth();
  const userId       = session?.user?.id;

  const [isOpen, setIsOpen]               = useState(false);
  const [notifiche, setNotifiche]         = useState([]);
  const [countNonLette, setCountNonLette] = useState(0);
  const [selectedNotifica, setSelectedNotifica] = useState(null);
  const [showPanel, setShowPanel]         = useState(false);
  const ref = useRef(null);

  const refreshCount = useCallback(async () => {
    if (!userId) return;
    try { setCountNonLette(await getCountNonLette(userId)); } catch { /* silent */ }
  }, [userId]);

  const loadNotifiche = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await getNotifiche(userId);
      setNotifiche(data.slice(0, 5));
    } catch { /* silent */ }
  }, [userId]);

  // Polling contatore ogni 60s
  useEffect(() => {
    refreshCount();
    const timer = setInterval(refreshCount, 60000);
    return () => clearInterval(timer);
  }, [refreshCount]);

  // Carica notifiche all'apertura
  useEffect(() => {
    if (isOpen) loadNotifiche();
  }, [isOpen, loadNotifiche]);

  // Chiudi su click esterno
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const handleClickNotifica = (n) => {
    if (!n.letta) {
      markAsRead(n.id).catch(() => {});
      setNotifiche(prev => prev.map(x => x.id === n.id ? { ...x, letta: true } : x));
      setCountNonLette(prev => Math.max(0, prev - 1));
    }
    setSelectedNotifica(n);
    setShowPanel(true);
  };

  const handleMarkAll = async () => {
    if (!userId) return;
    markAllAsRead(userId).catch(() => {});
    setNotifiche(prev => prev.map(x => ({ ...x, letta: true })));
    setCountNonLette(0);
  };

  return (
    <>
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen(o => !o)}
        className="relative p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-xl transition-colors"
        title="Notifiche"
      >
        <Bell size={20} />
        {countNonLette > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1 leading-none">
            {countNonLette > 99 ? '99+' : countNonLette}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-slate-800 border border-slate-700 rounded-2xl shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
            <span className="text-xs font-black text-slate-300 uppercase tracking-widest">Notifiche</span>
            {countNonLette > 0 && (
              <button
                onClick={handleMarkAll}
                className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-wider"
              >
                Segna tutte lette
              </button>
            )}
          </div>

          {notifiche.length === 0 ? (
            <div className="px-4 py-6 text-center text-slate-500 text-xs font-bold">
              Nessuna notifica
            </div>
          ) : (
            <>
              <ul className="divide-y divide-slate-700">
                {notifiche.map(n => (
                  <li
                    key={n.id}
                    onClick={() => handleClickNotifica(n)}
                    className={`flex gap-3 px-4 py-3 cursor-pointer hover:bg-slate-700 transition-colors ${!n.letta ? 'bg-slate-900/40' : ''}`}
                  >
                    <span className="text-base leading-none pt-0.5">
                      {TIPO_ICONA[n.tipo] ?? '🔔'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-black line-clamp-2 ${n.letta ? 'text-slate-400' : 'text-white'}`}>
                        {n.titolo}
                      </p>
                      <p className="text-[11px] text-slate-500 line-clamp-3 mt-0.5">{n.messaggio}</p>
                      <p className="text-[10px] text-slate-600 mt-1">{tempoRelativo(n.created_at)}</p>
                    </div>
                    {!n.letta && (
                      <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1 shrink-0" />
                    )}
                  </li>
                ))}
              </ul>

              {countNonLette > 0 && (
                <div className="px-4 py-3 border-t border-slate-700">
                  <button
                    onClick={handleMarkAll}
                    className="w-full text-xs font-black text-slate-400 hover:text-white uppercase tracking-wider transition-colors"
                  >
                    Segna tutte come lette
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>

    <NotifichePanel
      isOpen={showPanel}
      onClose={() => setShowPanel(false)}
      userId={userId}
      selectedNotifica={selectedNotifica}
      onReadChange={refreshCount}
    />
    </>
  );
}
