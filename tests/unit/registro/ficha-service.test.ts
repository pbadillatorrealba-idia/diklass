import { describe, expect, test } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  addAntecedentItem,
  createPatientFicha,
  getPatient,
  listPatients,
  updatePatientFicha,
} from "@/features/registro/ficha-service";
import type { PatientContent, TutorContent } from "@/features/registro/schema";
import { createTutor, listTutors, updateTutor } from "@/features/registro/tutor-service";
import { isAuthenticationRequired } from "@/lib/errors";
import type { Database } from "@/lib/supabase/database.types";

type ClinicalRecordRow = Database["public"]["Tables"]["clinical_records"]["Row"];

type FakeCall = { table: string; method: string; args: unknown[] };
type FakeResult = { data: unknown; error: unknown };

/**
 * Consulta falsa: una Promise REAL con los métodos de cadena encima. Los constructores de
 * PostgREST son awaitables sin terminal y el mock se comporta igual, sin propiedad `then`
 * propia (lint/suspicious/noThenProperty).
 */
type FakeQuery = Promise<FakeResult> & {
  insert: (...args: unknown[]) => FakeQuery;
  update: (...args: unknown[]) => FakeQuery;
  select: (...args: unknown[]) => FakeQuery;
  eq: (...args: unknown[]) => FakeQuery;
  is: (...args: unknown[]) => FakeQuery;
  in: (...args: unknown[]) => FakeQuery;
  order: (...args: unknown[]) => FakeQuery;
  limit: (...args: unknown[]) => FakeQuery;
  single: () => Promise<FakeResult>;
  maybeSingle: () => Promise<FakeResult>;
};

/**
 * Cliente falso con resultados por tabla y operación (`insert`/`update`/`select`), consumidos
 * en orden de llamada. Cada mutación de `clinical-mutations` termina en `single()` y relee la
 * atribución con un `select` sobre `clinical_audit_events`.
 */
function fakeClient(queues: Partial<Record<string, FakeResult[]>> = {}) {
  const calls: FakeCall[] = [];
  const take = (key: string): FakeResult => queues[key]?.shift() ?? { data: null, error: null };

  // El resultado se resuelve con la primera llamada de la cadena (que fija la operación de la
  // cola) y todo el encadenado devuelve esa misma Promise.
  const from = (table: string): FakeQuery => {
    let settle: (value: FakeResult) => void = () => {};
    let started = false;
    let op = "select";
    const chain =
      (method: string) =>
      (...args: unknown[]): FakeQuery => {
        if (method === "insert" || method === "update") {
          op = method;
        }
        calls.push({ table, method, args });
        if (!started) {
          started = true;
          settle(take(`${table}:${op}`));
        }
        return query;
      };
    const query: FakeQuery = Object.assign(
      new Promise<FakeResult>((resolve) => {
        settle = resolve;
      }),
      {
        insert: chain("insert"),
        update: chain("update"),
        select: chain("select"),
        eq: chain("eq"),
        is: chain("is"),
        in: chain("in"),
        order: chain("order"),
        limit: chain("limit"),
        single: (): Promise<FakeResult> => {
          calls.push({ table, method: "single", args: [] });
          return query;
        },
        maybeSingle: (): Promise<FakeResult> => {
          calls.push({ table, method: "maybeSingle", args: [] });
          return query;
        },
      },
    );
    return query;
  };

  const rpc = async (name: string, args?: unknown) => {
    calls.push({ table: "rpc", method: name, args: [args] });
    return take(`rpc:${name}`);
  };

  // El reporte de errores jamás ensucia `calls`: los tests de rechazo exigen cero llamadas.
  const functions = {
    invoke: async () => {
      await Promise.resolve();
      return { error: null };
    },
  };
  return {
    client: { from, rpc, functions } as unknown as SupabaseClient<Database>,
    calls,
  };
}

