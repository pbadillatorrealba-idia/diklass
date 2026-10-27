import type { SupabaseClient } from "@supabase/supabase-js";
import { startOfDay } from "@/features/asistente/consultas-basicas";
import { listConsultationsSince } from "@/features/registro/consultation-service";
import { listPatientsByIds } from "@/features/registro/ficha-service";
import type { Database } from "@/lib/supabase/database.types";

/** Una consulta creada hoy, con el nombre del paciente ya resuelto. */
export type ConsultaDeHoy = {
  id: string;
  patientId: string;
  patientName: string;
  createdAt: string;
  status: "open" | "closed";
};

/** Las abiertas primero (son las que hay que retomar); dentro de cada grupo, por hora de creación. */
export function ordenarConsultasDeHoy(consultas: readonly ConsultaDeHoy[]): ConsultaDeHoy[] {
  const rank = (consulta: ConsultaDeHoy) => (consulta.status === "open" ? 0 : 1);
  return [...consultas].sort((a, b) => rank(a) - rank(b) || a.createdAt.localeCompare(b.createdAt));
}

/** «3 consultas: 1 abierta y 2 cerradas»; sin consultas, «Aún no hay consultas hoy». */
export function resumenDelDia(consultas: readonly ConsultaDeHoy[]): string {
  if (consultas.length === 0) return "Aún no hay consultas hoy";
  const abiertas = consultas.filter((consulta) => consulta.status === "open").length;
  const cerradas = consultas.length - abiertas;
  const cuenta = (n: number, uno: string, varias: string) => `${n} ${n === 1 ? uno : varias}`;
  const partes = [
    abiertas > 0 ? cuenta(abiertas, "abierta", "abiertas") : null,
    cerradas > 0 ? cuenta(cerradas, "cerrada", "cerradas") : null,
  ].filter(Boolean);
  return `${cuenta(consultas.length, "consulta", "consultas")}: ${partes.join(" y ")}`;
}

/**
 * Consultas del día del veterinario con el nombre de su paciente (FR-094: la agenda aún no tiene
 * fuente, así que «hoy» son las consultas creadas hoy). Resuelve solo los pacientes que aparecen,
 * no la lista completa de la clínica.
 */
export async function consultasDeHoy(
  client: SupabaseClient<Database>,
  now: Date,
): Promise<ConsultaDeHoy[]> {
  const consultas = await listConsultationsSince(client, startOfDay(now).toISOString());
  const ids = [...new Set(consultas.map(({ content }) => content.patientId))];
  const fichas = await listPatientsByIds(client, ids);
  const nombres = new Map(fichas.map(({ record, content }) => [record.id, content.name]));
  return ordenarConsultasDeHoy(
    consultas.map(({ record, content }) => ({
      id: record.id,
      patientId: content.patientId,
      patientName: nombres.get(content.patientId) ?? "Paciente sin ficha",
      createdAt: record.created_at,
      status: content.status,
    })),
  );
}
