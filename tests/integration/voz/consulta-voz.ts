import { openConsultation } from "@/features/registro/consultation-service";
import { createPatientFicha } from "@/features/registro/ficha-service";
import { patientFixture } from "../../support/rut";
import type { LiveVeterinarian } from "../live-supabase";

/** Paciente sintético con una consulta abierta, para las pruebas vivas de la captura de voz. */
export async function nuevaConsultaVoz(vet: LiveVeterinarian): Promise<string> {
  const fixture = patientFixture("Cholito");
  const ficha = await createPatientFicha(vet.client, {
    clinicId: vet.clinicId,
    ficha: fixture.ficha,
    tutor: { newTutor: fixture.tutor },
  });
  const consulta = await openConsultation(vet.client, {
    clinicId: vet.clinicId,
    patientId: ficha.record.id,
  });
  return consulta.record.id;
}
