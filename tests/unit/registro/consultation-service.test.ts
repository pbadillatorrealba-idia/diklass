import { describe, expect, test } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  correctProvenance,
  listAnamnesisEntries,
  recordAnamnesisEntry,
} from "@/features/registro/anamnesis-service";
import {
  getConsultation,
  listConsultationsByPatient,
  listPatientTimeline,
  openConsultation,
  resumeConsultation,
} from "@/features/registro/consultation-service";
import { listDiagnoses, recordDiagnosis } from "@/features/registro/diagnosis-service";
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
    record_type: "anamnesis",
    status: "draft",
    supersedes_event_id: null,
    updated_at: null,
    updated_by: null,
    ...overrides,
  };
}

const consultaAbierta = {
  patientId: "paciente-1",
  status: "open",
} as const;

describe("openConsultation (FR-003 · US2-AC1)", () => {
  test("abre la consulta del paciente en curso", async () => {
    const { client, calls } = fakeClient({
      "clinical_records:insert": [
        {
          data: fila({ id: "c-1", record_type: "consultation", content: consultaAbierta }),
          error: null,
        },
      ],
    });

    const abierta = await openConsultation(client, {
      clinicId: "clinica-1",
      patientId: "paciente-1",
    });

    expect(calls.filter((call) => call.method === "insert")[0]?.args[0]).toEqual({
      clinic_id: "clinica-1",
      record_type: "consultation",
      content: consultaAbierta,
      status: "draft",
    });
    expect(abierta.record.id).toBe("c-1");
  });

  test("rechaza un paciente sin identificar sin tocar el servidor", async () => {
    const { client, calls } = fakeClient({});

    try {
      await openConsultation(client, { clinicId: "clinica-1", patientId: "   " });
      throw new Error("se esperaba el rechazo del paciente vacío");
    } catch (error) {
      expect(error).toBeInstanceOf(z.ZodError);
    }
    expect(calls).toEqual([]);
  });
});

describe("getConsultation y listConsultationsByPatient (FR-002 · US4-AC4)", () => {
  test("getConsultation devuelve registro y contenido", async () => {
    const { client } = fakeClient({
      "clinical_records:select": [
        {
          data: fila({ id: "c-1", record_type: "consultation", content: consultaAbierta }),
          error: null,
        },
      ],
    });

    const consulta = await getConsultation(client, "c-1");

    expect(consulta?.content).toEqual(consultaAbierta);
  });

  test("listConsultationsByPatient filtra por el paciente en el contenido", async () => {
    const { client, calls } = fakeClient({
      "clinical_records:select": [
        {
          data: [fila({ id: "c-1", record_type: "consultation", content: consultaAbierta })],
          error: null,
        },
      ],
    });

    const consultas = await listConsultationsByPatient(client, "paciente-1");

    expect(
      calls.some((call) => call.method === "eq" && call.args[0] === "content->>patientId"),
    ).toBe(true);
    expect(calls.some((call) => call.args[1] === "paciente-1")).toBe(true);
    expect(consultas).toHaveLength(1);
    expect(consultas[0]?.content.status).toBe("open");
  });
});

describe("resumeConsultation (FR-045 · US4-AC5)", () => {
  test("devuelve el contenido íntegro de una consulta interrumpida", async () => {
    const entrada = {
      consultationId: "c-1",
      field: "motivo_consulta",
      text: "Ladra de noche.",
      provenance: "reportada",
    };
    const borrador = {
      consultationId: "c-1",
      motivoConsulta: "Ladra de noche.",
      antecedentesRelevantes: "",
      hallazgosAnamnesis: "",
      hipotesis: [],
      diagnostico: "Ansiedad por separación",
      examenesSolicitados: [],
      intervencionesPropuestas: [],
      medicamentosAprobados: [],
      recomendacionesTutor: "",
      planSeguimiento: { pendientes: ["Control en 15 días"] },
      observaciones: "",
    };
    const { client } = fakeClient({
      "clinical_records:select": [
        {
          data: fila({ id: "c-1", record_type: "consultation", content: consultaAbierta }),
          error: null,
        },
        { data: [fila({ id: "a-1", record_type: "anamnesis", content: entrada })], error: null },
        {
          data: [
            {
              id: "d-1",
              record_type: "diagnosis",
              content: { consultationId: "c-1", text: "Ansiedad por separación" },
            },
          ],
          error: null,
        },
        {
          data: [
            fila({ id: "e-viejo", record_type: "epicrisis", status: "draft", content: borrador }),
            fila({
              id: "e-nuevo",
              record_type: "epicrisis",
              status: "draft",
              content: { ...borrador, observaciones: "Retomar el lunes" },
              created_at: "2026-09-22T11:00:00.000Z",
            }),
          ],
          error: null,
        },
      ],
    });

    const retomada = await resumeConsultation(client, "c-1");

    expect(retomada?.consultation.content).toEqual(consultaAbierta);
    expect(retomada?.anamnesis.map((entrada) => entrada.content.text)).toEqual(["Ladra de noche."]);
    expect(retomada?.diagnoses.map((diagnostico) => diagnostico.content.text)).toEqual([
      "Ansiedad por separación",
    ]);
    expect(retomada?.epicrisisDraft?.record.id).toBe("e-nuevo");
    expect(retomada?.epicrisisDraft?.content.observaciones).toBe("Retomar el lunes");
  });

  test("una consulta cerrada no es retomable", async () => {
    const { client } = fakeClient({
      "clinical_records:select": [
        {
          data: fila({
            id: "c-1",
            record_type: "consultation",
            content: { patientId: "paciente-1", status: "closed" },
          }),
          error: null,
        },
      ],
    });

    expect(await resumeConsultation(client, "c-1")).toBeNull();
  });

  test("una consulta inexistente no es retomable", async () => {
    const { client } = fakeClient({});

    expect(await resumeConsultation(client, "desconocida")).toBeNull();
  });
});

