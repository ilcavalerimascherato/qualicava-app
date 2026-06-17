import { useState, useEffect, useCallback } from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';

export default function AiBriefing({ facilities = [], ncRecords = [], kpiRecords = [] }) {
  const [brief, setBrief]     = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [query, setQuery]     = useState('');

  const generateBrief = useCallback(async () => {
    if (!process.env.REACT_APP_ANTHROPIC_API_KEY) {
      setError('Chiave API Anthropic non configurata.');
      return;
    }
    setLoading(true);
    setError(null);

    const active    = facilities.filter(f => !f.is_suspended);
    const suspended = facilities.filter(f =>  f.is_suspended);
    const critical  = active.filter(f => f.riskLevel === 'high');
    const attention = active.filter(f => f.riskLevel === 'medium');
    const ok        = active.filter(f => f.riskLevel === 'low');

    const topCritical = [...critical, ...attention]
      .sort((a, b) => (b.riskScore?.score ?? 0) - (a.riskScore?.score ?? 0))
      .slice(0, 3)
      .map(f => ({
        name:    f.name,
        udo:     f.udo_name,
        region:  f.region,
        score:   f.riskScore?.score  ?? 0,
        months:  f.riskScore?.months ?? 0,
        openNc:  ncRecords.filter(nc => nc.facility_id === f.id && nc.status !== 'chiuso').length,
      }));

    const ncByRegion = facilities.reduce((acc, f) => {
      const region = f.region ?? 'Altra';
      const nc = ncRecords.filter(r => r.facility_id === f.id && r.status !== 'chiuso').length;
      acc[region] = (acc[region] ?? 0) + nc;
      return acc;
    }, {});

    const totalOpenNc = ncRecords.filter(r => r.status !== 'chiuso').length;

    const today = new Date().toLocaleDateString('it-IT', {
      weekday: 'long', day: 'numeric', month: 'long',
    });

    const prompt = `Sei l'assistente AI di QualiCAVA, sistema di gestione qualità per strutture sociosanitarie italiane.
Genera un briefing mattutino conciso in italiano per il responsabile qualità di sede.

Dati aggiornati al ${today}:
- Strutture totali: ${facilities.length} (${active.length} attive, ${suspended.length} sospese)
- Stato strutture attive: ${ok.length} in regola, ${attention.length} in attenzione, ${critical.length} critiche
${totalOpenNc > 0 ? `- NC aperte totali: ${totalOpenNc}` : ''}
${Object.keys(ncByRegion).length > 0 ? `- NC per regione: ${Object.entries(ncByRegion).map(([r, n]) => `${r}: ${n}`).join(', ')}` : ''}
- Strutture più critiche: ${topCritical.length > 0
    ? topCritical.map(f => `${f.name} (${f.udo}, ${f.region}) — score ${f.score}/${f.months}m${f.openNc > 0 ? `, ${f.openNc} NC aperte` : ''}`).join('; ')
    : 'nessuna criticità rilevata'}

Genera un briefing con questa struttura ESATTA:
1. Una frase di apertura contestuale alla situazione generale
2. Massimo 2-3 punti di attenzione specifici con nome struttura e problema concreto
3. Una frase conclusiva con il focus suggerito per la giornata

Tono: diretto, professionale. Massimo 120 parole. Testo continuo in 2-3 paragrafi — niente elenchi.
Usa il grassetto HTML <strong> solo per i nomi delle strutture critiche.`;

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type':                              'application/json',
          'x-api-key':                                 process.env.REACT_APP_ANTHROPIC_API_KEY,
          'anthropic-version':                         '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model:      'claude-sonnet-4-6',
          max_tokens: 400,
          messages:   [{ role: 'user', content: prompt }],
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error.message);
      setBrief(json.content?.[0]?.text ?? '');
    } catch (err) {
      setError('Impossibile generare il briefing. Riprova.');
      console.error('AiBriefing error:', err);
    } finally {
      setLoading(false);
    }
  }, [facilities, ncRecords]);

  // Genera solo al mount — non ad ogni cambio props
  useEffect(() => {
    if (facilities.length > 0) generateBrief();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mb-6">
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Sparkles size={15} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">Briefing AI</p>
              <p className="text-xs text-slate-400">
                {new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
          </div>
          <button
            onClick={generateBrief}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 disabled:opacity-40 transition-colors"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Generazione...' : 'Rigenera'}
          </button>
        </div>

        {/* Contenuto */}
        <div className="px-5 py-4 min-h-[80px]">
          {loading && !brief && (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <div className="w-4 h-4 border-2 border-emerald-300 border-t-emerald-600 rounded-full animate-spin" />
              Analisi in corso...
            </div>
          )}
          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}
          {brief && !loading && (
            <p
              className="text-sm text-slate-700 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: brief }}
            />
          )}
        </div>

        {/* Box domande — predisposto per v2, disabilitato */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100">
          <div className="flex items-center gap-3">
            <div className="flex-1 flex items-center gap-2 bg-white border border-slate-200 rounded-full px-3.5 py-2">
              <Sparkles size={13} className="text-slate-300 flex-shrink-0" />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder='Chiedi qualcosa — "quali strutture lombarde hanno saturazione in calo?"'
                disabled
                className="flex-1 text-xs bg-transparent outline-none text-slate-400 placeholder-slate-300 disabled:cursor-not-allowed"
              />
              <span className="text-[10px] text-slate-300 border border-slate-200 rounded px-1.5 py-0.5 flex-shrink-0">
                prossimamente
              </span>
            </div>
          </div>
          <p className="text-[10px] text-slate-300 mt-2 pl-1">
            Query interattiva sui dati — disponibile nella prossima versione
          </p>
        </div>

      </div>
    </div>
  );
}
