-- Review #4 follow-up (T082): bound the log volume report-client-error can produce.
--
-- The anon key is public and passes verify_jwt, so without a quota anyone could flood the
-- logs. The counter lives in a schema the Data API does not expose; only the Edge
-- Function, with the service role, consumes it.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.client_error_quota (
  bucket_key text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (bucket_key, window_start)
);

create or replace function public.consume_client_error_quota(
  p_bucket_key text,
  p_limit integer default 30
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  current_window timestamptz := date_trunc('minute', timezone('utc', now()));
  total integer;
begin
  insert into private.client_error_quota as quota (bucket_key, window_start, hits)
  values (p_bucket_key, current_window, 1)
  on conflict (bucket_key, window_start) do update set hits = quota.hits + 1
  returning hits into total;

  -- Old windows are useless once the minute has passed; keep the table small.
  delete from private.client_error_quota
  where window_start < current_window - interval '10 minutes';

  return total <= p_limit;
end;
$$;

-- 005 already closes new functions by default; stated here so the intent is explicit.
revoke execute on function public.consume_client_error_quota(text, integer)
  from public, anon, authenticated;
grant execute on function public.consume_client_error_quota(text, integer) to service_role;
