-- Suite pgTap: retroalimentación clínica.
--
-- Cambio: openspec/changes/implementar-retroalimentacion-clinica (tasks.md 1.1).
-- Escrita ANTES que supabase/migrations/012_retroalimentacion_clinica.sql (Constitución II:
-- pruebas primero). Su «rojo» previo y su «verde» posterior se observan en el clúster
-- PostgreSQL scratch con shims en /tmp/verify-005/ (patrón del quickstart de 002) y en el
-- job `database` de CI (la URL se registra en quickstart.md).
--
-- Patrón: supabase/tests/008_registro_clinico.sql y
-- supabase/tests/fixtures/attribution.sql (dos veterinarios de una clínica con sesión de
-- acceso activa, `set_config('request.jwt.claims', …)` y `set local role authenticated`).
--
-- Qué queda garantizado por el servidor (D3–D5 de design.md) frente a lo que solo es
-- convención de servicio: el vocabulario categórico (FR-040 · FR-043 · SC-023), la
-- referencia a una consulta cerrada de la misma clínica (D3), la inmutabilidad de lo
-- registrado (FR-024 · SC-022 · US10-AC5) y la atribución de cada entrada y corrección
-- (FR-063 · FR-070 · SC-049 · US10-AC13). Los asserts 14–24 son los que exigen la
-- migración 012: en rojo fallan exactamente ellos, por la razón prevista (sin los
-- triggers todo INSERT vive y el UPDATE cae en el sello genérico de 009, no en el propio).
-- Los asserts 31–37 (revisión de la PR #28) exigen además el vínculo de la corrección
-- (D7) y la forma canónica del consultationId: sin ellos, los siete INSERT viven.

begin;
select plan(38);

-- ---------------------------------------------------------------------------
-- Arrange: dos veterinarios de una clínica con sesión de acceso activa y una
-- veterinaria de otra clínica (solo para fabricar la referencia cruzada de D5).
-- ---------------------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', 'a5a5a5a5-0000-0000-0000-00000000000a',
   'authenticated', 'authenticated', 'ana.retro@example.test', 'not-a-real-hash',
   timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now())),
  ('00000000-0000-0000-0000-000000000000', 'b5b5b5b5-0000-0000-0000-00000000000b',
   'authenticated', 'authenticated', 'bruno.retro@example.test', 'not-a-real-hash',
   timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now())),
  ('00000000-0000-0000-0000-000000000000', 'a6a6a6a6-0000-0000-0000-000000000006',
   'authenticated', 'authenticated', 'carla.retro@example.test', 'not-a-real-hash',
   timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now()));

insert into public.clinics (id, name)
values
  ('c5c5c5c5-0000-0000-0000-00000000000c', 'Clínica de prueba de retroalimentación'),
  ('c6c6c6c6-0000-0000-0000-000000000006', 'Clínica ajena de retroalimentación');

insert into public.veterinarians (id, clinic_id, identifier, display_name)
values
  ('a5a5a5a5-0000-0000-0000-00000000000a', 'c5c5c5c5-0000-0000-0000-00000000000c',
   'ana.retro@example.test', 'Dra. Ana Retro'),
  ('b5b5b5b5-0000-0000-0000-00000000000b', 'c5c5c5c5-0000-0000-0000-00000000000c',
   'bruno.retro@example.test', 'Dr. Bruno Retro'),
  ('a6a6a6a6-0000-0000-0000-000000000006', 'c6c6c6c6-0000-0000-0000-000000000006',
   'carla.retro@example.test', 'Dra. Carla Retro');

insert into public.access_sessions (veterinarian_id, auth_session_id)
values ('a5a5a5a5-0000-0000-0000-00000000000a', '5e5a5000-0000-0000-0000-00000000000a'),
       ('b5b5b5b5-0000-0000-0000-00000000000b', '5e5b5000-0000-0000-0000-00000000000b'),
       ('a6a6a6a6-0000-0000-0000-000000000006', '5e6a6000-0000-0000-0000-000000000006');

-- Consulta cerrada de la clínica ajena (fabricada por su veterinaria): solo interesa
-- como referencia cruzada del gate de misma clínica (D5). Se cierra aprobando su
-- epicrisis, el único camino que admite la 013 (SC-014 de 002).
select set_config('request.jwt.claims',
  '{"sub":"a6a6a6a6-0000-0000-0000-000000000006","role":"authenticated","session_id":"5e6a6000-0000-0000-0000-000000000006"}',
  true);
