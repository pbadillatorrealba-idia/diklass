-- Suite pgTap: revisión de la PR #66 sobre el audio por tramo (migración 021).
--
-- Hallazgo 4: si la subida del audio falla, el tramo descartado no puede quedar con un audio_path
-- que apunta a nada; el cliente puede poner el audio_path en NULL (solo NULL) al descartarlo.
-- Hallazgo 5: solo quien activó la sesión sube el audio de un tramo, y solo mientras el tramo está
-- pendiente; si no, otro usuario de la clínica podría adelantarse y bloquear la subida legítima.
--
-- Patrón: supabase/tests/019_audio_voz.sql.

begin;
select plan(7);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', 'a8a8a8a8-0000-4000-8000-00000000000a',
   'authenticated', 'authenticated', 'ana.revision66@example.test', 'not-a-real-hash',
   timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now())),
  ('00000000-0000-0000-0000-000000000000', 'b8b8b8b8-0000-4000-8000-00000000000b',
   'authenticated', 'authenticated', 'bruno.revision66@example.test', 'not-a-real-hash',
   timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now()));

insert into public.clinics (id, name)
values ('e8e8e8e8-0000-4000-8000-00000000000e', 'Clínica de la revisión 66');

insert into public.veterinarians (id, clinic_id, identifier, display_name)
values
  ('a8a8a8a8-0000-4000-8000-00000000000a', 'e8e8e8e8-0000-4000-8000-00000000000e',
   'ana.revision66@example.test', 'Dra. Ana Revisión 66'),
  ('b8b8b8b8-0000-4000-8000-00000000000b', 'e8e8e8e8-0000-4000-8000-00000000000e',
   'bruno.revision66@example.test', 'Dr. Bruno Revisión 66');

insert into public.access_sessions (veterinarian_id, auth_session_id)
values ('a8a8a8a8-0000-4000-8000-00000000000a', '5e8a2000-0000-4000-8000-00000000000a'),
       ('b8b8b8b8-0000-4000-8000-00000000000b', '5e8b2000-0000-4000-8000-00000000000b');

-- ANA abre la consulta, activa la escucha y guarda tres tramos con audio_path.
select set_config('request.jwt.claims',
  '{"sub":"a8a8a8a8-0000-4000-8000-00000000000a","role":"authenticated","session_id":"5e8a2000-0000-4000-8000-00000000000a"}',
  true);
set local role authenticated;

insert into public.clinical_records (id, clinic_id, record_type, content, status)
values ('38888888-0000-4000-8000-000000000001', 'e8e8e8e8-0000-4000-8000-00000000000e',
        'consultation', '{"patientId":"48888888-0000-4000-8000-000000000001","status":"open"}',
        'draft');
insert into public.listening_sessions (id, clinic_id, consultation_id)
values ('58888888-0000-4000-8000-000000000001', 'e8e8e8e8-0000-4000-8000-00000000000e',
        '38888888-0000-4000-8000-000000000001');

insert into public.transcript_segments
  (id, listening_session_id, clinic_id, seq, started_at, ended_at, text, quality, audio_path)
values
  ('78888888-0000-4000-8000-000000000000', '58888888-0000-4000-8000-000000000001',
   'e8e8e8e8-0000-4000-8000-00000000000e', 0, now(), now(), 'Ladra todos los días', 'ok',
   'e8e8e8e8-0000-4000-8000-00000000000e/58888888-0000-4000-8000-000000000001/0.webm'),
  ('78888888-0000-4000-8000-000000000001', '58888888-0000-4000-8000-000000000001',
   'e8e8e8e8-0000-4000-8000-00000000000e', 1, now(), now(), 'Destroza el sofá', 'ok',
   'e8e8e8e8-0000-4000-8000-00000000000e/58888888-0000-4000-8000-000000000001/1.webm'),
  ('78888888-0000-4000-8000-000000000002', '58888888-0000-4000-8000-000000000001',
   'e8e8e8e8-0000-4000-8000-00000000000e', 2, now(), now(), 'Empezó hace tres meses', 'ok',
   'e8e8e8e8-0000-4000-8000-00000000000e/58888888-0000-4000-8000-000000000001/2.webm');

-- 1. Hallazgo 4: el cliente puede poner el audio_path en NULL al descartar por fallo de subida.
select lives_ok(
  $$update public.transcript_segments
    set audio_path = null, processing_state = 'discarded'
    where id = '78888888-0000-4000-8000-000000000001'$$,
  'H4: el tramo descartado por fallo de subida queda sin audio_path'
);

select is(
  (select audio_path from public.transcript_segments
   where id = '78888888-0000-4000-8000-000000000001'),
  null,
  'H4: el audio_path quedó en NULL'
);

-- 2. Hallazgo 4: pero no puede reescribirlo a otra ruta (sigue siendo el origen trazable).
select throws_ok(
  $$update public.transcript_segments
    set audio_path = 'e8e8e8e8-0000-4000-8000-00000000000e/58888888-0000-4000-8000-000000000001/9.webm'
    where id = '78888888-0000-4000-8000-000000000000'$$,
  '23514', 'AUDIO_PATH_IMMUTABLE',
  'H4: el audio_path solo puede pasar a NULL, nunca a otra ruta'
);

-- 3. Hallazgo 5: quien activó la sesión sube el audio de su tramo pendiente.
select lives_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('consultation-audio',
            'e8e8e8e8-0000-4000-8000-00000000000e/58888888-0000-4000-8000-000000000001/0.webm')$$,
  'H5: quien activó la sesión sube el audio de su tramo pendiente'
);

-- 4. Hallazgo 4: sin audio_path (descartado por fallo) no hay objeto que reclamar.
select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('consultation-audio',
            'e8e8e8e8-0000-4000-8000-00000000000e/58888888-0000-4000-8000-000000000001/1.webm')$$,
  '42501', null,
  'H4: tras limpiar el audio_path no se puede subir audio a esa ruta'
);

-- A partir de aquí actúa BRUNO, de la misma clínica pero que NO activó la sesión.
select set_config('request.jwt.claims',
  '{"sub":"b8b8b8b8-0000-4000-8000-00000000000b","role":"authenticated","session_id":"5e8b2000-0000-4000-8000-00000000000b"}',
  true);

-- 5. Hallazgo 5: otro usuario de la clínica no puede adelantarse a subir audio de un tramo ajeno.
select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('consultation-audio',
            'e8e8e8e8-0000-4000-8000-00000000000e/58888888-0000-4000-8000-000000000001/2.webm')$$,
  '42501', null,
  'H5: otro usuario de la clínica no sube audio de un tramo de una sesión ajena'
);

-- 6. Hallazgo 5: con el tramo ya resuelto (processed) tampoco se sube audio nuevo.
select set_config('request.jwt.claims',
  '{"sub":"a8a8a8a8-0000-4000-8000-00000000000a","role":"authenticated","session_id":"5e8a2000-0000-4000-8000-00000000000a"}',
  true);
update public.transcript_segments set processing_state = 'processed'
where id = '78888888-0000-4000-8000-000000000002';
select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('consultation-audio',
            'e8e8e8e8-0000-4000-8000-00000000000e/58888888-0000-4000-8000-000000000001/2.webm')$$,
  '42501', null,
  'H5: un tramo ya resuelto no admite audio nuevo'
);

select * from finish();
rollback;
