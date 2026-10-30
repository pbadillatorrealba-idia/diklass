-- Base de conocimiento trazable (cambio implementar-base-conocimiento-trazable).
--
-- Diseño: design.md D1–D4 y D6. El corpus documental NO es dato clínico atribuido y por
-- eso no vive en public.clinical_records ni se registra en public.clinical_audit_events
-- (la enumeración de FR-063 no tipifica fuentes): la atribución de FR-069 queda sellada
-- en las columnas de la fila y en los propios triggers (US5-AC13: al revisar la colección
-- consta quién y cuándo). Sin acciones enumeradas de FR-063 para estas transiciones
-- (Attribution.action = null en el cliente).
--
-- Superficie:
--   * public.knowledge_documents — una fuente clínica con `content` (claves camelCase:
--     `bibliografia`, `licencia`, `fragmentos` embebidos, D2) e inmutable salvo la única
--     transición de retirada (FR-053 · HD3).
--   * public.knowledge_queries — registro append-only de las consultas al asistente con
--     la respuesta compuesta (FR-020 · D6).
--   * public.knowledge_fragments — fragmentos materializados al incorporar, con su
--     tsvector español precalculado e índice GIN (D4); solo la RPC los lee.
--   * public.search_knowledge_fragments(text, integer) — recuperación FTS española con
--     ranking ts_rank_cd y cobertura de lemas (FR-006/FR-022 · D4).
--
-- Escrita DESPUÉS que supabase/tests/009_base_conocimiento.sql (Constitución II).

create table public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  status text not null default 'available' check (status in ('available', 'withdrawn')),
  content jsonb not null default '{}'::jsonb,
  created_by uuid not null default auth.uid() references public.veterinarians(id),
  created_at timestamptz not null default timezone('utc', now()),
  withdrawn_by uuid references public.veterinarians(id),
  withdrawn_at timestamptz,
  constraint knowledge_documents_withdrawal_shape
    check ((status = 'withdrawn') = (withdrawn_at is not null)
       and (status = 'withdrawn') = (withdrawn_by is not null))
);

create index knowledge_documents_clinic_idx on public.knowledge_documents(clinic_id, created_at);

create table public.knowledge_queries (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  question text not null check (length(btrim(question)) > 0),
  patient_id uuid references public.clinical_records(id),
  answer jsonb not null check (
    jsonb_typeof(answer) = 'object'
    and answer ? 'pregunta'
    and answer ? 'segmentos'
    and answer ? 'cobertura'
    and answer ? 'avisos'
  ),
  created_at timestamptz not null default timezone('utc', now())
);

create index knowledge_queries_clinic_idx on public.knowledge_queries(clinic_id, created_at);
create index knowledge_queries_patient_idx on public.knowledge_queries(patient_id);

