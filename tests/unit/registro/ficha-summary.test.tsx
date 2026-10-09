import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { FichaSummary } from "@/components/registro/ficha-summary";
import type { PatientContent } from "@/features/registro/schema";

const content: PatientContent = {
  name: "Kira",
  species: "canino",
  breed: "Mestizo",
  birthDate: "2021-03-10",
  ageMonths: 42,
  weightKg: 12.4,
  sex: "hembra",
  reproductiveStatus: "esterilizada",
  antecedentes: {
    medicalHistory: [],
    preexistingDiseases: [],
    currentMedications: [],
    knownAllergies: [],
    behavioralHistory: [],
  },
  tutorId: "t1",
};

// sistema-visual D20 (12.9): la ficha se lee como formulario: rótulo preimpreso y dato.
describe("FichaSummary", () => {
  const html = renderToStaticMarkup(
    <FichaSummary content={content} tutor={{ name: "Sra. Tania", contact: "+56 9 5550 0101" }} />,
  ).replace(/<!-- -->/g, "");

  test("cada campo lleva su rótulo preimpreso", () => {
    for (const rotulo of ["Especie", "Raza", "Fecha de nacimiento", "Edad (meses)", "Peso (kg)"]) {
      expect(html).toMatch(new RegExp(`uppercase[^>]*>${rotulo.replace(/[()]/g, "\\$&")}<`));
    }
  });

  test("fecha, edad y peso van en la mono de datos", () => {
    for (const dato of ["2021-03-10", "42", "12.4"]) {
      expect(html).toMatch(new RegExp(`font-mono[^>]*>${dato}<`));
    }
  });

  test("un dato ausente se dice, no se inventa", () => {
    const sinPeso = renderToStaticMarkup(
      <FichaSummary content={{ ...content, weightKg: null }} tutor={null} />,
    );
    expect(sinPeso).toContain(">Sin dato<");
    expect(sinPeso).toContain(">Sin tutor asociado<");
  });

  test("el tutor aparece con su contacto", () => {
    expect(html).toContain("Sra. Tania — +56 9 5550 0101");
  });
});
