import { beforeAll, describe, expect, test } from "bun:test";
import { executeProposal } from "@/features/asistente/proposal-action";
import { openConsultation } from "@/features/registro/consultation-service";
import {
  latestConsultationSummary,
  recordConsultationSummary,
} from "@/features/registro/consultation-summary-service";
import { createPatientFicha } from "@/features/registro/ficha-service";
import { randomRut } from "../../support/rut";
import { ANA, isLiveSupabase, type LiveVeterinarian, signedInVeterinarian } from "../live-supabase";

/**
 * Resumen de la consulta (memoria del agente · migración 025) contra Supabase viva: historial de solo
 * agregar con el más reciente como vigente, y confirmación idempotente. Solo corre con `SUPABASE_LIVE_TESTS=1`.
 */
describe.skipIf(!isLiveSupabase)("resumen de la consulta contra Supabase viva", () => {
  let ana: LiveVeterinarian;
  let consultaId = "";

  beforeAll(async () => {
    ana = await signedInVeterinarian(ANA);
    const alta = await createPatientFicha(ana.client, {
      clinicId: ana.clinicId,
      ficha: {
        name: "Resumen integración",
        species: "canino",
        breed: "Mestizo",
        birthDate: "2020-01-15",
        ageMonths: 72,
        weightKg: 12,
        sex: "macho",
        reproductiveStatus: "entero",
        antecedentes: {
          medicalHistory: [],
          preexistingDiseases: [],
          currentMedications: [],
          knownAllergies: [],
          behavioralHistory: [],
        },
      },
      tutor: {
        newTutor: {
          name: "Sra. Resumen",
          rut: randomRut(),
          phone: null,
          email: "resumen@example.test",
        },
      },
    });
    consultaId = (
      await openConsultation(ana.client, { clinicId: ana.clinicId, patientId: alta.record.id })
    ).record.id;
  });

  test("sin resumen, null; el último guardado es el vigente", async () => {
    expect(await latestConsultationSummary(ana.client, consultaId)).toBeNull();
    await recordConsultationSummary(ana.client, {
      clinicId: ana.clinicId,
      consultationId: consultaId,
      text: "Primero.",
    });
    await recordConsultationSummary(ana.client, {
      clinicId: ana.clinicId,
      consultationId: consultaId,
      text: "Segundo.",
    });
    expect((await latestConsultationSummary(ana.client, consultaId))?.text).toBe("Segundo.");
  });

  test("confirmar la misma propuesta dos veces no duplica y la autoría es del servidor", async () => {
    const accion = {
      kind: "summary" as const,
      consultationId: consultaId,
      text: "Tercero, por el agente.",
    };
    const primera = await executeProposal(ana.client, ana.clinicId, accion);
    expect(primera.attribution?.actorId).toBe(ana.userId);
    const segunda = await executeProposal(ana.client, ana.clinicId, accion);
    expect(segunda.attribution).toBeNull();
  });
});
