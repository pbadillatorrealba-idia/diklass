-- La cuota del audio del chat comprueba la versión vigente del aviso de voz. 023 solo miraba que existiera
-- alguna aceptación, así que subir `VOICE_CONSENT_VERSION` no obligaba a aceptar de nuevo a quien llama a la
-- Edge Function sin pasar por la pantalla. Las funciones `transcribe-chat-audio` y `speak` pasan su versión
-- (`_shared/voice-consent.ts`, atada por un test a la del cliente). La versión es obligatoria; cambia la firma.

drop function public.consume_assistant_audio_quota();

create or replace function public.consume_assistant_audio_quota(p_version text)
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
  -- Solo vale la aceptación de ESA versión del aviso: subirla obliga a aceptar de nuevo. La versión es
  -- obligatoria a propósito: un llamador que la olvide falla en vez de ablandar la regla en silencio.
  if not exists (
    select 1 from public.assistant_voice_consent
    where author_id = auth.uid() and version = p_version
  ) then
    return 'consent_required';
  end if;
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
  delete from public.assistant_audio_usage
   where author_id = auth.uid() and used_at < timezone('utc', now()) - interval '1 day';
  select count(*) into v_usados from public.assistant_audio_usage
   where author_id = auth.uid() and used_at > timezone('utc', now()) - interval '10 minutes';
  if v_usados >= 20 then
    return 'rate_limited';
  end if;
  insert into public.assistant_audio_usage (author_id) values (auth.uid());
  return 'ok';
end;
$$;

grant execute on function public.consume_assistant_audio_quota(text) to authenticated;
