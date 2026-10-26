-- Suite pgTap: búsqueda, filtro y orden de pacientes en el servidor (RPC `search_patients`).
-- Patrón: supabase/tests/014_perfil_profesional.sql.

begin;
select plan(11);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', 'a15a15a1-0000-4000-8000-00000000000a',
   'authenticated', 'authenticated', 'ana.busqueda@example.test', 'not-a-real-hash',
   timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now())),
  ('00000000-0000-0000-0000-000000000000', 'b15b15b1-0000-4000-8000-00000000000b',
   'authenticated', 'authenticated', 'otra.busqueda@example.test', 'not-a-real-hash',
   timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now()));

insert into public.clinics (id, name) values
  ('c15c15c1-0000-4000-8000-00000000000c', 'Clínica de la búsqueda'),
  ('d15d15d1-0000-4000-8000-00000000000d', 'Otra clínica');

insert into public.veterinarians (id, clinic_id, identifier, display_name) values
  ('a15a15a1-0000-4000-8000-00000000000a', 'c15c15c1-0000-4000-8000-00000000000c',
   'ana.busqueda@example.test', 'Dra. Ana'),
  ('b15b15b1-0000-4000-8000-00000000000b', 'd15d15d1-0000-4000-8000-00000000000d',
   'otra.busqueda@example.test', 'Dra. Otra');

insert into public.access_sessions (veterinarian_id, auth_session_id) values
  ('a15a15a1-0000-4000-8000-00000000000a', '5e15a000-0000-4000-8000-00000000000a'),
  ('b15b15b1-0000-4000-8000-00000000000b', '5e15b000-0000-4000-8000-00000000000b');

-- Fixtures como propietario de la tabla, antes de asumir el rol `authenticated`. Sin triggers
-- (`replica`) para fijar `created_at` y `created_by`, que de otro modo son inmutables.
set local session_replication_role = replica;
-- Luna (Labrador, 2 consultas), Rocky (Beagle, 1 consulta), Nube (sin consultas, tutora 50%),
-- y un paciente de otra clínica que nunca debe aparecer.
insert into public.clinical_records (id, clinic_id, record_type, content, status, created_by) values
  ('e1500000-0000-4000-8000-000000000001', 'c15c15c1-0000-4000-8000-00000000000c', 'tutor',
   '{"name":"Marta Soto","rut":"11111111-1","phone":"111"}', 'draft', 'a15a15a1-0000-4000-8000-00000000000a'),
  ('e1500000-0000-4000-8000-000000000002', 'c15c15c1-0000-4000-8000-00000000000c', 'tutor',
   '{"name":"50%","surname":"Perez","rut":"12345678-5","phone":"222"}', 'draft', 'a15a15a1-0000-4000-8000-00000000000a'),
  ('f1500000-0000-4000-8000-000000000001', 'c15c15c1-0000-4000-8000-00000000000c', 'patient',
   '{"name":"Luna","species":"canino","sex":"macho","reproductiveStatus":"entero","breed":"Labrador","tutorId":"e1500000-0000-4000-8000-000000000001"}',
   'draft', 'a15a15a1-0000-4000-8000-00000000000a'),
  ('f1500000-0000-4000-8000-000000000002', 'c15c15c1-0000-4000-8000-00000000000c', 'patient',
   '{"name":"Rocky","species":"canino","sex":"macho","reproductiveStatus":"entero","breed":"Beagle","tutorId":"e1500000-0000-4000-8000-000000000001"}',
   'draft', 'a15a15a1-0000-4000-8000-00000000000a'),
  ('f1500000-0000-4000-8000-000000000003', 'c15c15c1-0000-4000-8000-00000000000c', 'patient',
   '{"name":"Nube","species":"felino","sex":"hembra","reproductiveStatus":"entero","breed":"Siames","tutorId":"e1500000-0000-4000-8000-000000000002"}',
   'draft', 'a15a15a1-0000-4000-8000-00000000000a'),
  ('f1500000-0000-4000-8000-000000000004', 'd15d15d1-0000-4000-8000-00000000000d', 'patient',
   '{"name":"Lunar","species":"canino","sex":"macho","reproductiveStatus":"entero","breed":"Labrador","tutorId":"x"}',
   'draft', 'b15b15b1-0000-4000-8000-00000000000b');

insert into public.clinical_records (clinic_id, record_type, content, status, created_by, created_at) values
  ('c15c15c1-0000-4000-8000-00000000000c', 'consultation',
   '{"patientId":"f1500000-0000-4000-8000-000000000001","status":"closed"}', 'draft',
   'a15a15a1-0000-4000-8000-00000000000a', '2026-01-10T10:00:00Z'),
  ('c15c15c1-0000-4000-8000-00000000000c', 'consultation',
   '{"patientId":"f1500000-0000-4000-8000-000000000001","status":"closed"}', 'draft',
   'a15a15a1-0000-4000-8000-00000000000a', '2026-03-10T10:00:00Z'),
  ('c15c15c1-0000-4000-8000-00000000000c', 'consultation',
   '{"patientId":"f1500000-0000-4000-8000-000000000002","status":"closed"}', 'draft',
   'a15a15a1-0000-4000-8000-00000000000a', '2026-02-05T10:00:00Z');

set local session_replication_role = origin;

select set_config('request.jwt.claims',
  '{"sub":"a15a15a1-0000-4000-8000-00000000000a","role":"authenticated","session_id":"5e15a000-0000-4000-8000-00000000000a"}',
  true);
set local role authenticated;

select is(
  (select count(*)::int from public.search_patients()),
  3,
  'solo ve los pacientes de su clínica'
);

select is(
  (select array_agg(name) from public.search_patients(p_sort => 'name', p_dir => 'desc')),
  array['Rocky', 'Nube', 'Luna'],
  'ordena por nombre descendente'
);

select is(
  (select array_agg(name) from public.search_patients(p_sort => 'last_visit', p_dir => 'desc')),
  array['Luna', 'Rocky', 'Nube'],
  'la última visita es la consulta más reciente y quien no tiene va al final'
);

select is(
  (select array_agg(name) from public.search_patients(p_sort => 'last_visit', p_dir => 'asc')),
  array['Rocky', 'Luna', 'Nube'],
  'asc: el sin visitas sigue al final'
);

select is(
  (select array_agg(name) from public.search_patients(p_name => 'LUN')),
  array['Luna'],
  'filtra por nombre sin distinguir mayúsculas'
);

select is(
  (select array_agg(name) from public.search_patients(p_breed => 'beag')),
  array['Rocky'],
  'filtra por raza'
);

select is(
  (select array_agg(name order by name) from public.search_patients(
    p_visit_from => '2026-02-01T00:00:00Z', p_visit_to => '2026-03-01T00:00:00Z')),
  array['Rocky'],
  'el rango de última visita es [desde, hasta) y excluye a los sin visitas'
);

select is(
  (select array_agg(name) from public.search_patients(p_tutor_id => 'e1500000-0000-4000-8000-000000000001')),
  array['Luna', 'Rocky'],
  'filtra por tutor'
);

select is(
  (select tutor_name from public.search_patients(p_name => 'Nube')),
  '50% Perez',
  'trae el nombre del tutor'
);

select is(
  (select count(*)::int from public.search_patients(p_name => '%')),
  0,
  'el % buscado es literal, no comodín'
);

select is(
  (select max(total_count)::int from public.search_patients(p_limit => 1, p_offset => 1)),
  3,
  'total_count es el total filtrado aunque la página tenga una fila'
);

select * from finish();
rollback;
