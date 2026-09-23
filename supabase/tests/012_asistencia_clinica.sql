-- Suite pgTap: asistencia clínica proactiva.
--
-- Cambio: openspec/changes/implementar-asistencia-clinica-proactiva (tasks.md 1.1).
-- Escrita ANTES que supabase/migrations/013_asistencia_clinica.sql (Constitución II:
-- pruebas primero). Su «rojo» previo y su «verde» posterior se observan en el clúster
-- PostgreSQL scratch /tmp/verify-006 (patrón del quickstart de 002) y, como evidencia
-- oficial, en el job `database` de CI; la constancia vive en quickstart.md.
--
-- Patrón: supabase/tests/008_registro_clinico.sql y supabase/tests/002_attribution_immutability.sql
-- (dos veterinarios de una clínica con sesión de acceso activa, `set_config('request.jwt.claims', …)`
-- y `set local role authenticated`).
--
-- Dos grupos de aserciones (design.md D1/D3/D7/D8):
--   * Reuso de la convención FR-063 de 001 (verdes ya antes de la migración 013, la
--     documentan): acciones `hypothesis_added/accepted/discarded` y
--     `missing_information_decided`, atribución sellada, sellado por consulta cerrada heredado
--     de 002 y RPC de aprobación que solo acepta epicrisis.
--   * Invariantes del trigger 013 (EN ROJO antes de la migración, la razón prevista): la
--     fila `missing_information` ES la decisión (nace decidida), `added` es irreversible en la
--     hipótesis y la base de ambas entidades es inmutable.
--
-- Orden de las secciones: obedece a las dependencias de datos (el sellado exige una consulta
-- cerrada por aprobación de su epicrisis al final de la suite).

begin;
select plan(22);

-- ---------------------------------------------------------------------------
-- Arrange: dos veterinarios de una clínica, ambos con sesión de acceso activa.
-- ---------------------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', 'a6a6a6a6-0000-0000-0000-00000000000a',
   'authenticated', 'authenticated', 'ana.asistencia@example.test', 'not-a-real-hash',
   timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now())),
  ('00000000-0000-0000-0000-000000000000', 'b6b6b6b6-0000-0000-0000-00000000000b',
   'authenticated', 'authenticated', 'bruno.asistencia@example.test', 'not-a-real-hash',
   timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now()));

insert into public.clinics (id, name)
values ('c6c6c6c6-0000-0000-0000-00000000000c', 'Clínica de prueba de asistencia clínica');

insert into public.veterinarians (id, clinic_id, identifier, display_name)
values
  ('a6a6a6a6-0000-0000-0000-00000000000a', 'c6c6c6c6-0000-0000-0000-00000000000c',
   'ana.asistencia@example.test', 'Dra. Ana Asistencia'),
  ('b6b6b6b6-0000-0000-0000-00000000000b', 'c6c6c6c6-0000-0000-0000-00000000000c',
   'bruno.asistencia@example.test', 'Dr. Bruno Asistencia');

insert into public.access_sessions (veterinarian_id, auth_session_id)
values ('a6a6a6a6-0000-0000-0000-00000000000a', '5e6a2000-0000-0000-0000-00000000000a'),
       ('b6b6b6b6-0000-0000-0000-00000000000b', '5e6b2000-0000-0000-0000-00000000000b');

select set_config('request.jwt.claims',
  '{"sub":"a6a6a6a6-0000-0000-0000-00000000000a","role":"authenticated","session_id":"5e6a2000-0000-0000-0000-00000000000a"}',
  true);
set local role authenticated;

-- Consulta abierta de referencia para los grupos 1 y 2 (el patientId del contenido es una
-- referencia dentro de jsonb, sin FK — coste aceptado en D1 de 002 y D1 de este diseño).
insert into public.clinical_records (id, clinic_id, record_type, content, status)
values (
  'd6d6d6d6-0000-0000-0000-000000000001', 'c6c6c6c6-0000-0000-0000-00000000000c',
  'consultation',
  '{"patientId":"e6e6e6e6-0000-0000-0000-00000000000e","status":"open"}',
  'draft'
);

-- ---------------------------------------------------------------------------
-- Grupo 1 · ciclo de vida de la hipótesis (FR-029 · FR-063 · US8-AC2 · D7).
-- ---------------------------------------------------------------------------

