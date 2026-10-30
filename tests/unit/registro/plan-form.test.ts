import { describe, expect, test } from "bun:test";
import { buildPlan, emptyPlanFormValues } from "@/components/registro/plan-form";
import { diagnosisContentSchema } from "@/features/registro/schema";

describe("buildPlan (FR-112)", () => {
  test("sin ningún dato el plan es null, no un plan vacío", () => {
    expect(buildPlan(emptyPlanFormValues)).toEqual({ plan: null, error: null });
  });

  test("arma el plan con lo que el veterinario completó y lo valida el esquema", () => {
    const { plan, error } = buildPlan({
      ...emptyPlanFormValues,
      tests: ["analisis_sangre"],
      differentials: ["Fobia", "", "Hiperapego"],
      neuterSurgical: "no",
      medication: [
        { activeIngredient: "Fluoxetina", guideline: "1 mg/kg/24h" },
        { activeIngredient: "", guideline: "" },
      ],
    });

    expect(error).toBeNull();
    expect(plan?.differentials).toEqual(["Fobia", "Hiperapego"]);
    expect(plan?.neuterSurgical).toBe("no");
    expect(plan?.medication).toEqual([
      { activeIngredient: "Fluoxetina", guideline: "1 mg/kg/24h" },
    ]);
    expect(
      diagnosisContentSchema.safeParse({ consultationId: "c", text: "Dx", plan }).success,
    ).toBe(true);
  });

  test("un principio activo sin pauta, o al revés, es un error y no se guarda", () => {
    const { plan, error } = buildPlan({
      ...emptyPlanFormValues,
      medication: [
        { activeIngredient: "Fluoxetina", guideline: "" },
        { activeIngredient: "", guideline: "" },
      ],
    });

    expect(plan).toBeNull();
    expect(error).toContain("principio activo");
  });
});
