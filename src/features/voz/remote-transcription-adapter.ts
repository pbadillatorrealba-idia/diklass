import { z } from "zod";
import type {
  AudioWindow,
  TranscriptionPort,
  TranscriptResult,
} from "@/features/voz/transcription-port";

/** Tiempo máximo de la petición: la función ya corta al proveedor a los 20 s (D3). */
export const TRANSCRIBE_TIMEOUT_MS = 30_000;

type FunctionError = { message: string; context?: { json: () => Promise<unknown> } };

/** Lo que usa del cliente de Supabase: facilita el doble en pruebas. */
export type TranscribeClient = {
  functions: {
    invoke: (
      name: string,
      options: { body: FormData; timeout: number },
    ) => Promise<{ data: unknown; error: FunctionError | null }>;
  };
};

const respuestaSchema = z.object({
  text: z.string(),
  quality: z.enum(["ok", "insufficient"]),
});

/** El motivo legible del fallo: el `code` de la función o, si no hay cuerpo, el mensaje del cliente. */
async function motivo(error: FunctionError): Promise<string> {
  try {
    const cuerpo = (await error.context?.json()) as { code?: string } | undefined;
    if (cuerpo?.code) return cuerpo.code;
  } catch {
    // Sin cuerpo legible (red caída, preflight): vale el mensaje del cliente.
  }
  return error.message;
}

/**
 * Transcripción real (D3 del cambio implementar-asr-real-captura-voz, FR-015): envía la ventana a
 * la Edge Function `transcribe-audio`, que es la única que conoce la credencial del proveedor.
 * Todo fallo se propaga con su motivo; la tubería descarta el tramo (FR-055).
 */
export class RemoteTranscriptionAdapter implements TranscriptionPort {
  readonly #client: TranscribeClient;

  constructor(client: TranscribeClient) {
    this.#client = client;
  }

  async transcribe(window: AudioWindow): Promise<TranscriptResult> {
    if (!window.audio) {
      // Constitución IV: una ventana sin audio no se transcribe «en silencio».
      throw new Error(`La ventana ${window.seq} llegó sin audio para transcribir.`);
    }
    const body = new FormData();
    body.set("audio", window.audio.blob, `tramo-${window.seq}.${window.audio.extension}`);
    body.set("listeningSessionId", window.listenSessionId);

    const { data, error } = await this.#client.functions.invoke("transcribe-audio", {
      body,
      timeout: TRANSCRIBE_TIMEOUT_MS,
    });
    if (error) {
      throw new Error(`No se pudo transcribir el tramo ${window.seq}: ${await motivo(error)}`);
    }
    return respuestaSchema.parse(data);
  }
}
