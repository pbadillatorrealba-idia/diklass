-- Búsqueda de pacientes en el servidor: filtro por nombre, raza, tutor y rango de la última
-- consulta, orden por columna y paginación. El paciente y el tutor son filas `clinical_records`
-- (content JSONB); la última visita es el `created_at` más reciente de sus consultas.
--
-- `security invoker`: la RLS de `clinical_records` sigue acotando a la clínica del veterinario
-- activo; la función no ve nada que la política no permita.

create or replace function public.search_patients(
  p_name text default null,
  p_breed text default null,
  p_tutor_id uuid default null,
  p_visit_from timestamptz default null,
  p_visit_to timestamptz default null,
  p_sort text default 'name',
  p_dir text default 'asc',
  p_limit int default 25,
  p_offset int default 0
)
returns table (
  id uuid,
  name text,
  species text,
  breed text,
  tutor_id text,
  tutor_name text,
  last_visit_at timestamptz,
  total_count bigint
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with rows as (
    select
      patient.id,
      patient.content->>'name' as name,
      patient.content->>'species' as species,
      patient.content->>'breed' as breed,
      patient.content->>'tutorId' as tutor_id,
      tutor.content->>'name' as tutor_name,
      (
        select max(visit.created_at)
        from public.clinical_records visit
        where visit.record_type = 'consultation'
          and visit.content->>'patientId' = patient.id::text
      ) as last_visit_at
    from public.clinical_records patient
    left join public.clinical_records tutor
      on tutor.record_type = 'tutor' and tutor.id::text = patient.content->>'tutorId'
    where patient.record_type = 'patient'
      and (p_tutor_id is null or patient.content->>'tutorId' = p_tutor_id::text)
      -- `%`, `_` y `\` del texto buscado se escapan: son literales, no comodines.
      and (
        nullif(btrim(p_name), '') is null
        or patient.content->>'name' ilike
          '%' || replace(replace(replace(btrim(p_name), '\', '\\'), '%', '\%'), '_', '\_') || '%'
      )
      and (
        nullif(btrim(p_breed), '') is null
        or patient.content->>'breed' ilike
          '%' || replace(replace(replace(btrim(p_breed), '\', '\\'), '%', '\%'), '_', '\_') || '%'
      )
  ),
  filtered as (
    select * from rows
    where (p_visit_from is null or last_visit_at >= p_visit_from)
      and (p_visit_to is null or last_visit_at < p_visit_to)
  )
  select
    filtered.id, filtered.name, filtered.species, filtered.breed,
    filtered.tutor_id, filtered.tutor_name, filtered.last_visit_at,
    count(*) over () as total_count
  from filtered
  order by
    (case when p_sort = 'name' and p_dir = 'asc' then lower(filtered.name) end) asc,
    (case when p_sort = 'name' and p_dir = 'desc' then lower(filtered.name) end) desc,
    (case when p_sort = 'species' and p_dir = 'asc' then lower(filtered.species) end) asc,
    (case when p_sort = 'species' and p_dir = 'desc' then lower(filtered.species) end) desc,
    (case when p_sort = 'breed' and p_dir = 'asc' then lower(filtered.breed) end) asc,
    (case when p_sort = 'breed' and p_dir = 'desc' then lower(filtered.breed) end) desc,
    (case when p_sort = 'tutor' and p_dir = 'asc' then lower(filtered.tutor_name) end) asc,
    (case when p_sort = 'tutor' and p_dir = 'desc' then lower(filtered.tutor_name) end) desc,
    (case when p_sort = 'last_visit' and p_dir = 'asc' then filtered.last_visit_at end) asc nulls last,
    (case when p_sort = 'last_visit' and p_dir = 'desc' then filtered.last_visit_at end) desc nulls last,
    lower(filtered.name) asc,
    filtered.id asc
  limit greatest(least(coalesce(p_limit, 25), 100), 1)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.search_patients(text, text, uuid, timestamptz, timestamptz, text, text, int, int)
  from public, anon;
grant execute on function public.search_patients(text, text, uuid, timestamptz, timestamptz, text, text, int, int)
  to authenticated;
