begin;
select plan(15);

-- ---------------------------------------------------------------------------
-- Arrange: two veterinarians of one clinic, both with a live access session.
-- ---------------------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', 'a2a2a2a2-0000-0000-0000-0000000000a2',
   'authenticated', 'authenticated', 'ana.attribution@example.test', 'not-a-real-hash',
   timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now())),
  ('00000000-0000-0000-0000-000000000000', 'b2b2b2b2-0000-0000-0000-0000000000b2',
   'authenticated', 'authenticated', 'bruno.attribution@example.test', 'not-a-real-hash',
   timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now()));

insert into public.clinics (id, name)
values ('c2c2c2c2-0000-0000-0000-0000000000c2', 'Clínica de prueba de atribución compartida');

insert into public.veterinarians (id, clinic_id, identifier, display_name)
values
  ('a2a2a2a2-0000-0000-0000-0000000000a2', 'c2c2c2c2-0000-0000-0000-0000000000c2',
   'ana.attribution@example.test', 'Dra. Ana Compartida'),
  ('b2b2b2b2-0000-0000-0000-0000000000b2', 'c2c2c2c2-0000-0000-0000-0000000000c2',
   'bruno.attribution@example.test', 'Dr. Bruno Compartido');

insert into public.access_sessions (veterinarian_id)
values ('a2a2a2a2-0000-0000-0000-0000000000a2'), ('b2b2b2b2-0000-0000-0000-0000000000b2');

-- Ana registers a patient and drafts an epicrisis.
select set_config('request.jwt.claim.sub', 'a2a2a2a2-0000-0000-0000-0000000000a2', true);
set local role authenticated;

insert into public.clinical_records (id, clinic_id, record_type, content, status)
values
  ('d2d2d2d2-0000-0000-0000-0000000000d1', 'c2c2c2c2-0000-0000-0000-0000000000c2',
   'patient', '{"name":"Luna"}', 'draft'),
  ('d2d2d2d2-0000-0000-0000-0000000000d2', 'c2c2c2c2-0000-0000-0000-0000000000c2',
   'epicrisis', '{"summary":"borrador"}', 'draft');

-- ---------------------------------------------------------------------------
-- T060: the audit trail speaks only the taxative vocabulary of FR-063.
-- ---------------------------------------------------------------------------

select results_eq(
  $$select action, actor_id from public.clinical_audit_events
    where entity_id = 'd2d2d2d2-0000-0000-0000-0000000000d1'$$,
  $$values ('patient_created'::text, 'a2a2a2a2-0000-0000-0000-0000000000a2'::uuid)$$,
  'registering a patient emits patient_created attributed to its author'
);

-- ---------------------------------------------------------------------------
-- T053 / FR-064 / SC-042: approval columns are never accepted on INSERT.
-- ---------------------------------------------------------------------------

select throws_ok(
  $$insert into public.clinical_records (clinic_id, record_type, content, status, approved_by, approved_at)
    values ('c2c2c2c2-0000-0000-0000-0000000000c2', 'epicrisis', '{}', 'draft',
            'b2b2b2b2-0000-0000-0000-0000000000b2', timezone('utc', now()))$$,
  '42501',
  'permission denied for table clinical_records',
  'a veterinarian cannot insert a record naming a colleague as its approver'
);

select throws_ok(
  $$insert into public.clinical_records (clinic_id, record_type, content, status)
    values ('c2c2c2c2-0000-0000-0000-0000000000c2', 'epicrisis', '{}', 'approved')$$,
  '23514',
  'ATTRIBUTION_IMMUTABLE',
  'a record cannot be born already approved'
);

-- ---------------------------------------------------------------------------
-- T068: the audit trail is not writable through a client RPC.
-- ---------------------------------------------------------------------------

select throws_ok(
  $$select public.insert_clinical_audit_event(
      'epicrisis', 'd2d2d2d2-0000-0000-0000-0000000000d2', 'epicrisis_approved')$$,
  '42501',
  null,
  'an authenticated veterinarian cannot forge an audit event'
);

