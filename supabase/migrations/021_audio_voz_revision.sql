-- Revisión de la PR #66 sobre el audio por tramo (cambio implementar-asr-real-captura-voz, D4).
--
-- Hallazgo 4: el tramo se inserta con su audio_path y DESPUÉS se sube el audio. Si la subida falla,
-- el tramo se descarta y su audio_path apuntaría a nada, sin poder corregirse (la 019 lo dejó
-- inmutable). El cliente puede ahora poner el audio_path en NULL —solo NULL— al descartarlo; el
-- guardia sigue rechazando cualquier otra ruta.
--
-- Hallazgo 5: la política de INSERT de storage.objects solo exigía que existiera algún tramo visible
-- con ese audio_path. Otro usuario de la clínica podía subir antes a la ruta y bloquear para siempre
-- la subida legítima (upsert:false y sin UPDATE/DELETE). Ahora solo sube quien activó la sesión del
-- tramo, y solo mientras el tramo está pendiente.

grant update (audio_path) on public.transcript_segments to authenticated;

create or replace function public.guard_transcript_segment()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
declare
  session_consultation uuid;
  consultation_status text;
begin
  if tg_op = 'INSERT' then
    select session.consultation_id into session_consultation
    from public.listening_sessions session
    where session.id = new.listening_session_id
      and session.clinic_id = new.clinic_id
      and session.state = 'active'
    for share;

    if session_consultation is null then
      raise exception 'LISTENING_SESSION_NOT_ACTIVE' using errcode = '23514';
    end if;

    select target.content ->> 'status' into consultation_status
    from public.clinical_records target
    where target.id = session_consultation
      and target.record_type = 'consultation'
      and target.clinic_id = new.clinic_id
    for share;

    if consultation_status is distinct from 'open' then
      raise exception 'CONSULTATION_NOT_OPEN' using errcode = '23514';
    end if;

    -- D4: el audio_path es la ruta canónica de este tramo o no existe.
    if new.audio_path is not null
      and new.audio_path !~ (
        '^' || new.clinic_id || '/' || new.listening_session_id || '/' || new.seq || '\.(webm|m4a)$'
      ) then
      raise exception 'AUDIO_PATH_INVALID' using errcode = '23514';
    end if;
    return new;
  end if;

  -- SC-027 · US6-AC12: un tramo resuelto ('processed' | 'discarded') es definitivo.
  if old.processing_state <> 'pending' then
    raise exception 'TRANSCRIPT_SEGMENT_SEALED' using errcode = '23514';
  end if;

  -- Hallazgo 4: el audio_path solo puede pasar a NULL (descarte por fallo de subida).
  if new.audio_path is not null and new.audio_path is distinct from old.audio_path then
    raise exception 'AUDIO_PATH_IMMUTABLE' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop policy "voz audio: solo se sube audio de un tramo aceptado" on storage.objects;

create policy "voz audio: solo el dueno de la sesion sube su tramo pendiente"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'consultation-audio'
  and public.is_active_access(auth.uid())
  and exists (
    select 1
    from public.transcript_segments segment
    join public.listening_sessions session on session.id = segment.listening_session_id
    where segment.audio_path = name
      and segment.processing_state = 'pending'
      and session.started_by = auth.uid()
  )
);