set local role authenticated;

insert into public.clinical_records (id, clinic_id, record_type, content, status)
values
  ('d5d5d5d5-0000-0000-0000-00000000000a', 'c6c6c6c6-0000-0000-0000-000000000006',
   'consultation', '{"patientId":"d5d5d5d5-0000-0000-0000-000000000001","status":"open"}',
   'draft'),
  ('d5d5d5d5-0000-0000-0000-0000000000ea', 'c6c6c6c6-0000-0000-0000-000000000006',
   'epicrisis', '{"consultationId":"d5d5d5d5-0000-0000-0000-00000000000a","motivoConsulta":"Control"}',
   'draft');
select public.approve_clinical_record('d5d5d5d5-0000-0000-0000-0000000000ea');

reset role;
select set_config('request.jwt.claims', '', true);

-- ---------------------------------------------------------------------------
-- Ana prepara la consulta, registra su diagnóstico y aprueba la epicrisis: el
-- cierre de la consulta es consecuencia de la aprobación (D4 de 002). Quedan
-- también una consulta abierta (para el gate D3) y el snapshot de SC-022.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub":"a5a5a5a5-0000-0000-0000-00000000000a","role":"authenticated","session_id":"5e5a5000-0000-0000-0000-00000000000a"}',
  true);
set local role authenticated;

insert into public.clinical_records (id, clinic_id, record_type, content, status)
values (
  'd5d5d5d5-0000-0000-0000-000000000001', 'c5c5c5c5-0000-0000-0000-00000000000c',
  'patient',
  '{"name":"Luna Retro","species":"perro","breed":"Mestizo","birthDate":null,"ageMonths":36,"weightKg":12.5,"sex":"hembra","reproductiveStatus":"esterilizada","antecedentes":{"medicalHistory":[],"preexistingDiseases":[],"currentMedications":[],"knownAllergies":[],"behavioralHistory":[]},"tutorId":"d5d5d5d5-0000-0000-0000-00000000000b"}',
  'draft'
);

insert into public.clinical_records (id, clinic_id, record_type, content, status)
values (
  'd5d5d5d5-0000-0000-0000-000000000002', 'c5c5c5c5-0000-0000-0000-00000000000c',
  'consultation',
  '{"patientId":"d5d5d5d5-0000-0000-0000-000000000001","status":"open"}',
  'draft'
);

insert into public.clinical_records (id, clinic_id, record_type, content, status)
values (
  'd5d5d5d5-0000-0000-0000-000000000009', 'c5c5c5c5-0000-0000-0000-00000000000c',
  'consultation',
  '{"patientId":"d5d5d5d5-0000-0000-0000-000000000001","status":"open"}',
  'draft'
);

insert into public.clinical_records (id, clinic_id, record_type, content, status)
values (
  'd5d5d5d5-0000-0000-0000-000000000003', 'c5c5c5c5-0000-0000-0000-00000000000c',
  'diagnosis',
  '{"consultationId":"d5d5d5d5-0000-0000-0000-000000000002","text":"Ansiedad por separación"}',
  'draft'
);

insert into public.clinical_records (id, clinic_id, record_type, content, status)
values (
  'd5d5d5d5-0000-0000-0000-000000000004', 'c5c5c5c5-0000-0000-0000-00000000000c',
  'epicrisis',
  '{"consultationId":"d5d5d5d5-0000-0000-0000-000000000002","motivoConsulta":"Ansiedad por separación","antecedentesRelevantes":"Destrucción de objetos en ausencias.","hallazgosAnamnesis":"Ladridos prolongados en ausencia del tutor.","hipotesis":[],"diagnostico":"Ansiedad por separación","examenesSolicitados":[],"intervencionesPropuestas":["Manejo ambiental"],"medicamentosAprobados":["Fluoxetina 20 mg cada 24 h"],"recomendacionesTutor":"Evitar castigos.","planSeguimiento":{"pendientes":["Control en 4 semanas"]},"observaciones":""}',
  'draft'
);

select public.approve_clinical_record('d5d5d5d5-0000-0000-0000-000000000004');

reset role;

-- Snapshot de SC-022: estado del diagnóstico original y de la epicrisis aprobada ANTES
-- de toda retroalimentación; el assert 31 compara byte a byte al final.
create temporary table snapshot_registros as
select id, content, status, updated_at, approved_by, approved_at
from public.clinical_records
where id in ('d5d5d5d5-0000-0000-0000-000000000003', 'd5d5d5d5-0000-0000-0000-000000000004');

