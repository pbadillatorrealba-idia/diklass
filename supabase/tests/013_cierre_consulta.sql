-- Suite pgTap: una consulta solo se cierra aprobando su epicrisis.
--
-- Cambio: openspec/changes/implementar-registro-clinico-longitudinal (tasks.md 7.10).
-- SC-014 exige que toda consulta cerrada tenga su epicrisis aprobada, y D4 hace del cierre
-- una consecuencia de approve_clinical_record. Hasta la 013 un UPDATE directo por PostgREST
-- (o un INSERT) podía dejar una consulta 'closed' sin epicrisis. Patrón:
-- supabase/tests/008_registro_clinico.sql.

begin;
select plan(8);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', 'a13a13a1-0000-4000-8000-00000000000a',
   'authenticated', 'authenticated', 'ana.cierre@example.test', 'not-a-real-hash',
   timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now()));

insert into public.clinics (id, name)
values ('c13c13c1-0000-4000-8000-00000000000c', 'Clínica de prueba del cierre de consulta');

insert into public.veterinarians (id, clinic_id, identifier, display_name)
values ('a13a13a1-0000-4000-8000-00000000000a', 'c13c13c1-0000-4000-8000-00000000000c',
        'ana.cierre@example.test', 'Dra. Ana Cierre');

insert into public.access_sessions (veterinarian_id, auth_session_id)
values ('a13a13a1-0000-4000-8000-00000000000a', '5e13a000-0000-4000-8000-00000000000a');

select set_config('request.jwt.claims',
  '{"sub":"a13a13a1-0000-4000-8000-00000000000a","role":"authenticated","session_id":"5e13a000-0000-4000-8000-00000000000a"}',
  true);
set local role authenticated;

insert into public.clinical_records (id, clinic_id, record_type, content, status)
values
  ('d13d13d1-0000-4000-8000-000000000001', 'c13c13c1-0000-4000-8000-00000000000c',
   'consultation', '{"patientId":"d13d13d1-0000-4000-8000-0000000000aa","status":"open"}', 'draft'),
  ('d13d13d1-0000-4000-8000-000000000002', 'c13c13c1-0000-4000-8000-00000000000c',
   'epicrisis', '{"consultationId":"d13d13d1-0000-4000-8000-000000000001","motivoConsulta":"Control"}',
   'draft');

-- SC-014: una consulta no nace cerrada.
select throws_ok(
  $$insert into public.clinical_records (clinic_id, record_type, content, status)
    values ('c13c13c1-0000-4000-8000-00000000000c', 'consultation',
      '{"patientId":"d13d13d1-0000-4000-8000-0000000000aa","status":"closed"}', 'draft')$$,
  '23514', 'CONSULTATION_CLOSE_REQUIRES_APPROVAL',
  'SC-014: una consulta no puede nacer cerrada'
);

-- SC-014: un UPDATE directo no la cierra si su epicrisis sigue en borrador.
select throws_ok(
  $$update public.clinical_records set content = content || '{"status":"closed"}'
    where id = 'd13d13d1-0000-4000-8000-000000000001'$$,
  '23514', 'CONSULTATION_CLOSE_REQUIRES_APPROVAL',
  'SC-014: un UPDATE directo no cierra una consulta con la epicrisis en borrador'
);

-- El estado de la consulta pertenece al vocabulario {open, closed}.
select throws_ok(
  $$insert into public.clinical_records (clinic_id, record_type, content, status)
    values ('c13c13c1-0000-4000-8000-00000000000c', 'consultation',
      '{"patientId":"d13d13d1-0000-4000-8000-0000000000aa","status":"cancelada"}', 'draft')$$,
  '23514', 'CONSULTATION_STATUS_INVALID',
  'Una consulta no nace con un estado fuera de {open, closed}'
);

select throws_ok(
  $$update public.clinical_records set content = content - 'status'
    where id = 'd13d13d1-0000-4000-8000-000000000001'$$,
  '23514', 'CONSULTATION_STATUS_INVALID',
  'Una consulta abierta no pierde su estado'
);

-- Los demás datos de una consulta abierta siguen editables.
select lives_ok(
  $$update public.clinical_records
    set content = content || '{"patientId":"d13d13d1-0000-4000-8000-0000000000bb"}'
    where id = 'd13d13d1-0000-4000-8000-000000000001'$$,
  'Una consulta abierta sigue editable sin cambiar su estado'
);

-- D4 · SC-014: la aprobación de la epicrisis sí cierra la consulta.
select lives_ok(
  $$select public.approve_clinical_record('d13d13d1-0000-4000-8000-000000000002')$$,
  'D4: aprobar la epicrisis vive'
);

select results_eq(
  $$select content ->> 'status' from public.clinical_records
    where id = 'd13d13d1-0000-4000-8000-000000000001'$$,
  $$values ('closed'::text)$$,
  'D4 · SC-014: aprobar la epicrisis cierra su consulta'
);

-- Una consulta abierta con otra epicrisis aprobada ajena no se cierra por UPDATE: la
-- epicrisis aprobada tiene que ser de ESTA consulta.
insert into public.clinical_records (id, clinic_id, record_type, content, status)
values ('d13d13d1-0000-4000-8000-000000000003', 'c13c13c1-0000-4000-8000-00000000000c',
        'consultation', '{"patientId":"d13d13d1-0000-4000-8000-0000000000aa","status":"open"}', 'draft');

select throws_ok(
  $$update public.clinical_records set content = content || '{"status":"closed"}'
    where id = 'd13d13d1-0000-4000-8000-000000000003'$$,
  '23514', 'CONSULTATION_CLOSE_REQUIRES_APPROVAL',
  'SC-014: la epicrisis aprobada de otra consulta no habilita el cierre'
);

reset role;

select * from finish();
rollback;
