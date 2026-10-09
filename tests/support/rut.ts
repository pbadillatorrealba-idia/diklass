import { rutCheckDigit } from "../../src/lib/rut";

/**
 * RUT sintético con dígito verificador válido. El RUT del tutor es único por clínica: las
 * pruebas que escriben en una base viva (integración, e2e) necesitan uno distinto cada vez.
 */
export function randomRut(): string {
  const body = String(10_000_000 + Math.floor(Math.random() * 15_000_000));
  return `${body}-${rutCheckDigit(body)}`;
}

/** RUT fijo y válido para pruebas que no tocan la base. */
export const SAMPLE_RUT = "12345678-5";

/**
 * Contenido mínimo válido de un paciente para escribir directo en `clinical_records`: la base
 * exige catálogos y obligatorios (migración 018). `tutorId` es solo un texto no vacío.
 */
export const patientContent = (name: string, extra: Record<string, unknown> = {}) => ({
  name,
  species: "canino",
  breed: "Mestizo",
  sex: "hembra",
  reproductiveStatus: "esterilizado",
  tutorId: "tutor-de-prueba",
  ...extra,
});