-- Fragmentos indexables (D4 · revisión de la PR #30): el contenido citable es inmutable
-- (solo existe la transición a `withdrawn`), así que cada fragmento se materializa una
-- sola vez al incorporar la fuente, con su tsvector español ya calculado. La recuperación
-- filtra por el índice GIN en vez de talar el corpus entero en cada pregunta. El estado
-- (disponible o retirada) se sigue leyendo de knowledge_documents.
create table public.knowledge_fragments (
  documento_id uuid not null references public.knowledge_documents(id),
  ordinal integer not null check (ordinal > 0),
  clinic_id uuid not null references public.clinics(id),
  seccion text,
  texto text not null,
  vector tsvector generated always as (to_tsvector('spanish'::regconfig, texto)) stored,
  primary key (documento_id, ordinal)
);

create index knowledge_fragments_vector_idx on public.knowledge_fragments using gin (vector);
create index knowledge_fragments_clinic_idx on public.knowledge_fragments(clinic_id);

-- El paciente de contexto de una consulta es un paciente de la misma clínica (revisión de
-- la PR #30). Corre con los derechos de quien inserta, así que la RLS de clinical_records
-- ya oculta lo ajeno; y como el trigger va antes que la FK, un UUID inexistente y uno de
-- otra clínica fallan con el mismo error y no sirven de oráculo.
create or replace function public.guard_knowledge_query_patient()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  if new.patient_id is not null and not exists (
    select 1 from public.clinical_records as paciente
     where paciente.id = new.patient_id
       and paciente.clinic_id = new.clinic_id
       and paciente.record_type = 'patient'
  ) then
    raise exception 'KNOWLEDGE_QUERY_PATIENT_INVALID' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger knowledge_queries_guard_patient
before insert on public.knowledge_queries
for each row execute function public.guard_knowledge_query_patient();

-- ---------------------------------------------------------------------------
-- Ciclo de vida de la fuente (D3): incorporar (INSERT) y retirar (la única UPDATE
-- permitida). El servidor sella toda atribución; el cliente no fija nada.
-- ---------------------------------------------------------------------------

create or replace function public.guard_knowledge_source_lifecycle()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
declare
  v_total integer;
  v_invalidos integer;
begin
  if tg_op = 'INSERT' then
    -- FR-069: la atribución (identidad y momento) la fija el servidor.
    if new.created_by is distinct from auth.uid()
       or new.created_at is distinct from timezone('utc', now())
       or new.withdrawn_by is not null
       or new.withdrawn_at is not null then
      raise exception 'ATTRIBUTION_IMMUTABLE' using errcode = '23514';
    end if;
    if new.status is distinct from 'available' then
      raise exception 'KNOWLEDGE_SOURCE_INVALID' using errcode = '22023';
    end if;

    -- Forma del contenido (D2): la misma que exige la lectura (fuenteContentSchema). Una
    -- fila que el cliente no pudiera leer dejaría ilegible la recuperación de la clínica,
    -- así que se rechaza aquí (revisión de la PR #30). Comprobaciones secuenciales: SQL no
    -- garantiza el orden de evaluación de un OR y algunas llevan conversiones de tipo.
    if jsonb_typeof(new.content) is distinct from 'object'
       or jsonb_typeof(new.content -> 'bibliografia') is distinct from 'object'
       or jsonb_typeof(new.content -> 'licencia') is distinct from 'object'
       or jsonb_typeof(new.content -> 'fragmentos') is distinct from 'array' then
      raise exception 'KNOWLEDGE_SOURCE_INVALID' using errcode = '22023';
    end if;

    -- Título y tipo de licencia: texto no vacío.
    if jsonb_typeof(new.content -> 'bibliografia' -> 'titulo') is distinct from 'string'
       or jsonb_typeof(new.content -> 'licencia' -> 'tipo') is distinct from 'string' then
      raise exception 'KNOWLEDGE_SOURCE_INVALID' using errcode = '22023';
    end if;
    if btrim(new.content -> 'bibliografia' ->> 'titulo') = ''
       or btrim(new.content -> 'licencia' ->> 'tipo') = '' then
      raise exception 'KNOWLEDGE_SOURCE_INVALID' using errcode = '22023';
    end if;

    -- Campos opcionales de texto: ausentes, null o texto.
    if exists (
      select 1
        from (values
          (new.content -> 'bibliografia' -> 'revista'),
          (new.content -> 'bibliografia' -> 'editorial'),
          (new.content -> 'bibliografia' -> 'edicion'),
          (new.content -> 'bibliografia' -> 'doi'),
          (new.content -> 'bibliografia' -> 'url'),
          (new.content -> 'licencia' -> 'nota')
        ) as campo(valor)
       where coalesce(jsonb_typeof(campo.valor), 'null') not in ('null', 'string')
    ) then
      raise exception 'KNOWLEDGE_SOURCE_INVALID' using errcode = '22023';
    end if;

    -- Año: ausente, null o entero positivo.
    if coalesce(jsonb_typeof(new.content -> 'bibliografia' -> 'anio'), 'null') not in ('null', 'number') then
      raise exception 'KNOWLEDGE_SOURCE_INVALID' using errcode = '22023';
    end if;
    if jsonb_typeof(new.content -> 'bibliografia' -> 'anio') = 'number'
       and ((new.content -> 'bibliografia' ->> 'anio')::numeric <= 0
            or (new.content -> 'bibliografia' ->> 'anio')::numeric % 1 <> 0) then
      raise exception 'KNOWLEDGE_SOURCE_INVALID' using errcode = '22023';
    end if;

    -- Autores: ausente, null o lista de nombres no vacíos.
    if coalesce(jsonb_typeof(new.content -> 'bibliografia' -> 'autores'), 'null') not in ('null', 'array') then
      raise exception 'KNOWLEDGE_SOURCE_INVALID' using errcode = '22023';
    end if;
    if jsonb_typeof(new.content -> 'bibliografia' -> 'autores') = 'array' and exists (
      select 1
        from jsonb_array_elements(new.content -> 'bibliografia' -> 'autores') as autor(valor)
       where jsonb_typeof(autor.valor) is distinct from 'string'
          or btrim(autor.valor #>> '{}') = ''
    ) then
      raise exception 'KNOWLEDGE_SOURCE_INVALID' using errcode = '22023';
    end if;

    -- Fragmentos: al menos uno; cada uno con ordinal igual a su posición (1, 2, …, sin
    -- huecos, repetidos ni permutaciones), texto no vacío y sección opcional de texto.
    select count(*),
           count(*) filter (
             where jsonb_typeof(fragmento.value) is distinct from 'object'
                or jsonb_typeof(fragmento.value -> 'ordinal') is distinct from 'number'
                or fragmento.value ->> 'ordinal' is distinct from fragmento.posicion::text
                or jsonb_typeof(fragmento.value -> 'texto') is distinct from 'string'
                or btrim(coalesce(fragmento.value ->> 'texto', '')) = ''
                or coalesce(jsonb_typeof(fragmento.value -> 'seccion'), 'null') not in ('null', 'string'))
      into v_total, v_invalidos
      from jsonb_array_elements(new.content -> 'fragmentos') with ordinality
             as fragmento(value, posicion);

    if v_total = 0 or v_invalidos > 0 then
      raise exception 'KNOWLEDGE_SOURCE_INVALID' using errcode = '22023';
    end if;

    return new;
  end if;

  -- UPDATE: solo la transición available → withdrawn, con la atribución del retiro
  -- sellada aquí mismo (FR-053 · FR-069 · US5-AC12/AC13). Todo lo demás —editar el
  -- contenido citable, la atribución de la incorporación o resucitar la fuente—
  -- fracasa: la corrección de una fuente es retirarla e incorporar una nueva (HD3).
  if old.status is distinct from 'available'
     or new.status is distinct from 'withdrawn'
     or new.id is distinct from old.id
     or new.content is distinct from old.content
     or new.clinic_id is distinct from old.clinic_id
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'KNOWLEDGE_SOURCE_IMMUTABLE' using errcode = '23514';
  end if;

  new.withdrawn_by := auth.uid();
  new.withdrawn_at := timezone('utc', now());
  return new;
end;
$$;

create trigger knowledge_documents_guard_lifecycle
before insert or update on public.knowledge_documents
for each row execute function public.guard_knowledge_source_lifecycle();

-- Observabilidad (Constitución IV): cada incorporación o retiro deja su evento
-- estructurado, con el patrón de public.audit_clinical_record (security definer para
-- poder invocar log_server_event, que no es callable por los roles de la API).
create or replace function public.log_knowledge_source_change()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform public.log_server_event(
    'knowledge_source_lifecycle', lower(tg_op), 'ok', null,
    jsonb_build_object('documentId', new.id, 'status', new.status)
  );
  return new;
end;
$$;

create trigger knowledge_documents_log_change
after insert or update on public.knowledge_documents
for each row execute function public.log_knowledge_source_change();

-- Materialización de los fragmentos indexables (D4): una vez, al incorporar. Security
-- definer porque el rol de la API no tiene privilegios sobre knowledge_fragments; el
-- contenido ya pasó el guard de forma de arriba.
create or replace function public.materialize_knowledge_fragments()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  insert into public.knowledge_fragments (documento_id, ordinal, clinic_id, seccion, texto)
  select new.id,
         (fragmento.value ->> 'ordinal')::integer,
         new.clinic_id,
         fragmento.value ->> 'seccion',
         fragmento.value ->> 'texto'
    from jsonb_array_elements(new.content -> 'fragmentos') as fragmento;
  return new;
end;
$$;

create trigger knowledge_documents_materialize_fragments
after insert on public.knowledge_documents
for each row execute function public.materialize_knowledge_fragments();

-- ---------------------------------------------------------------------------
-- RLS y privilegios: la colección es compartida dentro de la clínica; el registro de
-- consultas es append-only (solo select/insert). Sin DELETE en ninguna de las tres;
-- knowledge_fragments ni siquiera es visible para los roles de la API.
-- ---------------------------------------------------------------------------

alter table public.knowledge_documents enable row level security;
alter table public.knowledge_queries enable row level security;
-- Sin políticas ni privilegios: a knowledge_fragments solo llegan el trigger de
-- materialización y la RPC de búsqueda, ambos security definer.
alter table public.knowledge_fragments enable row level security;

create policy "active clinic veterinarians can read the shared collection"
on public.knowledge_documents for select to authenticated
using (
  public.is_active_access(auth.uid())
  and exists (
    select 1 from public.veterinarians veterinarian
    where veterinarian.id = auth.uid() and veterinarian.clinic_id = knowledge_documents.clinic_id
  )
);

create policy "active clinic veterinarians can incorporate knowledge sources"
on public.knowledge_documents for insert to authenticated
with check (
  public.is_active_access(auth.uid())
  and created_by = auth.uid()
  and exists (
    select 1 from public.veterinarians veterinarian
    where veterinarian.id = auth.uid() and veterinarian.clinic_id = knowledge_documents.clinic_id
  )
);

-- La única mutación que llega aquí es la retirada: el trigger guarda su forma.
create policy "active clinic veterinarians can withdraw knowledge sources"
on public.knowledge_documents for update to authenticated
using (
  public.is_active_access(auth.uid())
  and exists (
    select 1 from public.veterinarians veterinarian
    where veterinarian.id = auth.uid() and veterinarian.clinic_id = knowledge_documents.clinic_id
  )
)
with check (
  public.is_active_access(auth.uid())
  and exists (
    select 1 from public.veterinarians veterinarian
    where veterinarian.id = auth.uid() and veterinarian.clinic_id = knowledge_documents.clinic_id
  )
);

create policy "active clinic veterinarians can read the knowledge query log"
on public.knowledge_queries for select to authenticated
using (
  public.is_active_access(auth.uid())
  and exists (
    select 1 from public.veterinarians veterinarian
    where veterinarian.id = auth.uid() and veterinarian.clinic_id = knowledge_queries.clinic_id
  )
);

create policy "active clinic veterinarians can record knowledge queries"
on public.knowledge_queries for insert to authenticated
with check (
  public.is_active_access(auth.uid())
  and exists (
    select 1 from public.veterinarians veterinarian
    where veterinarian.id = auth.uid() and veterinarian.clinic_id = knowledge_queries.clinic_id
  )
);

revoke all on public.knowledge_documents from anon;
revoke all on public.knowledge_documents from authenticated;
grant select, insert, update on public.knowledge_documents to authenticated;

revoke all on public.knowledge_queries from anon;
revoke all on public.knowledge_queries from authenticated;
grant select, insert on public.knowledge_queries to authenticated;

revoke all on public.knowledge_fragments from anon;
revoke all on public.knowledge_fragments from authenticated;

-- ---------------------------------------------------------------------------
-- Recuperación de evidencia (D4): FTS española sobre los fragmentos materializados
-- (índice GIN), ranking ts_rank_cd y cobertura de lemas (insumo del umbral de respaldo y
-- del aviso de cobertura parcial de FR-022/FR-023 en composeAnswer). Security definer con
-- el patrón de approve_clinical_record: revalida sesión activa, acota a la clínica y solo
-- recorre fuentes disponibles (FR-053: lo retirado no responde consultas nuevas).
-- ---------------------------------------------------------------------------

create or replace function public.search_knowledge_fragments(
  p_query text,
  p_limit integer default 25
)
returns table (
  documento_id uuid,
  fragmento_ordinal integer,
  texto text,
  seccion text,
  bibliografia jsonb,
  licencia jsonb,
  estado text,
  rank_cd real,
  lemas_cubiertos text[],
  lemas_pregunta text[],
  terminos_pregunta text[]
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_started timestamptz := clock_timestamp();
  v_actor uuid := auth.uid();
  v_clinica uuid;
  v_lexemas text[];
  v_terminos text[];
  v_consulta tsquery;
  v_fila record;
  v_n integer := 0;
begin
  if v_actor is null or not public.is_active_access(v_actor) then
    perform public.log_server_event(
      'knowledge_search', 'search_knowledge_fragments', 'authentication_required', v_started
    );
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;
  v_clinica := public.current_clinic_id();

  -- Lexemas de la pregunta y, en paralelo, la primera palabra escrita que originó cada uno:
  -- el aviso de cobertura parcial nombra palabras de la pregunta, no tallos (FR-022 ·
  -- US5-AC8 · revisión de la PR #30).
  select coalesce(array_agg(termino.lexema order by termino.lexema), '{}'),
         coalesce(array_agg(termino.palabra order by termino.lexema), '{}')
    into v_lexemas, v_terminos
    from (
      select distinct on (lexema.valor) lexema.valor as lexema, token.token as palabra
        from ts_debug('spanish', coalesce(p_query, '')) with ordinality
               as token(alias, description, token, dictionaries, dictionary, lexemes, posicion),
             unnest(token.lexemes) as lexema(valor)
       where coalesce(lexema.valor, '') <> ''
       order by lexema.valor, token.posicion
    ) as termino;

  if cardinality(v_lexemas) = 0 then
    perform public.log_server_event(
      'knowledge_search', 'search_knowledge_fragments', 'no_terms', v_started
    );
    return;
  end if;

  -- Recuperación por cobertura de lemas (D4): la pregunta es la UNIÓN de sus lexemas, no una
  -- conjunción estricta — una sola palabra no contenida no anula una evidencia que cubre el
  -- resto de la pregunta (FR-022). El tsquery se construye con el cast de texto, que NO
  -- normaliza: to_tsquery('spanish', …) volvería a talar cada lexema aunque vaya entre
  -- comillas («ansied» → «ansi») y ts_rank_cd daría 0 (revisión de la PR #30).
  select string_agg(
           '''' || replace(replace(lexema.valor, '\', '\\'), '''', '''''') || '''', ' | '
         )::tsquery
    into v_consulta
    from unnest(v_lexemas) as lexema(valor);

  -- Orden: primero cuántos lemas de la pregunta cubre el fragmento y después su rank_cd. El
  -- corte p_limit no puede dejar fuera un fragmento que califica (≥ mitad de los lemas) por
  -- detrás de otros que solo cruzan uno: composeAnswer lo descartaría sin aviso (FR-052).
  for v_fila in
    select candidato.*
      from (
        select
          fragmento.documento_id as r_documento_id,
          fragmento.ordinal as r_fragmento_ordinal,
          fragmento.texto as r_texto,
          fragmento.seccion as r_seccion,
          documento.content -> 'bibliografia' as r_bibliografia,
          documento.content -> 'licencia' as r_licencia,
          documento.status as r_estado,
          ts_rank_cd(fragmento.vector, v_consulta) as r_rank_cd,
          array(
            select lexema.valor
              from unnest(v_lexemas) as lexema(valor)
             where lexema.valor = any(tsvector_to_array(fragmento.vector))
             order by lexema.valor
          ) as r_lemas_cubiertos
          from public.knowledge_fragments as fragmento
          join public.knowledge_documents as documento
            on documento.id = fragmento.documento_id
         where fragmento.clinic_id = v_clinica
           and documento.status = 'available'
           and fragmento.vector @@ v_consulta
      ) as candidato
     order by cardinality(candidato.r_lemas_cubiertos) desc,
              candidato.r_rank_cd desc,
              candidato.r_documento_id,
              candidato.r_fragmento_ordinal
     limit greatest(least(coalesce(p_limit, 25), 100), 1)
  loop
    documento_id := v_fila.r_documento_id;
    fragmento_ordinal := v_fila.r_fragmento_ordinal;
    texto := v_fila.r_texto;
    seccion := v_fila.r_seccion;
    bibliografia := v_fila.r_bibliografia;
    licencia := v_fila.r_licencia;
    estado := v_fila.r_estado;
    rank_cd := v_fila.r_rank_cd;
    lemas_cubiertos := v_fila.r_lemas_cubiertos;
    lemas_pregunta := v_lexemas;
    terminos_pregunta := v_terminos;
    return next;
    v_n := v_n + 1;
  end loop;

  perform public.log_server_event(
    'knowledge_search', 'search_knowledge_fragments', 'ok', v_started,
    jsonb_build_object('candidates', v_n, 'terms', cardinality(v_lexemas))
  );
end;
$$;

grant execute on function public.search_knowledge_fragments(text, integer) to authenticated;
