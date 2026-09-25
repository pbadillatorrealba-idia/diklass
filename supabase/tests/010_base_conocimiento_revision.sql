-- Suite pgTap: revisión de la PR #30 sobre la base de conocimiento trazable.
--
-- Cambio: openspec/changes/implementar-base-conocimiento-trazable (tasks.md, sección 8).
-- Cada bloque fija un hallazgo de la revisión y se escribió ANTES de corregir
-- supabase/migrations/010_base_conocimiento.sql (Constitución II): su rojo previo y su
-- verde posterior quedan en quickstart.md.
--
-- Patrón: supabase/tests/009_base_conocimiento.sql (veterinarios con sesión de acceso
-- activa, `set_config('request.jwt.claims', …)` y `set local role authenticated`).

begin;
select plan(20);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', 'a1a1a1a1-0000-4000-8000-00000000000a',
   'authenticated', 'authenticated', 'ana.revision@example.test', 'not-a-real-hash',
   timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now())),
  ('00000000-0000-0000-0000-000000000000', 'c1c1c1c1-0000-4000-8000-00000000000c',
   'authenticated', 'authenticated', 'carlos.revision@example.test', 'not-a-real-hash',
   timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now()));

insert into public.clinics (id, name)
values
  ('11111111-1111-4000-8000-000000000001', 'Clínica de revisión de conocimiento'),
  ('22222222-2222-4000-8000-000000000002', 'Clínica ajena de revisión');

insert into public.veterinarians (id, clinic_id, identifier, display_name)
values
  ('a1a1a1a1-0000-4000-8000-00000000000a', '11111111-1111-4000-8000-000000000001',
   'ana.revision@example.test', 'Dra. Ana Revisión'),
  ('c1c1c1c1-0000-4000-8000-00000000000c', '22222222-2222-4000-8000-000000000002',
   'carlos.revision@example.test', 'Dr. Carlos Revisión');

insert into public.access_sessions (veterinarian_id, auth_session_id)
values
  ('a1a1a1a1-0000-4000-8000-00000000000a', '6a6a6a6a-0000-4000-8000-00000000000a'),
  ('c1c1c1c1-0000-4000-8000-00000000000c', '6c6c6c6c-0000-4000-8000-00000000000c');

-- Carlos registra un paciente en SU clínica (el paciente ajeno de los casos de abajo).
select set_config('request.jwt.claims',
  '{"sub":"c1c1c1c1-0000-4000-8000-00000000000c","role":"authenticated","session_id":"6c6c6c6c-0000-4000-8000-00000000000c"}',
  true);
set local role authenticated;

insert into public.clinical_records (id, clinic_id, record_type, content, status)
values (
  'dcdcdcdc-0000-4000-8000-000000000001', '22222222-2222-4000-8000-000000000002',
  'tutor', '{"name":"Sr. Tutor Ajeno","phone":null,"email":null}', 'draft'
), (
  'dcdcdcdc-0000-4000-8000-000000000002', '22222222-2222-4000-8000-000000000002',
  'patient',
  '{"name":"Paciente Ajeno","species":"canino","breed":null,"birthDate":null,"ageMonths":null,"weightKg":null,"sex":null,"reproductiveStatus":null,"antecedentes":{"medicalHistory":[],"preexistingDiseases":[],"currentMedications":[],"knownAllergies":[],"behavioralHistory":[]},"tutorId":"dcdcdcdc-0000-4000-8000-000000000001"}',
  'draft'
);

reset role;
select set_config('request.jwt.claims',
  '{"sub":"a1a1a1a1-0000-4000-8000-00000000000a","role":"authenticated","session_id":"6a6a6a6a-0000-4000-8000-00000000000a"}',
  true);
set local role authenticated;

