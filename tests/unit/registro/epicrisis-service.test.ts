import { describe, expect, test } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  approveEpicrisis,
  correctEpicrisis,
  generateEpicrisisDraft,
  listEpicrisisByConsultation,
  updateEpicrisisDraft,
} from "@/features/registro/epicrisis-service";
import type { EpicrisisContent, PatientContent } from "@/features/registro/schema";
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
  in: (...args: unknown[]) => FakeQuery;
  order: (...args: unknown[]) => FakeQuery;
  limit: (...args: unknown[]) => FakeQuery;
  single: () => Promise<FakeResult>;
  maybeSingle: () => Promise<FakeResult>;
};

/** Cliente falso con resultados por tabla y operación, consumidos en orden de llamada. */
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
    record_type: "epicrisis",
    status: "draft",
    supersedes_event_id: null,
    updated_at: null,
    updated_by: null,
    ...overrides,
  };
}

const fichaPaciente: PatientContent = {
  name: "Luna",
  species: "perro",
  breed: "Mestizo",
  birthDate: "2021-05-01",
  ageMonths: 24,
  weightKg: 12.4,
  sex: "hembra",
  reproductiveStatus: "esterilizada",
  antecedentes: {
    medicalHistory: [{ text: "Displasia de cadera", negative: false }],
    preexistingDiseases: [],
    currentMedications: [],
    knownAllergies: [{ text: "Sin alergias conocidas", negative: true }],
    behavioralHistory: [],
  },
  tutorId: "tutor-1",
};

const borradorEsperado: EpicrisisContent = {
  consultationId: "c-1",
  motivoConsulta: "Ladra de noche.",
  antecedentesRelevantes:
    "Antecedentes médicos: Displasia de cadera\nAlergias conocidas: Sin alergias conocidas (hallazgo negativo)",
  hallazgosAnamnesis: "Motivo de consulta: Ladra de noche. [procedencia: reportada]",
  hipotesis: [],
  diagnostico: "Ansiedad por separación",
  examenesSolicitados: [],
  intervencionesPropuestas: [],
  medicamentosAprobados: [],
  recomendacionesTutor: "",
  planSeguimiento: { pendientes: [] },
  observaciones: "",
};

/** Cola de lecturas de generateEpicrisisDraft: consulta, ficha, anamnesis y diagnósticos. */
function colasDeSesion(extra: Partial<Record<string, FakeResult[]>> = {}) {
  return {
    "clinical_records:select": [
      {
        data: fila({
          id: "c-1",
          record_type: "consultation",
          content: { patientId: "paciente-1", status: "open" },
        }),
        error: null,
      },
      {
        data: fila({ id: "paciente-1", record_type: "patient", content: fichaPaciente }),
        error: null,
      },
      {
        data: [
          fila({
            id: "a-1",
            record_type: "anamnesis",
            content: {
              consultationId: "c-1",
              field: "motivo_consulta",
              text: "Ladra de noche.",
              provenance: "reportada",
            },
          }),
        ],
        error: null,
      },
      {
        data: [
          fila({
            id: "d-1",
            record_type: "diagnosis",
            content: { consultationId: "c-1", text: "Ansiedad por separación" },
          }),
        ],
        error: null,
      },
    ],
    ...extra,
  } satisfies Partial<Record<string, FakeResult[]>>;
}

describe("generateEpicrisisDraft (FR-011 · US3-AC1, D3)", () => {
  test("compone el borrador desde la sesión y lo guarda como draft", async () => {
    const { client, calls } = fakeClient(
      colasDeSesion({
        "clinical_records:insert": [
          {
            data: fila({
              id: "e-1",
              record_type: "epicrisis",
              status: "draft",
              content: borradorEsperado,
            }),
            error: null,
          },
        ],
      }),
    );

    const borrador = await generateEpicrisisDraft(client, {
      clinicId: "clinica-1",
      consultationId: "c-1",
    });

    expect(calls.filter((call) => call.method === "insert")[0]?.args[0]).toEqual({
      clinic_id: "clinica-1",
      record_type: "epicrisis",
      content: borradorEsperado,
      status: "draft",
    });
    expect(borrador.record.status).toBe("draft");
    expect(borrador.record.id).toBe("e-1");
  });

  test("sin consulta no hay sesión que ensamblar", async () => {
    const { client, calls } = fakeClient({
      "clinical_records:select": [{ data: null, error: null }],
    });

    try {
      await generateEpicrisisDraft(client, { clinicId: "clinica-1", consultationId: "c-1" });
      throw new Error("se esperaba el fallo por consulta inexistente");
    } catch (error) {
      expect((error as Error).message).toMatch(/no se encontró la consulta/i);
    }
    expect(calls.filter((call) => call.method === "insert")).toEqual([]);
  });
});

