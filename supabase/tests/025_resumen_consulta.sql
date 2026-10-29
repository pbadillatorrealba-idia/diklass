-- Suite pgTap: resumen de la consulta (025_resumen_consulta.sql).
-- Patrón: supabase/tests/011_captura_voz_revision.sql.

begin;
select plan(14);

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

-- ANA registra un resumen de su consulta (la consulta existe en su clínica).
select set_config('request.jwt.claims',
  '{"sub":"a2a2a2a2-0000-4000-8000-00000000000a","role":"authenticated","session_id":"5e5a2200-0000-4000-8000-00000000000a"}',
  true);
set local role authenticated;

insert into public.clinical_records (id, clinic_id, record_type, content, status)
values ('33333333-0000-4000-8000-000000000001', 'e2e2e2e2-0000-4000-8000-00000000000e',
        'consultation', '{"patientId":"44444444-0000-4000-8000-000000000001","status":"open"}', 'draft');

select lives_ok(
  $$insert into public.clinical_records (id, clinic_id, record_type, content, status)
    values ('77777777-0000-4000-8000-000000000001', 'e2e2e2e2-0000-4000-8000-00000000000e',
            'consultation_summary',
            '{"consultationId":"33333333-0000-4000-8000-000000000001","text":"Ladra de noche; sin cambios de apetito.","provenance":"inferida"}',
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
            '{"consultationId":"33333333-0000-4000-8000-000000000001","text":"  \n ","provenance":"inferida"}', 'draft')$$,
  '23514', null, 'un resumen vacío se rechaza'
);

select throws_ok(
  $$insert into public.clinical_records (clinic_id, record_type, content, status)
    values ('e2e2e2e2-0000-4000-8000-00000000000e', 'consultation_summary',
            '{"consultationId":"no-es-uuid","text":"hola","provenance":"inferida"}', 'draft')$$,
  '23514', null, 'la consulta debe ser un uuid'
);

select throws_ok(
  $$insert into public.clinical_records (clinic_id, record_type, content, status)
    values ('e2e2e2e2-0000-4000-8000-00000000000e', 'inventado', '{}', 'draft')$$,
  '23514', null, 'un tipo de registro desconocido sigue rechazado'
);

select throws_ok(
  $$insert into public.clinical_records (clinic_id, record_type, content, status)
    values ('e2e2e2e2-0000-4000-8000-00000000000e', 'consultation_summary',
            '{"consultationId":"33333333-0000-4000-8000-000000000001","text":"hola"}', 'draft')$$,
  '23514', null, 'sin procedencia «inferida» se rechaza'
);

select throws_ok(
  $$insert into public.clinical_records (clinic_id, record_type, content, status)
    values ('e2e2e2e2-0000-4000-8000-00000000000e', 'consultation_summary',
            '{"consultationId":"33333333-0000-4000-8000-000000000001","text":"hola","provenance":"inferida","extra":1}', 'draft')$$,
  '23514', null, 'una clave extra se rechaza'
);

select throws_ok(
  $$insert into public.clinical_records (clinic_id, record_type, content, status)
    values ('e2e2e2e2-0000-4000-8000-00000000000e', 'consultation_summary',
            '{"consultationId":"99999999-0000-4000-8000-000000000009","text":"hola","provenance":"inferida"}', 'draft')$$,
  '23514', 'CONSULTATION_NOT_FOUND', 'no se resume una consulta inexistente o de otra clínica'
);

select lives_ok(
  $$insert into public.clinical_records (clinic_id, record_type, content, status)
    values ('e2e2e2e2-0000-4000-8000-00000000000e', 'consultation_summary',
            jsonb_build_object('consultationId', '33333333-0000-4000-8000-000000000001',
                               'text', repeat('a', 2000), 'provenance', 'inferida'), 'draft')$$,
  'el límite exacto de 2000 caracteres se acepta'
);

select throws_ok(
  $$insert into public.clinical_records (clinic_id, record_type, content, status)
    values ('e2e2e2e2-0000-4000-8000-00000000000e', 'consultation_summary',
            jsonb_build_object('consultationId', '33333333-0000-4000-8000-000000000001',
                               'text', repeat('a', 2001), 'provenance', 'inferida'), 'draft')$$,
  '23514', null, '2001 caracteres se rechazan'
);

select throws_ok(
  $$update public.clinical_records set content = jsonb_set(content, '{text}', '"reescrito"')
    where id = '77777777-0000-4000-8000-000000000001'$$,
  '23514', 'CONSULTATION_SUMMARY_IMMUTABLE', 'el resumen no se reescribe, ni por su autor'
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

-- DIANA intenta reescribirlo: no lo ve, así que el UPDATE no toca ninguna fila.
update public.clinical_records set content = '{}'::jsonb
where id = '77777777-0000-4000-8000-000000000001';

select set_config('request.jwt.claims',
  '{"sub":"a2a2a2a2-0000-4000-8000-00000000000a","role":"authenticated","session_id":"5e5a2200-0000-4000-8000-00000000000a"}',
  true);

select is(
  (select content ->> 'text' from public.clinical_records where id = '77777777-0000-4000-8000-000000000001'),
  'Ladra de noche; sin cambios de apetito.',
  'otra clínica no pudo reescribirlo'
);

select * from finish();
rollback;
