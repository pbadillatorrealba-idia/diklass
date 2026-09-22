import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { extractClinicalFacts } from "@/features/voz/extraction";

// Tasks.md 2.3 — extracción determinista (D4 · FR-016) medible sobre la conversación de
// referencia (SC-004 recall ≥ 70 %, SC-016 propuestas incorrectas ≤ 30 %) y presupuesto
// ≤ 300 ms de CPU por tramo (presupuestos de design.md).

type Esperado = { field: string; sujeto: string };
type TramoGuión = {
  seq: number;
  calidad: string;
  transcripcion: string;
  hechosEsperados: Esperado[];
};

const RUTA_GUIÓN = new URL("../../fixtures/voz/conversacion-referencia.json", import.meta.url);
const esperadoSchema = z.object({ field: z.string(), sujeto: z.string() });
const tramoGuiónSchema = z.object({
  seq: z.number(),
  calidad: z.enum(["ok", "insufficient"]),
  transcripcion: z.string(),
  hechosEsperados: z.array(esperadoSchema),
});
const GUIÓN = z
  .object({ guion: z.array(tramoGuiónSchema) })
  .parse(JSON.parse(await Bun.file(RUTA_GUIÓN).text())).guion;

const ACENTOS = /[̀-ͯ]/g;

/** Fórmula de comparación del ground truth: minúsculas, sin acentos ni espacios dobles. */
const normalizar = (texto: string) => {
  const simple = texto.toLowerCase().normalize("NFD").replace(ACENTOS, "");
  return simple.trim();
};

describe("extractClinicalFacts", () => {
  test("SC-004: recall ≥ 70 % de los antecedentes expresados en la conversación de referencia", () => {
    const propuestas = GUIÓN.flatMap((tramo) =>
      extractClinicalFacts({ text: tramo.transcripcion, quality: tramo.calidad }),
    );
    const esperados = GUIÓN.flatMap((tramo) => tramo.hechosEsperados);
    const encontrados = esperados.filter((esperado) =>
      propuestas.some(
        (propuesta) =>
          propuesta.field === esperado.field &&
          normalizar(propuesta.text).includes(normalizar(esperado.sujeto)),
      ),
    );
    expect(esperados.length).toBeGreaterThan(0);
    expect(encontrados.length / esperados.length).toBeGreaterThanOrEqual(0.7);
  });

  test("SC-016: las propuestas incorrectas no superan el 30 % de las propuestas", () => {
    const propuestas = GUIÓN.flatMap((tramo) =>
      extractClinicalFacts({ text: tramo.transcripcion, quality: tramo.calidad }),
    );
    const esperados = GUIÓN.flatMap((tramo) => tramo.hechosEsperados);
    const incorrectas = propuestas.filter(
      (propuesta) =>
        !esperados.some(
          (esperado) =>
            propuesta.field === esperado.field &&
            normalizar(propuesta.text).includes(normalizar(esperado.sujeto)),
        ),
    );
    expect(propuestas.length).toBeGreaterThan(0);
    expect(incorrectas.length / propuestas.length).toBeLessThanOrEqual(0.3);
  });

  test("FR-031 · US6-AC7: de un tramo no confiable no se deriva ningún antecedente", () => {
    expect(
      extractClinicalFacts({ text: "… (ruido ambiente inaudible) …", quality: "insufficient" }),
    ).toEqual([]);
    expect(
      extractClinicalFacts({
        text: "Destroza el sofá cuando se queda solo",
        quality: "insufficient",
      }),
    ).toEqual([]);
  });

  test("cada propuesta conserva el fragmento que la originó (SC-027 · US6-AC6)", () => {
    const tramo = GUIÓN.find((candidato) => candidato.seq === 0);
    if (!tramo) throw new Error("Falta el tramo 0 del guion de referencia");
    const propuestas = extractClinicalFacts({ text: tramo.transcripcion, quality: "ok" });
    expect(propuestas.length).toBeGreaterThan(0);
    for (const propuesta of propuestas) {
      expect(propuesta.excerptStart).toBeGreaterThanOrEqual(0);
      expect(propuesta.excerptEnd).toBeGreaterThan(propuesta.excerptStart);
      expect(propuesta.excerptEnd).toBeLessThanOrEqual(tramo.transcripcion.length);
    }
  });

  test("presupuesto: extracción de un tramo ≤ 300 ms de CPU", () => {
    const texto = GUIÓN.map((tramo) => tramo.transcripcion).join(" ");
    const inicio = performance.now();
    extractClinicalFacts({ text: texto, quality: "ok" });
    expect(performance.now() - inicio).toBeLessThanOrEqual(300);
  });

  test("es determinista (D4)", () => {
    const tramo = GUIÓN.find((candidato) => candidato.seq === 5);
    if (!tramo) throw new Error("Falta el tramo 5 del guion de referencia");
    const entrada = { text: tramo.transcripcion, quality: "ok" as const };
    expect(extractClinicalFacts(entrada)).toEqual(extractClinicalFacts(entrada));
  });
});
