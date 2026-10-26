-- Suite pgTap: audio conservado por tramo (cambio implementar-asr-real-captura-voz, D4).
--
-- El audio solo puede existir si ya hay un tramo aceptado por los guardas de la 011 con ese
-- `audio_path`: la política de storage.objects lee transcript_segments bajo la RLS de quien
-- escribe, así que otra clínica no resuelve el tramo y no ve ni escribe el audio. Sin UPDATE ni
-- DELETE (el audio es evidencia hasta que exista una política de retención).
--
-- Patrón: supabase/tests/011_captura_voz_revision.sql.

begin;
select plan(11);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', 'a9a9a9a9-0000-4000-8000-00000000000a',
   'authenticated', 'authenticated', 'ana.audio@example.test', 'not-a-real-hash',
   timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now())),
  ('00000000-0000-0000-0000-000000000000', 'd9d9d9d9-0000-4000-8000-00000000000d',
   'authenticated', 'authenticated', 'diana.audio@example.test', 'not-a-real-hash',
   timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now()));

insert into public.clinics (id, name)
values ('e9e9e9e9-0000-4000-8000-00000000000e', 'Clínica de audio'),
       ('f9f9f9f9-0000-4000-8000-00000000000f', 'Clínica ajena de audio');

insert into public.veterinarians (id, clinic_id, identifier, display_name)
values
  ('a9a9a9a9-0000-4000-8000-00000000000a', 'e9e9e9e9-0000-4000-8000-00000000000e',
   'ana.audio@example.test', 'Dra. Ana Audio'),
  ('d9d9d9d9-0000-4000-8000-00000000000d', 'f9f9f9f9-0000-4000-8000-00000000000f',
   'diana.audio@example.test', 'Dra. Diana Audio');

insert into public.access_sessions (veterinarian_id, auth_session_id)
values ('a9a9a9a9-0000-4000-8000-00000000000a', '5e9a2000-0000-4000-8000-00000000000a'),
       ('d9d9d9d9-0000-4000-8000-00000000000d', '5e9d2000-0000-4000-8000-00000000000d');

select set_config('request.jwt.claims',
  '{"sub":"a9a9a9a9-0000-4000-8000-00000000000a","role":"authenticated","session_id":"5e9a2000-0000-4000-8000-00000000000a"}',
  true);
set local role authenticated;

insert into public.clinical_records (id, clinic_id, record_type, content, status)
values ('39999999-0000-4000-8000-000000000001', 'e9e9e9e9-0000-4000-8000-00000000000e',
        'consultation', '{"patientId":"49999999-0000-4000-8000-000000000001","status":"open"}',
        'draft');
insert into public.listening_sessions (id, clinic_id, consultation_id)
values ('59999999-0000-4000-8000-000000000001', 'e9e9e9e9-0000-4000-8000-00000000000e',
        '39999999-0000-4000-8000-000000000001');

-- 1. D4: un audio_path ajeno a la clínica/sesión del tramo se rechaza en el servidor.
select throws_ok(
  $$insert into public.transcript_segments
      (listening_session_id, clinic_id, seq, started_at, ended_at, text, quality, audio_path)
    values ('59999999-0000-4000-8000-000000000001', 'e9e9e9e9-0000-4000-8000-00000000000e', 0,
            now(), now(), 'Ladra todos los días', 'ok',
            'f9f9f9f9-0000-4000-8000-00000000000f/59999999-0000-4000-8000-000000000001/0.webm')$$,
  '23514', 'AUDIO_PATH_INVALID',
  'D4: el audio_path de otra clínica se rechaza'
);

-- 2. D4: tampoco vale una ruta que no corresponde a su seq.
select throws_ok(
  $$insert into public.transcript_segments
      (listening_session_id, clinic_id, seq, started_at, ended_at, text, quality, audio_path)
    values ('59999999-0000-4000-8000-000000000001', 'e9e9e9e9-0000-4000-8000-00000000000e', 0,
            now(), now(), 'Ladra todos los días', 'ok',
            'e9e9e9e9-0000-4000-8000-00000000000e/59999999-0000-4000-8000-000000000001/7.webm')$$,
  '23514', 'AUDIO_PATH_INVALID',
  'D4: el audio_path de otro seq se rechaza'
);

-- 3. D4: con la ruta canónica el tramo se acepta.
select lives_ok(
  $$insert into public.transcript_segments
      (id, listening_session_id, clinic_id, seq, started_at, ended_at, text, quality, audio_path)
    values ('79999999-0000-4000-8000-000000000001', '59999999-0000-4000-8000-000000000001',
            'e9e9e9e9-0000-4000-8000-00000000000e', 0, now(), now(), 'Ladra todos los días', 'ok',
            'e9e9e9e9-0000-4000-8000-00000000000e/59999999-0000-4000-8000-000000000001/0.webm')$$,
  'D4: un tramo con su ruta canónica de audio se acepta'
);

-- 4. D4: el audio_path es inmutable para el cliente (el grant de UPDATE es solo processing_state).
select throws_ok(
  $$update public.transcript_segments
    set audio_path = 'e9e9e9e9-0000-4000-8000-00000000000e/59999999-0000-4000-8000-000000000001/9.webm'
    where id = '79999999-0000-4000-8000-000000000001'$$,
  '42501', null,
  'D4: el cliente no reescribe el audio_path de un tramo'
);

-- 5. D4: con el tramo aceptado, su audio puede subirse a la ruta del tramo.
select lives_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('consultation-audio',
            'e9e9e9e9-0000-4000-8000-00000000000e/59999999-0000-4000-8000-000000000001/0.webm')$$,
  'D4: el audio se sube a la ruta de un tramo aceptado'
);

-- 6. D4: sin tramo con esa ruta no hay audio (nada huérfano).
select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('consultation-audio',
            'e9e9e9e9-0000-4000-8000-00000000000e/59999999-0000-4000-8000-000000000001/5.webm')$$,
  '42501', null,
  'D4: no se sube audio sin un tramo aceptado'
);

-- 7. D4: la clínica lee su audio.
select is(
  (select count(*)::int from storage.objects where bucket_id = 'consultation-audio'),
  1,
  'D4: la clínica ve el audio de su tramo'
);

-- 8. D4: sin UPDATE (el audio es evidencia).
select is_empty(
  $$update storage.objects set name = name || '.x'
    where bucket_id = 'consultation-audio' returning 1$$,
  'D4: el audio no se modifica'
);

-- 9. D4: sin DELETE.
-- (storage-api ya prohíbe el DELETE directo; sin política de DELETE tampoco hay vía por la API.)
select throws_like(
  $$delete from storage.objects where bucket_id = 'consultation-audio'$$,
  'Direct deletion%',
  'D4: el audio no se borra'
);

-- A partir de aquí actúa DIANA, de otra clínica.
select set_config('request.jwt.claims',
  '{"sub":"d9d9d9d9-0000-4000-8000-00000000000d","role":"authenticated","session_id":"5e9d2000-0000-4000-8000-00000000000d"}',
  true);

-- 10. D4: otra clínica no ve el audio.
select is(
  (select count(*)::int from storage.objects where bucket_id = 'consultation-audio'),
  0,
  'D4: otra clínica no ve el audio'
);

-- 11. D4: ni sube audio sobre la ruta de un tramo ajeno.
select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('consultation-audio',
            'e9e9e9e9-0000-4000-8000-00000000000e/59999999-0000-4000-8000-000000000001/0.webm')$$,
  '42501', null,
  'D4: otra clínica no escribe audio sobre un tramo ajeno'
);

select * from finish();
rollback;
