-- 012_retroalimentacion_clinica.sql — Retroalimentación clínica: validación de contenido
-- en el servidor e inmutabilidad de lo registrado.
--
-- Cambio: openspec/changes/implementar-retroalimentacion-clinica (tasks.md 1.2).
-- Implementa las decisiones D3, D4, D5 y D6 de su design.md sobre la infraestructura de
-- atribución y registro de 001-009. Trazabilidad:
--
--   * FR-040 · US10-AC8, FR-043 · SC-023 · US10-AC9, FR-041 · US10-AC2 + D5: el contenido
--     de record_type 'clinical_feedback' se valida en el servidor — forma cerrada (solo las
--     claves de D2), vocabularios exactos que admiten 'parcial' y 'desconocida', y eventos
--     adversos estructurados {severity, description} — porque SC-023 exige recuperar el 100%
--     de los campos categóricos sin interpretar texto libre y una escritura directa por
--     PostgREST no pasaría por el Zod del cliente (Constitución V: el cliente nunca es
--     control). Viola la validación: CLINICAL_FEEDBACK_INVALID_CONTENT (SQLSTATE 23514).
--   * D3 («entre consultas»): consultationId debe resolver a una consulta 'closed' de la
--     misma clínica. US10-AC1 y US10-AC12 parten de una consulta cerrada, la evolución es
--     posterior a la epicrisis que su cierre selló, y el sellado de 009 solo protege lo que
--     apunta a consultas cerradas.
--   * FR-024 · SC-022 · US10-AC5 + D4: toda fila 'clinical_feedback' es inmutable ante
--     UPDATE (CLINICAL_FEEDBACK_IMMUTABLE, SQLSTATE 23514). Corregir es crear (status
--     'corrective' con supersedes_event_id, contrato createCorrectiveRecord): el original
--     permanece recuperable por construcción y las correctivas sucesivas apuntan al mismo
--     evento original (D7). El sello de 009 ya impide el UPDATE mientras la consulta siga
--     cerrada; este trigger lo hace estructural incluso si una consulta cerrada se reabriera
--     por un UPDATE directo (agujero heredado del modelo de amenazas T055).
--
-- D6: SOLO funciones `returns trigger` y sus triggers. Ninguna función callable nueva:
-- `supabase gen types` incluye en database.types.ts toda función no-trigger del esquema
-- expuesto y ese archivo es compartido, fuera del alcance de esta rama. Compatibilidad: no
-- se modifican tablas, grants (004/005), policies ni el mapping `clinical_record_action`
-- (003: el INSERT de 'clinical_feedback' ya emite 'clinical_feedback_recorded' y
-- status 'corrective' ya emite 'corrective_record_created'). Verificación:
-- supabase/tests/011_retroalimentacion_clinica.sql (pgTap).

-- ---------------------------------------------------------------------------
-- D5 (FR-040 · FR-043 · SC-023 · FR-041 · D3): el contenido se valida en el servidor.
-- ---------------------------------------------------------------------------

-- No lleva security definer a propósito: basta con leer public.clinical_records y con que
-- quien inserta tenga acceso a ella (RLS). El cast del uuid del contenido es defensivo: un
-- consultationId malformado no resuelve y se rechaza aquí mismo (INSERT es la puerta de
-- entrada, a diferencia del UPDATE path tolerante de guard_consultation_sealed).
create or replace function public.validate_clinical_feedback()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
declare
  expected_keys constant text[] := array[
    'consultationId', 'adherence', 'evolution', 'evolutionNote',
    'adverseEvents', 'treatmentApplied', 'treatmentModification', 'revisedDiagnosis'
  ];
  required_keys constant text[] := array['consultationId', 'adherence', 'evolution', 'adverseEvents'];
  optional_text_keys constant text[] :=
    array['evolutionNote', 'treatmentApplied', 'treatmentModification', 'revisedDiagnosis'];
  key text;
  item jsonb;
  consultation_id uuid;
  target_clinic uuid;
  target_status text;
