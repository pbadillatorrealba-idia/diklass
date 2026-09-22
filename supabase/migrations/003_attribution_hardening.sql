-- Convergence phase 7/8 hardening.
--
-- Closes, in order: the spoofable INSERT of approval columns (T053), the missing
-- server-side approval path (T054), the RLS rule that stopped a colleague from
-- editing a shared draft (T055), peer identity reads (T056), the out-of-enumeration
-- audit actions (T060), the absence of structured server logs (T066), the
-- client-callable audit-event RPC (T068) and the peer-session probe (T072).

-- ---------------------------------------------------------------------------
-- T066: structured, machine-readable server logs with a correlation id.
-- ---------------------------------------------------------------------------

create or replace function public.request_id()
returns text
language plpgsql
stable
set search_path = public, extensions
as $$
declare
  headers jsonb;
begin
  -- PostgREST exposes the request headers; direct SQL sessions have none.
  begin
    headers := current_setting('request.headers', true)::jsonb;
  exception when others then
    headers := null;
  end;

  return coalesce(headers ->> 'x-request-id', gen_random_uuid()::text);
end;
$$;

create or replace function public.log_server_event(
  p_event text,
  p_operation text,
  p_result text,
  p_started_at timestamptz default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  clinic uuid;
begin
  select clinic_id into clinic from public.veterinarians where id = auth.uid();

  -- Never log passwords, tokens or clinical content: only identifiers and outcomes.
  raise log '%', jsonb_build_object(
    'event', p_event,
    'requestId', public.request_id(),
    'operation', p_operation,
    'userId', auth.uid(),
    'clinicId', clinic,
    'result', p_result,
    'durationMs', case
      when p_started_at is null then null
      else round(extract(epoch from (clock_timestamp() - p_started_at)) * 1000)
    end,
    'timestamp', timezone('utc', now()),
    'metadata', coalesce(p_metadata, '{}'::jsonb)
  )::text;
end;
$$;

-- Functions are executable by PUBLIC by default, so revoking only from the API
-- roles would leave them callable. Only security-definer functions invoke this.
revoke execute on function public.log_server_event(text, text, text, timestamptz, jsonb)
  from public, authenticated, anon;

-- ---------------------------------------------------------------------------
-- T072: is_active_access must not answer for anyone but the caller.
-- ---------------------------------------------------------------------------

create or replace function public.is_active_access(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    p_user_id is not null
    and auth.uid() is not null
    -- Answering for an arbitrary uuid would let a veterinarian probe whether a
    -- named colleague is currently logged in; the spec records no access trail.
    and p_user_id = auth.uid()
    and exists (
      select 1
      from public.veterinarians veterinarian
      join public.access_sessions access_session
        on access_session.veterinarian_id = veterinarian.id
      where veterinarian.id = p_user_id
        and access_session.revoked_at is null
        and access_session.last_activity_at > timezone('utc', now()) - interval '8 hours'
        and access_session.expires_at > timezone('utc', now())
    );
$$;

-- ---------------------------------------------------------------------------
-- T068: the audit trail is written by triggers, never by a client RPC.
-- ---------------------------------------------------------------------------

-- PUBLIC must be included: it holds EXECUTE by default, and a revoke limited to
-- authenticated/anon left the RPC callable (caught by 002_attribution_immutability).
revoke execute on function
  public.insert_clinical_audit_event(text, uuid, text, jsonb, uuid)
  from public, authenticated, anon;

-- ---------------------------------------------------------------------------
-- T060: taxative enumeration of FR-063 enforced in the schema.
-- ---------------------------------------------------------------------------

alter table public.clinical_audit_events
  add constraint clinical_audit_events_entity_type_check check (
    entity_type in (
      'patient', 'tutor', 'consultation', 'anamnesis', 'audio_fact',
      'missing_information', 'hypothesis', 'diagnosis',
      'pharmacological_treatment', 'non_pharmacological_treatment',
      'epicrisis', 'clinical_feedback'
    )
  );

alter table public.clinical_audit_events
  add constraint clinical_audit_events_action_check check (
    action in (
      'patient_created', 'patient_updated', 'tutor_created', 'tutor_updated',
      'consultation_opened',
      'anamnesis_recorded', 'anamnesis_corrected', 'audio_fact_confirmed',
      'missing_information_decided',
      'hypothesis_accepted', 'hypothesis_discarded', 'hypothesis_added',
      'diagnosis_recorded',
      'pharmacological_treatment_adopted', 'non_pharmacological_treatment_adopted',
      'epicrisis_approved',
      'clinical_feedback_recorded',
      'corrective_record_created'
    )
  );

alter table public.clinical_records
  add constraint clinical_records_record_type_check check (
    record_type in (
      'patient', 'tutor', 'consultation', 'anamnesis', 'audio_fact',
      'missing_information', 'hypothesis', 'diagnosis',
      'pharmacological_treatment', 'non_pharmacological_treatment',
      'epicrisis', 'clinical_feedback'
    )
  );

-- Maps a record lifecycle transition onto the taxative enumeration. Returns null
-- when the transition has no enumerated action (a draft epicrisis, for instance:
-- only its approval is enumerated), in which case no audit event is written and
-- the row's own created_by/created_at remains the attribution. Spec 002 refines
-- this mapping as it introduces the concrete clinical entities.
create or replace function public.clinical_record_action(
  p_record_type text,
  p_operation text,
  p_status text,
  p_content jsonb default '{}'::jsonb
)
returns text
language sql
immutable
as $$
  select case
    when p_status = 'corrective' then 'corrective_record_created'
    when p_operation = 'INSERT' then case p_record_type
      when 'patient' then 'patient_created'
      when 'tutor' then 'tutor_created'
      when 'consultation' then 'consultation_opened'
      when 'anamnesis' then 'anamnesis_recorded'
      when 'audio_fact' then 'audio_fact_confirmed'
      when 'missing_information' then 'missing_information_decided'
      when 'hypothesis' then 'hypothesis_added'
      when 'diagnosis' then 'diagnosis_recorded'
      when 'pharmacological_treatment' then 'pharmacological_treatment_adopted'
      when 'non_pharmacological_treatment' then 'non_pharmacological_treatment_adopted'
      when 'clinical_feedback' then 'clinical_feedback_recorded'
      else null
    end
    else case p_record_type
      when 'patient' then 'patient_updated'
      when 'tutor' then 'tutor_updated'
      when 'anamnesis' then 'anamnesis_corrected'
      when 'audio_fact' then 'audio_fact_confirmed'
      when 'missing_information' then 'missing_information_decided'
      when 'hypothesis' then case coalesce(p_content ->> 'decision', 'added')
        when 'accepted' then 'hypothesis_accepted'
        when 'discarded' then 'hypothesis_discarded'
        else 'hypothesis_added'
      end
      when 'diagnosis' then 'diagnosis_recorded'
      when 'pharmacological_treatment' then 'pharmacological_treatment_adopted'
      when 'non_pharmacological_treatment' then 'non_pharmacological_treatment_adopted'
      when 'clinical_feedback' then 'clinical_feedback_recorded'
      else null
    end
  end;
$$;

create or replace function public.audit_clinical_record()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  resolved_action text;
begin
  resolved_action := public.clinical_record_action(
    new.record_type, tg_op, new.status, new.content
  );

  if resolved_action is null then
    return new;
  end if;

  insert into public.clinical_audit_events(
    entity_type, entity_id, action, actor_id, metadata, supersedes_event_id
  )
  values (
    new.record_type,
    new.id,
    resolved_action,
    coalesce(new.updated_by, auth.uid(), new.created_by),
    jsonb_build_object('recordType', new.record_type, 'status', new.status),
    new.supersedes_event_id
  );

  perform public.log_server_event(
    'clinical_record_audited',
    lower(tg_op),
    'ok',
    null,
    jsonb_build_object('action', resolved_action, 'entityId', new.id)
  );

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- T053: attribution columns are never accepted from an INSERT payload.
-- ---------------------------------------------------------------------------

create or replace function public.deny_attribution_mutation()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  if tg_op = 'INSERT' then
    if new.created_by is distinct from auth.uid() then
      raise exception 'ATTRIBUTION_IMMUTABLE' using errcode = '23514';
    end if;
    -- Previously unchecked: a veterinarian could insert an already-approved row
    -- naming a colleague as the approver, registering a clinical action in
    -- another professional's name (FR-064, SC-042).
    if new.updated_by is not null or new.updated_at is not null
      or new.approved_by is not null or new.approved_at is not null then
      raise exception 'ATTRIBUTION_IMMUTABLE' using errcode = '23514';
    end if;
    if new.status = 'approved' then
      raise exception 'ATTRIBUTION_IMMUTABLE' using errcode = '23514';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at then
      raise exception 'ATTRIBUTION_IMMUTABLE' using errcode = '23514';
    end if;
    -- The sanctioned approval path (approve_clinical_record) sets a
    -- transaction-local flag; every other writer is rejected.
    if (new.approved_by is distinct from old.approved_by
        or new.approved_at is distinct from old.approved_at)
      and coalesce(current_setting('diklass.approving', true), 'off') <> 'on' then
      raise exception 'ATTRIBUTION_IMMUTABLE' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- T054: server-side approval that derives the approver from the session.
-- ---------------------------------------------------------------------------

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

  -- FR-063 enumerates approval only for an epicrisis; approving any other record
  -- type would write an epicrisis_approved event that misdescribes the action.
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
    jsonb_build_object('entityId', p_record_id, 'eventId', event_id)
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

grant execute on function public.approve_clinical_record(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- T055: any active veterinarian of the clinic may edit a shared draft.
-- ---------------------------------------------------------------------------

drop policy if exists "active clinic veterinarians can update draft records"
  on public.clinical_records;

create policy "active clinic veterinarians can update draft records"
on public.clinical_records for update to authenticated
using (
  public.is_active_access(auth.uid())
  and approved_at is null
  and exists (
    select 1 from public.veterinarians veterinarian
    where veterinarian.id = auth.uid() and veterinarian.clinic_id = clinical_records.clinic_id
  )
)
with check (
  public.is_active_access(auth.uid())
  -- Deliberately no created_by = auth.uid(): a shared clinic means a colleague
  -- attends a patient someone else registered (FR-066, US12/AC6). The attribution
  -- columns stay protected by deny_attribution_mutation, not by this policy.
  and exists (
    select 1 from public.veterinarians veterinarian
    where veterinarian.id = auth.uid() and veterinarian.clinic_id = clinical_records.clinic_id
  )
);

-- ---------------------------------------------------------------------------
-- T056: an attribution has to be able to name its actor.
-- ---------------------------------------------------------------------------

-- A policy on veterinarians cannot query veterinarians (Postgres reports infinite
-- recursion), so the caller's clinic is resolved by a security-definer helper.
create or replace function public.current_clinic_id()
returns uuid
language sql
stable
security definer
set search_path = public, extensions
as $$
  select clinic_id from public.veterinarians where id = auth.uid();
$$;

create policy "active veterinarians can read clinic peers"
on public.veterinarians for select to authenticated
using (
  public.is_active_access(auth.uid())
  and clinic_id = public.current_clinic_id()
);

-- ---------------------------------------------------------------------------
-- T066 (cont.): structured logs on the access-session lifecycle.
-- ---------------------------------------------------------------------------

create or replace function public.start_access_session()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  started_at timestamptz := clock_timestamp();
  current_user_id uuid := auth.uid();
  session_id uuid;
  session_expires_at timestamptz;
begin
  if current_user_id is null or not exists (
    select 1 from public.veterinarians where id = current_user_id
  ) then
    perform public.log_server_event(
      'access_session_start', 'start_access_session', 'authentication_required', started_at
    );
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;

  update public.access_sessions
  set revoked_at = timezone('utc', now())
  where veterinarian_id = current_user_id and revoked_at is null;

  insert into public.access_sessions (veterinarian_id)
  values (current_user_id)
  returning id, expires_at into session_id, session_expires_at;

  perform public.log_server_event(
    'access_session_start', 'start_access_session', 'ok', started_at,
    jsonb_build_object('sessionId', session_id)
  );

  return jsonb_build_object('id', session_id, 'expiresAt', session_expires_at);
end;
$$;

create or replace function public.touch_access_session(p_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  started_at timestamptz := clock_timestamp();
  touched boolean;
begin
  update public.access_sessions
  set last_activity_at = timezone('utc', now()),
      expires_at = timezone('utc', now()) + interval '8 hours'
  where id = p_session_id
    and veterinarian_id = auth.uid()
    and revoked_at is null
    and last_activity_at > timezone('utc', now()) - interval '8 hours';

  touched := found;

  perform public.log_server_event(
    'access_session_touch', 'touch_access_session',
    case when touched then 'ok' else 'authentication_required' end,
    started_at, jsonb_build_object('sessionId', p_session_id)
  );

  return touched;
end;
$$;

create or replace function public.revoke_access_session(p_session_id uuid default null)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  started_at timestamptz := clock_timestamp();
begin
  update public.access_sessions
  set revoked_at = coalesce(revoked_at, timezone('utc', now()))
  where veterinarian_id = auth.uid()
    and revoked_at is null
    and (p_session_id is null or id = p_session_id);

  perform public.log_server_event(
    'access_session_revoke', 'revoke_access_session', 'ok', started_at,
    jsonb_build_object('sessionId', p_session_id)
  );

  return true;
end;
$$;
