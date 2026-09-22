import type { AnamnesisField } from "@/features/registro/schema";
import type { ExtractedFactDraft, TranscriptQuality } from "@/features/voz/schema";

/**
 * Extracción determinista de antecedentes clínicos desde la transcripción (D4 · FR-016).
 *
 * Reglas por campo sobre cláusulas normalizadas (minúsculas, sin acentos); cada regla produce a
 * lo sumo una propuesta por cláusula, y toda propuesta conserva el fragmento que la originó
 * (SC-027 · US6-AC6). De un tramo con calidad insuficiente NO se deriva ningún antecedente
 * (FR-031 · US6-AC7). Sin extractor externo (Principio III): si un requisito futuro exige NLP/LLM,
 * se sustituye este módulo manteniendo la firma (mismo seam que el ASR real de D2).
 *
 * Calidad medida por test sobre la conversación de referencia (SC-004 recall ≥ 70 %,
 * SC-016 propuestas incorrectas ≤ 30 %).
 */

const ACENTOS = /[̀-ͯ]/g;

/** Fórmula de comparación compartida: minúsculas sin acentos. */
export const normalizeSpanish = (texto: string) => {
  const simple = texto.toLowerCase().normalize("NFD").replace(ACENTOS, "");
  return simple.trim();
};

type ReglaExtraccion = { field: AnamnesisField; patron: RegExp };

const REGLAS: readonly ReglaExtraccion[] = [
  {
    field: "motivo_consulta",
    patron: /el problema es[^,;.]*|vengo por[^,;.]*|me preocupa que[^,;.]*/,
  },
  {
    field: "comportamiento_problematico",
    patron: /destroz\w*|ladr\w*|muerd\w*|orin\w*|llor\w*|grun\w*|maull\w*|se persigue|monta\w*|agred\w*/,
  },
  {
    field: "frecuencia",
    patron:
      /todos los dias[^,;.]*|todas las noches[^,;.]*|cada dia[^,;.]*|varias veces al dia[^,;.]*|sin parar[^,;.]*|de vez en cuando[^,;.]*/,
  },
  {
    field: "duracion",
    patron: /desde hace [^,;.]+|hace ([a-z0-9]+ )?(meses|dias|semanas|anos)[^,;.]*/,
  },
  { field: "contexto", patron: /de noche[^,;.]*|de dia[^,;.]*|de madrugada[^,;.]*/ },
  {
    field: "desencadenantes",
    patron: /cuando [^,;.]+|despues de [^,;.]+|cada vez que [^,;.]+/,
  },
  {
    field: "cambios_recientes",
    patron: /hace poco[^,;.]*|recientemente[^,;.]*|ultimamente[^,;.]*|desde que [^,;.]*/,
  },
  { field: "ambiente", patron: /departamento[^,;.]*|vive en [^,;.]*|casa con [^,;.]*/ },
  {
    field: "convivencia",
    patron: /mi gata[^,;.]*|mi perro[^,;.]*|mi bebe[^,;.]*|vive con [^,;.]*|convive con [^,;.]*/,
  },
  {
    field: "alimentacion",
    patron: /come [^,;.]*|croquetas[^,;.]*|dieta[^,;.]*|alimento[^,;.]*/,
  },
  {
    field: "actividad",
    patron: /pasear[^,;.]*|pasea[^,;.]*|ejercicio[^,;.]*|correr[^,;.]*/,
  },
  {
    field: "rutinas",
    patron: /todas las mananas[^,;.]*|rutina[^,;.]*|a la misma hora[^,;.]*/,
  },
  {
    field: "tratamientos_anteriores",
    patron:
      /le dimos [^,;.]*|probamos [^,;.]*|tratamiento con [^,;.]*|ya no toma [^,;.]*|no toma [^,;.]*|suspendimos[^,;.]*/,
  },
  {
    field: "respuesta_tratamientos",
    patron: /no hubo mejor\w*[^,;.]*|mejoro\w*[^,;.]*|empeoro\w*[^,;.]*|mejoria[^,;.]*/,
  },
  { field: "texto_libre", patron: /dermatitis[^,;.]*|alergia[^,;.]*|epilepsia[^,;.]*/ },
];

const SEPARADORES = /[.,;!?…\n]/;

type Cláusula = { text: string; start: number; end: number };

/** Parte el tramo en cláusulas conservando offsets sobre el texto original (SC-027). */
function partirCláusulas(texto: string): Cláusula[] {
  const cláusulas: Cláusula[] = [];
  let inicio = 0;
  for (let indice = 0; indice < texto.length; indice++) {
    if (SEPARADORES.test(texto.charAt(indice))) {
      cláusulas.push({ text: texto.slice(inicio, indice), start: inicio, end: indice });
      inicio = indice + 1;
    }
  }
  if (inicio < texto.length) {
    cláusulas.push({ text: texto.slice(inicio), start: inicio, end: texto.length });
  }
  return cláusulas.filter((cláusula) => cláusula.text.trim().length > 0);
}

export function extractClinicalFacts(tramo: {
  text: string;
  quality: TranscriptQuality;
}): ExtractedFactDraft[] {
  if (tramo.quality !== "ok") {
    return [];
  }
  const propuestas: ExtractedFactDraft[] = [];
  for (const cláusula of partirCláusulas(tramo.text)) {
    const normalizada = normalizeSpanish(cláusula.text);
    for (const regla of REGLAS) {
      if (regla.patron.test(normalizada)) {
        propuestas.push({
          field: regla.field,
          text: cláusula.text.trim(),
          excerptStart: cláusula.start,
          excerptEnd: cláusula.end,
        });
      }
    }
  }
  return propuestas;
}
