import { describe, expect, mock, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { epicrisisChanges } from "@/components/registro/epicrisis-changes";
import type { EpicrisisContent } from "@/features/registro/schema";

// La atribución resuelve el nombre con Supabase: aquí solo importa que aparezca.
mock.module("@/features/clinical/use-veterinarian-display-name", () => ({
  useVeterinarianDisplayName: () => ({ data: "Dr. Bruno Soto" }),
}));
const { CorrectionLine, ProvenanceCorrection } = await import(
  "@/components/clinical/correction-line"
);

const render = (node: ReactNode) =>
  renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>{node}</QueryClientProvider>,
  );

const base: EpicrisisContent = {
  consultationId: "c1",
  motivoConsulta: "Cojera del miembro posterior",
  antecedentesRelevantes: "",
  hallazgosAnamnesis: "",
  hipotesis: [],
  diagnostico: "Esguince leve",
  examenesSolicitados: ["Radiografía"],
  intervencionesPropuestas: [],
  medicamentosAprobados: [],
  recomendacionesTutor: "Reposo",
  planSeguimiento: { pendientes: [] },
  observaciones: "",
};

// FR-098 · US18-AC3 · design.md D20: la corrección se lee campo por campo.
describe("epicrisisChanges", () => {
  test("devuelve solo los campos que cambiaron, con su rótulo y ambos valores", () => {
    const changes = epicrisisChanges(base, {
      ...base,
      diagnostico: "Rotura parcial de ligamento cruzado",
      examenesSolicitados: ["Radiografía", "Ecografía"],
    });
    expect(changes).toEqual([
      {
        field: "diagnostico",
        label: "Diagnóstico registrado",
        previous: "Esguince leve",
        current: "Rotura parcial de ligamento cruzado",
      },
      {
        field: "examenesSolicitados",
        label: "Exámenes solicitados",
        previous: "Radiografía",
        current: "Radiografía\nEcografía",
      },
    ]);
  });

  test("sin cambios no hay renglones", () => {
    expect(epicrisisChanges(base, { ...base })).toEqual([]);
  });
});

describe("CorrectionLine", () => {
  const html = render(
    <CorrectionLine
      attribution={{
        actorId: "00000000-0000-4000-8000-000000000002",
        occurredAt: "2026-09-30T10:00:00Z",
        action: "corrective_record_created",
      }}
      current="Rotura parcial de ligamento cruzado"
      label="Diagnóstico registrado"
      previous="Esguince leve"
      testID="linea"
    />,
  );

  test("tacha el valor anterior con una línea y lo deja legible", () => {
    expect(html).toMatch(/class="[^"]*line-through[^"]*"[^>]*>Esguince leve</);
    expect(html).toMatch(/class="[^"]*text-muted-foreground[^"]*line-through[^"]*"/);
  });

  test("anuncia el anterior como reemplazado con texto, no solo con el tachado", () => {
    const announced = html.indexOf(">Reemplazado<");
    expect(announced).toBeGreaterThan(-1);
    expect(announced).toBeLessThan(html.indexOf("Esguince leve"));
  });

  test("el valor vigente va en el pliego de corrección con su atribución", () => {
    const current = html.match(
      /<div[^>]*class="[^"]*bg-correction-surface[^"]*"[^>]*>([\s\S]*)<\/div>/,
    )?.[1];
    expect(current).toContain("Rotura parcial de ligamento cruzado");
    expect(current).toContain("Dr. Bruno Soto");
  });

  // D20: el único color de superficie son los pliegos; la atribución es una línea de firma.
  test("la atribución no pinta una losa gris sobre el pliego", () => {
    const badge = html.match(/<div[^>]*data-testid="attribution-badge"[^>]*>/)?.[0] ?? "";
    expect(badge).not.toBe("");
    expect(badge).not.toContain("bg-muted");
    expect(badge).toContain("border-t");
  });

  test("lleva el rótulo del campo", () => {
    expect(html).toContain(">Diagnóstico registrado<");
  });
});

describe("ProvenanceCorrection", () => {
  const html = render(<ProvenanceCorrection current="reportada" previous={["inferida"]} />);

  test("tacha la procedencia anterior, anunciada como reemplazada", () => {
    expect(html).toContain(">Reemplazado<");
    expect(html).toMatch(/class="[^"]*line-through[^"]*"[^>]*>I · Inferida</);
  });

  test("junto al código vigente", () => {
    expect(html).toContain('aria-label="Procedencia: Reportada"');
    expect(html.indexOf("Inferida")).toBeLessThan(html.indexOf("Procedencia: Reportada"));
  });
});
