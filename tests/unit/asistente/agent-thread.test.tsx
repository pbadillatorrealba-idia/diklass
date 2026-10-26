import { describe, expect, mock, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

mock.module("@/features/clinical/use-veterinarian-display-name", () => ({
  useVeterinarianDisplayName: () => ({ data: "Dra. Ana Torres" }),
}));
const { AgentThread, AgentThreadView } = await import("@/components/asistente/agent-thread");
const { useAgentAvailability } = await import("@/features/asistente/agent-availability");

const render = (node: ReactNode) =>
  renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>{node}</QueryClientProvider>,
  );

const RESUMEN_1 = "Registrar «vocaliza de noche»";
const RESUMEN_2 = "Preguntar por el apetito";
const propuestas = [
  { id: "p1", summary: RESUMEN_1, origin: "Asistente de prueba" },
  { id: "p2", summary: RESUMEN_2, origin: "Asistente de prueba" },
];
const NO_DISPONIBLE = "El asistente conversacional no está disponible todavía";

// sistema-visual «Hilo del asistente reservado» (shell-asistente-tres-zonas, design.md D6): el
// agente es de un cambio futuro; hasta entonces el hilo declara que no está disponible y no simula.
describe("AgentThread sin agente", () => {
  test("la disponibilidad es siempre falsa mientras no exista un agente", () => {
    expect(useAgentAvailability()).toBe(false);
  });

  test("declara que no está disponible y no pinta ninguna respuesta ni propuesta", () => {
    const html = render(<AgentThread />);
    expect(html).toContain(NO_DISPONIBLE);
    expect(html).toContain('data-testid="agent-unavailable"');
    expect(html).not.toContain('data-testid="agent-proposal"');
    expect(html).not.toContain("Sugerencia del sistema");
    expect(html).not.toContain("Pensando");
  });

  test("aunque le lleguen estados o propuestas, sin agente no simula nada", () => {
    for (const state of ["idle", "thinking", "proposing", "error"] as const) {
      const html = render(
        <AgentThreadView
          available={false}
          errorMessage="fallo"
          onConfirm={() => {}}
          proposals={propuestas}
          state={state}
        />,
      );
      expect(html).toContain(NO_DISPONIBLE);
      expect(html).not.toContain(RESUMEN_1);
      expect(html).not.toContain("fallo");
    }
  });
});

// Con un agente falso, solo en la prueba, el hilo reserva los cuatro estados.
describe("AgentThreadView con agente (falso, solo en la prueba)", () => {
  const vista = (state: "idle" | "thinking" | "proposing" | "error") =>
    render(
      <AgentThreadView
        available
        errorMessage="No se pudo contactar al agente."
        onConfirm={() => {}}
        proposals={propuestas}
        state={state}
      />,
    );

  test("en espera: lo dice y no muestra propuestas", () => {
    const html = vista("idle");
    expect(html).toContain("En espera");
    expect(html).not.toContain(NO_DISPONIBLE);
    expect(html).not.toContain("Sugerencia del sistema");
  });

  test("pensando: lo anuncia con una región de estado", () => {
    const html = vista("thinking");
    expect(html).toContain("Pensando");
    expect(html).toContain('role="status"');
    expect(html).not.toContain("Sugerencia del sistema");
  });

  test("propone: cada propuesta es una sugerencia por confirmar", () => {
    const html = vista("proposing");
    expect(html.match(/data-testid="agent-proposal"/g)).toHaveLength(2);
    expect(html).toContain(RESUMEN_1);
    expect(html).toContain(RESUMEN_2);
    expect(html.match(/Sugerencia del sistema/g)?.length).toBeGreaterThanOrEqual(2);
  });

  test("error: lo dice con su motivo y no muestra propuestas", () => {
    const html = vista("error");
    expect(html).toContain("No se pudo contactar al agente.");
    expect(html).toContain('role="alert"');
    expect(html).not.toContain("Sugerencia del sistema");
  });
});