-- Arrange sanity: la aprobación de la epicrisis cerró su consulta (D4 de 002; sin ese
-- cierre no habría consulta cerrada sobre la que registrar evolución).
select is(
  (select content ->> 'status' from public.clinical_records
   where id = 'd5d5d5d5-0000-0000-0000-000000000002'),
  'closed',
  'arrange: aprobar la epicrisis cerró la consulta (D4 de 002), la condición de US10-AC1'
);

-- ---------------------------------------------------------------------------
-- Ana registra la primera entrada de retroalimentación sobre la consulta cerrada.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub":"a5a5a5a5-0000-0000-0000-00000000000a","role":"authenticated","session_id":"5e5a5000-0000-0000-0000-00000000000a"}',
  true);
set local role authenticated;

select lives_ok(
  $$insert into public.clinical_records (id, clinic_id, record_type, content, status)
  values (
    'd5d5d5d5-0000-0000-0000-000000000005', 'c5c5c5c5-0000-0000-0000-00000000000c',
    'clinical_feedback',
    '{"consultationId":"d5d5d5d5-0000-0000-0000-000000000002","adherence":"parcial","evolution":"mejoriaParcial","evolutionNote":"Mejora parcial de las ausencias; persisten ladridos al anochecer.","adverseEvents":[{"severity":"leve","description":"Somnolencia leve la primera semana"}],"treatmentApplied":"Fluoxetina 20 mg cada 24 h","treatmentModification":"Dosis reducida a 10 mg cada 24 h por somnolencia","revisedDiagnosis":null}',
    'draft'
  )$$,
  'FR-018 · US10-AC1: la evolución posterior se registra sobre la consulta cerrada, de forma estructurada'
);

select results_eq(
  $$select action from public.clinical_audit_events
    where entity_id = 'd5d5d5d5-0000-0000-0000-000000000005'$$,
  $$values ('clinical_feedback_recorded'::text)$$,
  'FR-063 · FR-070 · US10-AC1: el INSERT emite la acción enumerada clinical_feedback_recorded'
);

select results_eq(
  $$select actor_id, occurred_at is not null from public.clinical_audit_events
    where entity_id = 'd5d5d5d5-0000-0000-0000-000000000005'
      and action = 'clinical_feedback_recorded'$$,
  $$values ('a5a5a5a5-0000-0000-0000-00000000000a'::uuid, true)$$,
  'FR-063 · FR-070 · SC-049: la entrada queda atribuida a la identidad autenticada, con su momento'
);

select results_eq(
  $$select created_by from public.clinical_records
    where id = 'd5d5d5d5-0000-0000-0000-000000000005'$$,
  $$values ('a5a5a5a5-0000-0000-0000-00000000000a'::uuid)$$,
  'FR-070 · SC-049: created_by lo fija el servidor con la identidad de quien registra'
);

select results_eq(
  $$select
      registro.content ->> 'consultationId' = 'd5d5d5d5-0000-0000-0000-000000000002',
      registro.created_at is not null and consulta.created_at is not null,
      registro.id <> consulta.id
        and registro.record_type = 'clinical_feedback'
        and consulta.record_type = 'consultation',
      (select referida.created_at from public.clinical_records referida
       where referida.id = (registro.content ->> 'consultationId')::uuid) = consulta.created_at
    from public.clinical_records registro
    join public.clinical_records consulta
      on consulta.id = 'd5d5d5d5-0000-0000-0000-000000000002'
    where registro.id = 'd5d5d5d5-0000-0000-0000-000000000005'$$,
  $$values (true::boolean, true::boolean, true::boolean, true::boolean)$$,
  'FR-039 · US10-AC7: la entrada quedó asociada a su consulta y las dos fechas —la de registro y la de la consulta referida, resuelta por la referencia— son recuperables por separado y ancladas a su fila'
);

select is(
  (select content ->> 'treatmentApplied' from public.clinical_records
   where id = 'd5d5d5d5-0000-0000-0000-000000000005'),
  'Fluoxetina 20 mg cada 24 h',
  'FR-018 · US10-AC10: el tratamiento efectivamente aplicado queda almacenado'
);

select is(
  (select content ->> 'treatmentModification' from public.clinical_records
   where id = 'd5d5d5d5-0000-0000-0000-000000000005'),
  'Dosis reducida a 10 mg cada 24 h por somnolencia',
  'FR-018 · US10-AC10: la modificación del tratamiento queda en su propio campo, distinguible del aplicado'
);

