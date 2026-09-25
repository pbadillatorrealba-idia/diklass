import { describe, expect, test } from "bun:test";
import {
  emptyFeedbackFormValues,
  type FeedbackFormValues,
  feedbackFormValuesFromContent,
  parseFeedbackValues,
} from "@/features/retroalimentacion/feedback-form-values";
import { feedbackContentSchema } from "@/features/retroalimentacion/schema";

const valoresBase: FeedbackFormValues = {
  ...emptyFeedbackFormValues,
  adherence: "parcial",
  evolution: "mejoriaParcial",
  treatmentApplied: "Fluoxetina 20 mg cada 24 h",
  treatmentModification: "Dosis reducida a 10 mg",
};

describe("parseFeedbackValues — del formulario al contenido de D2", () => {
  test("conserva tratamiento aplicado y modificación en campos distintos (US10-AC10)", () => {
    const { value, errors } = parseFeedbackValues(valoresBase, "consulta-1");

    expect(errors).toEqual({});
    expect(value?.treatmentApplied).toBe("Fluoxetina 20 mg cada 24 h");
    expect(value?.treatmentModification).toBe("Dosis reducida a 10 mg");
  });

  test("los textos vacíos se vuelven null sin inventar datos (FR-057 · US10-AC12)", () => {
    const { value } = parseFeedbackValues(
      { ...emptyFeedbackFormValues, evolution: "sinCambios" },
      "consulta-1",
    );

    expect(value?.treatmentApplied).toBeNull();
    expect(value?.treatmentModification).toBeNull();
    expect(value?.evolutionNote).toBeNull();
    expect(value?.revisedDiagnosis).toBeNull();
  });

  test("las selecciones categóricas viajan como valores del vocabulario, con parcial y desconocida (FR-040 · US10-AC8)", () => {
    const { value, errors } = parseFeedbackValues(
      { ...emptyFeedbackFormValues, adherence: "desconocida", evolution: "mejoriaParcial" },
      "consulta-1",
    );

    expect(errors).toEqual({});
    expect(value?.adherence).toBe("desconocida");
    expect(value?.evolution).toBe("mejoriaParcial");
  });

  test("la descripción del evento adverso es obligatoria, con error en español (FR-041)", () => {
    const { value, errors } = parseFeedbackValues(
      {
        ...valoresBase,
        adverseEvents: [{ severity: "grave", description: "   " }],
      },
      "consulta-1",
    );

    expect(value).toBeNull();
    expect(errors["adverseEvents.0.description"]).toBe("Describe el evento adverso.");
  });

  test("los eventos adversos llegan estructurados con su severidad (FR-041 · SC-023)", () => {
    const { value } = parseFeedbackValues(
      {
        ...valoresBase,
        adverseEvents: [
          { severity: "leve", description: "Somnolencia leve" },
          { severity: "grave", description: "Convulsión aislada" },
        ],
      },
      "consulta-1",
    );

    expect(value?.adverseEvents).toEqual([
      { severity: "leve", description: "Somnolencia leve" },
      { severity: "grave", description: "Convulsión aislada" },
    ]);
  });

  test("el contenido sale validado por el modelo de D2 y con la consulta referida (FR-039)", () => {
    const { value } = parseFeedbackValues(valoresBase, "consulta-9");

    expect(value?.consultationId).toBe("consulta-9");
    expect(feedbackContentSchema.safeParse(value).success).toBe(true);
  });

  test("el prefill de una corrección viaja de ida y vuelta sin perder nada (US10-AC5)", () => {
    const { value } = parseFeedbackValues(
      {
        ...valoresBase,
        adverseEvents: [{ severity: "grave", description: "Convulsión aislada" }],
      },
      "consulta-1",
    );
    expect(value).not.toBeNull();

    const prefill = feedbackFormValuesFromContent(value as NonNullable<typeof value>);
    const vuelta = parseFeedbackValues(prefill, "consulta-1");

    expect(vuelta.errors).toEqual({});
    expect(vuelta.value).toEqual(value);
  });
});
