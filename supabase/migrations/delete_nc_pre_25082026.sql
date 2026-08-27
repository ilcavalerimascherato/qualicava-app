-- Pulizia una tantum: rimuove le Non Conformità "storiche" registrate
-- prima del 25/08/2026 — per la quasi totalità generate automaticamente
-- da KPI rossi (autoNcEngine.js, segnalazione_da='System') e mai gestite
-- (tutte "Aperto", nessuna mai passata a Pending/Chiuso), più una manciata
-- di segnalazioni manuali isolate della stessa epoca.
--
-- Scope verificato PRIMA dell'esecuzione con:
--   SELECT classificazione, segnalazione_da, stato, count(*), min(opened_at), max(opened_at)
--   FROM non_conformities WHERE opened_at <= '2026-08-25 23:59:59'
--   GROUP BY classificazione, segnalazione_da, stato ORDER BY count(*) DESC;
-- → 103 righe totali, tutte datate 2026-03-19 → 2026-08-20. Include una
-- riga isolata "Verbale Ente Vigilanza" del 10/05/2026 (segnalazione_da
-- 'Audit interno') — NON collegata al modulo Verbali Ispettivi (quello
-- genera segnalazione_da='Ente di vigilanza / Autorità', ed è stato
-- testato il 27/08, fuori da questo filtro). Cancellazione confermata
-- dall'utente su questo scope esatto.
--
-- Nessun DELETE su verbali_rilievi.non_conformity_id da ripulire: le NC
-- rimosse qui sono tutte precedenti al modulo Verbali Ispettivi, quindi
-- nessuna riga verbali_rilievi le referenzia (verificabile con la query
-- di controllo sotto, prima di eseguire il DELETE).
--
-- Eseguire su Supabase SQL Editor. Irreversibile.

-- Controllo di sicurezza: deve restituire 0 righe. Se restituisce righe,
-- FERMARSI e non eseguire il DELETE sotto — significa che qualche NC in
-- questo scope è collegata a un verbale ispettivo e va esclusa a mano.
SELECT vr.id, vr.verbale_id, vr.non_conformity_id
FROM verbali_rilievi vr
JOIN non_conformities nc ON nc.id = vr.non_conformity_id
WHERE nc.opened_at <= '2026-08-25 23:59:59';

-- Se la query sopra ha restituito 0 righe, procedere:
DELETE FROM non_conformities
WHERE opened_at <= '2026-08-25 23:59:59';
