-- Purga programada del audio del chat (cambio chat-del-asistente, D6 · tarea 7.6a).
--
-- La Edge Function `purge-chat-audio` (service role, invocada por pg_cron + pg_net con un secreto
-- compartido, no con el JWT de un usuario) usa estas tres funciones. Borrar de `storage.objects` por SQL
-- no elimina el archivo físico, así que la función borra con la API de Storage y aquí solo se decide QUÉ
-- borrar y se marca el resultado. Ninguna es ejecutable por `anon` ni `authenticated`.
--
-- Qué se purga:
--   * audio vencido (`audio_expires_at` ya pasó): 90 días;
--   * audio de autores cuyo usuario quedó bloqueado en Auth (`banned_until`): perdieron el acceso;
--   * objetos huérfanos: están en el bucket desde hace más de un día y ningún mensaje los referencia
--     (un envío que subió el audio y luego falló, o un mensaje ya borrado).

create or replace function public.assistant_audio_due(p_limit integer default 500)
returns table (message_id uuid, audio_path text)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select message.id, message.audio_path
    from public.assistant_messages message
   where message.audio_path is not null
     and (
       message.audio_expires_at <= timezone('utc', now())
       or exists (
         select 1 from auth.users account
          where account.id = message.author_id
            and account.banned_until is not null
            and account.banned_until > timezone('utc', now())
       )
     )
   order by message.created_at
   limit greatest(p_limit, 0);
$$;

create or replace function public.assistant_audio_orphans(p_limit integer default 500)
returns table (name text)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select object.name
    from storage.objects object
   where object.bucket_id = 'assistant-audio'
     and object.created_at < timezone('utc', now()) - interval '1 day'
     and not exists (
       select 1 from public.assistant_messages message where message.audio_path = object.name
     )
   order by object.created_at
   limit greatest(p_limit, 0);
$$;

-- Quita la ruta de los mensajes cuyo objeto ya se borró y deja la transcripción: «audio vencido» si
-- venció y «audio eliminado» si no (autor bloqueado). Devuelve cuántos mensajes marcó.
create or replace function public.assistant_audio_mark_purged(p_message_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_marcados integer;
begin
  update public.assistant_messages message
     set audio_path = null,
         audio_expires_at = null,
         parts = (
           select coalesce(jsonb_agg(
             case when part ->> 'type' = 'audio'
                  then part || jsonb_build_object(
                         'audioState',
                         case when message.audio_expires_at <= timezone('utc', now())
                              then 'expired' else 'deleted' end,
                         'audioPath', null)
                  else part end
             order by ordinality), '[]'::jsonb)
             from jsonb_array_elements(message.parts) with ordinality as t(part, ordinality)
         )
   where message.id = any (p_message_ids)
     and message.audio_path is not null;
  get diagnostics v_marcados = row_count;
  return v_marcados;
end;
$$;

revoke execute on function public.assistant_audio_due(integer) from public, anon, authenticated;
revoke execute on function public.assistant_audio_orphans(integer) from public, anon, authenticated;
revoke execute on function public.assistant_audio_mark_purged(uuid[]) from public, anon, authenticated;
grant execute on function public.assistant_audio_due(integer) to service_role;
grant execute on function public.assistant_audio_orphans(integer) to service_role;
grant execute on function public.assistant_audio_mark_purged(uuid[]) to service_role;
