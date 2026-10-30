import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  ANA,
  adminClient,
  isLiveSupabase,
  type LiveVeterinarian,
  signedInVeterinarian,
} from "../live-supabase";

/**
 * Cuota por usuario del agente (5.6 · migración 027) contra Supabase viva: 30 turnos por ventana y el
 * candado impide pasar del tope con peticiones paralelas. Solo corre con `SUPABASE_LIVE_TESTS=1`.
 */
describe.skipIf(!isLiveSupabase)("cuota del agente contra Supabase viva", () => {
  let ana: LiveVeterinarian;
  const limpiar = () =>
    adminClient().from("assistant_agent_usage").delete().eq("author_id", ana.userId);

  beforeAll(async () => {
    ana = await signedInVeterinarian(ANA);
    await limpiar();
  });
  afterAll(async () => {
    await limpiar();
  });

  test("permite 30 turnos y el 31 se rechaza", async () => {
    const resultados: unknown[] = [];
    for (let i = 0; i < 31; i++) {
      const { data } = await ana.client.rpc("consume_agent_quota");
      resultados.push(data);
    }
    expect(resultados.filter((r) => r === "ok")).toHaveLength(30);
    expect(resultados[30]).toBe("rate_limited");
  });

  test("las peticiones paralelas tampoco pasan de 30", async () => {
    await limpiar();
    const resultados = await Promise.all(
      Array.from({ length: 40 }, () => ana.client.rpc("consume_agent_quota")),
    );
    expect(resultados.filter((r) => r.data === "ok")).toHaveLength(30);
  });
});
