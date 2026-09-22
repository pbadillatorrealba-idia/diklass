-- Suite pgTap: base de conocimiento trazable.
--
-- Cambio: openspec/changes/implementar-base-conocimiento-trazable (tasks.md 1.1).
-- Escrita ANTES que supabase/migrations/010_base_conocimiento.sql (Constitución II:
-- pruebas primero). Su «rojo» previo y su «verde» posterior se observan con
-- `supabase test db` sobre el stack local y en el job `database` de CI; la evidencia
-- queda registrada en quickstart.md de este cambio.
--
-- Patrón: supabase/tests/008_registro_clinico.sql (dos veterinarios de una clínica con
-- sesión de acceso activa, `set_config('request.jwt.claims', …)` y `set local role
-- authenticated`) y supabase/tests/004_function_privileges.sql (function_privs_are /
-- table_privs_are).
--
-- Modelo (D1–D4 de design.md): las fuentes viven en public.knowledge_documents con los
-- fragmentos embebidos en `content` (claves camelCase: `bibliografia`, `licencia`,
-- `fragmentos`); las consultas del asistente en public.knowledge_queries (append-only);
-- la recuperación en la RPC search_knowledge_fragments (FTS española con cobertura de
-- lemas). La atribución de FR-069 vive en las columnas de la fila (sin acciones
-- enumeradas de FR-063 para fuentes, D3).

begin;
select plan(30);

-- ---------------------------------------------------------------------------
-- Arrange: ana y bruno (clínica principal), carlos (otra clínica) y daniela
-- (clínica principal, sin sesión de acceso activa).
-- ---------------------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', 'a0a0a0a0-0000-4000-8000-00000000000a',
   'authenticated', 'authenticated', 'ana.conocimiento@example.test', 'not-a-real-hash',
   timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now())),
  ('00000000-0000-0000-0000-000000000000', 'b0b0b0b0-0000-4000-8000-00000000000b',
   'authenticated', 'authenticated', 'bruno.conocimiento@example.test', 'not-a-real-hash',
   timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now())),
  ('00000000-0000-0000-0000-000000000000', 'c0c0c0c0-0000-4000-8000-00000000000c',
   'authenticated', 'authenticated', 'carlos.conocimiento@example.test', 'not-a-real-hash',
   timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now())),
  ('00000000-0000-0000-0000-000000000000', 'd0d0d0d0-0000-4000-8000-00000000000d',
   'authenticated', 'authenticated', 'daniela.conocimiento@example.test', 'not-a-real-hash',
   timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now()));

insert into public.clinics (id, name)
values
  ('11111111-0000-4000-8000-000000000001', 'Clínica de prueba de conocimiento'),
  ('22222222-0000-4000-8000-000000000002', 'Clínica ajena de conocimiento');

insert into public.veterinarians (id, clinic_id, identifier, display_name)
values
  ('a0a0a0a0-0000-4000-8000-00000000000a', '11111111-0000-4000-8000-000000000001',
   'ana.conocimiento@example.test', 'Dra. Ana Conocimiento'),
  ('b0b0b0b0-0000-4000-8000-00000000000b', '11111111-0000-4000-8000-000000000001',
   'bruno.conocimiento@example.test', 'Dr. Bruno Conocimiento'),
  ('c0c0c0c0-0000-4000-8000-00000000000c', '22222222-0000-4000-8000-000000000002',
   'carlos.conocimiento@example.test', 'Dr. Carlos Conocimiento'),
  ('d0d0d0d0-0000-4000-8000-00000000000d', '11111111-0000-4000-8000-000000000001',
   'daniela.conocimiento@example.test', 'Dra. Daniela Conocimiento');

insert into public.access_sessions (veterinarian_id, auth_session_id)
values
  ('a0a0a0a0-0000-4000-8000-00000000000a', '5a5a5a5a-0000-4000-8000-00000000000a'),
  ('b0b0b0b0-0000-4000-8000-00000000000b', '5b5b5b5b-0000-4000-8000-00000000000b'),
  ('c0c0c0c0-0000-4000-8000-00000000000c', '5c5c5c5c-0000-4000-8000-00000000000c');
