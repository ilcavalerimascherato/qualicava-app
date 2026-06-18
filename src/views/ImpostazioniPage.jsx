// src/views/ImpostazioniPage.jsx
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import { Building2, Users, Mail, Bell, PenLine, Briefcase } from 'lucide-react';
import { useAuth }                               from '../contexts/AuthContext';
import { useDashboardData, useInvalidate }       from '../hooks/useDashboardData';
import { useBadgeCounts }                        from '../hooks/useBadgeCounts';
import { udoService }                            from '../services/supabaseService';
import AppHeader             from '../components/AppHeader';
import UdoManagerModal       from '../components/UdoManagerModal';
import QualityDashboardModal from '../components/QualityDashboardModal';
import DocFirmeModal         from '../components/DocFirmeModal';

const CURRENT_YEAR = new Date().getFullYear();

function SettingsCard({ icon, iconBg, iconColor, title, subtitle, onClick, disabled, badge }) {
  return (
    <div
      onClick={disabled ? undefined : onClick}
      className={`bg-white border border-slate-200 rounded-lg p-3 flex items-center gap-2.5 transition-colors ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-emerald-400'
      }`}
    >
      <div
        className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
        style={{ background: iconBg }}
      >
        <span style={{ color: iconColor }}>{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-semibold text-slate-900">{title}</p>
          {badge && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium leading-none">
              {badge}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>
    </div>
  );
}

export default function ImpostazioniPage() {
  const navigate                         = useNavigate();
  const { isAdmin, profile, signOut }    = useAuth();
  const [year]                           = useState(CURRENT_YEAR);
  const { data }                         = useDashboardData(year);
  const invalidate                       = useInvalidate();
  const [activeModal, setActiveModal]    = useState(null);

  const allIds = useMemo(
    () => (data.facilities ?? []).filter(f => !f.is_suspended).map(f => f.id),
    [data.facilities],
  );
  const { totals: badgeTotals } = useBadgeCounts(allIds, year, isAdmin);

  const headerFacilities = useMemo(
    () => (data.facilities ?? []).map(f => ({ ...f, riskLevel: 'unknown' })),
    [data.facilities],
  );

  const handleNavigate = (page) => {
    const routes = {
      dashboard:   '/admin',
      saturazione: '/occupazione',
      haccp:       '/master',
      documenti:   '/documenti',
      nc:          '/admin',
      report:      '/report',
    };
    navigate(routes[page] ?? '/admin');
  };

  const handleUdoSave = async (d) => {
    try {
      await udoService.save(d);
      await invalidate.udos();
    } catch (err) {
      toast.error(`Errore salvataggio UDO: ${err.message}`);
    }
  };

  const handleUdoDelete = async (id) => {
    if (!window.confirm('Eliminare questa UDO?')) return;
    try {
      await udoService.delete(id);
      await invalidate.udos();
    } catch (err) {
      toast.error(`Errore eliminazione UDO: ${err.message}`);
    }
  };

  const closeModal = () => setActiveModal(null);

  return (
    <div className="min-h-screen bg-slate-100 pb-10 text-slate-900 font-sans">
      <Toaster position="top-right" />

      <AppHeader
        activePage="impostazioni"
        facilities={headerFacilities}
        badgeCounts={badgeTotals}
        user={profile}
        onSignOut={signOut}
        onNavigate={handleNavigate}
        onSemaforoFilter={() => {}}
        semaforoFilter={null}
      />

      {/* ── Context bar ── */}
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-slate-100">
        <div>
          <h1 className="text-base font-semibold text-slate-900">Impostazioni</h1>
          <p className="text-xs text-slate-500 mt-0.5">Configurazione anagrafica, utenti e comunicazioni</p>
        </div>
      </div>

      {/* ── Body ── */}
      <main className="px-6 py-4 max-w-xl">

        {/* Anagrafica */}
        <section className="mb-6">
          <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-3">Anagrafica</p>
          <div className="grid grid-cols-2 gap-2.5">
            <SettingsCard
              icon={<Building2 size={14} />}
              iconBg="#F0FDF4" iconColor="#059669"
              title="Tipi struttura (UDO)"
              subtitle="Aggiunge, modifica o elimina UDO"
              onClick={() => setActiveModal('udo')}
            />
            <SettingsCard
              icon={<Briefcase size={14} />}
              iconBg="#EFF6FF" iconColor="#94A3B8"
              title="Società"
              subtitle="Gestione società e gruppi"
              badge="Prossimamente"
              disabled
            />
            <SettingsCard
              icon={<Users size={14} />}
              iconBg="#F5F3FF" iconColor="#7C3AED"
              title="Utenti e ruoli"
              subtitle="Accessi e permessi applicazione"
              onClick={() => setActiveModal('quality')}
            />
          </div>
        </section>

        {/* Comunicazioni */}
        <section className="mb-6">
          <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-3">Comunicazioni</p>
          <div className="grid grid-cols-2 gap-2.5">
            <SettingsCard
              icon={<Mail size={14} />}
              iconBg="#FFFBEB" iconColor="#D97706"
              title="Mailing list"
              subtitle="Destinatari per invii di gruppo"
              onClick={() => setActiveModal('quality')}
            />
            <SettingsCard
              icon={<Bell size={14} />}
              iconBg="#F8FAFC" iconColor="#94A3B8"
              title="Notifiche"
              subtitle="Impostazioni alert automatici"
              badge="Prossimamente"
              disabled
            />
          </div>
        </section>

        {/* Documenti */}
        <section>
          <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-3">Documenti</p>
          <div className="grid grid-cols-2 gap-2.5">
            <SettingsCard
              icon={<PenLine size={14} />}
              iconBg="#FFF7ED" iconColor="#EA580C"
              title="Firme digitali"
              subtitle="Firme per documentazione ufficiale"
              onClick={() => setActiveModal('firme')}
            />
          </div>
        </section>
      </main>

      {/* ── Modals — invariati ── */}
      <UdoManagerModal
        isOpen={activeModal === 'udo'}
        onClose={closeModal}
        udos={data.udos}
        onSave={handleUdoSave}
        onDelete={handleUdoDelete}
      />
      <QualityDashboardModal
        isOpen={activeModal === 'quality'}
        onClose={closeModal}
        facilities={data.facilities}
        udos={data.udos}
        kpiRecords={data.kpiRecords}
        surveys={data.surveys}
        year={year}
        isSuperAdmin={profile?.role === 'superadmin'}
      />
      {activeModal === 'firme' && (
        <DocFirmeModal onClose={closeModal} />
      )}
    </div>
  );
}
