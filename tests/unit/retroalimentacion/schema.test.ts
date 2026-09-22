import { describe, expect, test } from "bun:test";
import { feedbackContentSchema } from "@/features/retroalimentacion/schema";

const entradaBase = {
  consultationId: "consulta-1",
  adherence: "completa",
  evolution: "mejoria",
  adverseEvents: [],
};

describe("feedbackContentSchema — siete contenidos de FR-018 con campo propio (D2)", () => {
  test("cada contenido de FR-018 se almacena en su campo estructurado", () => {
    const content = feedbackContentSchema.parse({
      consultationId: "consulta-1",
      treatmentApplied: "Fluoxetina 20 mg cada 24 h",
      adherence: "parcial",
      evolution: "mejoriaParcial",
      evolutionNote: "Mejora parcial de las ausencias.",
      adverseEvents: [{ severity: "leve", description: "Somnolencia leve" }],
      revisedDiagnosis: "Agresión redirigida",
      treatmentModification: "Dosis reducida a 10 mg",
    });

    expect(content.consultationId).toBe("consulta-1");
    expect(content.treatmentApplied).toBe("Fluoxetina 20 mg cada 24 h");
    expect(content.adherence).toBe("parcial");
    expect(content.evolution).toBe("mejoriaParcial");
    expect(content.evolutionNote).toBe("Mejora parcial de las ausencias.");
    expect(content.adverseEvents).toEqual([{ severity: "leve", description: "Somnolencia leve" }]);
    expect(content.revisedDiagnosis).toBe("Agresión redirigida");
    expect(content.treatmentModification).toBe("Dosis reducida a 10 mg");
  });

  test("tratamiento aplicado y modificación del tratamiento quedan distinguibles entre sí (US10-AC10)", () => {
    const content = feedbackContentSchema.parse({
      ...entradaBase,
      treatmentApplied: "Enriquecimiento ambiental diario",
      treatmentModification: "Sesiones añadidas por la tarde",
    });

    expect(content.treatmentApplied).toBe("Enriquecimiento ambiental diario");
    expect(content.treatmentModification).toBe("Sesiones añadidas por la tarde");
    expect(content.treatmentApplied).not.toBe(content.treatmentModification);
  });

  test("el cambio de diagnóstico vive en su campo y no toca el diagnóstico original (US10-AC4)", () => {
    const conCambio = feedbackContentSchema.parse({
      ...entradaBase,
      revisedDiagnosis: "Fobia a ruidos, no ansiedad por separación",
    });
    const sinCambio = feedbackContentSchema.parse(entradaBase);

    expect(conCambio.revisedDiagnosis).toBe("Fobia a ruidos, no ansiedad por separación");
    expect(sinCambio.revisedDiagnosis).toBeNull();
  });
});

describe("feedbackContentSchema — categorías que admiten parcial y desconocida (FR-040 · US10-AC8)", () => {
  test("la adherencia admite completa, parcial, ninguna y desconocida", () => {
    for (const adherence of ["completa", "parcial", "ninguna", "desconocida"]) {
      const parsed = feedbackContentSchema.safeParse({ ...entradaBase, adherence });
      expect(parsed.success).toBe(true);
    }
  });

  test("la evolución admite mejoría, mejoría parcial, sin cambios, empeoramiento y desconocida", () => {
    for (const evolution of [
      "mejoria",
      "mejoriaParcial",
      "sinCambios",
      "empeoramiento",
      "desconocida",
    ]) {
      const parsed = feedbackContentSchema.safeParse({ ...entradaBase, evolution });
      expect(parsed.success).toBe(true);
    }
  });

  test("rechaza categorías fuera del vocabulario", () => {
    expect(feedbackContentSchema.safeParse({ ...entradaBase, adherence: "quizas" }).success).toBe(
      false,
    );
    expect(
      feedbackContentSchema.safeParse({ ...entradaBase, evolution: "estupendo" }).success,
    ).toBe(false);
  });
});