reset role;

-- ---------------------------------------------------------------------------
-- Bruno —no el veterinario que atendió— registra la segunda entrada: adherencia y
-- evolución desconocidas, tratamiento vacío y cambio de diagnóstico.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub":"b5b5b5b5-0000-0000-0000-00000000000b","role":"authenticated","session_id":"5e5b5000-0000-0000-0000-00000000000b"}',
  true);
set local role authenticated;

select lives_ok(
  $$insert into public.clinical_records (id, clinic_id, record_type, content, status)
  values (
    'd5d5d5d5-0000-0000-0000-000000000006', 'c5c5c5c5-0000-0000-0000-00000000000c',
    'clinical_feedback',
    '{"consultationId":"d5d5d5d5-0000-0000-0000-000000000002","adherence":"desconocida","evolution":"desconocida","evolutionNote":"El tutor no pudo precisar la evolución entre consultas.","adverseEvents":[],"treatmentApplied":null,"treatmentModification":null,"revisedDiagnosis":"Agresión redirigida; ajustar el diagnóstico diferencial"}',
    'draft'
  )$$,
  'FR-040 · US10-AC8 · FR-057 · US10-AC12: desconocida sin forzar binaria y tratamiento vacío sin impedir la evolución'
);

select results_eq(
  $$select created_by from public.clinical_records
    where id = 'd5d5d5d5-0000-0000-0000-000000000006'$$,
  $$values ('b5b5b5b5-0000-0000-0000-00000000000b'::uuid)$$,
  'FR-070 · SC-049 · US10-AC13: consta que la retroalimentación la registró el segundo veterinario'
);

select ok(
  (select content ->> 'treatmentApplied' is null
     and content ->> 'treatmentModification' is null
     and content ->> 'evolution' = 'desconocida'
     and content ->> 'adherence' = 'desconocida'
   from public.clinical_records
   where id = 'd5d5d5d5-0000-0000-0000-000000000006'),
  'FR-040 · US10-AC8 · FR-057 · US10-AC12: campos categóricos desconocidos y tratamiento vacío persisten tal como se registraron'
);

select is(
  (select content ->> 'revisedDiagnosis' from public.clinical_records
   where id = 'd5d5d5d5-0000-0000-0000-000000000006'),
  'Agresión redirigida; ajustar el diagnóstico diferencial',
  'FR-018 · US10-AC4: el cambio de diagnóstico se guarda como retroalimentación, sin tocar el diagnóstico original'
);

select is(
  (select count(*)::int from public.clinical_records
   where id in ('d5d5d5d5-0000-0000-0000-000000000005', 'd5d5d5d5-0000-0000-0000-000000000006')),
  2,
  'FR-056 · US10-AC11: las dos entradas se conservan sin sobrescribirse (el orden cronológico lo resuelve la vista pura)'
);

reset role;

-- ---------------------------------------------------------------------------
-- D5: la validación del contenido es del servidor (Constitución V). Estos asserts
-- son los que exigen la migración 012: sin sus triggers todo INSERT vive.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub":"a5a5a5a5-0000-0000-0000-00000000000a","role":"authenticated","session_id":"5e5a5000-0000-0000-0000-00000000000a"}',
  true);
set local role authenticated;

select throws_ok(
  $$insert into public.clinical_records (clinic_id, record_type, content, status)
  values ('c5c5c5c5-0000-0000-0000-00000000000c', 'clinical_feedback',
    '{"consultationId":"d5d5d5d5-0000-0000-0000-000000000002","adherence":"quizas","evolution":"mejoria","evolutionNote":null,"adverseEvents":[],"treatmentApplied":null,"treatmentModification":null,"revisedDiagnosis":null}',
    'draft')$$,
  '23514', 'CLINICAL_FEEDBACK_INVALID_CONTENT',
  'FR-040 · FR-043 · SC-023: adherencia fuera del vocabulario se rechaza en el servidor'
);

select throws_ok(
  $$insert into public.clinical_records (clinic_id, record_type, content, status)
  values ('c5c5c5c5-0000-0000-0000-00000000000c', 'clinical_feedback',
    '{"consultationId":"d5d5d5d5-0000-0000-0000-000000000002","adherence":"completa","evolution":"estupendo","evolutionNote":null,"adverseEvents":[],"treatmentApplied":null,"treatmentModification":null,"revisedDiagnosis":null}',
    'draft')$$,
  '23514', 'CLINICAL_FEEDBACK_INVALID_CONTENT',
  'FR-040 · FR-043 · SC-023: evolución fuera del vocabulario se rechaza en el servidor'
);

