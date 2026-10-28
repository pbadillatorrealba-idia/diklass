import { PACIENTES_DEMO, TUTORES_DEMO } from "../../scripts/demo/datos-demo";
import { rutCheckDigit } from "../../src/lib/rut";
import { recordTestDatasetKey, reserveTestRutBody } from "./test-scope";

let nextRut = Number(process.env.TEST_RUT_START ?? 20_000_000);
const endRut = Number(process.env.TEST_RUT_END ?? 20_009_999);

/**
 * RUT sintético con dígito verificador válido. El RUT del tutor es único por clínica: las
 * pruebas que escriben en una base viva (integración, e2e) necesitan uno distinto cada vez.
 */
export function randomRut(): string {
  if (process.env.TEST_SCOPE_FILE) {
    const body = String(reserveTestRutBody());
    return `${body}-${rutCheckDigit(body)}`;
  }
  if (!Number.isSafeInteger(nextRut) || !Number.isSafeInteger(endRut) || nextRut > endRut) {
    throw new Error("Bloque de RUT de testing agotado o inválido; reservar otro scope.");
  }
  const body = String(nextRut++);
  return `${body}-${rutCheckDigit(body)}`;
}

/**
 * Contenido mínimo válido de un paciente para escribir directo en `clinical_records`: la base
 * exige catálogos y obligatorios (migración 018). `tutorId` es solo un texto no vacío.
 */
export function patientFixture(name = "Cholito") {
  const patient = PACIENTES_DEMO.find((p) => p.ficha.name === name) ?? PACIENTES_DEMO[0];
  if (!patient) throw new Error("Falta la plantilla de paciente.");
  const tutor = TUTORES_DEMO.find((t) => t.key === patient.tutorKey);
  if (!tutor) throw new Error(`Falta tutor de ${patient.key}.`);
  if (process.env.TEST_SCOPE_FILE) {
    recordTestDatasetKey(patient.key);
    recordTestDatasetKey(tutor.key);
  }
  return {
    ficha: { ...structuredClone(patient.ficha), name },
    tutor: { ...tutor, rut: randomRut() },
  };
}

export const patientContent = (name: string, extra: Record<string, unknown> = {}) => ({
  ...patientFixture(name).ficha,
  tutorId: "tutor-de-prueba",
  ...extra,
});
