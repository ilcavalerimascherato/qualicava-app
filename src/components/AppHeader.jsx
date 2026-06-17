import React, { useState } from 'react';
import {
  LayoutDashboard, BarChart2, ChefHat, FileText,
  AlertTriangle, TrendingUp, Settings, ChevronDown, LogOut,
} from 'lucide-react';
import NotificheDropdown from './NotificheDropdown';

const NAV_TABS = [
  { key: 'dashboard',   label: 'Dashboard',   Icon: LayoutDashboard },
  { key: 'saturazione', label: 'Saturazione',  Icon: BarChart2       },
  { key: 'haccp',       label: 'HACCP',        Icon: ChefHat         },
  { key: 'documenti',   label: 'Documenti',    Icon: FileText        },
  { key: 'nc',          label: 'NC',           Icon: AlertTriangle   },
  { key: 'report',      label: 'Report',       Icon: TrendingUp      },
];

const SEMAFORO_STYLES = {
  low:       'bg-emerald-50 border-emerald-200 text-emerald-700',
  medium:    'bg-amber-50 border-amber-200 text-amber-700',
  high:      'bg-red-50 border-red-200 text-red-700',
  suspended: 'bg-slate-100 border-slate-200 text-slate-500',
};

const DOT_COLORS = {
  low:       'bg-emerald-500',
  medium:    'bg-amber-400',
  high:      'bg-red-500',
  suspended: 'bg-slate-400',
};

export default function AppHeader({
  activePage,
  facilities,
  badgeCounts,
  user,
  onSignOut,
  onNavigate,
  onSemaforoFilter,
  semaforoFilter,
}) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const verde  = facilities.filter(f => !f.is_suspended && f.riskLevel === 'low').length;
  const giallo = facilities.filter(f => !f.is_suspended && f.riskLevel === 'medium').length;
  const rosso  = facilities.filter(f => !f.is_suspended && f.riskLevel === 'high').length;
  const grigio = facilities.filter(f => f.is_suspended).length;

  const semafori = [
    { label: `${verde} ok`,      level: 'low'       },
    { label: `${giallo} att.`,   level: 'medium'    },
    { label: `${rosso} critici`, level: 'high'      },
    { label: `${grigio} sosp.`,  level: 'suspended' },
  ];

  const initials = user?.full_name
    ? user.full_name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : '?';

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40">

      {/* ── Level 1: identità + semafori + utente ── */}
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-slate-100">

        {/* Logo + nome */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div
            className="flex items-center justify-center text-white font-bold w-8 h-8"
            style={{ background: '#059669', borderRadius: 6 }}
          >
            <span className="text-sm font-bold">Q</span>
          </div>
          <span className="text-base font-bold text-slate-900 leading-none">
            Quali<span style={{ color: '#059669' }}>CAVA</span>
          </span>
          <span className="text-xs text-slate-400 ml-1 leading-none">· Gruppo Over</span>
        </div>

        {/* Semafori */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-400 mr-1">strutture:</span>
          {semafori.map(({ label, level }) => (
            <button
              key={level}
              onClick={() => onSemaforoFilter(semaforoFilter === level ? null : level)}
              className={`flex items-center gap-1.5 border rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${SEMAFORO_STYLES[level]} ${
                semaforoFilter === level ? 'ring-1 ring-current' : 'opacity-90 hover:opacity-100'
              }`}
            >
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${DOT_COLORS[level]}`} />
              {label}
            </button>
          ))}
        </div>

        {/* Notifiche + utente */}
        <div className="flex items-center gap-2">
          <NotificheDropdown />
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(prev => !prev)}
              className="flex items-center gap-2 border border-slate-200 rounded-full px-3 py-1.5 hover:bg-slate-50 transition-colors"
            >
              <div
                className="flex items-center justify-center text-white font-bold flex-shrink-0 w-7 h-7"
                style={{ background: '#059669', borderRadius: '50%', fontSize: 12 }}
              >
                {initials}
              </div>
              <span className="max-w-[140px] truncate text-sm font-medium text-slate-700">{user?.full_name}</span>
              <ChevronDown size={12} className="text-slate-400" />
            </button>
            {userMenuOpen && (
              <div
                className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 min-w-[160px]"
                onClick={() => setUserMenuOpen(false)}
              >
                <div className="px-3 py-2 text-[11px] text-slate-400 border-b border-slate-100 truncate">
                  {user?.email}
                </div>
                <button
                  onClick={onSignOut}
                  className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-b-lg flex items-center gap-1.5"
                >
                  <LogOut size={13} /> Esci
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Level 2: navigazione tab ── */}
      <div className="flex items-stretch px-5 bg-slate-50 border-b border-slate-200">
        {NAV_TABS.map(({ key, label, Icon }) => {
          const isActive = activePage === key;
          const badge = key === 'haccp'     ? (badgeCounts?.haccp     ?? 0)
                      : key === 'documenti' ? (badgeCounts?.documenti ?? 0)
                      : key === 'nc'        ? (badgeCounts?.nc        ?? 0)
                      : 0;
          const badgeYellow = key === 'documenti';

          return (
            <button
              key={key}
              onClick={() => onNavigate(key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? 'text-emerald-600 border-b-2 border-emerald-600'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon size={15} />
              {label}
              {badge > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold leading-none ${
                  badgeYellow ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                }`}>
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </button>
          );
        })}

        <div className="w-px h-5 bg-slate-200 mx-2 self-center flex-shrink-0" />

        <button
          onClick={() => onNavigate('impostazioni')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
            activePage === 'impostazioni'
              ? 'text-emerald-600 border-b-2 border-emerald-600'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Settings size={15} />
          Impostazioni
        </button>
      </div>
    </header>
  );
}
