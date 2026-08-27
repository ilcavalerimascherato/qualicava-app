// src/views/VerifichePage.jsx
// Pagina /verifiche: "Matrice di sintesi" (monitoraggio, tutti i ruoli con
// viewReports — sede/admin/superadmin vedono anche "Configurazione") e
// "Configurazione" (template/ruoli/matrice responsabilità, solo
// sede/admin/superadmin). Il director opera invece dalla propria struttura
// (nuovo tab in DirectorFacility.jsx), non da questa pagina.
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import { ClipboardList, Settings, Plus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useDashboardData } from '../hooks/useDashboardData';
import { useBadgeCounts } from '../hooks/useBadgeCounts';
import AppHeader from '../components/AppHeader';
import UniversalFilterBar, { EMPTY_FILTERS, applyFacilityFilters } from '../components/cruscotto/UniversalFilterBar';
import MatriceSintesi from '../components/verifiche/MatriceSintesi';
import MatriceRuoli from '../components/verifiche/MatriceRuoli';
import VerificheAlertPanel from '../components/verifiche/VerificheAlertPanel';
import TemplateManagerModal from '../components/verifiche/TemplateManagerModal';
import RuoliManagerModal from '../components/verifiche/RuoliManagerModal';
import { getTemplates, getRuoli, getTemplateRuoli, getSessioni } from '../services/verificheService';
import { getVerificheAlerts } from '../utils/verificheAlertEngine';

export default function VerifichePage() {
  const navigate = useNavigate();
  const { isAdmin, can, profile, signOut } = useAuth();
  const [year] = useState(new Date().getFullYear());
  const { data } = useDashboardData(year);
  const { facilities, companies, udos } = data;

  const hasConfigAccess = can('manageStructures');

  const allIds = useMemo(() => (facilities ?? []).filter(f => !f.is_suspended).map(f => f.id), [facilities]);
  const { totals: badgeTotals } = useBadgeCounts(allIds, year, isAdmin);

  const handleNavigate = (page) => {
    const routes = {
      dashboard: '/admin', saturazione: '/occupazione', haccp: '/master',
      documenti: '/documenti', nc: '/non-conformita', verbali: '/verbali-ispettivi',
      report: '/report', impostazioni: '/impostazioni',
    };
    navigate(routes[page] ?? '/admin');
  };

  const [activeTab, setActiveTab] = useState('sintesi');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [templates, setTemplates] = useState([]);
  const [ruoli, setRuoli] = useState([]);
  const [templateRuoli, setTemplateRuoli] = useState([]);
  const [sessioni, setSessioni] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showRuoliModal, setShowRuoliModal] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [t, r, tr, s] = await Promise.all([
        getTemplates(), getRuoli(), getTemplateRuoli(), getSessioni(allIds.length ? allIds : undefined),
      ]);
      setTemplates(t); setRuoli(r); setTemplateRuoli(tr); setSessioni(s);
    } catch (err) {
      toast.error(`Errore caricamento verifiche: ${err.message ?? err}`);
    } finally {
      setLoading(false);
    }
  }, [allIds]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const filteredFacilities = useMemo(() => applyFacilityFilters(facilities, filters), [facilities, filters]);

  const alerts = useMemo(
    () => getVerificheAlerts({ facilities: filteredFacilities, templates, templateRuoli, sessioni }),
    [filteredFacilities, templates, templateRuoli, sessioni]
  );

  const openNewTemplate = () => { setEditingTemplate(null); setShowTemplateModal(true); };
  const openEditTemplate = (t) => { setEditingTemplate(t); setShowTemplateModal(true); };
  const closeTemplateModal = () => { setShowTemplateModal(false); setEditingTemplate(null); };

  return (
    <div className="min-h-screen bg-slate-100 pb-10 text-slate-900 font-sans">
      <Toaster position="top-right" />
      <AppHeader activePage="verifiche" badgeCounts={badgeTotals} user={profile} onSignOut={signOut} onNavigate={handleNavigate} />

      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-slate-100">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('sintesi')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'sintesi' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <ClipboardList size={14} /> Matrice di sintesi
          </button>
          {hasConfigAccess && (
            <button
              onClick={() => setActiveTab('config')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'config' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <Settings size={14} /> Configurazione
            </button>
          )}
        </div>
        {activeTab === 'config' && hasConfigAccess && (
          <button onClick={openNewTemplate} className="flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-sm font-semibold">
            <Plus size={14} /> Nuovo template
          </button>
        )}
      </div>

      <main className="px-6 py-6 max-w-6xl mx-auto space-y-5">
        {loading ? (
          <div className="text-center py-12 text-slate-400 animate-pulse font-medium">Caricamento...</div>
        ) : activeTab === 'sintesi' ? (
          <>
            <UniversalFilterBar facilities={facilities} companies={companies} udos={udos} value={filters} onChange={setFilters} />
            <VerificheAlertPanel alerts={alerts} />
            <MatriceSintesi facilities={filteredFacilities} templates={templates} templateRuoli={templateRuoli} sessioni={sessioni} />
          </>
        ) : (
          hasConfigAccess && (
            <MatriceRuoli
              templates={templates}
              ruoli={ruoli}
              templateRuoli={templateRuoli}
              udos={udos}
              onChanged={loadAll}
              onEditTemplate={openEditTemplate}
              onManageRuoli={() => setShowRuoliModal(true)}
            />
          )
        )}
      </main>

      <TemplateManagerModal isOpen={showTemplateModal} onClose={closeTemplateModal} template={editingTemplate} onSaved={() => { closeTemplateModal(); loadAll(); }} />
      <RuoliManagerModal isOpen={showRuoliModal} onClose={() => setShowRuoliModal(false)} ruoli={ruoli} onChanged={loadAll} />
    </div>
  );
}