select throws_ok(
  $$insert into public.clinical_records (clinic_id, record_type, content, status)
  values ('c5c5c5c5-0000-0000-0000-00000000000c', 'clinical_feedback',
    '{"consultationId":"d5d5d5d5-0000-0000-0000-000000000002","adherence":"completa","evolution":"mejoria","evolutionNote":null,"adverseEvents":[],"treatmentApplied":null,"treatmentModification":null,"revisedDiagnosis":null,"origenDato":"voz"}',
    'draft')$$,
  '23514', 'CLINICAL_FEEDBACK_INVALID_CONTENT',
  'SC-023 · D5: la forma cerrada rechaza claves ajenas al modelo de D2'
);

select throws_ok(
  $$insert into public.clinical_records (clinic_id, record_type, content, status)
  values ('c5c5c5c5-0000-0000-0000-00000000000c', 'clinical_feedback',
    '{"consultationId":"d5d5d5d5-0000-0000-0000-000000000002","evolution":"mejoria","adverseEvents":[]}',
    'draft')$$,
  '23514', 'CLINICAL_FEEDBACK_INVALID_CONTENT',
  'SC-023: falta el campo categórico obligatorio adherence (el 100% exige que siempre exista)'
);

select throws_ok(
  $$insert into public.clinical_records (clinic_id, record_type, content, status)
  values ('c5c5c5c5-0000-0000-0000-00000000000c', 'clinical_feedback',
    '{"consultationId":"d5d5d5d5-0000-0000-0000-000000000002","adherence":"completa","evolution":"mejoria","adverseEvents":[{"severity":"catastrofico","description":"Episodio grave"}]}',
    'draft')$$,
  '23514', 'CLINICAL_FEEDBACK_INVALID_CONTENT',
  'FR-041: la severidad del evento adverso fuera de vocabulario se rechaza'
);

select throws_ok(
  $$insert into public.clinical_records (clinic_id, record_type, content, status)
  values ('c5c5c5c5-0000-0000-0000-00000000000c', 'clinical_feedback',
    '{"consultationId":"d5d5d5d5-0000-0000-0000-000000000002","adherence":"completa","evolution":"mejoria","adverseEvents":[{"severity":"grave"}]}',
    'draft')$$,
  '23514', 'CLINICAL_FEEDBACK_INVALID_CONTENT',
  'FR-041: el evento adverso sin descripción se rechaza (incidencia sin detalle no es recuperable)'
);

select throws_ok(
  $$insert into public.clinical_records (clinic_id, record_type, content, status)
  values ('c5c5c5c5-0000-0000-0000-00000000000c', 'clinical_feedback',
    '{"consultationId":"d5d5d5d5-0000-0000-0000-000000000009","adherence":"completa","evolution":"mejoria","adverseEvents":[]}',
    'draft')$$,
  '23514', 'CLINICAL_FEEDBACK_INVALID_CONTENT',
  'D3 · US10-AC1: no se registra retroalimentación sobre una consulta aún abierta'
);

select throws_ok(
  $$insert into public.clinical_records (clinic_id, record_type, content, status)
  values ('c5c5c5c5-0000-0000-0000-00000000000c', 'clinical_feedback',
    '{"consultationId":"d5d5d5d5-0000-0000-0000-0000000000ff","adherence":"completa","evolution":"mejoria","adverseEvents":[]}',
    'draft')$$,
  '23514', 'CLINICAL_FEEDBACK_INVALID_CONTENT',
  'D5: una consulta referida inexistente se rechaza en el servidor'
);

select throws_ok(
  $$insert into public.clinical_records (clinic_id, record_type, content, status)
  values ('c5c5c5c5-0000-0000-0000-00000000000c', 'clinical_feedback',
    '{"consultationId":"no-es-uuid","adherence":"completa","evolution":"mejoria","adverseEvents":[]}',
    'draft')$$,
  '23514', 'CLINICAL_FEEDBACK_INVALID_CONTENT',
  'D5: un consultationId malformado se rechaza sin romper la transacción (cast defensivo)'
);

