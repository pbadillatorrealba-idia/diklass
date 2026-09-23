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
  v_en_rango integer;
  v_distintos integer;
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

    -- Forma mínima del contenido (D2): bibliografia con titulo, licencia con tipo y al
    -- menos un fragmento citable con ordinal entero consecutivo y texto no vacío.
    if jsonb_typeof(new.content) is distinct from 'object'
       or jsonb_typeof(new.content -> 'bibliografia') is distinct from 'object'
       or coalesce(new.content -> 'bibliografia' ->> 'titulo', '') = ''
       or jsonb_typeof(new.content -> 'licencia') is distinct from 'object'
       or coalesce(new.content -> 'licencia' ->> 'tipo', '') = ''
       or jsonb_typeof(new.content -> 'fragmentos') is distinct from 'array' then
      raise exception 'KNOWLEDGE_SOURCE_INVALID' using errcode = '22023';
    end if;

    select count(*),
           count(*) filter (
             where fragmento.value ->> 'ordinal' is null
                or fragmento.value ->> 'ordinal' !~ '^[0-9]+$'
                or coalesce(fragmento.value ->> 'texto', '') = '')
      into v_total, v_invalidos
      from jsonb_array_elements(new.content -> 'fragmentos') as fragmento;

    if v_total = 0 or v_invalidos > 0 then
      raise exception 'KNOWLEDGE_SOURCE_INVALID' using errcode = '22023';
    end if;

    select count(*) filter (where (fragmento.value ->> 'ordinal')::integer between 1 and v_total),
           count(distinct (fragmento.value ->> 'ordinal')::integer)
      into v_en_rango, v_distintos
      from jsonb_array_elements(new.content -> 'fragmentos') as fragmento;

    if v_en_rango is distinct from v_total or v_distintos is distinct from v_total then
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

-- ---------------------------------------------------------------------------
-- RLS y privilegios: la colección es compartida dentro de la clínica; el registro de
-- consultas es append-only (solo select/insert). Sin DELETE en ninguna de las dos.
-- ---------------------------------------------------------------------------

alter table public.knowledge_documents enable row level security;
alter table public.knowledge_queries enable row level security;

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

-- ---------------------------------------------------------------------------
-- Recuperación de evidencia (D4): FTS española sobre los fragmentos embebidos, ranking
-- ts_rank_cd y cobertura de lemas por ts_debug (insumo del umbral de respaldo y del aviso
-- de cobertura parcial de FR-022/FR-023 en composeAnswer). Security definer con el patrón
-- de approve_clinical_record: revalida sesión activa, acota a la clínica y solo recorre
-- fuentes disponibles (FR-053: lo retirado no responde consultas nuevas).
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
  lemas_pregunta text[]
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_started timestamptz := clock_timestamp();
  v_actor uuid := auth.uid();
  v_lexemas text[];
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

  select coalesce(array_agg(distinct lexema.lexeme order by lexema.lexeme), '{}')
    into v_lexemas
    from ts_debug('spanish', coalesce(p_query, '')) as termino,
         unnest(termino.lexemes) as lexema(lexeme)
   where coalesce(lexema.lexeme, '') <> '';

  if cardinality(v_lexemas) = 0 then
    perform public.log_server_event(
      'knowledge_search', 'search_knowledge_fragments', 'no_terms', v_started
    );
    return;
  end if;

  -- Recuperación por cobertura de lemas (D4): la pregunta es la UNIÓN de sus lexemas, no una
  -- conjunción estricta — una sola palabra no contenida no anula una evidencia que cubre el
  -- resto de la pregunta (FR-022). Los lexemas van entrecomillados para que el analizador no
  -- los vuelva a talar («ansied» re-talado sería «ansi» y no cruzaría con los vectores).
  select to_tsquery('spanish', coalesce(string_agg(quote_literal(lexema.lexeme), ' | '), ''''))
    into v_consulta
    from unnest(v_lexemas) as lexema(lexeme);

  for v_fila in
    select
      documento.id as r_documento_id,
      (fragmento.value ->> 'ordinal')::integer as r_fragmento_ordinal,
      fragmento.value ->> 'texto' as r_texto,
      fragmento.value ->> 'seccion' as r_seccion,
      documento.content -> 'bibliografia' as r_bibliografia,
      documento.content -> 'licencia' as r_licencia,
      documento.status as r_estado,
      ts_rank_cd(to_tsvector('spanish', fragmento.value ->> 'texto'), v_consulta) as r_rank_cd,
      (select coalesce(array_agg(lexema.lexeme order by lexema.lexeme), '{}')
         from unnest(v_lexemas) as lexema(lexeme)
        where lexema.lexeme = any(lexemas_fragmento.lexemas)) as r_lemas_cubiertos
      from public.knowledge_documents as documento
      cross join lateral jsonb_array_elements(documento.content -> 'fragmentos') as fragmento
      -- La cobertura se calcula cruzando lexemas ya talados por el diccionario español
      -- (ts_debug en ambos lados). Un round-trip por plainto_tsquery los re-talaría de
      -- nuevo («ansied» → «ansi») y rompería la intersección.
      cross join lateral (
        select coalesce(array_agg(distinct lexema.lexeme order by lexema.lexeme), '{}') as lexemas
          from ts_debug('spanish', fragmento.value ->> 'texto') as termino_fragmento,
               unnest(termino_fragmento.lexemes) as lexema(lexeme)
         where coalesce(lexema.lexeme, '') <> ''
      ) as lexemas_fragmento
     where documento.clinic_id = public.current_clinic_id()
       and documento.status = 'available'
       and lexemas_fragmento.lexemas && v_lexemas
     order by 8 desc, documento.id, (fragmento.value ->> 'ordinal')::integer
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
