-- Suite pgTap: registro clínico longitudinal.
--
-- Cambio: openspec/changes/implementar-registro-clinico-longitudinal (tasks.md 1.1).
-- Escrita ANTES que supabase/migrations/009_registro_clinico.sql (Constitución II:
-- pruebas primero). Sin Docker/Supabase local en este entorno, su «rojo» previo y su
-- «verde» posterior se observan en el job `database` de CI (la URL se registra en
-- quickstart.md); aquí solo queda constancia documental del ciclo.
--
-- Patrón: supabase/tests/002_attribution_immutability.sql y
-- supabase/tests/fixtures/attribution.sql (dos veterinarios de una clínica con sesión de
-- acceso activa, `set_config('request.jwt.claims', …)` y `set local role authenticated`).
--
-- Modelo de contenido (D2 de design.md): todas las entidades son filas de
-- public.clinical_records con el detalle en `content jsonb` (claves camelCase).
-- Orden de las secciones: obedece a las dependencias de datos (la corrección de
-- procedencia exige consulta abierta; el sellado y la correctiva, consulta cerrada; la
-- comparación SC-009 exige snapshot antes de cerrar la segunda consulta).

begin;
select plan(31);

-- ---------------------------------------------------------------------------
-- Arrange: dos veterinarios de una clínica, ambos con sesión de acceso activa.
-- ---------------------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', 'a9a9a9a9-0000-0000-0000-00000000000a',
   'authenticated', 'authenticated', 'ana.registro@example.test', 'not-a-real-hash',
   timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now())),
  ('00000000-0000-0000-0000-000000000000', 'b9b9b9b9-0000-0000-0000-00000000000b',
   'authenticated', 'authenticated', 'bruno.registro@example.test', 'not-a-real-hash',
   timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now()));

insert into public.clinics (id, name)
values ('c9c9c9c9-0000-0000-0000-00000000000c', 'Clínica de prueba de registro clínico');

insert into public.veterinarians (id, clinic_id, identifier, display_name)
values
  ('a9a9a9a9-0000-0000-0000-00000000000a', 'c9c9c9c9-0000-0000-0000-00000000000c',
   'ana.registro@example.test', 'Dra. Ana Registro'),
  ('b9b9b9b9-0000-0000-0000-00000000000b', 'c9c9c9c9-0000-0000-0000-00000000000c',
   'bruno.registro@example.test', 'Dr. Bruno Registro');

insert into public.access_sessions (veterinarian_id, auth_session_id)
values ('a9a9a9a9-0000-0000-0000-00000000000a', '5e9a2000-0000-0000-0000-00000000000a'),
       ('b9b9b9b9-0000-0000-0000-00000000000b', '5e9b2000-0000-0000-0000-00000000000b');

-- ---------------------------------------------------------------------------
-- Ana registra tutor, ficha, consulta abierta, anamnesis y diagnóstico (grupo 1:
-- acciones FR-063 por entidad).
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub":"a9a9a9a9-0000-0000-0000-00000000000a","role":"authenticated","session_id":"5e9a2000-0000-0000-0000-00000000000a"}',
  true);
set local role authenticated;

insert into public.clinical_records (id, clinic_id, record_type, content, status)
values (
  'd9d9d9d9-0000-0000-0000-000000000001', 'c9c9c9c9-0000-0000-0000-00000000000c',
  'tutor',
  '{"name":"Sra. Tania Tutora","phone":"+56 9 5550 0001","email":null}',
  'draft'
);

-- FR-063 · FR-027 · US1-AC1: INSERT de tutor emite tutor_created.
select results_eq(
  $$select action from public.clinical_audit_events
    where entity_id = 'd9d9d9d9-0000-0000-0000-000000000001'$$,
  $$values ('tutor_created'::text)$$,
  'FR-063 · FR-027 · US1-AC1: INSERT de tutor emite tutor_created'
);

update public.clinical_records
set content = '{"name":"Sra. Tania Tutora","phone":"+56 9 5550 0002","email":null}'
where id = 'd9d9d9d9-0000-0000-0000-000000000001';

