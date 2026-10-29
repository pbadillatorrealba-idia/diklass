import { describe, expect, test } from "bun:test";
import type { EntradaAnamnesis } from "@/features/asistencia/schema";
import {
  composeHipotesisConsideradas,
  composeHipotesisSoportada,
  evaluarReglas,
  evaluateSuficiencia,
  extraerRespaldo,
  MAX_HIPOTESIS_PRESENTADAS,
  MIN_CAMPOS_SUFICIENCIA,
} from "@/features/asistencia/soporte-diferencial";
import type { KnowledgeAnswer } from "@/features/conocimiento/schema";
import type { AnamnesisContent, PatientContent } from "@/features/registro/schema";

/**
 * Soporte al diagnóstico diferencial (D5/D6/D7 de design.md · tasks.md 2.3).
 * Trazabilidad: FR-009 · FR-022 · FR-023 · FR-007 · FR-020 · FR-010 · FR-049 · SC-019 · SC-030 ·
 * SC-031 · US8-AC1/AC3/AC5/AC6/AC7/AC8/AC10.
 */

function entrada(
  field: AnamnesisContent["field"],
  text: string,
  recordId: string,
): EntradaAnamnesis {
  return { recordId, content: { consultationId: "c-1", field, text, provenance: "reportada" } };
}

const ficha: PatientContent = {
  name: "Tobi",
  species: "perro",
  breed: "Mestizo",
  birthDate: null,
  ageMonths: null,
  weightKg: null,
  sex: "macho",
  reproductiveStatus: "castrado",
  antecedentes: {
    medicalHistory: [],
    preexistingDiseases: [],
    currentMedications: [],
    knownAllergies: [],
    behavioralHistory: [],
  },
  tutorId: "t-1",
};

function respuestaConEvidencia(texto: string): KnowledgeAnswer {
  return {
    pregunta: "ansiedad por separación protocolo",
    patientId: "p-1",
    segmentos: [
      {
        id: "ev-1",
        kind: "evidencia",
        provenance: "recuperada",
        texto,
        cita: {
          documentoId: "doc-1",
          fragmentoOrdinal: 3,
          textoCitado: texto,
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
        },
      },
    ],
    cobertura: { estado: "cubre", cubiertos: ["ansiedad", "separacion"], noCubiertos: [] },
    avisos: [],
  };
}