select throws_ok(
  $$insert into public.clinical_records (clinic_id, record_type, content, status)
  values ('c5c5c5c5-0000-0000-0000-00000000000c', 'clinical_feedback',
    '{"consultationId":"d5d5d5d5-0000-0000-0000-00000000000a","adherence":"completa","evolution":"mejoria","adverseEvents":[]}',
    'draft')$$,
  '23514', 'CLINICAL_FEEDBACK_INVALID_CONTENT',
  'D5: la consulta referida debe ser de la misma clínica que el registro'
);

-- ---------------------------------------------------------------------------
-- FR-024 · SC-022 · US10-AC5 + D4: nada de lo registrado se edita; corregir crea.
-- ---------------------------------------------------------------------------

select throws_ok(
  $$update public.clinical_records
   set content = content || '{"adherence":"completa"}'::jsonb
   where id = 'd5d5d5d5-0000-0000-0000-000000000005'$$,
  '23514', 'CLINICAL_FEEDBACK_IMMUTABLE',
  'FR-024 · SC-022 · US10-AC5: la entrada registrada es inmutable ante cualquier UPDATE'
);

reset role;

-- ---------------------------------------------------------------------------
-- Bruno corrige la primera entrada: registro nuevo (status 'corrective') que
-- apunta al evento del original; el original permanece como estaba.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub":"b5b5b5b5-0000-0000-0000-00000000000b","role":"authenticated","session_id":"5e5b5000-0000-0000-0000-00000000000b"}',
  true);
set local role authenticated;

select lives_ok(
  $$insert into public.clinical_records (id, clinic_id, record_type, content, status, supersedes_event_id)
  select
    'd5d5d5d5-0000-0000-0000-000000000007', 'c5c5c5c5-0000-0000-0000-00000000000c',
    'clinical_feedback',
    '{"consultationId":"d5d5d5d5-0000-0000-0000-000000000002","adherence":"completa","evolution":"mejoria","evolutionNote":"Corrección: el tutor sí reportó adherencia completa.","adverseEvents":[{"severity":"leve","description":"Somnolencia leve la primera semana"}],"treatmentApplied":"Fluoxetina 20 mg cada 24 h","treatmentModification":"Dosis reducida a 10 mg cada 24 h por somnolencia","revisedDiagnosis":null}',
    'corrective',
    id
  from public.clinical_audit_events
  where entity_id = 'd5d5d5d5-0000-0000-0000-000000000005'
    and action = 'clinical_feedback_recorded'$$,
  'FR-024 · US10-AC5: corregir la entrada genera un registro nuevo que conserva el original'
);

select results_eq(
  $$select action from public.clinical_audit_events
    where entity_id = 'd5d5d5d5-0000-0000-0000-000000000007'$$,
  $$values ('corrective_record_created'::text)$$,
  'FR-063 · US10-AC5: la corrección emite la acción enumerada corrective_record_created'
);

select results_eq(
  $$select supersedes_event_id from public.clinical_audit_events
    where entity_id = 'd5d5d5d5-0000-0000-0000-000000000007'
      and action = 'corrective_record_created'$$,
  $$select id from public.clinical_audit_events
    where entity_id = 'd5d5d5d5-0000-0000-0000-000000000005'
      and action = 'clinical_feedback_recorded'$$,
  'D7 · US10-AC5: la corrección encadena al evento de registro del original'
);

select results_eq(
  $$select created_by from public.clinical_records
    where id = 'd5d5d5d5-0000-0000-0000-000000000007'$$,
  $$values ('b5b5b5b5-0000-0000-0000-00000000000b'::uuid)$$,
  'FR-070 · SC-049 · US10-AC5: la corrección queda atribuida a su autora, no a quien la registró'
);

reset role;

select set_config('request.jwt.claims',
  '{"sub":"a5a5a5a5-0000-0000-0000-00000000000a","role":"authenticated","session_id":"5e5a5000-0000-0000-0000-00000000000a"}',
  true);
set local role authenticated;

select is(
  (select content ->> 'adherence' from public.clinical_records
   where id = 'd5d5d5d5-0000-0000-0000-000000000005'),
  'parcial',
  'FR-024 · SC-022 · US10-AC5: la versión anterior permanece recuperable, sin modificaciones'
);

-- Correctiva sucesiva (Ana): misma cadena, mismo evento original (D7 · D8 de 002).
insert into public.clinical_records (id, clinic_id, record_type, content, status, supersedes_event_id)
select
  'd5d5d5d5-0000-0000-0000-000000000008', 'c5c5c5c5-0000-0000-0000-00000000000c',
  'clinical_feedback',
  '{"consultationId":"d5d5d5d5-0000-0000-0000-000000000002","adherence":"completa","evolution":"mejoriaParcial","evolutionNote":"Corrección sucesiva: mejoría parcial sostenida.","adverseEvents":[],"treatmentApplied":"Fluoxetina 20 mg cada 24 h","treatmentModification":"Dosis reducida a 10 mg cada 24 h por somnolencia","revisedDiagnosis":null}',
  'corrective',
  id
