-- 013_asistencia_clinica.sql — asistencia clínica proactiva.
--
-- Cambio: openspec/changes/implementar-asistencia-clinica-proactiva (tasks.md 1.2).
-- Implementa los invariantes D3/D7/D8 de su design.md sobre las entidades que la enumeración
-- de FR-063 ya tipifica (`missing_information`, `hypothesis` — ver 003_attribution_hardening.sql):
--
--   * FR-010: la asistencia nace y permanece en `draft` (nunca registro definitivo ni
--     correctivo); la única aprobación sigue siendo la RPC de epicrisis (001/003).
--   * D3: la fila `missing_information` ES la decisión (estados decididos únicamente; lo
--     pendiente es derivado por detección en el cliente).
--   * D7: la hipótesis nace como `added` (el INSERT emite `hypothesis_added` y el contenido no
--     puede contradecir el evento) y `added` es irreversible; aceptar ↔ descartar es reversible.
--   * D8 · FR-020: la base de sugerencias e hipótesis (lo que documenta qué produjo cada una)
--     es inmutable en el servidor — premisa de amenaza: la política T055 permite a cualquier
--     veterinario activo de la clínica hacer UPDATE directo por PostgREST (solo `content`, ver
--     004) sobre filas no aprobadas. Corregir la base es crear una fila nueva.
--   * FR-024 · D8: sellado por consulta cerrada. NOTA DE INTEGRACIÓN: el trigger heredado
--     `guard_consultation_sealed` (009_registro_clinico.sql) acota su sello a
--     `('anamnesis', 'diagnosis', 'epicrisis')` — el set de registros de trabajo que fija
--     SC-009 de la spec 002 — y por eso NO cubre estas entidades; este trigger sella las
--     suyas con la misma semántica (evaluada sobre `old`, error `CLINICAL_RECORD_SEALED`):
--     las decisiones de sugerencias e hipótesis son de la consulta en curso (supuesto de la
--     spec 006) y el conjunto de una consulta cerrada no crece ni se modifica.
--
-- Sin DDL sobre tablas, sin cambios en la enumeración de FR-063 y sin grants nuevos: `supabase
-- gen types` queda sin diff (trigger puro, como `guard_consultation_sealed` de 009).
-- Verificación: supabase/tests/012_asistencia_clinica.sql (pgTap).

create or replace function public.guard_assistance_decisions()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
declare
  old_decision text;
  new_decision text;
  consultation_id uuid;
  consultation_status text;
