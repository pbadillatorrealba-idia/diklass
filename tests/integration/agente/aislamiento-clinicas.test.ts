import { beforeAll, describe, expect, test } from "bun:test";
import { openConsultation } from "@/features/registro/consultation-service";
import { recordConsultationSummary } from "@/features/registro/consultation-summary-service";
import { createPatientFicha } from "@/features/registro/ficha-service";
import { makeDb } from "../../../supabase/functions/agent/db";
import { randomRut } from "../../support/rut";
import {
  ANA,
  adminClient,
  isLiveSupabase,
  type LiveVeterinarian,
  signedInVeterinarian,
} from "../live-supabase";

/**
 * Aislamiento entre clínicas en cada lectura del agente (5.5): `makeDb` usa el cliente del solicitante,
 * así que RLS debe dejar a una veterinaria de otra clínica sin ver pacientes, consultas ni resúmenes.
 * Solo corre con `SUPABASE_LIVE_TESTS=1`.
 */
describe.skipIf(!isLiveSupabase)("lecturas del agente entre clínicas, contra Supabase viva", () => {
  const NOMBRE = `Aislado ${crypto.randomUUID().slice(0, 8)}`;
  const HACE_UN_DIA = new Date(Date.now() - 24 * 3600_000).toISOString();
  let ana: LiveVeterinarian;
  let otra: LiveVeterinarian;
  let pacienteId = "";
  let consultaId = "";

  beforeAll(async () => {
    const admin = adminClient();
    const sufijo = crypto.randomUUID().slice(0, 8);
    const credenciales = {
      email: `vet.otra.${sufijo}@example.test`,
      password: `synthetic-password-${sufijo}`,
    };
    const { data: clinica, error: e1 } = await admin
      .from("clinics")
      .insert({ name: `Otra clínica ${sufijo}` })
      .select("id")
      .single();
    if (e1) throw e1;
    const { data: user, error: e2 } = await admin.auth.admin.createUser({
      ...credenciales,
      email_confirm: true,
    });
    if (e2 || !user.user) throw e2 ?? new Error("sin usuario");
    const { error: e3 } = await admin.from("veterinarians").insert({
      id: user.user.id,
      clinic_id: clinica.id,
      identifier: credenciales.email,
      display_name: "Otra clínica",
    });
    if (e3) throw e3;
    otra = await signedInVeterinarian(credenciales);

    ana = await signedInVeterinarian(ANA);
    const alta = await createPatientFicha(ana.client, {
      clinicId: ana.clinicId,
      ficha: {
        name: NOMBRE,
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
        newTutor: { name: "Sra. Aislada", rut: randomRut(), phone: null, email: "a@example.test" },
      },
    });
    pacienteId = alta.record.id;
    consultaId = (
      await openConsultation(ana.client, { clinicId: ana.clinicId, patientId: pacienteId })
    ).record.id;
    await recordConsultationSummary(ana.client, {
      clinicId: ana.clinicId,
      consultationId: consultaId,
      text: "Resumen reservado de la clínica de Ana.",
    });
  });

  test("control: la clínica dueña sí ve sus datos", async () => {
    const db = makeDb(ana.client);
    expect(await db.openConsultations(pacienteId)).toContain(consultaId);
    expect(await db.consultationSummary(consultaId)).toContain("reservado");
    const { data } = await db.rpc("search_patients", { p_name: NOMBRE, p_limit: 5, p_offset: 0 });
    expect((data as unknown[]).length).toBe(1);
    const hoy = await db.consultationsSince(HACE_UN_DIA);
    expect(hoy.consultas.some((c) => c.paciente === NOMBRE)).toBe(true);
    const ficha = await db.patientFicha(pacienteId);
    expect(ficha?.nombre).toBe(NOMBRE);
    expect(ficha?.tutor).toBe("Sra. Aislada");
    // Principio V: la ficha para el modelo no lleva RUT, teléfono ni correo del tutor.
    expect(JSON.stringify(ficha)).not.toMatch(/rut|phone|email|@example/i);
    expect(Array.isArray(await db.knowledge("ansiedad por separación"))).toBe(true);
  });

  test("otra clínica no ve consultas, resumen, búsqueda ni agenda del día", async () => {
    const db = makeDb(otra.client);
    expect(await db.openConsultations(pacienteId)).toEqual([]);
    expect(await db.consultationSummary(consultaId)).toBeNull();
    const { data } = await db.rpc("search_patients", { p_name: NOMBRE, p_limit: 5, p_offset: 0 });
    expect(data as unknown[]).toEqual([]);
    const hoy = await db.consultationsSince(HACE_UN_DIA);
    expect(hoy.consultas.some((c) => c.paciente === NOMBRE)).toBe(false);
    expect(await db.patientFicha(pacienteId)).toBeNull();
  });
});
