import { describe, expect, test } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listPatients } from "@/features/registro/ficha-service";
import { listTutors } from "@/features/registro/tutor-service";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Regresión (sistema-visual 12.11): PostgREST devuelve como máximo 1000 filas por petición. Con
 * más pacientes en la clínica, las listas ordenadas de la más antigua a la más reciente perdían
 * las fichas nuevas (el selector de `/knowledge` no encontraba un paciente recién creado).
 */
const MAX_ROWS = 1000;

function pagedClient(rows: unknown[]): SupabaseClient<Database> {
  const query = {
    select: () => query,
    eq: () => query,
    order: () => query,
    range: (from: number, to: number) =>
      Promise.resolve({ data: rows.slice(from, Math.min(to + 1, from + MAX_ROWS)), error: null }),
    // Sin `range`, el servidor corta en el tope.
    // biome-ignore lint/suspicious/noThenProperty: imita la consulta awaitable de supabase-js.
    then: (resolve: (value: unknown) => void) =>
      resolve({ data: rows.slice(0, MAX_ROWS), error: null }),
  };
  return { from: () => query } as unknown as SupabaseClient<Database>;
}

const base = {
  clinic_id: "clinica-1",
  status: "draft",
  supersedes_event_id: null,
  created_by: "vet-ana",
  created_at: "2026-09-22T10:00:00.000Z",
  updated_by: null,
  updated_at: null,
  approved_at: null,
  approved_by: null,
};

const paciente = (index: number) => ({
  ...base,
  id: `paciente-${index}`,
  record_type: "patient",
  content: {
    name: `Paciente ${index}`,
    species: "canino",
    breed: "Mestizo",
    birthDate: null,
    ageMonths: 24,
    weightKg: null,
    sex: "hembra",
    reproductiveStatus: "entera",
    antecedentes: {
      medicalHistory: [],
      preexistingDiseases: [],
      currentMedications: [],
      knownAllergies: [],
      behavioralHistory: [],
    },
    tutorId: "tutor-1",
  },
});

const tutor = (index: number) => ({
  ...base,
  id: `tutor-${index}`,
  record_type: "tutor",
  content: { name: `Tutor ${index}`, phone: "+56 9 5550 0001", email: null },
});

describe("listas de la clínica con más de 1000 filas", () => {
  test("listPatients devuelve todas, incluida la más reciente", async () => {
    const filas = Array.from({ length: 1005 }, (_, index) => paciente(index));
    const listado = await listPatients(pagedClient(filas));
    expect(listado).toHaveLength(1005);
    expect(listado.at(-1)?.record.id).toBe("paciente-1004");
  });

  test("listTutors devuelve todos, incluido el más reciente", async () => {
    const filas = Array.from({ length: 1005 }, (_, index) => tutor(index));
    const listado = await listTutors(pagedClient(filas));
    expect(listado).toHaveLength(1005);
    expect(listado.at(-1)?.record.id).toBe("tutor-1004");
  });
});
