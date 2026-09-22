-- Suite pgTap: captura de voz hacia anamnesis.
--
-- Cambio: openspec/changes/implementar-captura-voz-anamnesis (tasks.md 1.2).
-- Escrita ANTES que supabase/migrations/011_captura_voz.sql (Constitución II: pruebas
-- primero). Su «rojo» previo y su «verde» posterior se observan en el clúster scratch
-- /tmp/verify-004 (patrón del quickstart de 002) y en el job `database` de CI; la
-- evidencia queda en quickstart.md de este cambio.
--
-- Patrón: supabase/tests/008_registro_clinico.sql y supabase/tests/fixtures/attribution.sql
-- (veterinarios de una clínica con sesión de acceso activa, `set_config('request.jwt.claims', …)`
-- y `set local role authenticated`).
--
-- Modelo (D1/D5/D6 del diseño): los hechos extraídos del audio son filas
-- public.clinical_records record_type = 'audio_fact' con `content.confirmationState`
-- ('pending' | 'confirmed' | 'discarded'). La confirmación —una UPDATE a 'confirmed'—
-- aterriza en la misma transacción la entrada de anamnesis de 002 con procedencia
-- 'inferida' y enlaza content.anamnesisEntryId (id derivado por el servidor).
--
-- Orden de las secciones: primero el comportamiento de `audio_fact` sobre infraestructura
-- ya existente (degrada a `not ok` sin la migración 011), después los objetos nuevos con
-- has_table/throws_ok (degradan igual) y al final las aserciones sobre las tablas nuevas
-- (abortan con undefined_table en rojo: la razón prevista es que falta la migración 011).

begin;
select plan(26);

-- ---------------------------------------------------------------------------
-- Arrange: ANA abre la consulta y extrae; BRUNO confirma (distinto del que abrió la
-- consulta, US6-AC15). CARLA, de la misma clínica, queda sin sesión de acceso activa;
-- DIANA pertenece a otra clínica. Ambas solo alimentan los asserts de RLS.
-- ---------------------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', 'a4a4a4a4-0000-0000-0000-00000000000a',
   'authenticated', 'authenticated', 'ana.voz@example.test', 'not-a-real-hash',
   timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now())),
  ('00000000-0000-0000-0000-000000000000', 'b4b4b4b4-0000-0000-0000-00000000000b',
   'authenticated', 'authenticated', 'bruno.voz@example.test', 'not-a-real-hash',
   timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now())),
  ('00000000-0000-0000-0000-000000000000', 'c4c4c4c4-0000-0000-0000-00000000000c',
   'authenticated', 'authenticated', 'carla.voz@example.test', 'not-a-real-hash',
   timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now())),
  ('00000000-0000-0000-0000-000000000000', 'd4d4d4d4-0000-0000-0000-00000000000d',
   'authenticated', 'authenticated', 'diana.voz@example.test', 'not-a-real-hash',
   timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now()));

insert into public.clinics (id, name)
values ('e4e4e4e4-0000-0000-0000-00000000000e', 'Clínica de prueba de captura de voz'),
       ('f4f4f4f4-0000-0000-0000-00000000000f', 'Clínica ajena de prueba');

insert into public.veterinarians (id, clinic_id, identifier, display_name)
values
  ('a4a4a4a4-0000-0000-0000-00000000000a', 'e4e4e4e4-0000-0000-0000-00000000000e',
   'ana.voz@example.test', 'Dra. Ana Voz'),
  ('b4b4b4b4-0000-0000-0000-00000000000b', 'e4e4e4e4-0000-0000-0000-00000000000e',
   'bruno.voz@example.test', 'Dr. Bruno Voz'),
  ('c4c4c4c4-0000-0000-0000-00000000000c', 'e4e4e4e4-0000-0000-0000-00000000000e',
   'carla.voz@example.test', 'Dra. Carla Voz'),
  ('d4d4d4d4-0000-0000-0000-00000000000d', 'f4f4f4f4-0000-0000-0000-00000000000f',
   'diana.voz@example.test', 'Dra. Diana Voz');

-- CARLA queda sin fila de access_sessions a propósito (sin sesión de acceso activa).
insert into public.access_sessions (veterinarian_id, auth_session_id)
values ('a4a4a4a4-0000-0000-0000-00000000000a', '5e4a2000-0000-0000-0000-00000000000a'),
       ('b4b4b4b4-0000-0000-0000-00000000000b', '5e4b2000-0000-0000-0000-00000000000b'),
       ('d4d4d4d4-0000-0000-0000-00000000000d', '5e4d2000-0000-0000-0000-00000000000d');