describe("updateEpicrisisDraft (borrador editable · FR-011)", () => {
  test("actualiza el contenido del borrador", async () => {
    const editado: EpicrisisContent = {
      ...borradorEsperado,
      recomendacionesTutor: "Evitar dejarlo solo más de 4 h.",
      planSeguimiento: { pendientes: ["Control en 15 días"] },
    };
    const { client, calls } = fakeClient({
      "clinical_records:update": [
        {
          data: fila({ id: "e-1", record_type: "epicrisis", status: "draft", content: editado }),
          error: null,
        },
      ],
    });

    const actualizado = await updateEpicrisisDraft(client, "e-1", editado);

    expect(calls.filter((call) => call.method === "update")[0]?.args[0]).toEqual({
      content: editado,
    });
    expect(actualizado.record.id).toBe("e-1");
  });

  test("rechaza un contenido fuera del esquema de FR-011 sin tocar el servidor", async () => {
    const { client, calls } = fakeClient({});

    try {
      await updateEpicrisisDraft(client, "e-1", {
        ...borradorEsperado,
        planSeguimiento: {},
      } as never);
      throw new Error("se esperaba el rechazo del contenido inválido");
    } catch (error) {
      expect(error).toBeInstanceOf(z.ZodError);
    }
    expect(calls).toEqual([]);
  });
});

describe("approveEpicrisis (FR-012 · US3-AC2, D4)", () => {
  test("aprueba por la RPC del servidor y devuelve la atribución real", async () => {
    const { client, calls } = fakeClient({
      "rpc:approve_clinical_record": [
        {
          data: {
            record: { id: "e-1", status: "approved" },
            attribution: {
              actorId: "vet-ana",
              occurredAt: "2026-09-22T12:00:00.000Z",
              action: "epicrisis_approved",
            },
          },
          error: null,
        },
      ],
    });

    const aprobada = await approveEpicrisis(client, "e-1");

    expect(calls).toEqual([
      { table: "rpc", method: "approve_clinical_record", args: [{ p_record_id: "e-1" }] },
    ]);
    expect(aprobada.record).toEqual({ id: "e-1", status: "approved" });
    expect(aprobada.attribution.action).toBe("epicrisis_approved");
  });
});

