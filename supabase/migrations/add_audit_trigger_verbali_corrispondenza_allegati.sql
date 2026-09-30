-- Aggiunge il trigger di audit già in uso sulle altre tabelle del modulo
-- Verbali Ispettivi (fn_audit_trigger, vedi definizione in
-- fix_audit_trigger_tables_without_id.sql) alla nuova tabella
-- verbali_corrispondenza_allegati — stesso pattern di
-- add_audit_trigger_verbali_ispettivi.sql.
--
-- fn_audit_trigger() è già definita nel database (non ricreata qui) —
-- questo script crea solo il trigger AFTER INSERT/UPDATE/DELETE che la
-- richiama. La tabella ha una colonna "id" (BIGSERIAL), quindi non serve
-- nessun altro adattamento oltre a quello già applicato dal fix generale.
--
-- Eseguire su Supabase SQL Editor DOPO add_verbali_corrispondenza_allegati.sql.

DROP TRIGGER IF EXISTS audit_verbali_corrispondenza_allegati ON verbali_corrispondenza_allegati;
CREATE TRIGGER audit_verbali_corrispondenza_allegati
  AFTER INSERT OR UPDATE OR DELETE ON verbali_corrispondenza_allegati
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();