-- FR-063 · FR-027 (tutor que cambia de contacto): UPDATE de tutor emite tutor_updated.
select results_eq(
  $$select action from public.clinical_audit_events
    where entity_id = 'd9d9d9d9-0000-0000-0000-000000000001'
      and action = 'tutor_updated'$$,
  $$values ('tutor_updated'::text)$$,
  'FR-063 · FR-027: UPDATE de tutor emite tutor_updated'
);

insert into public.clinical_records (id, clinic_id, record_type, content, status)
values (
  'd9d9d9d9-0000-0000-0000-000000000002', 'c9c9c9c9-0000-0000-0000-00000000000c',
  'patient',
  '{"name":"Luna Registro","species":"canino","breed":"Mestizo","birthDate":"2021-03-10","ageMonths":null,"weightKg":null,"sex":"hembra","reproductiveStatus":"entera","antecedentes":{"medicalHistory":[],"preexistingDiseases":[],"currentMedications":[],"knownAllergies":[],"behavioralHistory":[]},"tutorId":"d9d9d9d9-0000-0000-0000-000000000001"}',
  'draft'
);

-- FR-063 · FR-001 · US1-AC1: INSERT de patient emite patient_created.
select results_eq(
  $$select action from public.clinical_audit_events
    where entity_id = 'd9d9d9d9-0000-0000-0000-000000000002'$$,
  $$values ('patient_created'::text)$$,
  'FR-063 · FR-001 · US1-AC1: INSERT de patient emite patient_created'
);

update public.clinical_records
set content = '{"name":"Luna Registro","species":"canino","breed":"Mestizo","birthDate":"2021-03-10","ageMonths":null,"weightKg":12.5,"sex":"hembra","reproductiveStatus":"entera","antecedentes":{"medicalHistory":[],"preexistingDiseases":[],"currentMedications":[],"knownAllergies":[],"behavioralHistory":[]},"tutorId":"d9d9d9d9-0000-0000-0000-000000000001"}'
where id = 'd9d9d9d9-0000-0000-0000-000000000002';

-- FR-063 · FR-001 · US1-AC2: UPDATE de patient emite patient_updated.
select results_eq(
  $$select action from public.clinical_audit_events
    where entity_id = 'd9d9d9d9-0000-0000-0000-000000000002'
      and action = 'patient_updated'$$,
  $$values ('patient_updated'::text)$$,
  'FR-063 · FR-001 · US1-AC2: UPDATE de patient emite patient_updated'
);

insert into public.clinical_records (id, clinic_id, record_type, content, status)
values (
  'd9d9d9d9-0000-0000-0000-000000000004', 'c9c9c9c9-0000-0000-0000-00000000000c',
  'consultation',
  '{"patientId":"d9d9d9d9-0000-0000-0000-000000000002","status":"open"}',
  'draft'
);

-- FR-063 · FR-003 · US2-AC1: INSERT de consultation emite consultation_opened.
select results_eq(
  $$select action from public.clinical_audit_events
    where entity_id = 'd9d9d9d9-0000-0000-0000-000000000004'$$,
  $$values ('consultation_opened'::text)$$,
  'FR-063 · FR-003 · US2-AC1: INSERT de consultation emite consultation_opened'
);

insert into public.clinical_records (id, clinic_id, record_type, content, status)
values (
  'd9d9d9d9-0000-0000-0000-000000000005', 'c9c9c9c9-0000-0000-0000-00000000000c',
  'anamnesis',
  '{"consultationId":"d9d9d9d9-0000-0000-0000-000000000004","field":"motivo_consulta","text":"Agresividad hacia visitas","provenance":"reportada"}',
  'draft'
);

-- FR-063 · FR-004 · US2-AC2: INSERT de anamnesis emite anamnesis_recorded.
select results_eq(
  $$select action from public.clinical_audit_events
    where entity_id = 'd9d9d9d9-0000-0000-0000-000000000005'$$,
  $$values ('anamnesis_recorded'::text)$$,
  'FR-063 · FR-004 · US2-AC2: INSERT de anamnesis emite anamnesis_recorded'
);

insert into public.clinical_records (id, clinic_id, record_type, content, status)
values (
  'd9d9d9d9-0000-0000-0000-000000000007', 'c9c9c9c9-0000-0000-0000-00000000000c',
  'diagnosis',
  '{"consultationId":"d9d9d9d9-0000-0000-0000-000000000004","text":"Ansiedad por separación"}',
  'draft'
);

