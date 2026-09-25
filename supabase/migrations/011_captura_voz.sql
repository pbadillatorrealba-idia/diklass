-- 011_captura_voz.sql — Captura de voz hacia anamnesis (feature 004).
--
-- Cambio: openspec/changes/implementar-captura-voz-anamnesis (tasks.md 1.3). Escrita DESPUÉS
-- de supabase/tests/010_captura_voz.sql (Constitución II: pruebas primero). Trazabilidad:
--   * D6 · FR-017 · SC-005: refinamiento de `clinical_record_action` para 'audio_fact' — el
--     borrador nace y se edita sin acción enumerada; `audio_fact_confirmed` ocurre exactamente
--     al confirmar.
--   * D5 · D6 · FR-017 · SC-027 · US6-AC6: `guard_audio_fact_lifecycle` — estados terminales
--     inmutables y aterrizaje ATÓMICO de la entrada de anamnesis de 002 al confirmar, con
--     `anamnesisEntryId` derivado por el servidor.
--   * FR-021 · US6-AC9: la entrada aterrizada nace con procedencia 'inferida' y confirmar no
--     la altera (la corrección de procedencia es el camino recuperable de 002).
--   * D8 · FR-068 · SC-048: `listening_sessions` con atribución server-stamped de la activación
--     y RLS de clínica compartida con sesión de acceso activa.
--   * D10 · FR-031 · US6-AC12 · FR-055: `transcript_segments` con `quality` y
--     `processing_state` explícitos; sin retención de audio (supuestos de la spec).
--
--   * Revisión de la PR #29 (sección 5): consulta abierta y sesión activa exigidas en el
--     servidor (FR-014 · US6-AC14), tramos y sesiones cerradas sellados (SC-027).
--
-- SIN funciones ejecutables nuevas, a propósito: la enumeración de funciones ejecutables por
-- 'authenticated' es taxativa en 004_function_privileges.sql (exactamente nueve) y las suites
-- 001–008 deben seguir verdes (D5 del diseño). Los guardas nuevos son trigger functions, que no
-- necesitan grant (005: «Trigger functions need no grant»). Verificación:
-- supabase/tests/010_captura_voz.sql y supabase/tests/011_captura_voz_revision.sql.

-- ---------------------------------------------------------------------------
-- 1. Refinamiento del mapping (mismo cuerpo que 003_attribution_hardening.sql, solo el
--    caso 'audio_fact', aprovechando que la función ya discrimina por contenido para
--    'hypothesis'). Se conserva firma, language sql immutable, set search_path (pin de
--    005/004) y privilegios (sobreviven al create or replace, como pinifica la suite 004).
-- ---------------------------------------------------------------------------

create or replace function public.clinical_record_action(
  p_record_type text,
  p_operation text,
  p_status text,
  p_content jsonb default '{}'::jsonb
)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select case
    when p_status = 'corrective' then 'corrective_record_created'
    when p_operation = 'INSERT' then case p_record_type
      when 'patient' then 'patient_created'
      when 'tutor' then 'tutor_created'
      when 'consultation' then 'consultation_opened'
      when 'anamnesis' then 'anamnesis_recorded'
      -- D6: una extracción del audio nace borrador; su alta no es una acción clínica
      -- enumerada (igual que el borrador de epicrisis). La confirmación ocurre en UPDATE.
      when 'audio_fact' then null
      when 'missing_information' then 'missing_information_decided'
      when 'hypothesis' then 'hypothesis_added'
      when 'diagnosis' then 'diagnosis_recorded'
      when 'pharmacological_treatment' then 'pharmacological_treatment_adopted'
      when 'non_pharmacological_treatment' then 'non_pharmacological_treatment_adopted'
      when 'clinical_feedback' then 'clinical_feedback_recorded'
      else null
    end
    else case p_record_type
      when 'patient' then 'patient_updated'
      when 'tutor' then 'tutor_updated'
      when 'anamnesis' then 'anamnesis_corrected'
      -- D6: audio_fact_confirmed exactamente al confirmar. El trigger de ciclo de vida
      -- sella los estados terminales, de modo que esta transición ocurre una sola vez;
      -- edición y descarte de borradores siguen sin acción enumerada.
      when 'audio_fact' then case
        when p_content ->> 'confirmationState' = 'confirmed' then 'audio_fact_confirmed'
        else null
      end
      when 'missing_information' then 'missing_information_decided'
      when 'hypothesis' then case coalesce(p_content ->> 'decision', 'added')
        when 'accepted' then 'hypothesis_accepted'
        when 'discarded' then 'hypothesis_discarded'
        else 'hypothesis_added'
      end
      when 'diagnosis' then 'diagnosis_recorded'
      when 'pharmacological_treatment' then 'pharmacological_treatment_adopted'
      when 'non_pharmacological_treatment' then 'non_pharmacological_treatment_adopted'
      when 'clinical_feedback' then 'clinical_feedback_recorded'
      else null
    end
  end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Ciclo de vida del hecho extraído del audio (D5 · D6).
