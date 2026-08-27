/**
 * src/utils/ncStats.js
 * ─────────────────────────────────────────────────────────────
 * Aggregazioni NC per la Fase 4 "Conformità & Rischio" (§4 del documento
 * di redesign /report) — distribuzione, trend mensile, tempo medio di
 * chiusura, aging, segnali deboli. Solo NC: SAE e Verbali ispettivi non
 * hanno ancora fonte dati in QualiCAVA (decisione esplicita dell'utente).
 *
 * Completamente agnostico rispetto a React.
 * ─────────────────────────────────────────────────────────────
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Data di riferimento di una NC: la data della segnalazione originaria se
 * presente, altrimenti il timestamp di apertura nel sistema (sempre
 * popolato, anche per le NC auto-generate da autoNcEngine che non
 * valorizzano data_ricezione).
 */
export function getNcReferenceDate(nc) {
  return nc.data_ricezione || nc.opened_at || null;
}

/**
 * Conteggi per un campo (classificazione/gravita/stato).
 * @returns {Object} { [valore]: count }
 */
export function computeNcDistribution(nonConformities, field) {
  const dist = {};
  (nonConformities ?? []).forEach(nc => {
    const key = nc[field] || 'Non specificato';
    dist[key] = (dist[key] || 0) + 1;
  });
  return dist;
}

/**
 * Trend mensile: NC aperte per mese, sugli ultimi N mesi.
 * @returns {Array<{ label: string, count: number }>}
 */
export function computeNcMonthlyTrend(nonConformities, months = 12) {
  const now = new Date();
  const buckets = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleDateString('it-IT', { month: 'short', year: '2-digit' }), count: 0 });
  }
  const byKey = new Map(buckets.map(b => [`${b.year}-${b.month}`, b]));

  (nonConformities ?? []).forEach(nc => {
    const ref = getNcReferenceDate(nc);
    if (!ref) return;
    const d = new Date(ref);
    const bucket = byKey.get(`${d.getFullYear()}-${d.getMonth()}`);
    if (bucket) bucket.count++;
  });

  return buckets.map(({ label, count }) => ({ label, count }));
}

/**
 * Giorni medi tra apertura e chiusura, complessivo e per gravità.
 * Solo NC 'Chiuso' con entrambe le date valide.
 * @returns {{ overall: number|null, byGravita: Object<string, number> }}
 */
export function computeAvgClosureTime(nonConformities) {
  const closed = (nonConformities ?? [])
    .filter(nc => nc.stato === 'Chiuso' && nc.data_chiusura)
    .map(nc => {
      const ref = getNcReferenceDate(nc);
      if (!ref) return null;
      const days = (new Date(nc.data_chiusura) - new Date(ref)) / MS_PER_DAY;
      return days >= 0 ? { days, gravita: nc.gravita || 'Non specificato' } : null;
    })
    .filter(Boolean);

  const avg = (arr) => arr.length ? Math.round((arr.reduce((s, v) => s + v.days, 0) / arr.length) * 10) / 10 : null;

  const byGravita = {};
  const gravitaGroups = {};
  closed.forEach(c => {
    if (!gravitaGroups[c.gravita]) gravitaGroups[c.gravita] = [];
    gravitaGroups[c.gravita].push(c);
  });
  Object.entries(gravitaGroups).forEach(([g, arr]) => { byGravita[g] = avg(arr); });

  return { overall: avg(closed), byGravita, count: closed.length };
}

/**
 * Aging delle NC non chiuse: bucket per fasce d'età in giorni.
 * Le NC aperte da oltre 90 giorni sono un indicatore di gestione, non di
 * qualità — segnalano che il processo correttivo non funziona.
 * @returns {{ buckets: Array<{ label: string, count: number }>, over90: Array }}
 */
export function computeNcAging(nonConformities) {
  const now = new Date();
  const ranges = [
    { label: '0-30gg',  min: 0,  max: 30 },
    { label: '30-60gg', min: 30, max: 60 },
    { label: '60-90gg', min: 60, max: 90 },
    { label: '>90gg',   min: 90, max: Infinity },
  ];

  const open = (nonConformities ?? [])
    .filter(nc => nc.stato !== 'Chiuso')
    .map(nc => {
      const ref = getNcReferenceDate(nc);
      if (!ref) return null;
      const ageDays = (now - new Date(ref)) / MS_PER_DAY;
      return { nc, ageDays };
    })
    .filter(Boolean);

  const buckets = ranges.map(r => ({
    label: r.label,
    count: open.filter(o => o.ageDays >= r.min && o.ageDays < r.max).length,
  }));

  const over90 = open.filter(o => o.ageDays >= 90).map(o => o.nc);

  return { buckets, over90 };
}

/**
 * "Segnali deboli" (versione solo-NC, senza SAE/Verbali ispettivi che non
 * esistono ancora): combinazioni struttura+tipologia con concentrazione
 * anomala nello stesso trimestre. Esclude le NC auto-generate da KPI
 * (segnalazione_da === 'System') — una concentrazione di NC di sistema
 * sullo stesso KPI è già visibile nel trend KPI stesso, non è un segnale
 * nuovo da evidenziare qui.
 * @returns {Array<{ facilityId, facilityName, classificazione, quarter, count }>}
 */
export function computeWeakSignals(nonConformities, facilitiesById, minCount = 3) {
  const groups = new Map();

  (nonConformities ?? [])
    .filter(nc => nc.segnalazione_da !== 'System')
    .forEach(nc => {
      const ref = getNcReferenceDate(nc);
      if (!ref) return;
      const d = new Date(ref);
      const quarter = `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
      const key = `${nc.facility_id}|${nc.classificazione || 'Non specificato'}|${quarter}`;
      if (!groups.has(key)) {
        groups.set(key, { facilityId: nc.facility_id, classificazione: nc.classificazione || 'Non specificato', quarter, count: 0 });
      }
      groups.get(key).count++;
    });

  return [...groups.values()]
    .filter(g => g.count >= minCount)
    .map(g => ({ ...g, facilityName: facilitiesById?.[g.facilityId]?.name ?? '—' }))
    .sort((a, b) => b.count - a.count);
}
