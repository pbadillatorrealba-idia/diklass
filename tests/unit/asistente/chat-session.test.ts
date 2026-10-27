import { beforeEach, describe, expect, test } from "bun:test";
import type { Message, Part } from "@/features/asistente/chat-model";
import { type ChatDeps, retryTurn, startTurn } from "@/features/asistente/chat-session";
import { useChatStore } from "@/features/asistente/chat-store";
import type { Responder } from "@/features/asistente/responders";

const store = () => useChatStore.getState();
let ids = 0;

function setup(over: Partial<ChatDeps> = {}) {
  const persistidos: Message[] = [];
  const errores: unknown[] = [];
  let autenticacion = 0;
  const responder: Responder = {
    async *respond(_h, input) {
      yield {
        type: "ready",
        parts: [{ type: "text", text: `eco: ${input.text}` }] satisfies Part[],
      };
    },
  };
  const deps: ChatDeps = {
    responder,
    persist: async (message) => {
      persistidos.push(message);
    },
    store: {
      addPending: (m) => store().addPending(m),
      setPendingStatus: (id, s) => store().setPendingStatus(id, s),
      removePending: (id) => store().removePending(id),
      addUnread: () => store().addUnread(),
    },
    getPending: () => store().pending,
    history: () => [],
    now: () => new Date("2026-10-27T15:00:00.000Z"),
    newId: () => `id-${++ids}`,
    isAuthRequired: (e) => (e as { auth?: boolean }).auth === true,
    onAuthRequired: () => {
      autenticacion++;
    },
    onError: (e) => {
      errores.push(e);
    },
    ...over,
  };
  return { deps, persistidos, errores, auth: () => autenticacion };
}
const senal = () => new AbortController().signal;

beforeEach(() => {
  store().reset();
  ids = 0;
});

// asistente-conversacional «Mensajes del chat», «Acciones del mensaje» y «Composer del chat».
describe("startTurn", () => {
  test("persiste la pregunta y la respuesta como mensajes terminales, en ese orden", async () => {
    const { deps, persistidos } = setup();
    await startTurn(deps, { text: "hola", patientId: "bruma" }, senal());
    expect(persistidos.map((m) => [m.role, m.status])).toEqual([
      ["user", "done"],
      ["assistant", "done"],
    ]);
    expect(persistidos[0]?.parts).toEqual([{ type: "text", text: "hola" }]);
    expect(persistidos[1]?.parts).toEqual([{ type: "text", text: "eco: hola" }]);
  });

  test("cada mensaje guarda el paciente vigente al enviarse", async () => {
    const { deps, persistidos } = setup();
    await startTurn(deps, { text: "hola", patientId: "bruma" }, senal());
    expect(persistidos.map((m) => m.patientId)).toEqual(["bruma", "bruma"]);
  });

  test("mientras responde hay un mensaje «enviando»/«pensando» y al terminar no queda ninguno", async () => {
    let durante: Message[] = [];
    const { deps } = setup({
      responder: {
        async *respond() {
          durante = [...store().pending];
          yield { type: "ready", parts: [{ type: "text", text: "ok" }] };
        },
      },
    });
    await startTurn(deps, { text: "hola", patientId: null }, senal());
    expect(durante.map((m) => m.status)).toEqual(["sending", "thinking"]);
    expect(store().pending).toEqual([]);
  });

  test("una respuesta con el hilo fuera de vista sube el no leído", async () => {
    const { deps } = setup();
    await startTurn(deps, { text: "hola", patientId: null }, senal());
    expect(store().unread).toBe(1);
  });

  test("si el respondedor falla, la pregunta queda en error (sin persistir) para reintentar", async () => {
    const { deps, persistidos, errores } = setup({
      responder: {
        // biome-ignore lint/correctness/useYield: simula un fallo antes de responder
        async *respond() {
          throw new Error("sin red");
        },
      },
    });
    await startTurn(deps, { text: "hola", patientId: null }, senal());
    expect(persistidos).toEqual([]);
    expect(store().pending).toHaveLength(1);
    expect(store().pending[0]).toMatchObject({ role: "user", status: "error" });
    expect(errores).toHaveLength(1);
    expect(store().unread).toBe(0);
  });

  test("«Reintentar» reenvía la misma pregunta sin duplicarla", async () => {
    let falla = true;
    const { deps, persistidos } = setup({
      responder: {
        async *respond(_h, input) {
          if (falla) throw new Error("sin red");
          yield { type: "ready", parts: [{ type: "text", text: `eco: ${input.text}` }] };
        },
      },
    });
    await startTurn(deps, { text: "hola", patientId: null }, senal());
    const idPregunta = store().pending[0]?.id ?? "";
    falla = false;
    await retryTurn(deps, idPregunta, senal());
    expect(persistidos.filter((m) => m.role === "user")).toHaveLength(1);
    expect(persistidos.filter((m) => m.role === "user")[0]?.id).toBe(idPregunta);
    expect(store().pending).toEqual([]);
  });

  test("reintentar un mensaje que no está en error no hace nada", async () => {
    const { deps, persistidos } = setup();
    await retryTurn(deps, "no-existe", senal());
    expect(persistidos).toEqual([]);
  });

  test("«Detener» conserva la pregunta y descarta la respuesta", async () => {
    const control = new AbortController();
    const { deps, persistidos } = setup({
      responder: {
        async *respond() {
          control.abort();
          // el respondedor respeta la señal y no emite
        },
      },
    });
    await startTurn(deps, { text: "hola", patientId: null }, control.signal);
    expect(persistidos.map((m) => m.role)).toEqual(["user"]);
    expect(store().pending).toEqual([]);
    expect(store().unread).toBe(0);
  });

  test("si falla al persistir, la pregunta queda en error para reintentar", async () => {
    const { deps } = setup({
      persist: async () => {
        throw new Error("RLS");
      },
    });
    await startTurn(deps, { text: "hola", patientId: null }, senal());
    expect(store().pending.find((m) => m.role === "user")?.status).toBe("error");
  });

  test("si la sesión expiró avisa y no deja un error visible", async () => {
    const { deps, auth } = setup({
      responder: {
        // biome-ignore lint/correctness/useYield: simula sesión vencida
        async *respond() {
          throw { auth: true };
        },
      },
    });
    await startTurn(deps, { text: "hola", patientId: null }, senal());
    expect(auth()).toBe(1);
  });
});
