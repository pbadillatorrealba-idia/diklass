import { describe, expect, test } from "bun:test";
import {
  buildFragmentContext,
  type CandidatoFragmento,
  composeAnswer,
  resolveCitations,
  splitIntoFragments,
} from "@/features/conocimiento/answer";
import type { PatientContent } from "@/features/registro/schema";

/**
 * Contrato de la respuesta del asistente (D5 de design.md). Tarea 2.2. Toda afirmación
 * clínica de la respuesta es una cita verbatim (SC-010 por construcción) y el resto de
 * reglas —FR-021, FR-022, FR-023, FR-051, FR-052, FR-053— son observables aquí.
 */

const bibliografia = {
  titulo: "Guía de ansiedad por separación (ficticia)",
  autores: ["Dra. Ficticia Tres"],
  anio: 2025,
  revista: "Cuadernos Ficticios de Conducta",
  editorial: null,
  edicion: null,
  doi: null,
  url: null,
};

const licencia = { tipo: "CC BY 4.0 (ficticia)", nota: null };

function candidato(cambios: Partial<CandidatoFragmento> = {}): CandidatoFragmento {
  return {
    documentoId: "doc-1",
    fragmentoOrdinal: 1,
    texto:
      "La ansiedad por separación se diagnostica por la historia clínica y la videovigilancia.",
    seccion: "Diagnóstico",
    bibliografia,
    licencia,
    estado: "available",
    lemasCubiertos: ["ansied", "separ"],
    lemasPregunta: ["ansied", "separ"],
    rankCd: 0.5,
    ...cambios,
  };
}

function paciente(): { id: string; content: PatientContent } {
  return {
    id: "patient-1",
    content: {
      name: "Luna",
      species: "perro",
      breed: "Mestizo",
      birthDate: null,
      ageMonths: 24,
      weightKg: null,
      sex: "hembra",
      reproductiveStatus: "esterilizada",
      antecedentes: {
        medicalHistory: [{ text: "Displasia de cadera", negative: false }],
        preexistingDiseases: [],
        currentMedications: [{ text: "Fluoxetina 20 mg", negative: false }],
        knownAllergies: [],
        behavioralHistory: [{ text: "Miedo a fuegos artificiales", negative: true }],
      },
      tutorId: "tutor-1",
    },
  };
}

const pregunta = "¿Qué antecedentes revisar ante ansiedad por separación?";

describe("composeAnswer sin respaldo documental (FR-023 · SC-025 · SC-010 · US5-AC2)", () => {
  test("declara la ausencia de respaldo y no afirma contenido clínico alguno", () => {
    const answer = composeAnswer({
      pregunta,
      lemasPregunta: ["ansied", "separ"],
      candidatos: [],
      paciente: paciente(),
    });

    expect(answer.cobertura.estado).toBe("sin_evidencia");
    expect(answer.avisos).toContain("sin_respaldo_documental");
    const evidencias = answer.segmentos.filter((s) => s.kind === "evidencia");
    const inferencias = answer.segmentos.filter((s) => s.kind === "inferencia");
    expect(evidencias).toHaveLength(0);
    expect(inferencias).toHaveLength(0);
    // La ficha puede mostrarse, siempre etiquetada como ficha (nunca como respaldo).
    expect(answer.segmentos.every((s) => s.kind === "ficha")).toBe(true);
  });

  test("un candidato bajo el umbral de cobertura de lemas no cuenta como respaldo", () => {
    const answer = composeAnswer({
      pregunta,
      lemasPregunta: ["ansied", "separ", "tratamient"],
      candidatos: [candidato({ lemasCubiertos: ["ansied"] })],
      paciente: null,
    });

    expect(answer.cobertura.estado).toBe("sin_evidencia");
    expect(answer.avisos).toEqual(
      expect.arrayContaining(["sin_respaldo_documental", "sin_paciente_seleccionado"]),
    );
    expect(answer.segmentos.filter((s) => s.kind === "evidencia")).toHaveLength(0);
  });
});

