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

-- Forma cerrada, validada en el servidor: consulta (uuid) y texto de 1 a 2000 caracteres.
alter table public.clinical_records
  add constraint clinical_records_consultation_summary_check check (
    record_type <> 'consultation_summary'
    or (
      (content ->> 'consultationId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and char_length(btrim(coalesce(content ->> 'text', ''))) between 1 and 2000
    )
  );
