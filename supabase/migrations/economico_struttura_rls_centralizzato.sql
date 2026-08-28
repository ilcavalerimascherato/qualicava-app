-- Aggancia economico_mensile_struttura al sistema centralizzato appena creato
-- (role_permission_groups / user_in_group), stessa logica di economico_mensile:
-- admin = gruppo 'hq', read = gruppo 'financial_read' (include già 'director').

DROP POLICY IF EXISTS economico_mensile_struttura_admin ON economico_mensile_struttura;
CREATE POLICY economico_mensile_struttura_admin ON economico_mensile_struttura
  FOR ALL USING (user_in_group('hq'));

DROP POLICY IF EXISTS economico_mensile_struttura_read ON economico_mensile_struttura;
CREATE POLICY economico_mensile_struttura_read ON economico_mensile_struttura
  FOR SELECT USING (user_in_group('financial_read'));
