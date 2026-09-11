-- Review #4 follow-up (T075): the attribution columns 003 left open.
--
-- 1. created_at is stamped by the server on INSERT (data-model: "Generado por servidor").
-- 2. status only changes through approve_clinical_record: a plain UPDATE could mark an
--    epicrisis approved with no approver and no epicrisis_approved event.
-- 3. Column-level grants: the Data API only writes domain columns.
-- 4. A clinical record is only updated by an authenticated veterinarian, so every update
--    has a real actor (a service-role UPDATE used to fall back to created_by).

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
    if new.updated_by is not null or new.updated_at is not null
      or new.approved_by is not null or new.approved_at is not null then
      raise exception 'ATTRIBUTION_IMMUTABLE' using errcode = '23514';
    end if;
    if new.status = 'approved' then
      raise exception 'ATTRIBUTION_IMMUTABLE' using errcode = '23514';
    end if;
    -- The column default already fills created_at; overwrite whatever the payload sent
    -- so a record cannot be backdated.
    new.created_at := timezone('utc', now());
  end if;

  if tg_op = 'UPDATE' then
    if new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at then
      raise exception 'ATTRIBUTION_IMMUTABLE' using errcode = '23514';
    end if;
    -- The sanctioned approval path (approve_clinical_record) sets a transaction-local
    -- flag; every other writer is rejected, status included.
    if (new.approved_by is distinct from old.approved_by
        or new.approved_at is distinct from old.approved_at
        or new.status is distinct from old.status)
      and coalesce(current_setting('diklass.approving', true), 'off') <> 'on' then
      raise exception 'ATTRIBUTION_IMMUTABLE' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.stamp_update_attribution()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  if tg_op = 'UPDATE' then
    if auth.uid() is null then
      raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
    end if;
    new.updated_by = auth.uid();
    new.updated_at = timezone('utc', now());
  end if;
  return new;
end;
$$;

-- `id` stays insertable: clients (and the pgTap suites) may choose the record's uuid.
revoke insert, update on public.clinical_records from anon, authenticated;
grant insert (id, clinic_id, record_type, content, status, supersedes_event_id)
  on public.clinical_records to authenticated;
grant update (content) on public.clinical_records to authenticated;
