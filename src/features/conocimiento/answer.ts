import type { AntecedentGroup, PatientContent } from "@/features/registro/schema";
import { computeMissingFichaFields } from "@/features/registro/summaries";
import {
  type AvisoRespuesta,
  type Bibliografia,
  type Cobertura,
  type Fragmento,
  type KnowledgeAnswer,
  type Licencia,
  PROCEDENCIA_POR_KIND,
  type SegmentoRespuesta,
} from "./schema";

/**
 * Composición de la respuesta del asistente (D5 del diseño del cambio): función pura y
 * determinista, sin generación de lenguaje natural. Toda afirmación clínica de la respuesta
 * es una cita verbatim de un fragmento (SC-010 por construcción); los datos de la ficha van
 * etiquetados con su referencia y snapshot (FR-020) y lo derivado por el sistema se declara
 * como inferencia (FR-021).
 */

export type CandidatoFragmento = {
  documentoId: string;
  fragmentoOrdinal: number;
  texto: string;
  seccion: string | null;
  bibliografia: Bibliografia;
  licencia: Licencia;
  estado: "available" | "withdrawn";
  lemasCubiertos: string[];
  lemasPregunta: string[];
  rankCd: number;
};

/** Contexto de paciente tal como se usa para responder: identidad y ficha leída (002). */
export type ContextoPaciente = { id: string; content: PatientContent } | null;

/** Un fragmento califica como respaldo si cubre al menos la mitad de los lemas (D4). */
const UMBRAL_COBERTURA_LEMAS = 0.5;

/** Máximo de referencias mostradas por respuesta (SC-002 mide la relevancia en el top-5). */
const MAX_REFERENCIAS = 5;

const GRUPOS_ANTECEDENTES: AntecedentGroup[] = [
  "medicalHistory",
  "preexistingDiseases",
  "currentMedications",
  "knownAllergies",
  "behavioralHistory",
];

const ETIQUETA_GRUPO: Record<AntecedentGroup, string> = {
  medicalHistory: "Antecedente médico",
  preexistingDiseases: "Enfermedad preexistente",
  currentMedications: "Medicación actual",
  knownAllergies: "Alergia conocida",
  behavioralHistory: "Antecedente conductual",
};

const CAMPOS_FICHA: [string, string, (content: PatientContent) => string | number | null][] = [
  ["name", "Nombre", (content) => content.name],
  ["species", "Especie", (content) => content.species],
  ["breed", "Raza", (content) => content.breed],
  ["birthDate", "Fecha de nacimiento", (content) => content.birthDate],
  ["ageMonths", "Edad (meses)", (content) => content.ageMonths],
  ["weightKg", "Peso (kg)", (content) => content.weightKg],
  ["sex", "Sexo", (content) => content.sex],
  ["reproductiveStatus", "Estado reproductivo", (content) => content.reproductiveStatus],
];

function segmentosDeFicha(content: PatientContent): SegmentoRespuesta[] {
  const segmentos: SegmentoRespuesta[] = [];
  const añadir = (fichaRef: string, texto: string, provenance: "reportada" | "desconocida") => {
    segmentos.push({ id: `ficha-${fichaRef}`, kind: "ficha", provenance, texto, fichaRef });
  };

  for (const [referencia, etiqueta, leerValor] of CAMPOS_FICHA) {
    const valor = leerValor(content);
    if (valor !== null && valor !== "") {
      añadir(referencia, `${etiqueta}: ${valor}`, PROCEDENCIA_POR_KIND.ficha);
    }
  }

  for (const grupo of GRUPOS_ANTECEDENTES) {
    const items = content.antecedentes[grupo];
    items.forEach((item, indice) => {
      const negativo = item.negative ? " (hallazgo negativo)" : "";
      añadir(
        `antecedentes.${grupo}[${indice}]`,
        `${ETIQUETA_GRUPO[grupo]}: ${item.text}${negativo}`,
        PROCEDENCIA_POR_KIND.ficha,
      );
    });
  }

  // Lo sin dato es explícito y de procedencia desconocida: nunca un valor por omisión
  // (FR-021 · FR-044 de 002, vía computeMissingFichaFields).
  for (const falta of computeMissingFichaFields(content)) {
    const detalle = falta.kind === "sin_dato" ? "sin dato registrado" : "grupo sin registrar";
    añadir(falta.field, `${detalle} (${falta.field})`, "desconocida");
  }

  return segmentos;
}

