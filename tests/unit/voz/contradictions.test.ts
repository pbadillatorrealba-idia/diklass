import { describe, expect, test } from "bun:test";
import {
  detectContradictions,
  esNegativo,
  flagContradictions,
} from "@/features/voz/contradictions";
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

// Revisión de la PR #29, hallazgos 6 y 7: polaridad simétrica y marcas que sí pueden coincidir.
describe("esNegativo (polaridad compartida, revisión de la PR #29)", () => {
  test("hallazgo 7: «sin parar» es frecuencia, no negación", () => {
    expect(esNegativo("Ladra sin parar toda la noche")).toBe(false);
  });

  test("las negaciones reales siguen detectándose", () => {
    expect(esNegativo("Ya no toma fluoxetina")).toBe(true);
    expect(esNegativo("Nunca come croquetas")).toBe(true);
    expect(esNegativo("Sin vómitos")).toBe(true);
  });
});

describe("detectContradictions: polaridad simétrica (revisión de la PR #29)", () => {
  test("hallazgo 7: una frecuencia con «sin parar» no contradice otra frecuencia previa", () => {
    const [propuesta] = extractClinicalFacts({
      text: "Ladra sin parar cuando se va",
      quality: "ok",
    }).filter((hecho) => hecho.field === "frecuencia");
    expect(propuesta).toBeDefined();
    const señales = detectContradictions(
      {
        id: "nuevo",
        field: "frecuencia",
        text: propuesta?.text ?? "",
        negation: esNegativo(propuesta?.text ?? ""),
      },
      {
        previos: [{ id: "previo", field: "frecuencia", text: "todos los días", negation: false }],
        anamnesis: [],
        ficha: [],
      },
    );
    expect(señales).toEqual([]);
  });

  test("hallazgo 6: dos negaciones del mismo campo no se contradicen por polaridad", () => {
    const [nuevo, previo] = extractClinicalFacts({
      text: "Ya no toma fluoxetina. No toma ningún otro fármaco",
      quality: "ok",
    }).filter((hecho) => hecho.field === "tratamientos_anteriores");
    expect(nuevo && previo).toBeTruthy();
    const marcadas = flagContradictions(
      [previo, nuevo].flatMap((hecho) => (hecho ? [hecho] : [])),
      {
        previos: [],
        anamnesis: [],
        ficha: [],
      },
    );
    expect(marcadas.map((hecho) => hecho.contradiction ?? null)).toEqual([null, null]);
  });

  test("hallazgo 6: un hecho afirmativo que contradice una observación previa negada se marca", () => {
    const [propuesta] = extractClinicalFacts({
      text: "Come croquetas dos veces al día",
      quality: "ok",
    }).filter((hecho) => hecho.field === "alimentacion");
    expect(propuesta).toBeDefined();
    const marcadas = flagContradictions(propuesta ? [propuesta] : [], {
      previos: [],
      anamnesis: [
        {
          id: "anamnesis-1",
          field: "alimentacion",
          text: "Nunca come croquetas",
          negation: esNegativo("Nunca come croquetas"),
        },
      ],
      ficha: [],
    });
    expect(marcadas[0]?.contradiction?.refKind).toBe("anamnesis");
  });
});