-- daniela, deliberadamente, queda sin sesión de acceso.

-- ---------------------------------------------------------------------------
-- Incorporación con atribución (FR-069 · US5-AC13 · D3).
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub":"a0a0a0a0-0000-4000-8000-00000000000a","role":"authenticated","session_id":"5a5a5a5a-0000-4000-8000-00000000000a"}',
  true);
set local role authenticated;

insert into public.knowledge_documents (id, clinic_id, content)
values (
  'e0e0e0e0-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000001',
  '{"bibliografia":{"titulo":"Protocolo de evaluación conductual canina","autores":["Dra. Ficticia Uno"],"anio":2024,"revista":"Revista Ficticia de Etología"},"licencia":{"tipo":"CC BY 4.0 (ficticia)","nota":"Corpus sintético de demostración"},"fragmentos":[{"ordinal":1,"seccion":"Anamnesis","texto":"Revisar los antecedentes de apego y las rutinas del hogar antes de proponer modificación de conducta."},{"ordinal":2,"seccion":"Tratamiento","texto":"La desensibilización gradual a las ausencias es el pilar del tratamiento."}]}'
);

select results_eq(
  $$select created_by from public.knowledge_documents
    where id = 'e0e0e0e0-0000-4000-8000-000000000001'$$,
  $$values ('a0a0a0a0-0000-4000-8000-00000000000a'::uuid)$$,
  'FR-069 · US5-AC13: la incorporación sella a la identidad autenticada como creadora'
);

select results_eq(
  $$select status, (withdrawn_at is null) from public.knowledge_documents
    where id = 'e0e0e0e0-0000-4000-8000-000000000001'$$,
  $$values ('available'::text, true)$$,
  'FR-069 · US5-AC13: la fuente incorporada nace disponible y sin retirada'
);

select throws_ok(
  $$insert into public.knowledge_documents (id, clinic_id, content, created_by)
    values ('e0e0e0e0-0000-4000-8000-000000000011', '11111111-0000-4000-8000-000000000001',
      '{"bibliografia":{"titulo":"Impostora","autores":[]},"licencia":{"tipo":"CC BY 4.0 (ficticia)"},"fragmentos":[{"ordinal":1,"texto":"Texto cualquiera."}]}',
      'b0b0b0b0-0000-4000-8000-00000000000b')$$,
  '23514',
  'ATTRIBUTION_IMMUTABLE',
  'FR-069: incorporar una fuente atribuyéndola a otra identidad es rechazado'
);

select throws_ok(
  $$insert into public.knowledge_documents (id, clinic_id, content)
    values ('e0e0e0e0-0000-4000-8000-000000000012', '11111111-0000-4000-8000-000000000001',
      '{"bibliografia":{"titulo":"Sin fragmentos","autores":[]},"licencia":{"tipo":"CC BY 4.0 (ficticia)"},"fragmentos":[]}')$$,
  '22023',
  'KNOWLEDGE_SOURCE_INVALID',
  'FR-006: una fuente sin fragmentos no es incorporable (no habría nada que citar)'
);

select throws_ok(
  $$insert into public.knowledge_documents (id, clinic_id, content)
    values ('e0e0e0e0-0000-4000-8000-000000000013', '11111111-0000-4000-8000-000000000001',
      '{"licencia":{"tipo":"CC BY 4.0 (ficticia)"},"fragmentos":[{"ordinal":1,"texto":"Texto cualquiera."}]}')$$,
  '22023',
  'KNOWLEDGE_SOURCE_INVALID',
  'FR-030: una fuente sin bibliografia no es incorporable'
);

-- ---------------------------------------------------------------------------
-- Inmutabilidad del corpus y retirada (FR-053 · US5-AC12 · D3).
-- ---------------------------------------------------------------------------

select throws_ok(
  $$update public.knowledge_documents
    set content = content || '{"editado":true}'::jsonb
    where id = 'e0e0e0e0-0000-4000-8000-000000000001'$$,
  '23514',
  'KNOWLEDGE_SOURCE_IMMUTABLE',
  'FR-053: el contenido citable de una fuente no puede editarse tras incorporarla'
);

