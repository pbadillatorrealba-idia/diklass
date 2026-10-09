-- Suite pgTap: catálogos y obligatorios del paciente, RUT del tutor (único por clínica, dígito
-- verificador) y búsqueda de tutores por RUT. Patrón: 017_administracion_tutores.sql.

begin;
select plan(14);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', 'a18a18a1-0000-4000-8000-00000000000a',
   'authenticated', 'authenticated', 'ana.rut@example.test', 'not-a-real-hash',
   timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now()));

insert into public.clinics (id, name) values
  ('c18c18c1-0000-4000-8000-00000000000c', 'Clínica del RUT'),
  ('d18d18d1-0000-4000-8000-00000000000d', 'Otra clínica');

insert into public.veterinarians (id, clinic_id, identifier, display_name) values
  ('a18a18a1-0000-4000-8000-00000000000a', 'c18c18c1-0000-4000-8000-00000000000c',
   'ana.rut@example.test', 'Dra. Ana');

insert into public.access_sessions (veterinarian_id, auth_session_id) values
  ('a18a18a1-0000-4000-8000-00000000000a', '5e18a000-0000-4000-8000-00000000000a');

select set_config('request.jwt.claims',
  '{"sub":"a18a18a1-0000-4000-8000-00000000000a","role":"authenticated","session_id":"5e18a000-0000-4000-8000-00000000000a"}',
  true);
set local role authenticated;

-- ---------------------------------------------------------------------------
-- rut_is_valid: módulo 11, forma canónica
-- ---------------------------------------------------------------------------

select ok(public.rut_is_valid('12345678-5'), 'acepta un RUT con dígito verificador correcto');
select ok(public.rut_is_valid('10000013-K'), 'acepta el dígito verificador K');
select ok(public.rut_is_valid('10000004-0'), 'acepta el dígito verificador 0');
select ok(not public.rut_is_valid('12345678-4'), 'rechaza un dígito verificador erróneo');
select ok(not public.rut_is_valid('12.345.678-5'), 'rechaza la forma con puntos: la forma guardada es canónica');
select ok(not public.rut_is_valid(null), 'rechaza nulo');

-- ---------------------------------------------------------------------------
-- Tutor: RUT obligatorio y único por clínica
-- ---------------------------------------------------------------------------

insert into public.clinical_records (id, clinic_id, record_type, content, status) values
  ('e1800000-0000-4000-8000-000000000001', 'c18c18c1-0000-4000-8000-00000000000c', 'tutor',
   '{"name":"Camila","surname":"Muñoz","rut":"12345678-5","phone":"+56 9 5550 0101"}', 'draft');

select throws_ok(
  $$insert into public.clinical_records (clinic_id, record_type, content, status)
    values ('c18c18c1-0000-4000-8000-00000000000c', 'tutor',
            '{"name":"Sin RUT","phone":"1"}', 'draft')$$,
  '23514', null, 'la base rechaza un tutor sin RUT'
);

select throws_ok(
  $$insert into public.clinical_records (clinic_id, record_type, content, status)
    values ('c18c18c1-0000-4000-8000-00000000000c', 'tutor',
            '{"name":"RUT malo","rut":"12345678-4","phone":"1"}', 'draft')$$,
  '23514', null, 'la base rechaza un tutor con dígito verificador erróneo'
);

select throws_ok(
  $$insert into public.clinical_records (clinic_id, record_type, content, status)
    values ('c18c18c1-0000-4000-8000-00000000000c', 'tutor',
            '{"name":"Repetido","rut":"12345678-5","phone":"2"}', 'draft')$$,
  '23505', null, 'el RUT es único dentro de la clínica'
);

-- ---------------------------------------------------------------------------
-- Paciente: catálogos cerrados y obligatorios no vacíos
-- ---------------------------------------------------------------------------

select lives_ok(
  $$insert into public.clinical_records (clinic_id, record_type, content, status)
    values ('c18c18c1-0000-4000-8000-00000000000c', 'patient',
            '{"name":"Toby","species":"canino","breed":"Quiltro","sex":"macho","reproductiveStatus":"entero","tutorId":"e1800000-0000-4000-8000-000000000001"}',
            'draft')$$,
  'un paciente con catálogos válidos se guarda'
);

select throws_ok(
  $$insert into public.clinical_records (clinic_id, record_type, content, status)
    values ('c18c18c1-0000-4000-8000-00000000000c', 'patient',
            '{"name":"Toby","species":"perro","breed":"Quiltro","sex":"macho","reproductiveStatus":"entero","tutorId":"t"}',
            'draft')$$,
  '23514', null, 'la especie fuera del catálogo se rechaza'
);

select throws_ok(
  $$insert into public.clinical_records (clinic_id, record_type, content, status)
    values ('c18c18c1-0000-4000-8000-00000000000c', 'patient',
            '{"name":"Toby","species":"canino","breed":"Quiltro","sex":"M","reproductiveStatus":"entero","tutorId":"t"}',
            'draft')$$,
  '23514', null, 'el sexo fuera del catálogo se rechaza'
);

select throws_ok(
  $$insert into public.clinical_records (clinic_id, record_type, content, status)
    values ('c18c18c1-0000-4000-8000-00000000000c', 'patient',
            '{"name":"Toby","species":"canino","breed":"  ","sex":"macho","reproductiveStatus":"entero","tutorId":"t"}',
            'draft')$$,
  '23514', null, 'la raza vacía se rechaza'
);

-- ---------------------------------------------------------------------------
-- search_tutors: devuelve el RUT y lo busca con o sin puntos
-- ---------------------------------------------------------------------------

select is(
  (select array_agg(rut) from public.search_tutors(p_contact => '12.345.678-5')),
  array['12345678-5'],
  'busca por RUT escrito con puntos y devuelve la forma canónica'
);

select * from finish();
rollback;