/**
 * Compone la respuesta a una pregunta en lenguaje natural (FR-005 · US5-AC1). Reglas del
 * contrato (D5):
 * - Sin candidatos calificados: `sin_evidencia` + aviso `sin_respaldo_documental` y cero
 *   contenido clínico no citado (FR-023 · SC-025 · SC-010 · US5-AC2).
 * - Cobertura parcial de los lemas de la pregunta: aviso `cobertura_parcial` que nombra lo
 *   sin cubrir (FR-022 · US5-AC8).
 * - Los datos de ficha solo entran con paciente seleccionado, con `fichaRef` y snapshot
 *   (FR-020 · FR-051 · US5-AC5/AC10).
 * - Varios documentos con evidencia: todo se presenta con su cita y se declara la ausencia
 *   de arbitraje (FR-052 · US5-AC11).
 * - Una cita hacia fuente retirada se marca (FR-053 · US5-AC12).
 */
export function composeAnswer(input: {
  pregunta: string;
  lemasPregunta: string[];
  candidatos: CandidatoFragmento[];
  paciente: ContextoPaciente;
}): KnowledgeAnswer {
  const lemas = [...new Set(input.lemasPregunta)].sort();
  const umbral =
    lemas.length === 0
      ? Number.POSITIVE_INFINITY
      : Math.ceil(lemas.length * UMBRAL_COBERTURA_LEMAS);

  const ordenados = [...input.candidatos].sort(
    (a, b) =>
      b.rankCd - a.rankCd ||
      a.documentoId.localeCompare(b.documentoId) ||
      a.fragmentoOrdinal - b.fragmentoOrdinal,
  );
  const calificados = ordenados.filter(
    (candidato) => candidato.lemasCubiertos.filter((lema) => lemas.includes(lema)).length >= umbral,
  );
  const referencias = calificados.slice(0, MAX_REFERENCIAS);

  const cubiertos = [
    ...new Set(
      referencias.flatMap((candidato) =>
        candidato.lemasCubiertos.filter((lema) => lemas.includes(lema)),
      ),
    ),
  ].sort();
  const noCubiertos = lemas.filter((lema) => !cubiertos.includes(lema));

  const cobertura: Cobertura = {
    estado:
      referencias.length === 0 ? "sin_evidencia" : noCubiertos.length === 0 ? "cubre" : "parcial",
    cubiertos,
    noCubiertos: referencias.length === 0 ? [] : noCubiertos,
  };

  const segmentos: SegmentoRespuesta[] = referencias.map((candidato) => ({
    id: `evidencia-${candidato.documentoId}-${candidato.fragmentoOrdinal}`,
    kind: "evidencia",
    provenance: PROCEDENCIA_POR_KIND.evidencia,
    texto: candidato.texto,
    cita: {
      documentoId: candidato.documentoId,
      fragmentoOrdinal: candidato.fragmentoOrdinal,
      textoCitado: candidato.texto,
      bibliografia: candidato.bibliografia,
      licencia: candidato.licencia,
      estado: candidato.estado,
    },
  }));

  if (input.paciente !== null) {
    segmentos.push(...segmentosDeFicha(input.paciente.content));
  }

  if (referencias.length > 0) {
    const detalle = noCubiertos.length > 0 ? `; sin respaldo para «${noCubiertos.join(", ")}»` : "";
    segmentos.push({
      id: "inferencia-1",
      kind: "inferencia",
      provenance: PROCEDENCIA_POR_KIND.inferencia,
      texto: `El sistema asoció la pregunta a los conceptos «${cubiertos.join(", ")}» con respaldo documental${detalle}. Esta asociación es una derivación del sistema, no una afirmación de las fuentes.`,
    });
  }

  const avisos: AvisoRespuesta[] = [];
  if (cobertura.estado === "sin_evidencia") avisos.push("sin_respaldo_documental");
  if (cobertura.estado === "parcial") avisos.push("cobertura_parcial");
  if (new Set(referencias.map((candidato) => candidato.documentoId)).size >= 2) {
    avisos.push("fuentes_multiples");
  }
  if (input.paciente === null) avisos.push("sin_paciente_seleccionado");
  if (referencias.some((candidato) => candidato.estado === "withdrawn")) {
    avisos.push("fuente_retirada");
  }

  return {
    pregunta: input.pregunta.trim(),
    patientId: input.paciente?.id ?? null,
    segmentos,
    cobertura,
    avisos,
  };
}