-- FR-063 · US3-AC1: INSERT de diagnosis emite diagnosis_recorded.
select results_eq(
  $$select action from public.clinical_audit_events
    where entity_id = 'd9d9d9d9-0000-0000-0000-000000000007'$$,
  $$values ('diagnosis_recorded'::text)$$,
  'FR-063 · US3-AC1: INSERT de diagnosis emite diagnosis_recorded'
);

reset role;

-- ---------------------------------------------------------------------------
-- FR-004 · US2-AC6: Bruno agrega un antecedente a la anamnesis de la consulta que
-- abrió Ana; cada antecedente conserva a su autora.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub":"b9b9b9b9-0000-0000-0000-00000000000b","role":"authenticated","session_id":"5e9b2000-0000-0000-0000-00000000000b"}',
  true);
set local role authenticated;

insert into public.clinical_records (id, clinic_id, record_type, content, status)
values (
  'd9d9d9d9-0000-0000-0000-000000000006', 'c9c9c9c9-0000-0000-0000-00000000000c',
  'anamnesis',
  '{"consultationId":"d9d9d9d9-0000-0000-0000-000000000004","field":"comportamiento_problematico","text":"Ladridos prolongados en ausencia del tutor","provenance":"inferida"}',
  'draft'
);

-- FR-004 · US2-AC6: la anamnesis registrada por Ana conserva a Ana como creadora.
select results_eq(
  $$select created_by from public.clinical_records
    where id = 'd9d9d9d9-0000-0000-0000-000000000005'$$,
  $$values ('a9a9a9a9-0000-0000-0000-00000000000a'::uuid)$$,
  'FR-004 · US2-AC6: la anamnesis de Ana conserva a Ana como creadora'
);

-- FR-004 · US2-AC6: la anamnesis registrada por Bruno conserva a Bruno, no a quien abrió
-- la consulta.
select results_eq(
  $$select created_by from public.clinical_records
    where id = 'd9d9d9d9-0000-0000-0000-000000000006'$$,
  $$values ('b9b9b9b9-0000-0000-0000-00000000000b'::uuid)$$,
  'FR-004 · US2-AC6: la anamnesis de Bruno conserva a Bruno como creadora'
);

reset role;

-- ---------------------------------------------------------------------------
-- FR-021 · US2-AC5: Ana corrige la procedencia del antecedente de Bruno; la corrección
-- queda registrada y la procedencia anterior es recuperable.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub":"a9a9a9a9-0000-0000-0000-00000000000a","role":"authenticated","session_id":"5e9a2000-0000-0000-0000-00000000000a"}',
  true);
set local role authenticated;

update public.clinical_records
set content = '{"consultationId":"d9d9d9d9-0000-0000-0000-000000000004","field":"comportamiento_problematico","text":"Ladridos prolongados en ausencia del tutor","provenance":"reportada","provenanceHistory":[{"provenance":"inferida","text":"Ladridos prolongados en ausencia del tutor"}]}'
where id = 'd9d9d9d9-0000-0000-0000-000000000006';

-- FR-063 · FR-021 · US2-AC5 · SC-024: el UPDATE de anamnesis emite anamnesis_corrected con
-- la identidad de quien corrige (Ana), no la de la autora del antecedente (Bruno).
select results_eq(
  $$select action, actor_id from public.clinical_audit_events
    where entity_id = 'd9d9d9d9-0000-0000-0000-000000000006'
      and action = 'anamnesis_corrected'$$,
  $$values ('anamnesis_corrected'::text, 'a9a9a9a9-0000-0000-0000-00000000000a'::uuid)$$,
  'FR-063 · FR-021 · US2-AC5 · SC-024: corregir una anamnesis emite anamnesis_corrected con la identidad de quien corrige'
);

-- FR-021 · US2-AC5 · SC-024: la procedencia anterior queda en content->'provenanceHistory'
-- y es recuperable desde la propia fila (el ensamblado del historial es del servicio, D7).
select results_eq(
  $$select content -> 'provenanceHistory' -> 0 ->> 'provenance'
    from public.clinical_records
    where id = 'd9d9d9d9-0000-0000-0000-000000000006'$$,
  $$values ('inferida'::text)$$,
  'FR-021 · US2-AC5 · SC-024: la procedencia anterior queda en content->''provenanceHistory'''
);