select throws_ok(
  $$update public.knowledge_documents
    set created_by = 'b0b0b0b0-0000-4000-8000-00000000000b'
    where id = 'e0e0e0e0-0000-4000-8000-000000000001'$$,
  '23514',
  'KNOWLEDGE_SOURCE_IMMUTABLE',
  'FR-069: la atribución de la incorporación es inamovible'
);

select throws_ok(
  $$delete from public.knowledge_documents
    where id = 'e0e0e0e0-0000-4000-8000-000000000001'$$,
  '42501',
  'permission denied for table knowledge_documents',
  'FR-053: no existe camino de borrado de fuentes para el rol de la API'
);

-- Bruno retira la fuente que incorporó Ana: el retiro queda atribuido a quien lo hace.
reset role;
select set_config('request.jwt.claims',
  '{"sub":"b0b0b0b0-0000-4000-8000-00000000000b","role":"authenticated","session_id":"5b5b5b5b-0000-4000-8000-00000000000b"}',
  true);
set local role authenticated;

update public.knowledge_documents
set status = 'withdrawn'
where id = 'e0e0e0e0-0000-4000-8000-000000000001';

select results_eq(
  $$select withdrawn_by from public.knowledge_documents
    where id = 'e0e0e0e0-0000-4000-8000-000000000001'$$,
  $$values ('b0b0b0b0-0000-4000-8000-00000000000b'::uuid)$$,
  'FR-069 · US5-AC13: el retiro sella a la identidad autenticada que lo hizo'
);

reset role;
select set_config('request.jwt.claims',
  '{"sub":"a0a0a0a0-0000-4000-8000-00000000000a","role":"authenticated","session_id":"5a5a5a5a-0000-4000-8000-00000000000a"}',
  true);
set local role authenticated;

insert into public.knowledge_documents (id, clinic_id, content)
values (
  'e0e0e0e0-0000-4000-8000-000000000002', '11111111-0000-4000-8000-000000000001',
  '{"bibliografia":{"titulo":"Convivencia perro-gato (ficticia)","autores":["Dr. Ficticio Dos"],"anio":2023},"licencia":{"tipo":"CC BY 4.0 (ficticia)"},"fragmentos":[{"ordinal":1,"texto":"Las presentaciones entre especies requieren sesiones cortas y supervisadas."}]}'
);

reset role;
select set_config('request.jwt.claims',
  '{"sub":"b0b0b0b0-0000-4000-8000-00000000000b","role":"authenticated","session_id":"5b5b5b5b-0000-4000-8000-00000000000b"}',
  true);
set local role authenticated;

update public.knowledge_documents
set status = 'withdrawn',
    withdrawn_by = 'a0a0a0a0-0000-4000-8000-00000000000a',
    withdrawn_at = '2020-01-01 00:00:00+00'
where id = 'e0e0e0e0-0000-4000-8000-000000000002';

select results_eq(
  $$select (withdrawn_by = 'b0b0b0b0-0000-4000-8000-00000000000b'), (withdrawn_at > '2021-01-01')
    from public.knowledge_documents
    where id = 'e0e0e0e0-0000-4000-8000-000000000002'$$,
  $$values (true, true)$$,
  'FR-069: los campos de retiro los sella el servidor, no el cliente'
);

select throws_ok(
  $$update public.knowledge_documents
    set content = content || '{"editado":true}'::jsonb
    where id = 'e0e0e0e0-0000-4000-8000-000000000001'$$,
  '23514',
  'KNOWLEDGE_SOURCE_IMMUTABLE',
  'FR-053: una fuente retirada conserva íntegro lo que sus citas identifican'
);

select throws_ok(
  $$update public.knowledge_documents
    set status = 'available'
    where id = 'e0e0e0e0-0000-4000-8000-000000000001'$$,
  '23514',
  'KNOWLEDGE_SOURCE_IMMUTABLE',
  'FR-053: la retirada no admite resurrección silenciosa (HD3)'
);

