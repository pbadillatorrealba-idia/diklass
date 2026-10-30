import type { ClinicalRecordRow } from "@/features/registro/summaries";
import type { Attribution } from "@/lib/attribution/types";

/**
 * Autor y momento de cada entrada para sus `AttributionBadge` (FR-004 · US2-AC6): son las
 * columnas de atribución que el servidor fija; jamás viajan de vuelta en ningún payload.
 */
export function attributionFromRow(record: ClinicalRecordRow): Attribution {
  if (record.status === "approved") {
    return {
      actorId: record.approved_by ?? record.created_by,
      occurredAt: record.approved_at ?? record.created_at,
      action: "epicrisis_approved",
    };
  }
  if (record.status === "corrective") {
    return {
      actorId: record.created_by,
      occurredAt: record.created_at,
      action: "corrective_record_created",
      supersedesEventId: record.supersedes_event_id,
    };
  }
  return { actorId: record.created_by, occurredAt: record.created_at, action: null };
}
