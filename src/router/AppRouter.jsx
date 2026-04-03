/**
 * src/router/AppRouter.jsx  —  v2
 * ─────────────────────────────────────────────────────────────
 * MODIFICHE v2:
 *  - ROLES da constants.js al posto di stringhe hardcoded.
 *  - RequireAdmin usa can('manageStructures') invece di isAdmin.
 *  - RoleRouter gestisce il caso accessibleFacilityIds undefined/vuoto.
 *  - Aggiunto redirect esplicito per ruolo 'sede' verso /admin.
 * ─────────────────────────────────────────────────────────────
 */
import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ROLES }   from '../config/constants';

const AdminApp         = lazy(() => import('../App'));
const DirectorApp      = lazy(() => import('../views/DirectorApp'));
const DirectorFacility = lazy(() => import('../views/DirectorFacility'));
const MasterDashboard  = lazy(() => import('../views/MasterDashboard'));
const Login            = lazy(() => import('../Login'));

function Splash({ msg = 'Caricamento...' }) {
  return (
    <div className="h-screen flex items-center justify-center bg-slate-50">
      <span className="font-black text-slate-400 uppercase tracking-[0.2em] text-sm animate-pulse">
        {msg}
      </span>
    </div>
  );
}

// Reindirizza se non autenticato
function RequireAuth() {
  const { session, loading } = useAuth();
  if (loading) return <Splash />;
  if (!session) return <Navigate to="/login" replace />;
  return <Outlet />;
}

// Smista in base al ruolo dopo il login
function RoleRouter() {
  const { profile, loading } = useAuth();
  if (loading || !profile) return <Splash msg="Verifica profilo..." />;

  const { role } = profile;

  // Admin / sede → dashboard HQ
  if ([ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.SEDE].includes(role)) {
    return <Navigate to="/admin" replace />;
  }

  // Direttore → smista per numero di strutture
  if (role === ROLES.DIRECTOR) {
    const ids = profile.accessibleFacilityIds ?? [];

    if (ids.length === 0) {
      // Account configurato ma senza strutture assegnate — mostra errore utile
      return (
        <div className="h-screen flex items-center justify-center bg-slate-50 p-6">
          <div className="text-center max-w-sm">
            <p className="font-black text-slate-700 text-lg mb-2">Nessuna struttura assegnata</p>
            <p className="text-slate-500 text-sm">
              Il tuo account non ha ancora accesso a nessuna struttura.
              Contatta l'amministratore di sistema.
            </p>
          </div>
        </div>
      );
    }

    // Una sola struttura → vai diretto senza tappa intermedia
    if (ids.length === 1) return <Navigate to={`/facility/${ids[0]}`} replace />;

    // Più strutture → lista di selezione
    return <Navigate to="/director" replace />;
  }

  // Ruolo 'viewer' o non riconosciuto → logout di sicurezza
  return <Navigate to="/login" replace />;
}

// Protegge le route HQ
function RequireAdmin() {
  const { can, loading } = useAuth();
  if (loading) return <Splash />;
  if (!can('manageStructures')) return <Navigate to="/" replace />;
  return <Outlet />;
}

// Protegge la route di una struttura specifica
function RequireFacilityAccess() {
  const { facilityId }                  = useParams();
  const { canAccessFacility, can, loading } = useAuth();
  if (loading) return <Splash />;
  // Admin vede tutto, director solo le sue
  if (!can('viewAllStructures') && !canAccessFacility(Number(facilityId))) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Splash />}>
        <Routes>
          {/* Unica route pubblica */}
          <Route path="/login" element={<Login />} />

          {/* Tutto il resto richiede autenticazione */}
          <Route element={<RequireAuth />}>

            {/* Root: smista per ruolo */}
            <Route index element={<RoleRouter />} />

            {/* Vista HQ — solo admin/superadmin/sede */}
            <Route element={<RequireAdmin />}>
              <Route path="/admin"  element={<AdminApp />} />
              <Route path="/master" element={<MasterDashboard />} />
            </Route>

            {/* Vista direttore — lista strutture */}
            <Route path="/director" element={<DirectorApp />} />

            {/* Vista direttore — struttura specifica */}
            <Route element={<RequireFacilityAccess />}>
              <Route path="/facility/:facilityId" element={<DirectorFacility />} />
            </Route>

          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
