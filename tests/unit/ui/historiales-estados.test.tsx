import { describe, expect, mock, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { FeedbackTimelineEntry } from "@/features/retroalimentacion/feedback-summary";

// La insignia de atribución resuelve el nombre con Supabase: aquí no se llega a pintar.
mock.module("@/features/clinical/use-veterinarian-display-name", () => ({
  useVeterinarianDisplayName: () => ({ data: "Dra. Prueba" }),
}));
const { PatientHistory } = await import("@/components/registro/patient-history");
const { FeedbackTimeline } = await import("@/components/retroalimentacion/feedback-timeline");
const { AdverseEventReport } = await import("@/components/retroalimentacion/adverse-event-report");
const { SegmentoRespuestaView } = await import("@/components/conocimiento/segmento-respuesta");

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

test("el dato clínico de una ficha usado en una respuesta se puede seleccionar", () => {
  const html = renderToStaticMarkup(
    <SegmentoRespuestaView
      segmento={{
        id: "dato-1",
        kind: "ficha",
        texto: "Antecedente clínico copiable",
        provenance: "reportada",
        fichaRef: "ficha-1",
      }}
    />,
  );
  expect(html).toMatch(/r-userSelect-[^" ]+"[^>]*>Antecedente clínico copiable/);
});

test("la descripción de un evento adverso en el reporte se puede seleccionar", () => {
  const html = renderToStaticMarkup(
    <AdverseEventReport
      events={[
        {
          feedbackRecordId: "f1",
          consultationId: "c1",
          registeredAt: "2026-09-25T12:00:00Z",
          effective: true,
          eventIndex: 0,
          event: { severity: "grave", description: "Reacción adversa copiable" },
        },
      ]}
    />,
  );
  expect(html).toMatch(/r-userSelect-[^" ]+"[^>]*>Reacción adversa copiable/);
});

describe("FeedbackTimeline", () => {
  const props = { ...estado, entries: [], onCorrect: () => {} };
  const entry = (index: number): FeedbackTimelineEntry =>
    ({
      record: { id: `f${index}`, created_at: "2026-09-25T12:00:00Z", created_by: "vet" },
      content: {
        consultationId: "consulta",
        adherence: "completa",
        evolution: "mejoria",
        evolutionNote: `Observación clínica ${index}`,
        treatmentApplied: "tratamiento aplicado",
        treatmentModification: null,
        revisedDiagnosis: null,
        adverseEvents: [],
      },
      correctsRecordId: null,
      supersededByRecordId: null,
      effective: true,
    }) as unknown as FeedbackTimelineEntry;

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

  test("virtualiza una cronología larga sin otro contenedor de desplazamiento", () => {
    const html = renderToStaticMarkup(
      <FeedbackTimeline {...props} entries={Array.from({ length: 200 }, (_, i) => entry(i))} />,
    );
    const filas = html.match(/data-testid="feedback-timeline-item"/g) ?? [];
    expect(filas.length).toBeGreaterThan(0);
    expect(filas.length).toBeLessThan(200);
    expect(html).toContain('data-testid="feedback-timeline"');
    expect(html).not.toContain('data-testid="feedback-timeline-scroll"');
  });

  test("la observación clínica de la cronología se puede seleccionar", () => {
    const html = renderToStaticMarkup(<FeedbackTimeline {...props} entries={[entry(1)]} />);
    expect(html).toMatch(/r-userSelect-[^" ]+" data-testid="feedback-timeline-evolution-note"/);
  });

  test("el antecedente de cada entrada vive en su fila virtualizada", () => {
    const html = renderToStaticMarkup(
      <FeedbackTimeline
        {...props}
        entries={[entry(1)]}
        antecedents={[
          {
            feedbackRecordId: "f1",
            consultationId: "consulta",
            consultationDate: "2026-09-24T12:00:00Z",
            registeredAt: "2026-09-25T12:00:00Z",
            adherence: "completa",
            evolution: "mejoria",
            revisedDiagnosis: "nuevo diagnóstico",
          } as never,
        ]}
      />,
    );
    expect(html).toContain('data-testid="feedback-antecedent-item"');
    expect(html).toContain("nuevo diagnóstico");
    expect(html).toMatch(/r-userSelect-[^" ]+" data-testid="feedback-antecedent-item"/);
  });
});
