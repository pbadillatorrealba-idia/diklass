import { describe, expect, mock, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Attribution } from "@/lib/attribution/types";

// La insignia de atribución resuelve el nombre con Supabase: aquí solo importa que aparezca.
mock.module("@/features/clinical/use-veterinarian-display-name", () => ({
  useVeterinarianDisplayName: () => ({ data: "Dra. Ana Torres" }),
}));
const { AgentProposal } = await import("@/components/asistente/agent-proposal");

const propuesta = {
  id: "p1",
  summary: "Registrar «vocaliza de noche» como motivo de consulta",
  origin: "Asistente · lectura de la consulta abierta",
};

const render = (node: ReactNode) =>
  renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>{node}</QueryClientProvider>,
  );

/** Busca en el árbol de elementos el primero con ese `testID` (el componente no usa hooks). */
function encontrar(nodo: ReactNode, testID: string): ReactElement<Record<string, unknown>> | null {
  if (!isValidElement(nodo)) return null;
  const props = nodo.props as Record<string, unknown>;
  if (props.testID === testID) return nodo as ReactElement<Record<string, unknown>>;
  const hijos = props.children as ReactNode | ReactNode[] | undefined;
  for (const hijo of Array.isArray(hijos) ? hijos.flat(Infinity) : [hijos]) {
    const hallado = encontrar(hijo as ReactNode, testID);
    if (hallado) return hallado;
  }
  return null;
}

// sistema-visual «Las propuestas del agente exigen confirmación» (shell-asistente-tres-zonas, D6 ·
// FR-010 · FR-021 · FR-063 · FR-076).
describe("AgentProposal", () => {
  test("se pinta como sugerencia, con su origen y procedencia «Inferida»", () => {
    const html = render(<AgentProposal onConfirm={() => {}} proposal={propuesta} />);
    expect(html).toContain('aria-label="Sugerencia del sistema');
    expect(html).toContain("border-suggested");
    expect(html).toContain(propuesta.summary);
    expect(html).toContain(propuesta.origin);
    expect(html).toContain('aria-label="Procedencia: Inferida"');
    // Sin confirmar no hay atribución ni timbre de firma.
    expect(html).not.toContain('data-testid="attribution-badge"');
    expect(html).not.toContain("border-stamp");
    expect(html).toContain('data-testid="agent-proposal-confirm"');
  });

  test("sin Confirmar no hay escritura ni acción", () => {
    const onConfirm = mock(() => {});
    render(<AgentProposal onConfirm={onConfirm} proposal={propuesta} />);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  test("Confirmar llama a onConfirm con la propuesta, una sola vez", () => {
    const onConfirm = mock((_id: string) => {});
    const arbol = AgentProposal({ onConfirm, proposal: propuesta });
    const confirmar = encontrar(arbol, "agent-proposal-confirm");
    if (!confirmar) throw new Error("Falta el botón Confirmar");
    (confirmar.props.onPress as () => void)();
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith("p1");
  });

  test("confirmada, deja de ser sugerencia y lleva la atribución del veterinario que confirmó", () => {
    const confirmadaPor: Attribution = {
      actorId: "00000000-0000-4000-8000-000000000002",
      occurredAt: "2026-10-26T10:05:00Z",
      action: null,
    };
    const html = render(
      <AgentProposal confirmedBy={confirmadaPor} onConfirm={() => {}} proposal={propuesta} />,
    );
    expect(html).not.toContain("Sugerencia del sistema");
    expect(html).toContain('data-testid="attribution-badge"');
    expect(html).toContain("Dra. Ana Torres");
    expect(html).toContain("border-stamp");
    // La procedencia sigue siendo «Inferida» después de confirmar (FR-021).
    expect(html).toContain('aria-label="Procedencia: Inferida"');
    // Ya no se puede confirmar de nuevo.
    expect(html).not.toContain('data-testid="agent-proposal-confirm"');
  });

  test("con una confirmación en curso no admite otra", () => {
    const html = render(<AgentProposal busy onConfirm={() => {}} proposal={propuesta} />);
    const boton = html.match(/<[^>]*data-testid="agent-proposal-confirm"[^>]*>/)?.[0] ?? "";
    expect(boton).toContain('aria-disabled="true"');
  });
});
