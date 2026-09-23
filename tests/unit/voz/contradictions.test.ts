import { describe, expect, test } from "bun:test";
import { detectContradictions, flagContradictions } from "@/features/voz/contradictions";
import { extractClinicalFacts } from "@/features/voz/extraction";

// Tasks.md 2.4 — contradicciones como señal, nunca como resolución (D4 · FR-032 · US6-AC8 ·
// edge de contradicción intraconversación).

describe("detectContradictions", () => {
  test("señala la autocorrección del tutor dentro de la conversación (FR-032 · edge)", () => {
    const señales = detectContradictions(
      {
        id: "borrador-2",
        field: "contexto",
        text: "en realidad es de día cuando salgo a trabajar",
        negation: false,
      },
      {
        previos: [
          {
            id: "borrador-1",
            field: "contexto",
            text: "Al principio era solo de noche",
            negation: false,
          },
        ],
        anamnesis: [],
        ficha: [],
      },
    );
    expect(señales).toHaveLength(1);
    expect(señales[0]?.refKind).toBe("borrador");
    expect(señales[0]?.refId).toBe("borrador-1");
  });

  test("señala la contradicción con un antecedente ya registrado en la ficha, sin sobrescribir (FR-032 · US6-AC8)", () => {
    const señales = detectContradictions(
      {
        id: "borrador-3",
        field: "tratamientos_anteriores",
        text: "Ahora ya no toma fluoxetina, la suspendimos",
        negation: true,
      },
      {
        previos: [],
        anamnesis: [],
        ficha: [
          {
            refId: "ficha-1",
            group: "currentMedications",
            text: "Fluoxetina 20 mg diaria",
            negation: false,
          },
        ],
      },
    );
    expect(señales).toHaveLength(1);
    expect(señales[0]?.refKind).toBe("ficha");
    expect(señales[0]?.refId).toBe("ficha-1");
  });

  test("señala la contradicción con una observación de anamnesis ya registrada (FR-032)", () => {
    const señales = detectContradictions(
      {
        id: "borrador-4",
        field: "alimentacion",
        text: "en realidad nunca le damos croquetas",
        negation: true,
      },
      {
        previos: [],
        ficha: [],
        anamnesis: [
          {
            id: "anamnesis-1",
            field: "alimentacion",
            text: "Come croquetas dos veces al día",
            negation: false,
          },
        ],
      },
    );
    expect(señales).toHaveLength(1);
    expect(señales[0]?.refKind).toBe("anamnesis");
  });

  test("hechos distintos del mismo campo sin corrección no generan señal", () => {
    const señales = detectContradictions(
      {
        id: "borrador-6",
        field: "desencadenantes",
        text: "cuando llegan visitas",
        negation: false,
      },
      {
        previos: [
          {
            id: "borrador-5",
            field: "desencadenantes",
            text: "cuando se queda solo",
            negation: false,
          },
        ],
        anamnesis: [],
        ficha: [],
      },
    );
    expect(señales).toEqual([]);
  });

  test("solo devuelve señales: la decisión de resolverla es siempre del veterinario (FR-032)", () => {
    const contexto = {
      previos: [{ id: "borrador-1", field: "frecuencia", text: "todos los días", negation: false }],
      anamnesis: [],
      ficha: [],
    };
    const antes = JSON.stringify(contexto);
    detectContradictions(
      { id: "borrador-7", field: "frecuencia", text: "mejor dicho, nunca", negation: true },
      contexto,
    );
    expect(JSON.stringify(contexto)).toBe(antes);
  });
});

describe("flagContradictions (lote de propuestas de un tramo)", () => {
  test("FR-032: la autocorrección del tutor DENTRO del mismo tramo dispara la insignia (regresión del hallazgo 2 de la revisión)", () => {
    const propuestas = extractClinicalFacts({
      text: "Al principio era solo de noche, no, perdón, en realidad es de día cuando salgo a trabajar.",
      quality: "ok",
    }).filter((propuesta) => propuesta.field === "contexto");
    expect(propuestas.length).toBe(2);
    const marcadas = flagContradictions(propuestas, { previos: [], anamnesis: [], ficha: [] });
    expect(marcadas.some((propuesta) => propuesta.contradiction?.refKind === "borrador")).toBe(
      true,
    );
  });

  test("el contexto del llamador no se muta: el lote se acumula en local (función pura)", () => {
    const contexto = { previos: [], anamnesis: [], ficha: [] };
    const antes = JSON.stringify(contexto);
    flagContradictions(
      [{ field: "frecuencia", text: "todos los días", excerptStart: 0, excerptEnd: 11 }],
      contexto,
    );
    expect(JSON.stringify(contexto)).toBe(antes);
  });
});