describe("listPatientTimeline (FR-002 · FR-013 · US4-AC4)", () => {
  test("arma el historial cronológico y el resumen de seguimiento", async () => {
    const epicrisisAprobada = {
      consultationId: "c-1",
      motivoConsulta: "Ladra de noche.",
      antecedentesRelevantes: "",
      hallazgosAnamnesis: "",
      hipotesis: [],
      diagnostico: "Ansiedad por separación",
      examenesSolicitados: ["Perfil tiroideo"],
      intervencionesPropuestas: ["Enriquecimiento ambiental"],
      medicamentosAprobados: [],
      recomendacionesTutor: "Evitar dejarlo solo más de 4 h.",
      planSeguimiento: { pendientes: ["Control en 15 días"] },
      observaciones: "",
    };
    const { client, calls } = fakeClient({
      "clinical_records:select": [
        {
          data: [
            fila({
              id: "c-1",
              record_type: "consultation",
              content: { patientId: "paciente-1", status: "closed" },
            }),
            fila({ id: "c-2", record_type: "consultation", content: consultaAbierta }),
          ],
          error: null,
        },
        {
          data: [
            fila({
              id: "e-1",
              record_type: "epicrisis",
              status: "approved",
              content: epicrisisAprobada,
            }),
          ],
          error: null,
        },
      ],
    });

    const { history, followUp } = await listPatientTimeline(client, "paciente-1");

    expect(history.map((entrada) => entrada.consultationId)).toEqual(["c-1", "c-2"]);
    expect(history[0]?.epicrisis?.diagnostico).toBe("Ansiedad por separación");
    expect(history[1]?.epicrisis).toBeNull();
    expect(followUp.previousDiagnoses).toEqual(["Ansiedad por separación"]);
    expect(followUp.interventions).toEqual(["Enriquecimiento ambiental"]);
    expect(followUp.recommendations).toEqual(["Evitar dejarlo solo más de 4 h."]);
    expect(followUp.exams).toEqual(["Perfil tiroideo"]);
    expect(followUp.pendingItems).toEqual(["Control en 15 días"]);
    expect(
      calls.some((call) => call.method === "in" && call.args[0] === "content->>consultationId"),
    ).toBe(true);
  });
});

describe("recordAnamnesisEntry (FR-004 · US2-AC2/AC3, FR-021)", () => {
  test("registra cada campo con su procedencia", async () => {
    const { client, calls } = fakeClient({
      "clinical_records:insert": [
        {
          data: fila({
            id: "a-1",
            record_type: "anamnesis",
            content: {
              consultationId: "c-1",
              field: "comportamiento_problematico",
              text: "Destroza objetos.",
              provenance: "inferida",
            },
          }),
          error: null,
        },
      ],
    });

    const registrada = await recordAnamnesisEntry(client, {
      clinicId: "clinica-1",
      consultationId: "c-1",
      field: "comportamiento_problematico",
      text: "Destroza objetos.",
      provenance: "inferida",
    });

    expect(calls.filter((call) => call.method === "insert")[0]?.args[0]).toEqual({
      clinic_id: "clinica-1",
      record_type: "anamnesis",
      content: {
        consultationId: "c-1",
        field: "comportamiento_problematico",
        text: "Destroza objetos.",
        provenance: "inferida",
      },
      status: "draft",
    });
    expect(registrada.record.id).toBe("a-1");
  });

  test("rechaza una procedencia fuera del vocabulario de FR-021", async () => {
    const { client, calls } = fakeClient({});

    try {
      await recordAnamnesisEntry(client, {
        clinicId: "clinica-1",
        consultationId: "c-1",
        field: "texto_libre",
        text: "Cualquier cosa.",
        provenance: "informada" as never,
      });
      throw new Error("se esperaba el rechazo de la procedencia desconocida");
    } catch (error) {
      expect(error).toBeInstanceOf(z.ZodError);
    }
    expect(calls).toEqual([]);
  });
});