begin
  if new.record_type <> 'clinical_feedback' then
    return new;
  end if;

  -- Forma cerrada de D2: el contenido no admite claves ajenas al modelo.
  if jsonb_typeof(new.content) <> 'object' then
    raise exception 'CLINICAL_FEEDBACK_INVALID_CONTENT' using errcode = '23514';
  end if;

  for key in select jsonb_object_keys(new.content) loop
    if not (key = any (expected_keys)) then
      raise exception 'CLINICAL_FEEDBACK_INVALID_CONTENT' using errcode = '23514';
    end if;
  end loop;

  -- Los categóricos siempre existen y no son nulos: el 100% de SC-023 lo exige; el valor
  -- «sin precisar» se registra como 'desconocida' (FR-040), no ausente.
  for key in select unnest(required_keys) loop
    if new.content -> key is null or jsonb_typeof(new.content -> key) = 'null' then
      raise exception 'CLINICAL_FEEDBACK_INVALID_CONTENT' using errcode = '23514';
    end if;
  end loop;

  -- Textos opcionales (FR-018 · FR-057 · US10-AC10): ausentes, null, o texto.
  for key in select unnest(optional_text_keys) loop
    if new.content ? key
      and jsonb_typeof(new.content -> key) not in ('string', 'null') then
      raise exception 'CLINICAL_FEEDBACK_INVALID_CONTENT' using errcode = '23514';
    end if;
  end loop;

  if jsonb_typeof(new.content -> 'consultationId') <> 'string'
    or btrim(coalesce(new.content ->> 'consultationId', '')) = '' then
    raise exception 'CLINICAL_FEEDBACK_INVALID_CONTENT' using errcode = '23514';
  end if;

  -- Vocabularios de D2 (FR-040 · US10-AC8): admiten 'parcial' y 'desconocida';
  -- nunca respuestas binarias (mejoría/ausencia, sí/no).
  if coalesce(new.content ->> 'adherence', '')
       not in ('completa', 'parcial', 'ninguna', 'desconocida') then
    raise exception 'CLINICAL_FEEDBACK_INVALID_CONTENT' using errcode = '23514';
  end if;
  if coalesce(new.content ->> 'evolution', '')
       not in ('mejoria', 'mejoriaParcial', 'sinCambios', 'empeoramiento', 'desconocida') then
    raise exception 'CLINICAL_FEEDBACK_INVALID_CONTENT' using errcode = '23514';
  end if;

  -- Eventos adversos estructurados (FR-041 · FR-043 · SC-023): lista de objetos
  -- {severity, description}; [] significa «sin eventos adversos en esta entrada». El
  -- 'grave' es un valor del vocabulario, diferenciable sin interpretar texto.
  if jsonb_typeof(new.content -> 'adverseEvents') <> 'array' then
    raise exception 'CLINICAL_FEEDBACK_INVALID_CONTENT' using errcode = '23514';
  end if;

  for item in select * from jsonb_array_elements(new.content -> 'adverseEvents') loop
    if jsonb_typeof(item) <> 'object' then
      raise exception 'CLINICAL_FEEDBACK_INVALID_CONTENT' using errcode = '23514';
    end if;
    if (select array_agg(k.k order by k.k) from jsonb_object_keys(item) as k(k))
         <> array['description', 'severity'] then
      raise exception 'CLINICAL_FEEDBACK_INVALID_CONTENT' using errcode = '23514';
    end if;
    if coalesce(item ->> 'severity', '') not in ('leve', 'moderado', 'grave') then
      raise exception 'CLINICAL_FEEDBACK_INVALID_CONTENT' using errcode = '23514';
    end if;
    if jsonb_typeof(item -> 'description') <> 'string'
      or btrim(coalesce(item ->> 'description', '')) = '' then
      raise exception 'CLINICAL_FEEDBACK_INVALID_CONTENT' using errcode = '23514';
    end if;
  end loop;

  -- D3 + D5: la consulta referida existe, está cerrada y es de la misma clínica.
  begin
    consultation_id := (new.content ->> 'consultationId')::uuid;
  exception when invalid_text_representation then
    consultation_id := null;
  end;

  if consultation_id is null then
    raise exception 'CLINICAL_FEEDBACK_INVALID_CONTENT' using errcode = '23514';
  end if;

  select target.clinic_id, target.content ->> 'status'
    into target_clinic, target_status
  from public.clinical_records target
  where target.id = consultation_id
    and target.record_type = 'consultation';

  if target_clinic is null
    or target_clinic is distinct from new.clinic_id
    or target_status is distinct from 'closed' then
    raise exception 'CLINICAL_FEEDBACK_INVALID_CONTENT' using errcode = '23514';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- D4 (FR-024 · SC-022 · US10-AC5): lo registrado nunca se edita; corregir es crear.
-- ---------------------------------------------------------------------------

create or replace function public.guard_clinical_feedback_immutable()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  if tg_op = 'UPDATE' and old.record_type = 'clinical_feedback' then
    raise exception 'CLINICAL_FEEDBACK_IMMUTABLE' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- Nombres de trigger deliberados: orden alfabético de disparo —
-- guard_approval < guard_attribution < guard_feedback < guard_sealed < stamp_update <
-- validate_feedback. Así un UPDATE de retroalimentación responde
-- CLINICAL_FEEDBACK_IMMUTABLE (su garantía propia) antes que el sello genérico de 009.
create trigger clinical_records_guard_feedback
before update on public.clinical_records
for each row execute function public.guard_clinical_feedback_immutable();

create trigger clinical_records_validate_feedback
before insert or update on public.clinical_records
for each row execute function public.validate_clinical_feedback();
