import { describe, expect, test } from "bun:test";
import {
  handleTranscribeAudio,
  MAX_AUDIO_BYTES,
  TranscriptionTimeoutError,
} from "../../../supabase/functions/transcribe-audio/handler";

const URL_FUNCION = "http://localhost:54321/functions/v1/transcribe-audio";
const SESION = "59999999-0000-4000-8000-000000000001";
const CLAVE_SECRETA = "sk-test-secreta-no-debe-filtrarse";

type Opciones = {
  autoriza?: boolean;
  texto?: string;
  falla?: Error;
};

function harness({ autoriza = true, texto = "Ladra todos los días", falla }: Opciones = {}) {
  const lineas: string[] = [];
  const llamadas = { autorizar: 0, transcribir: 0 };
  return {
    lineas,
    llamadas,
    deps: {
      log: (linea: string) => {
        lineas.push(linea);
      },
      randomId: () => "id-generado",
      canTranscribe: async () => {
        llamadas.autorizar += 1;
        return autoriza;
      },
      transcribe: async () => {
        llamadas.transcribir += 1;
        if (falla) throw falla;
        return texto;
      },
    },
  };
}

function peticion({
  audio = new Blob([new Uint8Array(1024)], { type: "audio/webm;codecs=opus" }),
  sesion = SESION as string | null,
  conAuth = true,
  metodo = "POST",
}: {
  audio?: Blob | null;
  sesion?: string | null;
  conAuth?: boolean;
  metodo?: string;
} = {}) {
  const form = new FormData();
  // El runtime deduce el tipo de la extensión del archivo: el nombre acompaña al tipo.
  if (audio) form.set("audio", audio, audio.type.startsWith("text") ? "tramo.txt" : "tramo.webm");
  if (sesion !== null) form.set("listeningSessionId", sesion);
  return new Request(URL_FUNCION, {
    method: metodo,
    headers: conAuth ? { Authorization: "Bearer jwt-de-prueba" } : {},
    body: metodo === "POST" ? form : undefined,
  });
}

describe("transcribe-audio · handler", () => {
  test("transcribe un tramo válido y devuelve texto con calidad ok", async () => {
    const h = harness();
    const res = await handleTranscribeAudio(peticion(), h.deps);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      text: "Ladra todos los días",
      quality: "ok",
      requestId: "id-generado",
    });
  });

  test("responde 405 a un método distinto de POST y 200 al preflight", async () => {
    const h = harness();
    expect((await handleTranscribeAudio(peticion({ metodo: "GET" }), h.deps)).status).toBe(405);
    expect((await handleTranscribeAudio(peticion({ metodo: "OPTIONS" }), h.deps)).status).toBe(200);
    expect(h.llamadas.transcribir).toBe(0);
  });

  test("sin Authorization responde 401 sin consultar ni llamar al proveedor", async () => {
    const h = harness();
    const res = await handleTranscribeAudio(peticion({ conAuth: false }), h.deps);
    expect(res.status).toBe(401);
    expect(h.llamadas).toEqual({ autorizar: 0, transcribir: 0 });
  });

  test("entradas inválidas responden 400 sin llamar al proveedor", async () => {
    for (const caso of [
      peticion({ sesion: "no-es-uuid" }),
      peticion({ sesion: null }),
      peticion({ audio: null }),
      peticion({ audio: new Blob([new Uint8Array(10)], { type: "text/plain" }) }),
    ]) {
      const h = harness();
      const res = await handleTranscribeAudio(caso, h.deps);
      expect(res.status).toBe(400);
      expect(h.llamadas.transcribir).toBe(0);
    }
  });

  test("un audio mayor al máximo responde 413 sin llamar al proveedor", async () => {
    const h = harness();
    const grande = new Blob([new Uint8Array(MAX_AUDIO_BYTES + 1)], { type: "audio/webm" });
    const res = await handleTranscribeAudio(peticion({ audio: grande }), h.deps);
    expect(res.status).toBe(413);
    expect(h.llamadas.transcribir).toBe(0);
  });

  test("FR-014: sesión ajena, cerrada o de consulta cerrada responde 403 sin llamar al proveedor", async () => {
    const h = harness({ autoriza: false });
    const res = await handleTranscribeAudio(peticion(), h.deps);
    expect(res.status).toBe(403);
    expect(h.llamadas).toEqual({ autorizar: 1, transcribir: 0 });
  });

  test("FR-055: el tiempo máximo del proveedor responde 504 y el error 502", async () => {
    const lento = harness({ falla: new TranscriptionTimeoutError() });
    expect((await handleTranscribeAudio(peticion(), lento.deps)).status).toBe(504);
    const roto = harness({ falla: new Error("proveedor caído") });
    expect((await handleTranscribeAudio(peticion(), roto.deps)).status).toBe(502);
  });

  test("FR-031: vacío, ruido o solo puntuación marcan la calidad como insufficient", async () => {
    for (const texto of ["", "  ", "...", "¿?", "ah"]) {
      const h = harness({ texto });
      const body = (await (await handleTranscribeAudio(peticion(), h.deps)).json()) as {
        quality: string;
      };
      expect(body.quality).toBe("insufficient");
    }
  });

  test("Principio V/IV: no registra audio ni texto ni la credencial", async () => {
    const h = harness({ falla: new Error(`fallo con ${CLAVE_SECRETA}`) });
    const res = await handleTranscribeAudio(peticion(), h.deps);
    const ok = harness({ texto: "Texto clínico confidencial" });
    await handleTranscribeAudio(peticion(), ok.deps);
    const todo = [...h.lineas, ...ok.lineas].join("\n") + (await res.text());
    expect(todo).not.toContain(CLAVE_SECRETA);
    expect(todo).not.toContain("Texto clínico confidencial");
    expect(ok.lineas.length).toBeGreaterThan(0);
  });
});