insert into public.clinical_records (id, clinic_id, record_type, content, status)
values (
  'dadadada-0000-4000-8000-000000000001', '11111111-1111-4000-8000-000000000001',
  'tutor', '{"name":"Sra. Tutora Propia","phone":null,"email":null}', 'draft'
), (
  'dadadada-0000-4000-8000-000000000002', '11111111-1111-4000-8000-000000000001',
  'patient',
  '{"name":"Paciente Propio","species":"canino","breed":null,"birthDate":null,"ageMonths":null,"weightKg":null,"sex":null,"reproductiveStatus":null,"antecedentes":{"medicalHistory":[],"preexistingDiseases":[],"currentMedications":[],"knownAllergies":[],"behavioralHistory":[]},"tutorId":"dadadada-0000-4000-8000-000000000001"}',
  'draft'
);

-- ---------------------------------------------------------------------------
-- Hallazgo 4: el trigger valida la forma que la lectura exige (D2), para que una fila
-- incorporada por PostgREST no deje ilegible la recuperación de toda la clínica.
-- ---------------------------------------------------------------------------

select throws_ok(
  $$insert into public.knowledge_documents (clinic_id, content)
    values ('11111111-1111-4000-8000-000000000001',
      '{"bibliografia":{"titulo":"Texto en blanco"},"licencia":{"tipo":"CC0"},"fragmentos":[{"ordinal":1,"texto":"   "}]}')$$,
  '22023', 'KNOWLEDGE_SOURCE_INVALID',
  'D2: un fragmento hecho solo de espacios no es citable'
);

select throws_ok(
  $$insert into public.knowledge_documents (clinic_id, content)
    values ('11111111-1111-4000-8000-000000000001',
      '{"bibliografia":{"titulo":"Ordinales permutados"},"licencia":{"tipo":"CC0"},"fragmentos":[{"ordinal":2,"texto":"Segundo."},{"ordinal":1,"texto":"Primero."}]}')$$,
  '22023', 'KNOWLEDGE_SOURCE_INVALID',
  'D2: los fragmentos se guardan en el orden de su ordinal (1, 2, …)'
);

select throws_ok(
  $$insert into public.knowledge_documents (clinic_id, content)
    values ('11111111-1111-4000-8000-000000000001',
      '{"bibliografia":{"titulo":"Año como texto","anio":"2024"},"licencia":{"tipo":"CC0"},"fragmentos":[{"ordinal":1,"texto":"Uno."}]}')$$,
  '22023', 'KNOWLEDGE_SOURCE_INVALID',
  'FR-030: el año de publicación es un número entero'
);

select throws_ok(
  $$insert into public.knowledge_documents (clinic_id, content)
    values ('11111111-1111-4000-8000-000000000001',
      '{"bibliografia":{"titulo":"Autores sueltos","autores":"Dra. Una"},"licencia":{"tipo":"CC0"},"fragmentos":[{"ordinal":1,"texto":"Uno."}]}')$$,
  '22023', 'KNOWLEDGE_SOURCE_INVALID',
  'FR-030: los autores son una lista de nombres'
);

select throws_ok(
  $$insert into public.knowledge_documents (clinic_id, content)
    values ('11111111-1111-4000-8000-000000000001',
      '{"bibliografia":{"titulo":"   "},"licencia":{"tipo":"CC0"},"fragmentos":[{"ordinal":1,"texto":"Uno."}]}')$$,
  '22023', 'KNOWLEDGE_SOURCE_INVALID',
  'FR-030: un título hecho solo de espacios no identifica la fuente'
);

-- ---------------------------------------------------------------------------
-- Corpus de recuperación de esta suite.
-- ---------------------------------------------------------------------------