insert into public.clinical_records (id, clinic_id, record_type, content, status)
values (
  'd6d6d6d6-0000-0000-0000-000000000002', 'c6c6c6c6-0000-0000-0000-00000000000c',
  'hypothesis',
  '{"consultationId":"d6d6d6d6-0000-0000-0000-000000000001","texto":"Ansiedad por separación","decision":"added","origen":"sistema","reglaId":"separationAnxiety","insumos":{"anamnesis":[{"recordId":"d6d6d6d6-0000-0000-0000-0000000000a1","field":"contexto","text":"Ocurre cuando el animal queda solo","provenance":"reportada","papel":"aFavor"}],"ficha":[],"faltante":["frecuencia","duracion"],"terminosMatch":["solo"]},"respaldo":{"knowledgeQueryId":null,"citas":[],"avisos":["sin_respaldo_documental"],"cobertura":null}}',
  'draft'
);

-- FR-029 · FR-063 · US8-AC2: el nacimiento de una hipótesis emite hypothesis_added
-- (convención existente del mapping de 001, D1/D7).
select results_eq(
  $$select action from public.clinical_audit_events
    where entity_id = 'd6d6d6d6-0000-0000-0000-000000000002'$$,
  $$values ('hypothesis_added'::text)$$,
  'FR-029 · FR-063 · US8-AC2: INSERT de hypothesis emite hypothesis_added'
);

-- FR-063: la atribución la sella el servidor (Ana), nunca el cliente.
select results_eq(
  $$select created_by from public.clinical_records
    where id = 'd6d6d6d6-0000-0000-0000-000000000002'$$,
  $$values ('a6a6a6a6-0000-0000-0000-00000000000a'::uuid)$$,
  'FR-063: el created_by de la hipótesis lo sella el servidor'
);

update public.clinical_records
set content = content || '{"decision":"accepted"}'::jsonb
where id = 'd6d6d6d6-0000-0000-0000-000000000002';

-- FR-029 · FR-063 · US8-AC2: aceptar emite hypothesis_accepted (content->>'decision', D7).
select results_eq(
  $$select count(*)::int from public.clinical_audit_events
    where entity_id = 'd6d6d6d6-0000-0000-0000-000000000002'
      and action = 'hypothesis_accepted'$$,
  $$values (1)$$,
  'FR-029 · FR-063 · US8-AC2: UPDATE con decision=accepted emite hypothesis_accepted'
);

update public.clinical_records
set content = content || '{"decision":"discarded"}'::jsonb
where id = 'd6d6d6d6-0000-0000-0000-000000000002';

-- FR-029 · US8-AC2: descartar emite hypothesis_discarded y queda registrada como descartada.
select results_eq(
  $$select count(*)::int from public.clinical_audit_events
    where entity_id = 'd6d6d6d6-0000-0000-0000-000000000002'
      and action = 'hypothesis_discarded'$$,
  $$values (1)$$,
  'FR-029 · US8-AC2: UPDATE con decision=discarded emite hypothesis_discarded'
);

-- D7 · HD5: aceptar ↔ descartar es reversible mientras la consulta siga abierta.
select lives_ok(
  $$update public.clinical_records
    set content = content || '{"decision":"accepted"}'::jsonb
    where id = 'd6d6d6d6-0000-0000-0000-000000000002'$$,
  'D7 · HD5: reconsiderar discarded → accepted vive'
);

-- D7 · D8 (EN ROJO antes de 013): la hipótesis nace como added; aceptarla en el INSERT
-- haría que el evento hypothesis_added mintiera el contenido.
select throws_ok(
  $$insert into public.clinical_records (clinic_id, record_type, content, status)
    values ('c6c6c6c6-0000-0000-0000-00000000000c', 'hypothesis',
      '{"consultationId":"d6d6d6d6-0000-0000-0000-000000000001","texto":"Fobia a ruidos","decision":"accepted","origen":"sistema","reglaId":"noisePhobia","insumos":{"anamnesis":[],"ficha":[],"faltante":[],"terminosMatch":[]},"respaldo":{"knowledgeQueryId":null,"citas":[],"avisos":[],"cobertura":null}}',
      'draft')$$,
  '23514',
  'HYPOTHESIS_DECISION_INVALID',
  'D7 · D8: una hipótesis no puede nacer aceptada (HYPOTHESIS_DECISION_INVALID)'
);

-- D7 · HD5 (EN ROJO antes de 013): added es irreversible — una hipótesis presentada no deja
-- de haberlo estado (su evento hypothesis_added es historia).
select throws_ok(
  $$update public.clinical_records
    set content = content || '{"decision":"added"}'::jsonb
    where id = 'd6d6d6d6-0000-0000-0000-000000000002'$$,
  '23514',
  'HYPOTHESIS_DECISION_IRREVERSIBLE',
  'D7 · HD5: volver a added fracasa con HYPOTHESIS_DECISION_IRREVERSIBLE'
);