-- ---------------------------------------------------------------------------
-- Recuperación: FTS española, ranking y cobertura de lemas (FR-006 · US5-AC1 · D4).
-- ---------------------------------------------------------------------------

reset role;
select set_config('request.jwt.claims',
  '{"sub":"a0a0a0a0-0000-4000-8000-00000000000a","role":"authenticated","session_id":"5a5a5a5a-0000-4000-8000-00000000000a"}',
  true);
set local role authenticated;

insert into public.knowledge_documents (id, clinic_id, content)
values (
  'e0e0e0e0-0000-4000-8000-000000000003', '11111111-0000-4000-8000-000000000001',
  '{"bibliografia":{"titulo":"Guía de ansiedad por separación (ficticia)","autores":["Dra. Ficticia Tres"],"anio":2025,"revista":"Cuadernos Ficticios de Conducta"},"licencia":{"tipo":"CC BY 4.0 (ficticia)"},"fragmentos":[{"ordinal":1,"seccion":"Diagnóstico","texto":"La ansiedad por separación se diagnostica por la historia clínica y la videovigilancia domiciliaria."},{"ordinal":2,"seccion":"Manejo","texto":"El enriquecimiento ambiental y el ejercicio diario reducen la ansiedad generalizada."}]}'
),
(
  'e0e0e0e0-0000-4000-8000-000000000004', '11111111-0000-4000-8000-000000000001',
  '{"bibliografia":{"titulo":"Habituación al transportín (ficticia)","autores":["Dr. Ficticio Cuatro"],"anio":2022},"licencia":{"tipo":"CC BY 4.0 (ficticia)"},"fragmentos":[{"ordinal":1,"texto":"El transportín debe asociarse a experiencias positivas mediante habituación progresiva."}]}'
);

select results_eq(
  $$select documento_id, fragmento_ordinal
    from public.search_knowledge_fragments('ansiedad por separación', 5)
    order by rank_cd desc, documento_id, fragmento_ordinal
    limit 1$$,
  $$values ('e0e0e0e0-0000-4000-8000-000000000003'::uuid, 1::integer)$$,
  'FR-006 · US5-AC1: la búsqueda recupera primero el fragmento que cubre la pregunta'
);

select is(
  (select count(*)::integer
   from public.search_knowledge_fragments('ansiedad por separación', 1)),
  1,
  'FR-006: el tope p_limit acota el número de referencias devueltas'
);

select is(
  (select cardinality(lemas_pregunta)
   from public.search_knowledge_fragments('ansiedad por separación', 5)
   order by rank_cd desc limit 1),
  2,
  'FR-022: los lemas de la pregunta excluyen palabras vacías del español («por»)'
);

select is(
  (select (lemas_cubiertos <@ lemas_pregunta)
        and cardinality(lemas_cubiertos) = cardinality(lemas_pregunta)
   from public.search_knowledge_fragments('ansiedad por separación', 5)
   order by rank_cd desc limit 1),
  true,
  'FR-022 · SC-002: el fragmento exacto cubre la totalidad de los lemas consultados'
);

select is(
  (select count(*)::integer
   from public.search_knowledge_fragments('apego y rutinas del hogar', 5)),
  0,
  'FR-053 · US5-AC12: el fragmento de una fuente retirada no responde consultas nuevas'
);

-- ---------------------------------------------------------------------------
-- Aislamiento por clínica y por sesión de acceso (FR-069 · FR-006 · Principio V).
-- ---------------------------------------------------------------------------

reset role;
select set_config('request.jwt.claims',
  '{"sub":"c0c0c0c0-0000-4000-8000-00000000000c","role":"authenticated","session_id":"5c5c5c5c-0000-4000-8000-00000000000c"}',
  true);
set local role authenticated;

select is(
  (select count(*)::integer from public.knowledge_documents),
  0,
  'Principio V: una clínica ajena no lee la colección de otra'
);

select is(
  (select count(*)::integer from public.search_knowledge_fragments('ansiedad por separación', 5)),
  0,
  'Principio V: la recuperación no cruza el límite de clínica'
);

