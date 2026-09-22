export type Attribution = {
  actorId: string;
  occurredAt: string;
  /** An FR-063 action, or null when the transition has no enumerated action. */
  action: string | null;
  supersedesEventId?: string | null;
};

export type ClinicalMutationResult<T> = {
  record: T;
  attribution: Attribution;
};

/**
 * Attribution columns the server owns across clinical tables, named as PostgREST receives them.
 * These are `created_by`, `created_at`, `updated_by`, `updated_at`, `approved_by`, `approved_at`
 * on `clinical_records`, and `actor_id` on `clinical_audit_events`. None may be set by a client.
 * The database enforces them too (column grants and triggers); this guard fails earlier, with a
 * clearer error. `clinic_id` is deliberately absent: a client must send it.
 */
export const ATTRIBUTION_CONTROL_FIELDS = [
  "actor_id",
  "created_by",
  "created_at",
  "updated_by",
  "updated_at",
  "approved_by",
  "approved_at",
] as const;

export type AttributionControlField = (typeof ATTRIBUTION_CONTROL_FIELDS)[number];
