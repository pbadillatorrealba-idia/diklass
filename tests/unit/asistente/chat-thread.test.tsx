import { describe, expect, mock, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Message } from "@/features/asistente/chat-model";

mock.module("@/features/conocimiento/consulta-service", () => ({ getQuery: async () => null }));
const { ChatThread } = await import("@/components/asistente/chat-thread");

const render = (node: ReactNode) =>
  renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>{node}</QueryClientProvider>,
  );

const msg = (id: string): Message => ({
  id,
  role: "user",
  createdAt: "2026-10-27T15:05:00.000Z",
  status: "done",
  patientId: null,
  parts: [{ type: "text", text: `texto ${id}` }],
});
const chat = (over: Record<string, unknown> = {}) =>
  ({
    messages: [],
    isLoading: false,
    hasOlder: false,
    isLoadingOlder: false,
    loadOlder: async () => {},
    isResponding: false,
    context: null,
    unread: false,
    send: async () => {},
    retry: async () => {},
    stop: () => {},
    clear: async () => {},
    copy: async () => {},
    ...over,
  }) as never;

// asistente-conversacional «Paciente de contexto automático» (etiqueta de solo lectura), «Borrar la
// conversación» y el estado vacío.
describe("ChatThread", () => {
  test("sin paciente de contexto no hay etiqueta", () => {
    expect(render(<ChatThread chat={chat()} />)).not.toContain('data-testid="chat-context"');
  });

  test("con paciente de contexto muestra «Contexto: nombre» de solo lectura", () => {
    const html = render(<ChatThread chat={chat({ context: { name: "Bruma" } })} />);
    expect(html).toContain('data-testid="chat-context"');
    expect(html).toContain("Contexto: Bruma");
  });

  test("un paciente sin nombre cargado se rotula «paciente», sin inventar uno", () => {
    expect(render(<ChatThread chat={chat({ context: { name: null } })} />)).toContain(
      "Contexto: paciente",
    );
  });

  test("sin selector de pacientes en el chat", () => {
    const html = render(<ChatThread chat={chat({ context: { name: "Bruma" } })} />);
    expect(html.toLowerCase()).not.toContain("elige un paciente");
    expect(html).not.toContain('role="radiogroup"');
  });

  test("sin mensajes ofrece sugerencias y no ofrece borrar", () => {
    const html = render(<ChatThread chat={chat()} />);
    expect(html).toContain('data-testid="asistente-sugerencias"');
    expect(html).not.toContain('data-testid="chat-clear"');
  });

  test("con mensajes ofrece «Borrar conversación» y no las sugerencias", () => {
    const html = render(<ChatThread chat={chat({ messages: [msg("u1")] })} />);
    expect(html).toContain('data-testid="chat-clear"');
    expect(html).toContain("Borrar conversación");
    expect(html).not.toContain('data-testid="asistente-sugerencias"');
  });

  test("tiene composer y lista de mensajes", () => {
    const html = render(<ChatThread chat={chat({ messages: [msg("u1")] })} />);
    expect(html).toContain('data-testid="composer-input"');
    expect(html).toContain('data-testid="message-list"');
  });
});