describe("composeAnswer con respaldo (FR-007 · FR-021 · SC-003 · US5-AC1/AC3)", () => {
  test("cita el fragmento verbatim con documento, fragmento y bibliografia", () => {
    const fragmento = candidato();
    const answer = composeAnswer({
      pregunta,
      lemasPregunta: ["ansied", "separ"],
      candidatos: [fragmento],
      paciente: null,
    });

    const evidencia = answer.segmentos.find((s) => s.kind === "evidencia");
    expect(evidencia?.kind).toBe("evidencia");
    if (evidencia?.kind !== "evidencia") throw new Error("sin evidencia");
    expect(evidencia.provenance).toBe("recuperada");
    expect(evidencia.cita.textoCitado).toBe(fragmento.texto);
    expect(evidencia.texto).toBe(fragmento.texto);
    expect(evidencia.cita.documentoId).toBe("doc-1");
    expect(evidencia.cita.fragmentoOrdinal).toBe(1);
    expect(evidencia.cita.bibliografia.titulo).toBe(bibliografia.titulo);
    expect(evidencia.cita.licencia.tipo).toBe(licencia.tipo);
  });

  test("distingue los tres orígenes: fuente, ficha e inferencia del sistema (FR-021 · US5-AC3)", () => {
    const answer = composeAnswer({
      pregunta,
      lemasPregunta: ["ansied", "separ"],
      candidatos: [candidato()],
      paciente: paciente(),
    });

    const kinds = new Set(answer.segmentos.map((s) => s.kind));
    expect([...kinds].sort()).toEqual(["evidencia", "ficha", "inferencia"]);
    for (const segmento of answer.segmentos) {
      if (segmento.kind === "evidencia") expect(segmento.provenance).toBe("recuperada");
      if (segmento.kind === "inferencia") expect(segmento.provenance).toBe("inferida");
      if (segmento.kind === "ficha") {
        expect(["reportada", "desconocida"]).toContain(segmento.provenance);
      }
    }
  });

  test("los datos de ficha llevan fichaRef y snapshot de lo usado, y lo sin dato es desconocida (FR-020 · FR-021 · US5-AC5)", () => {
    const answer = composeAnswer({
      pregunta,
      lemasPregunta: ["ansied", "separ"],
      candidatos: [candidato()],
      paciente: paciente(),
    });

    const ficha = answer.segmentos.filter((s) => s.kind === "ficha");
    if (!ficha.every((s) => s.kind === "ficha")) throw new Error("segmento mal tipado");
    const refs = ficha.map((s) => s.fichaRef);
    expect(refs).toContain("name");
    expect(refs).toContain("antecedentes.medicalHistory[0]");
    expect(refs).toContain("birthDate");
    const sinDato = ficha.find((s) => s.fichaRef === "birthDate");
    expect(sinDato?.provenance).toBe("desconocida");
    expect(sinDato?.texto).toContain("sin dato");
    expect(ficha.find((s) => s.fichaRef === "antecedentes.behavioralHistory[0]")?.texto).toContain(
      "hallazgo negativo",
    );
    expect(answer.patientId).toBe("patient-1");
  });

  test("la inferencia nombra lo cubierto y declara su propio origen (FR-021 · FR-022)", () => {
    const answer = composeAnswer({
      pregunta,
      lemasPregunta: ["ansied", "separ"],
      candidatos: [candidato()],
      paciente: null,
    });

    const inferencia = answer.segmentos.find((s) => s.kind === "inferencia");
    expect(inferencia?.kind).toBe("inferencia");
    if (inferencia?.kind !== "inferencia") throw new Error("sin inferencia");
    expect(inferencia.texto).toContain("derivación del sistema");
    expect(answer.cobertura).toEqual({
      estado: "cubre",
      cubiertos: ["ansied", "separ"],
      noCubiertos: [],
    });
  });
});

describe("composeAnswer cobertura parcial (FR-022 · US5-AC8)", () => {
  test("nombra explícitamente qué parte de la pregunta queda sin cubrir", () => {
    const answer = composeAnswer({
      pregunta,
      lemasPregunta: ["ansied", "separ", "tratamient"],
      candidatos: [candidato({ lemasCubiertos: ["ansied", "separ"] })],
      paciente: null,
    });

    expect(answer.cobertura.estado).toBe("parcial");
    expect(answer.cobertura.cubiertos).toEqual(["ansied", "separ"]);
    expect(answer.cobertura.noCubiertos).toEqual(["tratamient"]);
    expect(answer.avisos).toContain("cobertura_parcial");
  });
});

describe("composeAnswer múltiples fuentes (FR-052 · US5-AC11)", () => {
  test("presenta todas las fuentes con su cita y declara que no hay arbitraje", () => {
    const answer = composeAnswer({
      pregunta,
      lemasPregunta: ["ansied", "separ"],
      candidatos: [
        candidato({ documentoId: "doc-1" }),
        candidato({ documentoId: "doc-2", fragmentoOrdinal: 2, rankCd: 0.4 }),
      ],
      paciente: null,
    });

    const evidencias = answer.segmentos.filter((s) => s.kind === "evidencia");
    expect(evidencias).toHaveLength(2);
    expect(answer.avisos).toContain("fuentes_multiples");
  });

  test("un único documento no dispara el aviso de múltiples fuentes", () => {
    const answer = composeAnswer({
      pregunta,
      lemasPregunta: ["ansied", "separ"],
      candidatos: [
        candidato({ documentoId: "doc-1" }),
        candidato({ documentoId: "doc-1", fragmentoOrdinal: 2 }),
      ],
      paciente: null,
    });
    expect(answer.avisos).not.toContain("fuentes_multiples");
  });
});

describe("composeAnswer sin paciente seleccionado (FR-051 · US5-AC10)", () => {
  test("no atribuye datos de ningún paciente y lo declara", () => {
    const answer = composeAnswer({
      pregunta,
      lemasPregunta: ["ansied", "separ"],
      candidatos: [candidato()],
      paciente: null,
    });

    expect(answer.patientId).toBeNull();
    expect(answer.segmentos.filter((s) => s.kind === "ficha")).toHaveLength(0);
    expect(answer.avisos).toContain("sin_paciente_seleccionado");
  });
});

