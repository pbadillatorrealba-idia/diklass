-- Suite pgTap: endurecimiento tras la auditoría del backend (migración 028).
-- Patrón: supabase/tests/008_registro_clinico.sql (dos veterinarios de una clínica con sesión de
-- acceso activa, claims con `set_config` y `set local role authenticated`), más una tercera de otra clínica.
-- No cubre el candado del logout (028): una carrera entre dos transacciones no se puede reproducir en
-- un solo script; el comportamiento normal del logout lo cubre 007_logout_binding.sql.

begin;
select plan(14);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', 'a2a2a2a2-0000-4000-8000-00000000000a',
   'authenticated', 'authenticated', 'ana.auditoria@example.test', 'not-a-real-hash',
   timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now())),
  ('00000000-0000-0000-0000-000000000000', 'b2b2b2b2-0000-4000-8000-00000000000b',
   'authenticated', 'authenticated', 'bruno.auditoria@example.test', 'not-a-real-hash',
   timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now())),
  ('00000000-0000-0000-0000-000000000000', 'c2c2c2c2-0000-4000-8000-00000000000c',
   'authenticated', 'authenticated', 'carla.auditoria@example.test', 'not-a-real-hash',
   timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now()));

insert into public.clinics (id, name)
values ('e2e2e2e2-0000-4000-8000-00000000000a', 'Clínica A de auditoría'),
       ('e2e2e2e2-0000-4000-8000-00000000000b', 'Clínica B de auditoría');

insert into public.veterinarians (id, clinic_id, identifier, display_name)
values
  ('a2a2a2a2-0000-4000-8000-00000000000a', 'e2e2e2e2-0000-4000-8000-00000000000a',
   'ana.auditoria@example.test', 'Dra. Ana Auditoría'),
  ('b2b2b2b2-0000-4000-8000-00000000000b', 'e2e2e2e2-0000-4000-8000-00000000000a',
   'bruno.auditoria@example.test', 'Dr. Bruno Auditoría'),
  ('c2c2c2c2-0000-4000-8000-00000000000c', 'e2e2e2e2-0000-4000-8000-00000000000b',
   'carla.auditoria@example.test', 'Dra. Carla Auditoría');

insert into public.access_sessions (veterinarian_id, auth_session_id)
values ('a2a2a2a2-0000-4000-8000-00000000000a', '5e2a2000-0000-4000-8000-00000000000a'),
       ('b2b2b2b2-0000-4000-8000-00000000000b', '5e2b2000-0000-4000-8000-00000000000b'),
       ('c2c2c2c2-0000-4000-8000-00000000000c', '5e2c2000-0000-4000-8000-00000000000c');

-- ---------------------------------------------------------------------------
-- Ana (clínica A) registra una ficha y abre la consulta; el trigger deja eventos de auditoría.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub":"a2a2a2a2-0000-4000-8000-00000000000a","role":"authenticated","session_id":"5e2a2000-0000-4000-8000-00000000000a"}',
  true);
set local role authenticated;

insert into public.clinical_records (id, clinic_id, record_type, content, status)
values ('d2d2d2d2-0000-4000-8000-000000000001', 'e2e2e2e2-0000-4000-8000-00000000000a', 'patient',
  '{"name":"Luna","species":"canino","breed":"Mestizo","sex":"hembra","reproductiveStatus":"entero","tutorId":"t"}',
  'draft');

select isnt_empty(
  $$select id from public.clinical_audit_events where entity_id = 'd2d2d2d2-0000-4000-8000-000000000001'$$,
  'la autora lee los eventos de auditoría de su clínica'
);

-- ---------------------------------------------------------------------------
-- Auditoría: solo dentro de la propia clínica.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub":"b2b2b2b2-0000-4000-8000-00000000000b","role":"authenticated","session_id":"5e2b2000-0000-4000-8000-00000000000b"}',
  true);
select isnt_empty(
  $$select id from public.clinical_audit_events where entity_id = 'd2d2d2d2-0000-4000-8000-000000000001'$$,
  'una colega de la misma clínica lee los eventos de auditoría'
);

select set_config('request.jwt.claims',
  '{"sub":"c2c2c2c2-0000-4000-8000-00000000000c","role":"authenticated","session_id":"5e2c2000-0000-4000-8000-00000000000c"}',
  true);
select is_empty(
  $$select id from public.clinical_audit_events$$,
  'una veterinaria de otra clínica no lee ningún evento de auditoría ajeno'
);

-- ---------------------------------------------------------------------------
-- Sello: un borrador suelto no puede vincularse después a una consulta cerrada.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub":"a2a2a2a2-0000-4000-8000-00000000000a","role":"authenticated","session_id":"5e2a2000-0000-4000-8000-00000000000a"}',
  true);

