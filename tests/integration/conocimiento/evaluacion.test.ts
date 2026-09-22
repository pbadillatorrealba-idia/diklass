import { beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getSource, listSources, withdrawSource } from "@/features/conocimiento/coleccion-service";
import { consultKnowledge } from "@/features/conocimiento/consulta-service";
import { loadSyntheticCorpus } from "@/features/conocimiento/corpus-loader";
import type { KnowledgeAnswer, SegmentoRespuesta } from "@/features/conocimiento/schema";
import { ANA, isLiveSupabase, type LiveVeterinarian, signedInVeterinarian } from "../live-supabase";

/**
 * Arnés de evaluación del conjunto anotado (D9 de design.md). Tarea 3.3.
 *
 * Mide los criterios medibles sobre el corpus y el conjunto **sintéticos** (decisión de
 * usuario; HD7): SC-002 (hit@5), SC-025 (ausencia de respaldo en preguntas fuera de
 * dominio), SC-010 (cero afirmaciones respaldadas sin evidencia recuperable) y SC-003
 * (fidelidad automática por texto verbatim; su revisión manual y la evaluación de SC-015
 * con especialistas quedan como aceptación pendiente, no como verificado).
 */

type ConjuntoAnotado = {
  preguntas: { pregunta: string; evidenciaEsperada: { documentoClave: string; ordinal: number } }[];
  preguntasFueraDeDominio: string[];
};

type CorpusSintetico = {
  fuentes: { clave: string; fuente: unknown }[];
};

const conjunto = JSON.parse(
  readFileSync(join(import.meta.dir, "../../fixtures/conocimiento/conjunto-anotado.json"), "utf8"),
) as ConjuntoAnotado;

const corpus = JSON.parse(
  readFileSync(join(import.meta.dir, "../../fixtures/conocimiento/corpus-sintetico.json"), "utf8"),
) as CorpusSintetico;

function citas(answer: KnowledgeAnswer): SegmentoRespuesta[] {
  return answer.segmentos.filter((segmento) => segmento.kind === "evidencia");
}

describe.skipIf(!isLiveSupabase)("evaluación sobre el conjunto anotado sintético", () => {
  let ana: LiveVeterinarian;
  let claves: Record<string, string>;
  const respuestasCubiertas: { pregunta: string; answer: KnowledgeAnswer }[] = [];
  const respuestasFuera: { pregunta: string; answer: KnowledgeAnswer }[] = [];

  beforeAll(async () => {
    ana = await signedInVeterinarian(ANA);

    // Colección determinista por corrida: las copias de corridas previas se retiran (no se
    // borra nada, FR-053) y el corpus sintético se incorpora por la puerta de escritura.
    for (const entrada of await listSources(ana.client)) {
      if (entrada.record.status === "available") {
        await withdrawSource(ana.client, { documentId: entrada.record.id });
      }
    }
    ({ claves } = await loadSyntheticCorpus(ana.client, {
      clinicId: ana.clinicId,
      corpus: {
        fuentes: corpus.fuentes.map((entrada) => ({
          clave: entrada.clave,
          fuente: entrada.fuente,
        })),
      },
    }));

    for (const item of conjunto.preguntas) {
      const { answer } = await consultKnowledge(ana.client, {
        clinicId: ana.clinicId,
        pregunta: item.pregunta,
        patientId: null,
      });
      respuestasCubiertas.push({ pregunta: item.pregunta, answer });
    }
    for (const pregunta of conjunto.preguntasFueraDeDominio) {
      const { answer } = await consultKnowledge(ana.client, {
        clinicId: ana.clinicId,
        pregunta,
        patientId: null,
      });
      respuestasFuera.push({ pregunta, answer });
    }
  });

  test("SC-002: la evidencia esperada figura entre las primeras 5 referencias en ≥ 80% de las preguntas", () => {
    let aciertos = 0;
    const detalle: string[] = [];
    conjunto.preguntas.forEach((item, indice) => {
      const answer = respuestasCubiertas[indice]?.answer;
      if (!answer) throw new Error(`sin respuesta para «${item.pregunta}»`);
      const documentoEsperado = claves[item.evidenciaEsperada.documentoClave];
      const hit = citas(answer).some(
        (segmento) =>
          segmento.kind === "evidencia" &&
          segmento.cita.documentoId === documentoEsperado &&
          segmento.cita.fragmentoOrdinal === item.evidenciaEsperada.ordinal,
      );
      if (hit) aciertos += 1;
      detalle.push(`${hit ? "hit" : "miss"}@5 · ${item.pregunta}`);
    });
    const tasa = aciertos / conjunto.preguntas.length;
    console.log(
      `SC-002 hit@5 = ${(tasa * 100).toFixed(0)}% (${aciertos}/${conjunto.preguntas.length})`,
    );
    for (const linea of detalle) console.log(`  ${linea}`);
    expect(tasa).toBeGreaterThanOrEqual(0.8);
  });

  test("SC-025: el 100% de las preguntas sin cobertura declara la ausencia de respaldo (US5-AC2)", () => {
    for (const { pregunta, answer } of respuestasFuera) {
      expect(answer.avisos, pregunta).toContain("sin_respaldo_documental");
      expect(citas(answer), pregunta).toHaveLength(0);
      expect(answer.cobertura.estado, pregunta).toBe("sin_evidencia");
    }
    console.log(
      `SC-025 ausencia declarada = 100% (${respuestasFuera.length}/${conjunto.preguntasFueraDeDominio.length})`,
    );
  });

  test("SC-010 y SC-003 (automática): toda cita es recuperable y verbatim (US5-AC2 · US5-AC1)", async () => {
    let verificadas = 0;
    for (const { pregunta, answer } of [...respuestasCubiertas, ...respuestasFuera]) {
      for (const segmento of citas(answer)) {
        if (segmento.kind !== "evidencia") continue;
        const fuente = await getSource(ana.client, segmento.cita.documentoId);
        expect(fuente, pregunta).not.toBeNull();
        const fragmento = fuente?.content.fragmentos.find(
          (item) => item.ordinal === segmento.cita.fragmentoOrdinal,
        );
        // SC-010: afirmación presentada como respaldada ⇒ evidencia recuperable idéntica.
        expect(fragmento?.texto, pregunta).toBe(segmento.cita.textoCitado);
        verificadas += 1;
      }
    }
    console.log(
      `SC-010 · SC-003 (verbatim) = 0 incumplimientos sobre ${verificadas} citas verificadas`,
    );
    expect(verificadas).toBeGreaterThan(0);
  });
});
