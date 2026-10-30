import { describe, expect, test } from "bun:test";
import {
  acceptVoiceConsent,
  hasVoiceConsent,
  VOICE_CONSENT_VERSION,
} from "@/features/asistente/voice-consent";

function cliente(
  filas: Array<{ version: string }>,
  errorInsert: { message: string } | null = null,
) {
  const insertados: unknown[] = [];
  return {
    insertados,
    client: {
      from: () => ({
        select: () => ({
          eq: async (_columna: string, valor: string) => ({
            data: filas.filter((fila) => fila.version === valor),
            error: null,
          }),
        }),
        insert: async (valores: unknown) => {
          insertados.push(valores);
          return { error: errorInsert };
        },
      }),
    } as never,
  };
}

// Consentimiento de la primera grabación: el audio y su transcripción van a un proveedor externo.
describe("consentimiento de voz", () => {
  test("sin fila no hay consentimiento", async () => {
    expect(await hasVoiceConsent(cliente([]).client)).toBe(false);
  });

  test("con la versión vigente aceptada hay consentimiento", async () => {
    expect(await hasVoiceConsent(cliente([{ version: VOICE_CONSENT_VERSION }]).client)).toBe(true);
  });

  test("una versión anterior del aviso obliga a aceptar de nuevo", async () => {
    expect(await hasVoiceConsent(cliente([{ version: "v0" }]).client)).toBe(false);
  });

  test("aceptar guarda la versión vigente y nada más (el servidor fija el autor y el momento)", async () => {
    const { client, insertados } = cliente([]);
    await acceptVoiceConsent(client);
    expect(insertados).toEqual([{ version: VOICE_CONSENT_VERSION }]);
  });

  test("un error al guardar se propaga: no se graba sin consentimiento registrado", async () => {
    const { client } = cliente([], { message: "RLS" });
    await expect(acceptVoiceConsent(client)).rejects.toThrow("RLS");
  });
});
