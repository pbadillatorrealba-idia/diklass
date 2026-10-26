-- Audio conservado por tramo (cambio implementar-asr-real-captura-voz, D4).
--
-- * transcript_segments.audio_path: ruta del audio del tramo en el bucket privado
--   `consultation-audio`, `{clinic_id}/{listening_session_id}/{seq}.{ext}`. La escribe el cliente
--   solo en el INSERT (el grant de UPDATE sigue siendo processing_state) y el guardia exige que
--   sea exactamente la ruta canónica de ese tramo.
-- * Políticas de storage.objects: el audio solo existe si ya hay un tramo con ese audio_path, y la
--   comprobación lee transcript_segments bajo la RLS de quien escribe, así que otra clínica no
--   resuelve el tramo. Sin UPDATE ni DELETE: el audio es evidencia hasta que exista una política
--   de retención (pendiente declarada en el cambio).

alter table public.transcript_segments add column audio_path text;

grant insert (audio_path) on public.transcript_segments to authenticated;

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
  return new;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'consultation-audio', 'consultation-audio', false, 10485760,
  array['audio/webm', 'audio/mp4', 'audio/m4a', 'audio/x-m4a']
)
on conflict (id) do nothing;

create policy "voz audio: la clinica lee el audio de sus tramos"
on storage.objects for select to authenticated
using (
  bucket_id = 'consultation-audio'
  and public.is_active_access(auth.uid())
  and exists (
    select 1 from public.transcript_segments segment where segment.audio_path = name
  )
);

create policy "voz audio: solo se sube audio de un tramo aceptado"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'consultation-audio'
  and public.is_active_access(auth.uid())
  and exists (
    select 1 from public.transcript_segments segment where segment.audio_path = name
  )
);
