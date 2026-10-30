-- 014_perfil_profesional.sql — Edición controlada y auditada del propio nombre visible.
--
-- Cambio: openspec/changes/perfil-profesional (D1–D2, FR-095). `public.veterinarians` sigue sin
-- `update` para `authenticated`; el único camino es `update_own_profile`, que actúa solo sobre el
-- propio registro, exige una sesión de acceso activa, normaliza y valida el nombre (2–80) y
-- registra el cambio en `clinical_audit_events` en la misma transacción. Un valor sin cambio
-- devuelve la fila sin evento. Verificación: supabase/tests/014_perfil_profesional.sql (pgTap).

alter table public.clinical_audit_events
  drop constraint clinical_audit_events_entity_type_check,
  add constraint clinical_audit_events_entity_type_check check (
    entity_type in (
      'patient', 'tutor', 'consultation', 'anamnesis', 'audio_fact',
      'missing_information', 'hypothesis', 'diagnosis',
      'pharmacological_treatment', 'non_pharmacological_treatment',
      'epicrisis', 'clinical_feedback', 'veterinarian'
    )
  ),
  drop constraint clinical_audit_events_action_check,
  add constraint clinical_audit_events_action_check check (
    action in (
      'patient_created', 'patient_updated', 'tutor_created', 'tutor_updated',
      'consultation_opened',
      'anamnesis_recorded', 'anamnesis_corrected', 'audio_fact_confirmed',
      'missing_information_decided',
      'hypothesis_accepted', 'hypothesis_discarded', 'hypothesis_added',
      'diagnosis_recorded',
      'pharmacological_treatment_adopted', 'non_pharmacological_treatment_adopted',
      'epicrisis_approved',
      'clinical_feedback_recorded',
      'corrective_record_created',
      'veterinarian_profile_updated'
    )
  );

create or replace function public.update_own_profile(p_display_name text)
returns public.veterinarians
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  normalized text := regexp_replace(btrim(coalesce(p_display_name, '')), '\s+', ' ', 'g');
  current_row public.veterinarians;
  previous_name text;
begin
  if actor is null or not public.is_active_access(actor) then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;

  if char_length(normalized) not between 2 and 80 then
    raise exception 'DISPLAY_NAME_INVALID' using errcode = '23514';
  end if;

  select * into current_row from public.veterinarians where id = actor for update;
  if not found then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;

  if current_row.display_name = normalized then
    return current_row;
  end if;

  previous_name := current_row.display_name;
  update public.veterinarians set display_name = normalized
  where id = actor returning * into current_row;

  insert into public.clinical_audit_events(entity_type, entity_id, action, actor_id, metadata)
  values (
    'veterinarian', actor, 'veterinarian_profile_updated', actor,
    jsonb_build_object('previous', previous_name, 'current', normalized)
  );

  return current_row;
end;
$$;

revoke all on function public.update_own_profile(text) from public, anon;
grant execute on function public.update_own_profile(text) to authenticated;