insert into public.knowledge_documents (id, clinic_id, content)
values (
  'e1e1e1e1-0000-4000-8000-000000000001', '11111111-1111-4000-8000-000000000001',
  '{"bibliografia":{"titulo":"Ansiedad (ficticia)"},"licencia":{"tipo":"CC0"},"fragmentos":[{"ordinal":1,"texto":"La ansiedad se evalúa con la historia clínica."}]}'
), (
  'e1e1e1e1-0000-4000-8000-000000000002', '11111111-1111-4000-8000-000000000001',
  '{"bibliografia":{"titulo":"Perros (ficticia)"},"licencia":{"tipo":"CC0"},"fragmentos":[{"ordinal":1,"texto":"Perro, perro, perro: el perro y otro perro con su perro."},{"ordinal":2,"texto":"Perro y perro: perro, perro y más perro."}]}'
), (
  'e1e1e1e1-0000-4000-8000-000000000003', '11111111-1111-4000-8000-000000000001',
  '{"bibliografia":{"titulo":"Convivencia entre especies (ficticia)"},"licencia":{"tipo":"CC0"},"fragmentos":[{"ordinal":1,"texto":"La convivencia exige presentaciones graduales y supervisadas en el hogar; con el tiempo y la paciencia de la familia, el gato acepta al nuevo compañero, incluso a un perro joven."}]}'
);

-- ---------------------------------------------------------------------------
-- Hallazgo 1: la consulta usa los lexemas tal cual, sin volver a talarlos.
-- ---------------------------------------------------------------------------

select ok(
  (select rank_cd > 0
   from public.search_knowledge_fragments('ansiedad', 5)
   where documento_id = 'e1e1e1e1-0000-4000-8000-000000000001'),
  'D4: el ranking puntúa el lexema «ansied» (no se re-tala a «ansi» y queda en 0)'
);

-- ---------------------------------------------------------------------------
-- Hallazgo 3: el corte p_limit no descarta en silencio la evidencia que califica.
-- ---------------------------------------------------------------------------

select results_eq(
  $$select documento_id, fragmento_ordinal
    from public.search_knowledge_fragments('convivencia de perro y gato', 1)$$,
  $$values ('e1e1e1e1-0000-4000-8000-000000000003'::uuid, 1::integer)$$,
  'FR-052 · D4: el fragmento que cubre más lemas entra antes del corte, aunque su rank_cd sea menor'
);

-- ---------------------------------------------------------------------------
-- Hallazgo 6: la RPC devuelve la palabra escrita junto a cada lexema de la pregunta.
-- ---------------------------------------------------------------------------

select results_eq(
  $$select lemas_pregunta, terminos_pregunta
    from public.search_knowledge_fragments('Ansiedad por separación: la ansiedad', 1)$$,
  $$values (array['ansied', 'separ'], array['Ansiedad', 'separación'])$$,
  'FR-022 · US5-AC8: cada lexema de la pregunta llega con la primera palabra que lo originó'
);

-- ---------------------------------------------------------------------------
-- Hallazgo 7: los fragmentos se indexan una vez al incorporar (índice GIN), no en cada
-- consulta; la tabla derivada solo se lee a través de la RPC.
-- ---------------------------------------------------------------------------

reset role;

select results_eq(
  $$select count(*)::integer from public.knowledge_fragments
    where documento_id = 'e1e1e1e1-0000-4000-8000-000000000002'$$,
  $$values (2)$$,
  'D4: incorporar la fuente materializa uno a uno sus fragmentos indexables'
);

select has_index('public', 'knowledge_fragments', 'knowledge_fragments_vector_idx',
  'D4: los fragmentos tienen índice GIN sobre su tsvector precalculado');

select is(
  (select am.amname::text
   from pg_index index_def
   join pg_class index_class on index_class.oid = index_def.indexrelid
   join pg_am am on am.oid = index_class.relam
   where index_class.relname = 'knowledge_fragments_vector_idx'),
  'gin',
  'D4: el índice de fragmentos es GIN'
);

select table_privs_are('public', 'knowledge_fragments', 'authenticated', array[]::text[],
  'D4: el rol de la API no lee ni escribe la tabla derivada (solo la RPC)');
select table_privs_are('public', 'knowledge_fragments', 'anon', array[]::text[],
  'D4: anon no toca la tabla derivada');

select is(
  (select count(*)::integer from public.knowledge_fragments
   where documento_id = 'e1e1e1e1-0000-4000-8000-000000000001'
     and vector = to_tsvector('spanish', 'La ansiedad se evalúa con la historia clínica.')),
  1,
  'D4: el vector precalculado es el mismo to_tsvector español del fragmento'
);

