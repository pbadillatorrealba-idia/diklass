import { describe, expect, mock, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

// La insignia de atribución resuelve el nombre con Supabase: aquí no se llega a pintar.
mock.module("@/features/clinical/use-veterinarian-display-name", () => ({
  useVeterinarianDisplayName: () => ({ data: "Dra. Prueba" }),
}));
const { PatientHistory } = await import("@/components/registro/patient-history");
const { FeedbackTimeline } = await import("@/components/retroalimentacion/feedback-timeline");

// sistema-visual FR-085 · SC-056 (design.md D13): los historiales distinguen carga, error y vacío;
// antes pintaban «Sin consultas…» mientras la lectura seguía en curso.
const estado = { error: null, isPending: false, onRetry: () => {} };

describe("PatientHistory", () => {
  test("durante la carga no dice que no hay consultas", () => {
    const html = renderToStaticMarkup(<PatientHistory {...estado} entries={[]} isPending />);
    expect(html).toContain('data-testid="history-loading"');
    expect(html).not.toContain("history-empty");
  });

  test("con error ofrece reintentar y no dice que no hay consultas", () => {
    const html = renderToStaticMarkup(
      <PatientHistory {...estado} entries={[]} error={new Error("red")} />,
    );
    expect(html).toContain('data-testid="history-error"');
    expect(html).toContain(">Reintentar<");
    expect(html).not.toContain("history-empty");
  });

  test("sin consultas tras cargar lo dice", () => {
    const html = renderToStaticMarkup(<PatientHistory {...estado} entries={[]} />);
    expect(html).toContain('data-testid="history-empty"');
  });
});

describe("FeedbackTimeline", () => {
  const props = { ...estado, entries: [], onCorrect: () => {} };

  test("durante la carga no dice que no hay retroalimentación", () => {
    const html = renderToStaticMarkup(<FeedbackTimeline {...props} isPending />);
    expect(html).toContain('data-testid="feedback-timeline-loading"');
    expect(html).not.toContain("feedback-timeline-empty");
  });

  test("con error ofrece reintentar", () => {
    const html = renderToStaticMarkup(<FeedbackTimeline {...props} error={new Error("red")} />);
    expect(html).toContain('data-testid="feedback-timeline-error"');
    expect(html).toContain(">Reintentar<");
    expect(html).not.toContain("feedback-timeline-empty");
  });

  test("sin entradas tras cargar lo dice", () => {
    const html = renderToStaticMarkup(<FeedbackTimeline {...props} />);
    expect(html).toContain('data-testid="feedback-timeline-empty"');
  });
});
