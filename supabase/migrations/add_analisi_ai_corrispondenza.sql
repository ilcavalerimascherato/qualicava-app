-- Analisi AI degli allegati PDF di una voce di corrispondenza — verifica
-- se citano un atto precedente coerente col verbale a cui la corrispondenza
-- è agganciata, e se il contenuto sembra coprire quanto richiesto dall'ente.
-- L'analisi gira lato client PRIMA del salvataggio (vedi CorrispondenzaPanel.jsx
-- — bottone "Verifica con AI" -> risultato mostrato -> "Conferma e salva"):
-- il risultato arriva già calcolato nello stesso INSERT, queste colonne non
-- vengono mai scritte da un secondo giro separato.
--
-- Migration NON distruttiva: solo ALTER TABLE ADD COLUMN IF NOT EXISTS.
-- Nessuna modifica RLS necessaria — la UPDATE/INSERT policy già esistente su
-- verbali_corrispondenza (add_verbali_ispettivi_tables.sql) copre già questi
-- campi.
--
-- Eseguire su Supabase SQL Editor.

ALTER TABLE verbali_corrispondenza ADD COLUMN IF NOT EXISTS analisi_ai_stato TEXT NOT NULL DEFAULT 'non_eseguita'
  CHECK (analisi_ai_stato IN ('non_eseguita','completata','errore'));
ALTER TABLE verbali_corrispondenza ADD COLUMN IF NOT EXISTS analisi_ai_risultato JSONB;
ALTER TABLE verbali_corrispondenza ADD COLUMN IF NOT EXISTS analisi_ai_il TIMESTAMPTZ;
