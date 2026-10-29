import { describe, expect, test } from "bun:test";
import {
  composeFundamento,
  type DecisionRegistrada,
  detectMissingInformation,
  mergeSuggestionStates,
} from "@/features/asistencia/deteccion";
import type { EntradaAnamnesis } from "@/features/asistencia/schema";
import type { CandidatoFragmento } from "@/features/conocimiento/answer";
import type { AnamnesisContent, PatientContent } from "@/features/registro/schema";

/**
 * Detección de información faltante y registro de decisiones (D3/D4 de design.md · tasks.md 2.2).
 * Trazabilidad: FR-008 · FR-033 · FR-044 heredado (SC-024) · US7-AC1/AC2/AC3/AC4/AC5/AC6.
 */

let contadorInsumos = 0;

function entrada(field: AnamnesisContent["field"], text: string): EntradaAnamnesis {
  contadorInsumos += 1;
  return {
    recordId: `r-${contadorInsumos}`,
    content: { consultationId: "c-1", field, text, provenance: "reportada" },
  };
}

function fichaBase(): PatientContent {
  return {
    name: "Tobi",
    species: "perro",
    breed: "Mestizo",
    birthDate: "2021-05-01",
    ageMonths: 36,
    weightKg: 12.4,
    sex: "macho",
    reproductiveStatus: "castrado",
    antecedentes: {
      medicalHistory: [{ text: "Sin antecedentes médicos relevantes", negative: false }],
      preexistingDiseases: [],
      currentMedications: [{ text: "Ninguna medicación actual", negative: true }],
      knownAllergies: [{ text: "Sin alergias conocidas", negative: true }],
      behavioralHistory: [{ text: "Ansiedad previa", negative: false }],
    },
    tutorId: "t-1",
  };
}

function candidato(
  texto: string,
  lemasPregunta: string[],
  lemasCubiertos: string[],
): CandidatoFragmento {
  return {
    documentoId: "doc-1",
    fragmentoOrdinal: 1,
    texto,
    seccion: "Síntesis",
    bibliografia: {
      titulo: "Protocolo de ansiedad por separación (ficticio)",
      autores: ["Equipo clínico sintético"],
      anio: 2026,
      revista: null,
      editorial: null,
      edicion: null,
      doi: null,
      url: null,
    },
    licencia: { tipo: "CC BY 4.0 (ficticia)", nota: null },
    estado: "available",
    lemasCubiertos,
    lemasPregunta,
    rankCd: 0.5,
  };
}

