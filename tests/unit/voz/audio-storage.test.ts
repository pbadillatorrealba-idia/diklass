import { describe, expect, test } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AUDIO_BUCKET, rutaAudio, subirAudio } from "@/features/voz/audio-storage";
import type { Database } from "@/lib/supabase/database.types";

const audio = {
  blob: new Blob([new Uint8Array(32)], { type: "audio/webm" }),
  mimeType: "audio/webm",
  extension: "webm" as const,
};

function clienteStorage(error: { message: string } | null = null) {
  const subidas: Array<{ bucket: string; path: string; opciones: unknown }> = [];
  const client = {
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string, _blob: Blob, opciones: unknown) => {
          subidas.push({ bucket, path, opciones });
          return { data: null, error };
        },
      }),
    },
  } as unknown as SupabaseClient<Database>;
  return { client, subidas };
}

describe("audio-storage (D4)", () => {
  test("la ruta es {clínica}/{sesión}/{seq}.{ext}, la que exige el guardia de la migración 019", () => {
    expect(rutaAudio("clinica-1", "sesion-1", 3, "webm")).toBe("clinica-1/sesion-1/3.webm");
    expect(rutaAudio("clinica-1", "sesion-1", 0, "m4a")).toBe("clinica-1/sesion-1/0.m4a");
  });

  test("sube el audio al bucket privado con su tipo y sin sobrescribir", async () => {
    const { client, subidas } = clienteStorage();
    await subirAudio(client, "clinica-1/sesion-1/0.webm", audio);
    expect(subidas).toEqual([
      {
        bucket: AUDIO_BUCKET,
        path: "clinica-1/sesion-1/0.webm",
        opciones: { contentType: "audio/webm", upsert: false },
      },
    ]);
  });

  test("un fallo de subida se propaga con su motivo (Constitución IV)", async () => {
    const { client } = clienteStorage({ message: "new row violates row-level security policy" });
    await expect(subirAudio(client, "clinica-1/sesion-1/0.webm", audio)).rejects.toThrow(
      /conservar el audio.*row-level security/i,
    );
  });
});
