begin;
select plan(3);

-- Arrange: a synthetic veterinarian provisioned in a dedicated clinic, isolated from seed.sql data.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  '00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111',
  'authenticated', 'authenticated', 'vet.attribution.fixture@example.test',
  'not-a-real-password-hash', timezone('utc', now()),
  '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now())
);

insert into public.clinics (id, name)
values ('22222222-2222-2222-2222-222222222222', 'Clínica de prueba de atribución');

insert into public.veterinarians (id, clinic_id, identifier, display_name)
values (
  '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222',
  'vet.attribution.fixture@example.test', 'Vet Fixture'
);

-- Simulate the authenticated veterinarian's request context so auth.uid() resolves.
-- (Run as the superuser test role, so this exercises the attribution trigger in isolation
-- from row-level security, which is covered separately.)
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

insert into public.clinical_records (id, clinic_id, record_type, content, status)
values (
  '33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222',
  'patient', '{"name":"Luna"}', 'draft'
);

select results_eq(
  $$select created_by from public.clinical_records where id = '33333333-3333-3333-3333-333333333333'::uuid$$,
  $$values ('11111111-1111-1111-1111-111111111111'::uuid)$$,
  'clinical record attribution is derived from the authenticated veterinarian'
);

select throws_ok(
  $$insert into public.clinical_records (clinic_id, record_type, content, status, created_by)
    values ('22222222-2222-2222-2222-222222222222', 'patient', '{"name":"Rex"}', 'draft', '99999999-9999-9999-9999-999999999999')$$,
  '23514',
  'ATTRIBUTION_IMMUTABLE',
  'creating a record with a spoofed created_by is rejected'
);

select throws_ok(
  $$update public.clinical_records set created_by = '99999999-9999-9999-9999-999999999999' where id = '33333333-3333-3333-3333-333333333333'::uuid$$,
  '23514',
  'ATTRIBUTION_IMMUTABLE',
  'attribution of an existing clinical record cannot be modified'
);

select * from finish();
rollback;
