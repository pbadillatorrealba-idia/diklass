-- Endurecimiento tras la auditoría del backend (rama fix/auditoria-backend). Cada bloque cierra un
-- hallazgo con su prueba en supabase/tests/028_endurecimiento_auditoria.sql y 028_cuotas_de_audio.sql.
-- Solo reemplaza funciones y políticas (los cuerpos de 008, 009 y 013 conservan todo lo demás), añade
-- índices y una tabla de cuota: no reescribe datos.

-- ---------------------------------------------------------------------------
-- La auditoría solo se lee dentro de la propia clínica (001 dejaba leer la de todas, con los nombres
-- anterior y nuevo del perfil de 014 en `metadata`).
-- ---------------------------------------------------------------------------

drop policy "active veterinarians can read shared audit events" on public.clinical_audit_events;

create policy "active veterinarians can read their clinic audit events"
on public.clinical_audit_events for select to authenticated
using (
  public.is_active_access(auth.uid())
  and exists (
    select 1 from public.veterinarians actor
    where actor.id = clinical_audit_events.actor_id
      and actor.clinic_id = public.current_clinic_id()
  )
);

-- ---------------------------------------------------------------------------
-- Sello de consulta: un borrador sin consulta no puede vincularse después a una cerrada.
-- ---------------------------------------------------------------------------

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
    -- El sellado protege el conjunto de REGISTROS DE TRABAJO de la consulta cerrada
    -- (anamnesis, diagnosis, epicrisis — el set que fija SC-009). Los registros
    -- longitudinales que solo REFERENCIAN la consulta (clinical_feedback de la spec 005,
    -- registrado legítimamente entre consultas sobre la consulta cerrada) son datos nuevos
    -- y no se sellan; su propia spec fija su inmutabilidad.
    -- La exención correctiva es solo de la epicrisis (D8): una anamnesis o un diagnóstico
    -- con status 'corrective' sobre una consulta cerrada haría crecer su workspace.
    if new.content ->> 'consultationId' is not null
      and new.record_type in ('anamnesis', 'diagnosis', 'epicrisis')
      and not (new.record_type = 'epicrisis' and new.status = 'corrective')
    then
      begin
        consultation_id := (new.content ->> 'consultationId')::uuid;
      exception when invalid_text_representation then
        consultation_id := null;
      end;

      if consultation_id is not null then
        -- FOR SHARE serializa con el UPDATE que cierra la consulta en
        -- approve_clinical_record: sin el bloqueo, bajo READ COMMITTED esta lectura vería
        -- el 'open' confirmado mientras la aprobación aún no confirma, y la fila entraría
        -- en una consulta que se cierra en paralelo.
        select target.content ->> 'status' into consultation_status
        from public.clinical_records target
        where target.id = consultation_id
          and target.record_type = 'consultation'
          and target.clinic_id = new.clinic_id
        for share;

        if consultation_status = 'closed' then
          raise exception 'CLINICAL_RECORD_SEALED' using errcode = '23514';
        end if;
      end if;
    end if;
  end if;

  if tg_op = 'UPDATE' then
    -- FR-024 · US4-AC2 · SC-009 (revisión de la PR #27): la fila de una consulta cerrada es
    -- inmutable. Sin esto, un UPDATE directo por PostgREST devolvía content->>'status' a
    -- 'open' (RLS lo permite: la consulta no tiene approved_at) y el sello de sus registros
    -- de trabajo dejaba de aplicar. approve_clinical_record solo cierra consultas 'open',
    -- así que ningún camino legítimo actualiza una consulta ya cerrada.
    if old.record_type = 'consultation' and old.content ->> 'status' = 'closed' then
      raise exception 'CLINICAL_RECORD_SEALED' using errcode = '23514';
    end if;

    -- El sello se evalúa sobre OLD: la pertenencia a la consulta es la que la fila tenía
    -- antes del UPDATE.
    previous_consultation := old.content ->> 'consultationId';

    -- 028: un registro de trabajo que nació sin consulta (un borrador suelto) tampoco puede vincularse
    -- después a una consulta ya cerrada. Con el vínculo nuevo como referencia, el mismo sello de abajo
    -- lo rechaza; hacia una consulta abierta sigue permitido.
    if previous_consultation is null and old.record_type in ('anamnesis', 'diagnosis', 'epicrisis') then
      previous_consultation := new.content ->> 'consultationId';
    end if;

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

      -- Mismo alcance que en INSERT: solo los registros de TRABAJO quedan sellados. Una
      -- fila longitudinal (p. ej. clinical_feedback) que apunta a la consulta cerrada puede
      -- seguir rigiéndose por su propia spec (005 la hace inmutable con su trigger).
      if consultation_id is not null
        and old.record_type in ('anamnesis', 'diagnosis', 'epicrisis')
      then
        -- FOR SHARE: misma serialización con el cierre que en la rama INSERT.
        select target.content ->> 'status' into consultation_status
        from public.clinical_records target
        where target.id = consultation_id
          and target.record_type = 'consultation'
          and target.clinic_id = old.clinic_id
        for share;

        if consultation_status = 'closed' then
          raise exception 'CLINICAL_RECORD_SEALED' using errcode = '23514';
        end if;
      end if;
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Cierre de consulta: el flag de 013 solo vale dentro de la aprobación.
-- ---------------------------------------------------------------------------

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

  -- 028: además del flag, solo vale dentro de `approve_clinical_record` (security definer, dueño
  -- `postgres`), como hace 008 con `diklass.approving`: un cliente que fije el flag con `set_config`
  -- en su propia sesión sigue siendo `authenticated` y no cierra la consulta sin aprobación.
  if new_status = 'closed'
    and (
      coalesce(current_setting('diklass.closing_consultation', true), '') <> new.id::text
      or current_user <> 'postgres'
    )
  then
    raise exception 'CONSULTATION_CLOSE_REQUIRES_APPROVAL' using errcode = '23514';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Logout: mismo candado que el inicio de sesión.
-- ---------------------------------------------------------------------------

create or replace function public.revoke_current_access_session()
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  started_at timestamptz := clock_timestamp();
begin
  -- Mismo candado que `start_access_session`: sin él, un logout concurrente con un start reintentado
  -- revoca la fila que el start reemplaza y no ve la nueva, que sobrevive al cierre de sesión.
  perform pg_advisory_xact_lock(hashtextextended(public.current_auth_session_id()::text, 0));

  update public.access_sessions
  set revoked_at = timezone('utc', now()), revoked_reason = 'logout'
  where veterinarian_id = auth.uid()
    and auth_session_id = public.current_auth_session_id()
    and revoked_at is null;

  perform public.log_server_event(
    'access_session_revoke', 'revoke_current_access_session', 'ok', started_at
  );

  return true;
end;
$$;

create index access_sessions_auth_session_idx on public.access_sessions (auth_session_id);

-- ---------------------------------------------------------------------------
-- RUT: sin cero inicial. `01234567-4` y `1234567-4` comparten dígito verificador y el índice único de
-- tutores los veía como RUT distintos. Los datos existentes no se tocan, pero el CHECK `not valid` se revalida en
-- cada UPDATE de la fila: un tutor ya guardado con cero inicial no podrá editarse hasta corregir su RUT. Antes de
-- `db push` en un entorno con datos: `select id from public.clinical_records where record_type = 'tutor' and
-- content->>'rut' ~ '^0'`.
-- ---------------------------------------------------------------------------

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
  if p_rut is null or p_rut !~ '^[1-9][0-9]{6,7}-[0-9K]$' then
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

-- ---------------------------------------------------------------------------
-- Auditoría de consultas de conocimiento (FR-020): el servidor sella quién y cuándo. El cliente podía
-- fijar `created_at` (retroactivo) y la tabla no registraba al autor.
-- ---------------------------------------------------------------------------

alter table public.knowledge_queries add column created_by uuid references public.veterinarians(id);

create or replace function public.stamp_knowledge_query()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  new.created_by := auth.uid();
  new.created_at := timezone('utc', now());
  return new;
end;
$$;

create trigger knowledge_queries_stamp
before insert on public.knowledge_queries
for each row execute function public.stamp_knowledge_query();

-- ---------------------------------------------------------------------------
-- Audio de consulta: las políticas de storage buscan el objeto por `audio_path` en cada evaluación.
-- ---------------------------------------------------------------------------

create index transcript_segments_audio_path_idx
  on public.transcript_segments (audio_path) where audio_path is not null;

-- ---------------------------------------------------------------------------
-- Cuota del dictado de la escucha clínica (`transcribe-audio`): como las demás funciones de pago, sin
-- tope un usuario activo podía gastar el proveedor. Aparte de la del chat: el dictado manda tramos
-- seguido y no exige el aviso de voz del chat. 120 tramos en 10 minutos: con la ventana de 30 s del cliente son ~20, y deja margen a una ventana más corta.
-- ---------------------------------------------------------------------------

create table public.dictation_usage (
  author_id uuid not null references public.veterinarians(id),
  used_at timestamptz not null default timezone('utc', now())
);
create index dictation_usage_idx on public.dictation_usage (author_id, used_at);
alter table public.dictation_usage enable row level security;
revoke all on public.dictation_usage from anon, authenticated;

-- Devuelve 'ok', 'rate_limited' o 'no_access'. El candado serializa las peticiones paralelas del mismo
-- usuario (mismo patrón que `consume_assistant_audio_quota` y `consume_agent_quota`).
create or replace function public.consume_dictation_quota()
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_usados integer;
begin
  if auth.uid() is null or not public.is_active_access(auth.uid()) then
    return 'no_access';
  end if;
  perform pg_advisory_xact_lock(hashtext('dictation:' || auth.uid()::text));
  delete from public.dictation_usage
   where author_id = auth.uid() and used_at < timezone('utc', now()) - interval '1 day';
  select count(*) into v_usados from public.dictation_usage
   where author_id = auth.uid() and used_at > timezone('utc', now()) - interval '10 minutes';
  if v_usados >= 120 then
    return 'rate_limited';
  end if;
  insert into public.dictation_usage (author_id) values (auth.uid());
  return 'ok';
end;
$$;

revoke all on function public.consume_dictation_quota() from public, anon;
grant execute on function public.consume_dictation_quota() to authenticated;
