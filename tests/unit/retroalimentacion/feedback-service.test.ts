import { describe, expect, test } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  correctFeedbackEntry,
  createFeedbackEntry,
  listFeedbackByConsultation,
  listFeedbackByPatient,
} from "@/features/retroalimentacion/feedback-service";
import type { FeedbackContent } from "@/features/retroalimentacion/schema";
import type { Database } from "@/lib/supabase/database.types";

type FakeCall = { table: string; method: string; args: unknown[] };
type FakeResult = { data: unknown; error: unknown };

/**
 * Cliente falso por cola de resultados por tabla: cada terminal (`single`, `maybeSingle` o el
 * `await` del builder) consume el siguiente resultado de su tabla, en orden de llamada.
 */
function makeClient(config: { results?: Record<string, FakeResult[]> }) {
  const calls: FakeCall[] = [];
  const queues: Record<string, FakeResult[]> = {};
  for (const [tabla, resultados] of Object.entries(config.results ?? {})) {
    queues[tabla] = [...resultados];
  }

  const from = (table: string) => {
    const consume = (): FakeResult => {
      const queue = queues[table];
      return queue?.shift() ?? { data: null, error: null };
    };
    const registrar =
      (method: string) =>
      (...args: unknown[]) => {
        calls.push({ table, method, args });
        return query;
      };
    const query = {
      insert: registrar("insert"),
      update: registrar("update"),
      select: registrar("select"),
      eq: registrar("eq"),
      in: registrar("in"),
      order: registrar("order"),
      limit: registrar("limit"),
      single: async () => consume(),
      maybeSingle: async () => consume(),
      // biome-ignore lint/suspicious/noThenProperty: emula el builder thenable de supabase-js en el cliente falso.
      then: (resolve: (value: FakeResult) => unknown) => resolve(consume()),
    };
    return query;
  };

  return { client: { from } as unknown as SupabaseClient<Database>, calls };
}

function registro(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    approved_at: null,
    approved_by: null,
    clinic_id: "clinica-1",
    content: {},
    created_at: "2026-09-22T09:00:00.000Z",
    created_by: "vet-ana",
    id: "record-1",
    record_type: "clinical_feedback",
    status: "draft",
    supersedes_event_id: null,
    updated_at: null,
    updated_by: null,
    ...overrides,
  };
}

const contenido: FeedbackContent = {
  consultationId: "consulta-1",
  treatmentApplied: "Fluoxetina 20 mg cada 24 h",
  adherence: "parcial",
  evolution: "mejoriaParcial",
  evolutionNote: "Mejora parcial de las ausencias.",
  adverseEvents: [{ severity: "leve", description: "Somnolencia leve" }],
  revisedDiagnosis: null,
  treatmentModification: "Dosis reducida a 10 mg",
};

const consultaCerrada = registro({
  id: "consulta-1",
  record_type: "consultation",
  content: { patientId: "paciente-1", status: "closed" },
});