select set_config('request.jwt.claims',
  '{"sub":"a4a4a4a4-0000-0000-0000-00000000000a","role":"authenticated","session_id":"5e4a2000-0000-0000-0000-00000000000a"}',
  true);
set local role authenticated;

-- Consulta abierta (contenedora de toda la captura, FR-014) y una ya cerrada (US6-AC4).
insert into public.clinical_records (id, clinic_id, record_type, content, status)
values
  ('11111111-0000-0000-0000-000000000001', 'e4e4e4e4-0000-0000-0000-00000000000e',
   'consultation',
   '{"patientId":"22222222-0000-0000-0000-000000000002","status":"open"}', 'draft'),
  ('11111111-0000-0000-0000-000000000002', 'e4e4e4e4-0000-0000-0000-00000000000e',
   'consultation',
   '{"patientId":"22222222-0000-0000-0000-000000000002","status":"closed"}', 'draft');

-- Borradores extraídos del audio (D1): todos nacen 'pending', con procedencia 'inferida'
-- y su traza al fragmento de transcripción (SC-027).
insert into public.clinical_records (id, clinic_id, record_type, content, status)
values
  ('11111111-0000-0000-0000-000000000101', 'e4e4e4e4-0000-0000-0000-00000000000e', 'audio_fact',
   '{"consultationId":"11111111-0000-0000-0000-000000000001","field":"frecuencia","text":"Todos los días ladra","provenance":"inferida","confirmationState":"pending","transcriptSegmentId":"99999999-0000-0000-0000-000000000001","transcriptExcerpt":"…todos los días ladra…","segmentSeq":0}',
   'draft'),
  ('11111111-0000-0000-0000-000000000102', 'e4e4e4e4-0000-0000-0000-00000000000e', 'audio_fact',
   '{"consultationId":"11111111-0000-0000-0000-000000000001","field":"duracion","text":"Desde hace tres meses","provenance":"inferida","confirmationState":"pending","transcriptSegmentId":"99999999-0000-0000-0000-000000000002","transcriptExcerpt":"…desde hace tres meses…","segmentSeq":1}',
   'draft'),
  ('11111111-0000-0000-0000-000000000103', 'e4e4e4e4-0000-0000-0000-00000000000e', 'audio_fact',
   '{"consultationId":"11111111-0000-0000-0000-000000000001","field":"comportamiento_problematico","text":"Destroza el sofá cuando se queda solo","provenance":"inferida","confirmationState":"pending","transcriptSegmentId":"99999999-0000-0000-0000-000000000003","transcriptExcerpt":"…destroza el sofá cuando se queda solo…","segmentSeq":2}',
   'draft'),
  ('11111111-0000-0000-0000-000000000104', 'e4e4e4e4-0000-0000-0000-00000000000e', 'audio_fact',
   '{"consultationId":"11111111-0000-0000-0000-000000000002","field":"ambiente","text":"Vive en un departamento","provenance":"inferida","confirmationState":"pending","transcriptSegmentId":"99999999-0000-0000-0000-000000000004","transcriptExcerpt":"…vive en un departamento…","segmentSeq":3}',
   'draft'),
  ('11111111-0000-0000-0000-000000000105', 'e4e4e4e4-0000-0000-0000-00000000000e', 'audio_fact',
   '{"consultationId":"11111111-0000-0000-0000-000000000001","text":"Texto sin campo de anamnesis","provenance":"inferida","confirmationState":"pending","transcriptSegmentId":"99999999-0000-0000-0000-000000000005","transcriptExcerpt":"…texto sin campo…","segmentSeq":4}',
   'draft');

-- 1. D6 · FR-017 · SC-005: el alta de borradores extraídos no es una acción clínica enumerada.
select is_empty(
  $$select 1 from public.clinical_audit_events
    where entity_id in ('11111111-0000-0000-0000-000000000101', '11111111-0000-0000-0000-000000000102',
                        '11111111-0000-0000-0000-000000000103', '11111111-0000-0000-0000-000000000105')$$,
  'D6 · FR-017 · SC-005: INSERT de borradores audio_fact no emite evento de auditoría'
);

