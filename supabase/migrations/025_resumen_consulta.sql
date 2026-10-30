-- 025_resumen_consulta.sql — Resumen de la consulta (memoria del agente).
--
-- Cambio: openspec/changes/agente-conversacional (memoria de la consulta). El agente propone un resumen
-- corto de la consulta en curso y el veterinario lo confirma: queda como registro clínico
-- `consultation_summary` en la traza auditada (autor y momento fijados por el servidor, FR-063). El
-- historial es de solo agregar: un resumen nuevo es otra fila y el vigente es el más reciente.
--
-- Su alta NO es una acción clínica enumerada (igual que el borrador de epicrisis o `audio_fact`):
-- `clinical_record_action` devuelve null para el tipo, no se escribe evento y la atribución es la de
-- la propia fila (`created_by`/`created_at`). Por eso no se toca la enumeración taxativa de acciones ni
-- el mapping. No se sella con la consulta cerrada: solo REFERENCIA la consulta (como
-- `clinical_feedback`) y no engrosa su conjunto de registros de trabajo (SC-009).
-- Verificación: supabase/tests/025_resumen_consulta.sql (pgTap).

alter table public.clinical_records
  drop constraint clinical_records_record_type_check,
  add constraint clinical_records_record_type_check check (
    record_type in (
      'patient', 'tutor', 'consultation', 'anamnesis', 'audio_fact',
      'missing_information', 'hypothesis', 'diagnosis',
      'pharmacological_treatment', 'non_pharmacological_treatment',
      'epicrisis', 'clinical_feedback', 'consultation_summary'
    )
  );

-- Forma cerrada, validada en el servidor: consulta (uuid), texto de 1 a 2000 caracteres (string, sin
-- contar espacios ni saltos) y procedencia «inferida» (lo redacta el asistente y el veterinario lo
-- confirma); ninguna otra clave.
alter table public.clinical_records
  add constraint clinical_records_consultation_summary_check check (
    record_type <> 'consultation_summary'
    -- `coalesce(…, false)`: un CHECK que da NULL (clave ausente) pasa, y aquí debe rechazar.
    or coalesce(
      (content - 'consultationId' - 'text' - 'provenance') = '{}'::jsonb
      and (content ->> 'consultationId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and jsonb_typeof(content -> 'text') = 'string'
      and char_length(btrim(content ->> 'text', E' \t\r\n')) between 1 and 2000
      and content ->> 'provenance' = 'inferida',
      false
    )
  );

-- Solo agregar: un resumen jamás se reescribe (ni su contenido ni su tipo). Sin este guard el borrador
-- seguiría editable por la policy de UPDATE de borradores (003) y el cambio no dejaría evento, porque el
-- mapping devuelve null. Un resumen nuevo es otra fila.
create or replace function public.guard_consultation_summary_immutable()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  if old.record_type = 'consultation_summary' or new.record_type = 'consultation_summary' then
    raise exception 'CONSULTATION_SUMMARY_IMMUTABLE' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger clinical_records_guard_summary
before update on public.clinical_records
for each row execute function public.guard_consultation_summary_immutable();

-- La consulta referida existe y es de la misma clínica: no se puede resumir una ajena ni inexistente.
create or replace function public.validate_consultation_summary()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  if new.record_type <> 'consultation_summary' then
    return new;
  end if;
  if not exists (
    select 1
    from public.clinical_records target
    where target.id::text = new.content ->> 'consultationId'
      and target.record_type = 'consultation'
      and target.clinic_id = new.clinic_id
  ) then
    raise exception 'CONSULTATION_NOT_FOUND' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger clinical_records_validate_summary
before insert on public.clinical_records
for each row execute function public.validate_consultation_summary();
