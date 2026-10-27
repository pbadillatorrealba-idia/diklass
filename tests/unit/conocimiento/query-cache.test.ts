import { describe, expect, test } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import {
  CONOCIMIENTO_QUERY_KEY,
  invalidateConocimiento,
} from "@/features/conocimiento/query-cache";

/**
 * Invalidación de la caché de la base de conocimiento (revisión de la PR #30): con el
 * `staleTime` global de 30 s, incorporar o retirar una fuente dejaba la colección desfasada.
 */

function clienteConDatos(claves: readonly (readonly unknown[])[]): QueryClient {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } });
  for (const clave of claves) client.setQueryData(clave, []);
  return client;
}

const invalidada = (client: QueryClient, clave: readonly unknown[]) =>
  client.getQueryState(clave)?.isInvalidated ?? false;

describe("invalidateConocimiento", () => {
  test("marca obsoleta toda lectura de la base de conocimiento y nada del registro", async () => {
    const client = clienteConDatos([
      [...CONOCIMIENTO_QUERY_KEY, "sources"],
      [...CONOCIMIENTO_QUERY_KEY, "source", "doc-1"],
      [...CONOCIMIENTO_QUERY_KEY, "query", "query-1"],
      ["registro", "tutors"],
    ]);

    await invalidateConocimiento(client);

    expect(invalidada(client, ["conocimiento", "sources"])).toBe(true);
    expect(invalidada(client, ["conocimiento", "source", "doc-1"])).toBe(true);
    expect(invalidada(client, ["conocimiento", "query", "query-1"])).toBe(true);
    expect(invalidada(client, ["registro", "tutors"])).toBe(false);
  });
});
