import { describe, expect, mock, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";

mock.module("@/features/clinical/use-veterinarian-display-name", () => ({
  useVeterinarianDisplayName: () => ({ data: "Dra. Prueba" }),
}));
const { AnamnesisSection } = await import("@/components/registro/anamnesis-section");

const html = renderToStaticMarkup(
  <QueryClientProvider client={new QueryClient()}>
    <AnamnesisSection
      entries={[
        {
          id: "a1",
          content: {
            consultationId: "c1",
            field: "motivo_consulta",
            text: "Vocaliza de noche",
            provenance: "inferida",
          },
          attribution: { actorId: "v1", occurredAt: "2026-09-30T10:00:00Z", action: null },
        },
      ]}
      field="motivo_consulta"
      isBusy={false}
      onCorrectProvenance={() => {}}
      onFieldChange={() => {}}
      onProvenanceChange={() => {}}
      onSubmit={() => {}}
      onTextChange={() => {}}
      provenance="reportada"
      text=""
      textError={null}
    />
  </QueryClientProvider>,
);

// Aclaración de D20 (2026-09-30): «Corregir procedencia» queda tras un botón por entrada.
describe("AnamnesisSection", () => {
  test("la corrección de procedencia está plegada tras un botón", () => {
    expect(html).toContain('aria-label="Corregir procedencia de Motivo de consulta"');
    expect(html).not.toContain('aria-label="Corregir procedencia"');
    expect(html).not.toContain('data-testid="anamnesis-provenance-correct"');
  });
});