describe("soporte diferencial (US8)", () => {
  test("FR-022 · US8-AC5: con anamnesis insuficiente se declara la insuficiencia nombrando lo faltante", () => {
    const insuficiente = evaluateSuficiencia({
      anamnesis: [entrada("motivo_consulta", "Destroza objetos", "r-1")],
      ficha,
    });
    expect(insuficiente.estado).toBe("insuficiente");
    expect(insuficiente.faltantes.length).toBeGreaterThan(0);

    const vacia = evaluateSuficiencia({ anamnesis: [], ficha });
    expect(vacia.estado).toBe("insuficiente");
    expect(vacia.faltantes).toContain("motivo_consulta");
  });

  test(`FR-022: la suficiencia exige ${MIN_CAMPOS_SUFICIENCIA} campos de anamnesis cubiertos`, () => {
    const insuficiente = evaluateSuficiencia({
      anamnesis: [
        entrada("motivo_consulta", "Destroza objetos", "r-1"),
        entrada("contexto", "Cuando queda solo", "r-2"),
      ],
      ficha,
    });
    expect(insuficiente.estado).toBe("insuficiente");

    const suficiente = evaluateSuficiencia({
      anamnesis: [
        entrada("motivo_consulta", "Destroza objetos", "r-1"),
        entrada("contexto", "Cuando queda solo", "r-2"),
        entrada("frecuencia", "Diaria", "r-3"),
      ],
      ficha,
    });
    expect(suficiente.estado).toBe("suficiente");
  });

  test("FR-009 · US8-AC1: la regla clasifica los antecedentes a favor y en contra con sus referencias y procedencia", () => {
    const matches = evaluarReglas({
      anamnesis: [
        entrada("contexto", "Ocurre cuando el animal queda solo", "r-1"),
        entrada("contexto", "Pero también en presencia del tutor acompañado", "r-2"),
        entrada("frecuencia", "Diaria", "r-3"),
      ],
      ficha,
    });
    const separacion = matches.find((match) => match.regla.id === "separationAnxiety");
    expect(separacion).toBeDefined();
    expect(separacion?.aFavor.map((insumo) => insumo.ref)).toContain("r-1");
    // Caso límite «antecedentes contradictorios»: la contradicción se refleja, no se elige rama.
    expect(separacion?.enContra.length).toBeGreaterThan(0);
    expect(matches.length).toBeLessThanOrEqual(MAX_HIPOTESIS_PRESENTADAS);
  });

  test("SC-019: toda hipótesis presenta a favor, en contra (o su ausencia explícita) y faltante", () => {
    const presentada = composeHipotesisSoportada({
      key: "h-1",
      texto: "Ansiedad por separación",
      origen: "sistema",
      decision: "added",
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
        ficha: [],
        faltante: ["frecuencia"],
        terminosMatch: ["solo"],
      },
      respaldo: extraerRespaldo(
        respuestaConEvidencia("La conducta en ausencia del tutor es el criterio clave."),
        "q-1",
      ),
    });

    expect(presentada.analisis.aFavor.items.length).toBe(1);
    expect(presentada.analisis.aFavor.ausencia).toBeNull();
    expect(presentada.analisis.enContra.items).toHaveLength(0);
    expect(presentada.analisis.enContra.ausencia).toContain("Sin antecedentes en contra");
    expect(presentada.analisis.faltante.campos).toEqual(["frecuencia"]);

    const sinAnalisis = composeHipotesisSoportada({
      key: "h-2",
      texto: "Hipótesis propia",
      origen: "veterinario",
      decision: "added",
      reglaId: null,
      insumos: { anamnesis: [], ficha: [], faltante: [], terminosMatch: [] },
      respaldo: extraerRespaldo(null, null),
    });
    expect(sinAnalisis.analisis.aFavor.ausencia).toContain("Sin antecedentes a favor");
    expect(sinAnalisis.analisis.enContra.ausencia).toContain("Sin antecedentes en contra");
    expect(sinAnalisis.analisis.faltante.ausencia).toContain("Sin información faltante");
  });

  test("FR-023 · US8-AC7 · SC-030: la ausencia de respaldo documental se declara, nunca se oculta", () => {
    const sinRespaldo = composeHipotesisSoportada({
      key: "h-3",
      texto: "Hipótesis sin respaldo",
      origen: "veterinario",
      decision: "added",
      reglaId: null,
      insumos: { anamnesis: [], ficha: [], faltante: [], terminosMatch: [] },
      respaldo: extraerRespaldo(null, null),
    });
    expect(sinRespaldo.respaldo.sinRespaldo).toBe(true);
    expect(sinRespaldo.respaldo.avisos).toContain("sin_respaldo_documental");
  });

  test("FR-007 · US8-AC10: la evidencia llega como cita con el fragmento concreto, no solo su título", () => {
    const texto = "La conducta en ausencia del tutor es el criterio clave del protocolo.";
    const presentada = composeHipotesisSoportada({
      key: "h-4",
      texto: "Ansiedad por separación",
      origen: "sistema",
      decision: "added",
      reglaId: "separationAnxiety",
      insumos: { anamnesis: [], ficha: [], faltante: [], terminosMatch: ["solo"] },
      respaldo: extraerRespaldo(respuestaConEvidencia(texto), "q-2"),
    });
    expect(presentada.respaldo.citas[0]?.textoCitado).toBe(texto);
    expect(presentada.respaldo.citas[0]?.fragmentoOrdinal).toBe(3);
    expect(presentada.respaldo.sinRespaldo).toBe(false);
  });

  test("FR-010 · US8-AC3 · SC-031: toda presentación lleva el descargo y no se declara diagnóstico definitivo", () => {
    const presentada = composeHipotesisSoportada({
      key: "h-5",
      texto: "Ansiedad por separación",
      origen: "sistema",
      decision: "added",
      reglaId: null,
      insumos: { anamnesis: [], ficha: [], faltante: [], terminosMatch: [] },
      respaldo: extraerRespaldo(null, null),
    });
    expect(presentada.descargo).toContain("no constituye un diagnóstico");
    expect(JSON.stringify(presentada).toLowerCase()).not.toContain(
      "diagnóstico definitivo del sistema",
    );
  });

  test("FR-020 · US8-AC8: la presentación conserva los insumos que la produjeron (referencias y términos)", () => {
    const presentada = composeHipotesisSoportada({
      key: "h-6",
      texto: "Ansiedad por separación",
      origen: "sistema",
      decision: "added",
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
            papel: "aFavor",
          },
        ],
        faltante: ["frecuencia"],
        terminosMatch: ["solo"],
      },
      respaldo: extraerRespaldo(respuestaConEvidencia("Evidencia."), "q-3"),
    });
    expect(presentada.insumos.anamnesis[0]?.recordId).toBe("r-1");
    expect(presentada.insumos.ficha[0]?.fichaRef).toBe("antecedentes.behavioralHistory[0]");
    expect(presentada.insumos.terminosMatch).toEqual(["solo"]);
  });

  test("FR-049 · US8-AC6: las hipótesis y su estado quedan disponibles para la epicrisis", () => {
    const consideradas = composeHipotesisConsideradas([
      {
        consultationId: "c-1",
        texto: "Ansiedad por separación",
        decision: "accepted",
        origen: "sistema",
        reglaId: "separationAnxiety",
        insumos: { anamnesis: [], ficha: [], faltante: [], terminosMatch: [] },
        respaldo: extraerRespaldo(null, null),
      },
      {
        consultationId: "c-1",
        texto: "Fobia a ruidos",
        decision: "discarded",
        origen: "sistema",
        reglaId: "noisePhobia",
        insumos: { anamnesis: [], ficha: [], faltante: [], terminosMatch: [] },
        respaldo: extraerRespaldo(null, null),
      },
      {
        consultationId: "c-1",
        texto: "Hipótesis propia",
        decision: "added",
        origen: "veterinario",
        reglaId: null,
        insumos: { anamnesis: [], ficha: [], faltante: [], terminosMatch: [] },
        respaldo: extraerRespaldo(null, null),
      },
    ]);
    expect(consideradas).toEqual([
      { texto: "Ansiedad por separación", estado: "aceptada" },
      { texto: "Fobia a ruidos", estado: "descartada" },
      { texto: "Hipótesis propia", estado: "propuesta" },
    ]);
  });

  test("presupuesto: componer 3 hipótesis con respaldo corre en ≤ 300 ms", () => {
    const inicio = performance.now();
    for (let indice = 0; indice < 3; indice += 1) {
      composeHipotesisSoportada({
        key: `h-${indice}`,
        texto: "Ansiedad por separación",
        origen: "sistema",
        decision: "added",
        reglaId: "separationAnxiety",
        insumos: { anamnesis: [], ficha: [], faltante: [], terminosMatch: ["solo"] },
        respaldo: extraerRespaldo(respuestaConEvidencia("Evidencia."), `q-${indice}`),
      });
    }
    expect(performance.now() - inicio).toBeLessThan(300);
  });
});
