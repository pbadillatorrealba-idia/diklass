import { describe, expect, test } from "bun:test";
import {
  DESCARGO_ASISTENCIA,
  decisionHipotesisSchema,
  decisionSugerenciaSchema,
  fundamentoSchema,
  hypothesisContentSchema,
  missingInformationContentSchema,
} from "@/features/asistencia/schema";

/**
 * Frontera Zod de la asistencia clínica proactiva (D2 de design.md · tasks.md 2.1).
 * Trazabilidad: FR-008 · FR-033 · FR-009 · FR-029 · FR-021 · FR-020 · FR-023 · FR-010 · US7 · US8.
 */

const fundamentoCriterio = { kind: "criterio_general" } as const;

const fundamentoFuente = {
  kind: "fuente",
  cita: {
    documentoId: "doc-1",
    fragmentoOrdinal: 2,
    textoCitado:
      "El protocolo de ansiedad por separación exige registrar la conducta cuando el animal queda solo.",
    bibliografia: {
      titulo: "Protocolo de modificación de conducta (ficticio)",
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
  },
} as const;

const insumosVacios = {
  anamnesis: [],
  ficha: [],
  faltante: [],
  terminosMatch: [],
};

const respaldoVacio = {
  knowledgeQueryId: null,
  citas: [],
  avisos: ["sin_respaldo_documental"],
  cobertura: null,
};

describe("schema de la asistencia (D2)", () => {
  test("US7-AC6 · FR-008: la fila missing_information es una decisión registrada con su pregunta y fundamento", () => {
    const content = missingInformationContentSchema.parse({
      consultationId: "c-1",
      suggestionKey: "aloneContext",
      pregunta: "¿El comportamiento ocurre solo cuando el animal queda solo?",
      estado: "formulada",
      fundamento: fundamentoCriterio,
      camposRelacionados: ["contexto"],
    });
    expect(content.estado).toBe("formulada");
    expect(content.suggestionKey).toBe("aloneContext");
  });

  test("D3 · HD3: el estado pendiente nunca se persiste (es derivado por detección)", () => {
    expect(
      missingInformationContentSchema.safeParse({
        consultationId: "c-1",
        suggestionKey: "aloneContext",
        pregunta: "¿El comportamiento ocurre solo cuando el animal queda solo?",
        estado: "pendiente",
        fundamento: fundamentoCriterio,
        camposRelacionados: ["contexto"],
      }).success,
    ).toBe(false);
    expect(decisionSugerenciaSchema.safeParse("ignorada").success).toBe(true);
  });

  test("FR-033 · US7-AC3: el fundamento documental exige la cita documento+fragmento con su texto verbatim", () => {
    const fundamento = fundamentoSchema.parse(fundamentoFuente);
    expect(fundamento.kind).toBe("fuente");
    if (fundamento.kind === "fuente") {
      expect(fundamento.cita.documentoId).toBe("doc-1");
      expect(fundamento.cita.fragmentoOrdinal).toBe(2);
      expect(fundamento.cita.textoCitado.length).toBeGreaterThan(0);
    }
    expect(
      fundamentoSchema.safeParse({
        kind: "fuente",
        cita: { ...fundamentoFuente.cita, textoCitado: "" },
      }).success,
    ).toBe(false);
  });

  test("FR-033 · US7-AC5: el criterio general no lleva cita ni se confunde con una fuente", () => {
    const fundamento = fundamentoSchema.parse(fundamentoCriterio);
    expect(fundamento).toEqual({ kind: "criterio_general" });
    expect(
      fundamentoSchema.safeParse({ kind: "criterio_general", cita: fundamentoFuente.cita }).success,
    ).toBe(false);
  });

  test("FR-029 · US8-AC2: la hipótesis nace con decision=added y transiciona a accepted|discarded", () => {
    const content = hypothesisContentSchema.parse({
      consultationId: "c-1",
      texto: "Ansiedad por separación",
      decision: "added",
      origen: "sistema",
      reglaId: "separationAnxiety",
      insumos: insumosVacios,
      respaldo: respaldoVacio,
    });
    expect(content.decision).toBe("added");
    expect(decisionHipotesisSchema.safeParse("accepted").success).toBe(true);
    expect(decisionHipotesisSchema.safeParse("discarded").success).toBe(true);
    expect(decisionHipotesisSchema.safeParse("pendiente").success).toBe(false);
  });

  test("FR-029 · US8-AC9: el origen distingue la hipótesis del sistema de la del veterinario", () => {
    expect(
      hypothesisContentSchema.safeParse({
        consultationId: "c-1",
        texto: "Hipótesis propia",
        decision: "added",
        origen: "veterinario",
        reglaId: null,
        insumos: insumosVacios,
        respaldo: respaldoVacio,
      }).success,
    ).toBe(true);
    expect(
      hypothesisContentSchema.safeParse({
        consultationId: "c-1",
        texto: "Hipótesis propia",
        decision: "added",
        origen: "el_sistema_lo_sabe",
        reglaId: null,
        insumos: insumosVacios,
        respaldo: respaldoVacio,
      }).success,
    ).toBe(false);
  });

  test("FR-020 · US8-AC8 · FR-021: los insumos conservan referencias, procedencia canónica y papel a favor/en contra", () => {
    const content = hypothesisContentSchema.parse({
      consultationId: "c-1",
      texto: "Ansiedad por separación",
      decision: "added",
      origen: "sistema",
      reglaId: "separationAnxiety",
      insumos: {
        anamnesis: [
          {
            recordId: "r-1",
            field: "contexto",
            text: "Ocurre cuando el animal queda solo",
            provenance: "reportada",
            papel: "aFavor",
          },
        ],
        ficha: [
          {
            fichaRef: "antecedentes.behavioralHistory[0]",
            valor: "Ansiedad previa",
            papel: "enContra",
          },
        ],
        faltante: ["frecuencia", "duracion"],
        terminosMatch: ["solo"],
      },
      respaldo: respaldoVacio,
    });
    expect(content.insumos.anamnesis[0]?.recordId).toBe("r-1");
    expect(content.insumos.anamnesis[0]?.provenance).toBe("reportada");
    expect(content.insumos.ficha[0]?.papel).toBe("enContra");
    expect(content.insumos.terminosMatch).toEqual(["solo"]);
    expect(
      hypothesisContentSchema.safeParse({
        consultationId: "c-1",
        texto: "Ansiedad por separación",
        decision: "added",
        origen: "sistema",
        reglaId: null,
        insumos: {
          ...insumosVacios,
          anamnesis: [
            {
              recordId: "r-1",
              field: "contexto",
              text: "texto",
              provenance: "hipotetica",
              papel: "aFavor",
            },
          ],
        },
        respaldo: respaldoVacio,
      }).success,
    ).toBe(false);
  });

  test("FR-007 · FR-023: el respaldo lleva citas verbatim y avisos del contrato de 003", () => {
    const content = hypothesisContentSchema.parse({
      consultationId: "c-1",
      texto: "Ansiedad por separación",
      decision: "added",
      origen: "sistema",
      reglaId: null,
      insumos: insumosVacios,
      respaldo: {
        knowledgeQueryId: "q-1",
        citas: [fundamentoFuente.cita],
        avisos: ["sin_respaldo_documental", "fuente_retirada"],
        cobertura: { estado: "parcial", cubiertos: ["ansiedad"], noCubiertos: ["protocolo"] },
      },
    });
    expect(content.respaldo.citas[0]?.textoCitado).toBe(fundamentoFuente.cita.textoCitado);
    expect(content.respaldo.avisos).toContain("sin_respaldo_documental");
  });

  test("FR-010 · SC-031: el descargo de la presentación declara que no es diagnóstico definitivo", () => {
    expect(DESCARGO_ASISTENCIA).toContain("no constituye un diagnóstico");
    expect(DESCARGO_ASISTENCIA).toContain("validación del veterinario");
  });
});
