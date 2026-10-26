-- Catálogos y obligatorios de paciente y tutor en la base, y RUT del tutor.
--
-- Hasta aquí `content` era jsonb libre y solo Zod (cliente) lo validaba: «Macho», «macho» y «M»
-- convivían. Esta migración pasa a la base lo que el modelo ya declara:
--
-- 1. Paciente: `species`, `sex` y `reproductiveStatus` pertenecen a un catálogo cerrado, y
--    `name`, `breed` y `tutorId` no son vacíos. Los valores son los de
--    `src/features/registro/catalogs.ts`: agregar uno exige migración.
-- 2. Tutor: `rut` obligatorio y válido (forma canónica `12345678-5`, dígito verificador por
--    módulo 11), único por clínica. El nombre mínimo ya lo exige la 017.
-- 3. `search_tutors` devuelve el RUT y lo busca con o sin puntos.
--
-- Los `check` son `not valid`: rigen para lo que se inserte o actualice, no revisan las filas
-- previas. Nunca se ejecuta `validate constraint`; un `UPDATE` de un paciente o tutor antiguo
-- que no los cumpla fallaría hasta corregirlo. Los entornos de prueba se reconstruyen con
-- `supabase db reset` y `bun run provision:demo`.

-- Dígito verificador del RUT chileno. `immutable` para poder usarla en un `check`; `authenticated`
-- necesita `execute` porque el `check` se evalúa con sus privilegios.
create or replace function public.rut_is_valid(p_rut text)
returns boolean
language plpgsql
immutable
set search_path = public, extensions
as $$
declare
  body text;
  total integer := 0;
  factor integer := 2;
  rest integer;
begin
  if p_rut is null or p_rut !~ '^[0-9]{7,8}-[0-9K]$' then
    return false;
  end if;
  body := split_part(p_rut, '-', 1);
  for i in reverse length(body)..1 loop
    total := total + substr(body, i, 1)::integer * factor;
    factor := case when factor = 7 then 2 else factor + 1 end;
  end loop;
  rest := 11 - (total % 11);
  return split_part(p_rut, '-', 2) = case rest when 11 then '0' when 10 then 'K' else rest::text end;
end;
$$;

revoke all on function public.rut_is_valid(text) from public, anon;
grant execute on function public.rut_is_valid(text) to authenticated;

alter table public.clinical_records
  add constraint clinical_records_patient_catalog_check
  check (
    record_type <> 'patient'
    or (
      -- `coalesce`: una clave ausente o null da NULL, y un CHECK con NULL se acepta.
      coalesce(content->>'species' in ('canino', 'felino'), false)
      and coalesce(content->>'sex' in ('macho', 'hembra'), false)
      and coalesce(content->>'reproductiveStatus' in ('entero', 'esterilizado'), false)
      and btrim(coalesce(content->>'name', '')) <> ''
      and btrim(coalesce(content->>'breed', '')) <> ''
      and btrim(coalesce(content->>'tutorId', '')) <> ''
    )
  )
  not valid;

alter table public.clinical_records
  add constraint clinical_records_tutor_rut_check
  check (record_type <> 'tutor' or public.rut_is_valid(content->>'rut'))
  not valid;

create unique index clinical_records_tutor_rut_idx
  on public.clinical_records (clinic_id, (content->>'rut'))
  where record_type = 'tutor';

-- Cambia el tipo de retorno de `search_tutors` (017): hay que soltarla y volver a darle permisos.
drop function if exists public.search_tutors(text, text, text, text, int, int);

create function public.search_tutors(
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
  rut text,
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
      nullif(tutor.content->>'rut', '') as rut,
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
        -- El RUT se guarda sin puntos: «12.345.678-5» y «12345678-5» buscan lo mismo.
        or tutor.content->>'rut' ilike
          '%' || replace(replace(replace(replace(btrim(p_contact), '.', ''), '\', '\\'), '%', '\%'), '_', '\_') || '%'
      )
  )
  select
    rows.id, rows.name, rows.surname, rows.full_name, rows.rut, rows.phone, rows.email,
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
