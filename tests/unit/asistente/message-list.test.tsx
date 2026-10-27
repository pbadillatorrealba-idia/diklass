import { afterAll, describe, expect, mock, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Message } from "@/features/asistente/chat-model";

const real = await import("@/features/conocimiento/consulta-service");
mock.module("@/features/conocimiento/consulta-service", () => ({
  ...real,
  getQuery: async () => null,
}));
// mock.module vive en todo el proceso: se restaura para no filtrar el getQuery falso a otros archivos.
afterAll(() => mock.module("@/features/conocimiento/consulta-service", () => real));
const { MessageList } = await import("@/components/asistente/message-list");

const render = (node: ReactNode) =>
  renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>{node}</QueryClientProvider>,
  );

const msg = (id: string, over: Partial<Message> = {}): Message => ({
  id,
  role: id.startsWith("u") ? "user" : "assistant",
  createdAt: "2026-10-27T15:05:00.000Z",
  status: "done",
  patientId: null,
  parts: [{ type: "text", text: `texto ${id}` }],
  ...over,
});
const base = { hasOlder: false, isLoadingOlder: false, isLoading: false, onLoadOlder: () => {} };

// asistente-conversacional «Lista de mensajes anclada», «Accesibilidad de la conversación».
describe("MessageList", () => {
  test("es un log con nombre accesible", () => {
    const html = render(<MessageList {...base} messages={[msg("u1"), msg("a1")]} />);
    expect(html).toContain('role="log"');
    expect(html).toContain('aria-label="Conversación con el asistente"');
  });

  test("pinta los mensajes en orden", () => {
    const html = render(<MessageList {...base} messages={[msg("u1"), msg("a1")]} />);
    expect(html.indexOf("texto u1")).toBeGreaterThan(-1);
    expect(html.indexOf("texto u1")).toBeLessThan(html.indexOf("texto a1"));
  });

  test("«Cargar anteriores» solo si hay más", () => {
    expect(render(<MessageList {...base} messages={[msg("u1")]} />)).not.toContain(
      "Cargar anteriores",
    );
    expect(render(<MessageList {...base} hasOlder messages={[msg("u1")]} />)).toContain(
      "Cargar anteriores",
    );
  });

  test("al cargar anteriores el botón lo dice y no se repite el pedido", () => {
    const html = render(<MessageList {...base} hasOlder isLoadingOlder messages={[msg("u1")]} />);
    expect(html).toContain("Cargando…");
  });

  test("al abrir, «Ir al final» no se ofrece", () => {
    expect(render(<MessageList {...base} messages={[msg("u1")]} />)).not.toContain("Ir al final");
  });

  test("la carga inicial no se anuncia: la región viva está apagada mientras carga", () => {
    const html = render(<MessageList {...base} isLoading messages={[]} />);
    expect(html).toContain('aria-live="off"');
  });

  test("la región de estado es hermana de la lista, no está dentro del log", () => {
    const html = render(<MessageList {...base} messages={[msg("u1")]} />);
    expect(html).toContain('data-testid="chat-status"');
    const inicioEstado = html.lastIndexOf("<div", html.indexOf('data-testid="chat-status"'));
    const log = html.slice(html.indexOf('role="log"'), inicioEstado);
    expect(log).not.toContain('role="status"');
  });

  test("«Pensando…» del mensaje pendiente no se anuncia dentro del log", () => {
    const html = render(
      <MessageList
        {...base}
        messages={[msg("u1"), msg("a1", { status: "thinking", parts: [] })]}
      />,
    );
    expect(html).toContain("Pensando…");
    expect(html).not.toMatch(/role="status"[^>]*>[^<]*<[^>]*>Pensando…/);
  });

  test("sin mensajes y sin carga muestra el vacío", () => {
    expect(render(<MessageList {...base} messages={[]} />)).toContain("Aún no hay mensajes");
  });
});