-- FR-020 · US8-AC8 · D8 (EN ROJO antes de 013): la base de la hipótesis es inmutable en el
-- servidor — reescribir el texto haría mentir la reconstrucción de qué la produjo.
select throws_ok(
  $$update public.clinical_records
    set content = content || '{"texto":"Texto reescrito"}'::jsonb
    where id = 'd6d6d6d6-0000-0000-0000-000000000002'$$,
  '23514',
  'HYPOTHESIS_BASIS_IMMUTABLE',
  'FR-020 · US8-AC8 · D8: reescribir texto fracasa con HYPOTHESIS_BASIS_IMMUTABLE'
);

-- FR-020 · US8-AC8 · D8 (EN ROJO antes de 013): tampoco se reescriben los insumos (o el
-- respaldo, o el origen) que documentan antecedentes y fuentes.
select throws_ok(
  $$update public.clinical_records
    set content = content || '{"insumos":{"anamnesis":[],"ficha":[],"faltante":[],"terminosMatch":["falso"]}}'::jsonb
    where id = 'd6d6d6d6-0000-0000-0000-000000000002'$$,
  '23514',
  'HYPOTHESIS_BASIS_IMMUTABLE',
  'FR-020 · US8-AC8 · D8: reescribir insumos fracasa con HYPOTHESIS_BASIS_IMMUTABLE'
);

-- FR-010 · US8-AC3 · D8 (EN ROJO antes de 013): la asistencia nace y permanece en draft —
-- nunca un registro definitivo ni correctivo.
select throws_ok(
  $$insert into public.clinical_records (clinic_id, record_type, content, status)
    values ('c6c6c6c6-0000-0000-0000-00000000000c', 'hypothesis',
      '{"consultationId":"d6d6d6d6-0000-0000-0000-000000000001","texto":"Agresividad territorial","decision":"added","origen":"sistema","reglaId":"territorialAggression","insumos":{"anamnesis":[],"ficha":[],"faltante":[],"terminosMatch":[]},"respaldo":{"knowledgeQueryId":null,"citas":[],"avisos":[],"cobertura":null}}',
      'corrective')$$,
  '23514',
  'ASSISTANCE_STATUS_INVALID',
  'FR-010 · D8: una hipótesis no nace como registro correctivo (ASSISTANCE_STATUS_INVALID)'
);

-- D8 (EN ROJO antes de 013): la hipótesis exige su texto clínico.
select throws_ok(
  $$insert into public.clinical_records (clinic_id, record_type, content, status)
    values ('c6c6c6c6-0000-0000-0000-00000000000c', 'hypothesis',
      '{"consultationId":"d6d6d6d6-0000-0000-0000-000000000001","texto":"","decision":"added","origen":"sistema","reglaId":null,"insumos":{"anamnesis":[],"ficha":[],"faltante":[],"terminosMatch":[]},"respaldo":{"knowledgeQueryId":null,"citas":[],"avisos":[],"cobertura":null}}',
      'draft')$$,
  '23514',
  'ASSISTANCE_CONTENT_INVALID',
  'D8: una hipótesis sin texto fracasa con ASSISTANCE_CONTENT_INVALID'
);

insert into public.clinical_records (id, clinic_id, record_type, content, status)
values (
  'd6d6d6d6-0000-0000-0000-000000000004', 'c6c6c6c6-0000-0000-0000-00000000000c',
  'hypothesis',
  '{"consultationId":"d6d6d6d6-0000-0000-0000-000000000001","texto":"Hipótesis propia del veterinario","decision":"added","origen":"veterinario","reglaId":null,"insumos":{"anamnesis":[],"ficha":[],"faltante":[],"terminosMatch":[]},"respaldo":{"knowledgeQueryId":null,"citas":[],"avisos":["sin_respaldo_documental"],"cobertura":null}}',
  'draft'
);

-- FR-029 · US8-AC9: la hipótesis propia del veterinario queda junto a las del sistema,
-- distinguible por su origen.
select results_eq(
  $$select content ->> 'origen', content ->> 'decision'
    from public.clinical_records
    where id = 'd6d6d6d6-0000-0000-0000-000000000004'$$,
  $$values ('veterinario'::text, 'added'::text)$$,
  'FR-029 · US8-AC9: la hipótesis propia queda con origen=veterinario'
);

-- ---------------------------------------------------------------------------
-- Grupo 2 · la fila missing_information ES la decisión (FR-008 · FR-063 · US7-AC2/AC6 · D3).
-- ---------------------------------------------------------------------------