-- 2. D6: editar un borrador tampoco emite evento.
update public.clinical_records
set content = content || '{"text":"Todos los días ladra, sobre todo de noche"}'::jsonb
where id = '11111111-0000-0000-0000-000000000101';
select is_empty(
  $$select 1 from public.clinical_audit_events
    where entity_id = '11111111-0000-0000-0000-000000000101'$$,
  'D6: editar un borrador audio_fact no emite evento'
);

-- 3. D6 · US6-AC3: descartar un borrador tampoco emite evento.
update public.clinical_records
set content = content || '{"confirmationState":"discarded"}'::jsonb
where id = '11111111-0000-0000-0000-000000000102';
select is_empty(
  $$select 1 from public.clinical_audit_events
    where entity_id = '11111111-0000-0000-0000-000000000102'$$,
  'D6 · US6-AC3: descartar un borrador audio_fact no emite evento'
);

-- 4. D6 · FR-017 · SC-005: no se fabrica un hecho «confirmado» por INSERT.
select throws_ok(
  $$insert into public.clinical_records (clinic_id, record_type, content, status)
    values ('e4e4e4e4-0000-0000-0000-00000000000e', 'audio_fact',
      '{"consultationId":"11111111-0000-0000-0000-000000000001","field":"ambiente","text":"Hecho fabricado","provenance":"inferida","confirmationState":"confirmed","transcriptSegmentId":"99999999-0000-0000-0000-000000000009","transcriptExcerpt":"…","segmentSeq":9}',
      'draft')$$,
  '23514', 'AUDIO_FACT_STATE_INVALID',
  'D6 · FR-017: INSERT de audio_fact en estado confirmado es rechazado'
);

-- 5. D5 · FR-017: confirmar exige contenido clínico válido; el aterrizaje lo deriva el servidor.
select throws_ok(
  $$update public.clinical_records
    set content = content || '{"confirmationState":"confirmed"}'::jsonb
    where id = '11111111-0000-0000-0000-000000000105'$$,
  '22023', 'AUDIO_FACT_INVALID_CONTENT',
  'D5 · FR-017: confirmar sin campo de anamnesis válido es rechazado'
);

-- 6. FR-068: confirmar exige identidad autenticada. Se ejerce como superuser para saltarse el
-- filtro de RLS (que ya oculta la fila sin sesión) y llegar a la capa de triggers — patrón de
-- fixtures/attribution.sql: «exercises the attribution trigger in isolation from RLS».
reset role;
select set_config('request.jwt.claims', '', true);
select throws_ok(
  $$update public.clinical_records
    set content = content || '{"confirmationState":"confirmed"}'::jsonb
    where id = '11111111-0000-0000-0000-000000000103'$$,
  '42501', 'AUTHENTICATION_REQUIRED',
  'FR-068: sin identidad autenticada no se confirma'
);
-- A partir de aquí confirma BRUNO, distinto de ANA (US6-AC15).
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"b4b4b4b4-0000-0000-0000-00000000000b","role":"authenticated","session_id":"5e4b2000-0000-0000-0000-00000000000b"}',
  true);

-- 7. US6-AC4 · FR-010: lo extraído de una consulta cerrada no se incorpora.
select throws_ok(
  $$update public.clinical_records
    set content = content || '{"confirmationState":"confirmed"}'::jsonb
    where id = '11111111-0000-0000-0000-000000000104'$$,
  '23514', 'CLINICAL_RECORD_SEALED',
  'US6-AC4 · FR-010: nada se confirma con la consulta cerrada'
);

-- 8. FR-017 · FR-068: BRUNO confirma el antecedente extraído, antecedente por antecedente.
select lives_ok(
  $$update public.clinical_records
    set content = content || '{"confirmationState":"confirmed"}'::jsonb
    where id = '11111111-0000-0000-0000-000000000103'$$,
  'FR-017 · FR-068: el segundo veterinario confirma el antecedente'
);

-- 9. D5 · SC-027: el hecho confirmado es una traza inmutable.
select throws_ok(
  $$update public.clinical_records
    set content = content || '{"confirmationState":"discarded"}'::jsonb
    where id = '11111111-0000-0000-0000-000000000103'$$,
  '23514', 'AUDIO_FACT_IMMUTABLE',
  'D5 · SC-027: un hecho confirmado no admite más cambios'
);

-- 10. D6: el descarte también es terminal.
select throws_ok(
  $$update public.clinical_records
    set content = content || '{"confirmationState":"pending"}'::jsonb
    where id = '11111111-0000-0000-0000-000000000102'$$,
  '23514', 'AUDIO_FACT_IMMUTABLE',
  'D6: un borrador descartado es terminal'
);