insert into public.clinical_records (id, clinic_id, record_type, content, status)
values
  ('d2d2d2d2-0000-4000-8000-000000000002', 'e2e2e2e2-0000-4000-8000-00000000000a', 'consultation',
   '{"patientId":"d2d2d2d2-0000-4000-8000-000000000001","status":"open"}', 'draft'),
  ('d2d2d2d2-0000-4000-8000-000000000003', 'e2e2e2e2-0000-4000-8000-00000000000a', 'anamnesis',
   '{"field":"motivo_consulta","text":"Suelto","provenance":"reportada"}', 'draft'),
  ('d2d2d2d2-0000-4000-8000-000000000004', 'e2e2e2e2-0000-4000-8000-00000000000a', 'anamnesis',
   '{"field":"motivo_consulta","text":"Suelto 2","provenance":"reportada"}', 'draft'),
  ('d2d2d2d2-0000-4000-8000-000000000005', 'e2e2e2e2-0000-4000-8000-00000000000a', 'epicrisis',
   '{"consultationId":"d2d2d2d2-0000-4000-8000-000000000002","motivoConsulta":"Prueba","antecedentesRelevantes":"Ninguno","hallazgosAnamnesis":"Ninguno","hipotesis":[],"diagnostico":"Prueba","examenesSolicitados":[],"intervencionesPropuestas":[],"medicamentosAprobados":[],"recomendacionesTutor":"Ninguna","planSeguimiento":{"pendientes":[]},"observaciones":""}',
   'draft');

select set_config('request.jwt.claims',
  '{"sub":"b2b2b2b2-0000-4000-8000-00000000000b","role":"authenticated","session_id":"5e2b2000-0000-4000-8000-00000000000b"}',
  true);
select lives_ok(
  $$select public.approve_clinical_record('d2d2d2d2-0000-4000-8000-000000000005')$$,
  'la epicrisis se aprueba y cierra la consulta'
);

select set_config('request.jwt.claims',
  '{"sub":"a2a2a2a2-0000-4000-8000-00000000000a","role":"authenticated","session_id":"5e2a2000-0000-4000-8000-00000000000a"}',
  true);

select throws_ok(
  $$update public.clinical_records
    set content = content || '{"consultationId":"d2d2d2d2-0000-4000-8000-000000000002"}'
    where id = 'd2d2d2d2-0000-4000-8000-000000000003'$$,
  '23514',
  'CLINICAL_RECORD_SEALED',
  'un borrador suelto no se vincula a una consulta cerrada por UPDATE'
);

select lives_ok(
  $$update public.clinical_records
    set content = content || '{"consultationId":"d2d2d2d2-0000-4000-8000-0000000000ff"}'
    where id = 'd2d2d2d2-0000-4000-8000-000000000004'$$,
  'vincular a un id sin consulta (huérfano, D1) sigue tolerado'
);

-- ---------------------------------------------------------------------------
-- Cierre: fijar el flag desde una sesión de cliente no cierra la consulta sin aprobación.
-- ---------------------------------------------------------------------------

insert into public.clinical_records (id, clinic_id, record_type, content, status)
values ('d2d2d2d2-0000-4000-8000-000000000006', 'e2e2e2e2-0000-4000-8000-00000000000a', 'consultation',
        '{"patientId":"d2d2d2d2-0000-4000-8000-000000000001","status":"open"}', 'draft');

select set_config('diklass.closing_consultation', 'd2d2d2d2-0000-4000-8000-000000000006', true);
select throws_ok(
  $$update public.clinical_records
    set content = content || '{"status":"closed"}'
    where id = 'd2d2d2d2-0000-4000-8000-000000000006'$$,
  '23514',
  'CONSULTATION_CLOSE_REQUIRES_APPROVAL',
  'el flag fijado por el cliente no cierra una consulta sin aprobar la epicrisis'
);

-- ---------------------------------------------------------------------------
-- RUT: sin cero inicial (comparte dígito verificador con el RUT sin él).
-- ---------------------------------------------------------------------------

select ok(public.rut_is_valid('1234567-4'), 'un RUT de 7 dígitos sin cero inicial es válido');
select ok(not public.rut_is_valid('01234567-4'), 'el mismo RUT con un cero inicial no es válido');
select ok(public.rut_is_valid('12345678-5'), 'un RUT de 8 dígitos sigue siendo válido');

-- ---------------------------------------------------------------------------
-- knowledge_queries: el servidor sella el autor y el momento.
-- ---------------------------------------------------------------------------

insert into public.knowledge_queries (clinic_id, question, answer, created_at, created_by)
values ('e2e2e2e2-0000-4000-8000-00000000000a', '¿Qué dosis?',
        '{"pregunta":"¿Qué dosis?","segmentos":[],"cobertura":"sin_evidencia","avisos":[]}',
        '2020-01-01T00:00:00Z', 'b2b2b2b2-0000-4000-8000-00000000000b');

select is(
  (select created_by from public.knowledge_queries where question = '¿Qué dosis?'),
  'a2a2a2a2-0000-4000-8000-00000000000a'::uuid,
  'knowledge_queries registra a quien consultó, aunque el cliente declare a otro'
);

reset role;
select cmp_ok(
  (select created_at from public.knowledge_queries where question = '¿Qué dosis?'),
  '>',
  now() - interval '1 minute',
  'knowledge_queries ignora un created_at retroactivo del cliente'
);

select has_index('public', 'access_sessions', 'access_sessions_auth_session_idx',
  'access_sessions se busca por auth_session_id sin recorrer la tabla');

select has_index('public', 'transcript_segments', 'transcript_segments_audio_path_idx',
  'las políticas de storage buscan el audio del tramo por su ruta sin recorrer la tabla');

select * from finish();
rollback;
