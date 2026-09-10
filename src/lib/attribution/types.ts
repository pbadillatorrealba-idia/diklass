export type Attribution = {
  actorId: string;
  occurredAt: string;
  action: string;
  supersedesEventId?: string | null;
};

export type ClinicalMutationResult<T> = {
  record: T;
  attribution: Attribution;
};

export const ATTRIBUTION_CONTROL_FIELDS = [
  "actorId",
  "createdBy",
  "createdAt",
  "updatedBy",
  "updatedAt",
  "approvedBy",
  "approvedAt",
  "clinicId",
] as const;

export type AttributionControlField = (typeof ATTRIBUTION_CONTROL_FIELDS)[number];