function fila(overrides: Partial<ClinicalRecordRow> = {}): ClinicalRecordRow {
  return {
    approved_at: null,
    approved_by: null,
    clinic_id: "clinica-1",
    content: {},
    created_at: "2026-09-22T09:00:00.000Z",
    created_by: "vet-ana",
    id: "record-1",
    record_type: "patient",
    status: "draft",
    supersedes_event_id: null,
    updated_at: null,
    updated_by: null,
    ...overrides,
  };
}

function ficha(
  cambios: Partial<Omit<PatientContent, "tutorId">> = {},
): Omit<PatientContent, "tutorId"> {
  return {
    name: "Luna",
    species: "perro",
    breed: "Mestizo",
    birthDate: "2021-05-01",
    ageMonths: 24,
    weightKg: 12.4,
    sex: "hembra",
    reproductiveStatus: "esterilizada",
    antecedentes: {
      medicalHistory: [],
      preexistingDiseases: [],
      currentMedications: [],
      knownAllergies: [],
      behavioralHistory: [],
    },
    ...cambios,
  };
}

const tutorNuevo: TutorContent = { name: "Sra. Pérez", phone: "+56 9 1111 1111", email: null };

const contenidoFichaConTutor = {
  ...ficha(),
  tutorId: "tutor-nuevo",
};

describe("createPatientFicha (FR-001 · US1-AC1, FR-027 · US1-AC4)", () => {
  test("con tutor nuevo: crea primero el tutor y luego la ficha con su tutorId", async () => {
    const { client, calls } = fakeClient({
      "clinical_records:insert": [
        {
          data: fila({ id: "tutor-nuevo", record_type: "tutor", content: tutorNuevo }),
          error: null,
        },
        {
          data: fila({ id: "paciente-1", record_type: "patient", content: contenidoFichaConTutor }),
          error: null,
        },
      ],
    });

    const alta = await createPatientFicha(client, {
      clinicId: "clinica-1",
      ficha: ficha(),
      tutor: { newTutor: tutorNuevo },
    });

    const inserciones = calls.filter((call) => call.method === "insert");
    expect(inserciones).toHaveLength(2);
    expect(inserciones[0]?.args[0]).toEqual({
      clinic_id: "clinica-1",
      record_type: "tutor",
      content: tutorNuevo,
      status: "draft",
    });
    expect(inserciones[1]?.args[0]).toEqual({
      clinic_id: "clinica-1",
      record_type: "patient",
      content: contenidoFichaConTutor,
      status: "draft",
    });
    expect(alta.tutorId).toBe("tutor-nuevo");
    expect(alta.record.id).toBe("paciente-1");
  });

  test("con tutor existente: asocia sin duplicar el tutor (US1-AC4)", async () => {
    const { client, calls } = fakeClient({
      "clinical_records:insert": [
        {
          data: fila({
            id: "paciente-2",
            record_type: "patient",
            content: { ...ficha({ name: "Simón" }), tutorId: "tutor-existente" },
          }),
          error: null,
        },
      ],
    });

    const alta = await createPatientFicha(client, {
      clinicId: "clinica-1",
      ficha: ficha({ name: "Simón" }),
      tutor: { existingTutorId: "tutor-existente" },
    });

    const inserciones = calls.filter((call) => call.method === "insert");
    expect(inserciones).toHaveLength(1);
    expect(inserciones[0]?.args[0]).toMatchObject({
      record_type: "patient",
      content: { tutorId: "tutor-existente" },
    });
    expect(alta.tutorId).toBe("tutor-existente");
  });

  test("rechaza una ficha inválida sin tocar el servidor", async () => {
    const { client, calls } = fakeClient({});

    try {
      await createPatientFicha(client, {
        clinicId: "clinica-1",
        ficha: ficha({ name: "   " }),
        tutor: { newTutor: tutorNuevo },
      });
      throw new Error("se esperaba el rechazo de la ficha inválida");
    } catch (error) {
      expect(error).toBeInstanceOf(z.ZodError);
    }
    expect(calls).toEqual([]);
  });

  test("exige al menos un medio de contacto del tutor (FR-027)", async () => {
    const { client, calls } = fakeClient({});

    try {
      await createPatientFicha(client, {
        clinicId: "clinica-1",
        ficha: ficha(),
        tutor: { newTutor: { name: "Sra. Pérez", phone: null, email: null } },
      });
      throw new Error("se esperaba el rechazo del tutor sin contacto");
    } catch (error) {
      expect(error).toBeInstanceOf(z.ZodError);
    }
    expect(calls).toEqual([]);
  });
});

