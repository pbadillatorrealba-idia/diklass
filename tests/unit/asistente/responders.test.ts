import { describe, expect, test } from "bun:test";
import type { Message, Part } from "@/features/asistente/chat-model";
import {
  BasicResponder,
  KnowledgeResponder,
  type Responder,
  type ResponseEvent,
  routeResponder,
} from "@/features/asistente/responders";

const NOW = new Date(2026, 9, 26, 10, 0);
const sinHistorial: Message[] = [];
const entrada = (text: string, patientId: string | null = null) => ({ text, patientId });

async function recoger(iterable: AsyncIterable<ResponseEvent>): Promise<ResponseEvent[]> {
  const eventos: ResponseEvent[] = [];
  for await (const evento of iterable) eventos.push(evento);
  return eventos;
}
const textoListo = (eventos: ResponseEvent[]) => {
  const listo = eventos.find((evento) => evento.type === "ready");
  return listo?.type === "ready" ? listo.parts : [];
};

const basico = (over: Partial<ConstructorParameters<typeof BasicResponder>[0]> = {}) =>
  new BasicResponder({
    now: () => NOW,
    events: () => [],
    pacientesDeHoy: async () => "Pacientes con consulta hoy:\n• Bruma",
    ...over,
  });

// asistente-conversacional «Respuesta entera y estado Pensando» y «Consultas básicas» (design.md D2).
describe("BasicResponder", () => {
  test("responde la fecha con un único evento «listo»", async () => {
    const eventos = await recoger(
      basico().respond(sinHistorial, entrada("¿Qué día es hoy?"), new AbortController().signal),
    );
    expect(eventos).toHaveLength(1);
    expect(textoListo(eventos)).toEqual([{ type: "text", text: expect.stringMatching(/Hoy es/) }]);
  });

  test("sin eventos dice que no hay agenda", async () => {
    const eventos = await recoger(
      basico().respond(
        sinHistorial,
        entrada("¿Qué eventos tengo agendados?"),
        new AbortController().signal,
      ),
    );
    expect(JSON.stringify(textoListo(eventos))).toContain("No tienes eventos agendados");
  });

  test("pacientes de hoy usa la consulta inyectada", async () => {
    const eventos = await recoger(
      basico().respond(
        sinHistorial,
        entrada("¿Cuáles son los pacientes de hoy?"),
        new AbortController().signal,
      ),
    );
    expect(JSON.stringify(textoListo(eventos))).toContain("Bruma");
  });

  test("«Detener» antes de que llegue la respuesta no emite nada", async () => {
    const control = new AbortController();
    const respondedor = basico({
      pacientesDeHoy: async () => {
        control.abort();
        return "tarde";
      },
    });
    const eventos = await recoger(
      respondedor.respond(
        sinHistorial,
        entrada("¿Cuáles son los pacientes de hoy?"),
        control.signal,
      ),
    );
    expect(eventos).toEqual([]);
  });
});

describe("KnowledgeResponder", () => {
  const respuesta = {
    queryId: "q1",
    answer: { pregunta: "p", patientId: null, segmentos: [], cobertura: {}, avisos: [] } as never,
  };

  test("consulta con el paciente de contexto y devuelve una parte de conocimiento", async () => {
    const llamadas: Array<[string, string | null]> = [];
    const respondedor = new KnowledgeResponder({
      consult: async (pregunta, patientId) => {
        llamadas.push([pregunta, patientId]);
        return respuesta;
      },
    });
    const eventos = await recoger(
      respondedor.respond(
        sinHistorial,
        entrada("¿dosis de meloxicam?", "bruma"),
        new AbortController().signal,
      ),
    );
    expect(llamadas).toEqual([["¿dosis de meloxicam?", "bruma"]]);
    expect(textoListo(eventos)).toEqual([
      { type: "knowledge", queryId: "q1", answer: respuesta.answer },
    ]);
  });

  test("«Detener» descarta la respuesta pero la consulta ya lanzada se registró (FR-020)", async () => {
    const control = new AbortController();
    let registrada = false;
    const respondedor = new KnowledgeResponder({
      consult: async () => {
        registrada = true;
        control.abort();
        return respuesta;
      },
    });
    const eventos = await recoger(
      respondedor.respond(sinHistorial, entrada("¿dosis?"), control.signal),
    );
    expect(registrada).toBe(true);
    expect(eventos).toEqual([]);
  });

  test("un fallo de la consulta se propaga para que el mensaje quede en error", async () => {
    const respondedor = new KnowledgeResponder({
      consult: async () => {
        throw new Error("sin red");
      },
    });
    await expect(
      recoger(respondedor.respond(sinHistorial, entrada("¿dosis?"), new AbortController().signal)),
    ).rejects.toThrow("sin red");
  });
});

describe("routeResponder", () => {
  const marcado = (nombre: string): Responder => ({
    async *respond() {
      yield { type: "ready", parts: [{ type: "text", text: nombre }] satisfies Part[] };
    },
  });

  test.each([
    ["¿Qué día es hoy?", "basico"],
    ["¿Cuáles son los pacientes de hoy?", "basico"],
    ["¿Cuál es la dosis diaria de meloxicam?", "conocimiento"],
    ["¿Eventos adversos de meloxicam?", "conocimiento"],
  ])("«%s» → %s", async (pregunta, esperado) => {
    const router = routeResponder({
      basico: marcado("basico"),
      conocimiento: marcado("conocimiento"),
    });
    const eventos = await recoger(
      router.respond(sinHistorial, entrada(pregunta), new AbortController().signal),
    );
    expect(textoListo(eventos)).toEqual([{ type: "text", text: esperado }]);
  });

  test("un respondedor que emite por trozos se reenvía tal cual (para el agente con streaming)", async () => {
    const porTrozos: Responder = {
      async *respond() {
        yield { type: "delta", text: "ho" };
        yield { type: "delta", text: "la" };
        yield { type: "ready", parts: [{ type: "text", text: "hola" }] };
      },
    };
    const router = routeResponder({ basico: marcado("b"), conocimiento: porTrozos });
    const eventos = await recoger(
      router.respond(sinHistorial, entrada("¿dosis?"), new AbortController().signal),
    );
    expect(eventos.map((evento) => evento.type)).toEqual(["delta", "delta", "ready"]);
  });
});

describe("AgentResponder", () => {
  const { AgentResponder, routeAgent } = require("@/features/asistente/responders");
  const stub = (parts: string) => ({
    respond: async function* () {
      yield { type: "ready", parts: [{ type: "text", text: parts }] };
    },
  });

  test("navega solo a rutas permitidas y responde con el texto", async () => {
    const nav: string[] = [];
    const r = new AgentResponder({
      invoke: async () => ({
        text: "ok",
        ui: [
          { type: "navigate", path: "/patients" },
          { type: "navigate", path: "/evil" },
        ],
      }),
      navigate: (p: string) => nav.push(p),
    });
    const out = [];
    for await (const e of r.respond(
      [],
      { text: "abre", patientId: null },
      new AbortController().signal,
    ))
      out.push(e);
    expect(nav).toEqual(["/patients"]);
    expect(out).toEqual([{ type: "ready", parts: [{ type: "text", text: "ok" }] }]);
  });

  test("enruta lo básico al local y el resto al agente", async () => {
    const r = routeAgent({ basico: stub("basico"), agente: stub("agente") });
    const get = async (text: string) => {
      for await (const e of r.respond([], { text, patientId: null }, new AbortController().signal))
        return e.parts[0].text;
    };
    expect(await get("qué día es hoy")).toBe("basico");
    expect(await get("busca a Bruma")).toBe("agente");
  });
});
