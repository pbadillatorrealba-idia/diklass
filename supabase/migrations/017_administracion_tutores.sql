-- Administración de tutores: búsqueda y orden en el servidor, índice por tutor y nombre mínimo.
--
-- El tutor es una fila `clinical_records` de tipo `tutor` (content JSONB) y el paciente lo
-- referencia por `content->>'tutorId'`.
--
-- 1. Índice parcial sobre `tutorId` de los pacientes: cuenta de pacientes por tutor y filtro por
--    tutor de `search_patients` dejan de recorrer la clínica entera.
-- 2. `check` de nombre no vacío, `not valid`: rige para lo que se inserte o actualice, no revisa
--    las filas previas. El contacto NO se exige aquí: existen tutores sin él (el formulario sí).
--    Ojo: nunca se ejecuta `validate constraint`; mientras tanto, un `UPDATE` de cualquier tutor
--    antiguo sin nombre (aunque sea solo del estado) fallaría. Revisar los datos antes de validarlo.
-- 3. `search_tutors`: filtro por nombre y contacto, orden y paginación. `security invoker`: la RLS
--    de `clinical_records` sigue acotando a la clínica del veterinario activo.

create index if not exists clinical_records_patient_tutor_idx
  on public.clinical_records ((content->>'tutorId'))
  where record_type = 'patient';

alter table public.clinical_records
  add constraint clinical_records_tutor_name_check
  check (record_type <> 'tutor' or btrim(coalesce(content->>'name', '')) <> '')
  not valid;

create or replace function public.search_tutors(
  p_name text default null,
  p_contact text default null,
  p_sort text default 'name',
  p_dir text default 'asc',
  p_limit int default 25,
  p_offset int default 0
)
returns table (
  id uuid,
  name text,
  surname text,
  full_name text,
  phone text,
  email text,
  patient_count bigint,
  total_count bigint
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with rows as (
    select
      tutor.id,
      tutor.content->>'name' as name,
      nullif(tutor.content->>'surname', '') as surname,
      concat_ws(' ', tutor.content->>'name', nullif(tutor.content->>'surname', '')) as full_name,
      nullif(tutor.content->>'phone', '') as phone,
      nullif(tutor.content->>'email', '') as email,
      (
        select count(*)
        from public.clinical_records patient
        where patient.record_type = 'patient'
          and patient.content->>'tutorId' = tutor.id::text
      ) as patient_count
    from public.clinical_records tutor
    where tutor.record_type = 'tutor'
      -- `%`, `_` y `\` del texto buscado se escapan: son literales, no comodines.
      and (
        nullif(btrim(p_name), '') is null
        or concat_ws(' ', tutor.content->>'name', tutor.content->>'surname') ilike
          '%' || replace(replace(replace(btrim(p_name), '\', '\\'), '%', '\%'), '_', '\_') || '%'
      )
      and (
        nullif(btrim(p_contact), '') is null
        or tutor.content->>'phone' ilike
          '%' || replace(replace(replace(btrim(p_contact), '\', '\\'), '%', '\%'), '_', '\_') || '%'
        or tutor.content->>'email' ilike
          '%' || replace(replace(replace(btrim(p_contact), '\', '\\'), '%', '\%'), '_', '\_') || '%'
      )
  )
  select
    rows.id, rows.name, rows.surname, rows.full_name, rows.phone, rows.email,
    rows.patient_count,
    count(*) over () as total_count
  from rows
  order by
    (case when p_sort = 'name' and p_dir = 'asc' then lower(rows.full_name) end) asc,
    (case when p_sort = 'name' and p_dir = 'desc' then lower(rows.full_name) end) desc,
    (case when p_sort = 'patients' and p_dir = 'asc' then rows.patient_count end) asc,
    (case when p_sort = 'patients' and p_dir = 'desc' then rows.patient_count end) desc,
    lower(rows.full_name) asc,
    rows.id asc
  limit greatest(least(coalesce(p_limit, 25), 100), 1)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.search_tutors(text, text, text, text, int, int)
  from public, anon;
grant execute on function public.search_tutors(text, text, text, text, int, int)
  to authenticated;
