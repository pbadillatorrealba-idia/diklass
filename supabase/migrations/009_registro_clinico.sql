-- 009_registro_clinico.sql — Registro clínico longitudinal: sellado de consultas cerradas,
-- cierre atómico de la consulta al aprobar la epicrisis e índices de lectura longitudinal.
--
-- Cambio: openspec/changes/implementar-registro-clinico-longitudinal (tasks.md 1.2–1.3).
-- Implementa las decisiones D4 y D5 de su design.md sobre la infraestructura de atribución
-- de 001–008. Trazabilidad:
--   * FR-012 · US3-AC2 + D4: `approve_clinical_record` aprueba la epicrisis y cierra su
--     consulta en la misma transacción (SC-014: toda consulta cerrada con su epicrisis;
--     FR-045 queda bien definido: todo lo no aprobado sigue siendo retomable).
--   * FR-024 · US4-AC2 · US3-AC4 · SC-009 + D5: los registros de trabajo de una consulta
--     cerrada quedan sellados ante cualquier UPDATE (CLINICAL_RECORD_SEALED, SQLSTATE
--     23514), y el vínculo content->>'consultationId' de una fila que ya lo tiene es
--     inmutable (CONSULTATION_LINK_IMMUTABLE, SQLSTATE 23514): re-apuntarlo o vaciarlo
--     eludiría un sello evaluado sobre old (RLS permite actualizar filas no aprobadas de
--     la clínica). Las fichas patient/tutor no llevan consultationId y siguen editables
--     entre consultas (caso límite «ficha ampliada entre consultas» de la spec).
--   * FR-002 · US4-AC4 y FR-013 · US4-AC1 + D10: las lecturas longitudinales por
--     content->>'patientId' y content->>'consultationId' se apoyan en índices de expresión.
--
-- Compatibilidad: una epicrisis sin content->>'consultationId' (como las de los fixtures de
-- las suites 001–007) no cierra nada, y esas suites siguen verdes. No se modifican grants
-- (004/005) ni el mapping `clinical_record_action` (003): el cierre de consulta emite
-- `null` a propósito. Verificación: supabase/tests/008_registro_clinico.sql (pgTap).

-- ---------------------------------------------------------------------------
-- D5 (FR-024 · US4-AC2): las consultas cerradas sellan sus registros de trabajo.
-- ---------------------------------------------------------------------------

-- Fracasa el UPDATE si la fila pertenece (por content->>'consultationId') a una consulta
-- cuyo content->>'status' es 'closed', y también si el UPDATE intenta cambiar o vaciar el
-- vínculo content->>'consultationId' de una fila que ya lo tiene. No lleva security definer
-- a propósito: basta con el SELECT de la propia tabla y con que quien actualiza tenga
-- acceso a ella (RLS).
create or replace function public.guard_consultation_sealed()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
declare
  previous_consultation text;
  consultation_id uuid;
  consultation_status text;
