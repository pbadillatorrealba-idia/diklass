import { describe, expect, mock, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { AudioFactEntry } from "@/features/voz/audio-fact-service";
import type { ConfirmationState } from "@/features/voz/schema";

// La insignia de atribución resuelve el nombre con Supabase: aquí solo importa que aparezca.
mock.module("@/features/clinical/use-veterinarian-display-name", () => ({
  useVeterinarianDisplayName: () => ({ data: "Dra. Prueba" }),
}));
// Después de sustituir el hook: un import estático se evaluaría antes que `mock.module`.
const { DraftFactsPanel } = await import("@/components/voz/draft-facts-panel");
const { ListenModeButton } = await import("@/components/voz/listen-mode-button");

const render = (node: ReactNode) =>
  renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>{node}</QueryClientProvider>,
  );

function fact(state: ConfirmationState, contradiction?: string): AudioFactEntry {
  return {
    record: {
      id: `f-${state}`,
      created_by: "00000000-0000-4000-8000-000000000001",
      created_at: "2026-09-25T10:00:00Z",
      updated_by: state === "confirmed" ? "00000000-0000-4000-8000-000000000002" : null,
      updated_at: state === "confirmed" ? "2026-09-25T10:05:00Z" : null,
    } as AudioFactEntry["record"],
    content: {
      consultationId: "c1",
      field: "motivo_consulta",
      text: "Vocaliza de noche",
      provenance: "inferida",
      confirmationState: state,
      transcriptSegmentId: "t1",
      transcriptExcerpt: "llora cuando se va",
      segmentSeq: 0,
      contradiction: contradiction ? { refKind: "ficha", refId: "x", note: contradiction } : null,
    },
  };
}

const panel = (entry: AudioFactEntry) =>
  render(
    <DraftFactsPanel facts={[entry]} onConfirm={() => {}} onDiscard={() => {}} onEdit={() => {}} />,
  );

// FR-076 · escenario «Sugerencia aprobada» · design.md D7 (sistema-visual 4.5).
describe("DraftFactsPanel", () => {
  test("un hecho pendiente se muestra como sugerencia del sistema", () => {
    const html = panel(fact("pending"));
    expect(html).toContain('aria-label="Sugerencia del sistema"');
    expect(html).toContain("border-suggested");
    expect(html).not.toContain('data-testid="attribution-badge"');
  });

  test("un hecho confirmado deja de ser sugerencia y muestra su atribución", () => {
    const html = panel(fact("confirmed"));
    expect(html).not.toContain("Sugerencia del sistema");
    expect(html).toContain('data-testid="attribution-badge"');
    expect(html).toContain(">Confirmado<");
  });

  test("la contradicción es un aviso con estado, no solo texto de color", () => {
    const html = panel(fact("pending", "La ficha dice que no vocaliza"));
    const box = html.match(/<div[^>]*data-testid="draft-fact-contradiction"[^>]*>/)?.[0] ?? "";
    expect(box).toContain("bg-warning-surface");
    expect(box).toContain('aria-live="polite"');
    expect(html).toContain("La ficha dice que no vocaliza");
  });
});

describe("ListenModeButton", () => {
  test.each([
    [false, "bg-primary", "false"],
    [true, "bg-destructive", "true"],
  ] as const)("activo=%p usa %s y aria-pressed=%s", (active, surface, pressed) => {
    const html = render(<ListenModeButton active={active} onToggle={() => {}} />);
    const button =
      html.match(/<(?:div|button)[^>]*data-testid="listen-mode-button"[^>]*>/)?.[0] ?? "";
    expect(button.split('data-class="')[1]?.split('"')[0]?.split(" ")).toContain(surface);
    expect(button).toContain(`aria-pressed="${pressed}"`);
  });
});