describe("createFeedbackEntry — registro estructurado y atribuido (FR-018 · US10-AC1 · FR-070 · SC-049)", () => {
  test("registra sobre una consulta cerrada y devuelve la atribución real de la traza", async () => {
    const { client, calls } = makeClient({
      results: {
        clinical_records: [
          { data: consultaCerrada, error: null },
          { data: registro({ id: "fb-1", content: contenido }), error: null },
        ],
        clinical_audit_events: [
          {
            data: {
              action: "clinical_feedback_recorded",
              actor_id: "vet-bruno",
              occurred_at: "2026-09-22T10:00:00.000Z",
              supersedes_event_id: null,
            },
            error: null,
          },
        ],
      },
    });

    const resultado = await createFeedbackEntry(client, {
      clinicId: "clinica-1",
      content: contenido,
    });

    expect(resultado.record.id).toBe("fb-1");
    expect(resultado.attribution).toEqual({
      actorId: "vet-bruno",
      occurredAt: "2026-09-22T10:00:00.000Z",
      action: "clinical_feedback_recorded",
      supersedesEventId: null,
    });

    const insercion = calls.find((llamada) => llamada.method === "insert");
    expect(insercion?.args[0]).toEqual({
      clinic_id: "clinica-1",
      record_type: "clinical_feedback",
      content: contenido,
      status: "draft",
    });
  });

  test("escribe el contenido normalizado, sin claves ajenas al modelo (SC-023 · D5)", async () => {
    const { client, calls } = makeClient({
      results: {
        clinical_records: [
          { data: consultaCerrada, error: null },
          { data: registro({ id: "fb-1" }), error: null },
        ],
        clinical_audit_events: [{ data: null, error: null }],
      },
    });

    await createFeedbackEntry(client, {
      clinicId: "clinica-1",
      content: {
        ...contenido,
        tratamiento: "intruso",
        evolutionNote: "   ",
      } as unknown as FeedbackContent,
    });

    const insercion = calls.find((llamada) => llamada.method === "insert");
    expect(insercion?.args[0]).toMatchObject({
      content: {
        ...contenido,
        evolutionNote: null,
      },
    });
    // El payload del builder es un objeto de dominio acotado (clinical-mutations lo inserta tal cual).
    const payload = insercion?.args[0] as { content: Record<string, unknown> };
    expect(Object.keys(payload.content).sort()).toEqual([
      "adherence",
      "adverseEvents",
      "consultationId",
      "evolution",
      "evolutionNote",
      "revisedDiagnosis",
      "treatmentApplied",
      "treatmentModification",
    ]);
  });

  test("rechaza registrar sobre una consulta aún abierta, sin escribir nada (D3 · US10-AC1)", async () => {
    const { client, calls } = makeClient({
      results: {
        clinical_records: [
          {
            data: registro({
              id: "consulta-1",
              record_type: "consultation",
              content: { patientId: "paciente-1", status: "open" },
            }),
            error: null,
          },
        ],
      },
    });

    await expect(
      createFeedbackEntry(client, { clinicId: "clinica-1", content: contenido }),
    ).rejects.toThrow("solo sobre consultas cerradas");
    expect(calls.some((llamada) => llamada.method === "insert")).toBe(false);
  });

  test("rechaza una consulta referida inexistente, sin escribir nada (D5)", async () => {
    const { client, calls } = makeClient({
      results: { clinical_records: [{ data: null, error: null }] },
    });

    await expect(
      createFeedbackEntry(client, { clinicId: "clinica-1", content: contenido }),
    ).rejects.toThrow("No se encontró la consulta referida.");
    expect(calls.some((llamada) => llamada.method === "insert")).toBe(false);
  });

  test("rechaza categorías fuera de vocabulario antes de tocar el servidor (FR-040 · FR-043 · SC-023)", async () => {
    const { client, calls } = makeClient({
      results: { clinical_records: [{ data: consultaCerrada, error: null }] },
    });

    await expect(
      createFeedbackEntry(client, {
        clinicId: "clinica-1",
        content: { ...contenido, adherence: "quizas" } as unknown as FeedbackContent,
      }),
    ).rejects.toThrow();
    expect(calls.some((llamada) => llamada.method === "insert")).toBe(false);
  });
});

describe("correctFeedbackEntry — corrección como registro nuevo (FR-024 · SC-022 · US10-AC5 · D7)", () => {
  test("crea una correctiva que apunta al evento de registro del original", async () => {
    const { client, calls } = makeClient({
      results: {
        clinical_records: [
          {
            data: registro({ id: "fb-1", content: contenido, supersedes_event_id: null }),
            error: null,
          },
          {
            data: registro({
              id: "fb-corr",
              content: contenido,
              status: "corrective",
              supersedes_event_id: "evento-1",
            }),
            error: null,
          },
        ],
        clinical_audit_events: [
          { data: [{ id: "evento-1", action: "clinical_feedback_recorded" }], error: null },
        ],
      },
    });

    const corregido: FeedbackContent = { ...contenido, adherence: "completa" };
    const resultado = await correctFeedbackEntry(client, "fb-1", corregido);

    expect(resultado.record.id).toBe("fb-corr");
    const insercion = calls.find((llamada) => llamada.method === "insert");
    expect(insercion?.args[0]).toEqual({
      clinic_id: "clinica-1",
      record_type: "clinical_feedback",
      content: corregido,
      status: "corrective",
      supersedes_event_id: "evento-1",
    });
  });

  test("las correctivas sucesivas resuelven al mismo evento original sin reconsultar la traza (D7)", async () => {
    const { client, calls } = makeClient({
      results: {
        clinical_records: [
          {
            data: registro({
              id: "fb-corr-1",
              content: contenido,
              status: "corrective",
              supersedes_event_id: "evento-1",
            }),
            error: null,
          },
          {
            data: registro({
              id: "fb-corr-2",
              content: contenido,
              status: "corrective",
              supersedes_event_id: "evento-1",
            }),
            error: null,
          },
        ],
      },
    });

    await correctFeedbackEntry(client, "fb-corr-1", { ...contenido, evolution: "sinCambios" });

    // La traza viene vacía de a propósito: si la corrección re-resolviera la cadena en
    // lugar de reusar el supersedes_event_id de la fila, no habría evento que apuntar.
    const insercion = calls.find((llamada) => llamada.method === "insert");
    expect(insercion?.args[0]).toMatchObject({ supersedes_event_id: "evento-1" });
  });

  test("una corrección no puede reasociar la entrada a otra consulta (D7)", async () => {
    const { client, calls } = makeClient({
      results: {
        clinical_records: [{ data: registro({ id: "fb-1", content: contenido }), error: null }],
      },
    });

    await expect(
      correctFeedbackEntry(client, "fb-1", { ...contenido, consultationId: "consulta-2" }),
    ).rejects.toThrow("La corrección pertenece a otra consulta.");
    expect(calls.some((llamada) => llamada.method === "insert")).toBe(false);
  });

  test("no corrige una fila que no sea una entrada de retroalimentación (FR-024 · US10-AC5)", async () => {
    const { client, calls } = makeClient({
      results: {
        clinical_records: [
          {
            data: registro({
              id: "epicrisis-1",
              record_type: "epicrisis",
              content: { consultationId: "consulta-1" },
              status: "approved",
            }),
            error: null,
          },
        ],
      },
    });

    await expect(correctFeedbackEntry(client, "epicrisis-1", contenido)).rejects.toThrow(
      "No se encontró la entrada de retroalimentación.",
    );
    expect(calls.some((llamada) => llamada.method === "insert")).toBe(false);
  });

  test("rechaza corregir cuando la entrada original no existe", async () => {
    const { client } = makeClient({ results: { clinical_records: [{ data: null, error: null }] } });

    await expect(correctFeedbackEntry(client, "fb-inexistente", contenido)).rejects.toThrow(
      "No se encontró la entrada de retroalimentación.",
    );
  });
});