insert into public.clinical_records (id, clinic_id, record_type, content, status)
values (
  'd6d6d6d6-0000-0000-0000-000000000003', 'c6c6c6c6-0000-0000-0000-00000000000c',
  'missing_information',
  '{"consultationId":"d6d6d6d6-0000-0000-0000-000000000001","suggestionKey":"aloneContext","pregunta":"¿El comportamiento ocurre solo cuando el animal queda solo?","estado":"formulada","fundamento":{"kind":"criterio_general"},"camposRelacionados":["contexto"]}',
  'draft'
);

-- FR-008 · FR-063 · US7-AC6 · D3: decidir la sugerencia emite missing_information_decided
-- (el INSERT de missing_information es la decisión registrada, no la proposición).
select results_eq(
  $$select action from public.clinical_audit_events
    where entity_id = 'd6d6d6d6-0000-0000-0000-000000000003'$$,
  $$values ('missing_information_decided'::text)$$,
  'FR-008 · FR-063 · US7-AC6 · D3: INSERT de missing_information emite missing_information_decided'
);

update public.clinical_records
set content = content || '{"estado":"no_aplicable"}'::jsonb
where id = 'd6d6d6d6-0000-0000-0000-000000000003';

-- FR-008 · US7-AC2 · D3/D7: revisar la decisión reemite missing_information_decided.
select results_eq(
  $$select count(*)::int from public.clinical_audit_events
    where entity_id = 'd6d6d6d6-0000-0000-0000-000000000003'
      and action = 'missing_information_decided'$$,
  $$values (2)$$,
  'FR-008 · US7-AC2 · D3: revisar la decisión reemite missing_information_decided'
);

-- D3 · D8 (EN ROJO antes de 013): la fila no admite el estado pendiente — lo pendiente es
-- derivado por detección, nunca persistido.
select throws_ok(
  $$insert into public.clinical_records (clinic_id, record_type, content, status)
    values ('c6c6c6c6-0000-0000-0000-00000000000c', 'missing_information',
      '{"consultationId":"d6d6d6d6-0000-0000-0000-000000000001","suggestionKey":"frequency","pregunta":"¿Con qué frecuencia ocurre?","estado":"pendiente","fundamento":{"kind":"criterio_general"},"camposRelacionados":["frecuencia"]}',
      'draft')$$,
  '23514',
  'MISSING_INFORMATION_STATE_INVALID',
  'D3 · D8: una decisión no nace pendiente (MISSING_INFORMATION_STATE_INVALID)'
);

-- D8 (EN ROJO antes de 013): la decisión exige su pregunta.
select throws_ok(
  $$insert into public.clinical_records (clinic_id, record_type, content, status)
    values ('c6c6c6c6-0000-0000-0000-00000000000c', 'missing_information',
      '{"consultationId":"d6d6d6d6-0000-0000-0000-000000000001","suggestionKey":"duration","pregunta":"","estado":"ignorada","fundamento":{"kind":"criterio_general"},"camposRelacionados":["duracion"]}',
      'draft')$$,
  '23514',
  'ASSISTANCE_CONTENT_INVALID',
  'D8: una decisión sin pregunta fracasa con ASSISTANCE_CONTENT_INVALID'
);

-- FR-020 · D8 (EN ROJO antes de 013): la base de la decisión (pregunta, fundamento,
-- suggestionKey) es inmutable; solo cambia el estado.
select throws_ok(
  $$update public.clinical_records
    set content = content || '{"pregunta":"Pregunta reescrita"}'::jsonb
    where id = 'd6d6d6d6-0000-0000-0000-000000000003'$$,
  '23514',
  'MISSING_INFORMATION_BASIS_IMMUTABLE',
  'FR-020 · D8: reescribir la pregunta fracasa con MISSING_INFORMATION_BASIS_IMMUTABLE'
);

-- ---------------------------------------------------------------------------
-- Grupo 3 · garantías heredadas sobre las entidades de asistencia (FR-010 · FR-024 · FR-063).
-- ---------------------------------------------------------------------------

-- FR-063 (heredado de 001/004): ningún cliente fija columnas de atribución.
select throws_ok(
  $$update public.clinical_records
    set created_by = 'b6b6b6b6-0000-0000-0000-00000000000b', content = content
    where id = 'd6d6d6d6-0000-0000-0000-000000000002'$$,
  '42501',
  'permission denied for table clinical_records',
  'FR-063 (heredado): fijar created_by por cliente es imposible por grants'
);

