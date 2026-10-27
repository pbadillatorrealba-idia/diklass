import { describe, expect, mock, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Message } from "@/features/asistente/chat-model";

mock.module("@/features/conocimiento/consulta-service", () => ({
  getQuery: async () => null,
}));
const { MessageItem } = await import("@/components/asistente/message-item");

const render = (node: ReactNode) =>
  renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>{node}</QueryClientProvider>,
  );

const base = (over: Partial<Message> = {}): Message => ({
  id: "m1",
  role: "assistant",
  createdAt: "2026-10-27T15:05:00.000Z",
  status: "done",
  patientId: null,
  parts: [{ type: "text", text: "Hola **doctora**" }],
  ...over,
});
const noop = () => {};

// asistente-conversacional «Mensajes del chat» y «Acciones del mensaje» (design.md D1 · D11).
describe("MessageItem", () => {
  test("la respuesta del asistente lleva el rótulo «Asistente» con su hora y markdown", () => {
    const html = render(<MessageItem message={base()} />);
    expect(html).toContain("Asistente");
    expect(html).toMatch(/\d{2}:\d{2}/);
    expect(html).toMatch(/<[^>]*font-semibold[^>]*>doctora</);
  });

  test("la pregunta del veterinario va a la derecha, en bloque y sin markdown", () => {
    const html = render(
      <MessageItem
        message={base({ role: "user", parts: [{ type: "text", text: "dosis **x**" }] })}
      />,
    );
    expect(html).toContain("self-end");
    expect(html).toContain("bg-primary-surface");
    expect(html).toContain("dosis **x**");
    expect(html).toContain("Tú");
  });

  test("no usa burbujas redondeadas (rounded-sm)", () => {
    const html = render(<MessageItem message={base({ role: "user" })} />);
    expect(html).not.toContain("rounded-full");
    expect(html).not.toContain("rounded-xl");
    expect(html).not.toContain("rounded-lg");
  });

  test("«Copiar» está en todo mensaje con texto", () => {
    expect(render(<MessageItem message={base()} onCopy={noop} />)).toContain(
      'data-testid="message-copy"',
    );
    expect(render(<MessageItem message={base({ parts: [] })} onCopy={noop} />)).not.toContain(
      'data-testid="message-copy"',
    );
  });

  test("un mensaje en error ofrece «Reintentar»; uno terminado no", () => {
    const enError = render(
      <MessageItem message={base({ role: "user", status: "error" })} onRetry={noop} />,
    );
    expect(enError).toContain('data-testid="message-retry"');
    expect(enError).toContain("Reintentar");
    expect(render(<MessageItem message={base()} onRetry={noop} />)).not.toContain(
      'data-testid="message-retry"',
    );
  });

  test("no ofrece editar ni regenerar", () => {
    const html = render(
      <MessageItem message={base({ status: "error" })} onCopy={noop} onRetry={noop} />,
    );
    expect(html.toLowerCase()).not.toContain("editar");
    expect(html.toLowerCase()).not.toContain("regenerar");
  });

  test("«Pensando…» es texto estático y solo visual: la región de estado de la lista lo anuncia", () => {
    const html = render(<MessageItem message={base({ status: "thinking", parts: [] })} />);
    expect(html).toContain("Pensando…");
    expect(html).not.toContain('role="status"');
    expect(html).toContain('aria-hidden="true"');
  });

  test("el error se anuncia como alerta", () => {
    const html = render(<MessageItem message={base({ role: "user", status: "error" })} />);
    expect(html).toContain('role="alert"');
  });

  test("«Enviando…» mientras el mensaje del usuario no es terminal", () => {
    const html = render(<MessageItem message={base({ role: "user", status: "sending" })} />);
    expect(html).toContain("Enviando…");
  });

  describe("partes", () => {
    test("conocimiento: respuesta con citas y «Ver respaldo registrado»", () => {
      const html = render(
        <MessageItem
          message={base({
            parts: [
              {
                type: "knowledge",
                queryId: "q1",
                answer: {
                  pregunta: "p",
                  patientId: null,
                  segmentos: [
                    {
                      id: "s1",
                      kind: "inferencia",
                      provenance: "inferida",
                      texto: "Respuesta inferida",
                    },
                  ],
                  cobertura: { cubiertos: [], noCubiertos: [] },
                  avisos: [],
                } as never,
              },
            ],
          })}
        />,
      );
      expect(html).toContain("Respuesta inferida");
      expect(html).toContain("Ver respaldo registrado");
    });

    test.each([
      ["expired", "audio vencido"],
      ["deleted", "audio eliminado"],
    ] as const)("audio %s conserva la transcripción y marca «%s»", (audioState, marca) => {
      const html = render(
        <MessageItem
          message={base({
            role: "user",
            parts: [
              {
                type: "audio",
                durationMs: 5000,
                transcript: "lo que dije",
                audioPath: null,
                audioState,
              },
            ],
          })}
        />,
      );
      expect(html).toContain("lo que dije");
      expect(html).toContain(marca);
    });

    test("audio vigente con reproductor: ofrece «Reproducir audio» y conserva la transcripción", () => {
      const message = base({
        role: "user",
        parts: [
          {
            type: "audio",
            durationMs: 65_000,
            transcript: "lo que dije",
            audioPath: "c1/a1/m1.webm",
            audioState: "ready",
          },
        ],
      });
      const html = render(<MessageItem message={message} onPlayAudio={async () => "https://x"} />);
      expect(html).toContain('data-testid="message-play-audio"');
      expect(html).toContain("lo que dije");
      expect(html).toContain("01:05");
    });

    test("audio vencido o eliminado no ofrece reproducir", () => {
      const message = base({
        role: "user",
        parts: [
          {
            type: "audio",
            durationMs: 5000,
            transcript: "x",
            audioPath: null,
            audioState: "expired",
          },
        ],
      });
      expect(
        render(<MessageItem message={message} onPlayAudio={async () => null} />),
      ).not.toContain("message-play-audio");
    });

    test("audio vigente ofrece «Eliminar audio»", () => {
      const message = base({
        role: "user",
        parts: [
          {
            type: "audio",
            durationMs: 5000,
            transcript: "x",
            audioPath: "a/b/c.webm",
            audioState: "ready",
          },
        ],
      });
      expect(render(<MessageItem message={message} onRemoveAudio={noop} />)).toContain(
        'data-testid="message-remove-audio"',
      );
      expect(render(<MessageItem message={message} />)).not.toContain("message-remove-audio");
    });

    test("propuesta sin manejador de confirmación se ve como texto, sin botón Confirmar", () => {
      const html = render(
        <MessageItem
          message={base({
            parts: [
              { type: "proposal", proposal: { id: "p1", summary: "Registrar X", origin: "Ficha" } },
            ],
          })}
        />,
      );
      expect(html).toContain("Registrar X");
      expect(html).not.toContain("agent-proposal-confirm");
    });

    test("aviso (notice)", () => {
      const html = render(
        <MessageItem message={base({ parts: [{ type: "notice", text: "Sin red" }] })} />,
      );
      expect(html).toContain("Sin red");
    });
  });
});
