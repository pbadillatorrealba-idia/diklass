import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { corpusSinteticoSchema } from "@/features/conocimiento/corpus-loader";

/**
 * Corpus inicial real de la base de conocimiento (cambio `corpus-miedo-perros-gatos`):
 * FR-097 (una sola fuente real), FR-098 (fragmentos fieles y citables), FR-099 (metadatos sin
 * invenciones) y FR-100 (conjunto anotado alineado al corpus).
 */

const fixtures = join(import.meta.dir, "../../fixtures/conocimiento");
const corpus = corpusSinteticoSchema.parse(
  JSON.parse(readFileSync(join(fixtures, "corpus-miedo.json"), "utf8")),
);
const conjunto = JSON.parse(readFileSync(join(fixtures, "conjunto-anotado.json"), "utf8")) as {
  preguntas: { pregunta: string; evidenciaEsperada: { documentoClave: string; ordinal: number } }[];
  preguntasFueraDeDominio: string[];
};

const fuente = corpus.fuentes[0]?.fuente;
const textoCorpus = (fuente?.fragmentos ?? []).map((fragmento) => fragmento.texto).join(" ");

function palabras(texto: string): string[] {
  return (
    texto
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .match(/[a-z]{6,}/g) ?? []
  );
}

describe("corpus inicial: «Problemas de miedo en perros y gatos» (FR-097)", () => {
  test("hay una sola fuente y ninguna ficticia", () => {
    expect(corpus.fuentes).toHaveLength(1);
    expect(corpus.fuentes[0]?.clave).toBe("miedo-perros-gatos");
    expect(JSON.stringify(corpus)).not.toMatch(/fictici|sint[eé]tic/i);
  });
});

describe("metadatos sin invenciones (FR-099)", () => {
  test("registra lo que consta y deja vacío lo que no", () => {
    const { bibliografia, licencia } = fuente ?? {};
    expect(bibliografia?.titulo).toBe("Problemas de miedo en perros y gatos");
    expect(bibliografia?.autores).toEqual(["Susana Le Brech"]);
    expect(bibliografia?.anio).toBeNull();
    expect(bibliografia?.doi).toBeNull();
    expect(bibliografia?.url).toBeNull();
    expect(licencia?.tipo).toBe("Por confirmar");
  });
});

describe("fragmentos fieles y citables (FR-098)", () => {
  test("cada fragmento abre con sus diapositivas de origen y trae sección", () => {
    for (const fragmento of fuente?.fragmentos ?? []) {
      expect(fragmento.texto, `fragmento ${fragmento.ordinal}`).toMatch(
        /^\[diap\. \d+(–\d+)?(, \d+(–\d+)?)*\] /,
      );
      expect(fragmento.seccion, `fragmento ${fragmento.ordinal}`).not.toBeNull();
    }
  });

  test("las diapositivas citadas existen (1–60) y avanzan sin retroceder", () => {
    let anterior = 0;
    for (const fragmento of fuente?.fragmentos ?? []) {
      const lista = fragmento.texto.match(/^\[diap\. ([^\]]+)\]/)?.[1] ?? "";
      const numeros = lista.match(/\d+/g)?.map(Number) ?? [];
      expect(numeros.length, `fragmento ${fragmento.ordinal}`).toBeGreaterThan(0);
      expect(Math.min(...numeros), `fragmento ${fragmento.ordinal}`).toBeGreaterThanOrEqual(
        anterior,
      );
      expect(Math.max(...numeros)).toBeLessThanOrEqual(60);
      anterior = Math.min(...numeros);
    }
  });

  test("ningún fragmento trae dosis ni pautas: el documento no las da", () => {
    expect(textoCorpus).not.toMatch(/\d\s*(mg|mcg|µg|ml)\b/i);
  });
});

describe("conjunto anotado alineado al corpus (FR-100)", () => {
  test("cada pregunta apunta a un fragmento que existe", () => {
    expect(conjunto.preguntas.length).toBeGreaterThanOrEqual(10);
    for (const { pregunta, evidenciaEsperada } of conjunto.preguntas) {
      expect(evidenciaEsperada.documentoClave, pregunta).toBe("miedo-perros-gatos");
      const existe = fuente?.fragmentos.some((f) => f.ordinal === evidenciaEsperada.ordinal);
      expect(existe, pregunta).toBe(true);
    }
  });

  test("las preguntas fuera de dominio traen un término que el corpus no contiene", () => {
    expect(conjunto.preguntasFueraDeDominio.length).toBeGreaterThanOrEqual(5);
    const vocabulario = new Set(palabras(textoCorpus));
    for (const pregunta of conjunto.preguntasFueraDeDominio) {
      const ausente = palabras(pregunta).some((palabra) => !vocabulario.has(palabra));
      expect(ausente, pregunta).toBe(true);
    }
  });
});