-- FR-010 · US8-AC3 (heredado de 001): la RPC de aprobación solo acepta epicrisis — una
-- hipótesis jamás se convierte en registro aprobado.
select throws_ok(
  $$select public.approve_clinical_record('d6d6d6d6-0000-0000-0000-000000000002')$$,
  '22023',
  'INVALID_INPUT',
  'FR-010 · US8-AC3 (heredado): aprobar una hipótesis fracasa con INVALID_INPUT'
);

-- Arrange del sellado: consulta nueva con su hipótesis y su decisión, y la epicrisis que
-- cerrará la consulta al aprobarse (D4 de 002).
insert into public.clinical_records (id, clinic_id, record_type, content, status)
values (
  'd6d6d6d6-0000-0000-0000-000000000005', 'c6c6c6c6-0000-0000-0000-00000000000c',
  'consultation',
  '{"patientId":"e6e6e6e6-0000-0000-0000-00000000000e","status":"open"}',
  'draft'
);

insert into public.clinical_records (id, clinic_id, record_type, content, status)
values (
  'd6d6d6d6-0000-0000-0000-000000000006', 'c6c6c6c6-0000-0000-0000-00000000000c',
  'hypothesis',
  '{"consultationId":"d6d6d6d6-0000-0000-0000-000000000005","texto":"Ansiedad por separación","decision":"added","origen":"sistema","reglaId":"separationAnxiety","insumos":{"anamnesis":[],"ficha":[],"faltante":[],"terminosMatch":[]},"respaldo":{"knowledgeQueryId":null,"citas":[],"avisos":[],"cobertura":null}}',
  'draft'
);

insert into public.clinical_records (id, clinic_id, record_type, content, status)
values (
  'd6d6d6d6-0000-0000-0000-000000000007', 'c6c6c6c6-0000-0000-0000-00000000000c',
  'missing_information',
  '{"consultationId":"d6d6d6d6-0000-0000-0000-000000000005","suggestionKey":"aloneContext","pregunta":"¿El comportamiento ocurre solo cuando el animal queda solo?","estado":"formulada","fundamento":{"kind":"criterio_general"},"camposRelacionados":["contexto"]}',
  'draft'
);

insert into public.clinical_records (id, clinic_id, record_type, content, status)
values (
  'd6d6d6d6-0000-0000-0000-000000000008', 'c6c6c6c6-0000-0000-0000-00000000000c',
  'epicrisis',
  '{"consultationId":"d6d6d6d6-0000-0000-0000-000000000005","motivoConsulta":"Ansiedad por separación","antecedentesRelevantes":"Sin datos","hallazgosAnamnesis":"Destroza objetos cuando se queda solo","hipotesis":[{"texto":"Ansiedad por separación","estado":"propuesta"}],"diagnostico":"Ansiedad por separación","examenesSolicitados":[],"intervencionesPropuestas":[],"medicamentosAprobados":[],"recomendacionesTutor":"","planSeguimiento":{"pendientes":[]},"observaciones":""}',
  'draft'
);

reset role;

-- FR-012 · US3-AC2 (heredado de 002): Bruno aprueba la epicrisis y la consulta se cierra.
select set_config('request.jwt.claims',
  '{"sub":"b6b6b6b6-0000-0000-0000-00000000000b","role":"authenticated","session_id":"5e6b2000-0000-0000-0000-00000000000b"}',
  true);
set local role authenticated;

select lives_ok(
  $$select public.approve_clinical_record('d6d6d6d6-0000-0000-0000-000000000008')$$,
  'FR-012 (heredado): aprobar la epicrisis cierra su consulta'
);

-- FR-024 · D8 (heredado de 002, D5): al cerrarse la consulta, sus filas de asistencia se
-- sellan — la decisión de la hipótesis ya no es editable aunque su transición sea legal.
select throws_ok(
  $$update public.clinical_records
    set content = content || '{"decision":"accepted"}'::jsonb
    where id = 'd6d6d6d6-0000-0000-0000-000000000006'$$,
  '23514',
  'CLINICAL_RECORD_SEALED',
  'FR-024 · D8 (heredado): decidir hipótesis de consulta cerrada fracasa con CLINICAL_RECORD_SEALED'
);

select throws_ok(
  $$update public.clinical_records
    set content = content || '{"estado":"ignorada"}'::jsonb
    where id = 'd6d6d6d6-0000-0000-0000-000000000007'$$,
  '23514',
  'CLINICAL_RECORD_SEALED',
  'FR-024 · D8 (heredado): revisar decisión de consulta cerrada fracasa con CLINICAL_RECORD_SEALED'
);

reset role;

select * from finish();
rollback;
