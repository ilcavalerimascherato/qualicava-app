import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { Lock, Mail, LogIn, AlertCircle, CheckCircle2, Eye, EyeOff, KeyRound } from 'lucide-react';

export default function Login() {
  const navigate                        = useNavigate();
  const [loading, setLoading]           = useState(false);
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPwd, setShowPwd]           = useState(false);
  const [newPassword, setNewPwd]        = useState('');
  const [confirmPwd, setConfirmPwd]     = useState('');
  const [showNewPwd, setShowNewPwd]     = useState(false);
  const [error, setError]               = useState('');
  const [success, setSuccess]           = useState('');
  const [mode, setMode]                 = useState('login');
  const [forgotEmail, setForgotEmail]   = useState('');

  useEffect(() => {
    // Intercetta token recovery
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      setMode('recovery');
      window.history.replaceState(null, '', window.location.pathname);
      return;
    }
    // Mostra banner sessione scaduta se redirectati da AuthContext
    const params = new URLSearchParams(window.location.search);
    if (params.get('expired') === '1') {
      setError('La tua sessione è scaduta. Accedi di nuovo.');
      window.history.replaceState(null, '', window.location.pathname);
    }
    // Se già loggato, reindirizza subito
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate('/', { replace: true });
    });
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (authError) {
      setError('Email o password non corretti. Riprova.');
      setLoading(false);
      return;
    }
    if (data?.session) {
      navigate('/', { replace: true });
    }
    setLoading(false);
  };

  const handleSetNewPassword = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPwd) { setError('Le password non coincidono.'); return; }
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) { setError('Errore: ' + updateError.message); setLoading(false); return; }
    setSuccess('Password aggiornata. Accesso in corso...');
    setTimeout(() => navigate('/', { replace: true }), 1500);
    setLoading(false);
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError('');
    if (!forgotEmail.trim()) { setError('Inserisci la tua email.'); return; }
    setLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      forgotEmail.trim(),
      { redirectTo: window.location.origin + '/login' }
    );
    setLoading(false);
    if (resetError) {
      setError('Errore invio email: ' + resetError.message);
    } else {
      setSuccess('Email inviata. Controlla la tua casella (anche la cartella spam).');
      setTimeout(() => setMode('login'), 4000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-emerald-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-200">
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="bg-emerald-600 p-3 rounded-xl text-white mb-4 shadow-lg">
            <Lock size={32} />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            QualiCAVA <span className="text-emerald-600">SECURE</span>
          </h1>
          <p className="text-slate-400 text-sm font-medium mt-1">Monitoraggio Gruppo OVER</p>
        </div>

        {error && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 text-sm font-medium px-4 py-3 rounded-xl mb-5">
            <AlertCircle size={16} className="shrink-0 text-red-500 mt-0.5" />
            {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium px-4 py-3 rounded-xl mb-5">
            <CheckCircle2 size={16} className="shrink-0 text-emerald-500" />
            {success}
          </div>
        )}

        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 text-slate-400" size={18} />
                <input type="email" value={email}
                  onChange={e => { setEmail(e.target.value); setError(''); }}
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                  placeholder="nome@gruppover.it" autoComplete="email" required />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 text-slate-400" size={18} />
                <input type={showPwd ? 'text' : 'password'} value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  className="w-full pl-10 pr-10 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                  placeholder="••••••••" autoComplete="current-password" required />
                <button type="button" onClick={() => setShowPwd(p => !p)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600" tabIndex={-1}>
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-emerald-600 text-white py-3 rounded-xl font-black hover:bg-emerald-700 transition-all shadow-lg flex justify-center items-center gap-2 mt-2 disabled:opacity-60">
              {loading ? <span className="animate-pulse">Accesso in corso...</span> : <><LogIn size={18} /> Entra nel Sistema</>}
            </button>
            <button type="button" onClick={() => { setMode('forgot'); setError(''); setSuccess(''); setForgotEmail(email); }}
              className="w-full text-center text-xs text-slate-400 hover:text-emerald-600 font-bold mt-3 transition-colors">
              Password dimenticata?
            </button>
          </form>
        )}

        {mode === 'forgot' && (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="bg-sky-50 border border-sky-200 rounded-xl px-4 py-3 mb-2">
              <p className="text-xs font-bold text-sky-700">
                Inserisci la tua email aziendale. Riceverai un link per reimpostare la password.
              </p>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 text-slate-400" size={18} />
                <input type="email" value={forgotEmail}
                  onChange={e => { setForgotEmail(e.target.value); setError(''); }}
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-sky-500 text-sm"
                  placeholder="nome@gruppover.it" autoComplete="email" required />
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-sky-600 text-white py-3 rounded-xl font-black hover:bg-sky-700 transition-all shadow-lg flex justify-center items-center gap-2 disabled:opacity-60">
              {loading ? <span className="animate-pulse">Invio in corso...</span> : <><KeyRound size={18} /> Invia link di reset</>}
            </button>
            <button type="button" onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
              className="w-full text-center text-xs text-slate-400 hover:text-slate-600 font-bold transition-colors">
              ← Torna al login
            </button>
          </form>
        )}

        {mode === 'recovery' && (
          <form onSubmit={handleSetNewPassword} className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <p className="text-xs font-bold text-amber-700">Imposta la tua nuova password.</p>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Nuova password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 text-slate-400" size={18} />
                <input type={showNewPwd ? 'text' : 'password'} value={newPassword}
                  onChange={e => { setNewPwd(e.target.value); setError(''); }}
                  className="w-full pl-10 pr-10 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                  placeholder="Scegli una password" autoComplete="new-password" required />
                <button type="button" onClick={() => setShowNewPwd(p => !p)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600" tabIndex={-1}>
                  {showNewPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Conferma password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 text-slate-400" size={18} />
                <input type="password" value={confirmPwd}
                  onChange={e => { setConfirmPwd(e.target.value); setError(''); }}
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                  placeholder="Ripeti la password" autoComplete="new-password" required />
              </div>
              {confirmPwd && (
                <p className={`text-xs mt-1 font-bold ${newPassword === confirmPwd ? 'text-emerald-600' : 'text-red-500'}`}>
                  {newPassword === confirmPwd ? '✓ Coincidono' : '✗ Non coincidono'}
                </p>
              )}
            </div>
            <button type="submit" disabled={loading || (confirmPwd.length > 0 && newPassword !== confirmPwd)}
              className="w-full bg-emerald-600 text-white py-3 rounded-xl font-black hover:bg-emerald-700 transition-all shadow-lg flex justify-center items-center gap-2 disabled:opacity-60">
              {loading ? <span className="animate-pulse">Salvataggio...</span> : <><CheckCircle2 size={18} /> Imposta password</>}
            </button>
          </form>
        )}

        <p className="text-center text-xs text-slate-400 mt-6">Accesso riservato al personale autorizzato</p>
      </div>
    </div>
  );
}
