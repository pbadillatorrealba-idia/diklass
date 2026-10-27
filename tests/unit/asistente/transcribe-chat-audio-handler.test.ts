import { describe, expect, test } from "bun:test";
import { TranscriptionTimeoutError } from "../../../supabase/functions/_shared/transcription";
import {
  handleTranscribeChatAudio,
  MAX_CHAT_AUDIO_BYTES,
} from "../../../supabase/functions/transcribe-chat-audio/handler";

const URL_FUNCION = "http://localhost:54321/functions/v1/transcribe-chat-audio";
const CLAVE_SECRETA = "sk-test-secreta-no-debe-filtrarse";

type Opciones = { autoriza?: boolean; texto?: string; falla?: Error };

function harness({
  autoriza = true,
  texto = "Dosis de meloxicam en perros",
  falla,
}: Opciones = {}) {
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
      // El usuario está autenticado y tiene acceso activo en su clínica (sin sesión de escucha).
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
  conAuth = true,
  metodo = "POST",
}: {
  audio?: Blob | null;
  conAuth?: boolean;
  metodo?: string;
} = {}) {
  const form = new FormData();
  if (audio)
    form.set("audio", audio, audio.type.startsWith("text") ? "mensaje.txt" : "mensaje.webm");
  return new Request(URL_FUNCION, {
    method: metodo,
    headers: conAuth ? { Authorization: "Bearer jwt-de-prueba" } : {},
    body: metodo === "POST" ? form : undefined,
  });
}

