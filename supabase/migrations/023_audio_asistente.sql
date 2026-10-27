-- Audio de los mensajes del chat (cambio chat-del-asistente, D5 · D6 · tarea 7.2).
--
-- * Bucket privado `assistant-audio`, ruta `{clinic_id}/{author_id}/{message_id}.{webm|m4a}`; 5 MiB
--   (2 min por tamaño, igual que la función `transcribe-chat-audio`).
-- * Solo el autor, con acceso activo, sube bajo su propio prefijo y puede borrar sus objetos (limpiar
--   un envío fallido, «Eliminar audio», borrar la conversación). Lo lee solo mientras el mensaje no
--   haya vencido: pasada `audio_expires_at` no se firma URL, aunque el archivo siga ahí hasta la purga.
--   Un objeto todavía sin mensaje también es legible por su autor (necesario para poder borrarlo).
-- * El audio se sube ANTES de insertar el mensaje (se transcribe y entonces se persiste una vez), así
--   que la política de subida no puede exigir una fila existente: acota por prefijo.
-- * El mensaje que declara un `audio_path` debe llevar exactamente la ruta canónica de su id.
-- * `remove_assistant_audio` marca el audio como eliminado y devuelve la ruta para que el cliente borre
--   el objeto; los objetos que queden sin referencia los barre la purga programada.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'assistant-audio', 'assistant-audio', false, 5242880,
  array['audio/webm', 'audio/mp4', 'audio/m4a', 'audio/x-m4a']
)
on conflict (id) do nothing;

-- Lectura: el autor, bajo su prefijo, mientras el audio no haya vencido. Un objeto aún sin mensaje (el
-- audio se sube ANTES de insertarlo) también es legible por su autor: Storage necesita leer el objeto
-- para poder borrarlo, y sin esto un envío fallido o «No se entendió» dejaría el archivo huérfano.
create policy "asistente audio: el autor lee su audio vigente"
on storage.objects for select to authenticated
using (
  bucket_id = 'assistant-audio'
  and public.is_active_access(auth.uid())
  and (storage.foldername(name))[1] = public.current_clinic_id()::text
  and (storage.foldername(name))[2] = auth.uid()::text
  and not exists (
    select 1 from public.assistant_messages message
    where message.audio_path = name
      and message.audio_expires_at <= timezone('utc', now())
  )
);

-- Cuántos objetos de audio tiene el autor bajo su prefijo. SECURITY DEFINER: una política de
-- `storage.objects` que consultara la propia tabla recursaría con sus políticas de lectura.
create or replace function public.assistant_audio_object_count()
returns integer
language sql
stable
security definer
set search_path = public, extensions
as $$
  select count(*)::integer from storage.objects object
   where object.bucket_id = 'assistant-audio'
     and (storage.foldername(object.name))[1] = public.current_clinic_id()::text
     and (storage.foldername(object.name))[2] = auth.uid()::text;
$$;

grant execute on function public.assistant_audio_object_count() to authenticated;

-- Subida: bajo el prefijo del autor y con un tope de objetos (el audio se sube antes de insertar el
-- mensaje; sin tope, un usuario podría llenar el bucket con archivos de 5 MiB hasta la purga de 1 día).
create policy "asistente audio: el autor sube bajo su prefijo"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'assistant-audio'
  and public.is_active_access(auth.uid())
  and (storage.foldername(name))[1] = public.current_clinic_id()::text
  and (storage.foldername(name))[2] = auth.uid()::text
  and public.assistant_audio_object_count() < 100
);

create policy "asistente audio: el autor borra sus objetos"
on storage.objects for delete to authenticated
using (
  bucket_id = 'assistant-audio'
  and public.is_active_access(auth.uid())
  and (storage.foldername(name))[1] = public.current_clinic_id()::text
  and (storage.foldername(name))[2] = auth.uid()::text
);

-- La guarda de 022 ahora también exige la ruta canónica del audio.
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

  if new.audio_path is not null
    and new.audio_path !~ ('^' || new.clinic_id || '/' || new.author_id || '/' || new.id || '\.(webm|m4a)$') then
    raise exception 'ASSISTANT_MESSAGE_AUDIO_PATH_INVALID' using errcode = '23514';
  end if;

  -- El servidor fija el momento y el vencimiento del audio: el cliente no puede alargarlos.
  new.created_at := timezone('utc', now());
  new.audio_expires_at :=
    case when new.audio_path is null then null else new.created_at + interval '90 days' end;
  return new;
