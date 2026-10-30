-- 013_cierre_consulta.sql — Una consulta solo se cierra aprobando su epicrisis.
--
-- Cambio: openspec/changes/implementar-registro-clinico-longitudinal (tasks.md 7.10).
-- Cierra el riesgo que la segunda revisión de la PR #27 dejó declarado en design.md: el
-- sellado de 009 impide reabrir una consulta cerrada (D5.4), pero un UPDATE directo por
-- PostgREST aún podía pasar una consulta 'open' a 'closed' sin aprobar su epicrisis, y un
-- INSERT podía crearla ya cerrada. Las dos cosas rompen SC-014 (toda consulta cerrada con su
-- epicrisis) y D4 (el cierre es consecuencia de approve_clinical_record).
--
--   * Una consulta nace 'open' y su estado pertenece a {open, closed}
--     (CONSULTATION_STATUS_INVALID, SQLSTATE 23514, para cualquier otro valor o su ausencia;
--     CONSULTATION_CLOSE_REQUIRES_APPROVAL si nace 'closed').
--   * La transición open → closed solo ocurre dentro de approve_clinical_record, que marca la
--     consulta que cierra con `diklass.closing_consultation` (local a la transacción, mismo
--     patrón que `diklass.approving` de 003). Fuera de ahí falla con
--     CONSULTATION_CLOSE_REQUIRES_APPROVAL. La marca es el uuid ya resuelto por la función, así
--     que no depende de la forma textual de content->>'consultationId' (revisión de la PR #33).
--     PostgREST no expone set_config: la marca no es alcanzable desde la Data API.
--   * Un UPDATE de una consulta ya cerrada no se evalúa aquí: lo rechaza guard_consultation_sealed
--     (009, D5.4) con CLINICAL_RECORD_SEALED, sin depender del orden alfabético de los triggers.
--
-- Datos existentes: la migración falla si encuentra consultas que ya incumplen la regla (estado
-- fuera de {open, closed} o cerradas sin epicrisis aprobada), para no afirmar SC-014 sobre datos
-- que no lo cumplen. approve_clinical_record conserva firma, security definer, search_path y
-- privilegios (create or replace); solo añade la marca alrededor del cierre. Verificación:
-- supabase/tests/013_cierre_consulta.sql (pgTap).

do $$
declare
  invalid_count integer;
  unapproved_count integer;
begin
  select count(*) into invalid_count
  from public.clinical_records consultation
  where consultation.record_type = 'consultation'
    and (consultation.content ->> 'status') is distinct from 'open'
    and (consultation.content ->> 'status') is distinct from 'closed';

  select count(*) into unapproved_count
  from public.clinical_records consultation
  where consultation.record_type = 'consultation'
    and consultation.content ->> 'status' = 'closed'
    and not exists (
      select 1
      from public.clinical_records epicrisis
      where epicrisis.record_type = 'epicrisis'
        and epicrisis.status = 'approved'
        and epicrisis.clinic_id = consultation.clinic_id
        -- Misma resolución que approve_clinical_record (::uuid acepta mayúsculas, llaves y
        -- sin guiones), sin abortar ante un valor que no es uuid.
        and case
          when replace(btrim(epicrisis.content ->> 'consultationId', '{}'), '-', '') ~* '^[0-9a-f]{32}$'
            then replace(btrim(epicrisis.content ->> 'consultationId', '{}'), '-', '')::uuid
        end = consultation.id
    );

  if invalid_count > 0 or unapproved_count > 0 then
    raise exception 'CONSULTATION_DATA_VIOLATES_013: % con estado inválido, % cerradas sin epicrisis aprobada',
      invalid_count, unapproved_count;
  end if;
end;
$$;

create or replace function public.guard_consultation_close()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
declare
  new_status text := new.content ->> 'status';
begin
  if new.record_type <> 'consultation' then
    return new;
  end if;

  -- Una consulta ya cerrada la protege guard_consultation_sealed (009, D5.4).
  if tg_op = 'UPDATE' and old.content ->> 'status' = 'closed' then
    return new;
  end if;

  if new_status is null or new_status not in ('open', 'closed') then
    raise exception 'CONSULTATION_STATUS_INVALID' using errcode = '23514';
  end if;

  if new_status = 'closed'
    and coalesce(current_setting('diklass.closing_consultation', true), '') <> new.id::text
  then
    raise exception 'CONSULTATION_CLOSE_REQUIRES_APPROVAL' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger clinical_records_guard_consultation_close
before insert or update on public.clinical_records
for each row execute function public.guard_consultation_close();

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
    -- 013: guard_consultation_close solo admite el cierre de la consulta que esta función
    -- marca aquí, local a la transacción y apagado justo después.
    perform set_config('diklass.closing_consultation', consultation_id::text, true);
    update public.clinical_records
    set content = content || jsonb_build_object('status', 'closed')
    where id = consultation_id
      and record_type = 'consultation'
      and clinic_id = record_row.clinic_id
      and content ->> 'status' = 'open';
    perform set_config('diklass.closing_consultation', '', true);

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
