-- Whole-branch review follow-up (fix/001-cierre-revision-pr4): closes the Critical finding
-- and the Important findings that touch the database (2, 3), plus a maintenance note (D4).
--
-- ---------------------------------------------------------------------------------------
-- CRITICAL: logout did not actually end clinical access.
-- ---------------------------------------------------------------------------------------
--
-- start_access_session() (006) revoked any live row of this Auth session and inserted a
-- fresh one, with no way to tell "the client retried a start" from "this session was
-- deliberately logged out". So replaying a still-cryptographically-valid JWT after logout
-- (revoke_current_access_session() + signOut) let start_access_session() re-arm full
-- clinical access for the remaining token lifetime -- verified live: after logout, reads
-- were denied, but calling start_access_session() with the same token succeeded and
-- restored 10 rows of clinical access.
--
-- contracts/auth-session.md's Logout section states: "Tras logout, RLS debe rechazar
-- cualquier lectura o escritura clínica con la sesión anterior". The access-session table
-- exists precisely to be the revocation layer stateless JWT verification cannot provide;
-- if logout does not bind it, the table buys nothing over token expiry.
--
-- Fix: record *why* a row was revoked. A row superseded by a later start on the same Auth
-- session (a retried start, D1's multi-device replacement) is 'replaced'; a row ended by an
-- explicit logout is 'logout'. start_access_session() then refuses to start a fresh session
-- for an Auth session that has ever been logged out -- that Auth session (the JWT's
-- session_id claim) is dead for good; the client must sign in again, which mints a new one.
-- A plain retried start (no logout) and a different Auth session of the same veterinarian
-- (multi-device, D1) are both unaffected: see supabase/tests/007_logout_binding.sql.

alter table public.access_sessions add column revoked_reason text;

-- Rows revoked before this column existed (006's bind-to-Auth-session backfill, and any
-- revocation before that) predate the logout/replaced distinction. Backfill them as
-- 'logout': the conservative, fail-closed reading, since a stale row can then only ever
-- block a future start for that (long-dead) Auth session, never silently authorize one.
update public.access_sessions
set revoked_reason = 'logout'
where revoked_at is not null and revoked_reason is null;

alter table public.access_sessions
  add constraint access_sessions_revoked_reason_matches_revocation
  check (
    (revoked_at is null and revoked_reason is null)
    or (revoked_at is not null and revoked_reason in ('replaced', 'logout'))
  );

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

  -- Serialize concurrent starts on this Auth session: under READ COMMITTED, two concurrent
  -- calls could both see no live row below and both insert, tripping the partial unique
  -- index with a raw 23505 instead of the retry simply replacing the earlier row.
  perform pg_advisory_xact_lock(hashtextextended(auth_session::text, 0));

  -- This Auth session was deliberately logged out: the JWT is still cryptographically
  -- valid for its remaining lifetime, but a logout revocation is permanent for the Auth
  -- session it ended. Only a fresh sign-in (a new Auth session_id) can re-arm access.
  if exists (
    select 1 from public.access_sessions
    where auth_session_id = auth_session and revoked_reason = 'logout'
  ) then
    perform public.log_server_event(
      'access_session_start', 'start_access_session', 'authentication_required', started_at,
      jsonb_build_object('reason', 'logout')
    );
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;

  -- D1: several devices at once. Only a previous access session of this same Auth session
  -- is replaced (a retried start, for instance), never another device's.
  update public.access_sessions
  set revoked_at = timezone('utc', now()), revoked_reason = 'replaced'
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
  set revoked_at = coalesce(revoked_at, timezone('utc', now())),
      revoked_reason = coalesce(revoked_reason, 'logout')
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

-- revoke_access_sessions() (001) calls revoke_access_session(null) by name and needs no
-- redefinition here; it now marks every device 'logout' via the function above.

-- ---------------------------------------------------------------------------------------
-- IMPORTANT: TRUNCATE left on three tables.
-- ---------------------------------------------------------------------------------------
--
-- 004 revoked delete/truncate on clinical_records and clinical_audit_events, arguing
-- TRUNCATE bypasses RLS and fires no triggers. That argument applies equally to the three
-- tables 001 never revoked truncate on. Verified live: authenticated and anon both held
-- TRUNCATE on access_sessions, veterinarians and clinics, and
-- `truncate public.access_sessions` as authenticated succeeded. DELETE was already revoked
-- on all three by 001, so only TRUNCATE needs closing here.

revoke truncate on public.access_sessions, public.veterinarians, public.clinics
  from anon, authenticated;

-- ---------------------------------------------------------------------------------------
-- IMPORTANT: the diklass.approving flag is client-settable.
-- ---------------------------------------------------------------------------------------
--
-- `select set_config('diklass.approving', 'on', true)` succeeded as role authenticated and
-- disabled deny_attribution_mutation's entire approval/status guard for that transaction.
-- Column grants still stopped the write, so nothing landed, but 004 and
-- src/lib/attribution/types.ts both describe grants and trigger as independent layers, and
-- they were not: the flag alone controlled the trigger.
--
-- Fix: the bypass now also requires the caller to BE the function owner. This is what
-- actually distinguishes approve_clinical_record (security definer, runs as the owner) from
-- a client-set flag: only the former ever runs with current_user = the owner role.
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
    -- The sanctioned approval path (approve_clinical_record) is security definer and runs
    -- as its owner: a client-set flag from `authenticated` cannot forge that identity, so
    -- checking current_user closes the bypass a bare set_config left open.
    if (new.approved_by is distinct from old.approved_by
        or new.approved_at is distinct from old.approved_at
        or new.status is distinct from old.status)
      and (coalesce(current_setting('diklass.approving', true), 'off') <> 'on'
           or current_user <> 'postgres') then
      raise exception 'ATTRIBUTION_IMMUTABLE' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------------------
-- Maintenance note (D4): stamp_update_attribution rejects every update with no
-- authenticated veterinarian, including a future data-fix or backfill migration run as
-- postgres. 004 (which defines it) must not be edited, so the escape hatch is documented
-- here instead: a maintenance migration that needs to update clinical_records as postgres
-- must first run
--   alter table public.clinical_records disable trigger clinical_records_stamp_update;
-- and re-enable it before committing.
