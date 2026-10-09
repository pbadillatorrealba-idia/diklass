-- Suite pgTap: edición controlada y auditada del propio nombre visible.
--
-- Cambio: openspec/changes/perfil-profesional (tasks.md 1.1). Patrón:
-- supabase/tests/013_cierre_consulta.sql.

begin;
select plan(11);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', 'a14a14a1-0000-4000-8000-00000000000a',
   'authenticated', 'authenticated', 'ana.perfil@example.test', 'not-a-real-hash',
   timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now()));

insert into public.clinics (id, name)
values ('c14c14c1-0000-4000-8000-00000000000c', 'Clínica de prueba del perfil');

insert into public.veterinarians (id, clinic_id, identifier, display_name)
values ('a14a14a1-0000-4000-8000-00000000000a', 'c14c14c1-0000-4000-8000-00000000000c',
        'ana.perfil@example.test', 'Dra. Ana Perfil');

insert into public.access_sessions (veterinarian_id, auth_session_id)
values ('a14a14a1-0000-4000-8000-00000000000a', '5e14a000-0000-4000-8000-00000000000a');

select set_config('request.jwt.claims',
  '{"sub":"a14a14a1-0000-4000-8000-00000000000a","role":"authenticated","session_id":"5e14a000-0000-4000-8000-00000000000a"}',
  true);
set local role authenticated;

select is(
  (public.update_own_profile('  Dra.   Ana   Nueva ')).display_name,
  'Dra. Ana Nueva',
  'el propio nombre cambia y se normalizan los espacios'
);

select is(
  (select count(*)::int from public.clinical_audit_events
   where action = 'veterinarian_profile_updated'
     and entity_type = 'veterinarian'
     and entity_id = 'a14a14a1-0000-4000-8000-00000000000a'
     and metadata = '{"previous":"Dra. Ana Perfil","current":"Dra. Ana Nueva"}'::jsonb),
  1,
  'el cambio deja un evento con el valor anterior y el nuevo'
);

select public.update_own_profile('Dra. Ana Nueva');
select is(
  (select count(*)::int from public.clinical_audit_events
   where action = 'veterinarian_profile_updated'),
  1,
  'el mismo valor no deja evento'
);

select throws_ok($$select public.update_own_profile('A')$$, '23514', 'DISPLAY_NAME_INVALID',
  'rechaza un nombre de un carácter');
select throws_ok($$select public.update_own_profile(repeat('a', 81))$$, '23514', 'DISPLAY_NAME_INVALID',
  'rechaza más de 80 caracteres');
select throws_ok($$select public.update_own_profile('     ')$$, '23514', 'DISPLAY_NAME_INVALID',
  'rechaza solo espacios');
select throws_ok($$select public.update_own_profile(null)$$, '23514', 'DISPLAY_NAME_INVALID',
  'rechaza nulo');

select throws_ok(
  $$update public.veterinarians set display_name = 'Otro' where true$$,
  '42501', null, 'un update directo se rechaza'
);

reset role;
update public.access_sessions set revoked_at = timezone('utc', now())
where veterinarian_id = 'a14a14a1-0000-4000-8000-00000000000a';
set local role authenticated;

select throws_ok($$select public.update_own_profile('Dra. Ana Revocada')$$, '42501',
  'AUTHENTICATION_REQUIRED', 'rechaza una sesión revocada');

reset role;
select is(
  (select display_name from public.veterinarians where id = 'a14a14a1-0000-4000-8000-00000000000a'),
  'Dra. Ana Nueva',
  'los rechazos no cambian el nombre'
);

set local role anon;
select throws_ok($$select public.update_own_profile('Anónimo')$$, '42501', null,
  'anon no tiene execute');

select * from finish();
rollback;