describe("correctProvenance (FR-021 · US2-AC5)", () => {
  test("corrige la procedencia conservando la anterior en provenanceHistory", async () => {
    const previo = {
      consultationId: "c-1",
      field: "tratamientos_anteriores",
      text: "Fluoxetina en 2024.",
      provenance: "inferida",
    };
    const { client, calls } = fakeClient({
      "clinical_records:select": [
        { data: fila({ id: "a-1", record_type: "anamnesis", content: previo }), error: null },
      ],
      "clinical_records:update": [
        {
          data: fila({
            id: "a-1",
            record_type: "anamnesis",
            content: {
              ...previo,
              provenance: "reportada",
              provenanceHistory: [{ provenance: "inferida" }],
            },
          }),
          error: null,
        },
      ],
      "clinical_audit_events:select": [
        {
          data: {
            action: "anamnesis_corrected",
            actor_id: "vet-beto",
            occurred_at: "2026-09-22T11:00:00.000Z",
            supersedes_event_id: null,
          },
          error: null,
        },
      ],
    });

    const corregida = await correctProvenance(client, "a-1", "reportada");

    expect(calls.filter((call) => call.method === "update")[0]?.args[0]).toEqual({
      content: {
        ...previo,
        provenance: "reportada",
        provenanceHistory: [{ provenance: "inferida" }],
      },
    });
    expect(corregida.attribution.action).toBe("anamnesis_corrected");
    expect(corregida.attribution.actorId).toBe("vet-beto");
  });

  test("las correcciones sucesivas acumulan la historia recuperable", async () => {
    const previo = {
      consultationId: "c-1",
      field: "alimentacion",
      text: "Sin datos sobre la dieta.",
      provenance: "reportada",
      provenanceHistory: [{ provenance: "inferida" }],
    };
    const { client, calls } = fakeClient({
      "clinical_records:select": [
        { data: fila({ id: "a-1", record_type: "anamnesis", content: previo }), error: null },
      ],
      "clinical_records:update": [
        { data: fila({ id: "a-1", record_type: "anamnesis", content: previo }), error: null },
      ],
    });

    await correctProvenance(client, "a-1", "desconocida");

    expect(calls.filter((call) => call.method === "update")[0]?.args[0]).toEqual({
      content: {
        ...previo,
        provenance: "desconocida",
        provenanceHistory: [{ provenance: "inferida" }, { provenance: "reportada" }],
      },
    });
  });

  test("sin registro de anamnesis no hay nada que corregir", async () => {
    const { client, calls } = fakeClient({});

    try {
      await correctProvenance(client, "desconocida", "reportada");
      throw new Error("se esperaba el fallo por registro inexistente");
    } catch (error) {
      expect((error as Error).message).toMatch(/no se encontró el registro de anamnesis/i);
    }
    expect(calls.filter((call) => call.method === "update")).toEqual([]);
  });
});

describe("listAnamnesisEntries y recordDiagnosis (US2-AC6 · US3-AC1)", () => {
  test("cada antecedente conserva su autor y su campo distinguible", async () => {
    const { client } = fakeClient({
      "clinical_records:select": [
        {
          data: [
            fila({
              id: "a-1",
              record_type: "anamnesis",
              created_by: "vet-ana",
              content: {
                consultationId: "c-1",
                field: "motivo_consulta",
                text: "Ladra de noche.",
                provenance: "reportada",
              },
            }),
            fila({
              id: "a-2",
              record_type: "anamnesis",
              created_by: "vet-beto",
              content: {
                consultationId: "c-1",
                field: "comportamiento_problematico",
                text: "Destroza objetos.",
                provenance: "reportada",
              },
            }),
          ],
          error: null,
        },
      ],
    });

    const entradas = await listAnamnesisEntries(client, "c-1");

    expect(entradas.map((entrada) => entrada.record.created_by)).toEqual(["vet-ana", "vet-beto"]);
    expect(entradas.map((entrada) => entrada.content.field)).toEqual([
      "motivo_consulta",
      "comportamiento_problematico",
    ]);
  });

  test("recordDiagnosis registra el diagnóstico del veterinario", async () => {
    const { client, calls } = fakeClient({
      "clinical_records:insert": [
        {
          data: fila({
            id: "d-1",
            record_type: "diagnosis",
            content: { consultationId: "c-1", text: "Ansiedad por separación" },
          }),
          error: null,
        },
      ],
    });

    const diagnostico = await recordDiagnosis(client, {
      clinicId: "clinica-1",
      consultationId: "c-1",
      text: "Ansiedad por separación",
    });

    expect(calls.filter((call) => call.method === "insert")[0]?.args[0]).toEqual({
      clinic_id: "clinica-1",
      record_type: "diagnosis",
      content: { consultationId: "c-1", text: "Ansiedad por separación" },
      status: "draft",
    });
    expect(diagnostico.record.id).toBe("d-1");
  });

  test("listDiagnoses devuelve los diagnósticos de la consulta", async () => {
    const { client } = fakeClient({
      "clinical_records:select": [
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
    });

    const diagnosticos = await listDiagnoses(client, "c-1");

    expect(diagnosticos.map((registro) => registro.content.text)).toEqual([
      "Ansiedad por separación",
    ]);
  });
});
