import { describe, expect, test } from "bun:test";
import {
  borrarAudioChat,
  CHAT_AUDIO_BUCKET,
  firmarAudioChat,
  quitarAudio,
  rutaAudioChat,
  rutasDeAudio,
  subirAudioChat,
  transcribirAudioChat,
} from "@/features/asistente/voice-message-service";
import type { AudioPayload } from "@/features/voz/transcription-port";

const PAYLOAD: AudioPayload = {
  data: new ArrayBuffer(16),
  mimeType: "audio/webm",
  extension: "webm",
};

function storageFalso(over: { falla?: string; borrados?: string[] } = {}) {
  const llamadas: Array<{ op: string; args: unknown[] }> = [];
  const cliente = {
    storage: {
      from: (bucket: string) => ({
        upload: async (...args: unknown[]) => {
          llamadas.push({ op: `upload:${bucket}`, args });
          return { error: over.falla ? { message: over.falla } : null };
        },
        remove: async (...args: unknown[]) => {
          llamadas.push({ op: `remove:${bucket}`, args });
          return { data: (args[0] as string[]).map((name) => ({ name })), error: null };
        },
      }),
    },
  };
  return { cliente: cliente as never, llamadas };
}

// asistente-conversacional «Grabar, revisar y enviar audio» y «Transcripción del audio del chat»
// (design.md D5 · tarea 7.5).
describe("rutaAudioChat", () => {
  test("es la ruta canónica que exige la migración 023", () => {
    expect(rutaAudioChat("c1", "a1", "m1", "webm")).toBe("c1/a1/m1.webm");
    expect(rutaAudioChat("c1", "a1", "m1", "m4a")).toBe("c1/a1/m1.m4a");
  });
});

describe("subirAudioChat", () => {
  test("sube al bucket del chat sin sobrescribir", async () => {
    const { cliente, llamadas } = storageFalso();
    await subirAudioChat(cliente, "c1/a1/m1.webm", PAYLOAD);
    expect(llamadas[0]?.op).toBe(`upload:${CHAT_AUDIO_BUCKET}`);
    expect(llamadas[0]?.args[0]).toBe("c1/a1/m1.webm");
    expect(llamadas[0]?.args[2]).toEqual({ contentType: "audio/webm", upsert: false });
  });

  test("un error de Storage se propaga con su motivo", async () => {
    const { cliente } = storageFalso({ falla: "Payload too large" });
    await expect(subirAudioChat(cliente, "c1/a1/m1.webm", PAYLOAD)).rejects.toThrow(
      "Payload too large",
    );
  });
});

describe("borrarAudioChat", () => {
  test("borra los objetos pedidos", async () => {
    const { cliente, llamadas } = storageFalso();
    await borrarAudioChat(cliente, ["c1/a1/m1.webm", "c1/a1/m2.m4a"]);
    expect(llamadas[0]).toEqual({
      op: `remove:${CHAT_AUDIO_BUCKET}`,
      args: [["c1/a1/m1.webm", "c1/a1/m2.m4a"]],
    });
  });

  test("sin rutas no llama a Storage", async () => {
    const { cliente, llamadas } = storageFalso();
    await borrarAudioChat(cliente, []);
    expect(llamadas).toEqual([]);
  });

  // `storage.remove` devuelve `{ error }` en vez de lanzar: sin mirarlo, un borrado fallido pasaba en silencio.
  test("un error devuelto por Storage (sin lanzar) se reporta y no se propaga", async () => {
    const errores: unknown[] = [];
    const cliente = {
      storage: {
        from: () => ({ remove: async () => ({ data: null, error: { message: "denied" } }) }),
      },
    } as never;
    await expect(borrarAudioChat(cliente, ["x"], (e) => errores.push(e))).resolves.toBeUndefined();
    expect(errores).toHaveLength(1);
  });

  test("una excepción de red también se reporta", async () => {
    const errores: unknown[] = [];
    const cliente = {
      storage: {
        from: () => ({
          remove: async () => {
            throw new Error("red caída");
          },
        }),
      },
    } as never;
    await borrarAudioChat(cliente, ["x"], (e) => errores.push(e));
    expect(errores).toHaveLength(1);
  });

  test("un borrado correcto no reporta nada", async () => {
    const errores: unknown[] = [];
    const { cliente } = storageFalso();
    await borrarAudioChat(cliente, ["x"], (e) => errores.push(e));
    expect(errores).toEqual([]);
  });

  test("es de mejor esfuerzo: un fallo no se propaga (la purga barre lo que quede)", async () => {
    const cliente = {
      storage: {
        from: () => ({
          remove: async () => {
            throw new Error("red caída");
          },
        }),
      },
    } as never;
    await expect(borrarAudioChat(cliente, ["x"])).resolves.toBeUndefined();
  });
});

