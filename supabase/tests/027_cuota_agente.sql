-- Suite pgTap: cuota por usuario del agente (027_cuota_agente.sql).
-- Patrón: supabase/tests/025_resumen_consulta.sql.

begin;
select plan(7);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', 'a7a7a7a7-0000-4000-8000-00000000000a',
   'authenticated', 'authenticated', 'ana.cuota@example.test', 'not-a-real-hash',
   timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now())),
  ('00000000-0000-0000-0000-000000000000', 'b7b7b7b7-0000-4000-8000-00000000000b',
   'authenticated', 'authenticated', 'beto.cuota@example.test', 'not-a-real-hash',
   timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now())),
  ('00000000-0000-0000-0000-000000000000', 'c7c7c7c7-0000-4000-8000-00000000000c',
   'authenticated', 'authenticated', 'cami.cuota@example.test', 'not-a-real-hash',
   timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now()));

insert into public.clinics (id, name)
values ('e7e7e7e7-0000-4000-8000-00000000000e', 'Clínica de cuotas');

insert into public.veterinarians (id, clinic_id, identifier, display_name)
values
  ('a7a7a7a7-0000-4000-8000-00000000000a', 'e7e7e7e7-0000-4000-8000-00000000000e',
   'ana.cuota@example.test', 'Dra. Ana Cuota'),
  ('b7b7b7b7-0000-4000-8000-00000000000b', 'e7e7e7e7-0000-4000-8000-00000000000e',
   'beto.cuota@example.test', 'Dr. Beto Cuota'),
  ('c7c7c7c7-0000-4000-8000-00000000000c', 'e7e7e7e7-0000-4000-8000-00000000000e',
   'cami.cuota@example.test', 'Dra. Cami Sin Sesión');

-- CAMI no tiene sesión de acceso activa.
insert into public.access_sessions (veterinarian_id, auth_session_id)
values ('a7a7a7a7-0000-4000-8000-00000000000a', '5e7a7700-0000-4000-8000-00000000000a'),
       ('b7b7b7b7-0000-4000-8000-00000000000b', '5e7b7700-0000-4000-8000-00000000000b');

select set_config('request.jwt.claims',
  '{"sub":"a7a7a7a7-0000-4000-8000-00000000000a","role":"authenticated","session_id":"5e7a7700-0000-4000-8000-00000000000a"}',
  true);
set local role authenticated;

select is(
  (select count(*)::int from (select public.consume_agent_quota() as r from generate_series(1, 30)) t where r = 'ok'),
  30,
  'ANA puede hacer 30 turnos en la ventana'
);

select is(public.consume_agent_quota(), 'rate_limited', 'el turno 31 se rechaza');

select throws_ok(
  $$select count(*) from public.assistant_agent_usage$$,
  '42501',
  null,
  'el registro de uso no se lee desde el cliente'
);

-- BETO es otro usuario: su cuota es propia.
select set_config('request.jwt.claims',
  '{"sub":"b7b7b7b7-0000-4000-8000-00000000000b","role":"authenticated","session_id":"5e7b7700-0000-4000-8000-00000000000b"}',
  true);

select is(public.consume_agent_quota(), 'ok', 'la cuota es por usuario: BETO no hereda la de ANA');

-- CAMI no tiene sesión activa.
select set_config('request.jwt.claims',
  '{"sub":"c7c7c7c7-0000-4000-8000-00000000000c","role":"authenticated","session_id":"5e7c7700-0000-4000-8000-00000000000c"}',
  true);

select is(public.consume_agent_quota(), 'no_access', 'sin sesión de acceso activa no hay cuota');

-- Sin autenticar no se puede ejecutar.
reset role;
set local role anon;
select throws_ok(
  $$select public.consume_agent_quota()$$,
  '42501',
  null,
  'anon no ejecuta la función'
);

reset role;
select function_privs_are(
  'public', 'consume_agent_quota', array[]::text[], 'authenticated', array['EXECUTE'],
  'authenticated ejecuta la cuota del agente'
);

select * from finish();
rollback;
