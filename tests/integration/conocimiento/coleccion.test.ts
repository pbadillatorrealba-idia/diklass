import { beforeAll, describe, expect, test } from "bun:test";
import { consultKnowledge } from "@/features/conocimiento/consulta-service";
import {
  getSource,
  incorporateSource,
  listSources,
  withdrawSource,
} from "@/features/conocimiento/coleccion-service";
import { loadSyntheticCorpus } from "@/features/conocimiento/corpus-loader";
import type { FuenteContent } from "@/features/conocimiento/schema";
import { adminClient, ANA, BRUNO, isLiveSupabase, type LiveVeterinarian, signedInVeterinarian } from "../live-supabase";

/**
 * Colección documental contra Supabase viva (FR-028, FR-030, FR-053, FR-069, SC-026 ·
 * US5-AC6/AC9/AC12/AC13). Solo corre con `SUPABASE_LIVE_TESTS=1` (job `database` de CI o el
 * stack local autorizado). Presupuestos de `design.md`: ≤ 2 s por operación.
 */

function fuenteNueva(titulo: string, texto: string): FuenteContent {
  return {
    bibliografia: {
      titulo,
      autores: ["Equipo clínico sintético"],
      anio: 2026,
      revista: null,
      editorial: null,
      edicion: null,
      doi: null,
      url: null,
    },
    licencia: { tipo: "CC BY 4.0 (ficticia)", nota: "Corpus sintético de demostración" },
    fragmentos: [{ ordinal: 1, seccion: "Síntesis", texto }],
  };
}

describe.skipIf(!isLiveSupabase)("colección documental (US5-AC6/AC9/AC12/AC13)", () => {
  let ana: LiveVeterinarian;
  let bruno: LiveVeterinarian;

  beforeAll(async () => {
    ana = await signedInVeterinarian(ANA);
    bruno = await signedInVeterinarian(BRUNO);
  });

  test("incorporar una fuente la atribuye a la identidad autenticada con su momento (FR-069 · US5-AC13)", async () => {
    const inicio = performance.now();
    const alta = await incorporateSource(ana.client, {
      clinicId: ana.clinicId,
      fuente: fuenteNueva("Protocolo de integración (ficticio)", "Texto de integración único zurdo."),
    });
    expect(performance.now() - inicio).toBeLessThan(2000);

    expect(alta.record.record.created_by).toBe(ana.userId);
    expect(alta.record.record.status).toBe("available");
    expect(alta.attribution.actorId).toBe(ana.userId);
    expect(alta.attribution.action).toBeNull();

    const coleccion = await listSources(ana.client);
    const listada = coleccion.find((entrada) => entrada.record.id === alta.record.record.id);
    expect(listada?.record.created_at).toBe(alta.record.record.created_at);
    expect(listada?.content.bibliografia.titulo).toBe("Protocolo de integración (ficticio)");
    expect(listada?.content.licencia.tipo).toBe("CC BY 4.0 (ficticia)");
  });

  test("el servidor rechaza la ingesta malformada aunque el cliente no valide (Principio V)", async () => {
    const crudo = ana.client.from("knowledge_documents").insert({
      clinic_id: ana.clinicId,
      content: { bibliografia: { titulo: "Rota" }, licencia: { tipo: "x" }, fragmentos: [] },
    } as never);
    const { error } = await crudo;
    expect(error?.message).toContain("KNOWLEDGE_SOURCE_INVALID");
  });

  test("retirar una fuente la atribuye a quien la retira y la cita sigue identificable (FR-053 · FR-069 · US5-AC12)", async () => {
    const alta = await incorporateSource(ana.client, {
      clinicId: ana.clinicId,
      fuente: fuenteNueva(
        "Fuente que se retira (ficticia)",
        "La zanahoria cuántica cura la ansiedad por separación equina.",
      ),
    });
    const documentId = alta.record.record.id;

    const inicio = performance.now();
    const retirada = await withdrawSource(bruno.client, { documentId });
    expect(performance.now() - inicio).toBeLessThan(2000);

    expect(retirada.record.record.status).toBe("withdrawn");
    expect(retirada.record.record.withdrawn_by).toBe(bruno.userId);
    expect(retirada.attribution.actorId).toBe(bruno.userId);

    // US5-AC12: la cita previa sigue siendo identificable con su bibliografia y fragmento.
    const legible = await getSource(ana.client, documentId);
    expect(legible?.content.bibliografia.titulo).toBe("Fuente que se retira (ficticia)");
    expect(legible?.content.fragmentos[0]?.texto).toContain("zanahoria cuántica");
    expect(legible?.record.status).toBe("withdrawn");
  });

  test("el corpus incorporado es inmutable salvo retirada y no admite borrado (FR-053 · HD3)", async () => {
    const alta = await incorporateSource(ana.client, {
      clinicId: ana.clinicId,
      fuente: fuenteNueva("Fuente inmutable (ficticia)", "Texto inmutable de prueba."),
    });
    const documentId = alta.record.record.id;

    const edicion = await ana.client
      .from("knowledge_documents")
      .update({ content: { editado: true } } as never)
      .eq("id", documentId);
    expect(edicion.error?.message).toContain("KNOWLEDGE_SOURCE_IMMUTABLE");

    const borrado = await ana.client.from("knowledge_documents").delete().eq("id", documentId);
    expect(borrado.error?.message).toContain("permission denied");
  });

  test("incorporar una fuente nueva no modifica fichas ni registros clínicos y queda citable (SC-026 · FR-028 · US5-AC6)", async () => {
    const admin = adminClient();
    const snapshot = async () => {
      const { data } = await admin
        .from("clinical_records")
        .select("id, record_type, content, status, created_by, created_at, updated_by, updated_at")
        .order("id");
      return JSON.stringify(data ?? []);
    };

    const antes = await snapshot();
    const termino = `habituación zurdísima ${Date.now()}`;
    const alta = await incorporateSource(ana.client, {
      clinicId: ana.clinicId,
      fuente: fuenteNueva("Fuente incremental (ficticia)", `La habituación zurdísima al transportín: ${termino}.`),
    });
    const despues = await snapshot();
    expect(despues).toBe(antes);

    const { answer } = await consultKnowledge(ana.client, {
      clinicId: ana.clinicId,
      pregunta: "¿Qué es la habituación zurdísima?",
      patientId: null,
    });
    const evidencias = answer.segmentos.filter((s) => s.kind === "evidencia");
    expect(evidencias.some((s) => s.kind === "evidencia" && s.cita.documentoId === alta.record.record.id)).toBe(
      true,
    );
  });

  test("el corpus sintético se carga por el mismo camino que la ingesta manual (D9)", async () => {
    const cargado = await loadSyntheticCorpus(ana.client, {
      clinicId: ana.clinicId,
      corpus: {
        fuentes: [
          {
            clave: "fixture-local",
            fuente: fuenteNueva("Fixture de carga (ficticio)", "El cargador usa la puerta de escritura normal."),
          },
        ],
      },
    });
    expect(Object.keys(cargado.claves)).toEqual(["fixture-local"]);
    const fuente = await getSource(ana.client, cargado.claves["fixture-local"] as string);
    expect(fuente?.content.bibliografia.titulo).toBe("Fixture de carga (ficticio)");
  });
});
