import { describe, expect, test } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPatient, listPatients } from "@/features/registro/ficha-service";
import { listTutors } from "@/features/registro/tutor-service";
import type { Database } from "@/lib/supabase/database.types";

type ClinicalRecordRow = Database["public"]["Tables"]["clinical_records"]["Row"];

/**
 * Regresión del flake de CI (run 35789226489): en la clínica compartida coexisten filas
 * `patient` escritas fuera del contrato de contenido (fixtures de otras suites, p. ej.
 * `{ name: "Luna integración" }` o `{}`). Las lecturas de listado/ficha NO deben lanzar
 * ZodError por una fila ajena: se omite la fila malformada con log estructurado y el resto
 * del listado sigue vivo (frontera de lectura tolerante; la escritura sigue siendo estricta).
 */

type FakeResult = { data: unknown; error: unknown };

/** Consulta falsa awaitable y agnóstica de cadena: resuelve la primera operación. */
function fakeClient(data: unknown): SupabaseClient<Database> {
  const result: FakeResult = { data, error: null };
  const query = Object.assign(new Promise<FakeResult>((resolve) => resolve(result)), {
    insert: () => query,
    update: () => query,
    select: () => query,
    eq: () => query,
    in: () => query,
    order: () => query,
    limit: () => query,
    single: () => Promise.resolve(result),
    maybeSingle: () => Promise.resolve(result),
  });
  return { from: () => query } as unknown as SupabaseClient<Database>;
}

const filaValida = {
  id: "paciente-valido",
  clinic_id: "clinica-1",
  record_type: "patient",
  content: {
    name: "Toby",
    species: "canino",
    breed: "Mestizo",
    birthDate: null,
    ageMonths: 24,
    weightKg: 12.5,
    sex: "macho",
    reproductiveStatus: "castrado",
    antecedentes: {
      medicalHistory: [],
      preexistingDiseases: [],
      currentMedications: [],
      knownAllergies: [],
      behavioralHistory: [],
    },
    tutorId: "tutor-1",
  },
  status: "draft",
  supersedes_event_id: null,
  created_by: "vet-ana",
  created_at: "2026-09-22T10:00:00.000Z",
  updated_by: null,
  updated_at: null,
  approved_at: null,
  approved_by: null,
} satisfies ClinicalRecordRow;

const filaAjenaMinima = {
  ...filaValida,
  id: "paciente-ajeno-1",
  content: { name: "Luna integración" },
} satisfies ClinicalRecordRow;

const filaAjenaVacia = {
  ...filaValida,
  id: "paciente-ajeno-2",
  content: {},
} satisfies ClinicalRecordRow;

const filaTutorValida = {
  ...filaValida,
  id: "tutor-valido",
  record_type: "tutor",
  content: { name: "Sra. Tania", phone: "+56 9 5550 0001", email: null },
} satisfies ClinicalRecordRow;

describe("lecturas tolerantes a filas ajenas o malformadas", () => {
  test("listPatients omite las filas malformadas y devuelve las válidas (regresión del flake de CI)", async () => {
    const client = fakeClient([filaAjenaMinima, filaValida, filaAjenaVacia]);
    const listado = await listPatients(client);
    expect(listado.map((entrada) => entrada.record.id)).toEqual(["paciente-valido"]);
  });

  test("getPatient sobre una fila malformada resuelve null sin lanzar", async () => {
    const client = fakeClient(filaAjenaMinima);
    await expect(getPatient(client, "paciente-ajeno-1")).resolves.toBeNull();
  });

  test("listTutors omite las filas malformadas y devuelve las válidas", async () => {
    const client = fakeClient([{ ...filaAjenaMinima, id: "tutor-ajeno" }, filaTutorValida]);
    const listado = await listTutors(client);
    expect(listado.map((entrada) => entrada.record.id)).toEqual(["tutor-valido"]);
  });
});
