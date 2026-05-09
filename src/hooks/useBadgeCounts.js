// src/hooks/useBadgeCounts.js
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

const POLL_MS   = 60_000;
const QUERY_CAP = 500;

const EMPTY_TOTALS  = { documenti: 0, haccp: 0, haccpRossi: 0, nc: 0, kpi: 0, grand: 0 };
const emptyFacility = () => ({ documenti: 0, haccp: 0, haccpRossi: 0, nc: 0, kpi: 0, total: 0 });

/**
 * Aggrega conteggi badge per struttura da 4 sorgenti dati in parallelo.
 * Esegue il polling ogni 60 secondi.
 *
 * Per admin/superadmin (isAdmin=true) il badge Documenti conta:
 *   A) doc_master pubblicati (non obsoleto/bozza) senza alcuna istanza distribuita
 *   D) doc_master con istanze distribuite e data_scadenza scaduta
 *
 * Per director/sede (isAdmin=false) il badge Documenti conta le istanze
 * non ancora consultate o aggiornate dopo il primo accesso.
 *
 * @param {number[]} facilityIds - Array di ID struttura da monitorare
 * @param {number}   currentYear - Anno corrente
 * @param {boolean}  isAdmin     - true per ruoli admin/superadmin
 */
export function useBadgeCounts(facilityIds = [], currentYear = new Date().getFullYear(), isAdmin = false) {
  const [loading,     setLoading]     = useState(true);
  const [perFacility, setPerFacility] = useState({});
  const [totals,      setTotals]      = useState(EMPTY_TOTALS);

  const idsKey = [...facilityIds]
    .sort((a, b) => a - b)
    .slice(0, QUERY_CAP)
    .join(',');

  const fetchAll = useCallback(async () => {
    const ids = idsKey.split(',').map(Number).filter(Boolean);

    if (!ids.length && !isAdmin) {
      setPerFacility({});
      setTotals(EMPTY_TOTALS);
      setLoading(false);
      return;
    }

    // ── 6 query in parallelo ──────────────────────────────────────
    const docsQ = ids.length
      ? supabase.from('doc_istanze').select('facility_id, primo_accesso_il, generato_il').in('facility_id', ids)
      : Promise.resolve({ data: [], error: null });

    const haccpQ = ids.length
      ? supabase.from('haccp_scadenzario').select('struttura_id, semaforo').in('struttura_id', ids).in('semaforo', ['rosso', 'giallo'])
      : Promise.resolve({ data: [], error: null });

    const ncQ = ids.length
      ? supabase.from('non_conformities').select('facility_id, stato').in('facility_id', ids).in('stato', ['Aperto', 'Pending']).eq('year', currentYear)
      : Promise.resolve({ data: [], error: null });

    const kpiQ = ids.length
      ? supabase.from('fact_kpi_monthly').select('facility_id, month').in('facility_id', ids).eq('year', currentYear)
      : Promise.resolve({ data: [], error: null });

    // Admin: doc_master pubblicati e master_id distribuiti (no-op se non admin)
    const mastersQ = isAdmin
      ? supabase.from('doc_master').select('id, data_scadenza').neq('stato', 'obsoleto').neq('stato', 'bozza')
      : Promise.resolve({ data: null, error: null });

    const distQ = isAdmin
      ? supabase.from('doc_istanze').select('master_id')
      : Promise.resolve({ data: null, error: null });

    const [docsRes, haccpRes, ncRes, kpiRes, mastersRes, distRes] =
      await Promise.all([docsQ, haccpQ, ncQ, kpiQ, mastersQ, distQ]);

    // ── Mesi attesi: da gennaio al mese precedente al corrente ────
    const nowMonth       = new Date().getMonth() + 1;
    const expectedMonths = Array.from({ length: nowMonth - 1 }, (_, i) => i + 1);

    // ── Inizializza accumulatori per struttura ────────────────────
    const result = Object.fromEntries(ids.map(id => [id, emptyFacility()]));

    // ── Documenti (logica director/sede: primo_accesso_il) ────────
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

    // ── Admin: badge Documenti = A (non distribuiti) + D (scaduti) ─
    if (isAdmin && !mastersRes.error && !distRes.error) {
      const today = new Date().toISOString().split('T')[0];
      const distributedIds = new Set((distRes.data ?? []).map(r => r.master_id).filter(Boolean));
      let adminDocCount = 0;
      for (const m of mastersRes.data ?? []) {
        if (!distributedIds.has(m.id)) {
          adminDocCount++; // A: pubblicato ma non ancora distribuito
        } else if (m.data_scadenza && m.data_scadenza < today) {
          adminDocCount++; // D: distribuito ma con scadenza superata
        }
      }
      tots.documenti = adminDocCount;
      tots.grand     = tots.grand - Object.values(result).reduce((s, r) => s + r.documenti, 0) + adminDocCount;
    }

    setPerFacility(result);
    setTotals(tots);
    setLoading(false);
  }, [idsKey, currentYear, isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchAll();
    const timer = setInterval(fetchAll, POLL_MS);
    return () => clearInterval(timer);
  }, [fetchAll]);

  return { loading, perFacility, totals };
}
