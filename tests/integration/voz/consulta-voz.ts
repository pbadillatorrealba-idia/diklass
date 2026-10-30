import { openConsultation } from "@/features/registro/consultation-service";
import { createPatientFicha } from "@/features/registro/ficha-service";
import { randomRut } from "../../support/rut";
import type { LiveVeterinarian } from "../live-supabase";

/** Paciente sintético con una consulta abierta, para las pruebas vivas de la captura de voz. */
export async function nuevaConsultaVoz(vet: LiveVeterinarian): Promise<string> {
  const ficha = await createPatientFicha(vet.client, {
    clinicId: vet.clinicId,
    ficha: {
      name: "Rocky Voz",
      species: "canino",
      breed: "Mestizo",
      birthDate: "2021-05-01",
      ageMonths: 24,
      weightKg: 12.4,
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
        name: "Sra. Sintética Voz",
        rut: randomRut(),
        phone: "+56 9 5550 0098",
        email: null,
      },
    },
  });
  const consulta = await openConsultation(vet.client, {
    clinicId: vet.clinicId,
    patientId: ficha.record.id,
  });
  return consulta.record.id;
}