-- ---------------------------------------------------------------------------
-- FR-010 · US3-AC3: la epicrisis nace como borrador y no es un registro definitivo.
-- ---------------------------------------------------------------------------

insert into public.clinical_records (id, clinic_id, record_type, content, status)
values (
  'd9d9d9d9-0000-0000-0000-000000000008', 'c9c9c9c9-0000-0000-0000-00000000000c',
  'epicrisis',
  '{"consultationId":"d9d9d9d9-0000-0000-0000-000000000004","motivoConsulta":"Agresividad hacia visitas","antecedentesRelevantes":"Sin antecedentes previos","hallazgosAnamnesis":"Ladridos prolongados en ausencia del tutor","hipotesis":[],"diagnostico":"Ansiedad por separación","examenesSolicitados":[],"intervencionesPropuestas":["Enriquecimiento ambiental"],"medicamentosAprobados":[],"recomendacionesTutor":"Evitar castigos al llegar","planSeguimiento":{"pendientes":["Control en 30 dias"]},"observaciones":""}',
  'draft'
);

-- FR-010 · US3-AC3: el borrador de epicrisis no es un registro approved.
select results_eq(
  $$select status, (approved_at is null) from public.clinical_records
    where id = 'd9d9d9d9-0000-0000-0000-000000000008'$$,
  $$values ('draft'::text, true)$$,
  'FR-010 · US3-AC3: la epicrisis en borrador no es un registro aprobado'
);

reset role;

-- ---------------------------------------------------------------------------
-- FR-012 · US3-AC2 + D4: Bruno aprueba la epicrisis y su consulta se cierra en la misma
-- transacción. (Re-aprobar falla APPROVED_RECORD_IMMUTABLE: ya probado en la suite 002,
-- no se duplica.)
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub":"b9b9b9b9-0000-0000-0000-00000000000b","role":"authenticated","session_id":"5e9b2000-0000-0000-0000-00000000000b"}',
  true);
set local role authenticated;

-- FR-012 · US3-AC2 + D4: la aprobación vive. El orden aprobación → cierre es obligatorio:
-- si el cierre viniera primero, el UPDATE de la epicrisis apuntaría a una consulta closed
-- y guard_consultation_sealed abortaría la aprobación con CLINICAL_RECORD_SEALED; este
-- lives_ok delata esa inversión.
select lives_ok(
  $$select public.approve_clinical_record('d9d9d9d9-0000-0000-0000-000000000008')$$,
  'FR-012 · US3-AC2 · D4: aprobar la epicrisis vive (si el cierre de la consulta viniera antes, el sellado la abortaría)'
);

-- FR-012 · US3-AC2 + D4: aprobar la epicrisis cierra la consulta vinculada en la misma
-- transacción (SC-014: toda consulta cerrada con su epicrisis).
select results_eq(
  $$select content ->> 'status' from public.clinical_records
    where id = 'd9d9d9d9-0000-0000-0000-000000000004'$$,
  $$values ('closed'::text)$$,
  'FR-012 · US3-AC2 · D4: la aprobación cierra la consulta vinculada en la misma transacción'
);

-- FR-012 · US3-AC2: el aprobador es el de la sesión (Bruno), distinto de la autora del
-- borrador (Ana).
select results_eq(
  $$select approved_by from public.clinical_records
    where id = 'd9d9d9d9-0000-0000-0000-000000000008'$$,
  $$values ('b9b9b9b9-0000-0000-0000-00000000000b'::uuid)$$,
  'FR-012 · US3-AC2: el aprobador se deriva de la sesión'
);

-- FR-012 · US3-AC2 + D4: el cierre de la consulta no emite evento propio; la única acción
-- de la consulta sigue siendo consultation_opened (clinical_record_action devuelve null
-- para UPDATE de consultation a propósito).
select results_eq(
  $$select action from public.clinical_audit_events
    where entity_id = 'd9d9d9d9-0000-0000-0000-000000000004'$$,
  $$values ('consultation_opened'::text)$$,
  'FR-012 · US3-AC2 · D4: cerrar la consulta no emite una acción de auditoría propia'
);

