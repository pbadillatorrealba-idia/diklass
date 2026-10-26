import { beforeAll, describe, expect, test } from "bun:test";
import { startListenSession } from "@/features/voz/listen-session-service";
import { ANA, isLiveSupabase, type LiveVeterinarian, signedInVeterinarian } from "../live-supabase";
import { nuevaConsultaVoz } from "./consulta-voz";

/**
 * Transcripción real con la Edge Function y OpenAI `gpt-transcribe` (cambio
 * implementar-asr-real-captura-voz · D3 · tarea 6.3). Opt-in: necesita Supabase viva, la función
 * sirviéndose con `OPENAI_API_KEY` (`supabase functions serve --env-file supabase/functions/.env`)
 * y `VOZ_ASR_LIVE=1`; queda fuera de CI porque cuesta dinero y depende de un tercero.
 *
 * Los fixtures son una voz sintética (TTS), nunca una grabación real.
 */
const habilitada = isLiveSupabase && process.env.VOZ_ASR_LIVE === "1";

const fixture = (nombre: string) => Bun.file(`${import.meta.dir}/../../fixtures/voz/${nombre}`);

describe.skipIf(!habilitada)("transcribe-audio con OpenAI real (opt-in)", () => {
  let ana: LiveVeterinarian;
  let sessionId: string;

  beforeAll(async () => {
    ana = await signedInVeterinarian(ANA);
    const consultationId = await nuevaConsultaVoz(ana);
    sessionId = (await startListenSession(ana.client, { clinicId: ana.clinicId, consultationId }))
      .id;
  });

  async function transcribir(archivo: Blob, nombre: string) {
    const body = new FormData();
    body.set("audio", archivo, nombre);
    body.set("listeningSessionId", sessionId);
    return ana.client.functions.invoke("transcribe-audio", { body });
  }

  test.each([
    ["tramo-sintetico.webm", "audio/webm"],
    ["tramo-sintetico.m4a", "audio/mp4"],
  ])(
    "transcribe %s en español con calidad ok",
    async (nombre, tipo) => {
      const bytes = await fixture(nombre).arrayBuffer();
      const { data, error } = await transcribir(new Blob([bytes], { type: tipo }), nombre);
      expect(error).toBeNull();
      const respuesta = data as { text: string; quality: string };
      expect(respuesta.quality).toBe("ok");
      expect(respuesta.text.toLowerCase()).toContain("rocky");
      expect(respuesta.text.toLowerCase()).toContain("sofá");
    },
    30_000,
  );

  test("FR-014: sobre una sesión inexistente no envía audio al proveedor (403)", async () => {
    const body = new FormData();
    body.set(
      "audio",
      new Blob([await fixture("tramo-sintetico.webm").arrayBuffer()], { type: "audio/webm" }),
      "tramo.webm",
    );
    body.set("listeningSessionId", "00000000-0000-4000-8000-000000000000");
    const { error } = await ana.client.functions.invoke("transcribe-audio", { body });
    expect(error?.context?.status).toBe(403);
  });
});