begin
  if tg_op = 'INSERT' then
    -- FR-010 · D8: la asistencia nunca nace como registro definitivo ni correctivo.
    if new.status <> 'draft' then
      raise exception 'ASSISTANCE_STATUS_INVALID' using errcode = '23514';
    end if;

    if new.record_type = 'hypothesis' then
      -- D7: la hipótesis nace como added; aceptada en el INSERT, el evento
      -- hypothesis_added que emite el mapping de 001 mentiría el contenido.
      if coalesce(new.content ->> 'decision', 'added') <> 'added' then
        raise exception 'HYPOTHESIS_DECISION_INVALID' using errcode = '23514';
      end if;
      if coalesce(new.content ->> 'texto', '') = ''
        or coalesce(new.content ->> 'origen', '') not in ('sistema', 'veterinario')
      then
        raise exception 'ASSISTANCE_CONTENT_INVALID' using errcode = '23514';
      end if;
    else
      -- D3: la fila es la decisión registrada; `pendiente` es derivado, nunca persistido.
      if coalesce(new.content ->> 'estado', '')
        not in ('formulada', 'ignorada', 'no_aplicable')
      then
        raise exception 'MISSING_INFORMATION_STATE_INVALID' using errcode = '23514';
      end if;
      if coalesce(new.content ->> 'pregunta', '') = '' then
        raise exception 'ASSISTANCE_CONTENT_INVALID' using errcode = '23514';
      end if;
    end if;

    -- FR-024 · D8: el conjunto de una consulta cerrada no crece (mismo alcance que el
    -- sellado de 009 sobre sus registros de trabajo). Un consultationId que no resuelve se
    -- tolera (huérfanos: riesgo documentado en D1), pero si resuelve y está cerrada, se
    -- rechaza. Cast defensivo: un consultationId malformado no convierte el INSERT en 22P02.
    if new.content ->> 'consultationId' is not null then
      begin
        consultation_id := (new.content ->> 'consultationId')::uuid;
      exception when invalid_text_representation then
        consultation_id := null;
      end;
      if consultation_id is not null then
        select target.content ->> 'status' into consultation_status
        from public.clinical_records target
        where target.id = consultation_id
          and target.record_type = 'consultation'
          and target.clinic_id = new.clinic_id;
        if consultation_status = 'closed' then
          raise exception 'CLINICAL_RECORD_SEALED' using errcode = '23514';
        end if;
      end if;
    end if;

    return new;
  end if;

  -- UPDATE: solo la marca de decisión cambia (D8). La base —`texto`, `origen`, `reglaId`,
  -- `insumos`, `respaldo`, `consultationId` en la hipótesis; `pregunta`, `suggestionKey`,
  -- `fundamento`, `camposRelacionados`, `consultationId` en la decisión— es inmutable: es lo
  -- que hace fiel la reconstrucción de FR-020 (US8-AC8).
  if new.record_type = 'hypothesis' then
    if new.content - 'decision' is distinct from old.content - 'decision' then
      raise exception 'HYPOTHESIS_BASIS_IMMUTABLE' using errcode = '23514';
    end if;
    old_decision := coalesce(old.content ->> 'decision', 'added');
    new_decision := coalesce(new.content ->> 'decision', 'added');
    if new_decision not in ('added', 'accepted', 'discarded') then
      raise exception 'HYPOTHESIS_DECISION_INVALID' using errcode = '23514';
    end if;
    -- D7 · HD5: added es irreversible — una hipótesis presentada no deja de haberlo estado
    -- (su evento hypothesis_added ya es historia de la traza).
    if new_decision = 'added' and old_decision <> 'added' then
      raise exception 'HYPOTHESIS_DECISION_IRREVERSIBLE' using errcode = '23514';
    end if;
  else
    if new.content - 'estado' is distinct from old.content - 'estado' then
      raise exception 'MISSING_INFORMATION_BASIS_IMMUTABLE' using errcode = '23514';
    end if;
    if coalesce(new.content ->> 'estado', '')
      not in ('formulada', 'ignorada', 'no_aplicable')
    then
      raise exception 'MISSING_INFORMATION_STATE_INVALID' using errcode = '23514';
    end if;
  end if;

  -- FR-024 · D8: sello por consulta cerrada evaluado sobre OLD (la pertenencia es la que la
  -- fila tenía antes del UPDATE), con el vínculo ya inmovilizado por
  -- CONSULTATION_LINK_IMMUTABLE del trigger heredado de 009.
  consultation_id := null;
  if old.content ->> 'consultationId' is not null then
    begin
      consultation_id := (old.content ->> 'consultationId')::uuid;
    exception when invalid_text_representation then
      consultation_id := null;
    end;
    if consultation_id is not null then
      select target.content ->> 'status' into consultation_status
      from public.clinical_records target
      where target.id = consultation_id
        and target.record_type = 'consultation'
        and target.clinic_id = old.clinic_id;
      if consultation_status = 'closed' then
        raise exception 'CLINICAL_RECORD_SEALED' using errcode = '23514';
      end if;
    end if;
  end if;

  return new;
end;
$$;

create trigger assistance_guard_decisions
before insert or update on public.clinical_records
for each row
when (new.record_type in ('missing_information', 'hypothesis'))
execute function public.guard_assistance_decisions();