reset role;

-- ---------------------------------------------------------------------------
-- FR-024 · US3-AC4 + D8: la corrección de una epicrisis aprobada es un registro nuevo
-- (correctivo) que conserva el original sin modificación.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub":"a9a9a9a9-0000-0000-0000-00000000000a","role":"authenticated","session_id":"5e9a2000-0000-0000-0000-00000000000a"}',
  true);
set local role authenticated;

insert into public.clinical_records (id, clinic_id, record_type, content, status, supersedes_event_id)
select
  'd9d9d9d9-0000-0000-0000-000000000009', 'c9c9c9c9-0000-0000-0000-00000000000c',
  'epicrisis',
  '{"consultationId":"d9d9d9d9-0000-0000-0000-000000000004","motivoConsulta":"Agresividad hacia visitas","antecedentesRelevantes":"Sin antecedentes previos","hallazgosAnamnesis":"Ladridos prolongados en ausencia del tutor","hipotesis":[],"diagnostico":"Ansiedad por separación y estrés","examenesSolicitados":[],"intervencionesPropuestas":["Enriquecimiento ambiental"],"medicamentosAprobados":[],"recomendacionesTutor":"Evitar castigos al llegar","planSeguimiento":{"pendientes":["Control en 30 dias"]},"observaciones":""}',
  'corrective',
  evento.id
from public.clinical_audit_events evento
where evento.entity_id = 'd9d9d9d9-0000-0000-0000-000000000008'
  and evento.action = 'epicrisis_approved';

-- FR-063 · FR-024 · US3-AC4 · D8: el registro correctivo emite corrective_record_created.
select results_eq(
  $$select action from public.clinical_audit_events
    where entity_id = 'd9d9d9d9-0000-0000-0000-000000000009'$$,
  $$values ('corrective_record_created'::text)$$,
  'FR-063 · FR-024 · US3-AC4 · D8: INSERT con status corrective emite corrective_record_created'
);

-- FR-024 · US3-AC4 · D8: la correctiva nace con status='corrective' y supersedes_event_id
-- al evento epicrisis_approved del original.
select results_eq(
  $$select status, supersedes_event_id from public.clinical_records
    where id = 'd9d9d9d9-0000-0000-0000-000000000009'$$,
  $$select 'corrective'::text, evento.id
    from public.clinical_audit_events evento
    where evento.entity_id = 'd9d9d9d9-0000-0000-0000-000000000008'
      and evento.action = 'epicrisis_approved'$$,
  'FR-024 · US3-AC4 · D8: la correctiva nace correctiva y supersede el evento de aprobación original'
);

-- FR-024 · US3-AC4 · SC-009: la epicrisis original permanece sin modificación tras la
-- correctiva (100% de los registros aprobados sin modificar, comparable por historial).
select results_eq(
  $$select status, approved_by, content from public.clinical_records
    where id = 'd9d9d9d9-0000-0000-0000-000000000008'$$,
  $$values (
    'approved'::text,
    'b9b9b9b9-0000-0000-0000-00000000000b'::uuid,
    '{"consultationId":"d9d9d9d9-0000-0000-0000-000000000004","motivoConsulta":"Agresividad hacia visitas","antecedentesRelevantes":"Sin antecedentes previos","hallazgosAnamnesis":"Ladridos prolongados en ausencia del tutor","hipotesis":[],"diagnostico":"Ansiedad por separación","examenesSolicitados":[],"intervencionesPropuestas":["Enriquecimiento ambiental"],"medicamentosAprobados":[],"recomendacionesTutor":"Evitar castigos al llegar","planSeguimiento":{"pendientes":["Control en 30 dias"]},"observaciones":""}'::jsonb
  )$$,
  'FR-024 · US3-AC4 · SC-009: la epicrisis original permanece sin modificación tras crear la correctiva'
);

-- ---------------------------------------------------------------------------
-- FR-024 · US4-AC2 · SC-009 + D5: una consulta cerrada sella sus registros de trabajo, el
-- vínculo con la consulta es inmutable, y las fichas siguen editables.
-- ---------------------------------------------------------------------------