describe("correctEpicrisis (FR-024 · US3-AC4, D8)", () => {
  const corregido: EpicrisisContent = {
    ...borradorEsperado,
    observaciones: "Corregido: sin exámenes pendientes.",
    planSeguimiento: { pendientes: ["Control en 30 días"] },
  };

  test("crea una corrección sobre el evento epicrisis_approved original", async () => {
    const aprobada = fila({
      id: "e-1",
      record_type: "epicrisis",
      status: "approved",
      content: borradorEsperado,
    });
    const { client, calls } = fakeClient({
      "clinical_records:select": [{ data: aprobada, error: null }],
      "clinical_audit_events:select": [
        {
          data: [
            {
              id: "evento-aprob",
              action: "epicrisis_approved",
              supersedes_event_id: null,
            },
          ],
          error: null,
        },
        {
          data: {
            action: "corrective_record_created",
            actor_id: "vet-beto",
            occurred_at: "2026-09-22T13:00:00.000Z",
            supersedes_event_id: "evento-aprob",
          },
          error: null,
        },
      ],
      "clinical_records:insert": [
        {
          data: fila({
            id: "e-c1",
            record_type: "epicrisis",
            status: "corrective",
            supersedes_event_id: "evento-aprob",
            content: corregido,
          }),
          error: null,
        },
      ],
    });

    const correctiva = await correctEpicrisis(client, "e-1", corregido);

    expect(calls.filter((call) => call.method === "insert")[0]?.args[0]).toEqual({
      clinic_id: "clinica-1",
      record_type: "epicrisis",
      content: corregido,
      status: "corrective",
      supersedes_event_id: "evento-aprob",
    });
    expect(correctiva.attribution.supersedesEventId).toBe("evento-aprob");
  });

  test("una corrección sucesiva apunta al MISMO evento original", async () => {
    const primeraCorreccion = fila({
      id: "e-c1",
      record_type: "epicrisis",
      status: "corrective",
      supersedes_event_id: "evento-aprob",
      content: corregido,
    });
    const { client, calls } = fakeClient({
      "clinical_records:select": [{ data: primeraCorreccion, error: null }],
      "clinical_records:insert": [
        {
          data: fila({
            id: "e-c2",
            record_type: "epicrisis",
            status: "corrective",
            supersedes_event_id: "evento-aprob",
            content: { ...corregido, observaciones: "Segunda corrección." },
          }),
          error: null,
        },
      ],
    });

    await correctEpicrisis(client, "e-c1", { ...corregido, observaciones: "Segunda corrección." });

    expect(calls.filter((call) => call.method === "insert")[0]?.args[0]).toMatchObject({
      status: "corrective",
      supersedes_event_id: "evento-aprob",
    });
  });

  test("sin evento de aprobación no hay versión que corregir", async () => {
    const borrador = fila({
      id: "e-1",
      record_type: "epicrisis",
      status: "draft",
      content: borradorEsperado,
    });
    const { client, calls } = fakeClient({
      "clinical_records:select": [{ data: borrador, error: null }],
    });

    try {
      await correctEpicrisis(client, "e-1", corregido);
      throw new Error("se esperaba el fallo por epicrisis sin aprobar");
    } catch (error) {
      expect((error as Error).message).toMatch(/aprobada/i);
    }
    expect(calls.filter((call) => call.method === "insert")).toEqual([]);
  });

  test("rechaza una corrección que apunta a otra consulta", async () => {
    const aprobada = fila({
      id: "e-1",
      record_type: "epicrisis",
      status: "approved",
      content: borradorEsperado,
    });
    const { client, calls } = fakeClient({
      "clinical_records:select": [{ data: aprobada, error: null }],
    });

    try {
      await correctEpicrisis(client, "e-1", { ...corregido, consultationId: "c-2" });
      throw new Error("se esperaba el rechazo de la consulta cruzada");
    } catch (error) {
      expect((error as Error).message).toMatch(/otra consulta/i);
    }
    expect(calls.filter((call) => call.method === "insert")).toEqual([]);
  });

  test("sin epicrisis no hay nada que corregir", async () => {
    const { client } = fakeClient({});

    try {
      await correctEpicrisis(client, "desconocida", corregido);
      throw new Error("se esperaba el fallo por epicrisis inexistente");
    } catch (error) {
      expect((error as Error).message).toMatch(/no se encontró la epicrisis/i);
    }
  });
});

describe("listEpicrisisByConsultation (FR-010 · FR-024)", () => {
  test("lista todas las versiones de la consulta en orden cronológico", async () => {
    const { client, calls } = fakeClient({
      "clinical_records:select": [
        {
          data: [
            fila({
              id: "e-1",
              record_type: "epicrisis",
              status: "approved",
              content: borradorEsperado,
            }),
            fila({
              id: "e-c1",
              record_type: "epicrisis",
              status: "corrective",
              supersedes_event_id: "evento-aprob",
              content: { ...borradorEsperado, observaciones: "Corregido." },
            }),
          ],
          error: null,
        },
      ],
    });

    const versiones = await listEpicrisisByConsultation(client, "c-1");

    expect(versiones.map((version) => version.record.id)).toEqual(["e-1", "e-c1"]);
    expect(
      calls.some((call) => call.method === "eq" && call.args[0] === "content->>consultationId"),
    ).toBe(true);
  });
});