describe("detección de información faltante (US7)", () => {
  test("US7-AC1: la anamnesis sin el contexto de soledad recibe la pregunta sugerida", () => {
    const detectadas = detectMissingInformation({
      anamnesis: [
        entrada("motivo_consulta", "Destroza objetos"),
        entrada("comportamiento_problematico", "Destruye muebles y ladra"),
      ],
      ficha: fichaBase(),
    });
    expect(detectadas.map((sugerencia) => sugerencia.key)).toContain("aloneContext");
  });

  test("US7-AC4: lo que la anamnesis ya cubre no se propone como faltante", () => {
    const detectadas = detectMissingInformation({
      anamnesis: [
        entrada("motivo_consulta", "Destroza objetos"),
        entrada("comportamiento_problematico", "Destruye muebles"),
        entrada("contexto", "Ocurre cuando el animal queda solo, nunca acompañado"),
      ],
      ficha: fichaBase(),
    });
    expect(detectadas.map((sugerencia) => sugerencia.key)).not.toContain("aloneContext");
  });

  test("FR-044 · SC-024 (heredado): el hallazgo negativo explícito cubre el antecedente; solo lo sin dato es faltante", () => {
    const conNegativos = detectMissingInformation({
      anamnesis: [entrada("motivo_consulta", "Consulta de control")],
      ficha: fichaBase(),
    });
    expect(conNegativos.map((sugerencia) => sugerencia.key)).not.toContain("knownAllergies");

    const sinAlergias = detectMissingInformation({
      anamnesis: [entrada("motivo_consulta", "Consulta de control")],
      ficha: {
        ...fichaBase(),
        antecedentes: { ...fichaBase().antecedentes, knownAllergies: [] },
      },
    });
    expect(sinAlergias.map((sugerencia) => sugerencia.key)).toContain("knownAllergies");
  });

  test("US7-AC2 · US7-AC6: la decisión registrada retira la sugerencia de las pendientes y conserva su estado", () => {
    const decisiones: DecisionRegistrada[] = [
      {
        recordId: "m-1",
        content: {
          consultationId: "c-1",
          suggestionKey: "aloneContext",
          pregunta: "¿El comportamiento ocurre solo cuando el animal queda solo?",
          estado: "formulada",
          fundamento: { kind: "criterio_general" },
          camposRelacionados: ["contexto"],
        },
      },
    ];
    const estados = mergeSuggestionStates(
      detectMissingInformation({
        anamnesis: [entrada("motivo_consulta", "Destroza objetos")],
        ficha: fichaBase(),
      }),
      decisiones,
    );
    const alone = estados.find((sugerencia) => sugerencia.key === "aloneContext");
    expect(alone?.estado).toBe("formulada");
    expect(alone?.decisionRecordId).toBe("m-1");
    expect(
      estados.filter((sugerencia) => sugerencia.estado === "pendiente").map((s) => s.key),
    ).not.toContain("aloneContext");
  });

  test("US7-AC2 · HD3: una decisión cuya sugerencia ya no se detecta sigue visible como registro de la consulta", () => {
    const estados = mergeSuggestionStates(
      detectMissingInformation({
        anamnesis: [entrada("motivo_consulta", "Destroza objetos")],
        ficha: fichaBase(),
      }),
      [
        {
          recordId: "m-2",
          content: {
            consultationId: "c-1",
            suggestionKey: "frequency",
            pregunta: "¿Con qué frecuencia ocurre el comportamiento problemático?",
            estado: "no_aplicable",
            fundamento: { kind: "criterio_general" },
            camposRelacionados: ["frecuencia"],
          },
        },
      ],
    );
    const frequency = estados.find((sugerencia) => sugerencia.key === "frequency");
    expect(frequency?.estado).toBe("no_aplicable");
    expect(frequency?.decisionRecordId).toBe("m-2");
  });

  test("D3: una condición no cumplida no se propone (no toda pregunta cabe en todo caso)", () => {
    const detectadas = detectMissingInformation({
      anamnesis: [entrada("alimentacion", "Dieta equilibrada")],
      ficha: fichaBase(),
    });
    expect(detectadas.map((sugerencia) => sugerencia.key)).not.toContain("behaviorProblem");
  });

  test("FR-033 · US7-AC3: con respaldo documental calificado el fundamento es la cita con su texto verbatim", () => {
    const texto =
      "Registrar la conducta cuando el animal queda solo es el primer paso del protocolo.";
    const fundamento = composeFundamento("protocolo ansiedad por separación", [
      candidato(texto, ["ansiedad", "separacion"], ["ansiedad", "separacion"]),
    ]);
    expect(fundamento.kind).toBe("fuente");
    if (fundamento.kind === "fuente") {
      expect(fundamento.cita.textoCitado).toBe(texto);
    }
  });

  test("FR-033 · US7-AC5: sin candidatos calificados el fundamento se declara criterio general", () => {
    expect(composeFundamento("protocolo ansiedad por separación", [])).toEqual({
      kind: "criterio_general",
    });
    const sinCobertura = composeFundamento("protocolo ansiedad por separación", [
      candidato("Texto que no cubre la pregunta.", ["ansiedad", "separacion"], []),
    ]);
    expect(sinCobertura.kind).toBe("criterio_general");
  });

  test("presupuesto: la detección sobre ≤ 50 entradas de anamnesis corre en ≤ 100 ms", () => {
    const anamnesis = Array.from({ length: 50 }, (_, indice) =>
      entrada("texto_libre", `Entrada ${indice} sin términos de cobertura`),
    );
    const inicio = performance.now();
    detectMissingInformation({ anamnesis, ficha: fichaBase() });
    expect(performance.now() - inicio).toBeLessThan(100);
  });
});
