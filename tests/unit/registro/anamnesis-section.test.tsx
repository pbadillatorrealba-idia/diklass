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

const htmlCerrada = renderToStaticMarkup(
  <QueryClientProvider client={new QueryClient()}>
    <AnamnesisSection
      entries={[
        {
          id: "a2",
          content: {
            consultationId: "c1",
            field: "soledad_vocaliza",
            text: "a_veces",
            provenance: "reportada",
          },
          attribution: { actorId: "v1", occurredAt: "2026-09-30T10:00:00Z", action: null },
        },
      ]}
      field="soledad_destroza"
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

describe("AnamnesisSection (hoja etológica, FR-111)", () => {
  test("una pregunta cerrada se responde con Sí / No / A veces, no con texto libre", () => {
    expect(htmlCerrada).toContain('data-testid="anamnesis-answer"');
    expect(htmlCerrada).toContain("A veces");
    expect(htmlCerrada).not.toContain('data-testid="anamnesis-text"');
  });

  test("la respuesta registrada se muestra con su rótulo, no con el valor interno", () => {
    expect(htmlCerrada).toContain("¿Ladra, llora y/o aúlla cuando se queda solo?");
    expect(htmlCerrada).not.toContain(">a_veces<");
  });

  test("los campos sin información son «Desconocido» en la sección activa y se cuentan por sección", () => {
    expect(htmlCerrada).toContain("¿Destroza cosas?: Desconocido");
    expect(htmlCerrada).not.toContain("Tipo de vivienda (piso/casa): Desconocido");
    expect(htmlCerrada).toContain("Comportamiento cuando se queda solo: 5 de 6 sin información");
  });
});

// Aclaración de D20 (2026-09-30): «Corregir procedencia» queda tras un botón por entrada.
describe("AnamnesisSection", () => {
  test("la corrección de procedencia está plegada tras un botón", () => {
    expect(html).toContain('aria-label="Corregir procedencia de Motivo de consulta"');
    expect(html).not.toContain('aria-label="Corregir procedencia"');
    expect(html).not.toContain('data-testid="anamnesis-provenance-correct"');
  });

  // Revisión de la PR #41: el botón que despliega sigue montado y expone si está abierto.
  test("el botón de corrección expone que está plegado", () => {
    const boton = html.match(
      /<[^>]*aria-label="Corregir procedencia de Motivo de consulta"[^>]*>/,
    )?.[0];
    expect(boton).toContain('aria-expanded="false"');
  });
});
