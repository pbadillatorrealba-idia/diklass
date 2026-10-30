import { expect, test } from "bun:test";
import { findDevPort } from "../../../scripts/dev-server";

// Se ocupan los puertos reales para comprobar el salto y el agotamiento del rango.
test("elige el primer puerto libre entre 9701 y 9710 y falla si todos están ocupados", () => {
  const listeners: Bun.TCPSocketListener<undefined>[] = [];
  let firstFree: number | undefined;
  try {
    for (let port = 9701; port <= 9710; port++) {
      try {
        const listener = Bun.listen({ hostname: "::", port, socket: { data() {} } });
        if (firstFree === undefined) firstFree = port;
        listeners.push(listener);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EADDRINUSE") throw error;
      }
    }
    expect(() => findDevPort()).toThrow("9701–9710");
    const first = listeners.shift();
    if (!first || firstFree === undefined)
      throw new Error("No hay puertos libres para comprobar la selección");
    first.stop(true);
    expect(findDevPort()).toBe(firstFree);
    const second = listeners.shift();
    if (second) {
      second.stop(true);
      expect(findDevPort()).toBe(firstFree);
    }
  } finally {
    for (const listener of listeners) listener.stop(true);
  }
});
