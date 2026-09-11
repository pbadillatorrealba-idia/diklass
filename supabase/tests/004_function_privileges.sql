begin;
select plan(30);

-- ---------------------------------------------------------------------------
-- RLS helpers and app RPCs: authenticated only, never anon.
-- ---------------------------------------------------------------------------

select function_privs_are('public', 'is_active_access', array['uuid'], 'authenticated', array['EXECUTE'],
  'authenticated can call is_active_access (the RLS policies need it)');
select function_privs_are('public', 'is_active_access', array['uuid'], 'anon', array[]::text[],
  'anon cannot call is_active_access');
select function_privs_are('public', 'current_clinic_id', array[]::text[], 'authenticated', array['EXECUTE'],
  'authenticated can call current_clinic_id (the veterinarians policy needs it)');
select function_privs_are('public', 'current_clinic_id', array[]::text[], 'anon', array[]::text[],
  'anon cannot call current_clinic_id');
select function_privs_are('public', 'start_access_session', array[]::text[], 'authenticated', array['EXECUTE'],
  'authenticated can start an access session');
select function_privs_are('public', 'start_access_session', array[]::text[], 'anon', array[]::text[],
  'anon cannot start an access session');
select function_privs_are('public', 'touch_access_session', array['uuid'], 'authenticated', array['EXECUTE'],
  'authenticated can touch an access session');
select function_privs_are('public', 'touch_access_session', array['uuid'], 'anon', array[]::text[],
  'anon cannot touch an access session');
select function_privs_are('public', 'revoke_access_session', array['uuid'], 'authenticated', array['EXECUTE'],
  'authenticated can revoke an access session');
select function_privs_are('public', 'revoke_access_session', array['uuid'], 'anon', array[]::text[],
  'anon cannot revoke an access session');
select function_privs_are('public', 'revoke_access_sessions', array[]::text[], 'authenticated', array['EXECUTE'],
  'authenticated can revoke its access sessions');
select function_privs_are('public', 'revoke_access_sessions', array[]::text[], 'anon', array[]::text[],
  'anon cannot revoke access sessions');
select function_privs_are('public', 'approve_clinical_record', array['uuid'], 'authenticated', array['EXECUTE'],
  'authenticated can approve through the server-side path');
select function_privs_are('public', 'approve_clinical_record', array['uuid'], 'anon', array[]::text[],
  'anon cannot approve');

-- ---------------------------------------------------------------------------
-- Internal helpers: only reachable from security-definer functions and triggers.
-- ---------------------------------------------------------------------------

select function_privs_are('public', 'insert_clinical_audit_event',
  array['text', 'uuid', 'text', 'jsonb', 'uuid'], 'authenticated', array[]::text[],
  'the audit trail is not writable through an RPC');
select function_privs_are('public', 'log_server_event',
  array['text', 'text', 'text', 'timestamptz', 'jsonb'], 'authenticated', array[]::text[],
  'server logs are not writable through an RPC');
select function_privs_are('public', 'request_id', array[]::text[], 'authenticated', array[]::text[],
  'request_id is internal');
select function_privs_are('public', 'clinical_record_action',
  array['text', 'text', 'text', 'jsonb'], 'authenticated', array[]::text[],
  'clinical_record_action is internal');

-- ---------------------------------------------------------------------------
-- Supabase lint 0011: invoker functions pin their search_path too.
-- ---------------------------------------------------------------------------

select ok(
  (select proconfig @> array['search_path=public, extensions']
   from pg_proc where oid = 'public.guard_approved_clinical_record()'::regprocedure),
  'guard_approved_clinical_record pins search_path'
);
select ok(
  (select proconfig @> array['search_path=public, extensions']
   from pg_proc where oid = 'public.stamp_update_attribution()'::regprocedure),
  'stamp_update_attribution pins search_path'
);
select ok(
  (select proconfig @> array['search_path=public, extensions']
   from pg_proc where oid = 'public.deny_attribution_mutation()'::regprocedure),
  'deny_attribution_mutation pins search_path'
);
select ok(
  (select proconfig @> array['search_path=public, extensions']
   from pg_proc where oid = 'public.clinical_record_action(text, text, text, jsonb)'::regprocedure),
  'clinical_record_action pins search_path'
);

-- ---------------------------------------------------------------------------
-- Enumerate rather than name one at a time: authenticated can execute exactly
-- the seven functions this migration grants, no others -- this catches a
-- function nobody thought to list above.
-- ---------------------------------------------------------------------------

select set_eq(
  $$select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'EXECUTE')$$,
  $$select unnest(array[
      'public.is_active_access(uuid)',
      'public.current_clinic_id()',
      'public.start_access_session()',
      'public.touch_access_session(uuid)',
      'public.revoke_access_session(uuid)',
      'public.revoke_access_sessions()',
      'public.approve_clinical_record(uuid)'
    ]::regprocedure[])::oid$$,
  'authenticated can execute exactly the seven granted functions, no more'
);

-- ---------------------------------------------------------------------------
-- Functions created from now on start closed.
-- ---------------------------------------------------------------------------

create function public.review_privileges_probe() returns integer language sql as 'select 1';
select function_privs_are('public', 'review_privileges_probe', array[]::text[], 'authenticated', array[]::text[],
  'a new public function is not executable by authenticated by default');
select function_privs_are('public', 'review_privileges_probe', array[]::text[], 'anon', array[]::text[],
  'a new public function is not executable by anon by default');

-- ---------------------------------------------------------------------------
-- Procedures created from now on start closed too (pins the fix for the
-- event-trigger regression: `revoke ... on function` errors on a procedure,
-- so no such trigger must ever subscribe to CREATE PROCEDURE again).
-- ---------------------------------------------------------------------------

create procedure public.review_privileges_probe_proc() language sql as 'select 1';
select function_privs_are('public', 'review_privileges_probe_proc', array[]::text[], 'authenticated', array[]::text[],
  'a new public procedure is not executable by authenticated by default');
select function_privs_are('public', 'review_privileges_probe_proc', array[]::text[], 'anon', array[]::text[],
  'a new public procedure is not executable by anon by default');

-- ---------------------------------------------------------------------------
-- A `create or replace` of an already-granted function must not lose its grant.
-- ---------------------------------------------------------------------------

grant execute on function public.review_privileges_probe() to authenticated;
create or replace function public.review_privileges_probe() returns integer language sql as 'select 1';
select function_privs_are('public', 'review_privileges_probe', array[]::text[], 'authenticated', array['EXECUTE'],
  'a direct grant to authenticated survives a later create or replace of the same function');
select function_privs_are('public', 'review_privileges_probe', array[]::text[], 'anon', array[]::text[],
  'anon still cannot call the replaced function');

-- ---------------------------------------------------------------------------
-- Enumerate rather than name one at a time: no function in public is
-- executable by anon at all, including every probe created above.
-- ---------------------------------------------------------------------------

select is_empty(
  $$select p.oid::regprocedure::text
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'EXECUTE')$$,
  'no function in public is executable by anon'
);

select * from finish();
rollback;
