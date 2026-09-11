begin;
select plan(15);

-- Arrange: one veterinarian who signs in on two devices, i.e. two Supabase Auth sessions.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', 'a5a5a5a5-0000-0000-0000-0000000000a5',
   'authenticated', 'authenticated', 'ana.binding@example.test', 'not-a-real-hash',
   timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now()));

insert into public.clinics (id, name)
values ('c5c5c5c5-0000-0000-0000-0000000000c5', 'Clínica de prueba de sesiones');

insert into public.veterinarians (id, clinic_id, identifier, display_name)
values ('a5a5a5a5-0000-0000-0000-0000000000a5', 'c5c5c5c5-0000-0000-0000-0000000000c5',
        'ana.binding@example.test', 'Ana Sesiones');

-- ---------------------------------------------------------------------------
-- Device 1 signs in.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub":"a5a5a5a5-0000-0000-0000-0000000000a5","role":"authenticated","session_id":"5e510000-0000-0000-0000-000000000001"}',
  true);
set local role authenticated;
select lives_ok($$select public.start_access_session()$$,
  'device 1 starts an access session bound to its Auth session');
select ok(public.is_active_access(), 'device 1 has clinical access');
select ok(public.current_access_session() is not null, 'device 1 can resume its own access session');
reset role;

-- ---------------------------------------------------------------------------
-- Device 2 signs in (D1: several devices at once).
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub":"a5a5a5a5-0000-0000-0000-0000000000a5","role":"authenticated","session_id":"5e520000-0000-0000-0000-000000000002"}',
  true);
set local role authenticated;
select lives_ok($$select public.start_access_session()$$, 'device 2 starts its own access session');
select ok(public.is_active_access(), 'device 2 has clinical access');
-- Starting again within the same Auth session (a retried start) replaces only that one.
select lives_ok($$select public.start_access_session()$$,
  'device 2 can start again within the same Auth session');
select is(
  (select count(*)::int from public.access_sessions
   where auth_session_id = '5e520000-0000-0000-0000-000000000002' and revoked_at is null),
  1,
  'an Auth session never holds two live access sessions'
);
reset role;

-- ---------------------------------------------------------------------------
-- Back on device 1: still active, and bound to its own access session only.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub":"a5a5a5a5-0000-0000-0000-0000000000a5","role":"authenticated","session_id":"5e510000-0000-0000-0000-000000000001"}',
  true);
set local role authenticated;
select ok(public.is_active_access(), 'device 1 keeps clinical access while device 2 is signed in');
select is(
  public.current_access_session() ->> 'id',
  (select id::text from public.access_sessions
   where auth_session_id = '5e510000-0000-0000-0000-000000000001' and revoked_at is null),
  'device 1 resumes its own access session, never device 2''s'
);
select is(
  public.touch_access_session(
    (select id from public.access_sessions
     where auth_session_id = '5e520000-0000-0000-0000-000000000002' and revoked_at is null)
  ),
  false,
  'device 1 cannot keep device 2''s access session alive'
);

-- Device 1 logs out: only its own access session ends.
select lives_ok($$select public.revoke_current_access_session()$$, 'device 1 logs out');
select ok(not public.is_active_access(), 'device 1 lost clinical access after its own logout');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"a5a5a5a5-0000-0000-0000-0000000000a5","role":"authenticated","session_id":"5e520000-0000-0000-0000-000000000002"}',
  true);
set local role authenticated;
select ok(public.is_active_access(), 'device 2 keeps clinical access after device 1 logs out');
reset role;

-- ---------------------------------------------------------------------------
-- A token without an Auth session_id cannot start an access session.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub":"a5a5a5a5-0000-0000-0000-0000000000a5","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select public.start_access_session()$$, '42501', 'AUTHENTICATION_REQUIRED',
  'a token without an Auth session_id cannot start an access session');
reset role;

select function_privs_are('public', 'current_auth_session_id', array[]::text[], 'authenticated',
  array[]::text[], 'current_auth_session_id is internal');

select * from finish();
rollback;
