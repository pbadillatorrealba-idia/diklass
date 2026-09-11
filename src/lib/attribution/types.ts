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
 * Attribution columns of `clinical_records`, named as PostgREST receives them. The database
 * enforces them too (column grants and triggers); this guard fails earlier, with a clearer
 * error. `clinic_id` is not here: a client must send it.
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
