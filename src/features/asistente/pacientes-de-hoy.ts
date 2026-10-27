import { answerPacientesHoy, startOfDay } from "@/features/asistente/consultas-basicas";
import { listConsultationsSince } from "@/features/registro/consultation-service";
import { listPatients } from "@/features/registro/ficha-service";
import { supabase } from "@/lib/supabase/client";

/** Respuesta de «pacientes de hoy»: los de las consultas creadas hoy (la agenda aún no existe). */
export async function pacientesDeHoy(now: Date) {
  const [consultas, pacientes] = await Promise.all([
    listConsultationsSince(supabase, startOfDay(now).toISOString()),
    listPatients(supabase),
  ]);
  return answerPacientesHoy(
    consultas.map(({ record, content }) => ({
      patientId: content.patientId,
      createdAt: record.created_at,
    })),
    new Map(pacientes.map(({ record, content }) => [record.id, content.name])),
    now,
  );
}