describe("composeAnswer top-5 y presupuesto (SC-002 · D4)", () => {
  test("muestra como máximo cinco referencias, en orden de ranking", () => {
    const candidatos = Array.from({ length: 7 }, (_, i) =>
      candidato({
        documentoId: `doc-${i + 1}`,
        fragmentoOrdinal: i + 1,
        rankCd: 1 - i / 10,
      }),
    );
    const answer = composeAnswer({
      pregunta,
      lemasPregunta: ["ansied", "separ"],
      candidatos,
      paciente: null,
    });

    const evidencias = answer.segmentos.filter((s) => s.kind === "evidencia");
    expect(evidencias).toHaveLength(5);
    if (!evidencias.every((s) => s.kind === "evidencia")) throw new Error("segmento mal tipado");
    expect(evidencias.map((s) => s.cita.documentoId)).toEqual([
      "doc-1",
      "doc-2",
      "doc-3",
      "doc-4",
      "doc-5",
    ]);
  });

  test("compone 25 candidatos dentro del presupuesto de 200 ms", () => {
    const candidatos = Array.from({ length: 25 }, (_, i) => candidato({ documentoId: `doc-${i}` }));
    const inicio = performance.now();
    for (let i = 0; i < 20; i += 1) {
      composeAnswer({
        pregunta,
        lemasPregunta: ["ansied", "separ"],
        candidatos,
        paciente: paciente(),
      });
    }
    expect(performance.now() - inicio).toBeLessThan(200);
  });
});

describe("resolveCitations (FR-053 · US5-AC12)", () => {
  test("una cita hacia una fuente retirada sigue identificable y queda marcada", () => {
    const guardada = composeAnswer({
      pregunta,
      lemasPregunta: ["ansied", "separ"],
      candidatos: [candidato()],
      paciente: null,
    });

    const resuelta = resolveCitations(guardada, { "doc-1": "withdrawn" });
    const evidencia = resuelta.segmentos.find((s) => s.kind === "evidencia");
    if (evidencia?.kind !== "evidencia") throw new Error("sin evidencia");
    expect(evidencia.cita.bibliografia.titulo).toBe(bibliografia.titulo);
    expect(evidencia.cita.estado).toBe("withdrawn");
    expect(resuelta.avisos).toContain("fuente_retirada");
    expect(guardada.avisos).not.toContain("fuente_retirada");
  });

  test("sin fuentes retiradas no añade el aviso", () => {
    const guardada = composeAnswer({
      pregunta,
      lemasPregunta: ["ansied", "separ"],
      candidatos: [candidato()],
      paciente: null,
    });
    expect(resolveCitations(guardada, { "doc-1": "available" }).avisos).not.toContain(
      "fuente_retirada",
    );
  });
});

describe("buildFragmentContext (FR-007 · US5-AC7)", () => {
  const documento = {
    id: "doc-1",
    bibliografia,
    licencia,
    estado: "available" as const,
    fragmentos: [
      { ordinal: 1, seccion: "Uno", texto: "Primer fragmento." },
      { ordinal: 2, seccion: "Dos", texto: "Segundo fragmento, el citado." },
      { ordinal: 3, seccion: "Dos", texto: "Tercer fragmento." },
      { ordinal: 4, seccion: "Tres", texto: "Fragmento lejano." },
    ],
  };

  test("muestra el fragmento citado en su contexto, con vecinos y resaltado", () => {
    const contexto = buildFragmentContext(documento, 2);
    expect(contexto.bibliografia.titulo).toBe(bibliografia.titulo);
    expect(contexto.fragmentos.map((f) => f.ordinal)).toEqual([1, 2, 3]);
    expect(contexto.fragmentos.find((f) => f.citado)?.texto).toContain("el citado");
    expect(contexto.fragmentos.filter((f) => f.citado)).toHaveLength(1);
  });
});

describe("splitIntoFragments (D2 · ingesta)", () => {
  test("parte por párrafos, hereda encabezados de sección y numera en orden", () => {
    const fragmentos = splitIntoFragments(
      [
        "# Diagnóstico",
        "",
        "Primer párrafo.",
        "Sigue el mismo.",
        "",
        "## Manejo",
        "",
        "Segundo párrafo.",
      ].join("\n"),
    );

    expect(fragmentos).toEqual([
      { ordinal: 1, seccion: "Diagnóstico", texto: "Primer párrafo.\nSigue el mismo." },
      { ordinal: 2, seccion: "Manejo", texto: "Segundo párrafo." },
    ]);
  });

  test("es determinista y devuelve vacío sobre solo encabezados", () => {
    const texto = "# Solo encabezado\n";
    expect(splitIntoFragments(texto)).toEqual(splitIntoFragments(texto));
    expect(splitIntoFragments(texto)).toEqual([]);
  });
});
