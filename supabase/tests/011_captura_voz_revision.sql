-- Suite pgTap: revisión de la PR #29 sobre la captura de voz hacia anamnesis.
--
-- Cambio: openspec/changes/implementar-captura-voz-anamnesis (tasks.md, sección «Revisión de
-- la PR #29»). Cada bloque fija un hallazgo de la revisión y se escribió ANTES de corregir
-- supabase/migrations/011_captura_voz.sql (Constitución II): su rojo previo y su verde
-- posterior quedan en quickstart.md.
--
-- Hallazgo 5: `anamnesisEntryId` es del servidor también en INSERT, y el vocabulario de
-- `confirmationState` está cerrado también en UPDATE.
-- Hallazgo 8: la consulta abierta (FR-014 · US6-AC14) y la sesión activa se exigen en el
-- servidor; los tramos resueltos quedan sellados (SC-027).
--
-- Patrón: supabase/tests/010_captura_voz.sql.

begin;
select plan(17);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', 'a5a5a5a5-0000-4000-8000-00000000000a',
   'authenticated', 'authenticated', 'ana.voz.revision@example.test', 'not-a-real-hash',
   timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now())),
  ('00000000-0000-0000-0000-000000000000', 'd5d5d5d5-0000-4000-8000-00000000000d',
   'authenticated', 'authenticated', 'diana.voz.revision@example.test', 'not-a-real-hash',
   timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now()));

insert into public.clinics (id, name)
values ('e5e5e5e5-0000-4000-8000-00000000000e', 'Clínica de revisión de voz'),
       ('f5f5f5f5-0000-4000-8000-00000000000f', 'Clínica ajena de revisión de voz');

insert into public.veterinarians (id, clinic_id, identifier, display_name)
values
  ('a5a5a5a5-0000-4000-8000-00000000000a', 'e5e5e5e5-0000-4000-8000-00000000000e',
   'ana.voz.revision@example.test', 'Dra. Ana Revisión Voz'),
  ('d5d5d5d5-0000-4000-8000-00000000000d', 'f5f5f5f5-0000-4000-8000-00000000000f',
   'diana.voz.revision@example.test', 'Dra. Diana Revisión Voz');

insert into public.access_sessions (veterinarian_id, auth_session_id)
values ('a5a5a5a5-0000-4000-8000-00000000000a', '5e5a2000-0000-4000-8000-00000000000a'),
       ('d5d5d5d5-0000-4000-8000-00000000000d', '5e5d2000-0000-4000-8000-00000000000d');

-- DIANA, de otra clínica, abre SU consulta y activa SU escucha (el objetivo ajeno de abajo).
select set_config('request.jwt.claims',
  '{"sub":"d5d5d5d5-0000-4000-8000-00000000000d","role":"authenticated","session_id":"5e5d2000-0000-4000-8000-00000000000d"}',
  true);
set local role authenticated;

insert into public.clinical_records (id, clinic_id, record_type, content, status)
values ('33333333-0000-4000-8000-000000000009', 'f5f5f5f5-0000-4000-8000-00000000000f',
        'consultation', '{"patientId":"44444444-0000-4000-8000-000000000009","status":"open"}',
        'draft');
insert into public.listening_sessions (id, clinic_id, consultation_id)
values ('55555555-0000-4000-8000-000000000009', 'f5f5f5f5-0000-4000-8000-00000000000f',
        '33333333-0000-4000-8000-000000000009');

-- A partir de aquí actúa ANA sobre su clínica.
select set_config('request.jwt.claims',
  '{"sub":"a5a5a5a5-0000-4000-8000-00000000000a","role":"authenticated","session_id":"5e5a2000-0000-4000-8000-00000000000a"}',
  true);

insert into public.clinical_records (id, clinic_id, record_type, content, status)
values
  ('33333333-0000-4000-8000-000000000001', 'e5e5e5e5-0000-4000-8000-00000000000e',
   'consultation', '{"patientId":"44444444-0000-4000-8000-000000000001","status":"open"}', 'draft'),
  ('33333333-0000-4000-8000-000000000002', 'e5e5e5e5-0000-4000-8000-00000000000e',
   'consultation', '{"patientId":"44444444-0000-4000-8000-000000000001","status":"closed"}', 'draft');

-- ---------------------------------------------------------------------------
-- Hallazgo 5: anamnesisEntryId y vocabulario de confirmationState.
-- ---------------------------------------------------------------------------

