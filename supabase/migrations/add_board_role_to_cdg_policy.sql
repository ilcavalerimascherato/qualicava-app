-- Estende a 'board' la policy di lettura su cdg_mensile (occupazione,
-- ingressi/dimissioni) — stesso pattern delle altre policy RLS corrette in
-- add_board_role_to_rls_policies.sql. Senza questa, "Ospiti totali" e
-- "Occupazione media" nel Cruscotto restano N/D per il ruolo board.
--
-- Non si tocca cdg_mensile_admin (policy ALL, scrittura): board ha solo
-- permesso viewReports, nessun accesso in scrittura.
--
-- Eseguire su Supabase SQL Editor.

ALTER POLICY cdg_mensile_director_read ON cdg_mensile
USING (user_role() = ANY (ARRAY['superadmin'::text, 'sede'::text, 'admin'::text, 'director'::text, 'board'::text]));
