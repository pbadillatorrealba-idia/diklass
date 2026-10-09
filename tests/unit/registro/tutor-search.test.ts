import { describe, expect, test } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  findDuplicateTutors,
  findTutorByRut,
  searchTutors,
  TUTOR_PAGE_SIZE,
} from "@/features/registro/tutor-search";
import type { Database } from "@/lib/supabase/database.types";

function rpcClient(result: { data: unknown; error: unknown }) {
  const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const client = {
    rpc: (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      return Promise.resolve(result);
    },
    from: () => ({ insert: () => Promise.resolve({ error: null }) }),
  } as unknown as SupabaseClient<Database>;
  return { client, calls };
}

const row = {
  id: "t1",
  name: "Marta",
  surname: "Soto",
  full_name: "Marta Soto",
  rut: "12345678-5",
  phone: "+56 9 5550 0101",
  email: null,
  patient_count: 2,
  created_at: "2026-01-10T10:00:00Z",
  total_count: 51,
};

describe("searchTutors", () => {
  test("traduce filtros, orden y página a los argumentos del RPC", async () => {
    const { client, calls } = rpcClient({ data: [row], error: null });
    const page = await searchTutors(client, {
      name: " marta ",
      contact: "",
      sort: "patients",
      dir: "desc",
      page: 3,
    });
    expect(calls[0]?.fn).toBe("search_tutors");
    expect(calls[0]?.args).toEqual({
      p_name: "marta",
      p_contact: undefined,
      p_sort: "patients",
      p_dir: "desc",
      p_limit: TUTOR_PAGE_SIZE,
      p_offset: 2 * TUTOR_PAGE_SIZE,
    });
    expect(page.total).toBe(51);
    expect(page.rows[0]).toEqual({
      id: "t1",
      fullName: "Marta Soto",
      rut: "12345678-5",
      phone: "+56 9 5550 0101",
      email: null,
      patientCount: 2,
    });
  });

  test("sin filas, total 0", async () => {
    const { client } = rpcClient({ data: [], error: null });
    expect(await searchTutors(client, { sort: "name", dir: "asc", page: 1 })).toEqual({
      rows: [],
      total: 0,
    });
  });

  test("propaga el error del servidor", async () => {
    const boom = { code: "42501", message: "AUTHENTICATION_REQUIRED" };
    const { client } = rpcClient({ data: null, error: boom });
    await expect(searchTutors(client, { sort: "name", dir: "asc", page: 1 })).rejects.toBe(boom);
  });
});

describe("findDuplicateTutors", () => {
  const other = { ...row, id: "t2", full_name: "Pablo", phone: "5550", email: "P@Example.test" };

  test("devuelve solo coincidencias exactas de teléfono o correo, sin mayúsculas ni espacios", async () => {
    const { client } = rpcClient({ data: [row, other], error: null });
    const found = await findDuplicateTutors(client, {
      phone: " 5550 ",
      email: "p@example.TEST",
    });
    expect(found.map((tutor) => tutor.id)).toEqual(["t2"]);
  });

  test("sin teléfono ni correo no consulta", async () => {
    const { client, calls } = rpcClient({ data: [row], error: null });
    expect(await findDuplicateTutors(client, { phone: " ", email: null })).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  test("excluye al propio tutor al editar", async () => {
    const { client } = rpcClient({ data: [row], error: null });
    const found = await findDuplicateTutors(client, {
      phone: "+56 9 5550 0101",
      email: null,
      excludeId: "t1",
    });
    expect(found).toEqual([]);
  });

  test("si la búsqueda falla, no hay avisos y no lanza", async () => {
    const { client } = rpcClient({ data: null, error: { message: "boom" } });
    expect(await findDuplicateTutors(client, { phone: "5550", email: null })).toEqual([]);
  });
});

describe("findTutorByRut", () => {
  test("devuelve el tutor con ese RUT exacto, no uno que solo lo contenga", async () => {
    const parecido = { ...row, id: "t2", rut: "112345678-5" };
    const { client } = rpcClient({ data: [parecido, row], error: null });
    expect((await findTutorByRut(client, "12345678-5"))?.id).toBe("t1");
  });

  test("excluye al propio tutor al editar", async () => {
    const { client } = rpcClient({ data: [row], error: null });
    expect(await findTutorByRut(client, "12345678-5", "t1")).toBeNull();
  });

  test("si la búsqueda falla devuelve null: manda el índice único de la base", async () => {
    const { client } = rpcClient({ data: null, error: { message: "boom" } });
    expect(await findTutorByRut(client, "12345678-5")).toBeNull();
  });
});