describe("feedbackContentSchema — tratamiento vacío y textos opcionales (FR-057 · US10-AC12)", () => {
  test("acepta la consulta sin tratamiento indicado, con evolución observada", () => {
    const content = feedbackContentSchema.parse({
      ...entradaBase,
      treatmentApplied: null,
      treatmentModification: null,
      evolution: "sinCambios",
    });

    expect(content.treatmentApplied).toBeNull();
    expect(content.treatmentModification).toBeNull();
    expect(content.evolution).toBe("sinCambios");
  });

  test("normaliza a null los textos opcionales ausentes, vacíos o en blanco", () => {
    const ausentes = feedbackContentSchema.parse(entradaBase);
    const vacios = feedbackContentSchema.parse({
      ...entradaBase,
      evolutionNote: "",
      treatmentApplied: "   ",
      treatmentModification: null,
      revisedDiagnosis: "",
    });

    expect(ausentes.evolutionNote).toBeNull();
    expect(ausentes.treatmentApplied).toBeNull();
    expect(ausentes.treatmentModification).toBeNull();
    expect(ausentes.revisedDiagnosis).toBeNull();
    expect(vacios.evolutionNote).toBeNull();
    expect(vacios.treatmentApplied).toBeNull();
    expect(vacios.revisedDiagnosis).toBeNull();
  });
});

describe("feedbackContentSchema — eventos adversos estructurados (FR-041 · SC-023)", () => {
  test("acepta lista vacía (sin eventos adversos en esta entrada)", () => {
    const content = feedbackContentSchema.parse(entradaBase);
    expect(content.adverseEvents).toEqual([]);
  });

  test("acepta eventos con severidad leve, moderada o grave y descripción", () => {
    const content = feedbackContentSchema.parse({
      ...entradaBase,
      adverseEvents: [
        { severity: "leve", description: "Somnolencia leve" },
        { severity: "moderado", description: "Disminución del apetito" },
        { severity: "grave", description: "Convulsiones" },
      ],
    });

    expect(content.adverseEvents.map((evento) => evento.severity)).toEqual([
      "leve",
      "moderado",
      "grave",
    ]);
  });

  test("rechaza eventos sin descripción o con severidad fuera del vocabulario", () => {
    expect(
      feedbackContentSchema.safeParse({
        ...entradaBase,
        adverseEvents: [{ severity: "grave" }],
      }).success,
    ).toBe(false);
    expect(
      feedbackContentSchema.safeParse({
        ...entradaBase,
        adverseEvents: [{ severity: "catastrofico", description: "Episodio grave" }],
      }).success,
    ).toBe(false);
    expect(
      feedbackContentSchema.safeParse({
        ...entradaBase,
        adverseEvents: [{ severity: "leve", description: "   " }],
      }).success,
    ).toBe(false);
  });
});

describe("feedbackContentSchema — campos categóricos obligatorios y forma cerrada (SC-023 · D5)", () => {
  test("exige adherencia, evolución y eventos adversos siempre presentes (SC-023)", () => {
    expect(feedbackContentSchema.safeParse({ ...entradaBase, adherence: undefined }).success).toBe(
      false,
    );
    expect(feedbackContentSchema.safeParse({ ...entradaBase, evolution: null }).success).toBe(
      false,
    );
    expect(
      feedbackContentSchema.safeParse({ ...entradaBase, adverseEvents: undefined }).success,
    ).toBe(false);
    expect(
      feedbackContentSchema.safeParse({ ...entradaBase, consultationId: "  " }).success,
    ).toBe(false);
  });

  test("las claves ajenas al modelo no llegan al contenido que se escribe", () => {
    const content = feedbackContentSchema.parse({ ...entradaBase, origenDato: "voz" });
    expect(Object.keys(content).sort()).toEqual([
      "adherence",
      "adverseEvents",
      "consultationId",
      "evolution",
      "evolutionNote",
      "revisedDiagnosis",
      "treatmentApplied",
      "treatmentModification",
    ]);
  });
});