end;
$$;

-- «Eliminar audio»: el autor quita el audio de un mensaje suyo y su transcripción permanece. Devuelve
-- la ruta del objeto para que el cliente lo borre de Storage (no se puede por SQL), o NULL si el
-- mensaje no tenía audio o no es suyo.
create or replace function public.remove_assistant_audio(p_message_id uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_path text;
begin
  if auth.uid() is null or not public.is_active_access(auth.uid()) then
    raise exception 'ACCESS_SESSION_REQUIRED' using errcode = '42501';
  end if;

  select audio_path into v_path
    from public.assistant_messages
   where id = p_message_id and author_id = auth.uid() and audio_path is not null
   for update;
  if v_path is null then
    return null;
  end if;

  update public.assistant_messages
     set audio_path = null,
         audio_expires_at = null,
         parts = (
           select coalesce(jsonb_agg(
             case when part ->> 'type' = 'audio'
                  then part || jsonb_build_object('audioState', 'deleted', 'audioPath', null)
                  else part end
             order by ordinality), '[]'::jsonb)
             from jsonb_array_elements(parts) with ordinality as t(part, ordinality)
         )
   where id = p_message_id;
  return v_path;
end;
$$;

grant execute on function public.remove_assistant_audio(uuid) to authenticated;

-- La política de lectura y la purga buscan el objeto por su ruta: sin índice recorrerían toda la tabla.
create index assistant_messages_audio_path_idx
  on public.assistant_messages (audio_path) where audio_path is not null;

-- Cuota de transcripciones por usuario (`transcribe-chat-audio`): un usuario activo no debe poder gastar
-- la cuota del proveedor. 20 en 10 minutos; la comprueba la función con el JWT del usuario.
create table public.assistant_audio_usage (
  author_id uuid not null references public.veterinarians(id),
  used_at timestamptz not null default timezone('utc', now())
);
create index assistant_audio_usage_idx on public.assistant_audio_usage (author_id, used_at);
alter table public.assistant_audio_usage enable row level security;
revoke all on public.assistant_audio_usage from anon, authenticated;

create or replace function public.consume_assistant_audio_quota()
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_usados integer;
begin
  if auth.uid() is null or not public.is_active_access(auth.uid()) then
    return false;
  end if;
  delete from public.assistant_audio_usage
   where author_id = auth.uid() and used_at < timezone('utc', now()) - interval '1 day';
  select count(*) into v_usados from public.assistant_audio_usage
   where author_id = auth.uid() and used_at > timezone('utc', now()) - interval '10 minutes';
  if v_usados >= 20 then
    return false;
  end if;
  insert into public.assistant_audio_usage (author_id) values (auth.uid());
  return true;
end;
$$;

grant execute on function public.consume_assistant_audio_quota() to authenticated;

-- Consentimiento de la primera grabación: el audio y su transcripción se envían a un proveedor externo
-- para transcribirse, así que el veterinario lo acepta antes de poder grabar. Una fila por autor; el
-- cliente solo declara la versión del aviso aceptado (el autor y el momento los fija el servidor).
create table public.assistant_voice_consent (
  author_id uuid primary key default auth.uid() references public.veterinarians(id),
  accepted_at timestamptz not null default timezone('utc', now()),
  version text not null check (length(version) between 1 and 20)
);
alter table public.assistant_voice_consent enable row level security;
revoke all on public.assistant_voice_consent from anon, authenticated;
grant select on public.assistant_voice_consent to authenticated;
grant insert (version) on public.assistant_voice_consent to authenticated;

create policy "asistente voz: el autor lee su consentimiento"
on public.assistant_voice_consent for select to authenticated
using (public.is_active_access(auth.uid()) and author_id = auth.uid());

create policy "asistente voz: el autor acepta el aviso"
on public.assistant_voice_consent for insert to authenticated
with check (public.is_active_access(auth.uid()) and author_id = auth.uid());
