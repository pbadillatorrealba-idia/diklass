import { normalizeSpanish } from "@/features/voz/extraction";

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

const MARCAS_CORRECCION = /perdon|mejor dicho|corrijo|en realidad|no,/;

const NEGACION = /\b(no|nunca|sin|tampoco|ya no)\b/;

const MINIMO_TOKEN = 5;

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