insert into public.clinical_records (id, clinic_id, record_type, content, status)
values (
  'd9d9d9d9-0000-0000-0000-00000000000a', 'c9c9c9c9-0000-0000-0000-00000000000c',
  'consultation',
  '{"patientId":"d9d9d9d9-0000-0000-0000-000000000002","status":"open"}',
  'draft'
);

insert into public.clinical_records (id, clinic_id, record_type, content, status)
values (
  'd9d9d9d9-0000-0000-0000-00000000000b', 'c9c9c9c9-0000-0000-0000-00000000000c',
  'anamnesis',
  '{"consultationId":"d9d9d9d9-0000-0000-0000-00000000000a","field":"frecuencia","text":"Diaria","provenance":"reportada"}',
  'draft'
);

-- FR-024 · US4-AC2 · SC-009 + D5: el vínculo con la consulta es inmutable aunque la
-- consulta siga abierta — re-apuntarlo o vaciarlo eludiría un sello evaluado sobre old.
select throws_ok(
  $$update public.clinical_records
    set content = '{"consultationId":"d9d9d9d9-0000-0000-0000-000000000004","field":"frecuencia","text":"Diaria","provenance":"reportada"}'
    where id = 'd9d9d9d9-0000-0000-0000-00000000000b'$$,
  '23514',
  'CONSULTATION_LINK_IMMUTABLE',
  'FR-024 · US4-AC2 · SC-009 · D5: re-apuntar content->>''consultationId'' fracasa con CONSULTATION_LINK_IMMUTABLE'
);

-- FR-024 · US4-AC2 · SC-009 + D5: la anamnesis de una consulta cerrada no puede
-- modificarse (los registros de la consulta anterior permanecen idénticos).
select throws_ok(
  $$update public.clinical_records
    set content = '{"consultationId":"d9d9d9d9-0000-0000-0000-000000000004","field":"motivo_consulta","text":"Texto alterado","provenance":"reportada"}'
    where id = 'd9d9d9d9-0000-0000-0000-000000000005'$$,
  '23514',
  'CLINICAL_RECORD_SEALED',
  'FR-024 · US4-AC2 · SC-009 · D5: UPDATE sobre anamnesis de consulta cerrada fracasa con CLINICAL_RECORD_SEALED'
);

-- FR-024 · US4-AC2 · SC-009 + D5: la anamnesis de una consulta abierta sigue siendo
-- editable sin cambiar su vínculo.
select lives_ok(
  $$update public.clinical_records
    set content = '{"consultationId":"d9d9d9d9-0000-0000-0000-00000000000a","field":"frecuencia","text":"Varias veces por semana","provenance":"reportada"}'
    where id = 'd9d9d9d9-0000-0000-0000-00000000000b'$$,
  'FR-024 · US4-AC2 · SC-009 · D5: la anamnesis de una consulta abierta sigue siendo editable'
);

-- FR-024 · US4-AC2 · SC-009 + D5 (caso límite «ficha ampliada entre consultas»): una ficha
-- patient no lleva consultationId y sigue editable aunque el paciente ya tenga consultas
-- cerradas. El contenido ampliado distingue hallazgo negativo explícito (negative:true),
-- hallazgo registrado (negative:false) y campo sin dato (lista vacía): FR-044 · SC-024.
select lives_ok(
  $$update public.clinical_records
    set content = '{"name":"Luna Registro","species":"canino","breed":"Mestizo","birthDate":"2021-03-10","ageMonths":null,"weightKg":12.5,"sex":"hembra","reproductiveStatus":"entera","antecedentes":{"medicalHistory":[],"preexistingDiseases":[{"text":"Dermatitis atópica","negative":false}],"currentMedications":[],"knownAllergies":[],"behavioralHistory":[{"text":"Sin agresividad previa","negative":true}]},"tutorId":"d9d9d9d9-0000-0000-0000-000000000001"}'
    where id = 'd9d9d9d9-0000-0000-0000-000000000002'$$,
  'FR-024 · US4-AC2 · SC-009 · D5: una ficha sin consultationId se amplía aunque la consulta esté cerrada (FR-044 · SC-024: negativo ≠ sin dato)'
);

