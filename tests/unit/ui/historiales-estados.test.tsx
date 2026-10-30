import { describe, expect, mock, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

// La insignia de atribución resuelve el nombre con Supabase: aquí no se llega a pintar.
mock.module("@/features/clinical/use-veterinarian-display-name", () => ({
  useVeterinarianDisplayName: () => ({ data: "Dra. Prueba" }),
}));
const { PatientHistory } = await import("@/components/registro/patient-history");
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

  // sistema-visual D20 (12.9): las fechas son datos y van en la mono.
  test("la fecha de cada consulta va en la mono de datos", () => {
    const html = renderToStaticMarkup(
      <PatientHistory
        {...estado}
        entries={[
          {
            consultationId: "c1",
            openedAt: "2026-09-25T12:00:00Z",
            status: "closed",
            epicrisis: null,
            epicrisisSuperseded: false,
          },
        ]}
      />,
    );
    expect(html).toMatch(/font-mono[^>]*>\d{2}-\d{2}-2026/);
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
  // D20 (12.9): la procedencia del dato de ficha va al margen como código con nombre.
  expect(html).toContain('aria-label="Procedencia: Reportada"');
});