from public.clinical_audit_events
where entity_id = 'd5d5d5d5-0000-0000-0000-000000000005'
  and action = 'clinical_feedback_recorded';

reset role;

select results_eq(
  $$select distinct supersedes_event_id from public.clinical_records
    where id in ('d5d5d5d5-0000-0000-0000-000000000007', 'd5d5d5d5-0000-0000-0000-000000000008')$$,
  $$select id from public.clinical_audit_events
    where entity_id = 'd5d5d5d5-0000-0000-0000-000000000005'
      and action = 'clinical_feedback_recorded'$$,
  'D7 · US10-AC5: las correctivas sucesivas apuntan todas al mismo evento del original'
);

-- ---------------------------------------------------------------------------
-- Revisión de la PR #28 (hallazgos 1 y 2): el vínculo de una corrección y la forma
-- canónica del consultationId son garantías del servidor, no del servicio. Sin ellas,
-- un INSERT directo por PostgREST abre una segunda cadena que el agregado cuenta dos
-- veces (SC-023) o registra una entrada que ninguna lectura por igualdad de texto
-- recupera (SC-023 · SC-035).
-- ---------------------------------------------------------------------------

-- Arrange: otra consulta cerrada de la misma clínica con su propia entrada, para
-- fabricar una corrección que salte de consulta.
select set_config('request.jwt.claims',
  '{"sub":"a5a5a5a5-0000-0000-0000-00000000000a","role":"authenticated","session_id":"5e5a5000-0000-0000-0000-00000000000a"}',
  true);
set local role authenticated;

insert into public.clinical_records (id, clinic_id, record_type, content, status)
values
  ('d5d5d5d5-0000-0000-0000-00000000000c', 'c5c5c5c5-0000-0000-0000-00000000000c',
   'consultation', '{"patientId":"d5d5d5d5-0000-0000-0000-000000000001","status":"open"}',
   'draft'),
  ('d5d5d5d5-0000-0000-0000-0000000000ec', 'c5c5c5c5-0000-0000-0000-00000000000c',
   'epicrisis', '{"consultationId":"d5d5d5d5-0000-0000-0000-00000000000c","motivoConsulta":"Control"}',
   'draft');
select public.approve_clinical_record('d5d5d5d5-0000-0000-0000-0000000000ec');

reset role;

select set_config('request.jwt.claims',
  '{"sub":"a5a5a5a5-0000-0000-0000-00000000000a","role":"authenticated","session_id":"5e5a5000-0000-0000-0000-00000000000a"}',
  true);
set local role authenticated;

insert into public.clinical_records (id, clinic_id, record_type, content, status)
values (
  'd5d5d5d5-0000-0000-0000-00000000000d', 'c5c5c5c5-0000-0000-0000-00000000000c',
  'clinical_feedback',
  '{"consultationId":"d5d5d5d5-0000-0000-0000-00000000000c","adherence":"completa","evolution":"mejoria","adverseEvents":[]}',
  'draft'
);

select throws_ok(
  $$insert into public.clinical_records (clinic_id, record_type, content, status)
  values ('c5c5c5c5-0000-0000-0000-00000000000c', 'clinical_feedback',
    '{"consultationId":"d5d5d5d5-0000-0000-0000-000000000002","adherence":"completa","evolution":"mejoria","adverseEvents":[]}',
    'corrective')$$,
  '23514', 'CLINICAL_FEEDBACK_INVALID_CONTENT',
  'FR-024 · D7: una corrección sin supersedes_event_id no encadena a nada y se rechaza'
);

select throws_ok(
  $$insert into public.clinical_records (clinic_id, record_type, content, status, supersedes_event_id)
  select 'c5c5c5c5-0000-0000-0000-00000000000c', 'clinical_feedback',
    '{"consultationId":"d5d5d5d5-0000-0000-0000-000000000002","adherence":"completa","evolution":"mejoria","adverseEvents":[]}',
    'corrective', id
  from public.clinical_audit_events
  where entity_id = 'd5d5d5d5-0000-0000-0000-000000000007'
    and action = 'corrective_record_created'$$,
  '23514', 'CLINICAL_FEEDBACK_INVALID_CONTENT',
  'D7 · SC-023: una corrección que apunta al evento de otra correctiva (segunda cadena) se rechaza'
);