-- ---------------------------------------------------------------------------
-- FR-027 · US1-AC4: un tutor responsable de más de un paciente se referencia desde
-- varias fichas sin duplicar sus datos (nivel dato; la deduplicación es del servicio).
-- ---------------------------------------------------------------------------

insert into public.clinical_records (id, clinic_id, record_type, content, status)
values (
  'd9d9d9d9-0000-0000-0000-000000000003', 'c9c9c9c9-0000-0000-0000-00000000000c',
  'patient',
  '{"name":"Nube Registro","species":"canino","breed":"Labrador","birthDate":"2019-07-02","ageMonths":null,"weightKg":28.4,"sex":"macho","reproductiveStatus":"castrado","antecedentes":{"medicalHistory":[],"preexistingDiseases":[],"currentMedications":[],"knownAllergies":[],"behavioralHistory":[]},"tutorId":"d9d9d9d9-0000-0000-0000-000000000001"}',
  'draft'
);

-- FR-027 · US1-AC4: dos fichas de paciente referencian al mismo tutor.
select results_eq(
  $$select count(*)::int, count(distinct content ->> 'tutorId')::int
    from public.clinical_records
    where record_type = 'patient'
      and content ->> 'tutorId' = 'd9d9d9d9-0000-0000-0000-000000000001'$$,
  $$values (2::int, 1::int)$$,
  'FR-027 · US1-AC4: dos pacientes referencian al mismo tutor sin duplicar sus datos'
);

reset role;

-- ---------------------------------------------------------------------------
-- FR-024 · US4-AC2 · SC-009: los registros de la consulta anterior permanecen idénticos
-- tras cerrar una segunda consulta — comparación de filas antes/después del cierre.
-- ---------------------------------------------------------------------------

-- Snapshot de todo lo registrado en la consulta A ANTES de cerrar la segunda consulta.
create temporary table registro_previo_consulta_a as
select * from public.clinical_records
where content ->> 'consultationId' = 'd9d9d9d9-0000-0000-0000-000000000004';

-- Ana cierra la segunda consulta por la misma vía: aprueba su epicrisis (D4).
select set_config('request.jwt.claims',
  '{"sub":"a9a9a9a9-0000-0000-0000-00000000000a","role":"authenticated","session_id":"5e9a2000-0000-0000-0000-00000000000a"}',
  true);
set local role authenticated;

insert into public.clinical_records (id, clinic_id, record_type, content, status)
values (
  'd9d9d9d9-0000-0000-0000-00000000000d', 'c9c9c9c9-0000-0000-0000-00000000000c',
  'epicrisis',
  '{"consultationId":"d9d9d9d9-0000-0000-0000-00000000000a","motivoConsulta":"Control de seguimiento","antecedentesRelevantes":"Ansiedad por separación en tratamiento","hallazgosAnamnesis":"Frecuencia diaria","hipotesis":[],"diagnostico":"Evolución favorable","examenesSolicitados":[],"intervencionesPropuestas":[],"medicamentosAprobados":[],"recomendacionesTutor":"Mantener rutina","planSeguimiento":{"pendientes":[]},"observaciones":""}',
  'draft'
);

select public.approve_clinical_record('d9d9d9d9-0000-0000-0000-00000000000d');

-- FR-024 · US4-AC2 · SC-009: condición del escenario — la segunda consulta quedó cerrada.
select results_eq(
  $$select content ->> 'status' from public.clinical_records
    where id = 'd9d9d9d9-0000-0000-0000-00000000000a'$$,
  $$values ('closed'::text)$$,
  'FR-024 · US4-AC2 · SC-009: la segunda consulta queda cerrada (condición del escenario de comparación)'
);

reset role;

-- FR-024 · US4-AC2 · SC-009: comparación del historial — todas las filas de la consulta
-- anterior (anamnesis, diagnóstico, epicrisis aprobada y correctiva) están intactas.
select results_eq(
  $$select * from public.clinical_records
    where content ->> 'consultationId' = 'd9d9d9d9-0000-0000-0000-000000000004'
    order by id$$,
  $$select * from registro_previo_consulta_a order by id$$,
  'FR-024 · US4-AC2 · SC-009: los registros de la consulta anterior permanecen idénticos tras cerrar la segunda consulta'
);

