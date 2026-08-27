-- Estende a 'board' la policy di lettura su cdg_servizi_map — la vista
-- v_cdg_mensile (security_invoker=true) fa JOIN cdg_mensile + cdg_servizi_map,
-- quindi serve SELECT su entrambe le tabelle perché la RLS del chiamante si
-- applica a ogni tabella coinvolta nel JOIN, non solo alla prima.
-- Completa add_board_role_to_cdg_policy.sql.
--
-- Eseguire su Supabase SQL Editor.

ALTER POLICY cdg_map_director_read ON cdg_servizi_map
USING (user_role() = ANY (ARRAY['superadmin'::text, 'sede'::text, 'admin'::text, 'director'::text, 'board'::text]));