describe("updatePatientFicha (FR-001)", () => {
  test("actualiza la ficha conservando el tutorId previo", async () => {
    const previa = { ...ficha({ weightKg: 11 }), tutorId: "tutor-1" };
    const { client, calls } = fakeClient({
      "clinical_records:select": [
        {
          data: fila({ id: "paciente-1", record_type: "patient", content: previa }),
          error: null,
        },
      ],
      "clinical_records:insert": [],
      "clinical_records:update": [
        {
          data: fila({
            id: "paciente-1",
            record_type: "patient",
            content: { ...ficha(), tutorId: "tutor-1" },
          }),
          error: null,
        },
      ],
    });

    await updatePatientFicha(client, "paciente-1", ficha());

    const actualizaciones = calls.filter((call) => call.method === "update");
    expect(actualizaciones).toHaveLength(1);
    expect(actualizaciones[0]?.args[0]).toEqual({
      content: { ...ficha(), tutorId: "tutor-1" },
    });
  });

  test("sin ficha existente falla sin actualizar nada", async () => {
    const { client, calls } = fakeClient({});

    try {
      await updatePatientFicha(client, "desconocido", ficha());
      throw new Error("se esperaba el fallo por ficha inexistente");
    } catch (error) {
      expect((error as Error).message).toMatch(/no se encontró la ficha del paciente/i);
    }
    expect(calls.filter((call) => call.method === "update")).toEqual([]);
  });
});

