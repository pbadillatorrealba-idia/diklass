-- Suite pgTap: búsqueda y orden de tutores en el servidor (RPC `search_tutors`) y validación
-- mínima del tutor. Patrón: supabase/tests/015_busqueda_pacientes.sql.

begin;
select plan(10);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', 'a17a17a1-0000-4000-8000-00000000000a',
   'authenticated', 'authenticated', 'ana.tutores@example.test', 'not-a-real-hash',
   timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now()));

insert into public.clinics (id, name) values
  ('c17c17c1-0000-4000-8000-00000000000c', 'Clínica de los tutores'),
  ('d17d17d1-0000-4000-8000-00000000000d', 'Otra clínica');

insert into public.veterinarians (id, clinic_id, identifier, display_name) values
  ('a17a17a1-0000-4000-8000-00000000000a', 'c17c17c1-0000-4000-8000-00000000000c',
   'ana.tutores@example.test', 'Dra. Ana');

insert into public.access_sessions (veterinarian_id, auth_session_id) values
  ('a17a17a1-0000-4000-8000-00000000000a', '5e17a000-0000-4000-8000-00000000000a');

-- Fixtures como propietario de la tabla y sin triggers (`replica`) para fijar `created_at` y
-- `created_by`. Marta (2 pacientes, correo), Pablo (1 paciente, teléfono con %), Zoe (sin
-- pacientes) y un tutor de otra clínica que nunca debe aparecer.
set local session_replication_role = replica;
insert into public.clinical_records (id, clinic_id, record_type, content, status, created_by, created_at) values
  ('e1700000-0000-4000-8000-000000000001', 'c17c17c1-0000-4000-8000-00000000000c', 'tutor',
   '{"name":"Marta","surname":"Soto","email":"marta@example.test"}', 'draft',
   'a17a17a1-0000-4000-8000-00000000000a', '2026-01-10T10:00:00Z'),
  ('e1700000-0000-4000-8000-000000000002', 'c17c17c1-0000-4000-8000-00000000000c', 'tutor',
   '{"name":"Pablo","surname":"Rojas","phone":"+56 9 5550 0101"}', 'draft',
   'a17a17a1-0000-4000-8000-00000000000a', '2026-02-10T10:00:00Z'),
  ('e1700000-0000-4000-8000-000000000003', 'c17c17c1-0000-4000-8000-00000000000c', 'tutor',
   '{"name":"Zoe","phone":"+56 9 5550 0303"}', 'draft',
   'a17a17a1-0000-4000-8000-00000000000a', '2026-03-10T10:00:00Z'),
  ('e1700000-0000-4000-8000-000000000004', 'd17d17d1-0000-4000-8000-00000000000d', 'tutor',
   '{"name":"Marta Ajena","phone":"999"}', 'draft', 'a17a17a1-0000-4000-8000-00000000000a',
   '2026-01-01T10:00:00Z'),
  ('f1700000-0000-4000-8000-000000000001', 'c17c17c1-0000-4000-8000-00000000000c', 'patient',
   '{"name":"Luna","tutorId":"e1700000-0000-4000-8000-000000000001"}', 'draft',
   'a17a17a1-0000-4000-8000-00000000000a', '2026-01-11T10:00:00Z'),
  ('f1700000-0000-4000-8000-000000000002', 'c17c17c1-0000-4000-8000-00000000000c', 'patient',
   '{"name":"Rocky","tutorId":"e1700000-0000-4000-8000-000000000001"}', 'draft',
   'a17a17a1-0000-4000-8000-00000000000a', '2026-01-12T10:00:00Z'),
  ('f1700000-0000-4000-8000-000000000003', 'c17c17c1-0000-4000-8000-00000000000c', 'patient',
   '{"name":"Nube","tutorId":"e1700000-0000-4000-8000-000000000002"}', 'draft',
   'a17a17a1-0000-4000-8000-00000000000a', '2026-02-11T10:00:00Z');
set local session_replication_role = origin;

select set_config('request.jwt.claims',
  '{"sub":"a17a17a1-0000-4000-8000-00000000000a","role":"authenticated","session_id":"5e17a000-0000-4000-8000-00000000000a"}',
  true);
set local role authenticated;

select is(
  (select count(*)::int from public.search_tutors()),
  3,
  'solo ve los tutores de su clínica'
);

select is(
  (select array_agg(full_name) from public.search_tutors(p_sort => 'name', p_dir => 'desc')),
  array['Zoe', 'Pablo Rojas', 'Marta Soto'],
  'ordena por nombre descendente; sin apellido, solo el nombre'
);

select is(
  (select array_agg(full_name) from public.search_tutors(p_sort => 'patients', p_dir => 'desc')),
  array['Marta Soto', 'Pablo Rojas', 'Zoe'],
  'ordena por nº de pacientes descendente'
);

select is(
  (select array_agg(patient_count::int order by full_name) from public.search_tutors()),
  array[2, 1, 0],
  'cuenta los pacientes de cada tutor'
);

select is(
  (select array_agg(full_name) from public.search_tutors(p_name => 'marta so')),
  array['Marta Soto'],
  'filtra sobre nombre y apellido sin distinguir mayúsculas'
);

select is(
  (select array_agg(full_name) from public.search_tutors(p_contact => '5550')),
  array['Pablo Rojas', 'Zoe'],
  'filtra por teléfono'
);

select is(
  (select array_agg(full_name) from public.search_tutors(p_contact => 'MARTA@')),
  array['Marta Soto'],
  'filtra por correo'
);

select is(
  (select count(*)::int from public.search_tutors(p_name => '%')),
  0,
  'el % buscado es literal, no comodín'
);

select is(
  (select max(total_count)::int from public.search_tutors(p_limit => 1, p_offset => 1)),
  3,
  'total_count es el total filtrado aunque la página tenga una fila'
);

select throws_ok(
  $$insert into public.clinical_records (id, clinic_id, record_type, content, status)
    values ('e1700000-0000-4000-8000-0000000000ff', 'c17c17c1-0000-4000-8000-00000000000c',
            'tutor', '{"name":"  ","phone":"1"}', 'draft')$$,
  '23514',
  null,
  'la base rechaza un tutor sin nombre'
);

select * from finish();
rollback;