-- 11. FR-068 · SC-048 · US6-AC15: exactamente un audio_fact_confirmed, atribuido al confirmante.
select results_eq(
  $$select actor_id from public.clinical_audit_events
    where entity_id = '11111111-0000-0000-0000-000000000103'
      and action = 'audio_fact_confirmed'$$,
  $$values ('b4b4b4b4-0000-0000-0000-00000000000b'::uuid)$$,
  'FR-068 · SC-048 · US6-AC15: un único audio_fact_confirmed, atribuido a quien confirmó'
);

-- 12. FR-063: el aterrizaje emite anamnesis_recorded, atribuido al confirmante.
select results_eq(
  $$select actor_id from public.clinical_audit_events
    where entity_id = (select (content ->> 'anamnesisEntryId')::uuid from public.clinical_records
                       where id = '11111111-0000-0000-0000-000000000103')
      and action = 'anamnesis_recorded'$$,
  $$values ('b4b4b4b4-0000-0000-0000-00000000000b'::uuid)$$,
  'FR-063: el aterrizaje emite anamnesis_recorded atribuido al confirmante'
);

-- 13. FR-021 · US6-AC9 · FR-016: el aterrizaje conserva campo, texto, consulta y procedencia inferida.
select results_eq(
  $$select content ->> 'field', content ->> 'text', content ->> 'provenance',
           content ->> 'consultationId'
    from public.clinical_records
    where id = (select (content ->> 'anamnesisEntryId')::uuid from public.clinical_records
                where id = '11111111-0000-0000-0000-000000000103')$$,
  $$values ('comportamiento_problematico'::text,
            'Destroza el sofá cuando se queda solo'::text,
            'inferida'::text,
            '11111111-0000-0000-0000-000000000001'::text)$$,
  'FR-021 · US6-AC9 · FR-016: la entrada aterrizada conserva campo, texto, consulta e inferida'
);

-- 14. SC-048: la confirmación sella a quién confirmó en la propia traza.
select results_eq(
  $$select updated_by from public.clinical_records
    where id = '11111111-0000-0000-0000-000000000103'$$,
  $$values ('b4b4b4b4-0000-0000-0000-00000000000b'::uuid)$$,
  'SC-048: la traza sella a quién confirmó y cuándo'
);

-- 15. SC-027 · US6-AC6: la traza enlaza la entrada de anamnesis aterrizada.
select results_eq(
  $$select (content ->> 'anamnesisEntryId')::uuid from public.clinical_records
    where id = '11111111-0000-0000-0000-000000000103'$$,
  $$select id from public.clinical_records
    where record_type = 'anamnesis'
      and created_by = 'b4b4b4b4-0000-0000-0000-00000000000b'$$,
  'SC-027 · US6-AC6: la traza enlaza la entrada de anamnesis que originó'
);

-- 16. D8 · FR-068: existe la tabla de sesiones de escucha.
select has_table('public', 'listening_sessions',
  'D8 · FR-068: existe public.listening_sessions (entidad Sesión de escucha)');

-- 17. D10 · FR-031: existe la tabla de tramos de transcripción.
select has_table('public', 'transcript_segments',
  'D10 · FR-031: existe public.transcript_segments (tramos con marca de confiabilidad)');

-- 18. FR-068 · D8: el cliente no puede suplantar quién activó la escucha.
select throws_ok(
  $$insert into public.listening_sessions (id, clinic_id, consultation_id, started_by)
    values ('11111111-0000-0000-0000-000000000201', 'e4e4e4e4-0000-0000-0000-00000000000e',
      '11111111-0000-0000-0000-000000000001', 'b4b4b4b4-0000-0000-0000-00000000000b')$$,
  '42501', null,
  'FR-068 · D8: started_by no es escribible por el cliente'
);

-- 19. FR-031 · D10: quality solo admite 'ok' | 'insufficient'.
select throws_ok(
  $$insert into public.transcript_segments
      (listening_session_id, clinic_id, seq, started_at, ended_at, text, quality)
    values ('11111111-0000-0000-0000-000000000201', 'e4e4e4e4-0000-0000-0000-00000000000e', 0,
      timezone('utc', now()), timezone('utc', now()), 'texto', 'inaudible')$$,
  '23514', null,
  'FR-031 · D10: quality solo admite ok | insufficient'
);

