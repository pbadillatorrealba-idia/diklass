import type { ClinicalGuardOutcome } from "@/components/registro/use-clinical-guard";
import type { Attribution } from "@/lib/attribution/types";

/**
 * Mensaje de la última operación de la consulta y su atribución en línea (12.13). Viajan en un
 * solo estado porque la atribución se lee como parte de la frase: solo acompaña al éxito de la
 * operación que la devolvió, nunca a un fallo ni a un mensaje posterior (FR-063 · US12).
 */
export type OperationStatus = { text: string; attribution: Attribution | null };

export function operationStatus(
  outcome: ClinicalGuardOutcome,
  success: string,
  failure: string,
  attribution: Attribution | null = null,
): OperationStatus {
  if (outcome === "expired") {
    return notice("La sesión ya no es válida.");
  }
  return outcome === "error" ? notice(failure) : { text: success, attribution };
}

/** Aviso sin autoría: restauraciones, sesión caducada, fallos. */
export function notice(text: string): OperationStatus {
  return { text, attribution: null };
}
