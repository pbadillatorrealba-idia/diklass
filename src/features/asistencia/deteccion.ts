import { type CandidatoFragmento, composeAnswer } from "@/features/conocimiento/answer";
import type { AnamnesisField, PatientContent } from "@/features/registro/schema";
import { computeMissingFichaFields } from "@/features/registro/summaries";
import { SUGERENCIAS, type SugerenciaRegla } from "./reglas";
import type {
  DecisionSugerencia,
  EntradaAnamnesis,
  Fundamento,
  MissingInformationContent,
} from "./schema";

/**
 * Detección de información faltante y composición del fundamento (D3/D4 del diseño del cambio):
 * funciones puras y deterministas. Lo pendiente es DERIVADO (detectado y sin decisión); la fila
 * `missing_information` solo registra la decisión del veterinario (HD3).
 */

export type DecisionRegistrada = { recordId: string; content: MissingInformationContent };

export type EstadoSugerencia = "pendiente" | DecisionSugerencia;

export type SugerenciaDetectada = {
  key: string;
  pregunta: string;
  estado: EstadoSugerencia;
  /** null = pendiente de resolver por el servicio (la decisión registrada ya lo trae). */
  fundamento: Fundamento | null;
  camposRelacionados: string[];
  decisionRecordId: string | null;
};

/** Comparación sin distinguir mayúsculas ni acentos (reglas de `reglas.ts`). */
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Términos de `terminos` presentes en `texto` (matching transparente de las reglas, D5): la
 * misma fórmula de matching que usan la cobertura de sugerencias y las hipótesis.
 */
export function matchearTerminos(texto: string, terminos: string[]): string[] {
  const normalizado = normalizar(texto);
  const encontrados: string[] = [];
  for (const termino of terminos) {
    if (normalizado.includes(normalizar(termino)) && !encontrados.includes(termino)) {
      encontrados.push(termino);
    }
  }
  return encontrados;
}

function camposAnamnesisCubiertos(anamnesis: EntradaAnamnesis[]): Set<AnamnesisField> {
  const cubiertos = new Set<AnamnesisField>();
  for (const entrada of anamnesis) {
    if (entrada.content.text.trim() !== "") {
      cubiertos.add(entrada.content.field);
    }
  }
  return cubiertos;
}

function estaAplicable(sugerencia: SugerenciaRegla, anamnesis: EntradaAnamnesis[]): boolean {
  if (sugerencia.soloSi === null) {
    return true;
  }
  return anamnesis.some(
    (entrada) =>
      sugerencia.soloSi?.campos.includes(entrada.content.field) === true &&
      matchearTerminos(entrada.content.text, sugerencia.soloSi?.terminos ?? []).length > 0,
  );
}

function estaCubierta(
  sugerencia: SugerenciaRegla,
  input: { anamnesis: EntradaAnamnesis[]; ficha: PatientContent | null },
): boolean {
  const cubiertos = camposAnamnesisCubiertos(input.anamnesis);
  if (sugerencia.cobertura.anamnesis.some((campo) => cubiertos.has(campo))) {
    return true;
  }
  if (sugerencia.cobertura.anamnesis.length > 0 && sugerencia.terminosCobertura.length > 0) {
    const cubiertaPorContenido = input.anamnesis.some(
      (entrada) => matchearTerminos(entrada.content.text, sugerencia.terminosCobertura).length > 0,
    );
    if (cubiertaPorContenido) {
      return true;
    }
  }
  if (sugerencia.cobertura.ficha.length > 0) {
    if (input.ficha === null) {
      return false;
    }
    // FR-044 (heredado · SC-024): computeMissingFichaFields solo señala lo sin dato; un hallazgo
    // negativo explícito deja el grupo como registrado y cubierto.
    const faltantes = new Set(
      computeMissingFichaFields(input.ficha).map((faltante) => faltante.field),
    );
    return sugerencia.cobertura.ficha.every((campo) => !faltantes.has(campo));
  }
  return false;
}

/**
 * Sugerencias pertinentes aún no cubiertas (FR-008 · US7-AC1/AC4): las condiciones no
 * cumplidas no se proponen y lo que la anamnesis o la ficha ya cubren no se propone como
 * faltante.
 */
export function detectMissingInformation(input: {
  anamnesis: EntradaAnamnesis[];
  ficha: PatientContent | null;
}): SugerenciaRegla[] {
  return SUGERENCIAS.filter(
    (sugerencia) => estaAplicable(sugerencia, input.anamnesis) && !estaCubierta(sugerencia, input),
  );
}

/**
 * Estados por consulta (FR-008 · US7-AC2/AC6): lo detectado sin decisión es `pendiente`; una
 * decisión registrada fija su estado y su fila. Una decisión cuya sugerencia ya no se detecta
 * sigue visible como registro de la consulta (HD3: la fila es la decisión).
 */
export function mergeSuggestionStates(
  detectadas: SugerenciaRegla[],
  decisiones: DecisionRegistrada[],
): SugerenciaDetectada[] {
  const decisionPorClave = new Map(
    decisiones.map((decision) => [decision.content.suggestionKey, decision]),
  );
  const estados: SugerenciaDetectada[] = detectadas.map((sugerencia) => {
    const decision = decisionPorClave.get(sugerencia.key);
    return {
      key: sugerencia.key,
      pregunta: sugerencia.pregunta,
      estado: decision?.content.estado ?? "pendiente",
      fundamento: decision?.content.fundamento ?? null,
      camposRelacionados: sugerencia.camposRelacionados,
      decisionRecordId: decision?.recordId ?? null,
    };
  });
  for (const decision of decisiones) {
    if (!detectadas.some((sugerencia) => sugerencia.key === decision.content.suggestionKey)) {
      estados.push({
        key: decision.content.suggestionKey,
        pregunta: decision.content.pregunta,
        estado: decision.content.estado,
        fundamento: decision.content.fundamento,
        camposRelacionados: decision.content.camposRelacionados,
        decisionRecordId: decision.recordId,
      });
    }
  }
  return estados;
}

/**
 * Fundamento de una sugerencia sobre la recuperación de 003 (FR-033 · US7-AC3/AC5): si un
 * fragmento califica como respaldo, se cita con su texto verbatim; si no, se declara criterio
 * general — jamás una cita que no exista (FR-023).
 */
export function composeFundamento(pregunta: string, candidatos: CandidatoFragmento[]): Fundamento {
  const respuesta = composeAnswer({
    pregunta,
    lemasPregunta: candidatos[0]?.lemasPregunta ?? [],
    candidatos,
    paciente: null,
  });
  const evidencia = respuesta.segmentos.find((segmento) => segmento.kind === "evidencia");
  return evidencia !== undefined
    ? { kind: "fuente", cita: evidencia.cita }
    : { kind: "criterio_general" };
}
