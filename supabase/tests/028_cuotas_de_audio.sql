-- Suite pgTap: cuotas de audio (023 `consume_assistant_audio_quota`, 028 `consume_dictation_quota`).
-- Patrón: supabase/tests/027_cuota_agente.sql.

begin;
select plan(12);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', 'a8a8a8a8-0000-4000-8000-00000000000a',
   'authenticated', 'authenticated', 'ana.audio@example.test', 'not-a-real-hash',
   timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now())),
  ('00000000-0000-0000-0000-000000000000', 'b8b8b8b8-0000-4000-8000-00000000000b',
   'authenticated', 'authenticated', 'beto.audio@example.test', 'not-a-real-hash',
   timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now()));

insert into public.clinics (id, name)
values ('e8e8e8e8-0000-4000-8000-00000000000e', 'Clínica de cuotas de audio');

insert into public.veterinarians (id, clinic_id, identifier, display_name)
values
  ('a8a8a8a8-0000-4000-8000-00000000000a', 'e8e8e8e8-0000-4000-8000-00000000000e',
   'ana.audio@example.test', 'Dra. Ana Audio'),
  ('b8b8b8b8-0000-4000-8000-00000000000b', 'e8e8e8e8-0000-4000-8000-00000000000e',
   'beto.audio@example.test', 'Dr. Beto Sin Sesión');

-- BETO no tiene sesión de acceso activa.
insert into public.access_sessions (veterinarian_id, auth_session_id)
values ('a8a8a8a8-0000-4000-8000-00000000000a', '5e8a8800-0000-4000-8000-00000000000a');

select set_config('request.jwt.claims',
  '{"sub":"a8a8a8a8-0000-4000-8000-00000000000a","role":"authenticated","session_id":"5e8a8800-0000-4000-8000-00000000000a"}',
  true);
set local role authenticated;

-- Chat: sin el aviso de voz aceptado no hay cuota ni envío al proveedor.
select is(public.consume_assistant_audio_quota('v1'), 'consent_required',
  'sin aviso de voz aceptado, el chat exige el consentimiento');

insert into public.assistant_voice_consent (version) values ('v1');

-- Subir la versión del aviso obliga a aceptarlo de nuevo: la aceptación de la v1 no vale para la v2.
select is(public.consume_assistant_audio_quota('v2'), 'consent_required',
  'una versión del aviso no aceptada exige el consentimiento, aunque exista la de una anterior');

select is(
  (select count(*)::int from (select public.consume_assistant_audio_quota('v1') as r from generate_series(1, 20)) t where r = 'ok'),
  20,
  'con el aviso aceptado, el chat admite 20 transcripciones en la ventana'
);
select is(public.consume_assistant_audio_quota('v1'), 'rate_limited', 'la transcripción 21 del chat se rechaza');

-- La ventana es deslizante: lo gastado hace más de 10 minutos ya no cuenta.
reset role;
update public.assistant_audio_usage set used_at = timezone('utc', now()) - interval '11 minutes';
set local role authenticated;
select is(public.consume_assistant_audio_quota('v1'), 'ok', 'el chat vuelve a admitir tras salir de la ventana');

-- Dictado: cuota propia, sin exigir el aviso del chat.
select is(
  (select count(*)::int from (select public.consume_dictation_quota() as r from generate_series(1, 120)) t where r = 'ok'),
  120,
  'el dictado admite 120 tramos en la ventana'
);
select is(public.consume_dictation_quota(), 'rate_limited', 'el tramo 121 del dictado se rechaza');

reset role;
update public.dictation_usage set used_at = timezone('utc', now()) - interval '11 minutes';
set local role authenticated;
select is(public.consume_dictation_quota(), 'ok', 'el dictado vuelve a admitir tras salir de la ventana');

select throws_ok(
  $$select count(*) from public.dictation_usage$$,
  '42501',
  null,
  'el registro de uso del dictado no se lee desde el cliente'
);

-- Sin sesión activa no hay cuota de ninguna.
select set_config('request.jwt.claims',
  '{"sub":"b8b8b8b8-0000-4000-8000-00000000000b","role":"authenticated","session_id":"5e8b8800-0000-4000-8000-00000000000b"}',
  true);
select is(public.consume_dictation_quota(), 'no_access', 'sin sesión activa, el dictado devuelve no_access');
select is(public.consume_assistant_audio_quota('v1'), 'no_access', 'sin sesión activa, el chat devuelve no_access');

-- El dictado no gasta la cuota del chat: ANA consumió 1 del chat tras la ventana y 121 del dictado.
select set_config('request.jwt.claims',
  '{"sub":"a8a8a8a8-0000-4000-8000-00000000000a","role":"authenticated","session_id":"5e8a8800-0000-4000-8000-00000000000a"}',
  true);
select is(
  (select count(*)::int from (select public.consume_assistant_audio_quota('v1') as r from generate_series(1, 19)) t where r = 'ok'),
  19,
  'el dictado no gasta la cuota del chat'
);

select * from finish();
rollback;