begin
  if tg_op = 'INSERT' then
    -- FR-024 · US4-AC2 · SC-009 (revisión de la PR #27): el sellado también cubre INSERT.
    -- Una fila de trabajo no puede anexarse a una consulta cerrada por el camino directo
    -- de PostgREST (T055): el conjunto que muestra el workspace de una consulta cerrada no
    -- puede crecer tras el cierre. La epicrisis correctiva (status 'corrective', D8 ·
    -- US3-AC4) queda exenta: corregir una epicrisis aprobada crea legítimamente un registro
    -- adicional sobre la consulta cerrada. Un consultationId que no resuelve a ninguna
    -- consulta se tolera (huérfanos: riesgo documentado D1/D6), pero si resuelve y está
    -- cerrada, se rechaza.
    if new.content ->> 'consultationId' is not null and new.status <> 'corrective' then
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
  end if;

  if tg_op = 'UPDATE' then
    -- El sello se evalúa sobre OLD: la pertenencia a la consulta es la que la fila tenía
    -- antes del UPDATE.
    previous_consultation := old.content ->> 'consultationId';

    -- Solo las filas que ya tienen consulta (anamnesis, diagnóstico, epicrisis) se sellan;
    -- las fichas patient/tutor no la llevan y siguen editables entre consultas (caso
    -- límite «ficha ampliada entre consultas»).
    if previous_consultation is not null then
      -- FR-024 · US4-AC2 · SC-009 (D5): el vínculo con la consulta es inmutable. Sin esta
      -- guarda, re-apuntar o vaciar content->>'consultationId' eludiría el sello (evaluado
      -- sobre old) y RLS permite actualizar filas no aprobadas de la clínica.
      if new.content ->> 'consultationId' is distinct from previous_consultation then
        raise exception 'CONSULTATION_LINK_IMMUTABLE' using errcode = '23514';
      end if;

      -- Cast defensivo del uuid: un consultationId malformado no puede resolver a ninguna
      -- consulta cerrada y no debe convertir un UPDATE legítimo en un 22P02.
      begin
        consultation_id := previous_consultation::uuid;
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
  end if;

  return new;
end;
$$;

create trigger clinical_records_guard_sealed
before insert or update on public.clinical_records
for each row execute function public.guard_consultation_sealed();

-- ---------------------------------------------------------------------------
-- D4 (FR-012 · US3-AC2): aprobación y cierre de consulta en la misma transacción.
-- ---------------------------------------------------------------------------

-- Reemplazo que conserva el cuerpo vigente de 003_attribution_hardening.sql (008 no lo
-- tocó): misma firma, security definer, log_server_event, validaciones
-- (AUTHENTICATION_REQUIRED 42501, RECORD_NOT_FOUND 42501, INVALID_INPUT 22023,
-- APPROVED_RECORD_IMMUTABLE 23514) y forma de respuesta jsonb. La única adición es el
-- cierre de la consulta vinculada tras aprobar (D4).
create or replace function public.approve_clinical_record(p_record_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  started_at timestamptz := clock_timestamp();
  actor uuid := auth.uid();
  record_row public.clinical_records;
  event_id uuid;
  consultation_ref text;
  consultation_id uuid;
begin
  if actor is null or not public.is_active_access(actor) then
    perform public.log_server_event(
      'clinical_record_approval', 'approve_clinical_record', 'authentication_required', started_at
    );
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;

  select target.* into record_row
  from public.clinical_records target
  join public.veterinarians veterinarian on veterinarian.id = actor
  where target.id = p_record_id
    and target.clinic_id = veterinarian.clinic_id
  for update of target;

  if not found then
    perform public.log_server_event(
      'clinical_record_approval', 'approve_clinical_record', 'not_found', started_at
    );
    raise exception 'RECORD_NOT_FOUND' using errcode = '42501';
  end if;

  -- FR-063 solo enumera la aprobación para una epicrisis; aprobar cualquier otro tipo
  -- escribiría un evento epicrisis_approved que describe mal la acción.
  if record_row.record_type <> 'epicrisis' then
    perform public.log_server_event(
      'clinical_record_approval', 'approve_clinical_record', 'invalid_input', started_at
    );
    raise exception 'INVALID_INPUT' using errcode = '22023';
  end if;

  if record_row.approved_at is not null then
    perform public.log_server_event(
      'clinical_record_approval', 'approve_clinical_record', 'already_approved', started_at
    );
    raise exception 'APPROVED_RECORD_IMMUTABLE' using errcode = '23514';
  end if;

  perform set_config('diklass.approving', 'on', true);
  update public.clinical_records
  set approved_by = actor,
      approved_at = timezone('utc', now()),
      status = 'approved'
  where id = p_record_id;
  perform set_config('diklass.approving', 'off', true);

  -- D4 (FR-012 · US3-AC2): la consulta vinculada se cierra en esta misma transacción.
  -- EL ORDEN ES OBLIGATORIO: primero se aprueba la epicrisis (el UPDATE de arriba, con la
  -- consulta aún abierta) y solo DESPUÉS se cierra la consulta. Si se cerrara antes, el
  -- UPDATE de la epicrisis vería su propia consulta en 'closed' y guard_consultation_sealed
  -- abortaría toda aprobación con CLINICAL_RECORD_SEALED; la suite 008 lo delata con un
  -- lives_ok sobre la aprobación.
  -- El UPDATE de la fila de consulta dispara audit_clinical_record, cuyo mapping
  -- (clinical_record_action, 003) devuelve `null` para UPDATE de 'consultation' —
  -- verificado: 'consultation' solo aparece en la rama INSERT del mapping — y por eso no
  -- emite evento. Es a propósito (D4): el cierre es consecuencia de la aprobación y
  -- 'epicrisis_approved' es su única acción enumerada; lo verifica la suite 008. La fila
  -- de consulta no lleva content->>'consultationId', así que guard_consultation_sealed no
  -- se sella a sí misma. Si la epicrisis no tiene consultationId (fixtures de las suites
  -- 001–007) no se cierra nada y esas suites siguen verdes.
  consultation_ref := record_row.content ->> 'consultationId';

  if consultation_ref is not null then
    -- Cast defensivo, idéntico al del trigger: un consultationId malformado no debe
    -- impedir aprobar la epicrisis.
    begin
      consultation_id := consultation_ref::uuid;
    exception when invalid_text_representation then
      consultation_id := null;
    end;
  end if;

  if consultation_id is not null then
    update public.clinical_records
    set content = content || jsonb_build_object('status', 'closed')
    where id = consultation_id
      and record_type = 'consultation'
      and clinic_id = record_row.clinic_id
      and content ->> 'status' = 'open';

    if not found then
      consultation_id := null;
    end if;
  end if;

  insert into public.clinical_audit_events(
    entity_type, entity_id, action, actor_id, metadata
  )
  values (
    record_row.record_type,
    p_record_id,
    'epicrisis_approved',
    actor,
    jsonb_build_object('recordType', record_row.record_type)
  )
  returning id into event_id;

  perform public.log_server_event(
    'clinical_record_approval', 'approve_clinical_record', 'ok', started_at,
    jsonb_build_object(
      'entityId', p_record_id,
      'eventId', event_id,
      'closedConsultationId', consultation_id
    )
  );

  return jsonb_build_object(
    'record', jsonb_build_object('id', p_record_id, 'status', 'approved'),
    'attribution', jsonb_build_object(
      'actorId', actor,
      'occurredAt', timezone('utc', now()),
      'action', 'epicrisis_approved'
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- D10 (FR-002 · US4-AC4, FR-013 · US4-AC1): lecturas longitudinales indexadas.
-- ---------------------------------------------------------------------------

create index if not exists clinical_records_patient_idx on public.clinical_records ((content->>'patientId'));
create index if not exists clinical_records_consultation_idx on public.clinical_records ((content->>'consultationId'));