describe("addAntecedentItem (FR-001 · US1-AC2, FR-044)", () => {
  test("apéndice sobre un grupo sin tocar los ítems previos ni los demás campos", async () => {
    const previa = {
      ...ficha({
        antecedentes: {
          medicalHistory: [{ text: "Displasia de cadera", negative: false }],
          preexistingDiseases: [],
          currentMedications: [],
          knownAllergies: [{ text: "Sin alergias conocidas", negative: true }],
          behavioralHistory: [],
        },
      }),
      tutorId: "tutor-1",
    };
    const { client, calls } = fakeClient({
      "clinical_records:select": [
        { data: fila({ id: "paciente-1", record_type: "patient", content: previa }), error: null },
      ],
      "clinical_records:update": [
        { data: fila({ id: "paciente-1", record_type: "patient", content: previa }), error: null },
      ],
    });

    await addAntecedentItem(client, "paciente-1", "preexistingDiseases", {
      text: "Hipotiroidismo",
      negative: false,
    });

    const actualizaciones = calls.filter((call) => call.method === "update");
    expect(actualizaciones).toHaveLength(1);
    expect(actualizaciones[0]?.args[0]).toEqual({
      content: {
        ...previa,
        antecedentes: {
          medicalHistory: [{ text: "Displasia de cadera", negative: false }],
          preexistingDiseases: [{ text: "Hipotiroidismo", negative: false }],
          currentMedications: [],
          knownAllergies: [{ text: "Sin alergias conocidas", negative: true }],
          behavioralHistory: [],
        },
      },
    });
  });

  test("si otro veterinario editó la ficha entretanto, relee y apénda sobre su versión (revisión de la PR #27)", async () => {
    const previa = { ...ficha(), tutorId: "tutor-1" };
    const editadaPorOtro = {
      ...previa,
      antecedentes: {
        ...previa.antecedentes,
        knownAllergies: [{ text: "Penicilina", negative: false }],
      },
    };
    const { client, calls } = fakeClient({
      "clinical_records:select": [
        { data: fila({ id: "paciente-1", record_type: "patient", content: previa }), error: null },
        {
          data: fila({
            id: "paciente-1",
            record_type: "patient",
            content: editadaPorOtro,
            updated_at: "2026-09-22T10:00:00.000000+00:00",
          }),
          error: null,
        },
      ],
      "clinical_records:update": [
        { data: null, error: null },
        {
          data: fila({ id: "paciente-1", record_type: "patient", content: editadaPorOtro }),
          error: null,
        },
      ],
    });

    await addAntecedentItem(client, "paciente-1", "preexistingDiseases", {
      text: "Hipotiroidismo",
      negative: false,
    });

    const actualizaciones = calls.filter((call) => call.method === "update");
    expect(actualizaciones).toHaveLength(2);
    expect(actualizaciones[1]?.args[0]).toEqual({
      content: {
        ...editadaPorOtro,
        antecedentes: {
          ...editadaPorOtro.antecedentes,
          preexistingDiseases: [{ text: "Hipotiroidismo", negative: false }],
        },
      },
    });
    // Cada UPDATE exige la versión que se acaba de leer.
    expect(calls.filter((call) => call.method === "is")[0]?.args).toEqual(["updated_at", null]);
    expect(
      calls.filter((call) => call.method === "eq" && call.args[0] === "updated_at")[0]?.args,
    ).toEqual(["updated_at", "2026-09-22T10:00:00.000000+00:00"]);
  });

  test("un grupo desconocido se rechaza sin tocar el servidor", async () => {
    const { client, calls } = fakeClient({});

    try {
      await addAntecedentItem(client, "paciente-1", "otra_cosa" as never, {
        text: "Cualquier cosa",
        negative: false,
      });
      throw new Error("se esperaba el rechazo del grupo desconocido");
    } catch (error) {
      expect((error as Error).message).toMatch(/grupo de antecedentes/i);
    }
    expect(calls).toEqual([]);
  });

  test("un ítem inválido no se aplica", async () => {
    const { client, calls } = fakeClient({
      "clinical_records:select": [
        {
          data: fila({
            id: "paciente-1",
            record_type: "patient",
            content: { ...ficha(), tutorId: "t-1" },
          }),
          error: null,
        },
      ],
    });

    try {
      await addAntecedentItem(client, "paciente-1", "knownAllergies", {
        text: "   ",
        negative: false,
      });
      throw new Error("se esperaba el rechazo del ítem inválido");
    } catch (error) {
      expect(error).toBeInstanceOf(z.ZodError);
    }
    expect(calls.filter((call) => call.method === "update")).toEqual([]);
  });
});

describe("getPatient y listPatients (US1-AC5 · D10)", () => {
  test("getPatient devuelve la ficha con sus medicamentos y antecedentes conductuales", async () => {
    const content = {
      ...ficha({
        antecedentes: {
          medicalHistory: [],
          preexistingDiseases: [],
          currentMedications: [{ text: "Fluoxetina 20 mg cada 24 h", negative: false }],
          knownAllergies: [],
          behavioralHistory: [{ text: "Ansiedad ante tormentas", negative: false }],
        },
      }),
      tutorId: "tutor-1",
    };
    const { client } = fakeClient({
      "clinical_records:select": [
        { data: fila({ id: "paciente-1", record_type: "patient", content }), error: null },
      ],
    });

    const paciente = await getPatient(client, "paciente-1");

    expect(paciente?.record.id).toBe("paciente-1");
    expect(paciente?.content.antecedentes.currentMedications).toEqual([
      { text: "Fluoxetina 20 mg cada 24 h", negative: false },
    ]);
    expect(paciente?.content.antecedentes.behavioralHistory).toEqual([
      { text: "Ansiedad ante tormentas", negative: false },
    ]);
  });

  test("getPatient devuelve null cuando no existe", async () => {
    const { client } = fakeClient({});

    expect(await getPatient(client, "desconocido")).toBeNull();
  });

  test("listPatients pide orden estable por created_at y devuelve las fichas", async () => {
    const filas = [
      fila({
        id: "p-1",
        record_type: "patient",
        content: { ...ficha({ name: "Luna" }), tutorId: "tutor-1" },
        created_at: "2026-09-22T09:00:00.000Z",
      }),
      fila({
        id: "p-2",
        record_type: "patient",
        content: { ...ficha({ name: "Simón" }), tutorId: "tutor-1" },
        created_at: "2026-09-22T10:00:00.000Z",
      }),
    ];
    const { client, calls } = fakeClient({
      "clinical_records:select": [{ data: filas, error: null }],
    });

    const lista = await listPatients(client);

    expect(lista.map((entrada) => entrada.content.name)).toEqual(["Luna", "Simón"]);
    expect(lista.map((entrada) => entrada.record.id)).toEqual(["p-1", "p-2"]);
    expect(calls.some((call) => call.method === "eq" && call.args[0] === "record_type")).toBe(true);
    const ordenes = calls.filter((call) => call.method === "order");
    expect(ordenes.map((call) => call.args[0])).toEqual(["created_at", "id"]);
  });
});

