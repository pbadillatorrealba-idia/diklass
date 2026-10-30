import { describe, expect, test } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SyntheticCaptureSource } from "@/features/voz/capture-source";
import { crearEntradas, esModoReal, ventanaMs } from "@/features/voz/listen-mode-inputs";
import { MicrophoneCaptureSource } from "@/features/voz/microphone-capture-source";
import {
  RemoteTranscriptionAdapter,
  type TranscribeClient,
} from "@/features/voz/remote-transcription-adapter";
import { SimulatedTranscriptionAdapter } from "@/features/voz/transcription-port";
import type { Database } from "@/lib/supabase/database.types";

const client = {
  functions: { invoke: async () => ({ data: null, error: null }) },
} as unknown as SupabaseClient<Database> & TranscribeClient;

describe("selección del modo de escucha (D1)", () => {
  test("solo 'real' activa el modo real; cualquier otro valor mantiene el simulado", () => {
    expect(esModoReal("real")).toBe(true);
    for (const valor of [undefined, "", "simulado", "REAL", "true"]) {
      expect(esModoReal(valor)).toBe(false);
    }
  });

  test("simulado: guion sintético, sin micrófono ni envío a terceros", () => {
    const { source, transcription } = crearEntradas(false, client, "sesion-1");
    expect(source).toBeInstanceOf(SyntheticCaptureSource);
    expect(transcription).toBeInstanceOf(SimulatedTranscriptionAdapter);
  });

  test("real: micrófono y transcripción remota", () => {
    const { source, transcription } = crearEntradas(true, client, "sesion-1");
    expect(source).toBeInstanceOf(MicrophoneCaptureSource);
    expect(transcription).toBeInstanceOf(RemoteTranscriptionAdapter);
  });

  test("la duración de la ventana es opcional: vacía, inválida o no positiva usa el valor por defecto", () => {
    expect(ventanaMs("5000")).toBe(5000);
    for (const valor of [undefined, "", "abc", "0", "-10", "1.5e400"]) {
      expect(ventanaMs(valor)).toBeUndefined();
    }
  });
});
