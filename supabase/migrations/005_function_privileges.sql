-- Review #4 follow-up (T076): functions are not executable unless granted on purpose.
--
-- Supabase grants EXECUTE on new public functions to anon and authenticated, and Postgres
-- grants it to PUBLIC. Revoke both, now and for future functions, then grant back only what
-- the app and the RLS policies call. Trigger functions need no grant: EXECUTE is checked
-- when the trigger is created, not when it fires, and the helpers below are only called
-- from security-definer functions, which run as their owner.
--
-- Converge a database that already applied an earlier version of this migration, which used
-- a `ddl_command_end` event trigger to close new functions. That trigger is wrong: it
-- subscribed to the `CREATE PROCEDURE` tag but tried `revoke execute on FUNCTION ...`, which
-- Postgres rejects for procedures, so it aborted every future `create procedure` in `public`.
-- It is unnecessary besides: the *global* `alter default privileges` form below (no
-- `in schema`) replaces Postgres's built-in PUBLIC-execute default outright, where the
-- per-schema form could only ever be added on top of it.
drop event trigger if exists revoke_new_function_execute;
drop function if exists public.revoke_new_function_execute();

alter function public.guard_approved_clinical_record() set search_path = public, extensions;
alter function public.clinical_record_action(text, text, text, jsonb)
  set search_path = public, extensions;

revoke execute on all functions in schema public from public, anon, authenticated;

-- Closing new functions to PUBLIC needs both statements below; neither is redundant.
--
-- 1. The global form (no `in schema`) replaces Postgres's built-in default ACL for functions,
--    which grants EXECUTE to PUBLIC. A per-schema `alter default privileges in schema public
--    revoke ... from public` cannot do this: Postgres merges a per-schema default-ACL row
--    additively on top of the built-in default, so a per-schema revoke can never subtract
--    from it (verified: a function created after a public-schema-only revoke still shows
--    EXECUTE for PUBLIC). The global row has no such built-in default to fight, so a plain
--    revoke sticks. This also closes PUBLIC-execute for any function `postgres` creates in
--    other schemas, not just `public` -- a deliberate widening beyond this migration's
--    stated scope, and the safer default, since no migration in this repo creates functions
--    outside `public`.
-- 2. The per-schema `revoke ... from anon, authenticated` is LOAD-BEARING, not redundant with
--    the global PUBLIC revoke above: Supabase's own default privileges for schema `public`
--    grant EXECUTE directly to `anon` and `authenticated` (not merely through PUBLIC
--    membership), verified by restoring that default and inspecting the resulting ACL
--    (`anon=X/postgres,authenticated=X/postgres`). Removing this line would leave every new
--    public function callable by anon and authenticated again.
--
-- Caveat: a function installed into `public` by `CREATE EXTENSION` escapes both statements,
-- because supautils runs extension installs as `supabase_admin`, whose own default ACL grants
-- `anon`/`authenticated` directly and is untouched by anything `postgres` does here. Install
-- extensions into the `extensions` schema, as migration 001 already does, not into `public`.
alter default privileges revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon, authenticated;

-- Evaluated by the RLS policies as the querying role.
grant execute on function public.is_active_access(uuid) to authenticated;
grant execute on function public.current_clinic_id() to authenticated;

-- The app's RPCs (contracts/auth-session.md, contracts/clinical-attribution.md).
grant execute on function public.start_access_session() to authenticated;
grant execute on function public.touch_access_session(uuid) to authenticated;
grant execute on function public.revoke_access_session(uuid) to authenticated;
grant execute on function public.revoke_access_sessions() to authenticated;
grant execute on function public.approve_clinical_record(uuid) to authenticated;
