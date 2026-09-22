import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { assertNoClientAttributionFields } from "@/lib/attribution/guards";
import type { Attribution, ClinicalMutationResult } from "@/lib/attribution/types";
import type { Database } from "@/lib/supabase/database.types";

type ClinicalRecord = Database["public"]["Tables"]["clinical_records"]["Row"];

/**
 * Relectura de la atribución real desde la traza (FR-063): la acción la enumera el evento que
 * escribió el trigger, no una suposición del cliente. Sin evento aún, la atribución de reserva
 * sale de las columnas de atribución de la propia fila.
 */
async function readAttribution(
  client: SupabaseClient<Database>,
  record: ClinicalRecord,
): Promise<Attribution> {
  const { data: event, error: eventError } = await client
    .from("clinical_audit_events")
    .select("action, actor_id, occurred_at, supersedes_event_id")
    .eq("entity_id", record.id)
    .order("occurred_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (eventError) {
    throw eventError;
  }

  return event
    ? {
        actorId: event.actor_id,
        occurredAt: event.occurred_at,
        action: event.action,
        supersedesEventId: event.supersedes_event_id,
      }
    : {
        actorId: record.created_by,
        occurredAt: record.created_at,
        action: null,
        supersedesEventId: record.supersedes_event_id,
      };
}

export async function createClinicalRecord(
  client: SupabaseClient<Database>,
  payload: Record<string, unknown>,
): Promise<ClinicalMutationResult<ClinicalRecord>> {
  assertNoClientAttributionFields(payload);
  const { data, error } = await client
    .from("clinical_records")
    .insert(payload as never)
    .select("*")
    .single();
  if (error || !data) {
    throw error ?? new Error("No se pudo crear el registro clínico.");
  }

  return { record: data, attribution: await readAttribution(client, data) };
}

/**
 * Actualiza SOLO el contenido de un registro clínico (D9). Las columnas de atribución no forman
 * parte de la firma ni del UPDATE: el servidor las fija y el rol de la Data API solo puede
 * escribir `content`. El contenido con campos de control de atribución se rechaza antes de
 * tocar el servidor (FR-063).
 */
export async function updateClinicalContent(
  client: SupabaseClient<Database>,
  recordId: string,
  content: Record<string, unknown>,
): Promise<ClinicalMutationResult<ClinicalRecord>> {
  assertNoClientAttributionFields(content);
  const { data, error } = await client
    .from("clinical_records")
    .update({ content: content as ClinicalRecord["content"] })
    .eq("id", recordId)
    .select("*")
    .single();
  if (error || !data) {
    throw error ?? new Error("No se pudo actualizar el contenido del registro clínico.");
  }

  return { record: data, attribution: await readAttribution(client, data) };
}

/** Respuesta de la RPC `approve_clinical_record` (misma firma y respuesta en su extensión D4). */
const approvalResponseSchema = z.object({
  record: z.object({ id: z.string(), status: z.string() }),
  attribution: z.object({
    actorId: z.string(),
    occurredAt: z.string(),
    action: z.string().nullable(),
    supersedesEventId: z.string().nullable().optional(),
  }),
});

/**
 * Aprobación profesional de una epicrisis (FR-012) por la única ruta sancionada del servidor:
 * la RPC `approve_clinical_record`, que deriva el aprobador de la sesión y, con D4, cierra la
 * consulta vinculada en la misma transacción. La respuesta ya trae la atribución real.
 */
export async function approveClinicalRecord(
  client: SupabaseClient<Database>,
  recordId: string,
): Promise<ClinicalMutationResult<{ id: string; status: string }>> {
  const { data, error } = await client.rpc("approve_clinical_record", { p_record_id: recordId });
  if (error) {
    throw error;
  }
  const parsed = approvalResponseSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("No se pudo leer la aprobación del registro clínico.", {
      cause: parsed.error,
    });
  }
  return parsed.data;
}

/**
 * Corrección de un registro clínico ya aprobado (FR-024 · US3-AC4): crea un registro ADICIONAL
 * con `status` 'corrective' cuyo `supersedes_event_id` apunta al evento que supersede (D8) y
 * conserva el original legible e intocable. La petición solo mapea campos del dominio: ninguna
 * columna de atribución viaja del cliente (FR-063).
 */
export async function createCorrectiveRecord(
  client: SupabaseClient<Database>,
  payload: {
    clinicId: string;
    recordType: string;
    content: Record<string, unknown>;
    supersedesEventId: string;
  },
): Promise<ClinicalMutationResult<ClinicalRecord>> {
  assertNoClientAttributionFields(payload);
  return createClinicalRecord(client, {
    clinic_id: payload.clinicId,
    record_type: payload.recordType,
    content: payload.content,
    status: "corrective",
    supersedes_event_id: payload.supersedesEventId,
  });
}