/**
 * Reconstrucción de una respuesta guardada (FR-053 · US5-AC12): la cita de una fuente
 * retirada sigue siendo identificable —bibliografía y fragmento íntegros— y queda marcada.
 */
export function resolveCitations(
  answer: KnowledgeAnswer,
  estados: Record<string, "available" | "withdrawn">,
): KnowledgeAnswer {
  let hayRetirada = false;
  const segmentos = answer.segmentos.map((segmento) => {
    if (segmento.kind !== "evidencia") return segmento;
    const estado = estados[segmento.cita.documentoId] ?? segmento.cita.estado;
    if (estado === "withdrawn") hayRetirada = true;
    return { ...segmento, cita: { ...segmento.cita, estado } };
  });

  const avisos: AvisoRespuesta[] =
    hayRetirada && !answer.avisos.includes("fuente_retirada")
      ? [...answer.avisos, "fuente_retirada"]
      : answer.avisos;

  return { ...answer, segmentos, avisos };
}

export type ContextoFragmento = {
  bibliografia: Bibliografia;
  licencia: Licencia;
  estado: "available" | "withdrawn";
  fragmentos: { ordinal: number; seccion: string | null; texto: string; citado: boolean }[];
};

/**
 * Fragmento citado dentro de su documento (FR-007 · US5-AC7): cabecera bibliográfica más
 * los fragmentos vecinos, con el citado resaltado.
 */
export function buildFragmentContext(
  documento: {
    bibliografia: Bibliografia;
    licencia: Licencia;
    estado: "available" | "withdrawn";
    fragmentos: Fragmento[];
  },
  fragmentoOrdinal: number,
  ventana = 1,
): ContextoFragmento {
  const fragmentos = documento.fragmentos
    .filter((fragmento) => Math.abs(fragmento.ordinal - fragmentoOrdinal) <= ventana)
    .sort((a, b) => a.ordinal - b.ordinal)
    .map((fragmento) => ({
      ordinal: fragmento.ordinal,
      seccion: fragmento.seccion,
      texto: fragmento.texto,
      citado: fragmento.ordinal === fragmentoOrdinal,
    }));

  return {
    bibliografia: documento.bibliografia,
    licencia: documento.licencia,
    estado: documento.estado,
    fragmentos,
  };
}

/**
 * Corte determinista de un texto en fragmentos para la ingesta (D2/D9): párrafos separados
 * por líneas en blanco, con los encabezados (`#…`) como sección de los fragmentos que
 * siguen.
 */
export function splitIntoFragments(texto: string): Fragmento[] {
  const fragmentos: Fragmento[] = [];
  let seccion: string | null = null;
  let parrafo: string[] = [];

  const volcar = () => {
    if (parrafo.length === 0) return;
    fragmentos.push({
      ordinal: fragmentos.length + 1,
      seccion,
      texto: parrafo.join("\n"),
    });
    parrafo = [];
  };

  for (const linea of texto.replace(/\r\n/g, "\n").split("\n")) {
    const limpia = linea.trim();
    if (limpia === "") {
      volcar();
      continue;
    }
    if (limpia.startsWith("#")) {
      volcar();
      seccion = limpia.replace(/^#+\s*/, "").trim() || null;
      continue;
    }
    parrafo.push(limpia);
  }
  volcar();

  return fragmentos;
}