-- ---------------------------------------------------------------------------
-- FR-024 · US4-AC2 · SC-009 (revisión de la PR #27): el sellado también cubre INSERT.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub":"a9a9a9a9-0000-0000-0000-00000000000a","role":"authenticated","session_id":"5e9a2000-0000-0000-0000-00000000000a"}',
  true);
set local role authenticated;

-- No se pueden anexar registros de trabajo a una consulta cerrada por el camino directo
-- de PostgREST (el mismo modelo de amenazas T055 que motivó D5): el conjunto que muestra
-- el workspace de una consulta cerrada no puede crecer tras el cierre.
select throws_ok(
  $$insert into public.clinical_records (clinic_id, record_type, content, status)
    values ('c9c9c9c9-0000-0000-0000-00000000000c', 'anamnesis',
      '{"consultationId":"d9d9d9d9-0000-0000-0000-000000000004","field":"texto_libre","text":"Tarde","provenance":"reportada"}',
      'draft')$$,
  '23514',
  'CLINICAL_RECORD_SEALED',
  'FR-024 · US4-AC2 · SC-009: INSERT sobre una consulta cerrada fracasa con CLINICAL_RECORD_SEALED'
);

-- La epicrisis correctiva sigue anexándose legítimamente a la consulta cerrada (US3-AC4 · D8).
select lives_ok(
  $$insert into public.clinical_records (clinic_id, record_type, content, status, supersedes_event_id)
    select 'c9c9c9c9-0000-0000-0000-00000000000c', 'epicrisis',
      '{"consultationId":"d9d9d9d9-0000-0000-0000-000000000004","motivoConsulta":"Agresividad hacia visitas"}',
      'corrective', id
    from public.clinical_audit_events
    where entity_id = 'd9d9d9d9-0000-0000-0000-000000000008' and action = 'epicrisis_approved'
    limit 1$$,
  'FR-024 · US3-AC4 · D8: la epicrisis correctiva puede anexarse a la consulta cerrada'
);

-- La exención correctiva es solo de la epicrisis (D8): una anamnesis 'corrective' no puede
-- anexarse a la consulta cerrada.
select throws_ok(
  $$insert into public.clinical_records (clinic_id, record_type, content, status, supersedes_event_id)
    select 'c9c9c9c9-0000-0000-0000-00000000000c', 'anamnesis',
      '{"consultationId":"d9d9d9d9-0000-0000-0000-000000000004","field":"texto_libre","text":"Tarde","provenance":"reportada"}',
      'corrective', id
    from public.clinical_audit_events
    where entity_id = 'd9d9d9d9-0000-0000-0000-000000000008' and action = 'epicrisis_approved'
    limit 1$$,
  '23514',
  'CLINICAL_RECORD_SEALED',
  'FR-024 · US4-AC2 · SC-009: una anamnesis con status corrective no puede anexarse a la consulta cerrada'
);

-- ---------------------------------------------------------------------------
-- FR-024 · US4-AC2 · SC-009 (revisión de la PR #27): la consulta cerrada no se reabre.
-- ---------------------------------------------------------------------------

-- Reabrirla por el camino directo de PostgREST volvería editables todos sus registros.
select throws_ok(
  $$update public.clinical_records
    set content = content || '{"status":"open"}'
    where id = 'd9d9d9d9-0000-0000-0000-000000000004'$$,
  '23514',
  'CLINICAL_RECORD_SEALED',
  'FR-024 · US4-AC2 · SC-009: reabrir una consulta cerrada fracasa con CLINICAL_RECORD_SEALED'
);

-- Tampoco se altera ningún otro dato de la consulta cerrada (p. ej. su paciente).
select throws_ok(
  $$update public.clinical_records
    set content = content || '{"patientId":"d9d9d9d9-0000-0000-0000-000000000003"}'
    where id = 'd9d9d9d9-0000-0000-0000-000000000004'$$,
  '23514',
  'CLINICAL_RECORD_SEALED',
  'FR-024 · US4-AC2 · SC-009: la fila de una consulta cerrada es inmutable'
);

reset role;

select * from finish();
rollback;