describe("transcribirAudioChat", () => {
  const cliente = (resultado: { data?: unknown; error?: { message: string } | null }) => {
    const visto: { name?: string; body?: FormData } = {};
    return {
      visto,
      client: {
        functions: {
          invoke: async (name: string, options: { body: FormData }) => {
            visto.name = name;
            visto.body = options.body;
            return { data: resultado.data ?? null, error: resultado.error ?? null };
          },
        },
      } as never,
    };
  };

  test("invoca transcribe-chat-audio con el audio y devuelve texto y calidad", async () => {
    const { client, visto } = cliente({ data: { text: "hola", quality: "ok", requestId: "r" } });
    const respuesta = await transcribirAudioChat(client, PAYLOAD);
    expect(respuesta).toEqual({ text: "hola", quality: "ok" });
    expect(visto.name).toBe("transcribe-chat-audio");
    expect(visto.body?.get("audio")).toBeTruthy();
    // El chat no manda sesión de escucha.
    expect(visto.body?.get("listeningSessionId")).toBeNull();
  });

  test("una calidad insuficiente se devuelve tal cual, sin lanzar", async () => {
    const { client } = cliente({ data: { text: "", quality: "insufficient" } });
    expect((await transcribirAudioChat(client, PAYLOAD)).quality).toBe("insufficient");
  });

  test("un error de la función se propaga con su motivo", async () => {
    const { client } = cliente({ error: { message: "PROVIDER_TIMEOUT" } });
    await expect(transcribirAudioChat(client, PAYLOAD)).rejects.toThrow("PROVIDER_TIMEOUT");
  });

  test("una respuesta con otra forma se rechaza (Constitución: validar en la frontera)", async () => {
    const { client } = cliente({ data: { texto: "hola" } });
    await expect(transcribirAudioChat(client, PAYLOAD)).rejects.toThrow();
  });
});

describe("firmarAudioChat", () => {
  test("firma una URL de corta vida", async () => {
    let visto: unknown[] = [];
    const cliente = {
      storage: {
        from: (bucket: string) => ({
          createSignedUrl: async (...args: unknown[]) => {
            visto = [bucket, ...args];
            return { data: { signedUrl: "https://x/y?token=1" }, error: null };
          },
        }),
      },
    } as never;
    expect(await firmarAudioChat(cliente, "c1/a1/m1.webm")).toBe("https://x/y?token=1");
    expect(visto).toEqual([CHAT_AUDIO_BUCKET, "c1/a1/m1.webm", 60]);
  });

  test("pasado el vencimiento Storage no firma: devuelve null y no lanza", async () => {
    const cliente = {
      storage: {
        from: () => ({
          createSignedUrl: async () => ({ data: null, error: { message: "Object not found" } }),
        }),
      },
    } as never;
    expect(await firmarAudioChat(cliente, "c1/a1/m1.webm")).toBeNull();
  });
});

describe("quitarAudio (Eliminar audio)", () => {
  test("pide la ruta a la RPC y borra el objeto", async () => {
    const borrados: string[][] = [];
    const cliente = {
      rpc: async (name: string, args: unknown) => {
        expect(name).toBe("remove_assistant_audio");
        expect(args).toEqual({ p_message_id: "m1" });
        return { data: "c1/a1/m1.webm", error: null };
      },
      storage: {
        from: () => ({
          remove: async (paths: string[]) => {
            borrados.push(paths);
            return { data: [], error: null };
          },
        }),
      },
    } as never;
    expect(await quitarAudio(cliente, "m1")).toBe(true);
    expect(borrados).toEqual([["c1/a1/m1.webm"]]);
  });

  test("si el mensaje no tenía audio (la RPC devuelve null) no borra nada", async () => {
    let llamado = false;
    const cliente = {
      rpc: async () => ({ data: null, error: null }),
      storage: {
        from: () => ({
          remove: async () => {
            llamado = true;
            return { data: [], error: null };
          },
        }),
      },
    } as never;
    expect(await quitarAudio(cliente, "m1")).toBe(false);
    expect(llamado).toBe(false);
  });

  test("un error de la RPC se propaga", async () => {
    const cliente = {
      rpc: async () => ({ data: null, error: { message: "ACCESS_SESSION_REQUIRED" } }),
    } as never;
    await expect(quitarAudio(cliente, "m1")).rejects.toThrow("ACCESS_SESSION_REQUIRED");
  });
});

describe("rutasDeAudio", () => {
  test("lee las rutas de audio de los mensajes del autor", async () => {
    const cliente = {
      from: () => ({
        select: () => ({
          not: async () => ({
            data: [{ audio_path: "c1/a1/m1.webm" }, { audio_path: "c1/a1/m2.m4a" }],
            error: null,
          }),
        }),
      }),
    } as never;
    expect(await rutasDeAudio(cliente)).toEqual(["c1/a1/m1.webm", "c1/a1/m2.m4a"]);
  });
});
