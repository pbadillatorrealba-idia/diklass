import { afterEach, describe, expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { ConocimientoThread } from "@/components/conocimiento/conocimiento-thread";
import {
  type TurnoConversacion,
  useConversationStore,
} from "@/features/conocimiento/conversation-store";
import type { KnowledgeAnswer } from "@/features/conocimiento/schema";

const respuesta: KnowledgeAnswer = {
  pregunta: "¿Qué revisar ante ansiedad por separación?",
  patientId: null,
  segmentos: [],
  cobertura: { estado: "sin_evidencia", cubiertos: [], noCubiertos: [] },
  avisos: ["sin_respaldo_documental"],
};

const render = () =>
  renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <ConocimientoThread />
    </QueryClientProvider>,
  );

// `renderToStaticMarkup` lee el estado *inicial* del almacén de Zustand (`getServerSnapshot`), no
// el actual: para que vea un turno se siembra ese objeto y se restaura después. No se sustituye el
// módulo (`mock.module` es global en Bun y rompería conversation-store.test.ts).
const inicial = useConversationStore.getInitialState();
const turnosIniciales = inicial.turnos;
const sembrar = (turno: TurnoConversacion) => {
  inicial.turnos = [turno];
};
afterEach(() => {
  inicial.turnos = turnosIniciales;
});

// sistema-visual «Conocimiento en el panel» (shell-asistente-tres-zonas, design.md D5): el hilo
// es la conversación de `/knowledge` sin cambiar su conducta, para usarla en el panel.
describe("ConocimientoThread", () => {
  test("ofrece la pregunta y la consulta, deshabilitada mientras no hay pregunta", () => {
    const html = render();
    expect(html).toContain('data-testid="conocimiento-pregunta"');
    expect(html).toContain('aria-label="Tu pregunta al asistente"');
    const boton = html.match(/<[^>]*data-testid="conocimiento-consultar"[^>]*>/)?.[0] ?? "";
    expect(boton).toContain('aria-disabled="true"');
    expect(html).toContain("Consultar");
  });

  test("sin turnos no muestra respuestas", () => {
    expect(render()).not.toContain('data-testid="turno-');
  });

  test("pinta los turnos de la conversación con su respuesta y «ver respaldo»", () => {
    sembrar({ id: "q1", pregunta: respuesta.pregunta, queryId: "q1", respuesta });
    const html = render();
    expect(html).toContain('data-testid="turno-q1"');
    expect(html).toContain(respuesta.pregunta);
    expect(html).toContain("No dispongo de evidencia documental para esta pregunta.");
    expect(html).toContain('data-testid="ver-respaldo-q1"');
    expect(html).toContain("Ver respaldo registrado");
  });

  test("un turno sin consulta registrada no ofrece «ver respaldo»", () => {
    sembrar({ id: "q2", pregunta: respuesta.pregunta, queryId: null, respuesta });
    expect(render()).not.toContain("ver-respaldo-q2");
  });
});
