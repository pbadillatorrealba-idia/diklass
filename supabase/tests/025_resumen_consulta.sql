-- Suite pgTap: resumen de la consulta (025_resumen_consulta.sql).
-- Patrón: supabase/tests/011_captura_voz_revision.sql.

begin;
select plan(7);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', 'a2a2a2a2-0000-4000-8000-00000000000a',
   'authenticated', 'authenticated', 'ana.resumen@example.test', 'not-a-real-hash',
   timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now())),
  ('00000000-0000-0000-0000-000000000000', 'd2d2d2d2-0000-4000-8000-00000000000d',
   'authenticated', 'authenticated', 'diana.resumen@example.test', 'not-a-real-hash',
   timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now()));

insert into public.clinics (id, name)
values ('e2e2e2e2-0000-4000-8000-00000000000e', 'Clínica de resúmenes'),
       ('f2f2f2f2-0000-4000-8000-00000000000f', 'Clínica ajena de resúmenes');

insert into public.veterinarians (id, clinic_id, identifier, display_name)
values
  ('a2a2a2a2-0000-4000-8000-00000000000a', 'e2e2e2e2-0000-4000-8000-00000000000e',
   'ana.resumen@example.test', 'Dra. Ana Resumen'),
  ('d2d2d2d2-0000-4000-8000-00000000000d', 'f2f2f2f2-0000-4000-8000-00000000000f',
   'diana.resumen@example.test', 'Dra. Diana Resumen');

insert into public.access_sessions (veterinarian_id, auth_session_id)
values ('a2a2a2a2-0000-4000-8000-00000000000a', '5e5a2200-0000-4000-8000-00000000000a'),
       ('d2d2d2d2-0000-4000-8000-00000000000d', '5e5d2200-0000-4000-8000-00000000000d');

-- ANA registra un resumen de su consulta.
select set_config('request.jwt.claims',
  '{"sub":"a2a2a2a2-0000-4000-8000-00000000000a","role":"authenticated","session_id":"5e5a2200-0000-4000-8000-00000000000a"}',
  true);
set local role authenticated;

select lives_ok(
  $$insert into public.clinical_records (id, clinic_id, record_type, content, status)
    values ('77777777-0000-4000-8000-000000000001', 'e2e2e2e2-0000-4000-8000-00000000000e',
            'consultation_summary',
            '{"consultationId":"33333333-0000-4000-8000-000000000001","text":"Ladra de noche; sin cambios de apetito."}',
            'draft')$$,
  'un veterinario registra el resumen de su consulta'
);

select is(
  (select created_by from public.clinical_records where id = '77777777-0000-4000-8000-000000000001'),
  'a2a2a2a2-0000-4000-8000-00000000000a'::uuid,
  'el autor lo fija el servidor'
);

select is(
  (select count(*)::int from public.clinical_audit_events
    where entity_id = '77777777-0000-4000-8000-000000000001'),
  0,
  'el alta no es una acción enumerada: no escribe evento de auditoría'
);

select throws_ok(
  $$insert into public.clinical_records (clinic_id, record_type, content, status)
    values ('e2e2e2e2-0000-4000-8000-00000000000e', 'consultation_summary',
            '{"consultationId":"33333333-0000-4000-8000-000000000001","text":"   "}', 'draft')$$,
  '23514', null, 'un resumen vacío se rechaza'
);

select throws_ok(
  $$insert into public.clinical_records (clinic_id, record_type, content, status)
    values ('e2e2e2e2-0000-4000-8000-00000000000e', 'consultation_summary',
            '{"consultationId":"no-es-uuid","text":"hola"}', 'draft')$$,
  '23514', null, 'la consulta debe ser un uuid'
);

select throws_ok(
  $$insert into public.clinical_records (clinic_id, record_type, content, status)
    values ('e2e2e2e2-0000-4000-8000-00000000000e', 'inventado', '{}', 'draft')$$,
  '23514', null, 'un tipo de registro desconocido sigue rechazado'
);

-- DIANA, de otra clínica, no lo ve.
select set_config('request.jwt.claims',
  '{"sub":"d2d2d2d2-0000-4000-8000-00000000000d","role":"authenticated","session_id":"5e5d2200-0000-4000-8000-00000000000d"}',
  true);

select is(
  (select count(*)::int from public.clinical_records where record_type = 'consultation_summary'),
  0,
  'otra clínica no ve el resumen'
);

select * from finish();
rollback;
