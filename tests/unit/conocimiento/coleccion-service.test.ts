import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, test } from "bun:test";
import {
  incorporateSource,
  listSources,
  withdrawSource,
} from "@/features/conocimiento/coleccion-service";
import { loadSyntheticCorpus } from "@/features/conocimiento/corpus-loader";
import type { FuenteContent } from "@/features/conocimiento/schema";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Puerta de escritura de la colección documental (D1/D3/D7 de design.md). Tarea 3.1.
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

const fuente: FuenteContent = {
  bibliografia: {
    titulo: "Protocolo ficticio",
    autores: ["Dra. Ficticia"],
    anio: 2025,
    revista: null,
    editorial: null,
    edicion: null,
    doi: null,
    url: null,
  },
  licencia: { tipo: "CC BY 4.0 (ficticia)", nota: null },
  fragmentos: [
    { ordinal: 1, seccion: "Anamnesis", texto: "Revisar los antecedentes de apego." },
    { ordinal: 2, seccion: null, texto: "La desensibilización gradual a las ausencias es el pilar." },
  ],
};

function filaDocumento(cambios: Record<string, unknown> = {}) {
  return {
    id: "doc-1",
    clinic_id: "clinic-1",
    status: "available",
    content: fuente,
    created_by: "vet-ana",
    created_at: "2026-09-22T12:00:00Z",
    withdrawn_by: null,
    withdrawn_at: null,
    ...cambios,
  };
}

describe("incorporateSource (FR-028 · FR-030 · FR-069 · US5-AC6/AC9/AC13 · D3)", () => {
  test("rechaza campos de atribución enviados por el cliente sin tocar el servidor", async () => {
    const { client, calls } = fakeClient();
    await expect(
      incorporateSource(client, {
        clinicId: "clinic-1",
        fuente,
        created_by: "vet-impostor",
      } as never),
    ).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });

  test("incorpora y devuelve la atribución real de la fila, sin acción enumerada (D3)", async () => {
    const { client, calls } = fakeClient({
      "knowledge_documents:insert": [{ data: filaDocumento(), error: null }],
    });

    const alta = await incorporateSource(client, { clinicId: "clinic-1", fuente });

    expect(alta.record.record.id).toBe("doc-1");
    expect(alta.attribution).toEqual({
      actorId: "vet-ana",
      occurredAt: "2026-09-22T12:00:00Z",
      action: null,
      supersedesEventId: null,
    });
    const insercion = calls.find((call) => call.method === "insert");
    expect(insercion?.table).toBe("knowledge_documents");
    expect(insercion?.args[0]).toMatchObject({ clinic_id: "clinic-1", status: "available" });
  });

  test("la forma inválida se rechaza en la frontera con Zod (Principio V)", async () => {
    const { client, calls } = fakeClient();
    await expect(
      incorporateSource(client, {
        clinicId: "clinic-1",
        fuente: { ...fuente, fragmentos: [] },
      } as never),
    ).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });
});

describe("withdrawSource (FR-053 · FR-069 · US5-AC12/AC13 · D3)", () => {
  test("solo pide la transición de retirada y devuelve la atribución del retiro", async () => {
    const retirada = filaDocumento({
      status: "withdrawn",
      withdrawn_by: "vet-bruno",
      withdrawn_at: "2026-09-22T13:00:00Z",
    });
    const { client, calls } = fakeClient({
      "knowledge_documents:update": [{ data: retirada, error: null }],
    });

    const resultado = await withdrawSource(client, { documentId: "doc-1" });

    expect(resultado.attribution).toEqual({
      actorId: "vet-bruno",
      occurredAt: "2026-09-22T13:00:00Z",
      action: null,
      supersedesEventId: null,
    });
    const update = calls.find((call) => call.method === "update");
    expect(update?.args[0]).toEqual({ status: "withdrawn" });
  });

  test("rechaza un identificador vacío sin invocar el servidor", async () => {
    const { client, calls } = fakeClient();
    await expect(withdrawSource(client, { documentId: "  " })).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });
});

describe("listSources (FR-030 · FR-069 · US5-AC9/AC13)", () => {
  test("lista la colección con bibliografia, licencia y atribución, y salta filas ilegibles", async () => {
    const { client } = fakeClient({
      "knowledge_documents:select": [
        {
          data: [filaDocumento(), filaDocumento({ id: "doc-2", content: { roto: true } })],
          error: null,
        },
      ],
    });

    const fuentes = await listSources(client);

    expect(fuentes).toHaveLength(1);
    expect(fuentes[0]?.record.created_by).toBe("vet-ana");
    expect(fuentes[0]?.content.bibliografia.titulo).toBe("Protocolo ficticio");
    expect(fuentes[0]?.content.licencia.tipo).toBe("CC BY 4.0 (ficticia)");
  });
});

describe("loadSyntheticCorpus (D9 · decisión de usuario: corpus sintético)", () => {
  test("incorpora cada fuente por el camino de la UI y devuelve la clave→id", async () => {
    const respuestas = [
      filaDocumento({ id: "doc-1" }),
      filaDocumento({ id: "doc-2", created_by: "vet-bruno" }),
    ];
    const { client, calls } = fakeClient({
      "knowledge_documents:insert": respuestas.map((data) => ({ data, error: null })),
    });

    const corpus = {
      fuentes: [
        { clave: "ansiedad", fuente },
        { clave: "conducta", fuente: { ...fuente, bibliografia: { ...fuente.bibliografia, titulo: "Otra" } } },
      ],
    };

    const cargado = await loadSyntheticCorpus(client, { clinicId: "clinic-1", corpus });

    expect(cargado.claves).toEqual({ ansiedad: "doc-1", conducta: "doc-2" });
    expect(calls.filter((call) => call.method === "insert")).toHaveLength(2);
  });
});
