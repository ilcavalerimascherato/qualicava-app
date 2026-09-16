-- Sotto-versioni per la Carta dei Servizi: se si genera più volte lo stesso
-- numero_revisione (es. per correzioni prima della consegna definitiva), le
-- occorrenze successive alla prima si distinguono internamente come
-- "numero_revisione_versione_interna" (es. 3_1, 3_2...), stesso schema già
-- in uso per haccp_manuali. Il documento .docx stampabile mostra invece
-- sempre e solo il numero_revisione principale.
ALTER TABLE carta_servizi_generati
  ADD COLUMN IF NOT EXISTS versione_interna integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN carta_servizi_generati.versione_interna IS
  '0 = unica generazione per questo numero_revisione (mostrato senza suffisso); >0 = N-esima rigenerazione dello stesso numero_revisione (mostrato come "numero_revisione_versione_interna" solo nelle liste interne, mai nel documento stampabile).';
