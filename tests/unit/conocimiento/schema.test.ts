import { describe, expect, test } from "bun:test";
import {
  AvisoRespuesta,
  avisoRespuestaSchema,
  bibliografiaSchema,
  fragmentoRecuperadoSchema,
  fuenteContentSchema,
  knowledgeAnswerSchema,
  knowledgeQueryRowSchema,
  segmentoRespuestaSchema,
} from "@/features/conocimiento/schema";

/**
 * Frontera de validación de la base de conocimiento (D2/D5/D6 de design.md). Tarea 2.1.
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

const licencia = { tipo: "CC BY 4.0 (ficticia)", nota: "Corpus sintético de demostración" };

const fuente = {
  bibliografia,
  licencia,
  fragmentos: [
    {
      ordinal: 1,
      seccion: "Diagnóstico",
      texto: "La ansiedad por separación se diagnostica por la historia clínica.",
    },
    {
      ordinal: 2,
      seccion: null,
      texto: "El enriquecimiento ambiental reduce la ansiedad generalizada.",
    },
  ],
};

describe("fuenteContentSchema (FR-030 · FR-006 · US5-AC9 · D2)", () => {
  test("acepta una fuente con bibliografia, licencia y fragmentos numerados", () => {
    const resultado = fuenteContentSchema.safeParse(fuente);
    expect(resultado.success).toBe(true);
  });

  test("normaliza campos bibliograficos ausentes sin inventar valores", () => {
    const resultado = bibliografiaSchema.parse({ titulo: "Solo título" });
    expect(resultado).toEqual({
      titulo: "Solo título",
      autores: [],
      anio: null,
      revista: null,
      editorial: null,
      edicion: null,
      doi: null,
      url: null,
    });
  });

  test("rechaza una fuente sin titulo bibliografico (FR-030)", () => {
    const resultado = fuenteContentSchema.safeParse({
      ...fuente,
      bibliografia: { ...bibliografia, titulo: "  " },
    });
    expect(resultado.success).toBe(false);
  });

  test("rechaza una fuente sin tipo de licencia (decisión de usuario: metadatos de licencia)", () => {
    const resultado = fuenteContentSchema.safeParse({
      ...fuente,
      licencia: { tipo: "", nota: null },
    });
    expect(resultado.success).toBe(false);
  });

  test("rechaza una fuente sin fragmentos: no habría nada que citar (FR-006 · FR-007)", () => {
    const resultado = fuenteContentSchema.safeParse({ ...fuente, fragmentos: [] });
    expect(resultado.success).toBe(false);
  });

  test("rechaza ordinales de fragmento no consecutivos (D2)", () => {
    const resultado = fuenteContentSchema.safeParse({
      ...fuente,
      fragmentos: [
        { ordinal: 1, seccion: null, texto: "Uno." },
        { ordinal: 3, seccion: null, texto: "Tres." },
      ],
    });
    expect(resultado.success).toBe(false);
  });

  test("rechaza ordinales repetidos (D2)", () => {
    const resultado = fuenteContentSchema.safeParse({
      ...fuente,
      fragmentos: [
        { ordinal: 1, seccion: null, texto: "Uno." },
        { ordinal: 1, seccion: null, texto: "Otro." },
      ],
    });
    expect(resultado.success).toBe(false);
  });

  test("rechaza un fragmento sin texto citable", () => {
    const resultado = fuenteContentSchema.safeParse({
      ...fuente,
      fragmentos: [{ ordinal: 1, seccion: null, texto: " " }],
    });
    expect(resultado.success).toBe(false);
  });
});

describe("segmentoRespuestaSchema (FR-007 · FR-021 · US5-AC3 · D5)", () => {
  const cita = {
    documentoId: "doc-1",
    fragmentoOrdinal: 1,
    textoCitado: "La ansiedad por separación se diagnostica por la historia clínica.",
    bibliografia,
    licencia,
    estado: "available" as const,
  };

  test("el segmento de evidencia exige cita documento+fragmento con texto citado (FR-007 · US5-AC1/AC7)", () => {
    const resultado = segmentoRespuestaSchema.safeParse({
      id: "evidencia-doc-1-1",
      kind: "evidencia",
      provenance: "recuperada",
      texto: cita.textoCitado,
      cita,
    });
    expect(resultado.success).toBe(true);

    const sinCita = segmentoRespuestaSchema.safeParse({
      id: "evidencia-doc-1-1",
      kind: "evidencia",
      provenance: "recuperada",
      texto: cita.textoCitado,
    });
    expect(sinCita.success).toBe(false);
  });

  test("la evidencia documental se marca con la procedencia canónica recuperada (FR-021)", () => {
    const resultado = segmentoRespuestaSchema.safeParse({
      id: "evidencia-doc-1-1",
      kind: "evidencia",
      provenance: "inferida",
      texto: cita.textoCitado,
      cita,
    });
    expect(resultado.success).toBe(false);
  });

  test("el segmento de ficha solo admite reportada o desconocida (FR-021 · US5-AC3)", () => {
    for (const provenance of ["reportada", "desconocida"]) {
      const resultado = segmentoRespuestaSchema.safeParse({
        id: "ficha-name",
        kind: "ficha",
        provenance,
        texto: "Nombre: Luna",
        fichaRef: "name",
      });
      expect(resultado.success).toBe(true);
    }
    for (const provenance of ["recuperada", "inferida"]) {
      const resultado = segmentoRespuestaSchema.safeParse({
        id: "ficha-name",
        kind: "ficha",
        provenance,
        texto: "Nombre: Luna",
        fichaRef: "name",
      });
      expect(resultado.success).toBe(false);
    }
  });

  test("el segmento de inferencia del sistema exige su procedencia (FR-021)", () => {
    const resultado = segmentoRespuestaSchema.safeParse({
      id: "inferencia-1",
      kind: "inferencia",
      provenance: "inferida",
      texto: "El sistema asoció la pregunta a los conceptos «ansiedad».",
    });
    expect(resultado.success).toBe(true);

    const equivocado = segmentoRespuestaSchema.safeParse({
      id: "inferencia-1",
      kind: "inferencia",
      provenance: "recuperada",
      texto: "El sistema asoció la pregunta a los conceptos «ansiedad».",
    });
    expect(equivocado.success).toBe(false);
  });

  test("rechaza un origen de segmento desconocido (los tres orígenes son taxativos)", () => {
    const resultado = segmentoRespuestaSchema.safeParse({
      id: "otro-1",
      kind: "voz",
      provenance: "reportada",
      texto: "Cualquiera.",
    });
    expect(resultado.success).toBe(false);
  });
});

describe("knowledgeAnswerSchema (FR-020 · FR-022 · FR-023 · US5-AC5 · D5/D6)", () => {
  test("define los ocho avisos del contrato", () => {
    expect([...AvisoRespuesta]).toEqual([
      "sin_respaldo_documental",
      "cobertura_parcial",
      "fuentes_multiples",
      "sin_paciente_seleccionado",
      "fuente_retirada",
      "evidencia_truncada",
      "cita_irresoluble",
      "ficha_no_disponible",
    ]);
    for (const aviso of AvisoRespuesta) {
      expect(avisoRespuestaSchema.safeParse(aviso).success).toBe(true);
    }
    expect(avisoRespuestaSchema.safeParse("sin_terminos").success).toBe(false);
  });

  test("acepta una respuesta completa y la forma persistida de knowledge_queries (FR-020 · US5-AC5)", () => {
    const answer = knowledgeAnswerSchema.parse({
      pregunta: "¿Qué antecedentes revisar ante ansiedad por separación?",
      patientId: "patient-1",
      segmentos: [
        {
          id: "evidencia-doc-1-1",
          kind: "evidencia",
          provenance: "recuperada",
          texto: "La ansiedad por separación se diagnostica por la historia clínica.",
          cita: {
            documentoId: "doc-1",
            fragmentoOrdinal: 1,
            textoCitado: "La ansiedad por separación se diagnostica por la historia clínica.",
            bibliografia,
            licencia,
            estado: "available",
          },
        },
      ],
      cobertura: { estado: "cubre", cubiertos: ["ansiedad", "separacion"], noCubiertos: [] },
      avisos: [],
    });
    expect(answer.patientId).toBe("patient-1");

    const fila = knowledgeQueryRowSchema.safeParse({
      id: "f0f0f0f0-0000-4000-8000-000000000001",
      clinic_id: "11111111-0000-4000-8000-000000000001",
      question: "¿Qué antecedentes revisar ante ansiedad por separación?",
      patient_id: "patient-1",
      answer,
      created_at: "2026-09-22T12:00:00Z",
    });
    expect(fila.success).toBe(true);
  });

  test("rechaza una respuesta sin pregunta o con avisos fuera del vocabulario", () => {
    expect(
      knowledgeAnswerSchema.safeParse({
        pregunta: "  ",
        patientId: null,
        segmentos: [],
        cobertura: { estado: "sin_evidencia", cubiertos: [], noCubiertos: [] },
        avisos: [],
      }).success,
    ).toBe(false);
    expect(
      knowledgeAnswerSchema.safeParse({
        pregunta: "¿algo?",
        patientId: null,
        segmentos: [],
        cobertura: { estado: "sin_evidencia", cubiertos: [], noCubiertos: [] },
        avisos: ["inventado"],
      }).success,
    ).toBe(false);
  });
});

describe("fragmentoRecuperadoSchema (D4)", () => {
  test("valida la fila que devuelve la RPC de búsqueda", () => {
    const fila = fragmentoRecuperadoSchema.safeParse({
      documento_id: "doc-1",
      fragmento_ordinal: 1,
      texto: "La ansiedad por separación se diagnostica por la historia clínica.",
      seccion: "Diagnóstico",
      bibliografia,
      licencia,
      estado: "available",
      rank_cd: 0.32,
      lemas_cubiertos: ["ansied", "separ"],
      lemas_pregunta: ["ansied", "separ"],
    });
    expect(fila.success).toBe(true);
    expect(fragmentoRecuperadoSchema.safeParse({ ...{}, texto: "sin el resto" }).success).toBe(
      false,
    );
  });
});
