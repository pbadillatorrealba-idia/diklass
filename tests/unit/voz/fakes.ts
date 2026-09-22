import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Seam de prueba (patrón de tests/unit/registro/ficha-service.test.ts): cliente falso con
 * resultados por tabla y operación, consumidos en orden de llamada. Las cadenas de PostgREST
 * son awaitables sin terminal y el mock se comporta igual.
 */

export type FakeCall = { table: string; method: string; args: unknown[] };
export type FakeResult = { data: unknown; error: unknown };

type FakeQuery = Promise<FakeResult> & {
  insert: (...args: unknown[]) => FakeQuery;
  update: (...args: unknown[]) => FakeQuery;
  select: (...args: unknown[]) => FakeQuery;
  eq: (...args: unknown[]) => FakeQuery;
  order: (...args: unknown[]) => FakeQuery;
  limit: (...args: unknown[]) => FakeQuery;
  single: () => Promise<FakeResult>;
  maybeSingle: () => Promise<FakeResult>;
};

export function fakeClient(queues: Partial<Record<string, FakeResult[]>> = {}) {
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

  // El reporte de errores jamás ensucia `calls`.
  const functions = {
    invoke: async () => ({ data: null, error: null }),
  };

  return {
    client: { from, rpc, functions } as unknown as SupabaseClient<Database>,
    calls,
  };
}

export function fakeConsultation(estado: "open" | "closed") {
  return {
    approved_at: null,
    approved_by: null,
    clinic_id: "clinica-1",
    content: { consultationId: "consulta-1", patientId: "paciente-1", status: estado },
    created_at: "2026-09-22T09:00:00.000Z",
    created_by: "vet-ana",
    id: "consulta-1",
    record_type: "consultation",
    status: "draft",
    supersedes_event_id: null,
    updated_at: null,
    updated_by: null,
  };
}