-- 1. D5 · SC-027: un borrador que nace con anamnesisEntryId lo pierde (es del servidor).
insert into public.clinical_records (id, clinic_id, record_type, content, status)
values ('66666666-0000-4000-8000-000000000001', 'e5e5e5e5-0000-4000-8000-00000000000e',
  'audio_fact',
  '{"consultationId":"33333333-0000-4000-8000-000000000001","field":"frecuencia","text":"Ladra todos los días","provenance":"inferida","confirmationState":"pending","transcriptSegmentId":"77777777-0000-4000-8000-000000000001","transcriptExcerpt":"ladra todos los días","segmentSeq":0,"anamnesisEntryId":"88888888-0000-4000-8000-000000000001"}',
  'draft');
select ok(
  not (select content ? 'anamnesisEntryId' from public.clinical_records
       where id = '66666666-0000-4000-8000-000000000001'),
  'D5 · SC-027: el INSERT de un borrador descarta el anamnesisEntryId del cliente'
);

-- 2. D5: por eso ese borrador sigue confirmable por la ruta normal (el cliente reenvía el
-- contenido completo sin el enlace fabricado).
select lives_ok(
  $$update public.clinical_records
    set content = content || '{"confirmationState":"confirmed"}'::jsonb
    where id = '66666666-0000-4000-8000-000000000001'$$,
  'D5: el borrador creado con un enlace fabricado se confirma por la ruta normal'
);

-- 3. D6 · FR-017: un estado fuera del vocabulario se rechaza también en UPDATE.
insert into public.clinical_records (id, clinic_id, record_type, content, status)
values ('66666666-0000-4000-8000-000000000002', 'e5e5e5e5-0000-4000-8000-00000000000e',
  'audio_fact',
  '{"consultationId":"33333333-0000-4000-8000-000000000001","field":"duracion","text":"Desde hace tres meses","provenance":"inferida","confirmationState":"pending","transcriptSegmentId":"77777777-0000-4000-8000-000000000002","transcriptExcerpt":"desde hace tres meses","segmentSeq":1}',
  'draft');
select throws_ok(
  $$update public.clinical_records
    set content = content || '{"confirmationState":"cualquier-cosa"}'::jsonb
    where id = '66666666-0000-4000-8000-000000000002'$$,
  '23514', 'AUDIO_FACT_STATE_INVALID',
  'D6 · FR-017: UPDATE a un confirmationState fuera de vocabulario es rechazado'
);

-- 4. D6: editar el texto de un borrador pendiente sigue permitido.
select lives_ok(
  $$update public.clinical_records
    set content = content || '{"text":"Desde hace tres meses, más o menos"}'::jsonb
    where id = '66666666-0000-4000-8000-000000000002'$$,
  'D6: editar un borrador pendiente sigue permitido'
);

-- ---------------------------------------------------------------------------
-- Hallazgo 8: sesiones de escucha solo sobre una consulta abierta de la clínica.
-- ---------------------------------------------------------------------------

-- 5. FR-014 · US6-AC14: sin consulta que exista no hay sesión de escucha.
select throws_ok(
  $$insert into public.listening_sessions (clinic_id, consultation_id)
    values ('e5e5e5e5-0000-4000-8000-00000000000e', '33333333-0000-4000-8000-0000000000ff')$$,
  '23514', 'CONSULTATION_NOT_OPEN',
  'FR-014 · US6-AC14: no se activa la escucha sobre una consulta inexistente'
);

-- 6. FR-014 · US6-AC14: con la consulta cerrada no hay sesión de escucha.
select throws_ok(
  $$insert into public.listening_sessions (clinic_id, consultation_id)
    values ('e5e5e5e5-0000-4000-8000-00000000000e', '33333333-0000-4000-8000-000000000002')$$,
  '23514', 'CONSULTATION_NOT_OPEN',
  'FR-014 · US6-AC14: no se activa la escucha sobre una consulta cerrada'
);

-- 7. D8: la consulta de otra clínica no sirve de contenedor, aunque esté abierta.
select throws_ok(
  $$insert into public.listening_sessions (clinic_id, consultation_id)
    values ('e5e5e5e5-0000-4000-8000-00000000000e', '33333333-0000-4000-8000-000000000009')$$,
  '23514', 'CONSULTATION_NOT_OPEN',
  'D8: no se activa la escucha sobre la consulta abierta de otra clínica'
);

-- 8. FR-014: sobre la consulta abierta de su clínica, la activación procede.
select lives_ok(
  $$insert into public.listening_sessions (id, clinic_id, consultation_id)
    values ('55555555-0000-4000-8000-000000000001', 'e5e5e5e5-0000-4000-8000-00000000000e',
            '33333333-0000-4000-8000-000000000001')$$,
  'FR-014: la escucha se activa sobre la consulta abierta de la propia clínica'
);

