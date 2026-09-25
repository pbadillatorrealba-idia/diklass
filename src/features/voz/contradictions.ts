import { normalizeSpanish } from "@/features/voz/extraction";
import type { ExtractedFactDraft } from "@/features/voz/schema";

/**
 * Detección determinista de contradicciones como SEÑAL (D4 · FR-032 · US6-AC8).
 *
 * FR-032 prohíbe resolver la contradicción por cuenta del sistema y US6-AC8 prohíbe sobrescribir
 * el dato previo: esta función es pura y solo devuelve señales que la interfaz muestra para que
 * el veterinario decida. Compara el hecho nuevo contra (a) borradores previos de la misma sesión
 * —incluida la autocorrección del tutor dentro de la conversación—, (b) observaciones de anamnesis
 * ya registradas y (c) antecedentes de la ficha. Heurística determinista y acotada (Principio III):
 * mismo campo con valor distinto y marca de corrección/negación, o sujeto compartido con polaridad
 * opuesta frente a la ficha.
 */

export type HechoComparable = {
  id: string;
  field: string;
  text: string;
  negation: boolean;
};

export type FichaComparable = {
  refId: string;
  group: string;
  text: string;
  negation: boolean;
};

export type ContextoContradicciones = {
  previos: HechoComparable[];
  anamnesis: HechoComparable[];
  ficha: FichaComparable[];
};

export type SeñalContradicción = {
  refKind: "borrador" | "ficha" | "anamnesis";
  refId: string;
  note: string;
};

// El texto comparado es una cláusula ya partida por comas (extractClinicalFacts), así que una
// marca con coma («no,») no podría coincidir nunca (revisión de la PR #29).
const MARCAS_CORRECCION = /perdon|mejor dicho|corrijo|en realidad/;

// «sin» niega («sin vómitos»), salvo en las locuciones de frecuencia que extrae la regla de
// `frecuencia` («sin parar»): tratarlas como negación marcaba falsas contradicciones.
const NEGACION = /\b(no|nunca|tampoco|ya no)\b|\bsin\b(?! (parar|cesar|descanso)\b)/;

const MINIMO_TOKEN = 5;

/**
 * Polaridad de un texto con la misma regla para el hecho nuevo y para lo ya registrado: si los
 * previos llegaran siempre como afirmativos, cualquier hecho negado contradiría a un previo
 * también negado (revisión de la PR #29).
 */
export function esNegativo(texto: string): boolean {
  return NEGACION.test(normalizeSpanish(texto));
}

/** Sustantivos comparables: palabras de al menos 5 caracteres tras normalizar. */
function tokensContenido(texto: string): Set<string> {
  const palabras = normalizeSpanish(texto).split(/[^a-z0-9]+/);
  return new Set(palabras.filter((palabra) => palabra.length >= MINIMO_TOKEN));
}

function compartenSujeto(nuevo: string, existente: string): boolean {
  const delExistente = tokensContenido(existente);
  for (const token of tokensContenido(nuevo)) {
    if (delExistente.has(token)) {
      return true;
    }
  }
  return false;
}

/**
 * Marca las contradicciones de un lote de propuestas acumulándolas en un contexto local: cada
 * propuesta ve las anteriores del MISMO tramo (FR-032 · US6-AC8) — la autocorrección del tutor
 * dentro de una frase dispara su insignia — sin mutar el contexto del llamador (función pura).
 */
export function flagContradictions(
  propuestas: ExtractedFactDraft[],
  contexto: ContextoContradicciones,
): ExtractedFactDraft[] {
  const previos = [...contexto.previos];
  return propuestas.map((propuesta, indice) => {
    const candidato: HechoComparable = {
      id: `propuesta-${indice}`,
      field: propuesta.field,
      text: propuesta.text,
      negation: esNegativo(propuesta.text),
    };
    const señales = detectContradictions(candidato, { ...contexto, previos });
    previos.push(candidato);
    return { ...propuesta, contradiction: señales[0] ?? propuesta.contradiction ?? null };
  });
}

export function detectContradictions(
  nuevo: HechoComparable,
  contexto: ContextoContradicciones,
): SeñalContradicción[] {
  const señales: SeñalContradicción[] = [];
  const normalizado = normalizeSpanish(nuevo.text);
  const corrige = MARCAS_CORRECCION.test(normalizado);
  const negativo = nuevo.negation || NEGACION.test(normalizado);

  for (const previo of contexto.previos) {
    const mismoCampo = previo.field === nuevo.field;
    const distintoValor = normalizeSpanish(previo.text) !== normalizado;
    if (mismoCampo && distintoValor && (corrige || negativo !== previo.negation)) {
      señales.push({
        refKind: "borrador",
        refId: previo.id,
        note: "Contradice un hecho previo de la misma conversación",
      });
    }
  }

  for (const entrada of contexto.anamnesis) {
    const mismoCampo = entrada.field === nuevo.field;
    const distintoValor = normalizeSpanish(entrada.text) !== normalizado;
    if (mismoCampo && distintoValor && (corrige || negativo !== entrada.negation)) {
      señales.push({
        refKind: "anamnesis",
        refId: entrada.id,
        note: "Contradice una observación de anamnesis ya registrada",
      });
    }
  }

  for (const item of contexto.ficha) {
    if (compartenSujeto(nuevo.text, item.text) && negativo !== item.negation) {
      señales.push({
        refKind: "ficha",
        refId: item.refId,
        note: "Contradice un antecedente ya registrado en la ficha",
      });
    }
  }

  return señales;
}