-- 20. US6-AC12 · D10: processing_state no es escribible por el cliente en INSERT; nace 'pending'.
select throws_ok(
  $$insert into public.transcript_segments
      (listening_session_id, clinic_id, seq, started_at, ended_at, text, quality, processing_state)
    values ('11111111-0000-0000-0000-000000000201', 'e4e4e4e4-0000-0000-0000-00000000000e', 0,
      timezone('utc', now()), timezone('utc', now()), 'texto', 'ok', 'a_medio_procesar')$$,
  '42501', null,
  'US6-AC12 · D10: processing_state no es escribible en INSERT; el estado por omisión es pending'
);

-- 21. D8: state de la sesión solo admite 'active' | 'stopped' | 'interrupted'.
select throws_ok(
  $$insert into public.listening_sessions (id, clinic_id, consultation_id, state)
    values ('11111111-0000-0000-0000-000000000202', 'e4e4e4e4-0000-0000-0000-00000000000e',
      '11111111-0000-0000-0000-000000000001', 'pausada')$$,
  '23514', null,
  'D8: state solo admite active | stopped | interrupted'
);

-- A partir de aquí, ANA activa la escucha de su consulta.
select set_config('request.jwt.claims',
  '{"sub":"a4a4a4a4-0000-0000-0000-00000000000a","role":"authenticated","session_id":"5e4a2000-0000-0000-0000-00000000000a"}',
  true);

-- 22. FR-068 · D8: la activación queda atribuida por servidor a quien activó.
insert into public.listening_sessions (id, clinic_id, consultation_id)
values ('11111111-0000-0000-0000-000000000201', 'e4e4e4e4-0000-0000-0000-00000000000e',
        '11111111-0000-0000-0000-000000000001');
select results_eq(
  $$select started_by from public.listening_sessions
    where id = '11111111-0000-0000-0000-000000000201'$$,
  $$values ('a4a4a4a4-0000-0000-0000-00000000000a'::uuid)$$,
  'FR-068 · D8: la activación queda atribuida por servidor a quien la hizo'
);

-- 23. US6-AC12 · D10: el vocabulario de processing_state está cerrado (un tramo nunca queda
-- a medio procesar; se marca 'processed' o 'discarded' de forma explícita).
insert into public.transcript_segments
  (id, listening_session_id, clinic_id, seq, started_at, ended_at, text, quality)
values ('99999999-0000-0000-0000-000000000010', '11111111-0000-0000-0000-000000000201',
        'e4e4e4e4-0000-0000-0000-00000000000e', 0,
        timezone('utc', now()), timezone('utc', now()),
        '…todos los días ladra…', 'ok');
select throws_ok(
  $$update public.transcript_segments
    set processing_state = 'a_medio_procesar'
    where id = '99999999-0000-0000-0000-000000000010'$$,
  '23514', null,
  'US6-AC12 · D10: processing_state solo admite pending | processed | discarded'
);

-- 24. D8: una clínica ajena no ve la sesión de escucha.
select set_config('request.jwt.claims',
  '{"sub":"d4d4d4d4-0000-0000-0000-00000000000d","role":"authenticated","session_id":"5e4d2000-0000-0000-0000-00000000000d"}',
  true);
select is_empty(
  $$select 1 from public.listening_sessions
    where id = '11111111-0000-0000-0000-000000000201'$$,
  'D8: una clínica ajena no ve la sesión de escucha'
);

-- 25. FR-068 · D8: sin sesión de acceso activa no hay lectura.
select set_config('request.jwt.claims',
  '{"sub":"c4c4c4c4-0000-0000-0000-00000000000c","role":"authenticated","session_id":"5e4c2000-0000-0000-0000-00000000000c"}',
  true);
select is_empty(
  $$select 1 from public.listening_sessions
    where id = '11111111-0000-0000-0000-000000000201'$$,
  'FR-068 · D8: sin sesión de acceso activa no hay lectura'
);

-- 26. D8: la clínica compartida con sesión activa sí ve la sesión de escucha.
select set_config('request.jwt.claims',
  '{"sub":"b4b4b4b4-0000-0000-0000-00000000000b","role":"authenticated","session_id":"5e4b2000-0000-0000-0000-00000000000b"}',
  true);
select results_eq(
  $$select started_by from public.listening_sessions
    where id = '11111111-0000-0000-0000-000000000201'$$,
  $$values ('a4a4a4a4-0000-0000-0000-00000000000a'::uuid)$$,
  'D8: la clínica compartida con sesión activa sí ve la sesión de escucha'
);

select * from finish();
rollback;