-- ---------------------------------------------------------------------------
-- Hallazgo 5: el paciente de contexto de una consulta es un paciente de la misma clínica.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub":"a1a1a1a1-0000-4000-8000-00000000000a","role":"authenticated","session_id":"6a6a6a6a-0000-4000-8000-00000000000a"}',
  true);
set local role authenticated;

select throws_ok(
  $$insert into public.knowledge_queries (clinic_id, question, patient_id, answer)
    values ('11111111-1111-4000-8000-000000000001', 'paciente ajeno',
      'dcdcdcdc-0000-4000-8000-000000000002',
      '{"pregunta":"paciente ajeno","patientId":"dcdcdcdc-0000-4000-8000-000000000002","segmentos":[],"cobertura":{"estado":"sin_evidencia","cubiertos":[],"noCubiertos":[]},"avisos":[]}')$$,
  '23514', 'KNOWLEDGE_QUERY_PATIENT_INVALID',
  'Principio V · FR-020: una consulta no referencia un paciente de otra clínica'
);

select throws_ok(
  $$insert into public.knowledge_queries (clinic_id, question, patient_id, answer)
    values ('11111111-1111-4000-8000-000000000001', 'tutor como paciente',
      'dadadada-0000-4000-8000-000000000001',
      '{"pregunta":"tutor como paciente","patientId":"dadadada-0000-4000-8000-000000000001","segmentos":[],"cobertura":{"estado":"sin_evidencia","cubiertos":[],"noCubiertos":[]},"avisos":[]}')$$,
  '23514', 'KNOWLEDGE_QUERY_PATIENT_INVALID',
  'FR-020: el contexto de paciente apunta a un registro de tipo paciente'
);

select throws_ok(
  $$insert into public.knowledge_queries (clinic_id, question, patient_id, answer)
    values ('11111111-1111-4000-8000-000000000001', 'paciente inexistente',
      '99999999-9999-4999-8999-999999999999',
      '{"pregunta":"paciente inexistente","patientId":"99999999-9999-4999-8999-999999999999","segmentos":[],"cobertura":{"estado":"sin_evidencia","cubiertos":[],"noCubiertos":[]},"avisos":[]}')$$,
  '23514', 'KNOWLEDGE_QUERY_PATIENT_INVALID',
  'Principio V: inexistente y ajeno fallan igual (el error no revela UUID de otra clínica)'
);

select lives_ok(
  $$insert into public.knowledge_queries (clinic_id, question, patient_id, answer)
    values ('11111111-1111-4000-8000-000000000001', 'paciente propio',
      'dadadada-0000-4000-8000-000000000002',
      '{"pregunta":"paciente propio","patientId":"dadadada-0000-4000-8000-000000000002","segmentos":[],"cobertura":{"estado":"sin_evidencia","cubiertos":[],"noCubiertos":[]},"avisos":[]}')$$,
  'FR-020 · FR-051: la consulta con un paciente de la propia clínica se registra'
);

select lives_ok(
  $$insert into public.knowledge_queries (clinic_id, question, patient_id, answer)
    values ('11111111-1111-4000-8000-000000000001', 'sin paciente', null,
      '{"pregunta":"sin paciente","patientId":null,"segmentos":[],"cobertura":{"estado":"sin_evidencia","cubiertos":[],"noCubiertos":[]},"avisos":[]}')$$,
  'FR-051: la consulta sin paciente se registra'
);

-- El guard de retirada no reescribe los fragmentos materializados: siguen indexados
-- (la cita a una fuente retirada sigue resolviendo) pero la RPC ya no los devuelve.
update public.knowledge_documents set status = 'withdrawn'
where id = 'e1e1e1e1-0000-4000-8000-000000000001';

select is(
  (select count(*)::integer from public.search_knowledge_fragments('ansiedad', 5)
   where documento_id = 'e1e1e1e1-0000-4000-8000-000000000001'),
  0,
  'FR-053: una fuente retirada no responde consultas nuevas con el índice precalculado'
);

select * from finish();
rollback;