-- ---------------------------------------------------------------------------
-- Hallazgo 8: tramos solo en una sesión activa de la clínica.
-- ---------------------------------------------------------------------------

-- 9. D8: no se anexa un tramo a la sesión de escucha de otra clínica.
select throws_ok(
  $$insert into public.transcript_segments
      (listening_session_id, clinic_id, seq, started_at, ended_at, text, quality)
    values ('55555555-0000-4000-8000-000000000009', 'e5e5e5e5-0000-4000-8000-00000000000e', 0,
      timezone('utc', now()), timezone('utc', now()), 'tramo ajeno', 'ok')$$,
  '23514', 'LISTENING_SESSION_NOT_ACTIVE',
  'D8: no se anexa un tramo a la sesión de escucha de otra clínica'
);

-- 10. D10: en la sesión activa propia el tramo se guarda.
select lives_ok(
  $$insert into public.transcript_segments
      (id, listening_session_id, clinic_id, seq, started_at, ended_at, text, quality)
    values ('77777777-0000-4000-8000-000000000010', '55555555-0000-4000-8000-000000000001',
      'e5e5e5e5-0000-4000-8000-00000000000e', 0,
      timezone('utc', now()), timezone('utc', now()), 'ladra todos los días', 'ok')$$,
  'D10: el tramo se guarda en la sesión activa de la propia clínica'
);

-- 11. SC-027 · D10: el texto del tramo (origen trazable de los hechos) no es reescribible.
select throws_ok(
  $$update public.transcript_segments set text = 'texto reescrito'
    where id = '77777777-0000-4000-8000-000000000010'$$,
  '42501', null,
  'SC-027 · D10: el texto de un tramo no es escribible por el cliente'
);

-- 12. US6-AC12: el tramo pendiente se resuelve de forma explícita.
select lives_ok(
  $$update public.transcript_segments set processing_state = 'processed'
    where id = '77777777-0000-4000-8000-000000000010'$$,
  'US6-AC12: el tramo pendiente se resuelve como procesado'
);

-- 13. SC-027 · US6-AC12: un tramo resuelto queda sellado.
select throws_ok(
  $$update public.transcript_segments set processing_state = 'discarded'
    where id = '77777777-0000-4000-8000-000000000010'$$,
  '23514', 'TRANSCRIPT_SEGMENT_SEALED',
  'SC-027 · US6-AC12: un tramo procesado no vuelve a resolverse'
);

-- 14. D8: la sesión se cierra con su estado terminal.
select lives_ok(
  $$update public.listening_sessions
    set state = 'stopped', ended_at = timezone('utc', now())
    where id = '55555555-0000-4000-8000-000000000001'$$,
  'D8: la sesión de escucha se detiene'
);

-- 15. D8: no se anexa un tramo a una sesión ya cerrada.
select throws_ok(
  $$insert into public.transcript_segments
      (listening_session_id, clinic_id, seq, started_at, ended_at, text, quality)
    values ('55555555-0000-4000-8000-000000000001', 'e5e5e5e5-0000-4000-8000-00000000000e', 1,
      timezone('utc', now()), timezone('utc', now()), 'tramo tardío', 'ok')$$,
  '23514', 'LISTENING_SESSION_NOT_ACTIVE',
  'D8: no se anexa un tramo a una sesión de escucha cerrada'
);

-- 16. D8: una sesión cerrada no se reactiva.
select throws_ok(
  $$update public.listening_sessions set state = 'active', ended_at = null
    where id = '55555555-0000-4000-8000-000000000001'$$,
  '23514', 'LISTENING_SESSION_SEALED',
  'D8: una sesión de escucha cerrada no se reactiva'
);

-- 17. FR-014: con la consulta cerrada, la sesión aún activa ya no admite tramos.
insert into public.listening_sessions (id, clinic_id, consultation_id)
values ('55555555-0000-4000-8000-000000000002', 'e5e5e5e5-0000-4000-8000-00000000000e',
        '33333333-0000-4000-8000-000000000001');
update public.clinical_records set content = content || '{"status":"closed"}'::jsonb
where id = '33333333-0000-4000-8000-000000000001';
select throws_ok(
  $$insert into public.transcript_segments
      (listening_session_id, clinic_id, seq, started_at, ended_at, text, quality)
    values ('55555555-0000-4000-8000-000000000002', 'e5e5e5e5-0000-4000-8000-00000000000e', 0,
      timezone('utc', now()), timezone('utc', now()), 'tramo tras el cierre', 'ok')$$,
  '23514', 'CONSULTATION_NOT_OPEN',
  'FR-014: la sesión de una consulta ya cerrada no admite tramos'
);

select * from finish();
rollback;
