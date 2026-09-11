begin;
select plan(12);

-- ---------------------------------------------------------------------------
-- Arrange: one clinic, two provisioned veterinarians, isolated from seed.sql.
-- ---------------------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-00000000000a',
   'authenticated', 'authenticated', 'ana.identity@example.test', 'not-a-real-hash',
   timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now())),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-00000000000b',
   'authenticated', 'authenticated', 'bruno.identity@example.test', 'not-a-real-hash',
   timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now()));

insert into public.clinics (id, name)
values ('cccccccc-0000-0000-0000-00000000000c', 'Clínica de prueba de identidad');

insert into public.veterinarians (id, clinic_id, identifier, display_name)
values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'cccccccc-0000-0000-0000-00000000000c',
   'ana.identity@example.test', 'Ana Identidad'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'cccccccc-0000-0000-0000-00000000000c',
   'bruno.identity@example.test', 'Bruno Identidad');

-- auth.uid() must already resolve to Ana: the attribution trigger rejects any insert
-- whose created_by is not the authenticated caller.
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated","session_id":"5e5a0000-0000-0000-0000-00000000000a"}',
  true);

insert into public.clinical_records (id, clinic_id, record_type, content, status)
values ('dddddddd-0000-0000-0000-00000000000d', 'cccccccc-0000-0000-0000-00000000000c',
        'patient', '{"name":"Luna"}', 'draft');

-- ---------------------------------------------------------------------------
-- SC-039 / FR-062: no session at all -> no clinical data.
-- ---------------------------------------------------------------------------

set local role anon;
select is_empty(
  $$select id from public.clinical_records$$,
  'an anonymous caller reads no clinical records'
);
select throws_ok(
  $$insert into public.clinical_records (clinic_id, record_type, content, status)
    values ('cccccccc-0000-0000-0000-00000000000c', 'patient', '{}', 'draft')$$,
  '42501',
  null,
  'an anonymous caller cannot write a clinical record'
);
reset role;

-- ---------------------------------------------------------------------------
-- FR-062: authenticated but with no access session -> still denied.
-- ---------------------------------------------------------------------------

set local role authenticated;
select ok(
  not public.is_active_access('aaaaaaaa-0000-0000-0000-00000000000a'),
  'a veterinarian without an access session is not active'
);
select is_empty(
  $$select id from public.clinical_records$$,
  'a veterinarian without an access session reads no clinical records'
);
reset role;

-- ---------------------------------------------------------------------------
-- FR-059: an active session authorizes the shared clinic.
-- ---------------------------------------------------------------------------

insert into public.access_sessions (id, veterinarian_id, auth_session_id)
values ('eeeeeeee-0000-0000-0000-00000000000e', 'aaaaaaaa-0000-0000-0000-00000000000a',
        '5e5a0000-0000-0000-0000-00000000000a');

set local role authenticated;
select ok(
  public.is_active_access('aaaaaaaa-0000-0000-0000-00000000000a'),
  'a veterinarian with a fresh access session is active'
);
select isnt_empty(
  $$select id from public.clinical_records$$,
  'an active veterinarian reads the shared clinical records'
);
reset role;

-- ---------------------------------------------------------------------------
-- FR-061: revocation and inactivity both end the session, server-side.
-- ---------------------------------------------------------------------------

update public.access_sessions
set revoked_at = timezone('utc', now())
where id = 'eeeeeeee-0000-0000-0000-00000000000e';

set local role authenticated;
select ok(
  not public.is_active_access('aaaaaaaa-0000-0000-0000-00000000000a'),
  'a revoked session no longer authorizes clinical access'
);
reset role;

update public.access_sessions
set revoked_at = null,
    last_activity_at = timezone('utc', now()) - interval '9 hours',
    expires_at = timezone('utc', now()) - interval '1 hour'
where id = 'eeeeeeee-0000-0000-0000-00000000000e';

set local role authenticated;
select ok(
  not public.is_active_access('aaaaaaaa-0000-0000-0000-00000000000a'),
  'a session idle for more than eight hours no longer authorizes clinical access'
);
select is(
  public.touch_access_session('eeeeeeee-0000-0000-0000-00000000000e'),
  false,
  'an inactivity-expired session cannot be revived by touching it'
);
reset role;

-- ---------------------------------------------------------------------------
-- T072: is_active_access must not answer for a peer.
-- ---------------------------------------------------------------------------

insert into public.access_sessions (veterinarian_id, auth_session_id)
values ('bbbbbbbb-0000-0000-0000-00000000000b', '5e5b0000-0000-0000-0000-00000000000b');

set local role authenticated;
select ok(
  not public.is_active_access('bbbbbbbb-0000-0000-0000-00000000000b'),
  'a veterinarian cannot probe whether a colleague currently has a live session'
);
reset role;

-- ---------------------------------------------------------------------------
-- FR-063 / data-model: the audit trail is append-only for authenticated users.
-- ---------------------------------------------------------------------------

set local role authenticated;
select throws_ok(
  $$update public.clinical_audit_events set action = 'patient_updated'$$,
  '42501',
  null,
  'an authenticated veterinarian cannot update an audit event'
);
select throws_ok(
  $$delete from public.clinical_audit_events$$,
  '42501',
  null,
  'an authenticated veterinarian cannot delete an audit event'
);
reset role;

select * from finish();
rollback;
