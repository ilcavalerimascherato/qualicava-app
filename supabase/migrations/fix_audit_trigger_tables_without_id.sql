-- fn_audit_trigger() usava old.id/new.id direttamente: fallisce con
-- "record \"old\" has no field \"id\"" su qualsiasi tabella priva di
-- colonna id (es. user_facility_access, chiave primaria composita
-- user_id+facility_id), bloccando silenziosamente ogni INSERT/DELETE
-- su quella tabella tramite il trigger trg_audit_user_facility_access.
--
-- Fix: estrae l'id passando per to_jsonb(...)->>'id', che ritorna NULL
-- invece di generare un errore quando la colonna non esiste — stesso
-- valore testuale di prima per le ~30 tabelle che hanno già id.
-- Va anche rilassato il NOT NULL su audit_log.record_id, altrimenti
-- l'errore si sposterebbe lì per le tabelle senza id.

ALTER TABLE public.audit_log ALTER COLUMN record_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.fn_audit_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.audit_log (table_name, record_id, operation, performed_by, old_data, new_data)
  values (
    TG_TABLE_NAME,
    (case when TG_OP = 'DELETE' then to_jsonb(old)->>'id' else to_jsonb(new)->>'id' end),
    TG_OP,
    coalesce(auth.uid(), nullif(current_setting('app.audit_actor', true), '')::uuid),
    case when TG_OP in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when TG_OP in ('INSERT','UPDATE') then to_jsonb(new) else null end
  );
  return coalesce(new, old);
end;
$function$;
