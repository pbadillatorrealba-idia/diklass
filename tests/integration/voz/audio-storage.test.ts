import { beforeAll, describe, expect, test } from "bun:test";
import { AUDIO_BUCKET, rutaAudio, subirAudio } from "@/features/voz/audio-storage";
import { startListenSession } from "@/features/voz/listen-session-service";
import { saveTranscriptSegment } from "@/features/voz/transcript-service";
import {
  ANA,
  BRUNO,
  isLiveSupabase,
  type LiveVeterinarian,
  signedInVeterinarian,
} from "../live-supabase";
import { nuevaConsultaVoz } from "./consulta-voz";

/**
 * Audio conservado por tramo contra Storage real (cambio implementar-asr-real-captura-voz · D4).
 * Requiere `storage-api` (`bun run db:start`). El aislamiento entre clínicas y las políticas se
 * fijan en pgTap (`019_audio_voz.sql`); aquí se ejerce la API de Storage de extremo a extremo.
 */
describe.skipIf(!isLiveSupabase)("audio por tramo en Storage (integración viva)", () => {
  let ana: LiveVeterinarian;
  let bruno: LiveVeterinarian;
  let sessionId: string;

  const audio = {
    blob: new Blob([new Uint8Array(64)], { type: "audio/webm" }),
    mimeType: "audio/webm",
    extension: "webm" as const,
  };

  const guardarTramo = (seq: number, conAudio: boolean) =>
    saveTranscriptSegment(ana.client, {
      listenSessionId: sessionId,
      clinicId: ana.clinicId,
      seq,
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      text: "Ladra todos los días",
      quality: "ok",
      audioPath: conAudio ? rutaAudio(ana.clinicId, sessionId, seq, "webm") : undefined,
    });

  beforeAll(async () => {
    ana = await signedInVeterinarian(ANA);
    bruno = await signedInVeterinarian(BRUNO);
    const consultationId = await nuevaConsultaVoz(ana);
    sessionId = (await startListenSession(ana.client, { clinicId: ana.clinicId, consultationId }))
      .id;
  });

  test("el audio se sube a la ruta de un tramo aceptado y otro veterinario de la clínica lo lee", async () => {
    const tramo = await guardarTramo(0, true);
    expect(tramo.audioPath).toBe(rutaAudio(ana.clinicId, sessionId, 0, "webm"));
    await subirAudio(ana.client, tramo.audioPath as string, audio);

    const { data, error } = await bruno.client.storage
      .from(AUDIO_BUCKET)
      .download(tramo.audioPath as string);
    expect(error).toBeNull();
    expect(data?.size).toBe(64);
  });

  test("sin un tramo con esa ruta no se sube audio (nada huérfano)", async () => {
    await expect(
      subirAudio(ana.client, rutaAudio(ana.clinicId, sessionId, 99, "webm"), audio),
    ).rejects.toThrow(/conservar el audio/i);
  });

  test("el audio no se sobrescribe ni se borra por la API (es evidencia)", async () => {
    const tramo = await guardarTramo(1, true);
    const path = tramo.audioPath as string;
    await subirAudio(ana.client, path, audio);

    await expect(subirAudio(ana.client, path, audio)).rejects.toThrow(/conservar el audio/i);
    const borrado = await ana.client.storage.from(AUDIO_BUCKET).remove([path]);
    expect(borrado.data ?? []).toHaveLength(0);
    const { error } = await ana.client.storage.from(AUDIO_BUCKET).download(path);
    expect(error).toBeNull();
  });

  test("un audio_path que no es el del tramo se rechaza en el servidor", async () => {
    await expect(
      saveTranscriptSegment(ana.client, {
        listenSessionId: sessionId,
        clinicId: ana.clinicId,
        seq: 5,
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        text: "x",
        quality: "ok",
        audioPath: rutaAudio(ana.clinicId, sessionId, 6, "webm"),
      }),
    ).rejects.toThrow(/AUDIO_PATH_INVALID/);
  });
});