-- ---------------------------------------------------------------------------

create or replace function public.guard_audio_fact_lifecycle()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
declare
  landed_id uuid;
begin
  if tg_op = 'INSERT' then
    -- D6 · FR-017 · SC-005: una extracción no puede nacer «confirmada» ni en un estado
    -- fuera del vocabulario; el estado por omisión es 'pending'.
    if coalesce(new.content ->> 'confirmationState', 'pending') <> 'pending' then
      raise exception 'AUDIO_FACT_STATE_INVALID' using errcode = '23514';
    end if;
    -- D5 · SC-027 (revisión de la PR #29): anamnesisEntryId es del servidor también al nacer.
    -- Un enlace fabricado en el alta viajaría después en el contenido que el cliente reenvía
    -- al confirmar, y la confirmación lo rechazaría como AUDIO_FACT_ANAMNESIS_FORGED.
    new.content := new.content - 'anamnesisEntryId';
    return new;
  end if;

  -- D5 · SC-027: los estados terminales ('confirmed', 'discarded') son inmutables — la
  -- traza confirmada no se reescribe y el descarte es una decisión terminal. Las
  -- correcciones del antecedente van por las rutas de anamnesis de 002.
  if coalesce(old.content ->> 'confirmationState', 'pending') in ('confirmed', 'discarded') then
    raise exception 'AUDIO_FACT_IMMUTABLE' using errcode = '23514';
  end if;

  -- D6 · FR-017 (revisión de la PR #29): el vocabulario está cerrado también en UPDATE. Un
  -- estado desconocido no es terminal ni confirma nada, pero deja la fila fuera de contrato
  -- para toda lectura posterior.
  if coalesce(new.content ->> 'confirmationState', 'pending')
    not in ('pending', 'confirmed', 'discarded')
  then
    raise exception 'AUDIO_FACT_STATE_INVALID' using errcode = '23514';
  end if;

  if new.content ->> 'confirmationState' = 'confirmed' then
    -- FR-068: confirmar exige identidad autenticada; quien confirmó lo deriva el servidor.
    if auth.uid() is null then
      raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
    end if;
    if new.content ->> 'consultationId' is null
      or new.content ->> 'field' is null
      or new.content ->> 'text' is null then
      raise exception 'AUDIO_FACT_INVALID_CONTENT' using errcode = '22023';
    end if;

    -- D5 · SC-027: el id del aterrizaje lo deriva SIEMPRE el servidor; fabricar el enlace desde
    -- el cliente es una confirmación fuera de la ruta sancionada y se rechaza de plano.
    if new.content ->> 'anamnesisEntryId' is not null then
      raise exception 'AUDIO_FACT_ANAMNESIS_FORGED' using errcode = '23514';
    end if;

    -- US6-AC4 · FR-010: con la consulta cerrada, lo extraído no confirmado NO se incorpora a la
    -- anamnesis definitiva. El sellado de 002 (fix 2fd95ac) acota su alcance a los registros de
    -- trabajo (anamnesis/diagnosis/epicrisis), así que esta garantía la exige el propio ciclo de
    -- vida del hecho, sobre su consulta contenedora.
    if not exists (
      select 1 from public.clinical_records target
      where target.id::text = new.content ->> 'consultationId'
        and target.record_type = 'consultation'
        and target.content ->> 'status' = 'open'
    ) then
      raise exception 'CONSULTATION_NOT_OPEN' using errcode = '23514';
    end if;

    -- D5 (FR-017 · FR-021 · SC-027 · US6-AC6): la confirmación aterriza EN ESTA MISMA
    -- TRANSACCIÓN la entrada de anamnesis de 002 — con procedencia 'inferida', que la
    -- confirmación no altera (US6-AC9) — y enlaza su id en la traza. El id lo deriva el
    -- servidor: el cliente no puede nombrarlo. La sentencia es indivisible: no existe
    -- estado intermedio persistido ni ventana de fallo parcial. El INSERT dispara los
    -- triggers de atribución y auditoría (anamnesis_recorded, actor = confirmante).
    insert into public.clinical_records (clinic_id, record_type, content, status)
    values (
      new.clinic_id,
      'anamnesis',
      jsonb_build_object(
        'consultationId', new.content ->> 'consultationId',
        'field', new.content ->> 'field',
        'text', new.content ->> 'text',
        'provenance', 'inferida'
      ),
      'draft'
    )
    returning id into landed_id;

    new.content := (new.content - 'anamnesisEntryId')
      || jsonb_build_object('anamnesisEntryId', landed_id);
  else
    -- anamnesisEntryId es propiedad del servidor: solo la confirmación lo escribe.
    new.content := new.content - 'anamnesisEntryId';
  end if;

  return new;
end;
$$;

create trigger audio_fact_guard_insert
before insert on public.clinical_records
for each row when (new.record_type = 'audio_fact')
execute function public.guard_audio_fact_lifecycle();

create trigger audio_fact_guard_update
before update on public.clinical_records
for each row when (old.record_type = 'audio_fact')
execute function public.guard_audio_fact_lifecycle();

-- ---------------------------------------------------------------------------
-- 3. Sesión de escucha y tramos de transcripción (D8 · D10).
-- ---------------------------------------------------------------------------

create table public.listening_sessions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  -- Referencia al contenedor obligatorio de toda captura (FR-014): la consulta vive en
  -- clinical_records.content.consultationId, sin FK posible dentro de jsonb (convención D1
  -- de 002: la integridad la asegura la única puerta de escritura).
  consultation_id uuid not null,
  -- FR-068 · D8: la activación queda atribuida por servidor; el cliente no la nombra.
  started_by uuid not null default auth.uid() references public.veterinarians(id),
  started_at timestamptz not null default timezone('utc', now()),
  ended_at timestamptz,
  state text not null default 'active'
    check (state in ('active', 'stopped', 'interrupted'))
);

create index listening_sessions_consultation_idx
  on public.listening_sessions (consultation_id, started_at);

create table public.transcript_segments (
  id uuid primary key default gen_random_uuid(),
  listening_session_id uuid not null references public.listening_sessions(id),
  clinic_id uuid not null references public.clinics(id),
  seq integer not null check (seq >= 0),
  started_at timestamptz not null,
  ended_at timestamptz not null,
  text text not null,
  -- FR-031: marca de confiabilidad por tramo; de los 'insufficient' no se derivan hechos.
  quality text not null check (quality in ('ok', 'insufficient')),
  -- FR-055 · US6-AC12 (D10): estado explícito por tramo — ninguno queda a medio procesar.
  processing_state text not null default 'pending'
    check (processing_state in ('pending', 'processed', 'discarded')),
  created_at timestamptz not null default timezone('utc', now()),
  unique (listening_session_id, seq)
);

-- ---------------------------------------------------------------------------
-- 4. Atribución por columnas y RLS (patrón de 002_clinical_attribution.sql y
--    004_attribution_columns.sql). El cliente escribe solo columnas de dominio;
--    started_by/started_at/created_at son del servidor. Sin DELETE: el Data API no
--    borra (TRUNCATE esquiva RLS y triggers, 004).
-- ---------------------------------------------------------------------------

revoke all on public.listening_sessions from anon, authenticated;
grant select on public.listening_sessions to authenticated;
grant insert (id, clinic_id, consultation_id, state)
  on public.listening_sessions to authenticated;
grant update (ended_at, state) on public.listening_sessions to authenticated;

revoke all on public.transcript_segments from anon, authenticated;
grant select on public.transcript_segments to authenticated;
grant insert (id, listening_session_id, clinic_id, seq, started_at, ended_at, text, quality)
  on public.transcript_segments to authenticated;
-- SC-027 (revisión de la PR #29): el texto y la calidad del tramo son el origen trazable de
-- los hechos confirmados; el cliente solo resuelve su estado de procesamiento.
grant update (processing_state) on public.transcript_segments to authenticated;

alter table public.listening_sessions enable row level security;

create policy "active clinic veterinarians can read listening sessions"
on public.listening_sessions for select to authenticated
using (
  public.is_active_access(auth.uid())
  and exists (
    select 1 from public.veterinarians veterinarian
    where veterinarian.id = auth.uid()
      and veterinarian.clinic_id = listening_sessions.clinic_id
  )
);

create policy "active clinic veterinarians can create listening sessions"
on public.listening_sessions for insert to authenticated
with check (
  public.is_active_access(auth.uid())
  and started_by = auth.uid()
  and exists (
    select 1 from public.veterinarians veterinarian
    where veterinarian.id = auth.uid()
      and veterinarian.clinic_id = listening_sessions.clinic_id
  )
);

create policy "active clinic veterinarians can update listening sessions"
on public.listening_sessions for update to authenticated
using (
  public.is_active_access(auth.uid())
  and exists (
    select 1 from public.veterinarians veterinarian
    where veterinarian.id = auth.uid()
      and veterinarian.clinic_id = listening_sessions.clinic_id
  )
)
with check (
  public.is_active_access(auth.uid())
  and exists (
    select 1 from public.veterinarians veterinarian
    where veterinarian.id = auth.uid()
      and veterinarian.clinic_id = listening_sessions.clinic_id
  )
);

alter table public.transcript_segments enable row level security;

create policy "active clinic veterinarians can read transcript segments"
on public.transcript_segments for select to authenticated
using (
  public.is_active_access(auth.uid())
  and exists (
    select 1 from public.veterinarians veterinarian
    where veterinarian.id = auth.uid()
      and veterinarian.clinic_id = transcript_segments.clinic_id
  )
);

create policy "active clinic veterinarians can create transcript segments"
on public.transcript_segments for insert to authenticated
with check (
  public.is_active_access(auth.uid())
  and exists (
    select 1 from public.veterinarians veterinarian
    where veterinarian.id = auth.uid()
      and veterinarian.clinic_id = transcript_segments.clinic_id
  )
);

create policy "active clinic veterinarians can update transcript segments"
on public.transcript_segments for update to authenticated
using (
  public.is_active_access(auth.uid())
  and exists (
    select 1 from public.veterinarians veterinarian
    where veterinarian.id = auth.uid()
      and veterinarian.clinic_id = transcript_segments.clinic_id
  )
)
with check (
  public.is_active_access(auth.uid())
  and exists (
    select 1 from public.veterinarians veterinarian
    where veterinarian.id = auth.uid()
      and veterinarian.clinic_id = transcript_segments.clinic_id
  )
);

-- ---------------------------------------------------------------------------
-- 5. Contenedor abierto y sesión activa, exigidos en el servidor (revisión de la PR #29).
--
-- FR-014 · US6-AC14: la escucha nunca corre sin consulta abierta. La comprobación del
-- cliente (startListenSession) es solo una guía de interfaz; «Falla cerrado» (AGENTS.md)
-- exige que la base la imponga. Los tramos solo se anexan a una sesión activa de la clínica
-- cuya consulta sigue abierta, y un tramo resuelto o una sesión cerrada quedan sellados.
--
-- Patrón de guard_consultation_sealed (009): FOR SHARE serializa con el UPDATE que cierra la
-- consulta (approve_clinical_record) o la sesión (endListenSession). Sin el bloqueo, bajo
-- READ COMMITTED la lectura vería el 'open'/'active' confirmado mientras el cierre aún no
-- confirma, y la sesión o el tramo entrarían en un contenedor que se cierra en paralelo.
-- Son funciones de trigger sin security definer: la lectura pasa por la RLS de quien
-- escribe, así que una consulta o sesión de otra clínica no resuelve y se rechaza.
-- ---------------------------------------------------------------------------

create or replace function public.guard_listening_session()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
declare
  consultation_status text;
begin
  if tg_op = 'INSERT' then
    select target.content ->> 'status' into consultation_status
    from public.clinical_records target
    where target.id = new.consultation_id
      and target.record_type = 'consultation'
      and target.clinic_id = new.clinic_id
    for share;

    -- Una consulta inexistente, ajena o cerrada no es contenedor válido (falla cerrado).
    if consultation_status is distinct from 'open' then
      raise exception 'CONSULTATION_NOT_OPEN' using errcode = '23514';
    end if;
    return new;
  end if;

  -- D8: el cierre es terminal; una sesión detenida o interrumpida no se reabre.
  if old.state <> 'active' then
    raise exception 'LISTENING_SESSION_SEALED' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger listening_session_guard
before insert or update on public.listening_sessions
for each row execute function public.guard_listening_session();

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
    return new;
  end if;

  -- SC-027 · US6-AC12: un tramo resuelto ('processed' | 'discarded') es definitivo.
  if old.processing_state <> 'pending' then
    raise exception 'TRANSCRIPT_SEGMENT_SEALED' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger transcript_segment_guard
before insert or update on public.transcript_segments
for each row execute function public.guard_transcript_segment();
