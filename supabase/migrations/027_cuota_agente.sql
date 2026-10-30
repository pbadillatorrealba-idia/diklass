-- Cuota por usuario del agente conversacional (agente-conversacional · 5.6). Cada turno gasta modelo de
-- pago y envía datos a un proveedor externo: sin tope, una sesión (o un bucle del cliente) agota el
-- presupuesto. Mismo patrón que `consume_assistant_audio_quota` (023): ventana deslizante por autor y
-- candado por usuario para que las peticiones paralelas no pasen del límite.
create table public.assistant_agent_usage (
  author_id uuid not null references public.veterinarians(id),
  used_at timestamptz not null default timezone('utc', now())
);
create index assistant_agent_usage_idx on public.assistant_agent_usage (author_id, used_at);
alter table public.assistant_agent_usage enable row level security;
revoke all on public.assistant_agent_usage from anon, authenticated;

-- Devuelve 'ok', 'rate_limited' (más de 30 turnos en 10 minutos) o 'no_access'.
create or replace function public.consume_agent_quota()
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
  perform pg_advisory_xact_lock(hashtext('agent:' || auth.uid()::text));
  delete from public.assistant_agent_usage
   where author_id = auth.uid() and used_at < timezone('utc', now()) - interval '1 day';
  select count(*) into v_usados from public.assistant_agent_usage
   where author_id = auth.uid() and used_at > timezone('utc', now()) - interval '10 minutes';
  if v_usados >= 30 then
    return 'rate_limited';
  end if;
  insert into public.assistant_agent_usage (author_id) values (auth.uid());
  return 'ok';
end;
$$;

revoke all on function public.consume_agent_quota() from public, anon;
grant execute on function public.consume_agent_quota() to authenticated;
