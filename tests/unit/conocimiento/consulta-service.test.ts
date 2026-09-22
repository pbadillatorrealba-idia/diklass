import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, test } from "bun:test";
import {
  consultKnowledge,
  getQuery,
  listQueries,
} from "@/features/conocimiento/consulta-service";
import type { PatientContent } from "@/features/registro/schema";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Orquestación de la consulta al asistente (D4–D7 de design.md). Tarea 3.2.
 */

type FakeCall = { table: string; method: string; args: unknown[] };
type FakeResult = { data: unknown; error: unknown };

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

function fakeClient(queues: Partial<Record<string, FakeResult[]>> = {}) {
  const calls: FakeCall[] = [];
  const take = (key: string): FakeResult => queues[key]?.shift() ?? { data: null, error: null };

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

const bibliografia = {
  titulo: "Guía ficticia",
  autores: ["Dra. Ficticia"],
  anio: 2025,
  revista: null,
  editorial: null,
  edicion: null,
  doi: null,
  url: null,
};

const licencia = { tipo: "CC BY 4.0 (ficticia)", nota: null };

function filaRecuperada(cambios: Record<string, unknown> = {}) {
  return {
    documento_id: "doc-1",
    fragmento_ordinal: 1,
    texto: "La ansiedad por separación se diagnostica por la historia clínica.",
    seccion: "Diagnóstico",
    bibliografia,
    licencia,
    estado: "available",
    rank_cd: 0.5,
    lemas_cubiertos: ["ansied", "separ", "diagnost"],
    lemas_pregunta: ["ansied", "separ", "diagnost"],
    ...cambios,
  };
}

const contenidoPaciente: PatientContent = {
  name: "Luna",
  species: "perro",
  breed: "Mestizo",
  birthDate: null,
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
  tutorId: "tutor-1",
};

const filaConsulta = {
  id: "query-1",
  clinic_id: "clinic-1",
  question: "¿Cómo se diagnostica la ansiedad por separación?",
  patient_id: null as string | null,
  answer: {
    pregunta: "¿Cómo se diagnostica la ansiedad por separación?",
    patientId: null,
    segmentos: [],
    cobertura: { estado: "sin_evidencia", cubiertos: [], noCubiertos: [] },
    avisos: ["sin_respaldo_documental"],
  },
  created_at: "2026-09-22T12:00:00Z",
};

describe("consultKnowledge (FR-005 · FR-006 · FR-007 · US5-AC1 · D4/D6)", () => {
  test("recupera, compone y persiste la respuesta con cita documento+fragmento", async () => {
    const { client, calls } = fakeClient({
      "rpc:search_knowledge_fragments": [{ data: [filaRecuperada()], error: null }],
      "knowledge_queries:insert": [{ data: { ...filaConsulta, id: "query-9" }, error: null }],
    });

    const { queryId, answer } = await consultKnowledge(client, {
      clinicId: "clinic-1",
      pregunta: "  ¿Cómo se diagnostica la ansiedad por separación?  ",
      patientId: null,
    });

    expect(queryId).toBe("query-9");
    const evidencia = answer.segmentos.find((s) => s.kind === "evidencia");
    if (evidencia?.kind !== "evidencia") throw new Error("sin evidencia");
    expect(evidencia.cita.documentoId).toBe("doc-1");
    expect(evidencia.cita.fragmentoOrdinal).toBe(1);
    expect(evidencia.cita.textoCitado).toBe(filaRecuperada().texto);
    expect(evidencia.cita.bibliografia.titulo).toBe("Guía ficticia");

    const busqueda = calls.find((call) => call.table === "rpc");
    expect(busqueda?.args[0]).toMatchObject({ p_query: "¿Cómo se diagnostica la ansiedad por separación?" });
    const persistencia = calls.find((call) => call.method === "insert");
    expect(persistencia?.table).toBe("knowledge_queries");
  });

  test("con paciente seleccionado lee la ficha y la marca como ficha, nunca como fuente (FR-020 · FR-021 · US5-AC5)", async () => {
    const { client } = fakeClient({
      "rpc:search_knowledge_fragments": [{ data: [filaRecuperada()], error: null }],
      "clinical_records:select": [
        {
          data: { id: "patient-1", content: contenidoPaciente },
          error: null,
        },
      ],
      "knowledge_queries:insert": [
        {
          data: { ...filaConsulta, id: "query-2", patient_id: "patient-1" },
          error: null,
        },
      ],
    });

    const { answer } = await consultKnowledge(client, {
      clinicId: "clinic-1",
      pregunta: "¿Cómo se diagnostica la ansiedad por separación?",
      patientId: "patient-1",
    });

    expect(answer.patientId).toBe("patient-1");
    const ficha = answer.segmentos.filter((s) => s.kind === "ficha");
    expect(ficha.length).toBeGreaterThan(0);
    expect(ficha.every((s) => s.kind === "ficha" && s.fichaRef.length > 0)).toBe(true);
    expect(answer.avisos).not.toContain("sin_paciente_seleccionado");
  });

  test("sin paciente no atribuye datos de nadie (FR-051 · US5-AC10)", async () => {
    const { client, calls } = fakeClient({
      "rpc:search_knowledge_fragments": [{ data: [], error: null }],
      "knowledge_queries:insert": [{ data: { ...filaConsulta, id: "query-3" }, error: null }],
    });

    const { answer } = await consultKnowledge(client, {
      clinicId: "clinic-1",
      pregunta: "¿Qué revisar?",
      patientId: null,
    });

    expect(answer.segmentos.filter((s) => s.kind === "ficha")).toHaveLength(0);
    expect(answer.avisos).toEqual(expect.arrayContaining(["sin_paciente_seleccionado", "sin_respaldo_documental"]));
    expect(calls.some((call) => call.table === "clinical_records")).toBe(false);
  });

  test("rechaza una pregunta vacía sin invocar el servidor (Principio V)", async () => {
    const { client, calls } = fakeClient();
    await expect(
      consultKnowledge(client, { clinicId: "clinic-1", pregunta: "   ", patientId: null }),
    ).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });
});

describe("getQuery y listQueries (FR-020 · FR-053 · US5-AC5/AC12 · D6)", () => {
  test("reconstruye lo que produjo la recomendación y marca la fuente retirada", async () => {
    const respuestaGuardada = {
      pregunta: "¿Cómo se diagnostica la ansiedad por separación?",
      patientId: null,
      segmentos: [
        {
          id: "evidencia-doc-1-1",
          kind: "evidencia",
          provenance: "recuperada",
          texto: "La ansiedad por separación se diagnostica por la historia clínica.",
          cita: {
            documentoId: "doc-1",
            fragmentoOrdinal: 1,
            textoCitado: "La ansiedad por separación se diagnostica por la historia clínica.",
            bibliografia,
            licencia,
            estado: "available",
          },
        },
      ],
      cobertura: { estado: "cubre", cubiertos: ["ansied", "separ", "diagnost"], noCubiertos: [] },
      avisos: [],
    };
    const { client } = fakeClient({
      "knowledge_queries:select": [
        {
          data: { ...filaConsulta, id: "query-7", answer: respuestaGuardada },
          error: null,
        },
      ],
      "knowledge_documents:select": [{ data: [{ id: "doc-1", status: "withdrawn" }], error: null }],
    });

    const reconstruida = await getQuery(client, "query-7");

    expect(reconstruida?.row.id).toBe("query-7");
    const evidencia = reconstruida?.answer.segmentos.find((s) => s.kind === "evidencia");
    if (evidencia?.kind !== "evidencia") throw new Error("sin evidencia");
    expect(evidencia.cita.textoCitado).toBe("La ansiedad por separación se diagnostica por la historia clínica.");
    expect(evidencia.cita.estado).toBe("withdrawn");
    expect(reconstruida?.answer.avisos).toContain("fuente_retirada");
  });

  test("lista el registro de consultas parseado", async () => {
    const { client } = fakeClient({
      "knowledge_queries:select": [{ data: [filaConsulta], error: null }],
    });
    const filas = await listQueries(client);
    expect(filas.map((fila) => fila.id)).toEqual(["query-1"]);
    expect(filas[0]?.answer.pregunta).toBe("¿Cómo se diagnostica la ansiedad por separación?");
  });

  test("propaga los errores del servidor sin silenciarlos (Constitución IV)", async () => {
    const { client } = fakeClient({
      "knowledge_queries:select": [{ data: null, error: new Error("AUTHENTICATION_REQUIRED") }],
    });
    await expect(getQuery(client, "query-x")).rejects.toThrow("AUTHENTICATION_REQUIRED");
  });
});
