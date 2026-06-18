import React, { useState } from 'react';
import {
  LayoutDashboard, BarChart2, ChefHat, FileText,
  AlertTriangle, TrendingUp, Settings, ChevronDown, LogOut,
} from 'lucide-react';
import NotificheDropdown from './NotificheDropdown';

export default function AppHeader({
  activePage,
  badgeCounts,
  user,
  onSignOut,
  onNavigate,
}) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const initials = user?.full_name
    ? user.full_name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : '?';

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="flex items-center px-5 h-12 gap-6">

        {/* SINISTRA — logo */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-7 h-7 bg-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">Q</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-bold text-slate-900">
              Quali<span className="text-emerald-600">CAVA</span>
            </span>
            <span className="text-xs text-slate-500">· Gruppo Over</span>
          </div>
        </div>

        {/* CENTRO — tab navigazione */}
        <nav className="flex-1 flex items-stretch justify-center gap-0 h-full">
          {[
            { id: 'dashboard',   label: 'Dashboard',   icon: LayoutDashboard, badge: null,                   badgeColor: null    },
            { id: 'saturazione', label: 'Saturazione',  icon: BarChart2,       badge: null,                   badgeColor: null    },
            { id: 'haccp',       label: 'HACCP',        icon: ChefHat,         badge: badgeCounts?.haccp,     badgeColor: 'red'   },
            { id: 'documenti',   label: 'Documenti',    icon: FileText,        badge: badgeCounts?.documenti, badgeColor: 'amber' },
            { id: 'nc',          label: 'NC',           icon: AlertTriangle,   badge: badgeCounts?.nc,        badgeColor: 'red'   },
            { id: 'report',      label: 'Report',       icon: TrendingUp,      badge: null,                   badgeColor: null    },
          ].map(({ id, label, icon: Icon, badge, badgeColor }) => (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={`flex items-center gap-1.5 px-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 ${
                activePage === id
                  ? 'text-emerald-600 border-emerald-600'
                  : 'text-slate-500 border-transparent hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Icon size={14} />
              {label}
              {badge > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold leading-none ${
                  badgeColor === 'red'   ? 'bg-red-100 text-red-700' :
                  badgeColor === 'amber' ? 'bg-amber-100 text-amber-700' : ''
                }`}>
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </button>
          ))}

          <div className="w-px bg-slate-200 my-2.5 mx-1 flex-shrink-0" />

          <button
            onClick={() => onNavigate('impostazioni')}
            className={`flex items-center gap-1.5 px-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 ${
              activePage === 'impostazioni'
                ? 'text-emerald-600 border-emerald-600'
                : 'text-slate-500 border-transparent hover:text-slate-700'
            }`}
          >
            <Settings size={14} />
            Impostazioni
          </button>
        </nav>

        {/* DESTRA — notifiche + utente */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <NotificheDropdown />
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(prev => !prev)}
              className="flex items-center gap-2 border border-slate-200 rounded-full px-3 py-1.5 hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1"
            >
              <div
                className="flex items-center justify-center text-white font-bold flex-shrink-0 w-7 h-7"
                style={{ background: '#059669', borderRadius: '50%', fontSize: 12 }}
              >
                {initials}
              </div>
              <span className="max-w-[140px] truncate text-sm font-medium text-slate-700">{user?.full_name}</span>
              <ChevronDown size={12} className="text-slate-500" />
            </button>
            {userMenuOpen && (
              <div
                className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 min-w-[160px]"
                onClick={() => setUserMenuOpen(false)}
              >
                <div className="px-3 py-2 text-[11px] text-slate-500 border-b border-slate-100 truncate">
                  {user?.email}
                </div>
                <button
                  onClick={onSignOut}
                  className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-b-lg flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1"
                >
                  <LogOut size={13} /> Esci
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
    </header>
  );
}