describe("listFeedbackByConsultation — cadena de correcciones en la lectura (FR-056 · FR-024 · US10-AC5)", () => {
  test("devuelve las entradas con correctsRecordId resuelto al registro original (D7)", async () => {
    const { client } = makeClient({
      results: {
        clinical_records: [
          {
            data: [
              registro({ id: "fb-1", content: contenido, created_at: "2026-09-01T09:00:00.000Z" }),
              registro({
                id: "fb-corr",
                content: { ...contenido, adherence: "completa" },
                created_at: "2026-09-15T09:00:00.000Z",
                status: "corrective",
                supersedes_event_id: "evento-1",
              }),
            ],
            error: null,
          },
        ],
        clinical_audit_events: [{ data: [{ id: "evento-1", entity_id: "fb-1" }], error: null }],
      },
    });

    const entradas = await listFeedbackByConsultation(client, "consulta-1");

    expect(entradas.map((entrada) => entrada.record.id)).toEqual(["fb-1", "fb-corr"]);
    expect(entradas[0]?.correctsRecordId).toBeNull();
    expect(entradas[1]?.correctsRecordId).toBe("fb-1");
    expect(entradas[1]?.content.adherence).toBe("completa");
  });

  test("las filas con contenido ilegible se omiten sin romper la lectura", async () => {
    const { client } = makeClient({
      results: {
        clinical_records: [
          {
            data: [
              registro({ id: "fb-rota", content: { consultationId: "consulta-1" } }),
              registro({ id: "fb-1", content: contenido }),
            ],
            error: null,
          },
        ],
      },
    });

    const entradas = await listFeedbackByConsultation(client, "consulta-1");

    expect(entradas.map((entrada) => entrada.record.id)).toEqual(["fb-1"]);
  });

  test("sin correctivas en la consulta no hace falta resolver la cadena", async () => {
    const { client, calls } = makeClient({
      results: {
        clinical_records: [{ data: [registro({ id: "fb-1", content: contenido })], error: null }],
      },
    });

    const entradas = await listFeedbackByConsultation(client, "consulta-1");

    expect(entradas.map((entrada) => entrada.record.id)).toEqual(["fb-1"]);
    expect(
      calls.filter(
        (llamada) => llamada.method === "in" && llamada.table === "clinical_audit_events",
      ),
    ).toHaveLength(0);
  });
});

describe("listFeedbackByPatient — retroalimentación de varias consultas (FR-043 · SC-023 · US10-AC9 · FR-042)", () => {
  test("reúne las entradas de todas las consultas del paciente, con sus fechas por separado", async () => {
    const { client } = makeClient({
      results: {
        clinical_records: [
          {
            data: [
              registro({
                id: "consulta-1",
                record_type: "consultation",
                content: { patientId: "paciente-1", status: "closed" },
                created_at: "2026-09-01T10:00:00.000Z",
              }),
              registro({
                id: "consulta-2",
                record_type: "consultation",
                content: { patientId: "paciente-1", status: "closed" },
                created_at: "2026-10-01T10:00:00.000Z",
              }),
            ],
            error: null,
          },
          {
            data: [
              registro({
                id: "fb-1",
                content: { ...contenido, consultationId: "consulta-1" },
                created_at: "2026-09-22T09:00:00.000Z",
              }),
              registro({
                id: "fb-2",
                content: { ...contenido, consultationId: "consulta-2" },
                created_at: "2026-10-22T09:00:00.000Z",
              }),
            ],
            error: null,
          },
        ],
      },
    });

    const entradas = await listFeedbackByPatient(client, "paciente-1");

    expect(entradas.map((entrada) => entrada.record.id)).toEqual(["fb-1", "fb-2"]);
    expect(entradas.map((entrada) => entrada.content.consultationId)).toEqual([
      "consulta-1",
      "consulta-2",
    ]);
  });
});