reset role;
select set_config('request.jwt.claims',
  '{"sub":"d0d0d0d0-0000-4000-8000-00000000000d","role":"authenticated","session_id":"00000000-0000-4000-8000-000000000000"}',
  true);
set local role authenticated;

select throws_ok(
  $$select * from public.search_knowledge_fragments('ansiedad por separación', 5)$$,
  '42501',
  'AUTHENTICATION_REQUIRED',
  'FR-069: sin sesión de acceso activa no hay consulta posible'
);

-- ---------------------------------------------------------------------------
-- knowledge_queries: registro append-only de la reconstrucción (FR-020 · US5-AC5 · D6).
-- ---------------------------------------------------------------------------

reset role;
select set_config('request.jwt.claims',
  '{"sub":"a0a0a0a0-0000-4000-8000-00000000000a","role":"authenticated","session_id":"5a5a5a5a-0000-4000-8000-00000000000a"}',
  true);
set local role authenticated;

insert into public.knowledge_queries (id, clinic_id, question, patient_id, answer)
values (
  'f0f0f0f0-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000001',
  '¿Qué antecedentes revisar ante ansiedad por separación?', null,
  '{"pregunta":"¿Qué antecedentes revisar ante ansiedad por separación?","patientId":null,"segmentos":[],"cobertura":{"estado":"sin_evidencia","cubiertos":[],"noCubiertos":[]},"avisos":[]}'
);

reset role;
select set_config('request.jwt.claims',
  '{"sub":"b0b0b0b0-0000-4000-8000-00000000000b","role":"authenticated","session_id":"5b5b5b5b-0000-4000-8000-00000000000b"}',
  true);
set local role authenticated;

select results_eq(
  $$select question from public.knowledge_queries
    where id = 'f0f0f0f0-0000-4000-8000-000000000001'$$,
  $$values ('¿Qué antecedentes revisar ante ansiedad por separación?')$$,
  'FR-020 · US5-AC5: lo que produjo una recomendación queda reconstruible en la clínica'
);

select throws_ok(
  $$update public.knowledge_queries
    set question = 'reescrita'
    where id = 'f0f0f0f0-0000-4000-8000-000000000001'$$,
  '42501',
  'permission denied for table knowledge_queries',
  'FR-020: la traza de consultas no es reescribible'
);

select throws_ok(
  $$delete from public.knowledge_queries
    where id = 'f0f0f0f0-0000-4000-8000-000000000001'$$,
  '42501',
  'permission denied for table knowledge_queries',
  'FR-020: la traza de consultas no es borrable'
);

select throws_ok(
  $$insert into public.knowledge_queries (id, clinic_id, question, patient_id, answer)
    values ('f0f0f0f0-0000-4000-8000-000000000002', '11111111-0000-4000-8000-000000000001',
      'pregunta con paciente fantasma', '99999999-9999-4999-8999-999999999999', '{}')$$,
  '23503',
  null,
  'FR-020: el contexto de paciente referenciado existe o la consulta no se registra'
);

-- ---------------------------------------------------------------------------
-- Privilegios mínimos (Principio V · patrón de 004_function_privileges.sql).
-- ---------------------------------------------------------------------------

select function_privs_are('public', 'search_knowledge_fragments',
  array['text', 'integer'], 'authenticated', array['EXECUTE'],
  'authenticated puede invocar la recuperación de evidencia');
select function_privs_are('public', 'search_knowledge_fragments',
  array['text', 'integer'], 'anon', array[]::text[],
  'anon no puede invocar la recuperación de evidencia');

select table_privs_are('public', 'knowledge_documents', 'authenticated',
  array['select', 'insert', 'update'],
  'el rol de la API incorpora, retira y lee fuentes; nunca borra');
select table_privs_are('public', 'knowledge_documents', 'anon',
  array[]::text[],
  'anon no toca la colección documental');

select table_privs_are('public', 'knowledge_queries', 'authenticated',
  array['select', 'insert'],
  'el rol de la API solo añade y lee el registro de consultas');
select table_privs_are('public', 'knowledge_queries', 'anon',
  array[]::text[],
  'anon no toca el registro de consultas');

select * from finish();
rollback;
