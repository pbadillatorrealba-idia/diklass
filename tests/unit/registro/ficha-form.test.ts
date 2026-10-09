import { describe, expect, test } from "bun:test";
import {
  emptyFichaFormValues,
  fichaValuesFromContent,
  parseFichaValues,
} from "@/components/registro/ficha-form";
import { patientContentSchema } from "@/features/registro/schema";

const ANTECEDENTES = {
  medicalHistory: [],
  preexistingDiseases: [],
  currentMedications: [],
  knownAllergies: [],
  behavioralHistory: [],
};

const base = {
  ...emptyFichaFormValues,
  name: "Luna",
  species: "perro",
  breed: "Mestizo",
  sex: "hembra",
  reproductiveStatus: "esterilizada",
};

describe("ficha etológica (FR-001 ampliado, FR-110)", () => {
  test("sin datos de la hoja, todo queda sin dato y el derivante es null", () => {
    const { value, errors } = parseFichaValues(base, ANTECEDENTES);

    expect(errors).toEqual({});
    expect(value?.origin).toBeNull();
    expect(value?.firstVisitDate).toBeNull();
    expect(value?.referrer).toBeNull();
  });

  test("conserva procedencia, derivante y fecha de la 1ª visita, y vuelve idéntico al editar", () => {
    const { value } = parseFichaValues(
      {
        ...base,
        origin: "Protectora",
        firstVisitDate: "2026-09-01",
        referrerRefers: "si",
        referrerCenter: "Clínica Norte",
      },
      ANTECEDENTES,
    );

    expect(value?.origin).toBe("Protectora");
    expect(value?.referrer?.refers).toBe("si");
    expect(value?.referrer?.center).toBe("Clínica Norte");
    const content = patientContentSchema.parse({ ...value, tutorId: "t-1" });
    expect(fichaValuesFromContent(content)).toMatchObject({
      origin: "Protectora",
      firstVisitDate: "2026-09-01",
      referrerRefers: "si",
      referrerCenter: "Clínica Norte",
      referrerName: "",
    });
  });

  test("rechaza una fecha de 1ª visita mal formada", () => {
    const { value, errors } = parseFichaValues(
      { ...base, firstVisitDate: "01/09/2026" },
      ANTECEDENTES,
    );

    expect(value).toBeNull();
    expect(errors.firstVisitDate).toBeDefined();
  });
});
