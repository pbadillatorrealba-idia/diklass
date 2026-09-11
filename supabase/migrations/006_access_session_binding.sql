-- Review #4 follow-up (T077): an access session belongs to one Supabase Auth session.
--
-- is_active_access used to accept any live access session of the veterinarian, so a device
-- whose access had been revoked kept passing RLS while another device was active, and a
-- reload adopted the other device's session. Every access session now records the Auth
-- session_id of the JWT that started it, and only a JWT of that Auth session authorizes
-- clinical access. A veterinarian may be signed in on several devices at once (decision D1):
-- each device holds its own access session, and logging out ends only that one.

alter table public.access_sessions add column auth_session_id uuid;

-- Sessions started before this migration are bound to no Auth session: end them, so every
-- veterinarian signs in again into a bound session.
update public.access_sessions
set revoked_at = timezone('utc', now())
where revoked_at is null;

alter table public.access_sessions
  add constraint access_sessions_live_sessions_are_bound
  check (revoked_at is not null or auth_session_id is not null);

create unique index access_sessions_live_auth_session_idx
  on public.access_sessions(auth_session_id)
  where revoked_at is null;

-- Internal: not granted to any API role (005 closes new functions by default).
create or replace function public.current_auth_session_id()
returns uuid
language sql
stable
set search_path = public, extensions
as $$
  select nullif(auth.jwt() ->> 'session_id', '')::uuid;
$$;

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
    -- Answering for an arbitrary uuid would let a veterinarian probe a colleague (T072).
    and p_user_id = auth.uid()
    and exists (
      select 1
      from public.access_sessions access_session
      join public.veterinarians veterinarian
        on veterinarian.id = access_session.veterinarian_id
      where veterinarian.id = p_user_id
        and access_session.auth_session_id = public.current_auth_session_id()
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
  started_at timestamptz := clock_timestamp();
  current_user_id uuid := auth.uid();
  auth_session uuid := public.current_auth_session_id();
  session_id uuid;
  session_expires_at timestamptz;
begin
  if current_user_id is null or auth_session is null or not exists (
    select 1 from public.veterinarians where id = current_user_id
  ) then
    perform public.log_server_event(
      'access_session_start', 'start_access_session', 'authentication_required', started_at
    );
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;

  -- D1: several devices at once. Only a previous access session of this same Auth session
  -- is replaced (a retried start, for instance), never another device's.
  update public.access_sessions
  set revoked_at = timezone('utc', now())
  where auth_session_id = auth_session and revoked_at is null;

  insert into public.access_sessions (veterinarian_id, auth_session_id)
  values (current_user_id, auth_session)
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
    and auth_session_id = public.current_auth_session_id()
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

-- Restoring a Supabase session (reload, relaunch) resumes only the access session bound to
-- that same Auth session. Returns null when there is none, and the app then signs out.
create or replace function public.current_access_session()
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  select jsonb_build_object('id', access_session.id, 'expiresAt', access_session.expires_at)
  from public.access_sessions access_session
  where access_session.veterinarian_id = auth.uid()
    and access_session.auth_session_id = public.current_auth_session_id()
    and access_session.revoked_at is null
    and access_session.last_activity_at > timezone('utc', now()) - interval '8 hours'
    and access_session.expires_at > timezone('utc', now());
$$;

grant execute on function public.current_access_session() to authenticated;

-- Logout ends only this device's access session (D1). Idempotent, like the Auth sign-out
-- that follows it (contracts/auth-session.md).
create or replace function public.revoke_current_access_session()
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  started_at timestamptz := clock_timestamp();
begin
  update public.access_sessions
  set revoked_at = timezone('utc', now())
  where veterinarian_id = auth.uid()
    and auth_session_id = public.current_auth_session_id()
    and revoked_at is null;

  perform public.log_server_event(
    'access_session_revoke', 'revoke_current_access_session', 'ok', started_at
  );

  return true;
end;
$$;

grant execute on function public.revoke_current_access_session() to authenticated;