reset role;

-- ---------------------------------------------------------------------------
-- FR-066 / T055 / T056: Bruno attends a patient Ana registered.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', 'b2b2b2b2-0000-0000-0000-0000000000b2', true);
set local role authenticated;

select results_eq(
  $$select created_by from public.clinical_records where id = 'd2d2d2d2-0000-0000-0000-0000000000d1'$$,
  $$values ('a2a2a2a2-0000-0000-0000-0000000000a2'::uuid)$$,
  'a colleague reads a patient registered by another veterinarian'
);

select results_eq(
  $$select display_name from public.veterinarians where id = 'a2a2a2a2-0000-0000-0000-0000000000a2'$$,
  $$values ('Dra. Ana Compartida'::text)$$,
  'a colleague can read the identity an attribution points to'
);

select lives_ok(
  $$update public.clinical_records set content = '{"name":"Luna","weightKg":12}'
    where id = 'd2d2d2d2-0000-0000-0000-0000000000d1'$$,
  'a colleague can update a shared draft record'
);

select results_eq(
  $$select created_by, updated_by from public.clinical_records
    where id = 'd2d2d2d2-0000-0000-0000-0000000000d1'$$,
  $$values ('a2a2a2a2-0000-0000-0000-0000000000a2'::uuid, 'b2b2b2b2-0000-0000-0000-0000000000b2'::uuid)$$,
  'the update is stamped with the colleague while the original author is preserved'
);

select throws_ok(
  $$update public.clinical_records set approved_by = 'b2b2b2b2-0000-0000-0000-0000000000b2'
    where id = 'd2d2d2d2-0000-0000-0000-0000000000d2'$$,
  '42501',
  'permission denied for table clinical_records',
  'approval columns cannot be written by a plain UPDATE'
);

-- ---------------------------------------------------------------------------
-- T054 / US12-AC3: approval goes through the server and names the session user.
-- ---------------------------------------------------------------------------

select lives_ok(
  $$select public.approve_clinical_record('d2d2d2d2-0000-0000-0000-0000000000d2')$$,
  'a colleague approves the epicrisis through the server-side approval path'
);

select results_eq(
  $$select created_by, approved_by from public.clinical_records
    where id = 'd2d2d2d2-0000-0000-0000-0000000000d2'$$,
  $$values ('a2a2a2a2-0000-0000-0000-0000000000a2'::uuid, 'b2b2b2b2-0000-0000-0000-0000000000b2'::uuid)$$,
  'the approver is derived from the session, the author is untouched'
);

select results_eq(
  $$select actor_id from public.clinical_audit_events
    where entity_id = 'd2d2d2d2-0000-0000-0000-0000000000d2' and action = 'epicrisis_approved'$$,
  $$values ('b2b2b2b2-0000-0000-0000-0000000000b2'::uuid)$$,
  'approval emits epicrisis_approved attributed to the approver'
);

select throws_ok(
  $$select public.approve_clinical_record('d2d2d2d2-0000-0000-0000-0000000000d2')$$,
  '23514',
  'APPROVED_RECORD_IMMUTABLE',
  'an approved record cannot be approved again'
);

select throws_ok(
  $$select public.approve_clinical_record('d2d2d2d2-0000-0000-0000-0000000000d1')$$,
  '22023',
  'INVALID_INPUT',
  'only an epicrisis is approvable, keeping the audit action truthful'
);

reset role;

-- ---------------------------------------------------------------------------
-- T060: the schema itself refuses an out-of-enumeration action.
-- ---------------------------------------------------------------------------

select throws_ok(
  $$insert into public.clinical_audit_events (entity_type, entity_id, action, actor_id)
    values ('patient', 'd2d2d2d2-0000-0000-0000-0000000000d1', 'clinical_record_updated',
            'a2a2a2a2-0000-0000-0000-0000000000a2')$$,
  '23514',
  null,
  'an audit action outside the FR-063 enumeration is rejected by the schema'
);

select * from finish();
rollback;
