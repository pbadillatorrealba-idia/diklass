-- Conversación del chat del asistente (cambio chat-del-asistente, D3 · tarea 3.1).
--
-- * assistant_messages: una conversación por veterinario, privada (solo su autor, con acceso activo,
--   en su clínica). NO es traza clínica: el autor puede borrarla. `knowledge_queries` (FR-020) sigue
--   siendo la auditoría de las consultas de conocimiento y no se toca.
-- * Solo se persisten mensajes terminales ('done' | 'error'): «enviando» y «pensando» viven en la
--   sesión del cliente, así que no hay filas huérfanas ni UPDATE de cliente. La única mutación futura
--   (quitar el audio) la harán una RPC y la purga con credenciales de servicio, no el cliente.
-- * patient_id: paciente de la misma clínica, con el mismo guardián que knowledge_queries (010).
-- * created_at y audio_expires_at los fija el servidor (el audio vence a los 90 días).

create table public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  author_id uuid not null default auth.uid() references public.veterinarians(id),
  role text not null check (role in ('user', 'assistant')),
  parts jsonb not null check (jsonb_typeof(parts) = 'array'),
  status text not null check (status in ('done', 'error')),
  patient_id uuid references public.clinical_records(id),
  audio_path text,
  audio_expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

-- Lectura paginada por (created_at, id) descendente, de a 50 (D3).
create index assistant_messages_author_idx
  on public.assistant_messages (author_id, created_at desc, id desc);
-- La purga de audio vencido recorre solo las filas con audio.
create index assistant_messages_audio_expiry_idx
  on public.assistant_messages (audio_expires_at) where audio_path is not null;

alter table public.assistant_messages enable row level security;

-- Sin UPDATE ni DELETE directos para el cliente (invariante de 003: authenticated no borra de ninguna
-- tabla de public): Supabase concede todo por defecto, así que se retira y se concede solo lo que el
-- chat usa. El borrado de la conversación va por `delete_assistant_conversation()`.
revoke all on public.assistant_messages from anon, authenticated;
grant select, insert on public.assistant_messages to authenticated;

create policy "asistente: el autor lee su conversacion"
on public.assistant_messages for select to authenticated
using (
  public.is_active_access(auth.uid())
  and author_id = auth.uid()
  and clinic_id = public.current_clinic_id()
);

create policy "asistente: el autor escribe su conversacion"
on public.assistant_messages for insert to authenticated
with check (
  public.is_active_access(auth.uid())
  and author_id = auth.uid()
  and clinic_id = public.current_clinic_id()
);

-- El paciente de contexto es un paciente de la misma clínica. Corre con los derechos de quien
-- inserta, así que la RLS de clinical_records oculta lo ajeno; y como el trigger va antes que la FK,
-- un UUID inexistente y uno de otra clínica fallan con el mismo error y no sirven de oráculo.
create or replace function public.guard_assistant_message()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  if new.patient_id is not null and not exists (
    select 1 from public.clinical_records as paciente
     where paciente.id = new.patient_id
       and paciente.clinic_id = new.clinic_id
       and paciente.record_type = 'patient'
  ) then
    raise exception 'ASSISTANT_MESSAGE_PATIENT_INVALID' using errcode = '23514';
  end if;

  -- El servidor fija el momento y el vencimiento del audio: el cliente no puede alargarlos.
  new.created_at := timezone('utc', now());
  new.audio_expires_at :=
    case when new.audio_path is null then null else new.created_at + interval '90 days' end;
  return new;
end;
$$;

create trigger assistant_messages_guard
before insert on public.assistant_messages
for each row execute function public.guard_assistant_message();

-- Borra toda la conversación del autor (D4). SECURITY DEFINER porque el cliente no tiene DELETE; se
-- acota a `auth.uid()` con acceso activo, así que nadie borra la de otro. Los objetos de audio los
-- elimina antes la Edge Function `delete-assistant-conversation` (Storage no se borra por SQL).
-- `knowledge_queries` no se toca: es la auditoría de FR-020.
create or replace function public.delete_assistant_conversation()
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_borrados integer;
begin
  if auth.uid() is null or not public.is_active_access(auth.uid()) then
    raise exception 'ACCESS_SESSION_REQUIRED' using errcode = '42501';
  end if;
  delete from public.assistant_messages where author_id = auth.uid();
  get diagnostics v_borrados = row_count;
  return v_borrados;
end;
$$;

-- 005 retira EXECUTE por defecto de anon y authenticated: se concede solo a quien usa el chat.
grant execute on function public.delete_assistant_conversation() to authenticated;
