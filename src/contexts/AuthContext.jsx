// src/contexts/AuthContext.jsx
// Unica fonte di verità per: sessione, profilo utente, ruolo, strutture accessibili
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession]   = useState(undefined); // undefined = non ancora verificato
  const [profile, setProfile]   = useState(null);
  const [loading, setLoading]   = useState(true);

  const fetchProfile = useCallback(async (userId) => {
    if (!userId) { setProfile(null); return; }
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*, user_facility_access!user_facility_access_user_id_fkey(facility_id)')
      .eq('id', userId)
      .single();
    if (error) { console.error('Errore caricamento profilo:', error); return; }
    setProfile({
      ...data,
      // Lista piatta degli id strutture accessibili, per controlli rapidi
      accessibleFacilityIds: (data.user_facility_access || []).map(a => a.facility_id)
    });
  }, []);

  useEffect(() => {
    // Carica la sessione iniziale
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      fetchProfile(session?.user?.id).finally(() => setLoading(false));
    });

    // Ascolta i cambiamenti di auth (login, logout, refresh token, scadenza)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      fetchProfile(session?.user?.id);

      // Sessione scaduta: TOKEN_REFRESHED fallisce silenziosamente →
      // onAuthStateChange emette SIGNED_OUT. Lo intercettiamo e forziamo
      // il reload alla pagina di login con un messaggio chiaro.
      if (event === 'SIGNED_OUT') {
        // Controlla se è uno sign-out volontario o per sessione scaduta
        // (la pagina corrente non è già /login)
        if (window.location.pathname !== '/login') {
          // Aggiungi parametro per mostrare il banner "sessione scaduta"
          window.location.replace('/login?expired=1');
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  // Helper: evita di controllare manualmente il ruolo in tutta l'app
  const isAdmin      = ['superadmin', 'admin', 'sede'].includes(profile?.role);
  const isSuperAdmin = profile?.role === 'superadmin';
  const isDirector   = profile?.role === 'director';

  const canAccessFacility = useCallback((facilityId) => {
    if (!profile) return false;
    if (isAdmin) return true; // admin vede tutto (RLS fa il resto a DB level)
    return profile.accessibleFacilityIds.includes(facilityId);
  }, [profile, isAdmin]);

  // Mappa permessi per ruolo — unica fonte di verità
  const PERMISSIONS = {
    superadmin: ['manageStructures','viewAllStructures','manageUsers','viewReports','editKpi'],
    admin:      ['manageStructures','viewAllStructures','manageUsers','viewReports','editKpi'],
    sede:       ['manageStructures','viewAllStructures','viewReports'],
    director:   ['editKpi','viewReports'],
  };

  const can = useCallback((action) => {
    if (!profile?.role) return false;
    return (PERMISSIONS[profile.role] ?? []).includes(action);
  }, [profile]); // eslint-disable-line react-hooks/exhaustive-deps

  const value = {
    session,
    profile,
    loading,
    isAdmin,
    isSuperAdmin,
    isDirector,
    canAccessFacility,
    can,
    signOut,
    refreshProfile: () => fetchProfile(session?.user?.id),
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook tipizzato — lancia errore se usato fuori dal provider
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === null) throw new Error('useAuth deve essere usato dentro <AuthProvider>');
  return ctx;
}
