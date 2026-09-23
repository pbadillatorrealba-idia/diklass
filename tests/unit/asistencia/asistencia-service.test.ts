import { describe, expect, test } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decideMissingInformation, listSuggestions } from "@/features/asistencia/asistencia-service";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Servicio de información faltante (D3/D4/D9 de design.md · tasks.md 3.1).
 * Trazabilidad: FR-008 · FR-033 · FR-063 · US7-AC1/AC2/AC3/AC5/AC6.
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
    Object.entries(queues).map(([clave, cola]) => [clave, Array.isArray(cola) ? [...cola] : [cola]]),
  );
  const take = (key: string): FakeResult => restantes.get(key)?.shift() ?? { data: null, error: null };

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
    record_type: "anamnesis",
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
    birthDate: null,
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

const anamnesis = fila({
  id: "anamnesis-1",
  record_type: "anamnesis",
  content: {
    consultationId: "consulta-1",
    field: "motivo_consulta",
    text: "Destroza objetos y ladra",
    provenance: "reportada",
  },
});

const fragmentoRecuperado = {
  documento_id: "doc-1",
  fragmento_ordinal: 1,
  texto: "Registrar la conducta cuando el animal queda solo es el primer paso del protocolo.",
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

describe("asistencia-service: información faltante (US7)", () => {
  test("US7-AC1 · FR-033 · US7-AC3: la sugerencia pendiente llega con su fundamento citado o declarado", async () => {
    const { client, calls } = fakeClient({
      "clinical_records:select": [
        { data: consulta, error: null },
        { data: [anamnesis], error: null },
        { data: paciente, error: null },
        { data: [], error: null },
      ],
      "rpc:search_knowledge_fragments": { data: [fragmentoRecuperado], error: null },
    });

    const sugerencias = await listSuggestions(client, { consultationId: "consulta-1" });
    const alone = sugerencias.find((sugerencia) => sugerencia.key === "aloneContext");
    expect(alone?.estado).toBe("pendiente");
    expect(alone?.fundamento.kind).toBe("fuente");
    if (alone?.fundamento.kind === "fuente") {
      expect(alone.fundamento.cita.textoCitado).toContain("queda solo");
    }
    expect(calls.some((llamada) => llamada.method === "search_knowledge_fragments")).toBe(true);
  });

  test("US7-AC2 · US7-AC6 · D3: la decisión registrada fija el estado y su fila", async () => {
    const decision = fila({
      id: "decision-1",
      record_type: "missing_information",
      content: {
        consultationId: "consulta-1",
        suggestionKey: "aloneContext",
        pregunta: "¿El comportamiento ocurre solo cuando el animal queda solo?",
        estado: "no_aplicable",
        fundamento: { kind: "criterio_general" },
        camposRelacionados: ["contexto"],
      },
    });
    const { client } = fakeClient({
      "clinical_records:select": [
        { data: consulta, error: null },
        { data: [anamnesis], error: null },
        { data: paciente, error: null },
        { data: [decision], error: null },
      ],
      "rpc:search_knowledge_fragments": { data: [], error: null },
    });

    const sugerencias = await listSuggestions(client, { consultationId: "consulta-1" });
    const alone = sugerencias.find((sugerencia) => sugerencia.key === "aloneContext");
    expect(alone?.estado).toBe("no_aplicable");
    expect(alone?.decisionRecordId).toBe("decision-1");
    expect(alone?.fundamento).toEqual({ kind: "criterio_general" });
  });

  test("FR-008 · FR-063 · US7-AC2: decidir crea la fila missing_information con la atribución releída de la traza", async () => {
    const { client, calls } = fakeClient({
      "clinical_records:select": [{ data: [], error: null }],
      "clinical_records:insert": {
        data: fila({ id: "decision-1", record_type: "missing_information" }),
        error: null,
      },
      "clinical_audit_events:select": {
        data: {
          action: "missing_information_decided",
          actor_id: "vet-ana",
          occurred_at: "2026-09-22T09:05:00.000Z",
          supersedes_event_id: null,
        },
        error: null,
      },
    });

    const resultado = await decideMissingInformation(client, {
      clinicId: "clinica-1",
      consultationId: "consulta-1",
      suggestionKey: "aloneContext",
      estado: "formulada",
      fundamento: { kind: "criterio_general" },
    });
    expect(resultado.attribution.action).toBe("missing_information_decided");
    const insercion = calls.find((llamada) => llamada.table === "clinical_records" && llamada.method === "insert");
    const payload = insercion?.args[0] as { record_type: string; content: { estado: string } };
    expect(payload.record_type).toBe("missing_information");
    expect(payload.content.estado).toBe("formulada");
  });

  test("D7 · HD6: revisar la decisión actualiza el estado conservando la base inmutable", async () => {
    const decision = fila({
      id: "decision-1",
      record_type: "missing_information",
      content: {
        consultationId: "consulta-1",
        suggestionKey: "aloneContext",
        pregunta: "¿El comportamiento ocurre solo cuando el animal queda solo?",
        estado: "formulada",
        fundamento: { kind: "criterio_general" },
        camposRelacionados: ["contexto"],
      },
    });
    const { client, calls } = fakeClient({
      "clinical_records:select": [{ data: [decision], error: null }],
      "clinical_records:update": {
        data: fila({ id: "decision-1", record_type: "missing_information" }),
        error: null,
      },
      "clinical_audit_events:select": {
        data: {
          action: "missing_information_decided",
          actor_id: "vet-ana",
          occurred_at: "2026-09-22T09:06:00.000Z",
          supersedes_event_id: null,
        },
        error: null,
      },
    });

    await decideMissingInformation(client, {
      clinicId: "clinica-1",
      consultationId: "consulta-1",
      suggestionKey: "aloneContext",
      estado: "ignorada",
      fundamento: { kind: "criterio_general" },
    });
    const actualizacion = calls.find((llamada) => llamada.table === "clinical_records" && llamada.method === "update");
    const payload = actualizacion?.args[0] as {
      content: { estado: string; pregunta: string; suggestionKey: string };
    };
    expect(payload.content.estado).toBe("ignorada");
    expect(payload.content.pregunta).toBe(decision.content.pregunta ?? "");
    expect(payload.content.suggestionKey).toBe("aloneContext");
  });

  test("D3: una sugerencia fuera del registro no admite decisión (frontera validada)", async () => {
    const { client } = fakeClient();
    await expect(
      decideMissingInformation(client, {
        clinicId: "clinica-1",
        consultationId: "consulta-1",
        suggestionKey: "claveInexistente",
        estado: "formulada",
        fundamento: { kind: "criterio_general" },
      }),
    ).rejects.toThrow();
  });
});
