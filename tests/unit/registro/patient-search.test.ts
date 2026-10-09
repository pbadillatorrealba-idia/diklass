import { describe, expect, test } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PATIENT_PAGE_SIZE,
  searchPatients,
  validDateOnly,
} from "@/features/registro/patient-search";
import type { Database } from "@/lib/supabase/database.types";

function rpcClient(result: { data: unknown; error: unknown }) {
  const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const client = {
    rpc: (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      return Promise.resolve(result);
    },
    // `captureClientError` solo toca el cliente al fallar; el test de error lo ignora.
    from: () => ({ insert: () => Promise.resolve({ error: null }) }),
  } as unknown as SupabaseClient<Database>;
  return { client, calls };
}

const row = {
  id: "p1",
  name: "Luna",
  species: "Canino",
  breed: "Labrador",
  tutor_id: "t1",
  tutor_name: "Ana",
  last_visit_at: "2026-03-10T15:00:00Z",
  total_count: 51,
};

describe("validDateOnly", () => {
  test("acepta solo fechas reales AAAA-MM-DD", () => {
    expect(validDateOnly("2026-03-10")).toBe("2026-03-10");
    expect(validDateOnly("2026-13-40")).toBeUndefined();
    expect(validDateOnly("10/03/2026")).toBeUndefined();
    expect(validDateOnly(undefined)).toBeUndefined();
  });
});

describe("searchPatients", () => {
  test("un tutorId que no es UUID da una página vacía sin llamar al RPC", async () => {
    const { client, calls } = rpcClient({ data: [row], error: null });
    const page = await searchPatients(client, {
      tutorId: "abc",
      sort: "name",
      dir: "asc",
      page: 1,
    });
    expect(page).toEqual({ rows: [], total: 0 });
    expect(calls).toHaveLength(0);
  });

  test("traduce filtros, orden y página a los argumentos del RPC", async () => {
    const { client, calls } = rpcClient({ data: [row], error: null });
    const page = await searchPatients(client, {
      name: " luna ",
      breed: "",
      visitFrom: "2026-03-01",
      visitTo: "2026-03-31",
      sort: "last_visit",
      dir: "desc",
      page: 3,
    });
    expect(calls[0]?.fn).toBe("search_patients");
    expect(calls[0]?.args).toEqual({
      p_name: "luna",
      p_breed: undefined,
      p_tutor_id: undefined,
      p_visit_from: "2026-03-01T00:00:00Z",
      // El tope es exclusivo: el día «hasta» entra completo.
      p_visit_to: "2026-04-01T00:00:00.000Z",
      p_sort: "last_visit",
      p_dir: "desc",
      p_limit: PATIENT_PAGE_SIZE,
      p_offset: 2 * PATIENT_PAGE_SIZE,
    });
    expect(page.total).toBe(51);
    expect(page.rows[0]).toEqual({
      id: "p1",
      name: "Luna",
      species: "Canino",
      breed: "Labrador",
      tutorId: "t1",
      tutorName: "Ana",
      lastVisitAt: "2026-03-10T15:00:00Z",
    });
  });

  test("ignora fechas inválidas y devuelve total 0 sin filas", async () => {
    const { client, calls } = rpcClient({ data: [], error: null });
    const page = await searchPatients(client, {
      visitFrom: "no-es-fecha",
      sort: "name",
      dir: "asc",
      page: 1,
    });
    expect(calls[0]?.args.p_visit_from).toBeUndefined();
    expect(page).toEqual({ rows: [], total: 0 });
  });

  test("propaga el error del servidor", async () => {
    const boom = { code: "42501", message: "AUTHENTICATION_REQUIRED" };
    const { client } = rpcClient({ data: null, error: boom });
    await expect(searchPatients(client, { sort: "name", dir: "asc", page: 1 })).rejects.toBe(boom);
  });
});
