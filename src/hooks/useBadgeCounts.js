// src/hooks/useBadgeCounts.js
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

const POLL_MS   = 60_000;
const QUERY_CAP = 50; // limite per admin/superadmin con molte strutture

const EMPTY_TOTALS  = { documenti: 0, haccp: 0, haccpRossi: 0, nc: 0, kpi: 0, grand: 0 };
const emptyFacility = () => ({ documenti: 0, haccp: 0, haccpRossi: 0, nc: 0, kpi: 0, total: 0 });

/**
 * Aggrega conteggi badge per struttura da 4 sorgenti dati in parallelo.
 * Esegue il polling ogni 60 secondi.
 *
 * @param {number[]} facilityIds   - Array di ID struttura da monitorare
 * @param {number}   currentYear   - Anno corrente (default: anno corrente)
 *
 * @returns {{ loading: boolean, perFacility: Object, totals: Object }}
 */
export function useBadgeCounts(facilityIds = [], currentYear = new Date().getFullYear()) {
  const [loading,     setLoading]     = useState(true);
  const [perFacility, setPerFacility] = useState({});
  const [totals,      setTotals]      = useState(EMPTY_TOTALS);

  // Chiave stabile per evitare ricreazione del callback ad ogni render
  const idsKey = [...facilityIds]
    .sort((a, b) => a - b)
    .slice(0, QUERY_CAP)
    .join(',');

  const fetchAll = useCallback(async () => {
    const ids = idsKey.split(',').map(Number).filter(Boolean);

    if (!ids.length) {
      setPerFacility({});
      setTotals(EMPTY_TOTALS);
      setLoading(false);
      return;
    }

    // ── 4 query in parallelo ──────────────────────────────────────
    const [docsRes, haccpRes, ncRes, kpiRes] = await Promise.all([

      // 1. Documenti non ancora visti o aggiornati dopo primo accesso
      supabase
        .from('doc_istanze')
        .select('facility_id, primo_accesso_il, generato_il')
        .in('facility_id', ids),

      // 2. Scadenzario HACCP — solo semafori rosso/giallo
      supabase
        .from('haccp_scadenzario')
        .select('struttura_id, semaforo')
        .in('struttura_id', ids)
        .in('semaforo', ['rosso', 'giallo']),

      // 3. Non conformità aperte
      supabase
        .from('non_conformities')
        .select('facility_id, stato')
        .in('facility_id', ids)
        .in('stato', ['Aperto', 'Pending']),

      // 4. Mesi KPI registrati nell'anno corrente
      supabase
        .from('fact_kpi_monthly')
        .select('facility_id, month')
        .in('facility_id', ids)
        .eq('year', currentYear),
    ]);

    // ── Mesi attesi: da gennaio al mese precedente al corrente ────
    const nowMonth       = new Date().getMonth() + 1; // 1-based
    const expectedMonths = Array.from({ length: nowMonth - 1 }, (_, i) => i + 1);

    // ── Inizializza accumulatori per struttura ────────────────────
    const result = Object.fromEntries(ids.map(id => [id, emptyFacility()]));

    // ── Documenti ─────────────────────────────────────────────────
    if (!docsRes.error) {
      for (const row of docsRes.data ?? []) {
        const r = result[row.facility_id];
        if (!r) continue;
        const isNew     = row.primo_accesso_il === null;
        const isUpdated = row.generato_il && row.primo_accesso_il &&
          new Date(row.generato_il) > new Date(row.primo_accesso_il);
        if (isNew || isUpdated) r.documenti++;
      }
    }

    // ── HACCP semafori ────────────────────────────────────────────
    if (!haccpRes.error) {
      for (const row of haccpRes.data ?? []) {
        const r = result[row.struttura_id];
        if (!r) continue;
        r.haccp++;
        if (row.semaforo === 'rosso') r.haccpRossi++;
      }
    }

    // ── Non conformità ────────────────────────────────────────────
    if (!ncRes.error) {
      for (const row of ncRes.data ?? []) {
        const r = result[row.facility_id];
        if (!r) continue;
        r.nc++;
      }
    }

    // ── KPI mesi mancanti ─────────────────────────────────────────
    if (!kpiRes.error && expectedMonths.length > 0) {
      const presentByFacility = {};
      for (const row of kpiRes.data ?? []) {
        if (!presentByFacility[row.facility_id]) presentByFacility[row.facility_id] = new Set();
        presentByFacility[row.facility_id].add(row.month);
      }
      for (const id of ids) {
        const present = presentByFacility[id] ?? new Set();
        result[id].kpi = expectedMonths.filter(m => !present.has(m)).length;
      }
    }

    // ── Totale per struttura ──────────────────────────────────────
    for (const r of Object.values(result)) {
      r.total = r.documenti + r.haccp + r.nc + r.kpi;
    }

    // ── Totali globali ────────────────────────────────────────────
    const tots = { documenti: 0, haccp: 0, haccpRossi: 0, nc: 0, kpi: 0, grand: 0 };
    for (const r of Object.values(result)) {
      tots.documenti  += r.documenti;
      tots.haccp      += r.haccp;
      tots.haccpRossi += r.haccpRossi;
      tots.nc         += r.nc;
      tots.kpi        += r.kpi;
      tots.grand      += r.total;
    }

    setPerFacility(result);
    setTotals(tots);
    setLoading(false);
  }, [idsKey, currentYear]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchAll();
    const timer = setInterval(fetchAll, POLL_MS);
    return () => clearInterval(timer);
  }, [fetchAll]);

  return { loading, perFacility, totals };
}