select throws_ok(
  $$insert into public.clinical_records (clinic_id, record_type, content, status, supersedes_event_id)
  select 'c5c5c5c5-0000-0000-0000-00000000000c', 'clinical_feedback',
    '{"consultationId":"d5d5d5d5-0000-0000-0000-000000000002","adherence":"completa","evolution":"mejoria","adverseEvents":[]}',
    'corrective', id
  from public.clinical_audit_events
  where entity_id = 'd5d5d5d5-0000-0000-0000-000000000004'
    and action = 'epicrisis_approved'$$,
  '23514', 'CLINICAL_FEEDBACK_INVALID_CONTENT',
  'D7: una corrección de retroalimentación no puede encadenar al evento de otro tipo de registro'
);

select throws_ok(
  $$insert into public.clinical_records (clinic_id, record_type, content, status, supersedes_event_id)
  select 'c5c5c5c5-0000-0000-0000-00000000000c', 'clinical_feedback',
    '{"consultationId":"d5d5d5d5-0000-0000-0000-000000000002","adherence":"completa","evolution":"mejoria","adverseEvents":[]}',
    'corrective', id
  from public.clinical_audit_events
  where entity_id = 'd5d5d5d5-0000-0000-0000-00000000000d'
    and action = 'clinical_feedback_recorded'$$,
  '23514', 'CLINICAL_FEEDBACK_INVALID_CONTENT',
  'D7: la corrección no reasocia la entrada a otra consulta (el original refiere otra)'
);

select throws_ok(
  $$insert into public.clinical_records (clinic_id, record_type, content, status, supersedes_event_id)
  select 'c5c5c5c5-0000-0000-0000-00000000000c', 'clinical_feedback',
    '{"consultationId":"d5d5d5d5-0000-0000-0000-000000000002","adherence":"completa","evolution":"mejoria","adverseEvents":[]}',
    'draft', id
  from public.clinical_audit_events
  where entity_id = 'd5d5d5d5-0000-0000-0000-000000000005'
    and action = 'clinical_feedback_recorded'$$,
  '23514', 'CLINICAL_FEEDBACK_INVALID_CONTENT',
  'D7: una entrada que no es correctiva no puede declarar que sustituye a otra'
);

select throws_ok(
  $$insert into public.clinical_records (clinic_id, record_type, content, status)
  values ('c5c5c5c5-0000-0000-0000-00000000000c', 'clinical_feedback',
    '{"consultationId":"D5D5D5D5-0000-0000-0000-000000000002","adherence":"completa","evolution":"mejoria","adverseEvents":[]}',
    'draft')$$,
  '23514', 'CLINICAL_FEEDBACK_INVALID_CONTENT',
  'SC-023 · SC-035: un consultationId en mayúsculas resolvería la consulta pero ninguna lectura lo recuperaría'
);

select throws_ok(
  $$insert into public.clinical_records (clinic_id, record_type, content, status)
  values ('c5c5c5c5-0000-0000-0000-00000000000c', 'clinical_feedback',
    '{"consultationId":"{d5d5d5d5-0000-0000-0000-000000000002}","adherence":"completa","evolution":"mejoria","adverseEvents":[]}',
    'draft')$$,
  '23514', 'CLINICAL_FEEDBACK_INVALID_CONTENT',
  'SC-023 · SC-035: el consultationId se exige en su forma canónica (sin llaves ni otras variantes)'
);

reset role;

-- ---------------------------------------------------------------------------
-- FR-024 · SC-022 · US10-AC3/AC4: comparación final contra el snapshot — el
-- diagnóstico original y la epicrisis aprobada están intactos tras toda la
-- retroalimentación registrada y sus correcciones.
-- ---------------------------------------------------------------------------

select results_eq(
  $$select id, content, status, updated_at, approved_by, approved_at
    from public.clinical_records
    where id in ('d5d5d5d5-0000-0000-0000-000000000003', 'd5d5d5d5-0000-0000-0000-000000000004')
    order by id$$,
  $$select id, content, status, updated_at, approved_by, approved_at
    from snapshot_registros
    order by id$$,
  'FR-024 · SC-022 · US10-AC3/AC4: el diagnóstico original y la epicrisis aprobada permanecen byte-idénticos'
);

select * from finish();
rollback;
