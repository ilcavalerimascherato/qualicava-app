-- Aggiunge il trigger di audit già in uso sulle altre ~30 tabelle
-- (fn_audit_trigger, vedi definizione recuperata da pg_get_functiondef)
-- alle 3 tabelle del modulo Verbali Ispettivi, così compaiono nel filtro
-- del Registro Attività (src/constants/auditLogTables.js) invece di
-- restare un filtro "morto" come haccp_scadenzario.
--
-- fn_audit_trigger() è già definita nel database (non ricreata qui) —
-- questo script crea solo i 3 trigger AFTER INSERT/UPDATE/DELETE che la
-- richiamano, stesso pattern delle tabelle già coperte.
--
-- Eseguire su Supabase SQL Editor DOPO add_verbali_ispettivi_tables.sql.

DROP TRIGGER IF EXISTS audit_verbali_ispettivi ON verbali_ispettivi;
CREATE TRIGGER audit_verbali_ispettivi
  AFTER INSERT OR UPDATE OR DELETE ON verbali_ispettivi
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

DROP TRIGGER IF EXISTS audit_verbali_rilievi ON verbali_rilievi;
CREATE TRIGGER audit_verbali_rilievi
  AFTER INSERT OR UPDATE OR DELETE ON verbali_rilievi
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

DROP TRIGGER IF EXISTS audit_verbali_corrispondenza ON verbali_corrispondenza;
CREATE TRIGGER audit_verbali_corrispondenza
  AFTER INSERT OR UPDATE OR DELETE ON verbali_corrispondenza
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();
