// src/hooks/useCdgData.js

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabaseClient';

export function useCdgData(facilityIds, year) {
  return useQuery({
    queryKey: ['cdgData', facilityIds, year],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      let q = supabase
        .from('v_cdg_mensile')
        .select('*')
        .in('anno', [year - 1, year])
        .order('anno')
        .order('mese');

      if (facilityIds && facilityIds.length > 0) {
        q = q.in('facility_id', facilityIds);
      }

      const { data, error } = await q;
      if (error) throw error;

      const cdgByFacility = {};
      for (const row of data || []) {
        const fid = row.facility_id;
        if (!fid) continue;
        if (!cdgByFacility[fid]) cdgByFacility[fid] = [];
        cdgByFacility[fid].push(row);
      }

      return { raw: data || [], cdgByFacility };
    },
    enabled: facilityIds === null || (Array.isArray(facilityIds) && facilityIds.length > 0),
  });
}

/**
 * Aggrega record multi-centro per (anno, mese) — sempre SOMMA.
 * Esclude mesi senza dati reali (media_ospiti = null).
 */
export function aggregateCdgRecords(records) {
  if (!records?.length) return [];
  const map = {};
  for (const r of records) {
    // Salta mesi senza dato reale (es. budget futuri giu-dic)
    if (r.media_ospiti == null) continue;
    const key = `${r.anno}-${r.mese}`;
    if (!map[key]) {
      map[key] = { ...r };
    } else {
      map[key].giornate                = (map[key].giornate                || 0) + (r.giornate                || 0);
      map[key].assenze                 = (map[key].assenze                 || 0) + (r.assenze                 || 0);
      map[key].media_ospiti            = (map[key].media_ospiti            || 0) + (r.media_ospiti            || 0);
      map[key].media_ospiti_definitivi = (map[key].media_ospiti_definitivi || 0) + (r.media_ospiti_definitivi || 0);
      map[key].media_ospiti_temporanei = (map[key].media_ospiti_temporanei || 0) + (r.media_ospiti_temporanei || 0);
      map[key].ingressi                = (map[key].ingressi                || 0) + (r.ingressi                || 0);
      map[key].dimissioni              = (map[key].dimissioni              || 0) + (r.dimissioni              || 0);
      map[key].n_ospiti                = (map[key].n_ospiti                || 0) + (r.n_ospiti                || 0);
      map[key].budget_media_ospiti     = (map[key].budget_media_ospiti     || 0) + (r.budget_media_ospiti     || 0);
    }
  }
  return Object.values(map).sort((a, b) =>
    a.anno !== b.anno ? a.anno - b.anno : a.mese - b.mese
  );
}

/**
 * Calcola summary da record già aggregati (solo mesi con dati reali).
 * @param {object[]} records   - output di aggregateCdgRecords
 * @param {number}   bedCount  - posti letto struttura (per saturazione %)
 */
export function calcCdgSummary(records, bedCount) {
  if (!records?.length) return null;

  // Ultimo mese con dato reale
  const lastMonth = records.at(-1);
  if (!lastMonth) return null;

  // Mese precedente
  const prev = records.length >= 2 ? records.at(-2) : null;

  // Ultimi 12 mesi disponibili
  const last12 = records.slice(-12);

  // Saturazione % mese corrente
  const mediaOspiti = parseFloat(lastMonth.media_ospiti) || 0;
  const budget      = lastMonth.budget_media_ospiti != null
    ? parseFloat(lastMonth.budget_media_ospiti) : null;
  const saturazione = bedCount > 0 ? (mediaOspiti / bedCount * 100) : null;
  const budgetSat   = budget != null && bedCount > 0
    ? (budget / bedCount * 100) : null;

  // Media saturazione ultimi 12 mesi
  const sat12 = last12
    .map(r => bedCount > 0 ? (parseFloat(r.media_ospiti) / bedCount * 100) : null)
    .filter(v => v != null);
  const mediaSat12 = sat12.length > 0
    ? sat12.reduce((a, b) => a + b, 0) / sat12.length : null;

  // Media budget saturazione ultimi 12 mesi
  const bdg12 = last12
    .map(r => r.budget_media_ospiti != null && bedCount > 0
      ? (parseFloat(r.budget_media_ospiti) / bedCount * 100) : null)
    .filter(v => v != null);
  const mediaBdg12 = bdg12.length > 0
    ? bdg12.reduce((a, b) => a + b, 0) / bdg12.length : null;

  // Delta saturazione vs budget (mese corrente)
  const deltaVsBudget = saturazione != null && budgetSat != null && budgetSat > 0
    ? (saturazione - budgetSat) : null;
  const pctVsBudget = deltaVsBudget != null && budgetSat > 0
    ? (deltaVsBudget / budgetSat * 100) : null;

  // Delta MoM saturazione
  const prevSat = prev && bedCount > 0
    ? (parseFloat(prev.media_ospiti) / bedCount * 100) : null;
  const deltaMom = saturazione != null && prevSat != null
    ? (saturazione - prevSat) : null;

  // Ingressi/Dimissioni: totale 12 mesi + ultimo mese
  const ingressi12     = last12.reduce((s, r) => s + (r.ingressi   || 0), 0);
  const dimissioni12   = last12.reduce((s, r) => s + (r.dimissioni || 0), 0);
  const ingressiMese   = lastMonth.ingressi   ?? 0;
  const dimissioniMese = lastMonth.dimissioni ?? 0;

  // Trend per grafico (ultimi 12 mesi)
  const trend12 = last12.map(r => ({
    label:       `${r.anno}-${String(r.mese).padStart(2, '0')}`,
    saturazione: bedCount > 0
      ? parseFloat((parseFloat(r.media_ospiti) / bedCount * 100).toFixed(1)) : null,
    budget:      r.budget_media_ospiti != null && bedCount > 0
      ? parseFloat((parseFloat(r.budget_media_ospiti) / bedCount * 100).toFixed(1)) : null,
  }));

  return {
    mese:            lastMonth.mese,
    anno:            lastMonth.anno,
    mediaOspiti,
    budget,
    saturazione,
    budgetSat,
    mediaSat12,
    mediaBdg12,
    deltaVsBudget,
    pctVsBudget,
    deltaMom,
    ingressi12,
    dimissioni12,
    ingressiMese,
    dimissioniMese,
    mesiDisponibili: last12.length,
    trend12,
  };
}