// asistente-conversacional «Transcripción del audio del chat» (design.md D5 · tarea 7.1).
describe("transcribe-chat-audio · handler", () => {
  test("transcribe un mensaje válido sin necesitar una sesión de escucha", async () => {
    const h = harness();
    const res = await handleTranscribeChatAudio(peticion(), h.deps);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      text: "Dosis de meloxicam en perros",
      quality: "ok",
      requestId: "id-generado",
    });
  });

  test("405 a un método distinto de POST y 200 al preflight", async () => {
    const h = harness();
    expect((await handleTranscribeChatAudio(peticion({ metodo: "GET" }), h.deps)).status).toBe(405);
    expect((await handleTranscribeChatAudio(peticion({ metodo: "OPTIONS" }), h.deps)).status).toBe(
      200,
    );
    expect(h.llamadas.transcribir).toBe(0);
  });

  test("sin Authorization responde 401 sin consultar ni llamar al proveedor", async () => {
    const h = harness();
    const res = await handleTranscribeChatAudio(peticion({ conAuth: false }), h.deps);
    expect(res.status).toBe(401);
    expect(h.llamadas).toEqual({ autorizar: 0, transcribir: 0 });
  });

  test("un usuario sin acceso activo responde 403 sin llamar al proveedor (falla cerrado)", async () => {
    const h = harness({ autoriza: false });
    const res = await handleTranscribeChatAudio(peticion(), h.deps);
    expect(res.status).toBe(403);
    expect(h.llamadas).toEqual({ autorizar: 1, transcribir: 0 });
  });

  test("si la comprobación de acceso falla, no se envía audio al proveedor", async () => {
    const h = harness();
    h.deps.canTranscribe = async () => {
      throw new Error("base caída");
    };
    const res = await handleTranscribeChatAudio(peticion(), h.deps);
    expect(res.status).toBe(403);
    expect(h.llamadas.transcribir).toBe(0);
  });

  test.each([
    ["sin audio", { audio: null }],
    ["un tipo que no es audio", { audio: new Blob([new Uint8Array(10)], { type: "text/plain" }) }],
  ])("entrada inválida (%s) responde 400 sin llamar al proveedor", async (_nombre, over) => {
    const h = harness();
    const res = await handleTranscribeChatAudio(peticion(over), h.deps);
    expect(res.status).toBe(400);
    expect(h.llamadas.transcribir).toBe(0);
  });

  test.each([
    ["audio/webm", "webm"],
    ["audio/mp4", "mp4"],
    ["audio/m4a", "m4a"],
  ])("acepta el contenedor %s", async (tipo) => {
    const h = harness();
    const res = await handleTranscribeChatAudio(
      peticion({ audio: new Blob([new Uint8Array(1024)], { type: tipo }) }),
      h.deps,
    );
    expect(res.status).toBe(200);
  });

  // Los 2 min se imponen por tamaño: la duración que declara el cliente no es un control de confianza.
  test("el tope es por bytes: un audio mayor al máximo responde 413 sin llamar al proveedor", async () => {
    const h = harness();
    const grande = new Blob([new Uint8Array(MAX_CHAT_AUDIO_BYTES + 1)], { type: "audio/webm" });
    const res = await handleTranscribeChatAudio(peticion({ audio: grande }), h.deps);
    expect(res.status).toBe(413);
    expect(h.llamadas.transcribir).toBe(0);
  });

  test("un audio justo en el máximo se acepta", async () => {
    const h = harness();
    const justo = new Blob([new Uint8Array(MAX_CHAT_AUDIO_BYTES)], { type: "audio/webm" });
    expect((await handleTranscribeChatAudio(peticion({ audio: justo }), h.deps)).status).toBe(200);
  });

  test("la duración declarada por el cliente no cambia el límite", async () => {
    const h = harness();
    const form = new FormData();
    form.set(
      "audio",
      new Blob([new Uint8Array(MAX_CHAT_AUDIO_BYTES + 1)], { type: "audio/webm" }),
      "m.webm",
    );
    form.set("durationMs", "1000");
    const res = await handleTranscribeChatAudio(
      new Request(URL_FUNCION, {
        method: "POST",
        headers: { Authorization: "Bearer x" },
        body: form,
      }),
      h.deps,
    );
    expect(res.status).toBe(413);
  });

  test("un Content-Length declarado mayor al máximo responde 413 sin leer el cuerpo", async () => {
    const h = harness();
    let leido = false;
    const real = peticion();
    const request = {
      method: "POST",
      headers: new Headers({
        Authorization: "Bearer x",
        "Content-Length": String(MAX_CHAT_AUDIO_BYTES * 2),
      }),
      formData: async () => {
        leido = true;
        return real.formData();
      },
    } as unknown as Request;
    const res = await handleTranscribeChatAudio(request, h.deps);
    expect(res.status).toBe(413);
    expect(leido).toBe(false);
    expect(h.llamadas).toEqual({ autorizar: 0, transcribir: 0 });
  });

  test("el tiempo máximo del proveedor responde 504 y otro error 502", async () => {
    const lento = harness({ falla: new TranscriptionTimeoutError() });
    expect((await handleTranscribeChatAudio(peticion(), lento.deps)).status).toBe(504);
    const roto = harness({ falla: new Error("proveedor caído") });
    expect((await handleTranscribeChatAudio(peticion(), roto.deps)).status).toBe(502);
  });

  test("vacío, ruido o solo puntuación marcan la calidad como insufficient", async () => {
    for (const texto of ["", "  ", "...", "¿?", "ah"]) {
      const h = harness({ texto });
      const body = (await (await handleTranscribeChatAudio(peticion(), h.deps)).json()) as {
        quality: string;
      };
      expect(body.quality).toBe("insufficient");
    }
  });

  // Constitución IV y Principio V: registros estructurados con requestId, sin audio ni transcripción.
  test("registra con requestId y nunca el audio, el texto ni la credencial", async () => {
    const falla = harness({ falla: new Error(`fallo con ${CLAVE_SECRETA}`) });
    const res = await handleTranscribeChatAudio(peticion(), falla.deps);
    const ok = harness({ texto: "Texto clínico confidencial" });
    await handleTranscribeChatAudio(peticion(), ok.deps);
    const todo = [...falla.lineas, ...ok.lineas].join("\n") + (await res.text());
    expect(todo).not.toContain(CLAVE_SECRETA);
    expect(todo).not.toContain("Texto clínico confidencial");
    expect(ok.lineas.length).toBeGreaterThan(0);
    for (const linea of ok.lineas) {
      expect(JSON.parse(linea)).toMatchObject({ requestId: "id-generado" });
    }
  });
});
