-- Purga del audio del chat (cambio chat-del-asistente, D6 · tarea 7.6a): qué se purga y quién puede
-- pedirlo. Corre como `postgres`: siembra mensajes y objetos que la API no dejaría sembrar.
begin;
select plan(15);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, banned_until
)
values
  ('00000000-0000-0000-0000-000000000000', 'a9a9a9a9-0000-4000-8000-00000000000a',
   'authenticated', 'authenticated', 'ana.purga@example.test', 'not-a-real-hash',
   timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now()), null),
  ('00000000-0000-0000-0000-000000000000', 'b9b9b9b9-0000-4000-8000-00000000000b',
   'authenticated', 'authenticated', 'beto.purga@example.test', 'not-a-real-hash',
   timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now()),
   timezone('utc', now()) + interval '30 days');

insert into public.clinics (id, name) values ('99999999-9999-4000-8000-000000000009', 'Clínica de la purga');
insert into public.veterinarians (id, clinic_id, identifier, display_name)
values
  ('a9a9a9a9-0000-4000-8000-00000000000a', '99999999-9999-4000-8000-000000000009', 'ana.purga@example.test', 'Dra. Ana Purga'),
  ('b9b9b9b9-0000-4000-8000-00000000000b', '99999999-9999-4000-8000-000000000009', 'beto.purga@example.test', 'Dr. Beto Purga');

-- Mensajes con audio: vencido, vigente de Ana y vigente de Beto (bloqueado). Se insertan como
-- `postgres` (sin RLS); el trigger fija el vencimiento a 90 días, que luego se ajusta.
insert into public.assistant_messages (id, clinic_id, author_id, role, status, audio_path, parts)
values
  ('00000000-0000-4000-8000-0000000000e1', '99999999-9999-4000-8000-000000000009', 'a9a9a9a9-0000-4000-8000-00000000000a', 'user', 'done',
   '99999999-9999-4000-8000-000000000009/a9a9a9a9-0000-4000-8000-00000000000a/00000000-0000-4000-8000-0000000000e1.webm',
   '[{"type":"audio","durationMs":5000,"transcript":"vencido","audioPath":"x","audioState":"ready"}]'),
  ('00000000-0000-4000-8000-0000000000e2', '99999999-9999-4000-8000-000000000009', 'a9a9a9a9-0000-4000-8000-00000000000a', 'user', 'done',
   '99999999-9999-4000-8000-000000000009/a9a9a9a9-0000-4000-8000-00000000000a/00000000-0000-4000-8000-0000000000e2.webm',
   '[{"type":"audio","durationMs":5000,"transcript":"vigente","audioPath":"x","audioState":"ready"}]'),
  ('00000000-0000-4000-8000-0000000000e3', '99999999-9999-4000-8000-000000000009', 'b9b9b9b9-0000-4000-8000-00000000000b', 'user', 'done',
   '99999999-9999-4000-8000-000000000009/b9b9b9b9-0000-4000-8000-00000000000b/00000000-0000-4000-8000-0000000000e3.webm',
   '[{"type":"audio","durationMs":5000,"transcript":"autor bloqueado","audioPath":"x","audioState":"ready"}]');
update public.assistant_messages
   set audio_expires_at = timezone('utc', now()) - interval '1 day'
 where id = '00000000-0000-4000-8000-0000000000e1';

select results_eq(
  $$select message_id::text from public.assistant_audio_due(1000)
     where audio_path like '99999999-9999-4000-8000-000000000009/%' order by message_id$$,
  $$values ('00000000-0000-4000-8000-0000000000e1'), ('00000000-0000-4000-8000-0000000000e3')$$,
  'purga el audio vencido y el de un autor bloqueado, y no el vigente de quien tiene acceso'
);

select is(
  (select count(*)::int from public.assistant_audio_due(1)),
  1,
  'respeta el límite pedido'
);

select is(public.assistant_audio_mark_purged(
  array['00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000e3']::uuid[]), 2,
  'marca los dos mensajes cuyo objeto se borró');

select results_eq(
  $$select audio_path is null and audio_expires_at is null,
           parts -> 0 ->> 'audioState', parts -> 0 ->> 'transcript'
      from public.assistant_messages where id = '00000000-0000-4000-8000-0000000000e1'$$,
  $$values (true, 'expired', 'vencido')$$,
  'el vencido queda sin ruta, «expired» y conserva su transcripción'
);

select results_eq(
  $$select parts -> 0 ->> 'audioState', parts -> 0 ->> 'transcript'
      from public.assistant_messages where id = '00000000-0000-4000-8000-0000000000e3'$$,
  $$values ('deleted', 'autor bloqueado')$$,
  'el de un autor bloqueado queda «deleted» y conserva su transcripción'
);

select results_eq(
  $$select audio_path is not null from public.assistant_messages where id = '00000000-0000-4000-8000-0000000000e2'$$,
  $$values (true)$$,
  'el audio vigente no se toca'
);

select is(public.assistant_audio_mark_purged(array['00000000-0000-4000-8000-0000000000e1']::uuid[]), 0,
  'marcar dos veces no cuenta de nuevo (idempotente)');

select is(
  (select count(*)::int from public.assistant_audio_due(1000)
    where audio_path like '99999999-9999-4000-8000-000000000009/%'),
  0, 'tras marcar ya no queda nada pendiente');

-- Objetos huérfanos: más de un día en el bucket y sin mensaje que los referencie.
insert into storage.objects (bucket_id, name, created_at)
values
  ('assistant-audio', '99999999-9999-4000-8000-000000000009/a9a9a9a9-0000-4000-8000-00000000000a/huerfano-viejo.webm',
   timezone('utc', now()) - interval '2 days'),
  ('assistant-audio', '99999999-9999-4000-8000-000000000009/a9a9a9a9-0000-4000-8000-00000000000a/huerfano-reciente.webm',
   timezone('utc', now())),
  ('assistant-audio', '99999999-9999-4000-8000-000000000009/a9a9a9a9-0000-4000-8000-00000000000a/00000000-0000-4000-8000-0000000000e2.webm',
   timezone('utc', now()) - interval '2 days');

select results_eq(
  $$select name from public.assistant_audio_orphans(10)
     where name like '99999999-9999-4000-8000-000000000009/%'$$,
  $$values ('99999999-9999-4000-8000-000000000009/a9a9a9a9-0000-4000-8000-00000000000a/huerfano-viejo.webm')$$,
  'solo el objeto viejo y sin mensaje es huérfano (no el reciente, que puede estar en un envío; ni el referenciado)'
);

select has_index('public', 'assistant_messages', 'assistant_messages_audio_path_idx',
  'la lectura y la purga buscan por ruta con un índice, no recorriendo la tabla');

-- Quién puede pedirlo: solo el service role.
set local role authenticated;
select throws_ok($$select * from public.assistant_audio_due(1)$$, '42501', null,
  'authenticated no puede listar lo pendiente');
select throws_ok($$select * from public.assistant_audio_orphans(1)$$, '42501', null,
  'authenticated no puede listar huérfanos');
select throws_ok($$select public.assistant_audio_mark_purged(array[]::uuid[])$$, '42501', null,
  'authenticated no puede marcar');
reset role;

set local role anon;
select throws_ok($$select * from public.assistant_audio_due(1)$$, '42501', null,
  'anon no puede listar lo pendiente');
reset role;

set local role service_role;
select lives_ok($$select * from public.assistant_audio_due(1)$$, 'el service role sí puede');
reset role;

select * from finish();
rollback;
