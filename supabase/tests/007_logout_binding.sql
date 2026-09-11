begin;
select plan(10);

-- Critical (whole-branch review): logout must actually end clinical access. Verified live
-- before this migration: after revoke_current_access_session() + signOut, replaying the
-- still-valid JWT and calling start_access_session() succeeded and restored full clinical
-- access. 008 records *why* a row was revoked and refuses to start a fresh session for an
-- Auth session that was ever logged out.

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', 'a7a7a7a7-0000-0000-0000-0000000000a7',
   'authenticated', 'authenticated', 'ana.logout@example.test', 'not-a-real-hash',
   timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now()));

insert into public.clinics (id, name)
values ('c7c7c7c7-0000-0000-0000-0000000000c7', 'Clínica de prueba de logout');

insert into public.veterinarians (id, clinic_id, identifier, display_name)
values ('a7a7a7a7-0000-0000-0000-0000000000a7', 'c7c7c7c7-0000-0000-0000-0000000000c7',
        'ana.logout@example.test', 'Ana Logout');

-- ---------------------------------------------------------------------------
-- Device 1 signs in, then logs out.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub":"a7a7a7a7-0000-0000-0000-0000000000a7","role":"authenticated","session_id":"5e710000-0000-0000-0000-000000000001"}',
  true);
set local role authenticated;
select lives_ok($$select public.start_access_session()$$, 'device 1 starts an access session');
select lives_ok($$select public.revoke_current_access_session()$$, 'device 1 logs out');
reset role;

select is(
  (select revoked_reason from public.access_sessions
   where auth_session_id = '5e710000-0000-0000-0000-000000000001'),
  'logout',
  'logging out records revoked_reason = logout'
);

-- ---------------------------------------------------------------------------
-- Replaying device 1's still-valid JWT cannot re-arm clinical access.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub":"a7a7a7a7-0000-0000-0000-0000000000a7","role":"authenticated","session_id":"5e710000-0000-0000-0000-000000000001"}',
  true);
set local role authenticated;
select throws_ok(
  $$select public.start_access_session()$$,
  '42501',
  'AUTHENTICATION_REQUIRED',
  'replaying a logged-out Auth session cannot start a fresh access session'
);
select ok(
  not public.is_active_access(),
  'device 1 still has no clinical access after the refused restart'
);
reset role;

select is(
  (select count(*)::int from public.access_sessions
   where auth_session_id = '5e710000-0000-0000-0000-000000000001' and revoked_at is null),
  0,
  'the refused restart left no live row for the logged-out Auth session'
);

-- ---------------------------------------------------------------------------
-- A DIFFERENT Auth session of the same veterinarian (another device, D1) is unaffected.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub":"a7a7a7a7-0000-0000-0000-0000000000a7","role":"authenticated","session_id":"5e720000-0000-0000-0000-000000000002"}',
  true);
set local role authenticated;
select lives_ok($$select public.start_access_session()$$,
  'a different Auth session of the same veterinarian starts normally');
select ok(public.is_active_access(), 'the other device has clinical access');

-- A plain retried start (no logout) on this never-logged-out Auth session still succeeds,
-- superseding its own previous row with reason 'replaced', never 'logout'.
select lives_ok($$select public.start_access_session()$$,
  'a plain retried start on a never-logged-out Auth session still succeeds');
reset role;

select is(
  (select count(*)::int from public.access_sessions
   where auth_session_id = '5e720000-0000-0000-0000-000000000002' and revoked_at is null),
  1,
  'the retry leaves exactly one live row for that Auth session'
);

select * from finish();
rollback;
