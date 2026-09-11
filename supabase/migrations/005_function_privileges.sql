-- Review #4 follow-up (T076): functions are not executable unless granted on purpose.
--
-- Supabase grants EXECUTE on new public functions to anon and authenticated, and Postgres
-- grants it to PUBLIC. Revoke both, now and for future functions, then grant back only what
-- the app and the RLS policies call. Trigger functions need no grant: EXECUTE is checked
-- when the trigger is created, not when it fires, and the helpers below are only called
-- from security-definer functions, which run as their owner.

alter function public.guard_approved_clinical_record() set search_path = public, extensions;
alter function public.clinical_record_action(text, text, text, jsonb)
  set search_path = public, extensions;

revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon, authenticated;

-- Verified against this Postgres build: `alter default privileges ... revoke ... from public`
-- above does NOT stop new functions from getting PUBLIC=EXECUTE. Postgres always folds the
-- built-in PUBLIC-execute default into a function's initial ACL, even when the matching
-- pg_default_acl row for its owner/schema explicitly omits public, anon and authenticated
-- (confirmed empirically: a function created after the statements above still shows EXECUTE
-- for anon/authenticated, with or without an explicit `for role postgres` clause). The only
-- reliable way to close EXECUTE on functions created from now on is to strip it right after
-- creation via an event trigger. Every later migration that needs a caller to run a new
-- function must still grant EXECUTE to it explicitly (Task 5's current_access_session and
-- revoke_current_access_session do this); a `create or replace` of an existing function also
-- re-triggers this revoke, so any migration that redefines a granted function must re-grant it.
create or replace function public.revoke_new_function_execute()
returns event_trigger
language plpgsql
set search_path = public, extensions
as $$
declare
  obj record;
begin
  for obj in
    select object_identity
    from pg_event_trigger_ddl_commands()
    where object_type in ('function', 'procedure')
      and schema_name = 'public'
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', obj.object_identity);
  end loop;
end;
$$;

drop event trigger if exists revoke_new_function_execute;
create event trigger revoke_new_function_execute
  on ddl_command_end
  when tag in ('CREATE FUNCTION', 'CREATE PROCEDURE')
  execute function public.revoke_new_function_execute();

-- Evaluated by the RLS policies as the querying role.
grant execute on function public.is_active_access(uuid) to authenticated;
grant execute on function public.current_clinic_id() to authenticated;

-- The app's RPCs (contracts/auth-session.md, contracts/clinical-attribution.md).
grant execute on function public.start_access_session() to authenticated;
grant execute on function public.touch_access_session(uuid) to authenticated;
grant execute on function public.revoke_access_session(uuid) to authenticated;
grant execute on function public.revoke_access_sessions() to authenticated;
grant execute on function public.approve_clinical_record(uuid) to authenticated;
