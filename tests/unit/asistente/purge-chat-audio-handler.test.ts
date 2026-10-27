import { describe, expect, test } from "bun:test";
import {
  handlePurgeChatAudio,
  type PurgeDependencies,
} from "../../../supabase/functions/purge-chat-audio/handler";

const SECRETO = "secreto-compartido-de-la-purga";
const URL_FUNCION = "http://localhost:54321/functions/v1/purge-chat-audio";

type Cfg = {
  vencidos?: Array<{ message_id: string; audio_path: string }>;
  huerfanos?: string[];
  fallanRutas?: string[];
  listaFalla?: boolean;
};

function harness({
  vencidos = [],
  huerfanos = [],
  fallanRutas = [],
  listaFalla = false,
}: Cfg = {}) {
  const lineas: string[] = [];
  const llamadas = { borrados: [] as string[][], marcados: [] as string[][], listas: 0 };
  const deps: PurgeDependencies = {
    secret: SECRETO,
    log: (l) => {
      lineas.push(l);
    },
    randomId: () => "id-generado",
    listDue: async () => {
      llamadas.listas++;
      if (listaFalla) throw new Error("base caída");
      return vencidos;
    },
    listOrphans: async () => huerfanos,
    removeObjects: async (rutas) => {
      llamadas.borrados.push([...rutas]);
      return { failed: rutas.filter((r) => fallanRutas.includes(r)) };
    },
    markPurged: async (ids) => {
      llamadas.marcados.push([...ids]);
    },
  };
  return { deps, lineas, llamadas };
}

const peticion = (secreto: string | null = SECRETO, metodo = "POST") =>
  new Request(URL_FUNCION, {
    method: metodo,
    headers: secreto === null ? {} : { "x-purge-secret": secreto },
    body: metodo === "POST" ? "{}" : undefined,
  });

// asistente-conversacional «Acceso y purga del audio» y «Registro estructurado del chat»
// (design.md D6 · tarea 7.6a).
describe("purge-chat-audio · handler", () => {
  test("sin el secreto compartido se rechaza y no se borra nada", async () => {
    const h = harness({ vencidos: [{ message_id: "m1", audio_path: "c/a/m1.webm" }] });
    const res = await handlePurgeChatAudio(peticion(null), h.deps);
    expect(res.status).toBe(401);
    expect(h.llamadas.borrados).toEqual([]);
    expect(h.llamadas.listas).toBe(0);
  });

  test("con un secreto incorrecto se rechaza, sin importar su longitud", async () => {
    for (const malo of ["x", `${SECRETO}x`, SECRETO.slice(0, -1), ""]) {
      const h = harness();
      expect((await handlePurgeChatAudio(peticion(malo), h.deps)).status).toBe(401);
      expect(h.llamadas.listas).toBe(0);
    }
  });

  test("el JWT de un usuario no sirve: solo vale el secreto", async () => {
    const h = harness();
    const req = new Request(URL_FUNCION, {
      method: "POST",
      headers: { Authorization: "Bearer jwt-de-un-usuario" },
      body: "{}",
    });
    expect((await handlePurgeChatAudio(req, h.deps)).status).toBe(401);
  });

  test("sin secreto configurado la función no opera (falla cerrado)", async () => {
    const h = harness();
    h.deps.secret = "";
    expect((await handlePurgeChatAudio(peticion(""), h.deps)).status).toBe(503);
    expect((await handlePurgeChatAudio(peticion(SECRETO), h.deps)).status).toBe(503);
    expect(h.llamadas.listas).toBe(0);
  });

  test("405 a un método distinto de POST", async () => {
    const h = harness();
    expect((await handlePurgeChatAudio(peticion(SECRETO, "GET"), h.deps)).status).toBe(405);
  });

  test("borra el audio vencido y marca sus mensajes", async () => {
    const h = harness({
      vencidos: [
        { message_id: "m1", audio_path: "c/a/m1.webm" },
        { message_id: "m2", audio_path: "c/a/m2.m4a" },
      ],
    });
    const res = await handlePurgeChatAudio(peticion(), h.deps);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ due: 2, removed: 2, failed: 0, orphans: 0 });
    expect(h.llamadas.borrados[0]).toEqual(["c/a/m1.webm", "c/a/m2.m4a"]);
    expect(h.llamadas.marcados).toEqual([["m1", "m2"]]);
  });

  test("solo marca los mensajes cuyo objeto se pudo borrar (los demás se reintentan)", async () => {
    const h = harness({
      vencidos: [
        { message_id: "m1", audio_path: "c/a/m1.webm" },
        { message_id: "m2", audio_path: "c/a/m2.webm" },
      ],
      fallanRutas: ["c/a/m2.webm"],
    });
    const res = await handlePurgeChatAudio(peticion(), h.deps);
    expect(await res.json()).toMatchObject({ due: 2, removed: 1, failed: 1 });
    expect(h.llamadas.marcados).toEqual([["m1"]]);
  });

  test("barre también los objetos huérfanos, sin fila que marcar", async () => {
    const h = harness({ huerfanos: ["c/a/sin-mensaje.webm"] });
    const res = await handlePurgeChatAudio(peticion(), h.deps);
    expect(await res.json()).toMatchObject({ due: 0, orphans: 1 });
    expect(h.llamadas.borrados).toContainEqual(["c/a/sin-mensaje.webm"]);
    expect(h.llamadas.marcados).toEqual([]);
  });

  test("sin nada por purgar responde 200 con ceros y no llama a Storage", async () => {
    const h = harness();
    const res = await handlePurgeChatAudio(peticion(), h.deps);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ due: 0, removed: 0, failed: 0, orphans: 0 });
    expect(h.llamadas.borrados).toEqual([]);
  });

  test("si falla la lectura de lo pendiente responde 500 y lo registra, sin silenciarlo", async () => {
    const h = harness({ listaFalla: true });
    const res = await handlePurgeChatAudio(peticion(), h.deps);
    expect(res.status).toBe(500);
    expect(h.lineas.some((l) => l.includes("purge_chat_audio_failed"))).toBe(true);
  });

  // Constitución IV y Principio V: registro estructurado con requestId, cuántos objetos se eliminaron y
  // cuáles fallaron, sin secretos ni contenido.
  test("registra con requestId el total eliminado y los fallos, nunca el secreto", async () => {
    const h = harness({
      vencidos: [
        { message_id: "m1", audio_path: "c/a/m1.webm" },
        { message_id: "m2", audio_path: "c/a/m2.webm" },
      ],
      fallanRutas: ["c/a/m2.webm"],
    });
    const res = await handlePurgeChatAudio(peticion(), h.deps);
    const todo = h.lineas.join("\n") + (await res.text());
    expect(todo).not.toContain(SECRETO);
    const fin = h.lineas.map((l) => JSON.parse(l)).find((l) => l.event === "purge_chat_audio_done");
    expect(fin).toMatchObject({ requestId: "id-generado", due: 2, removed: 1, failed: 1 });
    expect(fin.failedMessageIds).toEqual(["m2"]);
  });

  test("un secreto rechazado también se registra (sin el secreto) para detectar abusos", async () => {
    const h = harness();
    await handlePurgeChatAudio(peticion("incorrecto"), h.deps);
    const linea = h.lineas
      .map((l) => JSON.parse(l))
      .find((l) => l.event === "purge_chat_audio_rejected");
    expect(linea).toMatchObject({ requestId: "id-generado", code: "UNAUTHENTICATED" });
    expect(h.lineas.join("\n")).not.toContain("incorrecto");
  });
});
