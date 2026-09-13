import { ATTRIBUTION_CONTROL_FIELDS, type AttributionControlField } from "@/lib/attribution/types";

export class AttributionInputError extends Error {
  readonly code = "INVALID_INPUT";
  readonly fields: AttributionControlField[];

  constructor(fields: AttributionControlField[]) {
    super("La atribución se genera en el servidor.");
    this.name = "AttributionInputError";
    this.fields = fields;
  }
}

export function assertNoClientAttributionFields(payload: Record<string, unknown>): void {
  const forbidden = ATTRIBUTION_CONTROL_FIELDS.filter((field) => field in payload);
  if (forbidden.length > 0) {
    throw new AttributionInputError(forbidden);
  }
}