describe("tutor-service (FR-027)", () => {
  test("createTutor inserta el tutor con contenido validado", async () => {
    const { client, calls } = fakeClient({
      "clinical_records:insert": [
        { data: fila({ id: "tutor-1", record_type: "tutor", content: tutorNuevo }), error: null },
      ],
    });

    const creado = await createTutor(client, { clinicId: "clinica-1", tutor: tutorNuevo });

    expect(calls.filter((call) => call.method === "insert")[0]?.args[0]).toEqual({
      clinic_id: "clinica-1",
      record_type: "tutor",
      content: tutorNuevo,
      status: "draft",
    });
    expect(creado.record.id).toBe("tutor-1");
  });

  test("updateTutor actualiza solo el contenido del tutor", async () => {
    const { client, calls } = fakeClient({
      "clinical_records:update": [
        { data: fila({ id: "tutor-1", record_type: "tutor", content: tutorNuevo }), error: null },
      ],
    });

    await updateTutor(client, "tutor-1", tutorNuevo);

    expect(calls.filter((call) => call.method === "update")[0]?.args[0]).toEqual({
      content: tutorNuevo,
    });
  });

  test("listTutors devuelve los tutores en orden estable", async () => {
    const { client, calls } = fakeClient({
      "clinical_records:select": [
        {
          data: [
            fila({ id: "tutor-1", record_type: "tutor", content: tutorNuevo }),
            fila({
              id: "tutor-2",
              record_type: "tutor",
              content: { name: "Sr. Soto", phone: null, email: "soto@example.test" },
            }),
          ],
          error: null,
        },
      ],
    });

    const tutores = await listTutors(client);

    expect(tutores.map((entrada) => entrada.content.name)).toEqual(["Sra. Pérez", "Sr. Soto"]);
    expect(calls.some((call) => call.method === "eq" && call.args[0] === "record_type")).toBe(true);
    expect(calls.filter((call) => call.method === "order").map((call) => call.args[0])).toEqual([
      "created_at",
      "id",
    ]);
  });
});

describe("propagación de errores (Constitución IV · errores de auth intactos)", () => {
  test("el error del servidor viaja sin envolver para que isAuthenticationRequired lo reconozca", async () => {
    const falloDeSesion = { code: "42501", message: "JWT expired" };
    const { client } = fakeClient({
      "clinical_records:insert": [{ data: null, error: falloDeSesion }],
    });

    try {
      await createTutor(client, { clinicId: "clinica-1", tutor: tutorNuevo });
      throw new Error("se esperaba el fallo del servidor");
    } catch (error) {
      expect(error).toBe(falloDeSesion);
      expect(isAuthenticationRequired(error)).toBe(true);
    }
  });
});
