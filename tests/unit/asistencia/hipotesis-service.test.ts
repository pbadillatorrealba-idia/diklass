import { describe, expect, test } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  addVetHypothesis,
  decideHypothesis,
  generateDifferentialSupport,
  listHypotheses,
} from "@/features/asistencia/hipotesis-service";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Servicio de soporte diferencial (D5/D6/D7/D9 de design.md · tasks.md 3.2).
 * Trazabilidad: FR-009 · FR-022 · FR-023 · FR-020 · FR-029 · FR-010 · FR-063 ·
 * US8-AC1/AC2/AC5/AC7/AC8/AC9.
 */

type FakeCall = { table: string; method: string; args: unknown[] };
type FakeResult = { data: unknown; error: unknown };
type FakeQueue = FakeResult | FakeResult[];

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

function fakeClient(queues: Partial<Record<string, FakeQueue>> = {}) {
  const calls: FakeCall[] = [];
  const restantes = new Map(
    Object.entries(queues).map(([clave, cola]) => [
      clave,
      Array.isArray(cola) ? [...cola] : [cola],
    ]),
  );
  const take = (key: string): FakeResult =>
    restantes.get(key)?.shift() ?? { data: null, error: null };

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

type ClinicalRecordRow = Database["public"]["Tables"]["clinical_records"]["Row"];

function fila(overrides: Partial<ClinicalRecordRow> = {}): ClinicalRecordRow {
  return {
    approved_at: null,
    approved_by: null,
    clinic_id: "clinica-1",
    content: {},
    created_at: "2026-09-22T09:00:00.000Z",
    created_by: "vet-ana",
    id: "record-1",
    record_type: "hypothesis",
    status: "draft",
    supersedes_event_id: null,
    updated_at: null,
    updated_by: null,
    ...overrides,
  };
}

const consulta = fila({
  id: "consulta-1",
  record_type: "consultation",
  content: { patientId: "paciente-1", status: "open" },
});

const paciente = fila({
  id: "paciente-1",
  record_type: "patient",
  content: {
    name: "Tobi",
    species: "perro",
    breed: "Mestizo",
    birthDate: "2021-05-01",
    ageMonths: 36,
    weightKg: 12.4,
    sex: "macho",
    reproductiveStatus: "castrado",
    antecedentes: {
      medicalHistory: [],
      preexistingDiseases: [],
      currentMedications: [],
      knownAllergies: [{ text: "Sin alergias conocidas", negative: true }],
      behavioralHistory: [],
    },
    tutorId: "tutor-1",
  },
});

const anamnesisSuficiente = [
  fila({
    id: "anamnesis-1",
    record_type: "anamnesis",
    content: {
      consultationId: "consulta-1",
      field: "comportamiento_problematico",
      text: "Destroza muebles",
      provenance: "reportada",
    },
  }),
  fila({
    id: "anamnesis-2",
    record_type: "anamnesis",
    content: {
      consultationId: "consulta-1",
      field: "contexto",
      text: "Ocurre cuando el animal queda solo",
      provenance: "reportada",
    },
  }),
  fila({
    id: "anamnesis-3",
    record_type: "anamnesis",
    content: {
      consultationId: "consulta-1",
      field: "frecuencia",
      text: "Diaria",
      provenance: "reportada",
    },
  }),
];

const fragmentoRecuperado = {
  documento_id: "doc-1",
  fragmento_ordinal: 1,
  texto: "La conducta en ausencia del tutor es el criterio clave del protocolo de separación.",
  seccion: "Síntesis",
  bibliografia: {
    titulo: "Protocolo de ansiedad por separación (ficticio)",
    autores: ["Equipo clínico sintético"],
    anio: 2026,
    revista: null,
    editorial: null,
    edicion: null,
    doi: null,
    url: null,
  },
  licencia: { tipo: "CC BY 4.0 (ficticia)", nota: null },
  estado: "available",
  rank_cd: 0.8,
  lemas_cubiertos: ["ansiedad", "separacion"],
  lemas_pregunta: ["ansiedad", "separacion"],
};

function colasLecturas(anamnesis: ClinicalRecordRow[]) {
  return {
    "clinical_records:select": [
      { data: consulta, error: null },
      { data: anamnesis, error: null },
      { data: paciente, error: null },
      { data: [], error: null },
    ] as FakeResult[],
    "rpc:search_knowledge_fragments": { data: [fragmentoRecuperado], error: null } as FakeResult,
    "knowledge_queries:insert": {
      data: fila({ id: "query-1", record_type: "consultation" }),
      error: null,
    } as FakeResult,
  };
}

describe("hipotesis-service: soporte diferencial (US8)", () => {
  test("FR-022 · US8-AC5: con información insuficiente no se propone ninguna hipótesis", async () => {
    const { client, calls } = fakeClient({
      "clinical_records:select": [
        { data: consulta, error: null },
        {
          data: [anamnesisSuficiente[0]],
          error: null,
        },
        { data: paciente, error: null },
        { data: [], error: null },
      ],
    });

    const resultado = await generateDifferentialSupport(client, {
      clinicId: "clinica-1",
      consultationId: "consulta-1",
    });
    expect(resultado.suficiencia.estado).toBe("insuficiente");
    expect(resultado.suficiencia.faltantes.length).toBeGreaterThan(0);
    expect(resultado.hipotesis).toHaveLength(0);
    expect(calls.some((llamada) => llamada.method === "search_knowledge_fragments")).toBe(false);
    expect(calls.some((llamada) => llamada.method === "insert")).toBe(false);
  });

  test("FR-009 · SC-019 · FR-020 · US8-AC1: la generación presenta la hipótesis y persiste su reconstrucción", async () => {
    const { client, calls } = fakeClient({
      ...colasLecturas(anamnesisSuficiente),
      "clinical_records:insert": {
        data: fila({ id: "hipotesis-1" }),
        error: null,
      } as FakeResult,
      "clinical_audit_events:select": {
        data: {
          action: "hypothesis_added",
          actor_id: "vet-ana",
          occurred_at: "2026-09-22T09:05:00.000Z",
          supersedes_event_id: null,
        },
        error: null,
      } as FakeResult,
    });

    const { suficiencia, hipotesis } = await generateDifferentialSupport(client, {
      clinicId: "clinica-1",
      consultationId: "consulta-1",
    });
    expect(suficiencia.estado).toBe("suficiente");
    expect(hipotesis.length).toBeGreaterThan(0);
    const presentada = hipotesis[0];
    expect(presentada).toBeDefined();
    expect(presentada?.analisis.aFavor.items.length).toBeGreaterThan(0);
    expect(presentada?.descargo).toContain("no constituye un diagnóstico");
    expect(presentada?.insumos.terminosMatch.length).toBeGreaterThan(0);

    const insercion = calls.find(
      (llamada) => llamada.table === "clinical_records" && llamada.method === "insert",
    );
    const payload = insercion?.args[0] as {
      record_type: string;
      content: {
        decision: string;
        origen: string;
        reglaId: string;
        insumos: { terminosMatch: string[] };
      };
    };
    expect(payload.record_type).toBe("hypothesis");
    expect(payload.content.decision).toBe("added");
    expect(payload.content.origen).toBe("sistema");
    expect(payload.content.reglaId).toBe("separationAnxiety");
    expect(payload.content.insumos.terminosMatch).toContain("solo");
  });

  test("D7: regenerar no duplica: la hipótesis ya presentada por su regla se relee, no se reinserta", async () => {
    const existente = fila({
      id: "hipotesis-1",
      record_type: "hypothesis",
      content: {
        consultationId: "consulta-1",
        texto: "Ansiedad por separación",
        decision: "accepted",
        origen: "sistema",
        reglaId: "separationAnxiety",
        insumos: {
          anamnesis: [
            {
              recordId: "anamnesis-2",
              field: "contexto",
              text: "Ocurre cuando el animal queda solo",
              provenance: "reportada",
              papel: "aFavor",
            },
          ],
          ficha: [],
          faltante: ["tratamientos_anteriores"],
          terminosMatch: ["solo"],
        },
        respaldo: {
          knowledgeQueryId: "query-1",
          citas: [],
          avisos: ["sin_respaldo_documental"],
          cobertura: null,
        },
      },
    });
    // La lectura de hipótesis existentes es la cuarta consulta de clinical_records; la regla
    // separationAnxiety ya está presentada, así que ninguna otra debe dispararse ni insertarse.
    const { client, calls } = fakeClient({
      "clinical_records:select": [
        { data: consulta, error: null },
        { data: anamnesisSuficiente, error: null },
        { data: paciente, error: null },
        { data: [existente], error: null },
      ],
    });

    const { hipotesis } = await generateDifferentialSupport(client, {
      clinicId: "clinica-1",
      consultationId: "consulta-1",
    });
    expect(hipotesis.map((hipotesisItem) => hipotesisItem.decision)).toContain("accepted");
    expect(calls.some((llamada) => llamada.method === "insert")).toBe(false);
  });

  test("FR-029 · FR-063 · US8-AC2: decidir la hipótesis registra la transición con su atribución", async () => {
    const existente = fila({
      id: "hipotesis-1",
      content: {
        consultationId: "consulta-1",
        texto: "Ansiedad por separación",
        decision: "added",
        origen: "sistema",
        reglaId: "separationAnxiety",
        insumos: { anamnesis: [], ficha: [], faltante: [], terminosMatch: [] },
        respaldo: {
          knowledgeQueryId: null,
          citas: [],
          avisos: ["sin_respaldo_documental"],
          cobertura: null,
        },
      },
    });
    const { client, calls } = fakeClient({
      "clinical_records:select": [{ data: existente, error: null }],
      "clinical_records:update": { data: fila({ id: "hipotesis-1" }), error: null },
      "clinical_audit_events:select": {
        data: {
          action: "hypothesis_accepted",
          actor_id: "vet-ana",
          occurred_at: "2026-09-22T09:07:00.000Z",
          supersedes_event_id: null,
        },
        error: null,
      },
    });

    const resultado = await decideHypothesis(client, {
      hypothesisId: "hipotesis-1",
      decision: "accepted",
    });
    expect(resultado.attribution.action).toBe("hypothesis_accepted");
    const actualizacion = calls.find(
      (llamada) => llamada.table === "clinical_records" && llamada.method === "update",
    );
    const payload = actualizacion?.args[0] as { content: { decision: string; texto: string } };
    expect(payload.content.decision).toBe("accepted");
    expect(payload.content.texto).toBe("Ansiedad por separación");
  });

  test("FR-029 · US8-AC9 · SC-030: la hipótesis propia del veterinario se registra distinguiendo su origen y declarando su respaldo", async () => {
    const { client, calls } = fakeClient({
      "clinical_records:insert": {
        data: fila({ id: "hipotesis-2" }),
        error: null,
      },
      "clinical_audit_events:select": {
        data: {
          action: "hypothesis_added",
          actor_id: "vet-ana",
          occurred_at: "2026-09-22T09:08:00.000Z",
          supersedes_event_id: null,
        },
        error: null,
      },
    });

    const resultado = await addVetHypothesis(client, {
      clinicId: "clinica-1",
      consultationId: "consulta-1",
      texto: "Hipótesis propia del veterinario",
    });
    expect(resultado.attribution.action).toBe("hypothesis_added");
    const insercion = calls.find(
      (llamada) => llamada.table === "clinical_records" && llamada.method === "insert",
    );
    const payload = insercion?.args[0] as {
      content: { origen: string; respaldo: { avisos: string[] } };
    };
    expect(payload.content.origen).toBe("veterinario");
    expect(payload.content.respaldo.avisos).toContain("sin_respaldo_documental");
  });

  test("FR-020 · US8-AC8: el listado reconstruye cada hipótesis con los insumos que la produjeron", async () => {
    const existente = fila({
      id: "hipotesis-1",
      content: {
        consultationId: "consulta-1",
        texto: "Ansiedad por separación",
        decision: "added",
        origen: "sistema",
        reglaId: "separationAnxiety",
        insumos: {
          anamnesis: [
            {
              recordId: "anamnesis-2",
              field: "contexto",
              text: "Ocurre cuando el animal queda solo",
              provenance: "reportada",
              papel: "aFavor",
            },
          ],
          ficha: [
            {
              fichaRef: "antecedentes.behavioralHistory[0]",
              valor: "Ansiedad previa",
              papel: "aFavor",
            },
          ],
          faltante: ["frecuencia"],
          terminosMatch: ["solo"],
        },
        respaldo: {
          knowledgeQueryId: "query-1",
          citas: [],
          avisos: ["sin_respaldo_documental"],
          cobertura: null,
        },
      },
    });
    const { client } = fakeClient({
      "clinical_records:select": [{ data: [existente], error: null }],
    });

    const hipotesis = await listHypotheses(client, { consultationId: "consulta-1" });
    expect(hipotesis).toHaveLength(1);
    expect(hipotesis[0]?.insumos.anamnesis[0]?.recordId).toBe("anamnesis-2");
    expect(hipotesis[0]?.insumos.ficha[0]?.fichaRef).toBe("antecedentes.behavioralHistory[0]");
    expect(hipotesis[0]?.insumos.terminosMatch).toEqual(["solo"]);
    expect(hipotesis[0]?.respaldo.sinRespaldo).toBe(true);
  });
});
