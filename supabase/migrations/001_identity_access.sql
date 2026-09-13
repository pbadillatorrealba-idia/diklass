create extension if not exists citext with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create type public.access_session_status as enum ('active', 'expired', 'revoked');

create table public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.veterinarians (
  id uuid primary key references auth.users(id) on delete cascade,
  clinic_id uuid not null references public.clinics(id),
  identifier extensions.citext not null unique,
  display_name text not null,
  provisioned_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create table public.access_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash bytea not null unique default extensions.digest(gen_random_uuid()::text, 'sha256'),
  veterinarian_id uuid not null references public.veterinarians(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  last_activity_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null default timezone('utc', now()) + interval '8 hours',
  revoked_at timestamptz,
  constraint access_sessions_expiry_limit check (expires_at <= last_activity_at + interval '8 hours')
);

create table public.clinical_audit_events (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  actor_id uuid not null references public.veterinarians(id),
  occurred_at timestamptz not null default timezone('utc', now()),
  supersedes_event_id uuid references public.clinical_audit_events(id),
  metadata jsonb not null default '{}'::jsonb
);

create index access_sessions_active_idx on public.access_sessions(veterinarian_id, last_activity_at)
where revoked_at is null;
create index clinical_audit_events_entity_idx on public.clinical_audit_events(entity_type, entity_id, occurred_at);

create or replace function public.is_active_access(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1
    from public.veterinarians veterinarian
    join public.access_sessions access_session
      on access_session.veterinarian_id = veterinarian.id
    where veterinarian.id = p_user_id
      and p_user_id is not null
      and access_session.revoked_at is null
      and access_session.last_activity_at > timezone('utc', now()) - interval '8 hours'
      and access_session.expires_at > timezone('utc', now())
  );
$$;

create or replace function public.start_access_session()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  current_user_id uuid := auth.uid();
  session_id uuid;
  session_expires_at timestamptz;
begin
  if current_user_id is null or not exists (
    select 1 from public.veterinarians where id = current_user_id
  ) then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;

  update public.access_sessions
  set revoked_at = timezone('utc', now())
  where veterinarian_id = current_user_id and revoked_at is null;

  insert into public.access_sessions (veterinarian_id)
  values (current_user_id)
  returning id, expires_at into session_id, session_expires_at;

  return jsonb_build_object('id', session_id, 'expiresAt', session_expires_at);
end;
$$;

create or replace function public.touch_access_session(p_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update public.access_sessions
  set last_activity_at = timezone('utc', now()),
      expires_at = timezone('utc', now()) + interval '8 hours'
  where id = p_session_id
    and veterinarian_id = auth.uid()
    and revoked_at is null
    and last_activity_at > timezone('utc', now()) - interval '8 hours';

  return found;
end;
$$;

create or replace function public.revoke_access_session(p_session_id uuid default null)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update public.access_sessions
  set revoked_at = coalesce(revoked_at, timezone('utc', now()))
  where veterinarian_id = auth.uid()
    and revoked_at is null
    and (p_session_id is null or id = p_session_id);

  return true;
end;
$$;

create or replace function public.revoke_access_sessions()
returns boolean
language sql
security definer
set search_path = public, extensions
as $$
  select public.revoke_access_session(null);
$$;

create or replace function public.deny_attribution_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' and new.created_by is distinct from auth.uid() then
    raise exception 'ATTRIBUTION_IMMUTABLE' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and (
    new.created_by is distinct from old.created_by or
    new.created_at is distinct from old.created_at or
    new.approved_by is distinct from old.approved_by or
    new.approved_at is distinct from old.approved_at
  ) then
    raise exception 'ATTRIBUTION_IMMUTABLE' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.stamp_update_attribution()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    new.updated_by = auth.uid();
    new.updated_at = timezone('utc', now());
  end if;
  return new;
end;
$$;

create or replace function public.insert_clinical_audit_event(
  p_entity_type text,
  p_entity_id uuid,
  p_action text,
  p_metadata jsonb default '{}'::jsonb,
  p_supersedes_event_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  event_id uuid;
begin
  if auth.uid() is null or not public.is_active_access(auth.uid()) then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;

  insert into public.clinical_audit_events(
    entity_type, entity_id, action, actor_id, metadata, supersedes_event_id
  )
  values (
    p_entity_type, p_entity_id, p_action, auth.uid(), coalesce(p_metadata, '{}'::jsonb),
    p_supersedes_event_id
  )
  returning id into event_id;
  return event_id;
end;
$$;

alter table public.clinics enable row level security;
alter table public.veterinarians enable row level security;
alter table public.access_sessions enable row level security;
alter table public.clinical_audit_events enable row level security;

create policy "provisioned veterinarians can read their profile"
on public.veterinarians for select to authenticated
using (id = auth.uid());

create policy "active veterinarians can read their clinic"
on public.clinics for select to authenticated
using (exists (
  select 1 from public.veterinarians veterinarian
  where veterinarian.id = auth.uid() and veterinarian.clinic_id = clinics.id
));

create policy "veterinarians can read their own access sessions"
on public.access_sessions for select to authenticated
using (veterinarian_id = auth.uid());

create policy "active veterinarians can read shared audit events"
on public.clinical_audit_events for select to authenticated
using (public.is_active_access(auth.uid()));

revoke insert, update, delete on public.clinics from authenticated, anon;
revoke insert, update, delete on public.veterinarians from authenticated, anon;
revoke insert, update, delete on public.access_sessions from authenticated, anon;
revoke insert, update, delete on public.clinical_audit_events from authenticated, anon;
grant execute on function public.start_access_session() to authenticated;
grant execute on function public.touch_access_session(uuid) to authenticated;
grant execute on function public.revoke_access_session(uuid) to authenticated;
grant execute on function public.revoke_access_sessions() to authenticated;
grant execute on function public.insert_clinical_audit_event(text, uuid, text, jsonb, uuid) to authenticated;
